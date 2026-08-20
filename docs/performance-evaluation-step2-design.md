# SLSS 主管绩效评价 Step 2 设计

## 1. 领域边界

Excel 中的“被考核部门”和“协同评分部门”是两种不同关系：

- `template_department`：模板所属、被考核部门。
- `evaluator_scope`：允许对某项指标评分的部门、角色或全体部门。
- 前端不负责过滤数据；后端在查询阶段完成行级和列级裁剪。
- 所有绩效数据同时受租户范围和部门范围约束。

## 2. 数据库模型（建议新增 V46）

### 2.1 部门与用户归属

`performance_departments`

- `id`、`code`、`name`、`status`、`version`、`created_at`、`updated_at`

`user_department_memberships`

- `user_id`、`department_id`、`is_primary`、`effective_from`、`effective_to`
- 一个用户同一时刻只能有一个主部门；保留历史变更，不在 `users` 表直接覆盖部门。

### 2.2 模板定义

`performance_templates`

- `id`、`tenant_id`、`department_id`、`template_name`、`source_sheet`
- `schema_version`、`template_version`、`status`、`total_score`
- `effective_from`、`effective_to`、`created_by`、`version`
- 唯一约束：`tenant_id + department_id + template_name + template_version`

`performance_sections`

- `id`、`template_id`、`section_code`、`section_name`
- `section_weight`（0~1）、`sort_order`、`version`

`performance_items`

- `id`、`section_id`、`department_id`、`item_code`
- `key_factor`、`standard_text`、`max_score`、`sort_order`、`status`
- 唯一约束：`section_id + item_code`

`performance_item_scopes`

- `item_id`、`scope_type`（`DEPARTMENT`/`ROLE`/`ALL`）
- `scope_value`（部门编码或角色编码）
- 用于表达 Excel D 列“协同部门评价”，不使用 JSON 字段承载权限。

### 2.3 周期与评分

`performance_cycles`

- `id`、`tenant_id`、`period_code`（如 `2026-07`）
- `status`（`DRAFT`/`OPEN`/`CLOSED`）、`opened_at`、`closed_at`、`version`

`performance_evaluations`

- `id`、`cycle_id`、`template_id`、`subject_user_id`、`subject_department_id`
- `status`（`DRAFT`/`IN_PROGRESS`/`SUBMITTED`/`LOCKED`）
- `raw_score`、`normalized_score`、`visible_weight`
- `submitted_by`、`submitted_at`、`signature_hash`、`version`
- 唯一约束：`cycle_id + subject_user_id + template_id`

`performance_scores`

- `id`、`evaluation_id`、`item_id`、`evaluator_user_id`
- `evaluator_department_id`、`score`、`comment`、`signed_at`、`version`
- 约束：`0 <= score <= item.max_score`
- 唯一约束：`evaluation_id + item_id + evaluator_user_id`

旧 Excel 不直接导入评分结果，只导入模板、分区、指标和范围；历史 Excel 原文件作为只读附件留存。

## 3. API 契约

### 3.1 当前用户可见模板

`GET /api/v1/performance/current?cycle=2026-07&mode=subject`

`mode=subject`：只返回当前用户主部门对应模板的全部指标。

`GET /api/v1/performance/current?cycle=2026-07&mode=evaluator`

`mode=evaluator`：只返回当前用户部门、角色命中 `performance_item_scopes` 的指标，以及 `ALL` 指标。

响应核心结构：

```json
{
  "cycle": {"id": 1, "periodCode": "2026-07", "status": "OPEN"},
  "principal": {
    "userId": 7,
    "departmentId": "TEST",
    "departmentName": "测试部",
    "mode": "evaluator"
  },
  "template": {
    "id": 15,
    "departmentId": "TEST",
    "departmentName": "测试部",
    "version": 1,
    "sections": [
      {
        "sectionId": "TEST-CORE",
        "name": "核心指标",
        "sectionWeight": 0.4,
        "items": [
          {
            "itemId": 101,
            "itemCode": "测试部-004",
            "roleScope": ["SUBJECT_DEPARTMENT"],
            "evaluatorScope": ["产品部", "解决方案部"],
            "keyFactor": "项目按时交付",
            "standard": "测试任务按时交付",
            "maxScore": 15,
            "score": null,
            "version": 0
          }
        ]
      }
    ]
  },
  "evaluation": null
}
```

### 3.2 评分写入与提交

- `POST /api/v1/performance/evaluations`：创建或恢复当前用户可见的草稿。
- `PUT /api/v1/performance/evaluations/{id}/scores`：批量保存评分，携带 `expectedVersion`。
- `POST /api/v1/performance/evaluations/{id}/submit`：数字签名确认并锁定提交。
- `GET /api/v1/performance/evaluations/{id}`：再次执行租户、主体部门、评价范围校验。
- `GET /api/v1/performance/evaluations/{id}/audit`：仅授权管理员查看评分来源和变更记录。

版本冲突统一返回 `409`，响应包含 `resourceVersion`、`serverVersion` 和刷新提示；已 `SUBMITTED/LOCKED` 的评分不可覆盖。

## 4. 后端部门隔离规则

1. 从 JWT 用户名查询当前有效用户和主部门；没有主部门时返回 `403 USER_DEPARTMENT_REQUIRED`。
2. 先执行 `tenantScope`，再执行部门过滤，不能只依赖其中一层。
3. `subject` 查询条件：`template.department_id = principal.primary_department_id`。
4. `evaluator` 查询条件：
   - `scope_type=ALL`；或
   - `scope_type=DEPARTMENT` 且 `scope_value=principal.department_id`；或
   - `scope_type=ROLE` 且命中当前用户角色。
5. 响应 DTO 只投影允许的 section/item，不返回未授权指标的名称、标准、分值或评分列。
6. 管理员查看全部数据必须持有专用 `PERM_MANAGE_PERFORMANCE`，不能用前端隐藏实现。

## 5. 动态计分算法

Excel 的 F 列是指标最大分值，所有模板明细合计 100；E 列是分区权重，不能按行重复累加。

### 主体完整评价

```text
sectionScore = sum(item.score) / sum(item.maxScore) * sectionWeight * 100
finalScore   = sum(sectionScore)
```

### 部门协同部分评价（动态折算）

设当前用户可见分区集合为 `V`：

```text
earned = Σ [sum(visible.score) / sum(visible.maxScore) * sectionWeight]
weight = Σ [sectionWeight for section in V]
finalScore = earned / weight * 100
```

这样测试部只评价命中的测试指标时，不会因为看不到生产指标而被错误扣分；同时仍按原分区权重折算为 100 分制。没有可见指标时拒绝提交并返回 `NO_VISIBLE_ITEMS`。

## 6. 迁移与验收顺序

1. V46 创建部门、用户部门历史关系及绩效模板表，先允许 `tenant_id` 为 NULL 兼容历史全局数据。
2. 导入模板时校验每个部门总分=100、分区权重和=1、指标范围合法。
3. 为测试部和生产部建立隔离契约测试：互相不能看到对方未授权指标。
4. 再实现评分服务和版本冲突处理。
5. 最后实现前端动态表单；前端不得写死部门名称或评分项。
