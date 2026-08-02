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

## 5. AI 网关

AI 配置在系统管理页面保存到后端 `system_settings` 表。浏览器只调用
`/api/v1/ai/analyze` 和 `/api/v1/ai/test`，不会获取供应商 API Key。生产环境不要
在前端 `.env` 或构建参数中设置 API Key。
