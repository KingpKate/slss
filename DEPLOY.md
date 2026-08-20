# SLSS MES 部署说明

本项目是 Spring Boot WAR 应用，前端资源由 Vite 构建并随 WAR 发布，不依赖 Node
运行时或外部前端 CDN。

## 1. 构建

```bash
node node_modules/vite/bin/vite.js build
mvn -f backend/pom.xml -DskipTests package
```

构建产物为 `backend/target/slss.war`。前端 `dist` 会自动打入 WAR，旧的
`backend/src/main/resources/static` 目录应保持为空。

## 2. Tomcat 配置

创建目录：

```bash
mkdir -p "$CATALINA_BASE/conf/slss"
```

配置 `jdbc.properties`：

```properties
jdbc.driverClassName=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://127.0.0.1:3306/slss?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true
jdbc.username=slss
jdbc.password=replace-with-real-password
jdbc.maximumPoolSize=20
jdbc.minimumIdle=5
jdbc.connectionTimeout=30000
```

配置 `security.properties`：

```properties
security.jwtSecret=replace-with-random-secret-at-least-32-bytes
security.refreshSecret=replace-with-a-different-random-secret-at-least-32-bytes
security.reportDownloadSecret=replace-with-a-third-random-secret-at-least-32-bytes
security.jwtTtl=PT8H
security.refreshTtl=P30D
security.corsAllowedOrigins=https://your-slss-domain.example
```

如使用 RabbitMQ/Redis，增加 `queue.properties`，格式参见
[`backend/DEPLOY_TOMCAT.md`](backend/DEPLOY_TOMCAT.md)。

## 3. 发布

本项目唯一支持的运行入口为宿主机 Tomcat `8080`。旧的 Docker/E2E `18080`
入口已废弃、停止并不再维护；不要将 WAR 发布到 18080，也不要将其作为验收地址。

```bash
cp backend/target/slss.war "$CATALINA_BASE/webapps/slss.war"
systemctl restart tomcat
curl -fsS http://127.0.0.1:8080/slss/api/v1/health
```

Tomcat 应用地址为 `http://SERVER_IP:8080/slss/`。生产环境请使用反向代理和
HTTPS，并限制管理端口访问范围。

## 4. 数据库与 Flyway

首次启动会校验 MySQL 连接并自动执行 Flyway 迁移。升级前备份数据库；禁止删除
或修改已执行的迁移脚本。迁移失败时应用不应继续提供业务服务，应先修复数据库
或配置后再重启。

## 5. 备份恢复演练

上线前至少执行一次逻辑备份和临时库恢复验证：

```bash
mysqldump --single-transaction --routines --events -u slss -p slss > slss-backup.sql
mysql -u slss_restore -p slss_restore < slss-backup.sql
mysql -u slss_restore -p slss_restore -e "SELECT COUNT(*) FROM flyway_schema_history;"
```

恢复库必须使用独立账号和库名，不得直接覆盖生产库。确认 Flyway 版本、关键用户、租户、扫码表和工单数量后，才允许执行切换。

性能基线脚本只检查本机健康接口，不写入业务数据：

```bash
node scripts/performance-baseline.mjs
```

## 6. AI 网关

AI 配置在系统管理页面保存到后端 `system_settings` 表。浏览器只调用
`/api/v1/ai/analyze` 和 `/api/v1/ai/test`，不会获取供应商 API Key。生产环境不要
在前端 `.env` 或构建参数中设置 API Key。
