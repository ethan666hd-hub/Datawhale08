const ANALYTICS_KEY = "datawhale_daily_v6_events";
const FEEDBACK_KEY = "datawhale_daily_v6_feedback";
const FAVORITE_KEY = "datawhale_daily_v6_favorite";

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

function track(eventName, detail = {}) {
  const events = readStoredList(ANALYTICS_KEY);
  events.push({
    event_name: eventName,
    page: document.body.dataset.page,
    timestamp: new Date().toISOString(),
    ...detail,
  });
  writeStoredList(ANALYTICS_KEY, events.slice(-200));
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
track(pageName === "practice" ? "challenge_view" : "home_view");

const readingProgress = document.querySelector(".reading-progress span");
let progressFrame = 0;

function updateReadingProgress() {
  progressFrame = 0;
  if (!readingProgress) return;

  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 1;
  readingProgress.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
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
  element.addEventListener("click", () => track(element.dataset.track));
});

document.querySelectorAll("[data-tool]").forEach((element) => {
  element.addEventListener("click", () => {
    track("tool_open", { tool: element.dataset.tool });
  });
});

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
  track("favorite_click", { result: "success" });
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
    track("feedback_select", { status: feedbackStatus });
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
