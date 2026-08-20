# SLSS 前端重构架构基线

## 目标

统一登录、工作台、生产 MES、售后、销售采购、Portal、系统管理和 AI 网关的页面结构与交互语义；保留现有路由、权限编码和 API 契约，不引入数字孪生或大屏专用能力。

## 目录边界

```text
components/app-shell/       应用壳层、导航模型
components/design-system/   Token 驱动的通用组件
components/admin/           管理域组件
components/monitoring/      实时监控组件（普通页面形态）
pages/                      页面编排，不定义全局颜色
services/                   API、会话和数据转换
styles.css                  全局 Token 与兼容层
```

## 迁移规则

1. 页面只能组合 AppShell 和 design-system 组件。
2. 颜色、边框、圆角、阴影、间距使用 `--slss-*` 或 `--ds-*` Token。
3. 业务状态色只能使用 `success/warning/danger/info/neutral` 语义 Token。
4. 表格允许自己的横向滚动，页面和浏览器不产生双滚动条。
5. 旧 `components/ui.tsx` 作为兼容层，新增页面优先使用 `components/design-system/primitives.tsx`。
6. 每次页面迁移必须保留权限校验、API 路径、错误提示和空状态。
