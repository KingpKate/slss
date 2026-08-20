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

项目按以下版本进行本机发布验收，生产环境建议锁定同一大版本：

- Git 2.40+
- Node.js 20 LTS 或 22 LTS，npm 10+
- JDK 17+（本机验收使用 JDK 21；`backend/pom.xml` 的最低兼容版本为 17）
- Maven 3.9+
- MySQL 8.0.30+（本机验收为 8.0.46）
- Redis 7.0+（本机验收为 7.0.15；仅 RabbitMQ 执行器需要）
- Tomcat 10.1.x（本机验收为 10.1.55）
- Spring Boot 3.3.2、Flyway 迁移版本 V1–V65（以目标数据库启动日志为准）

Tomcat 10.1 必须使用 Jakarta Servlet 6；不要使用 Tomcat 9 或更早版本。
MySQL、Redis、Tomcat 应部署在受控内网，生产环境通过 HTTPS 反向代理对外提供服务。

### Ubuntu/Debian 安装示例

以下命令适用于 Ubuntu 24.04。若系统已有对应服务，请先确认版本，不要重复安装：

```bash
sudo apt update
sudo apt install -y git curl unzip build-essential mysql-server redis-server \
  openjdk-21-jdk maven tomcat10

mysql --version
redis-server --version
/usr/share/tomcat10/bin/version.sh
java -version
mvn -version
```

启动并设置开机启动：

```bash
sudo systemctl enable --now mysql redis-server tomcat10
sudo systemctl status mysql redis-server tomcat10 --no-pager
redis-cli ping                         # 期望 PONG
```

Redis 默认只监听本机。生产环境如需多实例访问，应显式配置监听地址、密码、ACL、
防火墙和持久化策略，禁止直接暴露未鉴权的 6379 端口。

RabbitMQ、Redis 仅在启用生产导入消息队列执行器时需要；本地开发可使用 `import.executor=local`。生产验收使用本机 MySQL；Testcontainers 集成测试属于可选门禁，未安装 Docker 时会明确跳过，不影响本机数据库验收。

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

验证数据库账号和字符集：

```bash
mysql -u slss -p -e "SELECT VERSION(), @@character_set_database, @@collation_database;" slss
```

生产备份示例：

```bash
mysqldump --single-transaction --routines --events \
  -u slss -p slss > slss-$(date +%F-%H%M%S).sql
```

离线环境可按版本顺序导入 SQL：

```bash
for f in $(find backend/src/main/resources/db/migration -maxdepth 1 -name 'V*.sql' | sort -V); do
  mysql --default-character-set=utf8mb4 -u slss -p slss < "$f"
done
```

离线导入前必须使用全新数据库或经过备份和人工确认的目标库，不能重复导入已经由
Flyway 执行过的脚本。正式运行建议仍由 Flyway 管理迁移版本记录。

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

默认开发地址为 `http://localhost:3000`。前端通过 `VITE_API_BASE_URL` 指向后端 API；不设置时会根据当前部署上下文访问 `/slss/api/v1`。例如：

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
curl -i http://SERVER_IP:8080/slss/actuator/health
```

期望结果：

```json
{"status":"UP"}
```

使用 systemd 安装的 Tomcat 时，默认目录通常为 `/var/lib/tomcat10`；外置配置目录为：

```text
/var/lib/tomcat10/conf/slss/
/var/lib/tomcat10/webapps/slss.war
```

推荐的完整发布顺序：

```bash
npm ci
npm run build
mvn -q -f backend/pom.xml test
mvn -q -f backend/pom.xml -DskipTests package

sudo rm -rf /var/lib/tomcat10/webapps/slss
sudo install -o tomcat -g tomcat -m 640 \
  backend/target/slss.war /var/lib/tomcat10/webapps/slss.war
sudo systemctl restart tomcat10

curl -fsS http://127.0.0.1:8080/slss/actuator/health
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

## 12. 当前生产发布包与数据库导出（2026-08-20）

本机最后一次构建已通过前端类型检查、Vite 生产构建和 Maven WAR 打包。当前可发布
WAR 的绝对路径为：

```text
/opt/backup/backend/target/slss.war
```

部署到本机 Tomcat 10 的标准命令如下（生产机请将路径替换为目标机的
`CATALINA_BASE`）：

```bash
sudo systemctl stop tomcat10
sudo rm -rf /var/lib/tomcat10/webapps/slss
sudo install -o tomcat -g tomcat -m 640 \
  /opt/backup/backend/target/slss.war \
  /var/lib/tomcat10/webapps/slss.war
sudo systemctl start tomcat10
curl -fsS http://127.0.0.1:8080/slss/actuator/health
```

期望返回 `{"status":"UP"}`。生产环境应在反向代理后使用 HTTPS，不能将 Tomcat
8080 管理端口直接暴露到公网；旧的 18080 运行入口已经废弃，不属于支持范围。

### 当前数据库导出文件

已从本机 MySQL 8.0.46 的 `slss_local` 数据库导出完整逻辑备份（表结构、业务数据、
触发器、事件和存储过程），文件路径为：

```text
/opt/backup/deploy/sql/slss_local_20260820.sql
```

导出使用 `--single-transaction --routines --events --triggers --no-tablespaces`，
不会要求生产账号拥有 PROCESS 权限。该文件包含当前环境业务数据，属于敏感生产资产，
不得提交到公开仓库或通过不受控渠道传输；传输和存储时应使用加密磁盘或加密压缩包。

在生产环境导入前，先创建独立数据库和账号，并确认目标数据库为空或已经完成备份：

```sql
CREATE DATABASE slss_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'slss_user'@'127.0.0.1' IDENTIFIED BY '替换为生产强密码';
GRANT ALL PRIVILEGES ON slss_local.* TO 'slss_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

导入命令：

```bash
mysql --default-character-set=utf8mb4 \
  -h127.0.0.1 -u slss_user -p slss_local \
  < /opt/backup/deploy/sql/slss_local_20260820.sql
```

导入后必须校验：

```bash
mysql -h127.0.0.1 -u slss_user -p slss_local \
  -e "SELECT VERSION(); SELECT COUNT(*) FROM flyway_schema_history;"
```

应用启动时 Flyway 会继续校验并执行后续迁移；不要删除或修改已经执行过的
`V*.sql`。当前本机数据库 Flyway 版本为 V65，生产导入后如果代码包含更高版本迁移，
应以应用启动日志中的最终版本为准。

### 发布前后验收顺序

1. 备份生产数据库，并在临时数据库执行一次恢复演练。
2. 校验 Tomcat 外置 `jdbc.properties`、`security.properties` 和 `queue.properties`，确认密钥不在 WAR、Git 或前端构建产物中。
3. 替换 WAR，清理旧的展开目录，重启 Tomcat。
4. 检查 `/slss/actuator/health`、Tomcat 日志、Flyway 校验结果和 MySQL 连接池。
5. 管理员登录，验证用户权限、租户、扫码模板、流程单、生产查询、维修和导出。
6. 使用普通账号验证权限边界、数据隔离和多人扫码同步。
7. 验证浏览器强制刷新后静态资源来自本次 WAR，避免缓存旧 JS。
8. 验收通过后再将反向代理流量切换到新实例，并保留旧 WAR 作为可回滚副本。
