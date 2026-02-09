const terminalScreen = document.getElementById("terminal-screen");
const terminalInput = document.getElementById("terminal-input");
const terminalMessage = document.getElementById("terminal-message");
const mainContent = document.getElementById("main-content");

const state = {
  input: "",
  locked: false,
  entered: false
};

const siteBrandTypingState = {
  timer: null,
  holdMs: 2600
};
let glassPrewarmNode = null;

function ensureGlassPrewarm() {
  if (glassPrewarmNode || !document.body) return;
  const node = document.createElement("div");
  node.className = "glass-prewarm";
  node.setAttribute("aria-hidden", "true");
  document.body.appendChild(node);
  glassPrewarmNode = node;
}

function clearGlassPrewarm() {
  if (!glassPrewarmNode) return;
  glassPrewarmNode.remove();
  glassPrewarmNode = null;
}

function stopSiteBrandTyping() {
  if (siteBrandTypingState.timer) {
    clearTimeout(siteBrandTypingState.timer);
    siteBrandTypingState.timer = null;
  }
}

function ensureSiteBrandTypingNodes(element) {
  let typed = element.querySelector(".site-brand-typed");
  let cursor = element.querySelector(".site-brand-cursor");

  if (!typed || !cursor) {
    element.textContent = "";
    typed = document.createElement("span");
    typed.className = "site-brand-typed";
    cursor = document.createElement("span");
    cursor.className = "site-brand-cursor blink";
    cursor.textContent = "_";
    element.appendChild(typed);
    element.appendChild(cursor);
  }

  return { typed, cursor };
}

function normalizeBannerTexts(banners, fallbackText) {
  const source = Array.isArray(banners) ? banners : [banners];
  const normalized = source
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (normalized.length) {
    return normalized;
  }

  const fallback = String(fallbackText || "").trim();
  return fallback ? [fallback] : [];
}

function startSiteBrandTyping(element, texts) {
  if (!element) return;
  stopSiteBrandTyping();

  const contents = normalizeBannerTexts(texts, "");
  const nodes = ensureSiteBrandTypingNodes(element);
  if (!contents.length) {
    nodes.typed.textContent = "";
    return;
  }

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.typed.textContent = contents[0];
    nodes.cursor.classList.remove("blink");
    return;
  }
  nodes.cursor.classList.add("blink");

  const typingSpeedMs = 100;
  const holdMs = normalizeNonNegativeNumber(siteBrandTypingState.holdMs, 2600);
  const restartGapMs = 350;
  let bannerIndex = 0;
  let charIndex = 0;

  const step = () => {
    const content = contents[bannerIndex];
    if (charIndex <= content.length) {
      nodes.typed.textContent = content.slice(0, charIndex);
      charIndex += 1;
      siteBrandTypingState.timer = setTimeout(step, typingSpeedMs);
      return;
    }

    siteBrandTypingState.timer = setTimeout(() => {
      nodes.typed.textContent = "";
      charIndex = 0;
      bannerIndex = (bannerIndex + 1) % contents.length;
      siteBrandTypingState.timer = setTimeout(step, restartGapMs);
    }, holdMs);
  };

  step();
}

function resetTerminal() {
  state.input = "";
  terminalInput.textContent = "";
  terminalMessage.textContent = "";
}

function enterMain() {
  if (state.entered) return;
  state.entered = true;
  requestAnimationFrame(() => {
    mainContent.classList.add("visible");
    if (terminalScreen) {
      terminalScreen.classList.add("hidden");
    }
    setTimeout(clearGlassPrewarm, 420);
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

async function showTerminalInputResponse(normalizedInput) {
  if (state.locked) return;
  state.locked = true;

  let matchedEgg = false;
  if (window.EggFeature && typeof window.EggFeature.showForKeyword === "function") {
    try {
      matchedEgg = await window.EggFeature.showForKeyword(normalizedInput, { container: terminalMessage });
    } catch (error) {
      console.error("EggFeature trigger failed.", error);
    }
  }

  if (!matchedEgg) {
    terminalMessage.innerHTML = "<div>Hello world!</div><div>bye bye</div>";
    await wait(2200);
  }

  state.locked = false;
  resetTerminal();
}

function handleTerminalKey(event) {
  if (state.entered || state.locked) return;

  const key = event.key;

  if (key === "Enter") {
    const normalizedInput = state.input.trim().toLowerCase();
    if (normalizedInput === "" || normalizedInput === "y") {
      enterMain();
    } else {
      showTerminalInputResponse(normalizedInput);
    }
    return;
  }

  if (key === "Backspace") {
    state.input = state.input.slice(0, -1);
    terminalInput.textContent = state.input;
    return;
  }

  if (key === "Escape") {
    state.input = "";
    terminalInput.textContent = "";
    return;
  }

  if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    state.input += key;
    terminalInput.textContent = state.input;
  }
}

function handleTerminalPointer(event) {
  if (state.entered || state.locked) return;
  if (event && event.pointerType && event.pointerType !== "touch" && event.pointerType !== "pen") {
    return;
  }
  enterMain();
}

async function loadConfig() {
  const response = await fetch("config/main.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load config/main.json");
  }
  return response.json();
}

async function loadSettings() {
  try {
    const response = await fetch("config/settings.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load config/settings.json");
    }
    return response.json();
  } catch (error) {
    console.warn("Using default settings.", error);
    return {};
  }
}

function normalizeNonNegativeNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function normalizePositiveInteger(value, fallback, maxValue) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maxValue || parsed);
}

function toCssUrl(url) {
  return `url("${String(url).replace(/"/g, "\\\"")}")`;
}

function applySettings(settings) {
  const rootStyle = document.documentElement.style;
  const background = settings && settings.background ? settings.background : {};
  const banner = settings && settings.banner ? settings.banner : {};
  const glass = settings && settings.glass ? settings.glass : {};
  const career = settings && settings.career ? settings.career : {};
  const news = settings && settings.news ? settings.news : {};
  const openserver = settings && settings.openserver ? settings.openserver : {};
  const ui = settings && settings.ui ? settings.ui : {};

  if (background.blur_px !== undefined) {
    const blurPx = normalizeNonNegativeNumber(background.blur_px, 0);
    rootStyle.setProperty("--bg-blur", `${blurPx}px`);
  }

  if (typeof background.overlay_color === "string" && background.overlay_color.trim()) {
    rootStyle.setProperty("--bg-overlay", background.overlay_color.trim());
  }

  if (glass.blur_px !== undefined) {
    const blurPx = normalizeNonNegativeNumber(glass.blur_px, 18);
    rootStyle.setProperty("--glass-blur", `${blurPx}px`);
  }

  if (career.logo_height_px !== undefined) {
    const height = Math.max(12, normalizeNonNegativeNumber(career.logo_height_px, 22));
    rootStyle.setProperty("--career-logo-height", `${height}px`);
  }

  if (career.logo_max_width_px !== undefined) {
    const width = Math.max(20, normalizeNonNegativeNumber(career.logo_max_width_px, 88));
    rootStyle.setProperty("--career-logo-max-width", `${width}px`);
  }

  if (news.default_show_count !== undefined) {
    const count = normalizePositiveInteger(news.default_show_count, 5, 100);
    rootStyle.setProperty("--news-visible-count", String(count));
  }

  if (news.item_min_height_px !== undefined) {
    const height = Math.max(48, normalizeNonNegativeNumber(news.item_min_height_px, 64));
    rootStyle.setProperty("--news-item-min-height", `${height}px`);
  }

  if (openserver.logo_height_px !== undefined) {
    const height = Math.max(12, normalizeNonNegativeNumber(openserver.logo_height_px, 22));
    rootStyle.setProperty("--openserver-logo-height", `${height}px`);
  }

  if (openserver.logo_max_width_px !== undefined) {
    const width = Math.max(20, normalizeNonNegativeNumber(openserver.logo_max_width_px, 88));
    rootStyle.setProperty("--openserver-logo-max-width", `${width}px`);
  }

  if (openserver.columns !== undefined) {
    const columns = normalizePositiveInteger(openserver.columns, 2, 6);
    rootStyle.setProperty("--openserver-columns", String(columns));
  }

  if (ui.top_action_button_height_px !== undefined) {
    const height = Math.max(24, normalizeNonNegativeNumber(ui.top_action_button_height_px, 32));
    rootStyle.setProperty("--top-action-btn-height", `${height}px`);
  }

  if (banner.hold_ms !== undefined) {
    siteBrandTypingState.holdMs = normalizeNonNegativeNumber(banner.hold_ms, 2600);
  }
}

function applyBackground(config) {
  const local = (config.background_img_local || "").trim();
  const api = (config.background_img_api || "").trim();
  const rootStyle = document.documentElement.style;

  if (local) {
    rootStyle.setProperty("--bg-image", toCssUrl(local));
    return;
  }

  if (api) {
    rootStyle.setProperty("--bg-image", toCssUrl(api));
  }
}

function renderProfile(info, banners) {
  const profile = info || {};
  const brand = document.getElementById("site-brand");
  const avatar = document.getElementById("avatar-img");
  const name = document.getElementById("profile-name");
  const signature = document.getElementById("profile-signature");
  const linksWrap = document.getElementById("link-buttons");
  const tagsWrap = document.getElementById("profile-tags");
  const contactsWrap = document.getElementById("profile-contacts");
  const addressesWrap = document.getElementById("profile-addresses");
  const fallbackName = profile.nickname || profile.name || "Personal Page";
  const bannerTexts = normalizeBannerTexts(banners, fallbackName);

  startSiteBrandTyping(brand, bannerTexts);
  name.textContent = fallbackName;
  signature.textContent = profile.signature || "";
  if (profile.avatar) {
    avatar.src = profile.avatar;
  }

  linksWrap.innerHTML = "";
  const links = profile.links || {};
  const iconMap = {
    github: "fa-brands fa-github",
    bilibili: "fa-brands fa-bilibili",
    google_scholar: "fa-solid fa-graduation-cap",
    csdn: {
      type: "image",
      src: "https://cdn.simpleicons.org/csdn/FC5531",
      fallbackClass: "fa-solid fa-link"
    },
    orcid: "fa-brands fa-orcid",
    huggingface: {
      type: "image",
      src: "https://cdn.simpleicons.org/huggingface/FFD21E",
      fallbackClass: "fa-solid fa-link"
    }
  };

  Object.entries(links).forEach(([key, meta]) => {
    if (!meta || !meta.url) return;
    const anchor = document.createElement("a");
    anchor.className = "icon-btn";
    anchor.classList.add(`icon-btn--${key.replace(/_/g, "-")}`);
    anchor.href = meta.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    const iconMeta = iconMap[key];
    if (iconMeta && typeof iconMeta === "object" && iconMeta.type === "image" && iconMeta.src) {
      const iconImg = document.createElement("img");
      iconImg.className = "icon-btn-icon";
      iconImg.src = iconMeta.src;
      iconImg.alt = "";
      iconImg.setAttribute("aria-hidden", "true");
      iconImg.loading = "lazy";
      iconImg.decoding = "async";
      iconImg.addEventListener("error", () => {
        const fallbackIcon = document.createElement("i");
        fallbackIcon.className = iconMeta.fallbackClass || "fa-solid fa-link";
        anchor.insertBefore(fallbackIcon, anchor.firstChild || null);
        iconImg.remove();
      });
      anchor.appendChild(iconImg);
    } else {
      const icon = document.createElement("i");
      icon.className = typeof iconMeta === "string" ? iconMeta : "fa-solid fa-link";
      anchor.appendChild(icon);
    }
    const label = document.createElement("span");
    label.textContent = meta.label || key;
    anchor.appendChild(label);
    linksWrap.appendChild(anchor);
  });

  tagsWrap.innerHTML = "";
  const tags = profile.tags || [];
  tags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    tagsWrap.appendChild(span);
  });

  function renderProfileList(target, values, placeholderText, isContact) {
    if (!target) return;
    target.innerHTML = "";

    const source = Array.isArray(values) ? values : [];
    let visibleCount = 0;

    source.forEach((entry) => {
      let text = "";
      let href = "";

      if (typeof entry === "string") {
        text = cleanText(entry);
      } else if (entry && typeof entry === "object") {
        text = cleanText(entry.value || entry.text || entry.label || "");
        href = cleanText(entry.url || "");
      }

      if (!text) return;
      if (!href && isContact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        href = `mailto:${text}`;
      }

      const li = document.createElement("li");
      if (href) {
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.target = href.startsWith("mailto:") ? "_self" : "_blank";
        anchor.rel = href.startsWith("mailto:") ? "" : "noreferrer";
        anchor.textContent = text;
        li.appendChild(anchor);
      } else {
        li.textContent = text;
      }
      target.appendChild(li);
      visibleCount += 1;
    });

    if (visibleCount === 0) {
      const li = document.createElement("li");
      li.className = "profile-extra-placeholder";
      li.textContent = placeholderText;
      target.appendChild(li);
    }
  }

  function renderMapLink(target, url, label, provider, providerClassName) {
    const href = cleanText(url);
    if (!href) return;

    const link = document.createElement("a");
    link.className = "profile-map-link";
    if (providerClassName) {
      link.classList.add(providerClassName);
    }
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", label);
    link.title = label;

    const icon = document.createElement("img");
    icon.className = "profile-map-icon";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    icon.loading = "lazy";
    icon.decoding = "async";
    if (provider === "baidu") {
      icon.src = "https://cdn.simpleicons.org/baidu/84d5ff";
    } else {
      icon.src = "https://cdn.simpleicons.org/google/9ee8b8";
    }
    icon.addEventListener("error", () => {
      const fallback = document.createElement("i");
      fallback.className = provider === "baidu" ? "fa-solid fa-map-location-dot" : "fa-brands fa-google";
      fallback.setAttribute("aria-hidden", "true");
      link.innerHTML = "";
      link.appendChild(fallback);
    });
    link.appendChild(icon);
    target.appendChild(link);
  }

  function renderAddressList(target, values, placeholderText) {
    if (!target) return;
    target.innerHTML = "";

    let visibleCount = 0;

    function appendAddressItem(text, mapMeta) {
      const addressText = cleanText(text);
      if (!addressText) return;

      const li = document.createElement("li");
      li.className = "profile-address-item";

      const textNode = document.createElement("span");
      textNode.className = "profile-address-text";
      textNode.textContent = addressText;
      li.appendChild(textNode);

      const maps = mapMeta && typeof mapMeta === "object" ? mapMeta : {};
      const baiduUrl = cleanText(maps.baidu);
      const googleUrl = cleanText(maps.google);
      if (baiduUrl || googleUrl) {
        const mapLinks = document.createElement("span");
        mapLinks.className = "profile-address-maps";
        renderMapLink(
          mapLinks,
          baiduUrl,
          `Open Baidu Map for ${addressText}`,
          "baidu",
          "profile-map-link--baidu"
        );
        renderMapLink(
          mapLinks,
          googleUrl,
          `Open Google Map for ${addressText}`,
          "google",
          "profile-map-link--google"
        );
        li.appendChild(mapLinks);
      }

      target.appendChild(li);
      visibleCount += 1;
    }

    if (Array.isArray(values)) {
      values.forEach((entry) => {
        if (typeof entry === "string") {
          appendAddressItem(entry, {});
          return;
        }
        if (!entry || typeof entry !== "object") {
          return;
        }

        const text = cleanText(entry.address || entry.value || entry.text || entry.label || "");
        const mapMeta =
          entry.maps && typeof entry.maps === "object"
            ? { baidu: entry.maps.baidu, google: entry.maps.google }
            : { baidu: entry.baidu, google: entry.google };
        appendAddressItem(text, mapMeta);
      });
    } else if (values && typeof values === "object") {
      Object.entries(values).forEach(([addressText, mapMeta]) => {
        appendAddressItem(addressText, mapMeta);
      });
    }

    if (visibleCount === 0) {
      const li = document.createElement("li");
      li.className = "profile-extra-placeholder";
      li.textContent = placeholderText;
      target.appendChild(li);
    }
  }

  renderProfileList(contactsWrap, profile.contacts, "Not set yet / 待填写", true);
  renderAddressList(addressesWrap, profile.addresses || profile.address, "Not set yet / 待填写");
}

function renderCareer(career) {
  const list = document.getElementById("career-list");
  list.innerHTML = "";

  const entries = Array.isArray(career)
    ? career
        .filter((item) => item && typeof item === "object")
      .map((item) => ({
        year: item.year || "",
        organization: item.organization || "",
        department: item.department || "",
        city: item.city || "",
        role: item.role || "",
        org_logo: item.org_logo || "",
        org_link: item.org_link || "",
        group_link: item.group_link || item.link || ""
      }))
    : Object.entries(career || {}).map(([year, detail]) => ({
        year,
        organization: (detail && detail.organization) || "",
        department: (detail && detail.department) || "",
        city: (detail && detail.city) || "",
        role: (detail && detail.role) || "",
        org_logo: (detail && detail.org_logo) || "",
        org_link: (detail && detail.org_link) || "",
        group_link: (detail && (detail.group_link || detail.link)) || ""
      }));

  entries.sort((a, b) => {
    const ay = parseInt((a.year || "").split("-")[0], 10) || 0;
    const by = parseInt((b.year || "").split("-")[0], 10) || 0;
    return by - ay;
  });

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "placeholder-item";
    empty.textContent = "Career timeline coming soon.";
    list.appendChild(empty);
    return;
  }

  entries.forEach((detail) => {
    const item = document.createElement("div");
    item.className = "career-item";

    const yearEl = document.createElement("div");
    yearEl.className = "career-year";
    yearEl.textContent = detail.year;

    const detailEl = document.createElement("div");
    detailEl.className = "career-detail";

    const orgEl = document.createElement("div");
    orgEl.className = "career-org";

    const orgNameEl = document.createElement("div");
    orgNameEl.className = "career-org-name";
    orgNameEl.textContent = detail.organization || "";
    orgEl.appendChild(orgNameEl);

    const subEl = document.createElement("div");
    subEl.className = "career-role";
    subEl.textContent = detail.role || "";

    const metaParts = [detail.department, detail.city].filter((part) => cleanText(part));
    const metaEl = document.createElement("div");
    metaEl.className = "career-meta";
    metaEl.textContent = metaParts.join(" | ");

    detailEl.appendChild(orgEl);
    if (metaParts.length) {
      detailEl.appendChild(metaEl);
    }
    detailEl.appendChild(subEl);

    item.appendChild(yearEl);
    item.appendChild(detailEl);

    const sideEl = document.createElement("div");
    sideEl.className = "career-side";

    if (detail.org_logo) {
      const logoShell = detail.org_link ? document.createElement("a") : document.createElement("div");
      logoShell.className = "career-logo-shell";
      if (detail.org_link) {
        logoShell.classList.add("career-logo-shell-link");
        logoShell.href = detail.org_link;
        logoShell.target = "_blank";
        logoShell.rel = "noreferrer";
        logoShell.setAttribute("aria-label", `Open ${detail.organization || "organization"} website`);
      }
      const logoEl = document.createElement("img");
      logoEl.className = "career-org-logo";
      logoEl.src = detail.org_logo;
      logoEl.alt = `${detail.organization || "Organization"} logo`;
      logoEl.loading = "lazy";
      logoEl.decoding = "async";
      logoShell.appendChild(logoEl);
      sideEl.appendChild(logoShell);
    }

    if (detail.group_link) {
      const link = document.createElement("a");
      link.className = "career-link";
      link.href = detail.group_link;
      link.target = "_blank";
      link.rel = "noreferrer";
      const text = document.createElement("span");
      text.className = "career-link-text";
      text.textContent = "Group page";
      link.appendChild(text);
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-arrow-up-right-from-square";
      link.appendChild(icon);
      sideEl.appendChild(link);
    }

    if (sideEl.childElementCount > 0) {
      item.appendChild(sideEl);
    }

    list.appendChild(item);
  });
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeFooterLines(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function renderFooter(linesInput) {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  const lines = normalizeFooterLines(linesInput);
  footer.innerHTML = "";
  if (!lines.length) {
    footer.hidden = true;
    return;
  }

  lines.forEach((line) => {
    const row = document.createElement("p");
    row.className = "site-footer-line";
    row.textContent = line;
    footer.appendChild(row);
  });
  footer.hidden = false;
}

async function init() {
  document.addEventListener("keydown", handleTerminalKey);
  ensureGlassPrewarm();
  if (terminalScreen) {
    terminalScreen.addEventListener("pointerdown", handleTerminalPointer);
    terminalScreen.addEventListener("touchstart", handleTerminalPointer, { passive: true });
  }
  if (window.EggFeature && typeof window.EggFeature.preload === "function") {
    window.EggFeature.preload().catch((error) => {
      console.error("EggFeature preload failed.", error);
    });
  }

  try {
    const [config, settings] = await Promise.all([loadConfig(), loadSettings()]);
    applySettings(settings);
    if (window.EggFeature && typeof window.EggFeature.applySettings === "function") {
      window.EggFeature.applySettings(settings);
    }
    applyBackground(config);
    renderProfile(config.personal_info, config.banner || config.site_brand);
    renderCareer(config.career);
    if (window.InfoFeature && typeof window.InfoFeature.initIndexPage === "function") {
      try {
        await window.InfoFeature.initIndexPage({
          settings,
          fallbackCatalog: { openserver: config.openserver || {} }
        });
      } catch (infoError) {
        console.error("Failed to initialize info module.", infoError);
      }
    }
    renderFooter(config.foot || config.footer);
    if (window.ProjectFeature && typeof window.ProjectFeature.initIndexPage === "function") {
      try {
        await window.ProjectFeature.initIndexPage({ settings });
      } catch (projectError) {
        console.error("Failed to initialize projects module.", projectError);
      }
    }
    if (window.PublicationFeature && typeof window.PublicationFeature.initIndexPage === "function") {
      try {
        await window.PublicationFeature.initIndexPage({
          settings,
          fallbackCatalog: { publications: config.publications || [] }
        });
      } catch (publicationError) {
        console.error("Failed to initialize publications module.", publicationError);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

init();
