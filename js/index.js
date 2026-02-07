const terminalScreen = document.getElementById("terminal-screen");
const terminalInput = document.getElementById("terminal-input");
const terminalMessage = document.getElementById("terminal-message");
const mainContent = document.getElementById("main-content");

const state = {
  input: "",
  locked: false,
  entered: false
};

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
  terminalMessage.innerHTML = "<div>Hello word!</div><div>bye bye</div>";
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

function toCssUrl(url) {
  return `url("${String(url).replace(/"/g, "\\\"")}")`;
}

function applySettings(settings) {
  const rootStyle = document.documentElement.style;
  const background = settings && settings.background ? settings.background : {};
  const glass = settings && settings.glass ? settings.glass : {};

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

function renderProfile(info, siteBrand) {
  const profile = info || {};
  const brand = document.getElementById("site-brand");
  const avatar = document.getElementById("avatar-img");
  const name = document.getElementById("profile-name");
  const signature = document.getElementById("profile-signature");
  const linksWrap = document.getElementById("link-buttons");
  const tagsWrap = document.getElementById("profile-tags");
  const customBrand = typeof siteBrand === "string" ? siteBrand.trim() : "";
  const fallbackName = profile.nickname || profile.name || "Personal Page";

  brand.textContent = customBrand || fallbackName;
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
        role: item.role || "",
        org_logo: item.org_logo || "",
        link: item.link || ""
      }))
    : Object.entries(career || {}).map(([year, detail]) => ({
        year,
        organization: (detail && detail.organization) || "",
        role: (detail && detail.role) || "",
        org_logo: (detail && detail.org_logo) || "",
        link: (detail && detail.link) || ""
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

    if (detail.org_logo) {
      const logoEl = document.createElement("img");
      logoEl.className = "career-org-logo";
      logoEl.src = detail.org_logo;
      logoEl.alt = `${detail.organization || "Organization"} logo`;
      logoEl.loading = "lazy";
      logoEl.decoding = "async";
      orgEl.appendChild(logoEl);
    }

    const roleEl = document.createElement("div");
    roleEl.textContent = detail.organization || "";
    orgEl.appendChild(roleEl);

    const subEl = document.createElement("div");
    subEl.className = "career-role";
    subEl.textContent = detail.role || "";
    detailEl.appendChild(orgEl);
    detailEl.appendChild(subEl);

    item.appendChild(yearEl);
    item.appendChild(detailEl);

    if (detail.link) {
      const link = document.createElement("a");
      link.className = "career-link";
      link.href = detail.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.innerHTML = "<i class=\"fa-solid fa-arrow-up-right-from-square\"></i>";
      item.appendChild(link);
    }

    list.appendChild(item);
  });
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePositiveInteger(value, fallback, maxValue) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, maxValue);
}

function toAbsoluteScholarUrl(href) {
  const raw = cleanText(href);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `https://scholar.google.com${raw}`;
  return `https://scholar.google.com/${raw}`;
}

function extractScholarUserId(config) {
  const source = (config && config.publications_source && config.publications_source.google_scholar) || {};
  const configured = cleanText(source.user_id);
  if (configured) return configured;

  const scholarLink =
    config &&
    config.personal_info &&
    config.personal_info.links &&
    config.personal_info.links.google_scholar &&
    config.personal_info.links.google_scholar.url;

  if (!scholarLink) return "";

  try {
    const parsed = new URL(scholarLink);
    return cleanText(parsed.searchParams.get("user"));
  } catch (error) {
    console.warn("Failed to parse Google Scholar URL.", error);
    return "";
  }
}

async function fetchHtmlThroughProxy(targetUrl, proxyPrefix, timeoutMs) {
  const url = cleanText(proxyPrefix)
    ? `${cleanText(proxyPrefix)}${encodeURIComponent(targetUrl)}`
    : targetUrl;
  const controller = new AbortController();
  const timeout = normalizePositiveInteger(timeoutMs, 12000, 60000);
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Publication fetch failed: ${response.status}`);
    }
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseScholarPublicationsFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = Array.from(doc.querySelectorAll("tr.gsc_a_tr"));

  return rows
    .map((row) => {
      const titleEl = row.querySelector(".gsc_a_at");
      const grayRows = row.querySelectorAll(".gs_gray");
      const yearEl = row.querySelector(".gsc_a_y span, .gsc_a_y");
      const citationEl = row.querySelector(".gsc_a_c a");

      const title = cleanText(titleEl ? titleEl.textContent : "");
      if (!title) return null;

      const citationText = cleanText(citationEl ? citationEl.textContent : "");
      const citationMatch = citationText.match(/\d+/);

      return {
        title,
        authors: cleanText(grayRows[0] ? grayRows[0].textContent : ""),
        venue: cleanText(grayRows[1] ? grayRows[1].textContent : ""),
        year: cleanText(yearEl ? yearEl.textContent : ""),
        citations: citationMatch ? parseInt(citationMatch[0], 10) : null,
        link: toAbsoluteScholarUrl(titleEl ? titleEl.getAttribute("href") : "")
      };
    })
    .filter(Boolean);
}

async function fetchGoogleScholarPublications(config) {
  const source = (config && config.publications_source && config.publications_source.google_scholar) || {};
  const userId = extractScholarUserId(config);
  if (!userId) return [];

  const maxItems = normalizePositiveInteger(source.max_items, 20, 100);
  const pageSize = normalizePositiveInteger(source.pagesize, 20, 100);
  const timeoutMs = normalizePositiveInteger(source.timeout_ms, 12000, 60000);
  const proxyPrefix = source.proxy_url_prefix || "";
  const allItems = [];
  const seen = new Set();

  for (let start = 0; start < maxItems; start += pageSize) {
    const url =
      "https://scholar.google.com/citations?hl=en&view_op=list_works" +
      `&user=${encodeURIComponent(userId)}&sortby=pubdate&cstart=${start}&pagesize=${pageSize}`;

    const html = await fetchHtmlThroughProxy(url, proxyPrefix, timeoutMs);
    const pageItems = parseScholarPublicationsFromHtml(html);

    if (!pageItems.length) break;

    pageItems.forEach((item) => {
      const dedupeKey = item.link || `${item.title}|${item.year}|${item.venue}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      allItems.push(item);
    });

    if (pageItems.length < pageSize || allItems.length >= maxItems) break;
  }

  return allItems.slice(0, maxItems);
}

function normalizePublicationItem(pub) {
  if (!pub || typeof pub !== "object") return null;
  const citationNumber = Number(pub.citations);
  return {
    title: cleanText(pub.title),
    authors: cleanText(pub.authors),
    venue: cleanText(pub.venue || pub.journal || pub.booktitle),
    year: cleanText(pub.year),
    citations: Number.isFinite(citationNumber) ? citationNumber : null,
    link: cleanText(pub.link || pub.url)
  };
}

async function loadPublications(config) {
  const source = (config && config.publications_source) || {};
  const wantsScholar = source.enabled !== false && source.type === "google_scholar";

  if (wantsScholar) {
    try {
      const scholarItems = await fetchGoogleScholarPublications(config);
      if (scholarItems.length) return scholarItems;
    } catch (error) {
      console.warn("Google Scholar fetch failed, fallback to local publications.", error);
    }
  }

  return (config.publications || []).map(normalizePublicationItem).filter((item) => item && item.title);
}

function renderPublications(items) {
  const list = document.getElementById("publications-list");
  list.innerHTML = "";

  if (!items || !items.length) {
    const empty = document.createElement("div");
    empty.className = "placeholder-item";
    empty.textContent = "No publications loaded yet.";
    list.appendChild(empty);
    return;
  }

  items.forEach((pub) => {
    const normalized = normalizePublicationItem(pub);
    if (!normalized || !normalized.title) return;

    const item = document.createElement("article");
    item.className = "publication-item";

    const header = document.createElement("div");
    header.className = "publication-header";

    if (normalized.link) {
      const titleLink = document.createElement("a");
      titleLink.className = "publication-title";
      titleLink.href = normalized.link;
      titleLink.target = "_blank";
      titleLink.rel = "noreferrer";
      titleLink.textContent = normalized.title;
      header.appendChild(titleLink);
    } else {
      const titleText = document.createElement("div");
      titleText.className = "publication-title";
      titleText.textContent = normalized.title;
      header.appendChild(titleText);
    }

    const metaWrap = document.createElement("div");
    metaWrap.className = "publication-meta";

    if (normalized.year) {
      const yearBadge = document.createElement("span");
      yearBadge.className = "publication-badge";
      yearBadge.textContent = normalized.year;
      metaWrap.appendChild(yearBadge);
    }

    if (normalized.citations !== null) {
      const citationBadge = document.createElement("span");
      citationBadge.className = "publication-badge";
      citationBadge.textContent = `Cited ${normalized.citations}`;
      metaWrap.appendChild(citationBadge);
    }

    if (normalized.link) {
      const openLink = document.createElement("a");
      openLink.className = "publication-open";
      openLink.href = normalized.link;
      openLink.target = "_blank";
      openLink.rel = "noreferrer";
      openLink.setAttribute("aria-label", `Open publication: ${normalized.title}`);
      openLink.innerHTML = "<i class=\"fa-solid fa-arrow-up-right-from-square\"></i>";
      metaWrap.appendChild(openLink);
    }

    header.appendChild(metaWrap);

    const detail = document.createElement("div");
    detail.className = "publication-detail";
    const detailParts = [normalized.authors, normalized.venue].filter(Boolean);
    detail.textContent = detailParts.join(" | ");

    item.appendChild(header);
    if (detail.textContent) {
      item.appendChild(detail);
    }
    list.appendChild(item);
  });
}

function renderProjects(items) {
  const list = document.getElementById("projects-list");
  list.innerHTML = "";

  if (!items || !items.length) {
    const empty = document.createElement("div");
    empty.className = "placeholder-item";
    empty.textContent = "Projects will appear here soon.";
    list.appendChild(empty);
    return;
  }

  items.forEach((project) => {
    const item = document.createElement("div");
    item.className = "placeholder-item";
    const name = project.name || "Project";
    const desc = project.description ? ` - ${project.description}` : "";
    item.textContent = `${name}${desc}`;
    list.appendChild(item);
  });
}

async function init() {
  document.addEventListener("keydown", handleTerminalKey);

  try {
    const [config, settings] = await Promise.all([loadConfig(), loadSettings()]);
    applySettings(settings);
    applyBackground(config);
    renderProfile(config.personal_info, config.site_brand);
    renderCareer(config.career);
    const publications = await loadPublications(config);
    renderPublications(publications);
    renderProjects(config.projects);
  } catch (error) {
    console.error(error);
  }
}

init();
