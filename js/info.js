(function () {
  "use strict";

  const DEFAULT_INFO_SETTINGS = {
    newsDefaultLang: "zh",
    newsVisibleCount: 5,
    newsItemMinHeight: 64
  };

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizePositiveInteger(value, fallback, maxValue) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, maxValue || parsed);
  }

  function normalizeNonNegativeNumber(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  }

  function normalizeLang(value, fallback) {
    const lang = cleanText(value).toLowerCase();
    if (lang === "en" || lang === "zh") return lang;
    return fallback;
  }

  function normalizeNewsLink(value) {
    const link = cleanText(value);
    if (!link) return "";
    if (/^https?:\/\//i.test(link)) return link;
    if (/^mailto:/i.test(link)) return link;
    if (/^(\/|\.\/|\.\.\/)/.test(link)) return link;
    return "";
  }

  function resolveAssetPath(path) {
    const raw = cleanText(path);
    if (!raw) return "";
    if (/^(https?:)?\/\//i.test(raw)) return raw;
    if (/^data:/i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    return raw.replace(/^\.\//, "");
  }

  async function loadNewsCatalog() {
    try {
      const response = await fetch("config/news.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load config/news.json");
      }
      return response.json();
    } catch (error) {
      console.warn("InfoFeature: using empty news list.", error);
      return [];
    }
  }

  function normalizeNewsEntries(raw) {
    const source = Array.isArray(raw) ? raw : Array.isArray(raw && raw.news) ? raw.news : [];

    const entries = source
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        const year = parseInt(item.year, 10);
        const month = parseInt(item.month, 10);
        const day = parseInt(item.day, 10);
        const shortEn = cleanText(item.short_en);
        const shortZh = cleanText(item.short_zh);
        const link = normalizeNewsLink(item.link || item.href || item.url);

        if (!Number.isFinite(year) || year < 0) return null;
        if (!Number.isFinite(month) || month < 1 || month > 12) return null;
        if (!Number.isFinite(day) || day < 1 || day > 31) return null;
        if (!shortEn && !shortZh) return null;

        return {
          year,
          month,
          day,
          short_en: shortEn,
          short_zh: shortZh,
          link
        };
      })
      .filter(Boolean);

    entries.sort((a, b) => {
      const aDate = Date.UTC(a.year, a.month - 1, a.day);
      const bDate = Date.UTC(b.year, b.month - 1, b.day);
      return bDate - aDate;
    });

    return entries;
  }

  function normalizeOpenServerEntries(raw) {
    if (!raw || typeof raw !== "object") return [];

    return Object.entries(raw)
      .map(([key, value]) => {
        if (!value || typeof value !== "object") return null;
        const name = cleanText(value.name) || cleanText(key);
        const logo = resolveAssetPath(value.logo);
        const link = cleanText(value.link);
        const intro = cleanText(value.intro);
        if (!name) return null;
        return {
          key: cleanText(key),
          name,
          logo,
          link,
          intro
        };
      })
      .filter(Boolean);
  }

  function formatDate(entry) {
    const yyyy = String(entry.year).padStart(4, "0");
    const mm = String(entry.month).padStart(2, "0");
    const dd = String(entry.day).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
  }

  function getNewsShort(entry, lang) {
    if (!entry) return "";
    if (lang === "zh") return entry.short_zh || entry.short_en || "";
    return entry.short_en || entry.short_zh || "";
  }

  function createLanguageToggle(container, lang, onChange) {
    if (!container) return;
    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "projects-lang-toggle glass";

    const enButton = document.createElement("button");
    enButton.type = "button";
    enButton.textContent = "English";
    enButton.classList.toggle("is-active", lang === "en");
    enButton.addEventListener("click", () => onChange("en"));

    const zhButton = document.createElement("button");
    zhButton.type = "button";
    zhButton.textContent = "\u4E2D\u6587";
    zhButton.classList.toggle("is-active", lang === "zh");
    zhButton.addEventListener("click", () => onChange("zh"));

    wrap.appendChild(enButton);
    wrap.appendChild(zhButton);
    container.appendChild(wrap);
  }

  function renderNews(newsEntries, lang) {
    const list = document.getElementById("news-list");
    if (!list) return;
    list.innerHTML = "";

    if (!newsEntries.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "No news loaded yet.";
      list.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    newsEntries.forEach((entry) => {
      const isClickable = Boolean(entry.link);
      const item = isClickable ? document.createElement("a") : document.createElement("article");
      item.className = isClickable ? "news-item news-item-link" : "news-item";
      if (isClickable) {
        item.href = entry.link;
        if (/^mailto:/i.test(entry.link) || /^(\/|\.\/|\.\.\/)/.test(entry.link)) {
          item.target = "_self";
          item.rel = "";
        } else {
          item.target = "_blank";
          item.rel = "noreferrer";
        }
        item.setAttribute("aria-label", `Open news: ${getNewsShort(entry, lang)}`);
      }

      const date = document.createElement("div");
      date.className = "news-item-date";
      date.textContent = formatDate(entry);

      const short = document.createElement("div");
      short.className = "news-item-short";
      short.textContent = getNewsShort(entry, lang);

      item.appendChild(date);
      item.appendChild(short);
      if (isClickable) {
        const dot = document.createElement("span");
        dot.className = "news-item-link-dot";
        dot.setAttribute("aria-hidden", "true");
        item.appendChild(dot);
      }
      fragment.appendChild(item);
    });

    list.appendChild(fragment);
  }

  function renderOpenServers(servers) {
    const list = document.getElementById("openserver-list");
    if (!list) return;
    list.innerHTML = "";

    if (!servers.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "No open server configured yet.";
      list.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    servers.forEach((server) => {
      const isClickable = Boolean(server.link);
      const item = isClickable ? document.createElement("a") : document.createElement("article");
      item.className = isClickable ? "openserver-item openserver-item-link" : "openserver-item";
      if (isClickable) {
        item.href = server.link;
        item.target = "_blank";
        item.rel = "noreferrer";
        item.setAttribute("aria-label", `Open ${server.name}`);
      }

      if (server.logo) {
        const logoShell = document.createElement("div");
        logoShell.className = "openserver-logo-box";
        const logo = document.createElement("img");
        logo.className = "openserver-logo";
        logo.src = server.logo;
        logo.alt = `${server.name} logo`;
        logo.loading = "lazy";
        logo.decoding = "async";
        logoShell.appendChild(logo);
        item.appendChild(logoShell);
      }

      const textWrap = document.createElement("div");
      textWrap.className = "openserver-text";

      const nameNode = document.createElement("div");
      nameNode.className = "openserver-name";
      const nameText = document.createElement("span");
      nameText.textContent = server.name;
      nameNode.appendChild(nameText);
      textWrap.appendChild(nameNode);

      if (server.intro) {
        const introNode = document.createElement("div");
        introNode.className = "openserver-intro";
        introNode.textContent = server.intro;
        textWrap.appendChild(introNode);
      }

      item.appendChild(textWrap);

      fragment.appendChild(item);
    });
    list.appendChild(fragment);
  }

  function applyInfoSettings(settings) {
    const rootStyle = document.documentElement.style;
    const news = settings && settings.news ? settings.news : {};

    if (news.default_show_count !== undefined) {
      const count = normalizePositiveInteger(news.default_show_count, DEFAULT_INFO_SETTINGS.newsVisibleCount, 100);
      rootStyle.setProperty("--news-visible-count", String(count));
    }

    if (news.item_min_height_px !== undefined) {
      const height = Math.max(48, normalizeNonNegativeNumber(news.item_min_height_px, DEFAULT_INFO_SETTINGS.newsItemMinHeight));
      rootStyle.setProperty("--news-item-min-height", `${height}px`);
    }
  }

  async function initIndexPage(options) {
    const settings = (options && options.settings) || {};
    const fallbackCatalog = (options && options.fallbackCatalog) || {};
    const newsSettings = settings && settings.news ? settings.news : {};
    let lang = normalizeLang(newsSettings.default_lang, DEFAULT_INFO_SETTINGS.newsDefaultLang);
    applyInfoSettings(settings);

    const [newsRaw] = await Promise.all([loadNewsCatalog()]);
    const newsEntries = normalizeNewsEntries(newsRaw);
    const openServers = normalizeOpenServerEntries(fallbackCatalog.openserver || {});

    const toggleHost = document.getElementById("news-lang-toggle");
    function setLang(nextLang) {
      const normalized = normalizeLang(nextLang, lang);
      if (normalized === lang) return;
      lang = normalized;
      createLanguageToggle(toggleHost, lang, setLang);
      renderNews(newsEntries, lang);
    }

    createLanguageToggle(toggleHost, lang, setLang);
    renderNews(newsEntries, lang);
    renderOpenServers(openServers);
  }

  window.InfoFeature = {
    initIndexPage
  };
})();
