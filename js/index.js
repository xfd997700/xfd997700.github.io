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

async function fetchByDoi(doi, timeoutMs) {
  const normalized = normalizeDoi(doi);
  if (!normalized) return null;

  const controller = new AbortController();
  const timeout = normalizePositiveInteger(timeoutMs, 12000, 60000);
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(normalized)}`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Crossref response ${response.status}`);
    }

    const payload = await response.json();
    return parseCrossrefMessage(payload && payload.message);
  } catch (error) {
    console.warn(`DOI parse failed for ${normalized}.`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizePublicationLocal(pub) {
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

async function resolvePublications(catalog, settings) {
  const rawPublications = Array.isArray(catalog && catalog.publications)
    ? catalog.publications
    : Array.isArray(catalog)
      ? catalog
      : [];

  const localPublications = rawPublications.map(normalizePublicationLocal).filter(Boolean);
  const doiTimeoutMs =
    settings &&
    settings.publications &&
    settings.publications.doi_timeout_ms !== undefined
      ? settings.publications.doi_timeout_ms
      : 12000;

  const resolved = await Promise.all(
    localPublications.map(async (localItem) => {
      if (!localItem.doi) return localItem;

      const crossref = await fetchByDoi(localItem.doi, doiTimeoutMs);
      if (!crossref) return localItem;

      const doi = crossref.doi || localItem.doi;
      return {
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
    })
  );

  resolved.sort((a, b) => {
    const ay = parseInt(a.year, 10) || 0;
    const by = parseInt(b.year, 10) || 0;
    return by - ay;
  });

  return resolved;
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
    const item = document.createElement("article");
    item.className = "publication-item";

    const head = document.createElement("div");
    head.className = "publication-head";

    const titleLink = document.createElement(pub.doi_link ? "a" : "div");
    titleLink.className = "publication-title";
    titleLink.textContent = pub.title || "Untitled";
    if (pub.doi_link) {
      titleLink.href = pub.doi_link;
      titleLink.target = "_blank";
      titleLink.rel = "noreferrer";
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
      authors.textContent = pub.authors;
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

    if (pub.doi) {
      const doiRow = document.createElement("div");
      doiRow.className = "publication-doi";
      const doiLabel = document.createElement("span");
      doiLabel.className = "publication-doi-label";
      doiLabel.textContent = "DOI";
      doiRow.appendChild(doiLabel);

      const doiAnchor = document.createElement("a");
      doiAnchor.href = pub.doi_link || buildDoiUrl(pub.doi);
      doiAnchor.target = "_blank";
      doiAnchor.rel = "noreferrer";
      doiAnchor.textContent = pub.doi;
      doiRow.appendChild(doiAnchor);
      item.appendChild(doiRow);
    }

    if (pub.graph_abs) {
      const graphWrap = document.createElement("figure");
      graphWrap.className = "publication-graph-abs";
      const graphImg = document.createElement("img");
      graphImg.src = pub.graph_abs;
      graphImg.alt = `${pub.title || "Publication"} graphical abstract`;
      graphImg.loading = "lazy";
      graphImg.decoding = "async";
      graphWrap.appendChild(graphImg);
      item.appendChild(graphWrap);
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
    const [config, settings, publicationsCatalog] = await Promise.all([
      loadConfig(),
      loadSettings(),
      loadPublicationsCatalog()
    ]);
    applySettings(settings);
    applyBackground(config);
    renderProfile(config.personal_info, config.site_brand);
    renderCareer(config.career);
    renderProjects(config.projects);
    const publicationSource = publicationsCatalog || { publications: config.publications || [] };
    const publications = await resolvePublications(publicationSource, settings);
    renderPublications(publications);
  } catch (error) {
    console.error(error);
  }
}

init();
