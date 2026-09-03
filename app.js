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
const SUPABASE_PROJECT_URL = "https://fjsdilkacsaarxnqrdmm.supabase.co";
const SUPABASE_ANALYTICS_URL = `${SUPABASE_PROJECT_URL}/rest/v1/analytics_events`;
const SUPABASE_FEEDBACK_URL = `${SUPABASE_PROJECT_URL}/rest/v1/challenge_feedback`;
const SUPABASE_FEEDBACK_BUCKET = "challenge-feedback";
const SUPABASE_ANON_KEY = "sb_publishable_LKFWLPhFegq-KScuSQzfXw_2rYSuTfn";

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
  return window.DATAWHALE_ANALYTICS_ENDPOINT || metaEndpoint || SUPABASE_ANALYTICS_URL;
}

function isProductionHostContext() {
  return window.location.hostname === "ethan666hd-hub.github.io" &&
    window.location.pathname.startsWith("/Datawhale08/");
}

function isProductionDataContext() {
  return isProductionHostContext() &&
    !analyticsContext.utm_source.startsWith("codex_");
}

function toAnalyticsRecord(event) {
  const columnNames = new Set([
    "event_id",
    "event_name",
    "occurred_at",
    "page_path",
    "challenge_id",
    "anonymous_id",
    "session_id",
    "device_type",
    "referrer_host",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "placement",
    "result",
    "status",
    "has_text",
    "has_image",
    "submit_mode",
    "text_length_bucket",
  ]);
  const record = Object.fromEntries(
    Object.entries(event).filter(([key]) => columnNames.has(key)),
  );
  record.properties = Object.fromEntries(
    Object.entries(event).filter(([key, value]) => !columnNames.has(key) && value !== undefined),
  );
  return record;
}

function markEventsSynced(eventIds) {
  const syncedIds = new Set(eventIds);
  const events = readStoredList(ANALYTICS_KEY).map((event) => (
    syncedIds.has(event.event_id) ? { ...event, synced_at: new Date().toISOString() } : event
  ));
  writeStoredList(ANALYTICS_KEY, events);
}

function sendToConfiguredEndpoint(events) {
  const endpoint = getAnalyticsEndpoint();
  const pendingEvents = (Array.isArray(events) ? events : [events]).filter((event) => (
    event?.event_id && event.challenge_id === CHALLENGE_ID && !event.synced_at
  ));
  if (!endpoint || !isProductionDataContext() || !pendingEvents.length) return;

  const batch = pendingEvents.slice(0, 20);
  const isSupabaseEndpoint = endpoint === SUPABASE_ANALYTICS_URL;
  const headers = { "Content-Type": "application/json" };
  if (isSupabaseEndpoint) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    headers.Prefer = "return=minimal";
  }

  const sendRequest = (event) => fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(isSupabaseEndpoint ? toAnalyticsRecord(event) : [toAnalyticsRecord(event)]),
    keepalive: true,
  }).then((response) => ({ event, response })).catch(() => ({ event, response: null }));

  Promise.all(batch.map(sendRequest)).then((results) => {
    const syncedEventIds = results
      .filter(({ response }) => response?.ok || response?.status === 409)
      .map(({ event }) => event.event_id);
    if (syncedEventIds.length) markEventsSynced(syncedEventIds);
    if (syncedEventIds.length && pendingEvents.length > batch.length) {
      syncStoredEvents();
    }
  });
}

function syncStoredEvents() {
  sendToConfiguredEndpoint(readStoredList(ANALYTICS_KEY));
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
syncStoredEvents();
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
let feedbackSubmitting = false;
const feedbackSubmitIdleLabel = feedbackSubmit?.textContent || "发送反馈";

function updateFeedbackSubmit() {
  if (!feedbackSubmit) return;
  feedbackSubmit.disabled = feedbackSubmitting ||
    !feedbackStatus ||
    (!feedbackMessage?.value.trim() && !feedbackImageFile);
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

function getFeedbackSubmitMode(message, imageFile) {
  if (message && imageFile) return "text_and_image";
  if (imageFile) return "image_only";
  return "text_only";
}

function getTextLengthBucket(message) {
  if (!message) return "none";
  if (message.length <= 50) return "1_to_50";
  if (message.length <= 200) return "51_to_200";
  return "201_to_500";
}

function getSupabaseHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extraHeaders,
  };
}

async function uploadFeedbackImage(file) {
  if (!file) return { imagePath: "", imageUrl: "" };

  const extensionByType = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const extension = extensionByType[file.type] || "jpg";
  const imagePath = `${CHALLENGE_ID}/${Date.now()}-${createId()}.${extension}`;
  const encodedPath = imagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${SUPABASE_PROJECT_URL}/storage/v1/object/${SUPABASE_FEEDBACK_BUCKET}/${encodedPath}`,
    {
      method: "POST",
      headers: getSupabaseHeaders({
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      }),
      body: file,
    },
  );

  if (!response.ok) throw new Error(`feedback_image_upload_${response.status}`);

  return {
    imagePath,
    imageUrl: `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${SUPABASE_FEEDBACK_BUCKET}/${encodedPath}`,
  };
}

async function insertFeedbackRecord(record) {
  const response = await fetch(SUPABASE_FEEDBACK_URL, {
    method: "POST",
    headers: getSupabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(record),
  });

  if (!response.ok) throw new Error(`feedback_insert_${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

function resetFeedbackForm() {
  if (feedbackMessage) feedbackMessage.value = "";
  feedbackImageFile = null;
  if (feedbackImage) feedbackImage.value = "";
  if (feedbackPreviewImage) feedbackPreviewImage.removeAttribute("src");
  if (feedbackPreview) feedbackPreview.hidden = true;
}

feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateFeedbackSubmit();
  if (feedbackSubmit?.disabled) return;

  const message = feedbackMessage?.value.trim() || "";
  const imageFile = feedbackImageFile;
  const submitMode = getFeedbackSubmitMode(message, imageFile);
  const textLengthBucket = getTextLengthBucket(message);
  const feedbackId = createId();
  const feedbackRecords = readStoredList(FEEDBACK_KEY);
  const localRecord = {
    feedback_id: feedbackId,
    status: feedbackStatus,
    message,
    has_image: Boolean(imageFile),
    image_name: imageFile?.name || "",
    timestamp: new Date().toISOString(),
  };
  feedbackRecords.push(localRecord);
  writeStoredList(FEEDBACK_KEY, feedbackRecords.slice(-50));

  track("feedback_submit_attempt", {
    placement: "feedback_detail_form",
    status: feedbackStatus,
    has_text: Boolean(message),
    has_image: Boolean(imageFile),
    submit_mode: submitMode,
    text_length_bucket: textLengthBucket,
  });

  if (!isProductionHostContext()) {
    resetFeedbackForm();
    updateFeedbackSubmit();
    showToast("反馈已保存在当前浏览器，线上访问时会发送到后台");
    return;
  }

  feedbackSubmitting = true;
  if (feedbackSubmit) feedbackSubmit.textContent = "发送中...";
  updateFeedbackSubmit();

  try {
    const { imagePath, imageUrl } = await uploadFeedbackImage(imageFile);
    const savedRecord = await insertFeedbackRecord({
      challenge_id: CHALLENGE_ID,
      challenge_title: "AI工具选用推荐指南",
      status: feedbackStatus,
      reflection: message,
      image_url: imageUrl,
      image_path: imagePath,
      image_alt: imageFile ? "用户提交的工具使用反馈图片" : "",
      image_name: imageFile?.name || "",
      anonymous_id: analyticsContext.anonymous_id,
      session_id: analyticsContext.session_id,
      utm_source: analyticsContext.utm_source,
      utm_medium: analyticsContext.utm_medium,
      utm_campaign: analyticsContext.utm_campaign,
      source_page: analyticsContext.page_path,
    });

    const updatedRecords = readStoredList(FEEDBACK_KEY).map((record) => (
      record.feedback_id === feedbackId
        ? { ...record, remote_id: savedRecord?.id || "", synced_at: new Date().toISOString() }
        : record
    ));
    writeStoredList(FEEDBACK_KEY, updatedRecords);
    track("feedback_submit", {
      placement: "feedback_detail_form",
      status: feedbackStatus,
      result: "success",
      has_text: Boolean(message),
      has_image: Boolean(imageFile),
      submit_mode: submitMode,
      text_length_bucket: textLengthBucket,
    });
    resetFeedbackForm();
    showToast("反馈已发送，谢谢你的分享");
  } catch {
    track("feedback_submit_failed", {
      placement: "feedback_detail_form",
      status: feedbackStatus,
      result: "failed",
      has_text: Boolean(message),
      has_image: Boolean(imageFile),
      submit_mode: submitMode,
      text_length_bucket: textLengthBucket,
    });
    showToast("暂时没有发送成功，请稍后再试");
  } finally {
    feedbackSubmitting = false;
    if (feedbackSubmit) feedbackSubmit.textContent = feedbackSubmitIdleLabel;
    updateFeedbackSubmit();
  }
});
