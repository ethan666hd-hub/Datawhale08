import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function createDashboardContext() {
  const context = vm.createContext({
    clearTimeout,
    console,
    Date,
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    fetch: () => new Promise(() => {}),
    Intl,
    Map,
    Number,
    Set,
    setInterval: () => 1,
    setTimeout,
    URLSearchParams,
    window: {
      addEventListener: () => {},
      setInterval: () => 1,
    },
  });
  const source = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");
  vm.runInContext(source, context, { filename: "dashboard.js" });
  return context;
}

test("builds a sequential funnel that cannot exceed its previous step", () => {
  const context = createDashboardContext();
  const events = [
    { session_id: "a", event_name: "home_view" },
    { session_id: "a", event_name: "challenge_view" },
    { session_id: "a", event_name: "challenge_section_view", placement: "tool_guide" },
    { session_id: "a", event_name: "challenge_section_view", placement: "feedback_section" },
    { session_id: "a", event_name: "feedback_select" },
    { session_id: "a", event_name: "feedback_submit", result: "success" },
    { session_id: "b", event_name: "challenge_view" },
    { session_id: "b", event_name: "challenge_section_view", placement: "tool_guide" },
    { session_id: "c", event_name: "home_view" },
    { session_id: "c", event_name: "challenge_view" },
    { session_id: "c", event_name: "challenge_section_view", placement: "tool_guide" },
    { session_id: "c", event_name: "feedback_select" },
    { session_id: "c", event_name: "feedback_submit", result: "success" },
  ];
  context.fixture = events;
  const counts = vm.runInContext("getFunnel(fixture).map((step) => step.value)", context);

  assert.deepEqual(Array.from(counts), [3, 3, 3, 1, 1, 1]);
  assert.ok(counts.every((value, index) => index === 0 || value <= counts[index - 1]));
});

test("uses one landing source and the latest feedback state per session", () => {
  const context = createDashboardContext();
  context.fixture = [
    { session_id: "a", event_name: "home_view", referrer_host: "direct" },
    { session_id: "a", event_name: "challenge_view", referrer_host: "ethan666hd-hub.github.io" },
    { session_id: "b", event_name: "challenge_view", utm_source: "wechat" },
  ];
  const result = vm.runInContext(`(() => {
    const entries = Array.from(getSessionEntryEvents(fixture).values());
    return entries.map(getSourceLabel);
  })()`, context);
  assert.deepEqual(Array.from(result), ["直接访问", "wechat"]);

  context.feedbackFixture = [
    { session_id: "a", status: "smooth" },
    { session_id: "a", status: "recovered" },
    { session_id: "b", status: "unfinished" },
  ];
  const statuses = vm.runInContext(
    "getLatestBySession(feedbackFixture).map((event) => event.status)",
    context,
  );
  assert.deepEqual(Array.from(statuses), ["recovered", "unfinished"]);
});

test("counts the latest favorite state rather than every toggle", () => {
  const context = createDashboardContext();
  context.fixture = [
    { session_id: "a", event_name: "favorite_click", properties: { selected: true } },
    { session_id: "a", event_name: "favorite_click", properties: { selected: false } },
    { session_id: "b", event_name: "favorite_click", properties: { selected: true } },
  ];
  const favorites = vm.runInContext("getEngagement(fixture).favorites", context);
  assert.equal(favorites, 1);
});
