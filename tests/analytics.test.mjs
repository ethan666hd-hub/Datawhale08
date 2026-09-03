import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

class EventHub {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    (this.listeners.get(event.type) || []).forEach((listener) => listener(event));
  }
}

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function createSection(placement) {
  return {
    dataset: { analyticsSection: placement },
    getBoundingClientRect: () => ({ top: 0, bottom: 600, height: 600 }),
  };
}

function createHarness() {
  const document = new EventHub();
  const window = new EventHub();
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const sections = [createSection("tool_guide"), createSection("feedback_section")];
  const progress = { style: {} };
  let now = 100;
  const requests = [];

  document.body = { dataset: { page: "practice" } };
  document.documentElement = { scrollHeight: 1800, clientHeight: 800 };
  document.referrer = "https://mp.weixin.qq.com/article";
  document.hidden = false;
  document.querySelector = (selector) => {
    if (selector === ".reading-progress span") return progress;
    return null;
  };
  document.querySelectorAll = (selector) => {
    if (selector === "[data-analytics-section]") return sections;
    return [];
  };

  Object.assign(window, {
    location: {
      hostname: "localhost",
      pathname: "/Datawhale08/practice.html",
      search: "?utm_source=codex_test&utm_medium=qa&utm_campaign=analytics",
    },
    innerHeight: 800,
    scrollY: 0,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => {
      callback();
      return 1;
    },
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    dataLayer: [],
  });

  const context = {
    console,
    crypto,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Date,
    document,
    fetch: async (...args) => {
      requests.push(args);
      return { ok: true, status: 201 };
    },
    globalThis: null,
    localStorage,
    performance: { now: () => now },
    sessionStorage,
    URL,
    URLSearchParams,
    window,
  };
  context.globalThis = context;

  return {
    context,
    document,
    getRequests: () => requests,
    setNow: (value) => {
      now = value;
    },
    window,
  };
}

test("tracks page views, qualified exposures, and visible engagement", async () => {
  const harness = createHarness();
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  vm.runInNewContext(source, harness.context, { filename: "app.js" });

  await new Promise((resolve) => setTimeout(resolve, 900));

  let events = harness.window.dataLayer;
  assert.equal(events[0].event_name, "challenge_view");
  assert.equal(events[0].challenge_id, "ai-tool-guide-2026-09-02");
  assert.equal(events[0].data_scope, "datawhale08-daily-v8");
  assert.equal(events[0].utm_source, "codex_test");
  assert.equal(events[0].device_type, "desktop");
  assert.equal(events[0].referrer_host, "mp.weixin.qq.com");

  const exposures = events.filter((event) => event.event_name === "challenge_section_view");
  assert.deepEqual(
    exposures.map((event) => event.placement).sort(),
    ["feedback_section", "tool_guide"],
  );

  harness.window.dispatchEvent({ type: "scroll" });
  await new Promise((resolve) => setTimeout(resolve, 900));
  events = harness.window.dataLayer;
  assert.equal(
    events.filter((event) => event.event_name === "challenge_section_view").length,
    2,
  );

  harness.setNow(4300);
  harness.document.hidden = true;
  harness.document.dispatchEvent({ type: "visibilitychange" });
  let engagement = harness.window.dataLayer.filter((event) => event.event_name === "page_engagement");
  assert.equal(engagement.length, 1);
  assert.equal(engagement[0].reason, "hidden");
  assert.equal(engagement[0].active_duration_ms, 4200);

  harness.setNow(5000);
  harness.document.hidden = false;
  harness.document.dispatchEvent({ type: "visibilitychange" });
  harness.setNow(7200);
  harness.window.dispatchEvent({ type: "pagehide" });
  engagement = harness.window.dataLayer.filter((event) => event.event_name === "page_engagement");
  assert.equal(engagement.length, 2);
  assert.equal(engagement[1].reason, "pagehide");
  assert.equal(engagement[1].active_delta_ms, 2200);

  harness.window.dispatchEvent({ type: "pagehide" });
  engagement = harness.window.dataLayer.filter((event) => event.event_name === "page_engagement");
  assert.equal(engagement.length, 2);
  assert.equal(harness.getRequests().length, 0);
});

test("sends production events through the restricted insert endpoint", async () => {
  const harness = createHarness();
  harness.window.location.hostname = "ethan666hd-hub.github.io";
  harness.window.location.search = "";
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  vm.runInNewContext(source, harness.context, { filename: "app.js" });

  await Promise.resolve();
  const requests = harness.getRequests();
  assert.equal(requests.length, 1);
  assert.match(requests[0][0], /\/rest\/v1\/analytics_events$/);
  assert.equal(requests[0][1].method, "POST");
  assert.ok(requests[0][1].headers.apikey);

  const payload = JSON.parse(requests[0][1].body);
  assert.equal(payload.event_name, "challenge_view");
  assert.equal(payload.challenge_id, "ai-tool-guide-2026-09-02");
  assert.equal(payload.properties.data_scope, "datawhale08-daily-v8");
});

test("keeps feedback records private and the dashboard free of private reads", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const dashboardSource = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");

  assert.match(appSource, /rest\/v1\/daily_v8_analytics_events/);
  assert.match(appSource, /event_name:\s*"feedback_record"/);
  assert.match(appSource, /data_scope:\s*DATA_SCOPE/);
  assert.match(appSource, /reflection:\s*message/);
  assert.match(appSource, /image_url:\s*imageUrl/);

  assert.match(dashboardSource, /rest\/v1\/analytics_events/);
  assert.match(dashboardSource, /event_name === "feedback_submit"/);
  assert.doesNotMatch(dashboardSource, /challenge_feedback/);
  assert.doesNotMatch(dashboardSource, /daily_v8_analytics_events/);
  assert.doesNotMatch(dashboardSource, /anonymous_id/);
});
