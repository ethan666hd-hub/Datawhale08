const SUPABASE_PROJECT_URL = "https://fjsdilkacsaarxnqrdmm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LKFWLPhFegq-KScuSQzfXw_2rYSuTfn";
const ANALYTICS_RPC_URL = `${SUPABASE_PROJECT_URL}/rest/v1/rpc/daily_v8_public_events`;
const CHALLENGE_ID = "ai-tool-guide-2026-09-02";
const ANALYTICS_START_AT = "2026-09-02T00:00:00+08:00";
const REFRESH_INTERVAL_MS = 10000;
const PAGE_SIZE = 1000;

const state = {
  events: new Map(),
  latestEventAt: "",
  mode: "minute",
  loading: false,
  initialized: false,
};

const eventLabels = {
  home_view: "首页访问",
  challenge_view: "实践页访问",
  home_section_view: "首页模块曝光",
  challenge_section_view: "实践模块曝光",
  challenge_click: "打开工具清单",
  challenge_intro_click: "返回内容介绍",
  scene_nav_click: "场景导航点击",
  tool_open: "打开工具",
  favorite_click: "收藏",
  feedback_select: "选择反馈状态",
  feedback_image_select: "选择反馈图片",
  feedback_image_remove: "移除反馈图片",
  feedback_submit_attempt: "尝试发送反馈",
  feedback_submit: "反馈发送成功",
  feedback_submit_failed: "反馈发送失败",
  page_engagement: "页面停留",
  return_visit: "回访",
};

const placementLabels = {
  home: "首页",
  hero: "首页首屏",
  assistants: "通用助手",
  office: "办公与文档",
  research: "搜索与研究",
  visual: "图片、视频与设计",
  build: "工作台、Agent 与编程",
  principles: "工具选择的心法",
  final_cta: "首页底部入口",
  tool_guide: "AI 工具推荐表",
  feedback_section: "反馈区",
  feedback_detail_form: "反馈填写区",
};

const feedbackLabels = {
  smooth: "顺利完成",
  recovered: "卡过，但找到了",
  unfinished: "还没找到",
};

function getHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

async function fetchEvents(since = "") {
  const rows = [];
  let offset = 0;

  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(ANALYTICS_RPC_URL, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        p_since: since || ANALYTICS_START_AT,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      }),
    });
    if (!response.ok) throw new Error(`daily_v8_public_events_${response.status}`);

    const pageRows = await response.json();
    if (!Array.isArray(pageRows)) throw new Error("daily_v8_public_events_invalid_response");
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function getSessionKey(item) {
  return item.session_id || item.event_id || "unknown";
}

function officialItems(items) {
  return items.filter((item) => !String(item.utm_source || "").startsWith("codex_"));
}

function countUnique(items, predicate = () => true) {
  return new Set(items.filter(predicate).map(getSessionKey)).size;
}

function toPercent(value, base) {
  if (!base) return 0;
  return Math.round((value / base) * 100);
}

function formatCount(value) {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

function formatPercent(value) {
  return `${Number.isFinite(value) ? value : 0}%`;
}

function formatDateTime(value, includeDate = true) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    ...(includeDate ? { month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function formatDuration(milliseconds) {
  const seconds = Math.round((milliseconds || 0) / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function replaceChildren(container, children) {
  if (!container) return;
  container.replaceChildren(...children);
}

function getEvents() {
  return officialItems(Array.from(state.events.values())).sort(
    (left, right) => new Date(left.occurred_at) - new Date(right.occurred_at),
  );
}

function getFeedbackEvents(events) {
  return events.filter((event) => (
    event.event_name === "feedback_submit" && event.result === "success"
  ));
}

function getLatestBySession(events) {
  const latest = new Map();
  events.forEach((event) => latest.set(getSessionKey(event), event));
  return Array.from(latest.values());
}

function getSessionEntryEvents(events) {
  const entries = new Map();
  events.filter((event) => ["home_view", "challenge_view"].includes(event.event_name))
    .forEach((event) => {
      const key = getSessionKey(event);
      if (!entries.has(key)) entries.set(key, event);
    });
  return entries;
}

function getSourceLabel(event) {
  if (event.utm_source) return event.utm_source;
  if (!event.referrer_host || event.referrer_host === "direct") return "直接访问";
  if (["internal", "ethan666hd-hub.github.io"].includes(event.referrer_host)) return "站内跳转";
  return event.referrer_host;
}

function getOverview(events) {
  const pageViews = events.filter((event) => ["home_view", "challenge_view"].includes(event.event_name));
  const feedbackEvents = getFeedbackEvents(events);
  const homeSessions = countUnique(events, (event) => event.event_name === "home_view");
  const sessions = countUnique(pageViews);
  const practiceSessions = countUnique(events, (event) => event.event_name === "challenge_view");
  const toolEvents = events.filter((event) => event.event_name === "tool_open");
  const toolUsers = countUnique(toolEvents);
  const feedbackSessions = countUnique(feedbackEvents);

  return {
    homeSessions,
    sessions,
    practiceSessions,
    practiceRate: toPercent(practiceSessions, sessions),
    toolClicks: toolEvents.length,
    toolUsers,
    feedbackCount: feedbackSessions,
    feedbackRate: toPercent(feedbackSessions, practiceSessions),
  };
}

function renderOverview(overview) {
  Object.entries(overview).forEach(([key, value]) => {
    const element = document.querySelector(`[data-metric="${key}"]`);
    if (element) element.textContent = formatCount(value);
  });
  setText("[data-metric-note='practiceRate']", `占站点会话 ${formatPercent(overview.practiceRate)}`);
  setText("[data-metric-note='toolUsers']", `${formatCount(overview.toolUsers)} 个点击会话`);
  setText("[data-metric-note='feedbackRate']", `实践反馈率 ${formatPercent(overview.feedbackRate)}`);
}

function renderDevices(events) {
  const container = document.querySelector("#device-summary");
  const pageViewNames = new Set(["home_view", "challenge_view"]);
  const entryEvents = getSessionEntryEvents(events);
  const sessionDevices = new Map(
    Array.from(entryEvents, ([key, event]) => [key, event.device_type]),
  );
  const totalEntries = countUnique(events, (event) => pageViewNames.has(event.event_name));
  const definitions = [
    { key: "desktop", label: "PC 端", matches: (value) => value === "desktop" },
    { key: "mobile", label: "移动端", matches: (value) => ["mobile", "tablet"].includes(value) },
  ];

  const columns = definitions.map((definition) => {
    const deviceEvents = events.filter((event) => definition.matches(
      sessionDevices.get(getSessionKey(event)) || event.device_type,
    ));
    const entries = countUnique(deviceEvents, (event) => pageViewNames.has(event.event_name));
    const practice = countUnique(deviceEvents, (event) => event.event_name === "challenge_view");
    const guide = countUnique(deviceEvents, (event) =>
      event.event_name === "challenge_section_view" && event.placement === "tool_guide");
    const feedbackExposure = countUnique(deviceEvents, (event) =>
      event.event_name === "challenge_section_view" && event.placement === "feedback_section");
    const toolClicks = countUnique(deviceEvents, (event) => event.event_name === "tool_open");
    const feedbackCount = countUnique(deviceEvents, (event) => (
      event.event_name === "feedback_submit" && event.result === "success"
    ));
    const article = createElement("article", "device-column");
    const header = createElement("header");
    const title = createElement("h3", "", definition.label);
    const share = createElement("strong", "device-share", formatPercent(toPercent(entries, totalEntries)));
    header.append(title, share);

    const list = createElement("dl");
    [
      ["站点会话", entries],
      ["实践页到达", practice],
      ["推荐表曝光", guide],
      ["工具点击会话", toolClicks],
      ["反馈区曝光", feedbackExposure],
      ["完整反馈", feedbackCount],
    ].forEach(([label, value]) => {
      const row = createElement("div");
      row.append(createElement("dt", "", label), createElement("dd", "", formatCount(value)));
      list.append(row);
    });
    article.append(header, list);
    return article;
  });

  replaceChildren(container, columns);
}

function getFunnel(events) {
  const definitions = [
    { label: "站点会话", matches: (event) => ["home_view", "challenge_view"].includes(event.event_name) },
    { label: "实践页到达", matches: (event) => event.event_name === "challenge_view" },
    { label: "推荐表曝光", matches: (event) => event.event_name === "challenge_section_view" && event.placement === "tool_guide" },
    { label: "反馈区曝光", matches: (event) => event.event_name === "challenge_section_view" && event.placement === "feedback_section" },
    { label: "选择反馈状态", matches: (event) => event.event_name === "feedback_select" },
    { label: "完整反馈", matches: (event) => event.event_name === "feedback_submit" && event.result === "success" },
  ];
  const sessions = new Map();
  events.forEach((event) => {
    const key = getSessionKey(event);
    const sessionEvents = sessions.get(key) || [];
    sessionEvents.push(event);
    sessions.set(key, sessionEvents);
  });
  const counts = Array(definitions.length).fill(0);

  sessions.forEach((sessionEvents) => {
    let cursor = 0;
    for (let index = 0; index < definitions.length; index += 1) {
      const matchIndex = sessionEvents.findIndex((event, eventIndex) => (
        eventIndex >= cursor && definitions[index].matches(event)
      ));
      if (matchIndex === -1) break;
      counts[index] += 1;
      cursor = matchIndex;
    }
  });

  return definitions.map((definition, index) => ({
    label: definition.label,
    value: counts[index],
  }));
}

function renderFunnel(events) {
  const steps = getFunnel(events);
  const children = steps.map((step, index) => {
    const article = createElement("article", "funnel-step");
    article.append(
      createElement("span", "", step.label),
      createElement("strong", "", formatCount(step.value)),
      createElement(
        "small",
        "",
        index === 0 ? "独立会话" : `较上一步 ${formatPercent(toPercent(step.value, steps[index - 1].value))}`,
      ),
    );
    return article;
  });
  replaceChildren(document.querySelector("#funnel-flow"), children);
}

function buildRanking(items, getKey, getSession = getSessionKey) {
  const groups = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    const group = groups.get(key) || { count: 0, sessions: new Set() };
    group.count += 1;
    group.sessions.add(getSession(item));
    groups.set(key, group);
  });
  return Array.from(groups, ([key, group]) => ({
    key,
    count: group.count,
    sessions: group.sessions.size,
  })).sort((left, right) => right.sessions - left.sessions || right.count - left.count);
}

function renderRanking(containerSelector, ranking, labelForKey, emptyText) {
  const container = document.querySelector(containerSelector);
  if (!ranking.length) {
    replaceChildren(container, [createElement("p", "empty-state", emptyText)]);
    return;
  }

  const rows = ranking.slice(0, 8).map((item) => {
    const row = createElement("div", "rank-row");
    const copy = createElement("div", "rank-copy");
    copy.append(
      createElement("strong", "", labelForKey(item.key)),
      createElement("small", "", `${formatCount(item.count)} 次动作`),
    );
    row.append(copy, createElement("span", "rank-value", formatCount(item.sessions)));
    return row;
  });
  replaceChildren(container, rows);
}

function renderRankings(events) {
  const toolEvents = events.filter((event) => event.event_name === "tool_open");
  const toolRanking = buildRanking(toolEvents, (event) => event.properties?.tool || event.tool || "未知工具");
  renderRanking("#tool-ranking", toolRanking, (key) => key, "等待用户点击工具后显示排行。");

  const exposureEvents = events.filter((event) =>
    ["home_section_view", "challenge_section_view"].includes(event.event_name));
  const exposureRanking = buildRanking(exposureEvents, (event) => event.placement || "unknown");
  renderRanking(
    "#exposure-ranking",
    exposureRanking,
    (key) => placementLabels[key] || key,
    "等待页面产生有效曝光后显示排行。",
  );

  const viewEvents = Array.from(getSessionEntryEvents(events).values());
  const sourceRanking = buildRanking(
    viewEvents,
    getSourceLabel,
  );
  renderRanking("#source-ranking", sourceRanking, (key) => key, "等待真实访问后显示来源。");
}

function getEngagement(events) {
  const latestByPageSession = new Map();
  events.filter((event) => event.event_name === "page_engagement").forEach((event) => {
    const key = `${getSessionKey(event)}:${event.page_path}`;
    const properties = event.properties || {};
    const duration = Number(properties.active_duration_ms || event.active_duration_ms || 0);
    const scroll = Number(properties.max_scroll_percent || event.max_scroll_percent || 0);
    const current = latestByPageSession.get(key) || { duration: 0, scroll: 0, session: getSessionKey(event) };
    current.duration = Math.max(current.duration, duration);
    current.scroll = Math.max(current.scroll, scroll);
    latestByPageSession.set(key, current);
  });

  const bySession = new Map();
  latestByPageSession.forEach((record) => {
    const current = bySession.get(record.session) || { duration: 0, scroll: 0 };
    current.duration += record.duration;
    current.scroll = Math.max(current.scroll, record.scroll);
    bySession.set(record.session, current);
  });
  const records = Array.from(bySession.values());
  const averageDuration = records.length
    ? records.reduce((sum, record) => sum + record.duration, 0) / records.length
    : 0;
  const averageScroll = records.length
    ? Math.round(records.reduce((sum, record) => sum + record.scroll, 0) / records.length)
    : 0;
  const favoriteStates = new Map();
  events.filter((event) => event.event_name === "favorite_click").forEach((event) => {
    const selected = event.properties?.selected;
    favoriteStates.set(getSessionKey(event), selected !== false);
  });

  return {
    averageDuration,
    averageScroll,
    favorites: Array.from(favoriteStates.values()).filter(Boolean).length,
    returns: countUnique(events, (event) => event.event_name === "return_visit"),
  };
}

function renderEngagement(events) {
  const engagement = getEngagement(events);
  setText("[data-engagement='duration']", formatDuration(engagement.averageDuration));
  setText("[data-engagement='scroll']", formatPercent(engagement.averageScroll));
  setText("[data-engagement='favorites']", formatCount(engagement.favorites));
  setText("[data-engagement='returns']", formatCount(engagement.returns));
}

function renderFeedbackSummary(events) {
  const container = document.querySelector("#feedback-summary");
  const feedbackEvents = getLatestBySession(getFeedbackEvents(events));
  const feedbackSessions = feedbackEvents.length;
  setText("#feedback-total", `${formatCount(feedbackSessions)} 个会话`);

  const definitions = [
    ["顺利完成", (event) => event.status === "smooth"],
    ["卡过但找到", (event) => event.status === "recovered"],
    ["还没找到", (event) => event.status === "unfinished"],
    ["文字反馈", (event) => event.has_text === true || event.properties?.has_text === true],
    ["图片反馈", (event) => event.has_image === true || event.properties?.has_image === true],
    ["文字和图片", (event) => (
      (event.has_text === true || event.properties?.has_text === true) &&
      (event.has_image === true || event.properties?.has_image === true)
    )],
  ];

  const summaries = definitions.map(([label, predicate], index) => {
    const article = createElement("article", "feedback-summary-item");
    article.dataset.group = index < 3 ? "status" : "format";
    article.append(
      createElement("span", "", label),
      createElement("strong", "", formatCount(countUnique(feedbackEvents, predicate))),
      createElement("small", "", index < 3 ? "反馈状态会话" : "提交形式会话"),
    );
    return article;
  });
  replaceChildren(container, summaries);
}

function getEventDetail(event) {
  const properties = event.properties || {};
  if (event.event_name === "tool_open") return properties.tool || "打开工具链接";
  if (["home_section_view", "challenge_section_view"].includes(event.event_name)) {
    return placementLabels[event.placement] || event.placement || "模块曝光";
  }
  if (event.event_name === "page_engagement") {
    return `${formatDuration(Number(properties.active_duration_ms || 0))}，滚动 ${formatPercent(Number(properties.max_scroll_percent || 0))}`;
  }
  if (event.status) return feedbackLabels[event.status] || event.status;
  if (event.placement) return placementLabels[event.placement] || event.placement;
  return "-";
}

function renderRecentEvents(events) {
  const body = document.querySelector("#recent-events");
  const recent = [...events].sort(
    (left, right) => new Date(right.occurred_at) - new Date(left.occurred_at),
  ).slice(0, 20);
  if (!recent.length) {
    const row = createElement("tr");
    const cell = createElement("td", "empty-state", "当前还没有真实事件。");
    cell.colSpan = 6;
    row.append(cell);
    replaceChildren(body, [row]);
    return;
  }

  const rows = recent.map((event) => {
    const row = createElement("tr");
    const time = createElement("td", "", formatDateTime(event.occurred_at));
    const name = createElement("td", "event-name", eventLabels[event.event_name] || event.event_name);
    const page = createElement("td", "", event.page_path || "-");
    const device = createElement("td", "", event.device_type || "-");
    const source = createElement("td", "", event.utm_source || event.referrer_host || "direct");
    const detail = createElement("td", "event-detail", getEventDetail(event));
    row.append(time, name, page, device, source, detail);
    return row;
  });
  replaceChildren(body, rows);
}

function createSvgElement(tag, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  if (text) element.textContent = text;
  return element;
}

function floorTime(date, mode) {
  const result = new Date(date);
  result.setSeconds(0, 0);
  if (mode === "hour") result.setMinutes(0, 0, 0);
  return result;
}

function buildTimeBuckets(events, mode) {
  const count = mode === "minute" ? 60 : 24;
  const stepMs = mode === "minute" ? 60000 : 3600000;
  const end = floorTime(new Date(), mode);
  const start = new Date(end.getTime() - (count - 1) * stepMs);
  const buckets = Array.from({ length: count }, (_, index) => {
    const time = new Date(start.getTime() + index * stepMs);
    return {
      time,
      entries: new Set(),
      exposures: new Set(),
      tools: new Set(),
    };
  });

  events.forEach((event) => {
    const occurredAt = new Date(event.occurred_at).getTime();
    const index = Math.floor((occurredAt - start.getTime()) / stepMs);
    if (index < 0 || index >= buckets.length) return;
    const key = getSessionKey(event);
    if (["home_view", "challenge_view"].includes(event.event_name)) buckets[index].entries.add(key);
    if (["home_section_view", "challenge_section_view"].includes(event.event_name)) buckets[index].exposures.add(key);
    if (event.event_name === "tool_open") buckets[index].tools.add(key);
  });

  return buckets.map((bucket) => ({
    time: bucket.time,
    entries: bucket.entries.size,
    exposures: bucket.exposures.size,
    tools: bucket.tools.size,
  }));
}

function renderChart(events) {
  const svg = document.querySelector("#trend-chart");
  const empty = document.querySelector("#chart-empty");
  if (!svg) return;
  const buckets = buildTimeBuckets(events, state.mode);
  const series = [
    { key: "entries", label: "页面访问", color: "#151717" },
    { key: "exposures", label: "有效曝光", color: "#159653" },
    { key: "tools", label: "工具点击", color: "#df7d32" },
  ];
  const maximum = Math.max(0, ...buckets.flatMap((bucket) => series.map((item) => bucket[item.key])));
  empty.hidden = maximum > 0;

  const width = 920;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 42, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const scaleMax = Math.max(1, maximum);
  const xFor = (index) => padding.left + (index / Math.max(1, buckets.length - 1)) * chartWidth;
  const yFor = (value) => padding.top + chartHeight - (value / scaleMax) * chartHeight;
  const children = [];
  const yTicks = Array.from(new Set([0, Math.ceil(scaleMax / 2), scaleMax])).sort((a, b) => a - b);

  yTicks.forEach((tick) => {
    const y = yFor(tick);
    children.push(createSvgElement("line", {
      class: "chart-grid-line", x1: padding.left, x2: width - padding.right, y1: y, y2: y,
    }));
    children.push(createSvgElement("text", {
      class: "chart-axis-label", x: padding.left - 10, y: y + 4, "text-anchor": "end",
    }, String(tick)));
  });

  [0, 15, 30, 45, 59].map((value) => (
    state.mode === "minute" ? value : Math.round((value / 59) * 23)
  )).forEach((index, tickPosition, values) => {
    if (values.indexOf(index) !== tickPosition) return;
    const bucket = buckets[index];
    const label = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Shanghai",
    }).format(bucket.time);
    children.push(createSvgElement("text", {
      class: "chart-axis-label",
      x: xFor(index),
      y: height - 14,
      "text-anchor": index === 0 ? "start" : index === buckets.length - 1 ? "end" : "middle",
    }, label));
  });

  series.forEach((item) => {
    const points = buckets.map((bucket, index) => `${xFor(index)},${yFor(bucket[item.key])}`).join(" ");
    children.push(createSvgElement("polyline", {
      class: "chart-series", points, stroke: item.color,
    }));
    buckets.forEach((bucket, index) => {
      if (!bucket[item.key]) return;
      const circle = createSvgElement("circle", {
        class: "chart-point",
        cx: xFor(index),
        cy: yFor(bucket[item.key]),
        r: 4,
        fill: item.color,
      });
      const time = formatDateTime(bucket.time, false);
      circle.append(createSvgElement("title", {}, `${time} ${item.label} ${bucket[item.key]}`));
      children.push(circle);
    });
  });

  svg.replaceChildren(...children);
}

function renderDashboard() {
  const events = getEvents();
  const overview = getOverview(events);
  renderOverview(overview);
  renderDevices(events);
  renderFunnel(events);
  renderRankings(events);
  renderEngagement(events);
  renderFeedbackSummary(events);
  renderRecentEvents(events);
  renderChart(events);
}

function setConnectionState(status, label) {
  const element = document.querySelector("#connection-status");
  if (!element) return;
  element.dataset.state = status;
  const copy = element.querySelector("span");
  if (copy) copy.textContent = label;
}

function showToast(message) {
  const toast = document.querySelector("#dashboard-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

async function refreshData({ manual = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  const button = document.querySelector("#refresh-button");
  if (button) button.disabled = true;
  if (!state.initialized || manual) setConnectionState("loading", "同步数据中");

  try {
    const events = await fetchEvents(state.latestEventAt);
    events.forEach((event) => {
      if (event.event_id) state.events.set(event.event_id, event);
    });
    if (events.length) state.latestEventAt = events[events.length - 1].occurred_at;

    state.initialized = true;
    renderDashboard();
    setConnectionState("ready", "Supabase 已连接");
    setText("#last-updated", `${formatDateTime(new Date())} 更新`);
    if (manual) showToast("真实数据已刷新");
  } catch {
    setConnectionState("error", "数据连接异常");
    showToast("暂时无法读取后台数据，请稍后再试");
  } finally {
    state.loading = false;
    if (button) button.disabled = false;
  }
}

document.querySelector("#refresh-button")?.addEventListener("click", () => refreshData({ manual: true }));
document.querySelectorAll("[data-time-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.timeMode || "minute";
    document.querySelectorAll("[data-time-mode]").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });
    renderChart(getEvents());
  });
});

refreshData();
window.setInterval(refreshData, REFRESH_INTERVAL_MS);
window.addEventListener("focus", refreshData);
