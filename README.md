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
- 反馈正文和图片地址写入私有表 `daily_v8_analytics_events`
- 反馈图片文件写入 `challenge-feedback`
- `challenge_id` 固定为 `ai-tool-guide-2026-09-02`
- `utm_source=codex_*` 的验收流量不进入正式统计

看板每 10 秒读取一次增量数据，支持 PC 与移动端拆分、最近 60 分钟趋势、最近 24 小时趋势、有效曝光、工具点击、停留时长、滚动深度、反馈聚合和最近事件。

公开看板只读取 `analytics_events` 中的轻量行为事件，不读取或展示反馈正文、图片地址和匿名访客标识。`daily_v8_analytics_events` 只允许匿名写入，第六期的私有表定义见 `supabase/analytics_events.sql`。

## 验收

```bash
node --test tests/analytics.test.mjs
```
