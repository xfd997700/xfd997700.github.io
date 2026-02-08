(function () {
  "use strict";

  const state = {
    readyPromise: null,
    keywordMap: new Map(),
    displayMs: 2500
  };

  function normalizeNumber(value, fallback, minValue, maxValue) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const min = Number.isFinite(minValue) ? minValue : parsed;
    const max = Number.isFinite(maxValue) ? maxValue : parsed;
    return Math.min(Math.max(parsed, min), max);
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeKeyword(value) {
    return cleanText(value).toLowerCase();
  }

  function normalizeEggEntries(raw) {
    const source = Array.isArray(raw) ? raw : raw && Array.isArray(raw.eggs) ? raw.eggs : [];
    return source
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const keywords = Array.isArray(entry.keyword)
          ? entry.keyword.map((keyword) => normalizeKeyword(keyword)).filter(Boolean)
          : [];
        const pics = Array.isArray(entry.pics) ? entry.pics.map((pic) => cleanText(pic)).filter(Boolean) : [];
        if (!keywords.length || !pics.length) return null;
        return { keywords, pics };
      })
      .filter(Boolean);
  }

  function buildKeywordMap(entries) {
    const map = new Map();
    entries.forEach((entry) => {
      entry.keywords.forEach((keyword) => {
        if (!map.has(keyword)) {
          map.set(keyword, []);
        }
        const target = map.get(keyword);
        entry.pics.forEach((pic) => {
          if (!target.includes(pic)) {
            target.push(pic);
          }
        });
      });
    });
    return map;
  }

  function applySettings(settings) {
    const eggSettings = settings && settings.eggs && typeof settings.eggs === "object" ? settings.eggs : {};
    const rootStyle = document.documentElement.style;
    const displaySeconds = Number(eggSettings.display_seconds);
    if (Number.isFinite(displaySeconds) && displaySeconds > 0) {
      state.displayMs = Math.max(200, Math.round(displaySeconds * 1000));
    }

    if (eggSettings.image_height_px !== undefined) {
      const imageHeightPx = Math.round(normalizeNumber(eggSettings.image_height_px, 120, 40, 720));
      rootStyle.setProperty("--egg-image-height", `${imageHeightPx}px`);
    }

    if (eggSettings.item_min_width_px !== undefined) {
      const itemMinWidthPx = Math.round(normalizeNumber(eggSettings.item_min_width_px, 160, 80, 640));
      rootStyle.setProperty("--egg-item-min-width", `${itemMinWidthPx}px`);
    }

    if (eggSettings.grid_max_width_px !== undefined) {
      const gridMaxWidthPx = Math.round(normalizeNumber(eggSettings.grid_max_width_px, 900, 240, 2400));
      rootStyle.setProperty("--egg-grid-max-width", `${gridMaxWidthPx}px`);
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch("config/settings.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load config/settings.json");
      }
      const settings = await response.json();
      applySettings(settings);
    } catch (error) {
      console.warn("EggFeature: using default display duration.", error);
    }
  }

  async function loadEggCatalog() {
    try {
      const response = await fetch("config/pic_eggs.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load config/pic_eggs.json");
      }
      return response.json();
    } catch (error) {
      console.warn("EggFeature: no picture eggs loaded.", error);
      return [];
    }
  }

  async function preload() {
    if (!state.readyPromise) {
      state.readyPromise = (async () => {
        const [_, rawCatalog] = await Promise.all([loadSettings(), loadEggCatalog()]);
        const entries = normalizeEggEntries(rawCatalog);
        state.keywordMap = buildKeywordMap(entries);
      })().catch((error) => {
        console.error("EggFeature: preload failed.", error);
        state.keywordMap = new Map();
      });
    }
    return state.readyPromise;
  }

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, ms));
    });
  }

  function renderEggContent(keyword, pics) {
    const wrap = document.createElement("div");
    wrap.className = "terminal-egg-wrap";

    const label = document.createElement("div");
    label.className = "terminal-egg-label";
    label.textContent = `egg: ${keyword}`;
    wrap.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "terminal-egg-grid";
    pics.forEach((pic, index) => {
      const item = document.createElement("div");
      item.className = "terminal-egg-item";
      item.style.animationDelay = `${Math.min(index * 0.05, 0.3)}s`;

      const img = document.createElement("img");
      img.src = pic;
      img.alt = `egg picture ${index + 1}`;
      img.loading = "lazy";
      img.decoding = "async";
      item.appendChild(img);
      grid.appendChild(item);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  async function showForKeyword(keyword, options) {
    await preload();
    const normalized = normalizeKeyword(keyword);
    if (!normalized) return false;

    const pics = state.keywordMap.get(normalized);
    if (!pics || !pics.length) return false;

    const container = options && options.container;
    if (!container) return false;

    container.innerHTML = "";
    container.appendChild(renderEggContent(normalized, pics));
    await wait(state.displayMs);
    return true;
  }

  window.EggFeature = {
    preload,
    applySettings,
    showForKeyword
  };
})();
