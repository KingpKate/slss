# SLSS V2.0 部署文档

完整部署、运维、备份、Nginx、PM2、systemd 和故障排查文档见：

- [docs/DEPLOYMENT.md](/soft/SLSS/V2.0/docs/DEPLOYMENT.md)

## 最短部署流程

```bash
npm ci
cp .env.example .env
# 编辑 .env，填写 MySQL 连接信息
node db/init.js
npm run build
npm run serve
```

默认访问地址：

- 本地开发前端：`http://localhost:5173`
- 生产一体服务：`http://localhost:3001`
- 健康检查：`http://localhost:3001/api/health`

默认管理员账号由 `node db/init.js` 创建：

- 用户名：`stars`
- 密码：`Gyh@20210625`

首次上线后请立即修改默认密码，并在生产环境设置强随机 `JWT_SECRET`。
