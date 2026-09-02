const ANALYTICS_KEY = "datawhale_daily_v6_events";
const FEEDBACK_KEY = "datawhale_daily_v6_feedback";
const FAVORITE_KEY = "datawhale_daily_v6_favorite";
const VISITOR_ID_KEY = "datawhale_daily_v6_anonymous_id";
const SESSION_ID_KEY = "datawhale_daily_v6_session_id";
const ATTRIBUTION_KEY = "datawhale_daily_v6_attribution";
const LAST_VISIT_KEY = "datawhale_daily_v6_last_visit";
const RETURN_VISIT_SESSION_KEY = "datawhale_daily_v6_return_visit_recorded";
const CHALLENGE_ID = "ai-tool-guide-2026-09-02";
const DATA_SCOPE = "datawhale08-daily-v8";
const MAX_LOCAL_EVENTS = 500;
const EXPOSURE_THRESHOLD = 0.5;
const EXPOSURE_DWELL_MS = 800;
const ENGAGEMENT_CHECKPOINT_MS = 15000;

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeStoredList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The page remains usable when storage is unavailable.
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateStorageValue(storage, key) {
  try {
    const savedValue = storage.getItem(key);
    if (savedValue) return savedValue;
    const nextValue = createId();
    storage.setItem(key, nextValue);
    return nextValue;
  } catch {
    return createId();
  }
}

function getDeviceType() {
  if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
  return "desktop";
}

function getReferrerHost() {
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).hostname || "direct";
  } catch {
    return "direct";
  }
}

function getAttribution() {
  const search = new URLSearchParams(window.location.search);
  const current = {
    utm_source: search.get("utm_source") || "",
    utm_medium: search.get("utm_medium") || "",
    utm_campaign: search.get("utm_campaign") || "",
  };

  if (Object.values(current).some(Boolean)) {
    if (!current.utm_source.startsWith("codex_")) {
      try {
        localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current));
      } catch {
        // Current-page attribution remains available without storage.
      }
    }
    return current;
  }

  try {
    const stored = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "null");
    return stored && typeof stored === "object" ? stored : current;
  } catch {
    return current;
  }
}

const analyticsContext = {
  anonymous_id: getOrCreateStorageValue(localStorage, VISITOR_ID_KEY),
  session_id: getOrCreateStorageValue(sessionStorage, SESSION_ID_KEY),
  page_path: window.location.pathname,
  device_type: getDeviceType(),
  referrer_host: getReferrerHost(),
  ...getAttribution(),
};

function getAnalyticsEndpoint() {
  const metaEndpoint = document.querySelector('meta[name="datawhale-analytics-endpoint"]')?.content;
  return window.DATAWHALE_ANALYTICS_ENDPOINT || metaEndpoint || "";
}

function isProductionDataContext() {
  return window.location.hostname === "ethan666hd-hub.github.io" &&
    window.location.pathname.startsWith("/Datawhale08/") &&
    !analyticsContext.utm_source.startsWith("codex_");
}

function sendToConfiguredEndpoint(event) {
  const endpoint = getAnalyticsEndpoint();
  if (!endpoint || !isProductionDataContext()) return;

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {
    // The local queue keeps the event when the remote endpoint is unavailable.
  });
}

function track(eventName, detail = {}) {
  const event = {
    event_name: eventName,
    event_id: createId(),
    occurred_at: new Date().toISOString(),
    challenge_id: CHALLENGE_ID,
    data_scope: DATA_SCOPE,
    page: document.body.dataset.page,
    ...analyticsContext,
    ...detail,
  };
  const events = readStoredList(ANALYTICS_KEY);
  events.push(event);
  writeStoredList(ANALYTICS_KEY, events.slice(-MAX_LOCAL_EVENTS));

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...event });
  window.posthog?.capture?.(eventName, event);
  window.dispatchEvent(new CustomEvent("datawhale:analytics", { detail: event }));
  sendToConfiguredEndpoint(event);
  return event;
}

function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;

  const copy = toast.querySelector("p");
  if (copy) copy.textContent = message;
  toast.hidden = false;

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

const pageName = document.body.dataset.page;
track(pageName === "practice" ? "challenge_view" : "home_view", {
  placement: pageName === "practice" ? "tool_guide" : "home",
});

function trackReturnVisit() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const previousVisit = localStorage.getItem(LAST_VISIT_KEY);
    const recordedThisSession = sessionStorage.getItem(RETURN_VISIT_SESSION_KEY);
    if (previousVisit && previousVisit !== today && !recordedThisSession) {
      const daysSinceLastVisit = Math.max(1, Math.round(
        (new Date(today).getTime() - new Date(previousVisit).getTime()) / 86400000,
      ));
      track("return_visit", {
        placement: pageName === "practice" ? "tool_guide" : "home",
        days_since_last_visit: daysSinceLastVisit,
      });
      sessionStorage.setItem(RETURN_VISIT_SESSION_KEY, "true");
    }
    localStorage.setItem(LAST_VISIT_KEY, today);
  } catch {
    // Return-visit tracking is optional when storage is unavailable.
  }
}

trackReturnVisit();

const pageOpenedAt = performance.now();
let activeStartedAt = document.hidden ? null : pageOpenedAt;
let activeDurationMs = 0;
let reportedActiveDurationMs = 0;
let maxScrollPercent = 0;
let engagementSequence = 0;
const readingProgress = document.querySelector(".reading-progress span");
let progressFrame = 0;

function updateReadingProgress() {
  progressFrame = 0;
  if (!readingProgress) return;

  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 1;
  readingProgress.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  maxScrollPercent = Math.max(maxScrollPercent, Math.round(progress * 100));
}

function requestReadingProgressUpdate() {
  if (progressFrame) return;
  progressFrame = window.requestAnimationFrame(updateReadingProgress);
}

updateReadingProgress();
window.addEventListener("load", requestReadingProgressUpdate);
window.addEventListener("scroll", requestReadingProgressUpdate, { passive: true });
window.addEventListener("resize", requestReadingProgressUpdate);

document.querySelectorAll("[data-track]").forEach((element) => {
  element.addEventListener("click", () => track(element.dataset.track, {
    placement: element.closest("[data-analytics-section]")?.dataset.analyticsSection || "unknown",
    label: element.textContent.trim(),
  }));
});

document.querySelectorAll("[data-tool]").forEach((element) => {
  element.addEventListener("click", () => {
    track("tool_open", {
      tool: element.dataset.tool,
      destination_host: new URL(element.href).hostname,
      placement: "tool_guide",
    });
  });
});

const trackedExposures = new Set();
let requestExposureCheck = () => {};

function markSectionExposure(element) {
  const placement = element.dataset.analyticsSection;
  const eventName = pageName === "practice" ? "challenge_section_view" : "home_section_view";
  const trackedKey = `${eventName}:${analyticsContext.page_path}:${placement}`;
  if (trackedExposures.has(trackedKey)) return;

  try {
    if (sessionStorage.getItem(`datawhale_daily_v6_exposure:${trackedKey}`) === "true") {
      trackedExposures.add(trackedKey);
      return;
    }
    sessionStorage.setItem(`datawhale_daily_v6_exposure:${trackedKey}`, "true");
  } catch {
    // In-memory dedupe still applies when session storage is unavailable.
  }

  trackedExposures.add(trackedKey);
  track(eventName, { placement });
}

function observeSectionExposures() {
  const sections = Array.from(document.querySelectorAll("[data-analytics-section]"));
  if (!sections.length) return;

  const dwellTimers = new Map();
  let checkFrame = 0;

  const checkExposures = () => {
    checkFrame = 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    sections.forEach((section) => {
      const placement = section.dataset.analyticsSection;
      const eventName = pageName === "practice" ? "challenge_section_view" : "home_section_view";
      const trackedKey = `${eventName}:${analyticsContext.page_path}:${placement}`;
      if (trackedExposures.has(trackedKey)) return;

      const rect = section.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const comparableHeight = Math.max(1, Math.min(rect.height || viewportHeight, viewportHeight));
      const meetsThreshold = !document.hidden && visibleHeight >= comparableHeight * EXPOSURE_THRESHOLD;
      const timer = dwellTimers.get(section);

      if (meetsThreshold) {
        if (!timer) {
          dwellTimers.set(section, window.setTimeout(() => {
            markSectionExposure(section);
            dwellTimers.delete(section);
          }, EXPOSURE_DWELL_MS));
        }
      } else if (timer) {
        window.clearTimeout(timer);
        dwellTimers.delete(section);
      }
    });
  };

  requestExposureCheck = () => {
    if (checkFrame) return;
    checkFrame = window.requestAnimationFrame(checkExposures);
  };

  window.addEventListener("scroll", requestExposureCheck, { passive: true });
  window.addEventListener("resize", requestExposureCheck);
  document.addEventListener("visibilitychange", requestExposureCheck);
  checkExposures();
}

observeSectionExposures();

function captureActiveDuration(now = performance.now()) {
  if (activeStartedAt === null) return;
  activeDurationMs += Math.max(0, now - activeStartedAt);
  activeStartedAt = now;
}

function trackEngagement(reason, force = false) {
  const now = performance.now();
  captureActiveDuration(now);
  const deltaMs = activeDurationMs - reportedActiveDurationMs;
  if (deltaMs <= 0) return;
  if (!force && deltaMs < 1000) return;

  reportedActiveDurationMs = activeDurationMs;
  engagementSequence += 1;
  track("page_engagement", {
    placement: pageName === "practice" ? "tool_guide" : "home",
    reason,
    sequence: engagementSequence,
    active_duration_ms: Math.round(activeDurationMs),
    active_delta_ms: Math.max(0, Math.round(deltaMs)),
    elapsed_duration_ms: Math.round(now - pageOpenedAt),
    max_scroll_percent: maxScrollPercent,
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    trackEngagement("hidden");
    activeStartedAt = null;
    return;
  }
  activeStartedAt = performance.now();
});

window.addEventListener("pagehide", () => trackEngagement("pagehide", true));
window.setInterval(() => trackEngagement("checkpoint"), ENGAGEMENT_CHECKPOINT_MS);

window.datawhaleAnalytics = {
  challengeId: CHALLENGE_ID,
  dataScope: DATA_SCOPE,
  getEvents: () => readStoredList(ANALYTICS_KEY),
  track,
};

const favoriteButton = document.querySelector(".favorite-button");
const favoriteIcon = favoriteButton?.querySelector(".favorite-icon");
const favoriteLabel = favoriteButton?.querySelector(".favorite-label");

function updateFavoriteButton(isFavorite) {
  if (!favoriteButton) return;
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  if (favoriteIcon) favoriteIcon.textContent = isFavorite ? "★" : "☆";
  if (favoriteLabel) favoriteLabel.textContent = isFavorite ? "已收藏" : "收藏";
}

let isFavorite = false;
try {
  isFavorite = localStorage.getItem(FAVORITE_KEY) === "true";
} catch {
  isFavorite = false;
}
updateFavoriteButton(isFavorite);

favoriteButton?.addEventListener("click", () => {
  if (isFavorite) return;
  isFavorite = true;
  updateFavoriteButton(true);
  try {
    localStorage.setItem(FAVORITE_KEY, "true");
  } catch {
    // The selected state still works for the current page view.
  }
  track("favorite_click", { placement: "practice_header", result: "success" });
});

const feedbackButtons = Array.from(document.querySelectorAll("[data-feedback]"));
const feedbackForm = document.querySelector(".feedback-form");
const feedbackMessage = document.querySelector("#feedback-message");
const feedbackImage = document.querySelector("#feedback-image");
const feedbackPreview = document.querySelector(".feedback-preview");
const feedbackPreviewImage = feedbackPreview?.querySelector("img");
const removeImageButton = document.querySelector(".remove-image");
const feedbackSubmit = feedbackForm?.querySelector("button[type='submit']");

let feedbackStatus = "";
let feedbackImageFile = null;

function updateFeedbackSubmit() {
  if (!feedbackSubmit) return;
  feedbackSubmit.disabled = !feedbackStatus || (!feedbackMessage?.value.trim() && !feedbackImageFile);
}

feedbackButtons.forEach((button) => {
  button.addEventListener("click", () => {
    feedbackStatus = button.dataset.feedback || "";

    feedbackButtons.forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("is-selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
      const action = candidate.querySelector(".feedback-action");
      if (action) action.textContent = selected ? "已选择" : "选择";
    });

    if (feedbackForm) feedbackForm.hidden = false;
    requestExposureCheck();
    track("feedback_select", { placement: "feedback_section", status: feedbackStatus });
    showToast("成果状态已记录，欢迎再留下一条收获");
    updateFeedbackSubmit();
  });
});

feedbackMessage?.addEventListener("input", updateFeedbackSubmit);

feedbackImage?.addEventListener("change", () => {
  const file = feedbackImage.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    feedbackImage.value = "";
    showToast("图片不能超过 5 MB");
    return;
  }

  feedbackImageFile = file;
  track("feedback_image_select", {
    placement: "feedback_detail_form",
    file_type: file.type || "unknown",
    file_size_bucket: file.size < 1024 * 1024 ? "under_1mb" : "1mb_to_5mb",
  });
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (feedbackPreviewImage && typeof reader.result === "string") {
      feedbackPreviewImage.src = reader.result;
    }
    if (feedbackPreview) feedbackPreview.hidden = false;
  });
  reader.readAsDataURL(file);
  updateFeedbackSubmit();
});

removeImageButton?.addEventListener("click", () => {
  feedbackImageFile = null;
  if (feedbackImage) feedbackImage.value = "";
  if (feedbackPreviewImage) feedbackPreviewImage.removeAttribute("src");
  if (feedbackPreview) feedbackPreview.hidden = true;
  track("feedback_image_remove", { placement: "feedback_detail_form" });
  updateFeedbackSubmit();
});

feedbackForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  updateFeedbackSubmit();
  if (feedbackSubmit?.disabled) return;

  const feedbackRecords = readStoredList(FEEDBACK_KEY);
  feedbackRecords.push({
    status: feedbackStatus,
    message: feedbackMessage?.value.trim() || "",
    has_image: Boolean(feedbackImageFile),
    image_name: feedbackImageFile?.name || "",
    timestamp: new Date().toISOString(),
  });
  writeStoredList(FEEDBACK_KEY, feedbackRecords.slice(-50));
  track("feedback_submit", {
    placement: "feedback_detail_form",
    status: feedbackStatus,
    has_text: Boolean(feedbackMessage?.value.trim()),
    has_image: Boolean(feedbackImageFile),
  });

  if (feedbackMessage) feedbackMessage.value = "";
  feedbackImageFile = null;
  if (feedbackImage) feedbackImage.value = "";
  if (feedbackPreviewImage) feedbackPreviewImage.removeAttribute("src");
  if (feedbackPreview) feedbackPreview.hidden = true;
  updateFeedbackSubmit();
  showToast("反馈已记录，谢谢你的分享");
});
