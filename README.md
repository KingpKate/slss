# SLSS MES

SLSS 是基于 React/Vite 前端与 Spring Boot 3 + JPA + MySQL + Flyway 后端的制造执行与服务器全生命周期系统。

## 技术架构

- 前端：React 18、TypeScript、Vite、Tailwind CSS、Recharts
- 后端：Java 17、Spring Boot 3.3、Spring Security、JWT、Tomcat WAR
- 数据库：MySQL 8，Flyway 负责版本迁移
- 异步任务：本地执行器或 RabbitMQ + Redis
- AI：由 Java AI 网关代理，浏览器不保存或接触供应商密钥

## 本地开发

```bash
npm install
node node_modules/vite/bin/vite.js
```

前端默认访问 `http://localhost:5173`。后端配置请参考
[`backend/DEPLOY_TOMCAT.md`](backend/DEPLOY_TOMCAT.md)。

## 构建

```bash
node node_modules/vite/bin/vite.js build
mvn -f backend/pom.xml -DskipTests package
```

Maven 会把根目录 `dist` 注入 WAR 的 `static` 目录。不要手工把旧构建文件放入
`backend/src/main/resources/static`。

## 部署

将 `backend/target/slss.war` 部署到 Tomcat 的 `webapps/slss.war`，并在
`$CATALINA_BASE/conf/slss/` 配置数据库、JWT、刷新令牌和队列参数。完整示例见
[`backend/DEPLOY_TOMCAT.md`](backend/DEPLOY_TOMCAT.md)。

## 数据库迁移

应用启动时由 Flyway 自动执行 `backend/src/main/resources/db/migration` 下的
增量脚本。生产环境请先备份 MySQL，再升级 WAR；不要手工修改已执行的迁移。

## 生产说明

- 所有业务数据写入后端 MySQL，浏览器只保存会话和非业务显示偏好。
- 业务 API 统一使用 JWT/RBAC；未授权请求返回结构化错误。
- AI 配置和供应商密钥只保存在后端系统设置中。
