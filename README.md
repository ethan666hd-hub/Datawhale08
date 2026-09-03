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

第六期沿用前几期验证过的 Supabase 后端：

- 行为事件写入 `analytics_events`
- 反馈文字写入 `challenge_feedback`
- 反馈图片写入 `challenge-feedback`
- `challenge_id` 固定为 `ai-tool-guide-2026-09-02`
- `utm_source=codex_*` 的验收流量不进入正式统计

看板每 10 秒读取一次增量数据，支持 PC 与移动端拆分、最近 60 分钟趋势、最近 24 小时趋势、有效曝光、工具点击、停留时长、滚动深度、反馈明细和最近事件。

旧的 `daily_v8_analytics_events` 表保留为上线初期的隔离事件表。当前正式页面改用与前几期相同的共享表，以便站内数据看板实时读取。完整的后端结构见 `supabase/shared_backend.sql`。

## 验收

```bash
node --test tests/analytics.test.mjs
```
