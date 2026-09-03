# 第六期部署说明

第六期正式路径为 `/daily-v8/`。部署使用独立目录、发布版本、容器、端口和 Nginx 配置，不覆盖或重启前五期项目。

- 应用目录：`/opt/datawhale08-daily-v8`
- 容器：`datawhale08-daily-v8`
- 本机端口：`127.0.0.1:18097`
- Nginx 配置：`/etc/nginx/conf.d/demo.datawhale.cn/10-daily-v8.conf`
- 正式默认入口：`https://demo.datawhale.cn/daily-v8/`（跳转到实践页）
- 正式介绍页：`https://demo.datawhale.cn/daily-v8/index.html`

发布目录只包含网页静态文件和 `deploy/server.mjs`。`current` 软链接指向当前 release，便于后续更新和回退。

上线前先执行 `supabase/analytics_events.sql`，确保正式路径 `/daily-v8/` 被第六期专用写入策略允许。验收时使用 `utm_source=codex_release_test`，避免内部测试进入公开数据看板。

上线后检查首页、实践页、数据看板、静态资源、PC/移动端布局和 Supabase 连接状态，并回访 `/daily-v2/`、`/daily-v4/`、`/daily-v5/`、`/daily-v6/`、`/daily-v7/`。
