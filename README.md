# Datawhale08

Datawhale 每日一试第六期：AI 工具选用推荐指南

- 首页：`index.html`
- 实践页：`practice.html`
- 数据看板：`platform-demo/index.html`

## 线上地址

- 网站：<https://ethan666hd-hub.github.io/Datawhale08/>
- 实践页：<https://ethan666hd-hub.github.io/Datawhale08/practice.html>
- 数据看板：<https://ethan666hd-hub.github.io/Datawhale08/platform-demo/>

## 数据闭环

第六期使用独立的 Supabase 数据边界：

- 行为事件与反馈记录写入私有表 `daily_v8_analytics_events`
- 反馈图片文件写入私有桶 `daily-v8-feedback`
- 公开看板只调用脱敏聚合函数 `daily_v8_public_events`
- `challenge_id` 固定为 `ai-tool-guide-2026-09-02`
- `utm_source=codex_*` 的验收流量不进入正式统计

看板每 10 秒读取一次增量数据，支持 PC 与移动端拆分、最近 60 分钟趋势、最近 24 小时趋势、有效曝光、工具点击、停留时长、滚动深度、反馈聚合和最近事件。

公开接口不具备原始表的读取权限。数据库函数会排除反馈正文记录和验收流量，并用不可逆会话摘要替换原始会话 ID；反馈正文、图片路径和持久访客标识不会返回公开网页。完整且可重复执行的后端部署脚本见 `supabase/analytics_events.sql`。

## 验收

```bash
node --test tests/analytics.test.mjs
```
