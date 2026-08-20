# SLSS Tomcat deployment

## Persistent configuration layout

Do not unpack or edit the WAR. Create persistent configuration below the target
Tomcat instance:

```text
${CATALINA_BASE}/
├── conf/
│   └── slss/
│       ├── jdbc.properties
│       ├── security.properties
│       └── queue.properties
└── webapps/
    └── slss.war
```

The external files override the defaults packaged in `WEB-INF/classes` and are
preserved when `slss.war` is upgraded.

The WAR also contains the production frontend. Deploy it as `slss.war` and open
`http://SERVER_IP:8080/slss/`. Static SPA resources and login are public; business
APIs remain protected by JWT/RBAC. This project is validated against a host
Tomcat instance; the retired Docker/18080 entrypoint is not supported.

## jdbc.properties

```properties
jdbc.driverClassName=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://192.168.66.60:3306/slss?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true
jdbc.username=slss
jdbc.password=replace-with-real-password
jdbc.maximumPoolSize=20
jdbc.minimumIdle=5
jdbc.connectionTimeout=30000
```

## security.properties

```properties
security.jwtSecret=replace-with-a-random-secret-of-at-least-32-bytes
security.jwtTtl=PT8H
security.refreshSecret=replace-with-a-different-random-secret-of-at-least-32-bytes
security.refreshTtl=P30D
security.corsAllowedOrigins=https://slss.example.com
```

## queue.properties

```properties
import.executor=rabbit
import.queue=slss.production.import
rabbit.host=192.168.66.61
rabbit.port=5672
rabbit.username=slss
rabbit.password=replace-with-real-password
redis.host=192.168.66.62
redis.port=6379
redis.password=replace-with-real-password
```

`rabbit` 模式使用持久化 RabbitMQ 队列，Redis 锁防止多 Tomcat 实例重复消费同一导入任务；开发环境可设为 `local`。

Restrict access because both files contain secrets:

```bash
chown -R tomcat:tomcat ${CATALINA_BASE}/conf/slss
chmod 700 ${CATALINA_BASE}/conf/slss
chmod 600 ${CATALINA_BASE}/conf/slss/*.properties
```

After changing configuration, restart the Tomcat instance. The configuration is
persistent; no shell environment variables are required.
