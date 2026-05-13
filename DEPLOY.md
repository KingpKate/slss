# SLSS V2.0 部署指南

> Server Lifecycle System V2.0 — 服务器全生命周期系统

## 1. 环境要求

| 组件 | 版本要求 |
|------|----------|
| Node.js | v18+ |
| MySQL | 8.0+ |
| npm | 9+ |

## 2. 快速启动 (开发环境)

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填写数据库配置

# 初始化数据库
node db/init.js

# 启动开发服务器 (前端 + 后端热重载)
npm run dev
```

访问 `http://localhost:5173` (Vite dev server) 或 `http://localhost:3000` (Express).

## 3. 生产环境部署

### A. 环境变量配置

```bash
cp .env.example .env
nano .env
```

关键配置项:

```env
# 数据库
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=slss_user
DB_PASSWORD=your_strong_password
DB_NAME=slss_db

# JWT 认证 (可选, 设置后启用 API Token 保护)
JWT_SECRET=your_random_secret_key_at_least_32_chars
JWT_EXPIRES_IN=24h

# 服务端口
PORT=3000

# 质量锁定阈值 (默认 3%)
DEFECT_RATE_LOCK_THRESHOLD=3

# 库龄预警天数 (默认 5)
INVENTORY_AGING_DAYS=5
```

**注意:** `JWT_SECRET` 未设置时, JWT 认证自动禁用 (所有 API 无需 Token). 生产环境建议启用.

### B. 构建与启动

```bash
# 安装依赖
npm install

# 构建前端 + 后端
npm run build

# 初始化数据库 (首次)
node db/init.js

# 使用 PM2 启动
pm2 start dist/server.js --name "slss-v2"
pm2 save
pm2 startup
```

### C. 访问

- 前端: `http://your_server_ip:3000`
- API: `http://your_server_ip:3000/api/`
- 健康检查: `http://your_server_ip:3000/api/health`

## 4. 定时任务

系统启动后自动运行以下定时任务:

| 任务 | 间隔 | 说明 |
|------|------|------|
| 库龄预警 | 1 小时 | 检查到货超过 5 天未领料的物料 |
| 快递同步 | 6 小时 | 同步采购单快递状态 |
| 逾期监控 | 24 小时 | 检查并标记逾期未付款结算 |

## 5. E2E 测试

```bash
# 安装 Playwright 浏览器
npx playwright install chromium

# 运行全部测试
npx playwright test

# 运行指定测试文件
npx playwright test tests/e2e/quality-batch-lock.spec.ts

# 查看测试报告
npx playwright show-report
```

## 6. V2.0 核心模块

### 财务模块 (Finance)
- 报价单管理: BOM 报价 → 产品评审 → 采购定价 → 利润审批 → 立项
- 采购订单: 快递跟踪 → 到货确认 → 开箱检验 → 数量差异冻结
- 财务结算: 销售确认 → 回款审核 → 逾期监控
- 质量锁定: 次品率超标自动冻结结算付款

### 生产模块 (Production)
- 扫码模板: 动态 BOM 组件配置
- 扫码录入: SN 唯一性校验 + SOP 强制检查点
- 维修换件: JSON 解包 → FMEA 故障分类 → SN 替换
- 质量画像: 次品率热力图 + 批次锁定

### 消息路由 (Message Router)
- 支持: 企业微信 / 钉钉 / 飞书 / 邮件
- 10 种事件类型, 可配置路由规则
- 定时任务自动触发通知

## 7. 架构文档

详见 `docs/architecture.md`, 包含 7 个 Mermaid 架构图:
1. 总体系统架构
2. 财务报价到回款流
3. 生产装配与维修流
4. 供应链风控流
5. 质量追溯与熔断流
6. 物流交付协同流
7. 消息路由分发架构

## 8. 常见问题

**Q: JWT 启用后前端 401?**
A: 确保前端登录后将 `token` 存入 localStorage, 请求时携带 `Authorization: Bearer <token>` header.

**Q: 定时任务没有触发通知?**
A: 检查 `message_route_rules` 表中对应事件的 `is_active` 是否为 1, 以及通知渠道 (WeCom/Email) 是否配置.

**Q: 次品率热力图显示 0?**
A: 确保 `prod_batch_installed` 表有数据 (批次安装记录), 否则分母为 0.
