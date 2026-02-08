const terminalScreen = document.getElementById("terminal-screen");
const terminalInput = document.getElementById("terminal-input");
const terminalMessage = document.getElementById("terminal-message");
const mainContent = document.getElementById("main-content");
const publicationsSortButton = document.getElementById("publications-sort-btn");
const graphAbsModal = document.getElementById("graph-abs-modal");
const graphAbsModalImage = document.getElementById("graph-abs-modal-img");
const graphAbsModalCloseButton = document.getElementById("graph-abs-modal-close");

const state = {
  input: "",
  locked: false,
  entered: false
};

const publicationState = {
  items: [],
  sortMode: "default",
  authorHighlightKeywords: ["Fanding Xu", "徐凡丁"]
};

const siteBrandTypingState = {
  timer: null,
  holdMs: 2600
};

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
  terminalScreen.classList.add("hidden");
  mainContent.classList.add("visible");
}

function showEasterEgg() {
  if (state.locked) return;
  state.locked = true;
  terminalMessage.innerHTML = "<div>Hello world!</div><div>bye bye</div>";
  setTimeout(() => {
    state.locked = false;
    resetTerminal();
  }, 2200);
}

function handleTerminalKey(event) {
  if (state.entered || state.locked) return;

  const key = event.key;

  if (key === "Enter") {
    const normalizedInput = state.input.trim().toLowerCase();
    if (normalizedInput === "" || normalizedInput === "y") {
      enterMain();
    } else {
      showEasterEgg();
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

async function loadPublicationsCatalog() {
  try {
    const response = await fetch("config/publications.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load config/publications.json");
    }
    return response.json();
  } catch (error) {
    console.warn("Using fallback publications from main config.", error);
    return null;
  }
}

function normalizeNonNegativeNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
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
  const publications = settings && settings.publications ? settings.publications : {};

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

  if (publications.graph_abs_width_px !== undefined) {
    const width = Math.max(120, normalizeNonNegativeNumber(publications.graph_abs_width_px, 520));
    rootStyle.setProperty("--pub-graph-abs-width", `${width}px`);
  }

  if (publications.graph_abs_height_px !== undefined) {
    const height = Math.max(120, normalizeNonNegativeNumber(publications.graph_abs_height_px, 240));
    rootStyle.setProperty("--pub-graph-abs-height", `${height}px`);
  }

  if (Array.isArray(publications.author_highlight_keywords)) {
    publicationState.authorHighlightKeywords = publications.author_highlight_keywords
      .map((name) => cleanText(name))
      .filter(Boolean);
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
    csdn: "fa-solid fa-pen-nib",
    orcid: "fa-brands fa-orcid"
  };

  Object.entries(links).forEach(([key, meta]) => {
    if (!meta || !meta.url) return;
    const anchor = document.createElement("a");
    anchor.className = "icon-btn";
    anchor.classList.add(`icon-btn--${key.replace(/_/g, "-")}`);
    anchor.href = meta.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    const icon = document.createElement("i");
    icon.className = iconMap[key] || "fa-solid fa-link";
    anchor.appendChild(icon);
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

  renderProfileList(contactsWrap, profile.contacts, "Not set yet / 待填写", true);
  renderProfileList(addressesWrap, profile.addresses, "Not set yet / 待填写", false);
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

function normalizePositiveInteger(value, fallback, maxValue) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maxValue);
}

function normalizeDoi(doi) {
  const raw = cleanText(doi);
  if (!raw) return "";

  return raw
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
}

function normalizeAuthorKeyword(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[.*†‡]/g, "")
    .replace(/\s+/g, "");
}

function shouldHighlightAuthor(authorName, keywords) {
  const normalizedAuthor = normalizeAuthorKeyword(authorName);
  if (!normalizedAuthor) return false;

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeAuthorKeyword(keyword);
    if (!normalizedKeyword) return false;
    return normalizedAuthor === normalizedKeyword || normalizedAuthor.includes(normalizedKeyword);
  });
}

function buildAuthorsFragment(authorsText, keywords) {
  const text = cleanText(authorsText);
  const fragment = document.createDocumentFragment();
  if (!text) return fragment;

  const parts = text
    .split(/[;,，]/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  if (!parts.length) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  parts.forEach((part, index) => {
    if (shouldHighlightAuthor(part, keywords)) {
      const strong = document.createElement("strong");
      strong.className = "publication-author-highlight";
      strong.textContent = part;
      fragment.appendChild(strong);
    } else {
      fragment.appendChild(document.createTextNode(part));
    }

    if (index < parts.length - 1) {
      fragment.appendChild(document.createTextNode(", "));
    }
  });

  return fragment;
}

function buildDoiUrl(doi) {
  const normalized = normalizeDoi(doi);
  if (!normalized) return "";
  const encoded = encodeURIComponent(normalized).replace(/%2F/gi, "/");
  return `https://doi.org/${encoded}`;
}

function formatAuthorList(authors) {
  if (Array.isArray(authors)) {
    return authors
      .map((author) => {
        if (typeof author === "string") return cleanText(author);
        if (!author || typeof author !== "object") return "";
        const family = cleanText(author.family);
        const given = cleanText(author.given);
        return cleanText(`${given} ${family}`);
      })
      .filter(Boolean)
      .join(", ");
  }

  return cleanText(authors);
}

function parseCrossrefMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const title = cleanText(Array.isArray(message.title) ? message.title[0] : message.title);
  const journal = cleanText(
    Array.isArray(message["container-title"]) ? message["container-title"][0] : message["container-title"]
  );
  const year = cleanText(
    message.issued &&
      Array.isArray(message.issued["date-parts"]) &&
      Array.isArray(message.issued["date-parts"][0])
      ? message.issued["date-parts"][0][0]
      : ""
  );

  return {
    doi: normalizeDoi(message.DOI),
    title,
    authors: formatAuthorList(message.author),
    year,
    journal,
    volume: cleanText(message.volume),
    page: cleanText(message.page)
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

async function fetchByDoi(doi, options) {
  const normalized = normalizeDoi(doi);
  if (!normalized) return { status: "empty", data: null };

  const timeoutMs = normalizePositiveInteger(options && options.timeoutMs, 12000, 60000);
  const proxyUrlPrefix = cleanText(options && options.proxyUrlPrefix);
  const directUrl = `https://api.crossref.org/works/${encodeURIComponent(normalized)}`;
  const targets = proxyUrlPrefix ? [`${proxyUrlPrefix}${encodeURIComponent(directUrl)}`] : [directUrl];

  let lastStatus = "failed";

  for (let i = 0; i < targets.length; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targets[i], {
        cache: "no-store",
        signal: controller.signal
      });

      if (response.status === 404) {
        return { status: "not_found", data: null };
      }
      if (response.status === 429) {
        lastStatus = "rate_limited";
        continue;
      }
      if (!response.ok) {
        lastStatus = `http_${response.status}`;
        continue;
      }

      const payload = await response.json();
      const message = payload && payload.message ? payload.message : payload;
      const parsed = parseCrossrefMessage(message);
      if (!parsed) {
        lastStatus = "invalid_payload";
        continue;
      }

      return { status: "ok", data: parsed };
    } catch (error) {
      if (error && error.name === "AbortError") {
        lastStatus = "timeout";
        continue;
      }
      lastStatus = "network";
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return { status: lastStatus, data: null };
}

function normalizePublicationLocal(pub, refKey) {
  if (!pub || typeof pub !== "object") return null;

  const doi = normalizeDoi(pub.doi);
  const title = cleanText(pub.title);
  const authors = formatAuthorList(pub.authors);
  const year = cleanText(pub.year);
  const journal = cleanText(pub.journal);
  const volume = cleanText(pub.volume);
  const page = cleanText(pub.page);
  const graphAbs = cleanText(pub.graph_abs);

  if (!doi && !title) return null;

  return {
    ref_key: cleanText(refKey),
    doi,
    title,
    authors,
    year,
    journal,
    volume,
    page,
    graph_abs: graphAbs,
    doi_link: buildDoiUrl(doi)
  };
}

async function resolvePublications(catalog, settings, onUpdate) {
  const rawPublicationEntries = Array.isArray(catalog && catalog.publications)
    ? catalog.publications.map((item, index) => [String(index), item])
    : catalog && catalog.publications && typeof catalog.publications === "object"
      ? Object.entries(catalog.publications)
      : Array.isArray(catalog)
        ? catalog.map((item, index) => [String(index), item])
        : [];

  const localPublications = rawPublicationEntries
    .map(([refKey, item]) => normalizePublicationLocal(item, refKey))
    .filter(Boolean);
  const resolved = localPublications.map((item) => ({ ...item }));
  const publicationSettings = (settings && settings.publications) || {};
  const resolveDoiEnabled =
    publicationSettings.resolve_doi_enabled === undefined
      ? true
      : Boolean(publicationSettings.resolve_doi_enabled);
  const doiTimeoutMs =
    publicationSettings.doi_timeout_ms !== undefined ? publicationSettings.doi_timeout_ms : 12000;
  const doiRequestIntervalMs =
    publicationSettings.doi_request_interval_ms !== undefined
      ? normalizePositiveInteger(publicationSettings.doi_request_interval_ms, 300, 60000)
      : 300;
  const doiStopAfterFailures =
    publicationSettings.doi_stop_after_failures !== undefined
      ? normalizePositiveInteger(publicationSettings.doi_stop_after_failures, 5, 100)
      : 5;
  const doiProxyUrlPrefix =
    publicationSettings.doi_proxy_url_prefix !== undefined
      ? cleanText(publicationSettings.doi_proxy_url_prefix)
      : "";

  if (typeof onUpdate === "function") {
    onUpdate([...resolved]);
  }

  if (!resolveDoiEnabled) {
    return resolved;
  }

  let consecutiveFailures = 0;
  let fallbackCount = 0;

  for (let index = 0; index < resolved.length; index += 1) {
    const localItem = resolved[index];
    if (!localItem || !localItem.doi) {
      continue;
    }

    const result = await fetchByDoi(localItem.doi, {
      timeoutMs: doiTimeoutMs,
      proxyUrlPrefix: doiProxyUrlPrefix
    });

    if (result.status === "ok" && result.data) {
      const crossref = result.data;
      const doi = crossref.doi || localItem.doi;
      resolved[index] = {
        ref_key: localItem.ref_key,
        doi,
        title: crossref.title || localItem.title,
        authors: crossref.authors || localItem.authors,
        year: crossref.year || localItem.year,
        journal: crossref.journal || localItem.journal,
        volume: crossref.volume || localItem.volume,
        page: crossref.page || localItem.page,
        graph_abs: localItem.graph_abs,
        doi_link: buildDoiUrl(doi)
      };
      consecutiveFailures = 0;

      if (typeof onUpdate === "function") {
        onUpdate([...resolved]);
      }
    } else {
      fallbackCount += 1;
      if (result.status === "not_found") {
        consecutiveFailures = 0;
      } else {
        consecutiveFailures += 1;
      }

      if (result.status === "network" && !doiProxyUrlPrefix) {
        break;
      }
      if (consecutiveFailures >= doiStopAfterFailures) {
        break;
      }
    }

    if (index < resolved.length - 1) {
      const delay = result.status === "rate_limited" ? doiRequestIntervalMs * 2 : doiRequestIntervalMs;
      await wait(delay);
    }
  }

  if (fallbackCount > 0) {
    console.info(`DOI auto-resolve fallback used for ${fallbackCount} publication(s).`);
  }
  return resolved;
}

function parsePublicationYear(pub) {
  const text = cleanText(pub && pub.year);
  const match = text.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
}

function getOrderedPublications(items, sortMode) {
  const safeItems = Array.isArray(items) ? items : [];
  if (sortMode !== "year") {
    return safeItems;
  }

  return safeItems
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ay = parsePublicationYear(a.item);
      const by = parsePublicationYear(b.item);
      if (by !== ay) return by - ay;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

function updatePublicationsSortButton() {
  if (!publicationsSortButton) return;
  const isYearMode = publicationState.sortMode === "year";
  publicationsSortButton.textContent = isYearMode ? "Sort by Default" : "Sort by Year";
  publicationsSortButton.setAttribute("aria-pressed", isYearMode ? "true" : "false");
}

function isGraphAbsModalOpen() {
  return Boolean(graphAbsModal && !graphAbsModal.hidden);
}

function openGraphAbsModal(imageSrc, imageAlt) {
  if (!graphAbsModal || !graphAbsModalImage || !imageSrc) return;
  graphAbsModalImage.src = imageSrc;
  graphAbsModalImage.alt = imageAlt || "Graphical abstract";
  graphAbsModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeGraphAbsModal() {
  if (!graphAbsModal || !graphAbsModalImage || graphAbsModal.hidden) return;
  graphAbsModal.hidden = true;
  graphAbsModalImage.src = "";
  graphAbsModalImage.alt = "Graphical abstract";
  document.body.classList.remove("modal-open");
}

function renderPublications(items) {
  const list = document.getElementById("publications-list");
  list.innerHTML = "";

  const orderedItems = getOrderedPublications(items, publicationState.sortMode);

  if (!orderedItems.length) {
    const empty = document.createElement("div");
    empty.className = "placeholder-item";
    empty.textContent = "No publications loaded yet.";
    list.appendChild(empty);
    return;
  }

  orderedItems.forEach((pub) => {
    const item = document.createElement("article");
    item.className = "publication-item";
    if (pub.ref_key) {
      item.dataset.pubKey = pub.ref_key;
    }

    const head = document.createElement("div");
    head.className = "publication-head";

    const titleLink = document.createElement(pub.doi_link ? "a" : "div");
    titleLink.className = "publication-title";
    const titleText = document.createElement("span");
    titleText.textContent = pub.title || "Untitled";
    titleLink.appendChild(titleText);
    if (pub.doi_link) {
      titleLink.href = pub.doi_link;
      titleLink.target = "_blank";
      titleLink.rel = "noreferrer";
      const doiIcon = document.createElement("i");
      doiIcon.className = "publication-title-doi-icon";
      doiIcon.classList.add("fa-solid", "fa-link");
      doiIcon.setAttribute("aria-hidden", "true");
      titleLink.appendChild(doiIcon);
    }
    head.appendChild(titleLink);

    if (pub.year) {
      const yearBadge = document.createElement("span");
      yearBadge.className = "publication-year";
      yearBadge.textContent = pub.year;
      head.appendChild(yearBadge);
    }

    item.appendChild(head);

    if (pub.authors) {
      const authors = document.createElement("div");
      authors.className = "publication-authors";
      authors.appendChild(buildAuthorsFragment(pub.authors, publicationState.authorHighlightKeywords));
      item.appendChild(authors);
    }

    const venueParts = [];
    if (pub.journal) venueParts.push(pub.journal);
    if (pub.volume) venueParts.push(`Vol. ${pub.volume}`);
    if (pub.page) venueParts.push(`pp. ${pub.page}`);
    if (venueParts.length) {
      const venue = document.createElement("div");
      venue.className = "publication-venue";
      venue.textContent = venueParts.join(" | ");
      item.appendChild(venue);
    }

    if (pub.graph_abs) {
      const graphWrap = document.createElement("button");
      graphWrap.type = "button";
      graphWrap.className = "publication-graph-abs";
      graphWrap.setAttribute("aria-label", `Open graphical abstract for ${pub.title || "publication"}`);
      const graphImg = document.createElement("img");
      graphImg.src = pub.graph_abs;
      graphImg.alt = `${pub.title || "Publication"} graphical abstract`;
      graphImg.loading = "lazy";
      graphImg.decoding = "async";
      graphWrap.appendChild(graphImg);
      graphWrap.addEventListener("click", () => {
        openGraphAbsModal(pub.graph_abs, graphImg.alt);
      });
      item.appendChild(graphWrap);
    }

    if (pub.doi) {
      const doiLine = document.createElement("div");
      doiLine.className = "publication-doi-line";
      const doiLabel = document.createElement("span");
      doiLabel.textContent = "DOI: ";
      doiLine.appendChild(doiLabel);

      const doiLink = document.createElement("a");
      doiLink.href = pub.doi_link || buildDoiUrl(pub.doi);
      doiLink.target = "_blank";
      doiLink.rel = "noreferrer";
      doiLink.textContent = pub.doi;
      doiLine.appendChild(doiLink);
      item.appendChild(doiLine);
    }

    list.appendChild(item);
  });
}

async function init() {
  document.addEventListener("keydown", handleTerminalKey);
  if (terminalScreen) {
    terminalScreen.addEventListener("pointerdown", handleTerminalPointer);
    terminalScreen.addEventListener("touchstart", handleTerminalPointer, { passive: true });
  }
  if (publicationsSortButton) {
    publicationsSortButton.addEventListener("click", () => {
      publicationState.sortMode = publicationState.sortMode === "year" ? "default" : "year";
      renderPublications(publicationState.items);
      updatePublicationsSortButton();
    });
    updatePublicationsSortButton();
  }
  if (graphAbsModalCloseButton) {
    graphAbsModalCloseButton.addEventListener("click", closeGraphAbsModal);
  }
  if (graphAbsModal) {
    graphAbsModal.addEventListener("click", (event) => {
      if (event.target === graphAbsModal) {
        closeGraphAbsModal();
      }
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isGraphAbsModalOpen()) {
      closeGraphAbsModal();
    }
  });

  try {
    const [config, settings, publicationsCatalog] = await Promise.all([
      loadConfig(),
      loadSettings(),
      loadPublicationsCatalog()
    ]);
    applySettings(settings);
    applyBackground(config);
    renderProfile(config.personal_info, config.banner || config.site_brand);
    renderCareer(config.career);
    if (window.ProjectFeature && typeof window.ProjectFeature.initIndexPage === "function") {
      try {
        await window.ProjectFeature.initIndexPage({ settings });
      } catch (projectError) {
        console.error("Failed to initialize projects module.", projectError);
      }
    }
    const publicationSource = publicationsCatalog || { publications: config.publications || [] };
    publicationState.items = await resolvePublications(publicationSource, settings, (nextItems) => {
      publicationState.items = nextItems;
      renderPublications(publicationState.items);
    });
    renderPublications(publicationState.items);
    updatePublicationsSortButton();
  } catch (error) {
    console.error(error);
  }
}

init();
