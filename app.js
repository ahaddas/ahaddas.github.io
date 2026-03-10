/* -------------------------------------------------------
   DEFAULT CONFIG — overridden by localStorage "kioskConfig"
------------------------------------------------------- */
const DEFAULT_CONFIG = {
  scheduleUrl: "",
  leaderboardUrl: "",
  promoUrl: "",
  promoIntervalMinutes: 5,
  logoUrl: "",
  bgImage: "",
  leaderboardRows: 5,
  leaderboardTitle: "Leaderboard",
  scheduleTitle: "Tulossa tänään:",
  upcomingCount: 3,
  display: {
    fontFamily:           "Arial, sans-serif",
    fontUrl:              "",
    eventFirstSize:       56,
    eventTitleSize:       40,
    eventSpacing:         20,
    scheduleMarginLeft:   3,
    sidepanelMarginRight: 4
  },
  theme: {
    bg:      "#03531b",
    accent:  "#1db954",
    text:    "#ffffff",
    textDim: "#022f10"
  },
  schedule: {
    time:        "time",
    title:       "title",
    description: "description",
    image:       "image",
    id:          "id"
  },
  leaderboard: {
    // Use "name" for a single full-name column,
    // OR set "firstName" + "lastName" for split columns.
    name:      "",
    firstName: "first",
    lastName:  "last",
    company:   "company",
    score:     "score",
    sortOrder: "asc"   // "asc" = lowest score first, "desc" = highest first
  }
};

/* -------------------------------------------------------
   URL CONVERTER
   Converts share links from Google Drive and Dropbox into
   direct-access URLs usable in <video> and <img> tags.
   Non-matching URLs are returned unchanged.
------------------------------------------------------- */
function directUrl(url, type = "file") {
  if (!url) return url;

  // --- Dropbox ---
  if (url.includes("dropbox.com")) {
    const u = new URL(url);
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return u.toString();
  }

  // --- Google Drive ---
  // Only match actual drive.google.com share URLs, not arbitrary paths
  // that happen to contain /d/ (e.g. Wikimedia Commons URLs).
  const driveMatch = url.includes("drive.google.com") && url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (driveMatch) {
    const id = driveMatch[1];
    if (type === "image") {
      return `https://drive.usercontent.google.com/download?id=${id}&export=view&confirm=t`;
    }
    return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  }

  return url;
}

function getConfig() {
  try {
    const stored = localStorage.getItem("kioskConfig");
    if (stored) return Object.assign({}, DEFAULT_CONFIG, JSON.parse(stored));
  } catch (e) {}
  return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
  localStorage.setItem("kioskConfig", JSON.stringify(cfg));
}

/* -------------------------------------------------------
   STATE
------------------------------------------------------- */
let fullscreenAllowed = false;
let toggle = false;
let panelIndex = 0;
const panels = ["leaderboardPanel", "eventInfoPanel"];

/* -------------------------------------------------------
   FLEXIBLE DATE PARSER
------------------------------------------------------- */
function parseDateFlexible(input) {
  if (!input) return null;
  if (input instanceof Date && !isNaN(input)) return input;

  const s = String(input).trim();

  // Match any separator: / . -
  // Handles dd/mm/yyyy, mm/dd/yyyy, d/m/yyyy etc. with hh:mm[:ss]
  let parts = s.match(
    /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (parts) {
    let [_, a, b, yyyy, hh, min, ss] = parts;
    a = +a; b = +b; yyyy = +yyyy;
    hh = +(hh || 0); min = +(min || 0); ss = +(ss || 0);

    let dd, mm;
    if (a > 12) {
      // First number can't be a month — must be dd/mm/yyyy
      dd = a; mm = b;
    } else if (b > 12) {
      // Second number can't be a month — must be mm/dd/yyyy (US export from Sheets)
      mm = a; dd = b;
    } else {
      // Both <= 12: ambiguous, assume dd/mm/yyyy (European)
      dd = a; mm = b;
    }

    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
        return null;
    }

    const r = new Date(yyyy, mm - 1, dd, hh, min, ss);
    return r;
  }

  // yyyy-mm-dd hh:mm[:ss]
  let iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (iso) {
    const [_, yyyy, mm, dd, hh, min, ss] = iso;
    const r = new Date(+yyyy, +mm - 1, +dd, +(hh||0), +(min||0), +(ss||0));
    return r;
  }

  // Last resort
  const d = new Date(s);
  if (!isNaN(d)) {
    return d;
  }

  console.warn('[date] FAILED: "' + s + '"');
  return null;
}


/* -------------------------------------------------------
   PANEL CYCLING
------------------------------------------------------- */
function cyclePanels() {
  panels.forEach(id => {
    document.getElementById(id).classList.remove("active");
  });

  const activeId = panels[panelIndex];
  const panel = document.getElementById(activeId);

  panel.classList.remove("active");
  void panel.offsetWidth;
  panel.classList.add("active");

  if (activeId === "leaderboardPanel") {
    renderLeaderboard();        // rebuild DOM from cache right before showing
    resetLeaderboardAnimation();
    animateLeaderboard();
  }

  panelIndex = (panelIndex + 1) % panels.length;
}

/* -------------------------------------------------------
   PRELOADER
   Called when "Start Display" is clicked. Fetches the video
   and any images referenced in the schedule so they are
   cached by the browser before the display begins.
------------------------------------------------------- */
async function preloadAssets(onProgress) {
  const cfg = getConfig();
  const assets = [];

  // Promo video
  if (cfg.promoUrl) assets.push({ url: directUrl(cfg.promoUrl, "file"), type: "video" });

  // Logo
  if (cfg.logoUrl) assets.push({ url: directUrl(cfg.logoUrl, "image"), type: "image" });

  // Schedule images — load the CSV to find them
  try {
    const events = await loadScheduleCSV();
    events.forEach(e => {
      if (e.image) assets.push({ url: directUrl(e.image, "image"), type: "image" });
    });
  } catch (_) {}

  if (assets.length === 0) { onProgress(1, 1); return; }

  let done = 0;

  await Promise.allSettled(assets.map(asset => new Promise(resolve => {
    if (asset.type === "image") {
      const img = new Image();
      img.onload = img.onerror = () => { onProgress(++done, assets.length); resolve(); };
      img.src = asset.url;
    } else {
      // Use a native <video> element instead of fetch() — fetch() is blocked by
      // CORS since Google Drive doesn't send Access-Control-Allow-Origin headers.
      // Native media elements bypass CORS and buffer the file directly.
      const vid = document.createElement("video");
      vid.preload = "auto";
      vid.muted = true;
      const finish = () => { onProgress(++done, assets.length); resolve(); };
      // canplaythrough = enough buffered to play without stopping
      vid.oncanplaythrough = finish;
      vid.onerror = finish; // still advance progress on failure
      vid.src = asset.url;
      vid.load();
      // Fallback: resolve after 15s in case the event never fires
      setTimeout(finish, 15000);
    }
  })));
}

/* -------------------------------------------------------
   START BUTTON
------------------------------------------------------- */
document.getElementById("startBtn").addEventListener("click", async () => {
  const cfg = getConfig();
  if (!cfg.scheduleUrl || !cfg.leaderboardUrl) {
    openSettings();
    return;
  }

  // Show loading state
  const btn = document.getElementById("startBtn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Loading… 0%";

  await preloadAssets((done, total) => {
    const pct = Math.round((done / total) * 100);
    btn.textContent = `Loading… ${pct}%`;
  });

  btn.textContent = originalText;
  btn.disabled = false;

  fullscreenAllowed = true;
  document.getElementById("startOverlay").style.display = "none";
  startLoops();
});

/* -------------------------------------------------------
   LOAD SCHEDULE (CSV)
------------------------------------------------------- */
async function loadScheduleCSV() {
  const cfg = getConfig();
  if (!cfg.scheduleUrl) return [];

  const res = await fetch(cfg.scheduleUrl);
  const text = await res.text();

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const m = cfg.schedule;

  return parsed.data
    .filter(row => row[m.time] && row[m.title])
    .map(row => ({
      time:        (row[m.time]        || "").trim(),
      title:       (row[m.title]       || "").trim(),
      description: (row[m.description] || "").trim(),
      id:          (row[m.id]          || "").trim(),
      image:       (row[m.image]       || "").trim()
    }));
}

async function loadSchedule() {
  return await loadScheduleCSV();
}

/* -------------------------------------------------------
   UPCOMING EVENTS
------------------------------------------------------- */
function getNextN(events, n) {
  const now = new Date();
  const normalized = events
    .map(e => ({ ...e, parsedTime: parseDateFlexible(e.time) }))
    .filter(e => {
      if (!e.parsedTime) return false;
      return e.parsedTime > now;
    })
    .sort((a, b) => a.parsedTime - b.parsedTime);
  return normalized.slice(0, n);
}

function formatTime(dateStr) {
  const d = parseDateFlexible(dateStr);
  if (!d) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function toggleFirstEventSubtitle() {
  const e1 = document.getElementById("event1");
  if (!e1) return;
  const subtitle = e1.querySelector(".subtitle");
  const cfg = getConfig();
  const events = window._latestEvents || [];
  const [first] = getNextN(events, 1);
  if (!first) return;
  toggle = !toggle;
  subtitle.textContent = toggle ? "Seuraavaksi" : formatTime(first.time);
}

async function updateUpcoming() {
  const cfg = getConfig();
  const count = Math.max(1, Math.min(10, Number(cfg.upcomingCount) || 3));
  const events = await loadSchedule();
  window._latestEvents = events;
  const upcoming = getNextN(events, count);

  // Update the schedule heading
  const heading = document.querySelector("#upcoming h1");
  if (heading) heading.textContent = cfg.scheduleTitle || DEFAULT_CONFIG.scheduleTitle;

  updateEventInfoPanel(upcoming[0]);

  const container = document.getElementById("upcoming");

  // Rebuild slots if the count changed
  let slots = container.querySelectorAll(".event");
  if (slots.length !== count) {
    // Remove old slots
    slots.forEach(el => el.remove());
    // Create new ones
    for (let i = 0; i < count; i++) {
      const div = document.createElement("div");
      div.className = "event";
      div.id = "event" + (i + 1);
      div.innerHTML = `<div class="title"></div><div class="subtitle"></div>`;
      container.appendChild(div);
    }
    slots = container.querySelectorAll(".event");
    applyEventSlotStyles(count);
  }

  slots.forEach((el, i) => {
    const ev = upcoming[i];
    el.querySelector(".title").textContent    = ev ? ev.title : "";
    el.querySelector(".subtitle").textContent = ev ? formatTime(ev.time) : "";
  });
}

// Apply inline styles for transition-delay and opacity fade to event slots
function applyEventSlotStyles(count) {
  const slots = document.querySelectorAll(".event");
  slots.forEach((el, i) => {
    const delay = 0.2 + i * 0.3;
    // Opacity fades: first two full, then fade to ~0.2 by the last slot
    const opacity = count <= 2 ? 1 : Math.max(0.2, 1 - (i / (count - 1)) * 0.8);
    el.style.setProperty("--slot-delay",   delay + "s");
    el.style.setProperty("--slot-opacity", i < 2 ? 1 : opacity);
    el.style.fontSize = i === 0 ? "" : ""; // keep first slot handled by CSS id selector
  });
}

/* -------------------------------------------------------
   VIDEO PLAYBACK
------------------------------------------------------- */
function playPromo(fromUserGesture = false) {
  const cfg = getConfig();
  if (!cfg.promoUrl) return;

  const video = document.getElementById("promo");

  const expectedSrc = directUrl(cfg.promoUrl, "file");
  if (!video.src || video.getAttribute("src") !== expectedSrc) {
    video.src = expectedSrc;
    video.load();
  }

  console.log("[promo] attempting play. src:", video.src, "readyState:", video.readyState, "networkState:", video.networkState);

  // networkState 3 = NETWORK_NO_SOURCE: browser got a non-video response
  // (e.g. Google Drive's auth/redirect HTML). Skip silently.
  if (video.networkState === 3) {
    console.warn("[promo] networkState is NO_SOURCE — the URL didn't return a playable video. Google Drive direct links are not supported; use Dropbox (?raw=1), GitHub raw, or any direct-serve host.");
    showToast("⚠ Video URL not playable — see console for details");
    return;
  }

  document.querySelectorAll(".event").forEach(e => e.classList.remove("visible"));

  video.style.display = "block";
  video.currentTime = 0;

  video.onerror = () => {
    console.error("[promo] Video error:", video.error?.code, video.error?.message, video.src);
    video.style.display = "none";
    slideEventsIn();
  };

  video.play().catch(err => {
    console.error("[promo] play() rejected:", err);
    video.style.display = "none";
    slideEventsIn();
  });

  // Fullscreen only works when triggered directly by a user gesture
  if (fullscreenAllowed && fromUserGesture) {
    video.requestFullscreen().catch(() => {});
  }

  video.onended = async () => {
    video.style.display = "none";
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (_) {}
    slideEventsIn();
    updateUpcoming();
  };
}

function slideEventsIn() {
  setTimeout(() => {
    document.querySelectorAll(".event").forEach(e => e.classList.add("visible"));
  }, 300);
}

/* -------------------------------------------------------
   LEADERBOARD
------------------------------------------------------- */
async function loadLeaderboardCSV() {
  const cfg = getConfig();
  if (!cfg.leaderboardUrl) return [];

  const res = await fetch(cfg.leaderboardUrl);
  const text = await res.text();

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const m = cfg.leaderboard;

  return parsed.data.map(row => {
    let name;
    if (m.name && row[m.name]) {
      name = row[m.name];
    } else {
      const first = row[m.firstName] || "";
      const last  = row[m.lastName]  || "";
      name = (first + " " + last).trim();
    }
    return {
      name,
      company: (row[m.company] || "").trim(),
      score:   Number(row[m.score]) || 0
    };
  });
}

// Cached leaderboard data — fetched in background, rendered on demand
let _leaderboardCache = null;

async function updateLeaderboard() {
  const cfg = getConfig();
  const data = await loadLeaderboardCSV();

  const asc = cfg.leaderboard.sortOrder !== "desc";
  data.sort((a, b) => asc ? a.score - b.score : b.score - a.score);

  _leaderboardCache = data;
  // Don't touch the DOM here — renderLeaderboard() does that
}

function renderLeaderboard() {
  const cfg = getConfig();
  const data = _leaderboardCache;
  if (!data) return;

  const rows  = Math.max(1, Number(cfg.leaderboardRows) || 5);
  const title = cfg.leaderboardTitle || DEFAULT_CONFIG.leaderboardTitle;

  const rowsHtml = data
    .slice(0, rows)
    .map((row, index) => `
      <div class="leaderboard-row" data-rank="${index}">
        <div class="leaderboard-left">
          <div class="leaderboard-name">${row.name}</div>
          <div class="leaderboard-company">${row.company}</div>
        </div>
        <div class="leaderboard-score">${row.score}</div>
      </div>
    `)
    .join("");

  const panel = document.getElementById("leaderboardPanel");
  panel.innerHTML = `<div class="leaderboard-title">${title}</div>` + rowsHtml;
}

/* -------------------------------------------------------
   EVENT INFO PANEL
------------------------------------------------------- */
function updateEventInfoPanel(event) {
  const descEl      = document.getElementById("eventInfoDescription");
  const imgContainer = document.getElementById("eventInfoImageContainer");

  if (!event) {
    descEl.textContent = "";
    imgContainer.innerHTML = "";
    return;
  }

  descEl.innerHTML   = event.description || "";
  imgContainer.innerHTML = event.image
    ? `<img src="${directUrl(event.image, "image")}" alt="">`
    : "";
}

/* -------------------------------------------------------
   LEADERBOARD ANIMATION
------------------------------------------------------- */
function animateLeaderboard() {
  const rows = document.querySelectorAll(".leaderboard-row");
  rows.forEach((row, i) => {
    setTimeout(() => {
      row.style.opacity   = "1";
      row.style.transform = "translateY(0)";
    }, i * 700);
  });
}

function resetLeaderboardAnimation() {
  document.querySelectorAll(".leaderboard-row").forEach(row => {
    row.style.opacity   = "0";
    row.style.transform = "translateY(40px)";
  });
}

/* -------------------------------------------------------
   SETTINGS PANEL
------------------------------------------------------- */
function checkPromoUrl(val) {
  const warn = document.getElementById("cfg-promoWarning");
  const lower = (val || "").toLowerCase().split("?")[0]; // ignore query params when checking extension

  if (val && val.includes("drive.google.com")) {
    warn.style.color = "#f6ad55";
    warn.style.background = "rgba(246,173,85,0.1)";
    warn.style.borderColor = "rgba(246,173,85,0.3)";
    warn.innerHTML = "⚠ Google Drive links don't work for video — Drive doesn't serve files directly to video players. Use <strong>Dropbox</strong> (any share link works, it's converted automatically), <strong>GitHub raw</strong>, or any direct-serve host instead.";
    warn.style.display = "block";
  } else if (lower.endsWith(".mov") || lower.endsWith(".avi") || lower.endsWith(".wmv")) {
    warn.style.color = "#f6ad55";
    warn.style.background = "rgba(246,173,85,0.1)";
    warn.style.borderColor = "rgba(246,173,85,0.3)";
    warn.innerHTML = "⚠ <strong>." + lower.split(".").pop() + "</strong> files only play in Safari. For cross-browser support, convert to <strong>.mp4</strong> first — the codec doesn't need to change, just the container. Use VLC, HandBrake, or: <code>ffmpeg -i input.mov -c copy output.mp4</code>";
    warn.style.display = "block";
  } else if (val && val.includes("dropbox.com")) {
    warn.style.color = "#68d391";
    warn.style.background = "rgba(104,211,145,0.1)";
    warn.style.borderColor = "rgba(104,211,145,0.3)";
    warn.innerHTML = "✓ Dropbox link detected — will be converted to a direct URL automatically.";
    warn.style.display = "block";
  } else {
    warn.style.display = "none";
  }
}

/* -------------------------------------------------------
   COLOR PICKER HELPERS
------------------------------------------------------- */
// Keep the swatch and hex text field in sync with each other
function setColorField(swatchId, hex) {
  const swatch = document.getElementById(swatchId);
  const text   = document.getElementById(swatchId + "Hex");
  if (swatch) swatch.value = hex;
  if (text)   text.value   = hex;
}

function syncSwatchToText(swatchId) {
  const swatch = document.getElementById(swatchId);
  const text   = document.getElementById(swatchId + "Hex");
  if (swatch && text) text.value = swatch.value;
}

function syncTextToSwatch(swatchId) {
  const text   = document.getElementById(swatchId + "Hex");
  const swatch = document.getElementById(swatchId);
  if (text && swatch && /^#[0-9a-fA-F]{6}$/.test(text.value.trim())) {
    swatch.value = text.value.trim();
  }
}

function resetSettings() {
  if (!confirm("Reset all settings to defaults? This cannot be undone.")) return;
  localStorage.removeItem("kioskConfig");
  applyTheme();
  openSettings(); // re-open with default values populated
  showToast("Settings reset to defaults");
}

/* -------------------------------------------------------
   FONT PRESET & PREVIEW HELPERS
------------------------------------------------------- */
// Inject a <link> for a Google Fonts URL into the settings panel so the
// preview renders in the correct font without affecting the display yet.
let _previewLinkEl = null;
function injectPreviewFont(url) {
  if (!_previewLinkEl) {
    _previewLinkEl = document.createElement("link");
    _previewLinkEl.rel = "stylesheet";
    document.head.appendChild(_previewLinkEl);
  }
  if (url && _previewLinkEl.href !== url) _previewLinkEl.href = url;
}

function updateFontPreview() {
  const sel      = document.getElementById("cfg-fontPreset");
  const preview  = document.getElementById("cfg-fontPreviewText");
  const isCustom = sel.value === "custom";

  let family, url;
  if (isCustom) {
    family = document.getElementById("cfg-fontFamily").value.trim() || "Arial, sans-serif";
    url    = document.getElementById("cfg-fontUrl").value.trim();
  } else {
    const opt = sel.options[sel.selectedIndex];
    family = opt.dataset.family || "Arial, sans-serif";
    url    = opt.dataset.url    || "";
  }

  if (url) injectPreviewFont(url);
  preview.style.fontFamily = family;
}

function onCustomFontInput() {
  const url = document.getElementById("cfg-fontUrl").value.trim();
  if (url) injectPreviewFont(url);
  updateFontPreview();
}

function onFontPresetChange() {
  const sel      = document.getElementById("cfg-fontPreset");
  const custom   = document.getElementById("cfg-fontCustom");
  const isCustom = sel.value === "custom";
  custom.style.display = isCustom ? "block" : "none";

  if (!isCustom) {
    const opt = sel.options[sel.selectedIndex];
    document.getElementById("cfg-fontUrl").value    = opt.dataset.url    || "";
    document.getElementById("cfg-fontFamily").value = opt.dataset.family || "";
  }
  updateFontPreview();
}

// Given a stored fontFamily + fontUrl, find the matching preset value or "custom"
function detectFontPreset(family, url) {
  const sel = document.getElementById("cfg-fontPreset");
  for (const opt of sel.options) {
    if (!opt.value || opt.value === "custom") continue;
    if (opt.dataset.family === family) return opt.value;
  }
  // If there's a url/family set but no match, it's custom
  return (family && family !== DEFAULT_CONFIG.display.fontFamily) ? "custom" : "system";
}

function openSettings() {
  const cfg = getConfig();
  const s = cfg.schedule;
  const l = cfg.leaderboard;

  // Populate fields
  document.getElementById("cfg-scheduleUrl").value     = cfg.scheduleUrl    || "";
  document.getElementById("cfg-leaderboardUrl").value  = cfg.leaderboardUrl || "";
  document.getElementById("cfg-promoUrl").value        = cfg.promoUrl       || "";
  checkPromoUrl(cfg.promoUrl || "");
  document.getElementById("cfg-promoInterval").value   = cfg.promoIntervalMinutes != null ? cfg.promoIntervalMinutes : 5;
  document.getElementById("cfg-logoUrl").value         = cfg.logoUrl        || "";
  document.getElementById("cfg-bgImage").value         = cfg.bgImage        || "";
  document.getElementById("cfg-leaderboardRows").value  = cfg.leaderboardRows  != null ? cfg.leaderboardRows  : 5;
  document.getElementById("cfg-leaderboardTitle").value = cfg.leaderboardTitle || "Leaderboard";
  document.getElementById("cfg-scheduleTitle").value    = cfg.scheduleTitle    || "Tulossa tänään:";
  document.getElementById("cfg-upcomingCount").value    = cfg.upcomingCount   != null ? cfg.upcomingCount   : 3;

  // Display / typography
  const d = Object.assign({}, DEFAULT_CONFIG.display, cfg.display || {});
  const preset = detectFontPreset(d.fontFamily, d.fontUrl);
  document.getElementById("cfg-fontPreset").value     = preset;
  document.getElementById("cfg-fontUrl").value        = d.fontUrl       || "";
  document.getElementById("cfg-fontFamily").value     = d.fontFamily    || DEFAULT_CONFIG.display.fontFamily;
  document.getElementById("cfg-fontCustom").style.display = preset === "custom" ? "block" : "none";
  document.getElementById("cfg-eventFirstSize").value        = d.eventFirstSize       != null ? d.eventFirstSize       : DEFAULT_CONFIG.display.eventFirstSize;
  document.getElementById("cfg-eventTitleSize").value        = d.eventTitleSize       != null ? d.eventTitleSize       : DEFAULT_CONFIG.display.eventTitleSize;
  document.getElementById("cfg-eventSpacing").value          = d.eventSpacing         != null ? d.eventSpacing         : DEFAULT_CONFIG.display.eventSpacing;
  document.getElementById("cfg-scheduleMarginLeft").value    = d.scheduleMarginLeft   != null ? d.scheduleMarginLeft   : DEFAULT_CONFIG.display.scheduleMarginLeft;
  document.getElementById("cfg-sidepanelMarginRight").value  = d.sidepanelMarginRight != null ? d.sidepanelMarginRight : DEFAULT_CONFIG.display.sidepanelMarginRight;
  updateFontPreview();

  // Theme colors
  const t = cfg.theme || DEFAULT_CONFIG.theme;
  setColorField("cfg-colorBg",      t.bg      || DEFAULT_CONFIG.theme.bg);
  setColorField("cfg-colorAccent",  t.accent  || DEFAULT_CONFIG.theme.accent);
  setColorField("cfg-colorText",    t.text    || DEFAULT_CONFIG.theme.text);
  setColorField("cfg-colorTextDim", t.textDim || DEFAULT_CONFIG.theme.textDim);

  document.getElementById("cfg-s-time").value        = s.time        || "time";
  document.getElementById("cfg-s-title").value       = s.title       || "title";
  document.getElementById("cfg-s-desc").value        = s.description || "description";
  document.getElementById("cfg-s-image").value       = s.image       || "image";
  document.getElementById("cfg-s-id").value          = s.id          || "id";

  document.getElementById("cfg-l-name").value        = l.name        || "";
  document.getElementById("cfg-l-first").value       = l.firstName   || "first";
  document.getElementById("cfg-l-last").value        = l.lastName    || "last";
  document.getElementById("cfg-l-company").value     = l.company     || "company";
  document.getElementById("cfg-l-score").value       = l.score       || "score";
  document.getElementById("cfg-l-sort").value        = l.sortOrder   || "asc";

  document.getElementById("settingsOverlay").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settingsOverlay").style.display = "none";
}

function saveSettings() {
  const cfg = {
    scheduleUrl:           document.getElementById("cfg-scheduleUrl").value.trim(),
    leaderboardUrl:        document.getElementById("cfg-leaderboardUrl").value.trim(),
    promoUrl:              document.getElementById("cfg-promoUrl").value.trim(),
    promoIntervalMinutes:  Math.max(1, Number(document.getElementById("cfg-promoInterval").value) || 5),
    logoUrl:               document.getElementById("cfg-logoUrl").value.trim(),
    bgImage:               document.getElementById("cfg-bgImage").value.trim(),
    leaderboardRows:       Math.max(1, Number(document.getElementById("cfg-leaderboardRows").value) || 5),
    leaderboardTitle:      document.getElementById("cfg-leaderboardTitle").value.trim() || "Leaderboard",
    scheduleTitle:         document.getElementById("cfg-scheduleTitle").value.trim()    || "Tulossa tänään:",
    upcomingCount:         Math.max(1, Number(document.getElementById("cfg-upcomingCount").value)   || 3),
    display: (() => {
      const sel    = document.getElementById("cfg-fontPreset");
      const preset = sel.value;
      const opt    = sel.options[sel.selectedIndex];
      const isCustom = preset === "custom";
      return {
        fontFamily:     isCustom ? (document.getElementById("cfg-fontFamily").value.trim() || DEFAULT_CONFIG.display.fontFamily)
                                 : (opt.dataset.family || DEFAULT_CONFIG.display.fontFamily),
        fontUrl:        isCustom ? document.getElementById("cfg-fontUrl").value.trim()
                                 : (opt.dataset.url || ""),
        eventFirstSize:       Math.max(12, Number(document.getElementById("cfg-eventFirstSize").value)        || DEFAULT_CONFIG.display.eventFirstSize),
        eventTitleSize:       Math.max(12, Number(document.getElementById("cfg-eventTitleSize").value)        || DEFAULT_CONFIG.display.eventTitleSize),
        eventSpacing:         Math.max(0,  Number(document.getElementById("cfg-eventSpacing").value)          || DEFAULT_CONFIG.display.eventSpacing),
        scheduleMarginLeft:   Math.max(0,  Number(document.getElementById("cfg-scheduleMarginLeft").value)    ?? DEFAULT_CONFIG.display.scheduleMarginLeft),
        sidepanelMarginRight: Math.max(0,  Number(document.getElementById("cfg-sidepanelMarginRight").value)  ?? DEFAULT_CONFIG.display.sidepanelMarginRight),
      };
    })(),
    theme: {
      bg:      document.getElementById("cfg-colorBgHex").value.trim()      || DEFAULT_CONFIG.theme.bg,
      accent:  document.getElementById("cfg-colorAccentHex").value.trim()  || DEFAULT_CONFIG.theme.accent,
      text:    document.getElementById("cfg-colorTextHex").value.trim()    || DEFAULT_CONFIG.theme.text,
      textDim: document.getElementById("cfg-colorTextDimHex").value.trim() || DEFAULT_CONFIG.theme.textDim,
    },
    schedule: {
      time:        document.getElementById("cfg-s-time").value.trim()  || "time",
      title:       document.getElementById("cfg-s-title").value.trim() || "title",
      description: document.getElementById("cfg-s-desc").value.trim()  || "description",
      image:       document.getElementById("cfg-s-image").value.trim() || "image",
      id:          document.getElementById("cfg-s-id").value.trim()    || "id"
    },
    leaderboard: {
      name:      document.getElementById("cfg-l-name").value.trim(),
      firstName: document.getElementById("cfg-l-first").value.trim()   || "first",
      lastName:  document.getElementById("cfg-l-last").value.trim()    || "last",
      company:   document.getElementById("cfg-l-company").value.trim() || "company",
      score:     document.getElementById("cfg-l-score").value.trim()   || "score",
      sortOrder: document.getElementById("cfg-l-sort").value
    }
  };

  saveConfig(cfg);
  closeSettings();

  // Re-apply dynamic settings immediately
  applyTheme();
  applyDisplay();
  applyRibbonLogo();
  applyVideoSrc();
  schedulePromo();
  updateUpcoming(); // rebuilds event slots if count changed

  // Show status toast
  showToast("Settings saved!");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function applyTheme() {
  const cfg = getConfig();
  const t = cfg.theme || DEFAULT_CONFIG.theme;
  const root = document.documentElement;
  root.style.setProperty("--bg",       t.bg      || DEFAULT_CONFIG.theme.bg);
  root.style.setProperty("--accent",   t.accent  || DEFAULT_CONFIG.theme.accent);
  root.style.setProperty("--text",     t.text    || DEFAULT_CONFIG.theme.text);
  root.style.setProperty("--text-dim", t.textDim || DEFAULT_CONFIG.theme.textDim);

  const bg = cfg.bgImage ? directUrl(cfg.bgImage, "image") : "";
  document.body.style.backgroundImage = bg ? `url("${bg}")` : "";
}

function applyDisplay() {
  const cfg = getConfig();
  const d   = Object.assign({}, DEFAULT_CONFIG.display, cfg.display || {});
  const root = document.documentElement;

  // Load Google Font if a URL is given, otherwise use the typed family name
  if (d.fontUrl) {
    let link = document.getElementById("dynamic-font-link");
    if (!link) {
      link = document.createElement("link");
      link.id  = "dynamic-font-link";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== d.fontUrl) link.href = d.fontUrl;
  }

  root.style.setProperty("--font-family",       d.fontFamily    || DEFAULT_CONFIG.display.fontFamily);
  root.style.setProperty("--event-first-size",       (d.eventFirstSize       || DEFAULT_CONFIG.display.eventFirstSize)       + "px");
  root.style.setProperty("--event-title-size",       (d.eventTitleSize       || DEFAULT_CONFIG.display.eventTitleSize)       + "px");
  root.style.setProperty("--event-spacing",          (d.eventSpacing         != null ? d.eventSpacing         : DEFAULT_CONFIG.display.eventSpacing)         + "px");
  root.style.setProperty("--schedule-margin-left",   (d.scheduleMarginLeft   != null ? d.scheduleMarginLeft   : DEFAULT_CONFIG.display.scheduleMarginLeft)   + "%");
  root.style.setProperty("--sidepanel-margin-right", (d.sidepanelMarginRight != null ? d.sidepanelMarginRight : DEFAULT_CONFIG.display.sidepanelMarginRight) + "%");
}

function applyRibbonLogo() {
  const cfg = getConfig();
  const url = directUrl(cfg.logoUrl || "", "image");
  document.querySelectorAll(".ribbon").forEach(el => {
    if (url) {
      el.style.backgroundImage = `url("${url}")`;
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  });
}

function applyVideoSrc() {
  const cfg = getConfig();
  const url = directUrl(cfg.promoUrl || "", "file");
  const video = document.getElementById("promo");
  if (video.getAttribute("src") !== url) {
    video.src = url;
    video.load(); // tell the browser to actually start loading the new source
  }
  console.log("[promo] video src set to:", url || "(none)");
}

let _promoIntervalId = null;

function schedulePromo() {
  const cfg = getConfig();
  if (_promoIntervalId) clearInterval(_promoIntervalId);
  if (!cfg.promoUrl) return;
  const ms = Math.max(1, Number(cfg.promoIntervalMinutes) || 5) * 60 * 1000;
  _promoIntervalId = setInterval(() => playPromo(false), ms);
}

/* -------------------------------------------------------
   MAIN LOOP
------------------------------------------------------- */
function startLoops() {
  applyTheme();
  applyDisplay();
  applyRibbonLogo();
  applyVideoSrc();
  schedulePromo();

  updateUpcoming();
  setInterval(updateUpcoming, 30000); // refresh schedule every 30s

  setInterval(toggleFirstEventSubtitle, 5000);

  updateLeaderboard();
  setInterval(updateLeaderboard, 15000);

  cyclePanels();
  setInterval(cyclePanels, 15000);

  slideEventsIn();
}
