# SLSS MES

SLSS MES 是一个前后端分离的制造执行系统（MES），同时覆盖生产扫码、扫码表、资产生命周期、生产统计、生产维修、售后工单、销售采购、RBAC 权限、租户隔离和运营仪表盘。项目由 React/Vite 前端与 Spring Boot 3 WAR 后端组成，生产环境部署在 Tomcat，业务数据统一写入 MySQL。

本文件按“从零复刻”的方式说明如何取得源码、准备依赖、初始化数据库、构建前端、生成 WAR、部署 Tomcat 以及验收系统。生产环境不得把密码、JWT 密钥、Refresh Token 密钥或云服务密钥提交到 Git。

## 1. 技术栈与目录

| 层次 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、Tailwind CSS、Recharts |
| 后端 | Java 17、Spring Boot 3.3、Spring Security、JPA、JWT |
| 数据库 | MySQL 8.x、Flyway |
| 部署 | Spring Boot WAR、Tomcat 10.1+ |
| 异步任务 | 本地执行器，或 RabbitMQ + Redis |
| 测试 | JUnit、Spring Security Test、Testcontainers MySQL |

主要目录：

```text
.
├── components/                 # 通用前端组件
├── pages/                      # 前端业务页面
├── services/                   # 前端 API 客户端
├── public/                     # 前端静态资源
├── backend/src/main/java/      # Java 后端源码
├── backend/src/main/resources/ # 配置、Flyway 迁移脚本
├── backend/src/test/           # 后端测试
├── backend/DEPLOY_TOMCAT.md    # Tomcat 外置配置说明
└── dist/                       # Vite 构建产物（不手工编辑）
```

## 2. 环境要求

建议使用以下版本：

- Git 2.40+
- Node.js 20 LTS 及 npm
- JDK 17（`java -version`）
- Maven 3.9+（或项目可用的 Maven Wrapper）
- MySQL 8.0+
- Tomcat 10.1+

RabbitMQ、Redis 仅在启用生产导入消息队列执行器时需要；本地开发可使用 `import.executor=local`。运行集成测试还需要 Docker 与可用的 Docker API。

## 3. 从零获取源码

```bash
git clone https://github.com/KingpKate/slss-v2.git
cd slss-v2
```

如果网络环境无法访问 HTTPS，可使用已配置 SSH 的环境：

```bash
git clone git@github.com:KingpKate/slss-v2.git
```

## 4. 初始化 MySQL

创建独立数据库和最小权限账号（密码替换为自己的强密码）：

```sql
CREATE DATABASE slss CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'slss'@'%' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON slss.* TO 'slss'@'%';
FLUSH PRIVILEGES;
```

不要手工建业务表。应用启动时 Flyway 会按顺序执行
`backend/src/main/resources/db/migration/V*.sql`。升级时只新增迁移脚本，禁止修改已经在目标数据库执行过的脚本；正式升级前先备份数据库。

## 5. 后端外置配置

生产配置放到目标 Tomcat 的 `${CATALINA_BASE}/conf/slss/`，不要写入仓库：

```bash
mkdir -p "$CATALINA_BASE/conf/slss"
```

`jdbc.properties`：

```properties
jdbc.driverClassName=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://127.0.0.1:3306/slss?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true
jdbc.username=slss
jdbc.password=replace-with-real-password
jdbc.maximumPoolSize=20
jdbc.minimumIdle=5
jdbc.connectionTimeout=30000
```

`security.properties` 必须使用两组不同的随机密钥，每组至少 32 字节：

```properties
security.jwtSecret=replace-with-a-random-access-token-secret
security.jwtTtl=PT8H
security.refreshSecret=replace-with-a-different-refresh-token-secret
security.refreshTtl=P30D
security.corsAllowedOrigins=http://localhost:5173,https://your-production-host
```

启用 RabbitMQ/Redis 时再创建 `queue.properties`，格式参见
[`backend/DEPLOY_TOMCAT.md`](backend/DEPLOY_TOMCAT.md)。配置文件包含密钥，应限制权限：

```bash
chown -R tomcat:tomcat "$CATALINA_BASE/conf/slss"
chmod 700 "$CATALINA_BASE/conf/slss"
chmod 600 "$CATALINA_BASE/conf/slss"/*.properties
```

## 6. 前端安装与开发

安装本地 npm 依赖：

```bash
npm ci
```

启动 Vite 开发服务器：

```bash
node node_modules/vite/bin/vite.js
```

默认地址为 `http://localhost:5173`。前端通过 `VITE_API_BASE_URL` 指向后端 API；不设置时会根据当前部署上下文访问 `/slss/api/v1`。例如：

```bash
VITE_API_BASE_URL=http://localhost:8080/slss/api/v1 \
  node node_modules/vite/bin/vite.js
```

开发环境跨域时，把开发地址加入 `security.corsAllowedOrigins`，并重启后端。浏览器只保存会话令牌和显示偏好，扫码表、扫码明细、维修记录等业务数据全部来自后端 API。

## 7. 校验、构建与生成 WAR

提交前执行前端类型检查和生产构建：

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

构建后端 WAR（Maven 会把根目录 `dist/` 注入 WAR 的 `static/`，不要手工复制旧静态文件到 `backend/src/main/resources/static`）：

```bash
mvn -q -f backend/pom.xml test
mvn -q -f backend/pom.xml -DskipTests package
```

产物为：

```text
backend/target/slss.war
```

## 8. Tomcat 部署

停止目标 Tomcat 后，将 WAR 复制为 `webapps/slss.war`。若旧版本已展开，先删除旧的 `webapps/slss/` 目录，再放入新 WAR，避免残留静态资源：

```bash
cp backend/target/slss.war "$CATALINA_BASE/webapps/slss.war"
"$CATALINA_HOME/bin/catalina.sh" start
```

访问：

```text
http://SERVER_IP:8080/slss/
```

健康检查：

```bash
curl -i http://SERVER_IP:8080/slss/api/v1/health
```

静态登录页可以公开访问；资产、扫码表、生产统计、维修、用户权限等业务 API 必须经过 JWT/RBAC。生产环境建议使用反向代理和 HTTPS，并将 Tomcat Connector 绑定策略、CORS 来源和防火墙规则纳入部署配置。

## 9. 首次启动与验收清单

1. 检查 Tomcat 日志中没有 Flyway、MySQL、JWT 密钥或 Bean 初始化错误。
2. 调用健康接口确认数据库连接状态。
3. 使用管理员账号登录，确认 Refresh Cookie 为 HttpOnly，并能正常刷新会话。
4. 创建一个扫码模板和扫码表，输入整机及配件 SN，确认刷新页面后数据仍存在。
5. 使用另一账号验证权限、扫码明细和完工状态同步。
6. 验证生产统计、批次明细、维修追溯和 Excel 导出。
7. 在管理员页面验证用户、群组、个人权限和审计日志。
8. 检查浏览器 Network：API 失败时应显示状态码、接口路径及后端错误信息。

## 10. 常见问题

### 页面 404 或资源白屏

确认上下文路径是 `/slss/`、WAR 文件名是 `slss.war`，并检查新 WAR 内确实包含 `static/index.html`。部署新版本前清理旧展开目录和浏览器缓存。

### API 返回 401/403

401 通常表示会话过期或 Refresh Token 已失效；403 表示用户缺少对应权限或租户数据范围不允许访问。确认登录账号、角色/群组权限、CORS 来源和请求是否携带 Cookie。

### Flyway 启动失败

检查 MySQL 地址、账号权限、字符集和已执行迁移版本。不要删除 `flyway_schema_history`，也不要修改历史迁移；修复配置或新增后续迁移后再重启。

### RabbitMQ/Redis 不可用

开发环境将 `import.executor` 设置为 `local`；生产环境检查网络、防火墙、凭据、队列和 Redis 锁配置，确认消息消费者已启动。

## 11. 安全与运维约定

- 不提交 `jdbc.properties`、生产 `security.properties`、真实密码、私钥和 API Key。
- 访问令牌和 Refresh Token 使用不同签名密钥，退出登录和轮换会撤销 Refresh Token。
- 数据库迁移、权限变更、维修替换和批量导入均应保留审计记录。
- 生产发布遵循“构建 → 测试 → 备份数据库 → 替换 WAR → 重启 → 健康检查 → 浏览器验收”的顺序。

更多 Tomcat 外置配置示例请阅读 [`backend/DEPLOY_TOMCAT.md`](backend/DEPLOY_TOMCAT.md)，系统重构记录可参考仓库中的 `REFACTOR_PLAN.md`、`OPTIMIZATION.md` 与 `docs/`。
