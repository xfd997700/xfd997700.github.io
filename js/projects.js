(function () {
  "use strict";

  const DEFAULT_PROJECT_SETTINGS = {
    homeCardWidth: 290,
    homeCardHeight: 320,
    overviewCardWidth: 300,
    overviewCardHeight: 320,
    cardGap: 16,
    imageCarouselSeconds: 4
  };

  const indexState = {
    initialized: false,
    projects: [],
    projectMap: new Map(),
    projectDocCache: new Map(),
    detailRenderToken: 0,
    publicationsMap: new Map(),
    publicationAuthorKeywords: ["Fanding Xu", "徐凡丁"],
    lang: "zh",
    intervals: [],
    homePageIndex: 0,
    settings: { ...DEFAULT_PROJECT_SETTINGS },
    refs: null,
    currentRoute: { view: "home" },
    resizeTimer: null
  };

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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

  function getBasePrefix() {
    return window.location.pathname.includes("/projects/") ? "../" : "";
  }

  function resolveAssetPath(path, basePrefix) {
    const raw = cleanText(path);
    if (!raw) return "";
    if (/^(https?:)?\/\//i.test(raw)) return raw;
    if (/^data:/i.test(raw)) return raw;
    if (raw.startsWith("/")) return raw;
    if (!basePrefix) return raw.replace(/^\.\//, "");
    return `${basePrefix}${raw.replace(/^\.\//, "")}`;
  }

  function rebaseRelativeUrls(root, relativeTo) {
    if (!root) return;
    const baseUrl = new URL(relativeTo, window.location.href);
    const nodes = root.querySelectorAll("[src], [href]");
    nodes.forEach((node) => {
      const attr = node.hasAttribute("src") ? "src" : "href";
      const raw = cleanText(node.getAttribute(attr));
      if (!raw) return;
      if (raw.startsWith("#")) return;
      if (/^(https?:)?\/\//i.test(raw)) return;
      if (/^(mailto:|tel:|javascript:|data:)/i.test(raw)) return;

      try {
        node.setAttribute(attr, new URL(raw, baseUrl).href);
      } catch (error) {
        console.warn("Failed to rebase project asset path.", raw, error);
      }
    });
  }

  async function loadJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return response.json();
  }

  async function loadProjectsCatalog(basePrefix) {
    return loadJson(`${basePrefix}config/projects.json`);
  }

  async function loadSettings(basePrefix) {
    try {
      return await loadJson(`${basePrefix}config/settings.json`);
    } catch (error) {
      console.warn("Projects: using default settings.", error);
      return {};
    }
  }

  async function loadPublicationsCatalog(basePrefix) {
    try {
      return await loadJson(`${basePrefix}config/publications.json`);
    } catch (error) {
      console.warn("Projects: failed to load publications catalog.", error);
      return null;
    }
  }

  function normalizeProjectItem(key, value, basePrefix) {
    if (!value || typeof value !== "object") return null;
    const imgs = Array.isArray(value.imgs)
      ? value.imgs.map((src) => resolveAssetPath(src, basePrefix)).filter(Boolean)
      : [];
    const relatedPublications = Array.isArray(value.related_publications)
      ? value.related_publications.map((entry) => cleanText(entry)).filter(Boolean)
      : [];

    return {
      key: cleanText(key),
      title_en: cleanText(value.title_en),
      title_zh: cleanText(value.title_zh),
      abs_en: cleanText(value.abs_en),
      abs_zh: cleanText(value.abs_zh),
      funding_en: cleanText(value.funding_en || value.funding),
      funding_zh: cleanText(value.funding_zh || value.funding),
      funding_no: cleanText(value.funding_no),
      imgs,
      related_publications: relatedPublications
    };
  }

  function normalizeProjectsCatalog(catalog, basePrefix) {
    const raw = catalog && catalog.projects;
    if (Array.isArray(raw)) {
      return raw
        .map((item, index) => normalizeProjectItem(String(index), item, basePrefix))
        .filter((item) => item && item.key);
    }

    if (raw && typeof raw === "object") {
      return Object.entries(raw)
        .map(([key, value]) => normalizeProjectItem(key, value, basePrefix))
        .filter((item) => item && item.key);
    }

    return [];
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
    return `https://doi.org/${encodeURIComponent(normalized).replace(/%2F/gi, "/")}`;
  }

  function normalizePublicationsCatalog(catalog, basePrefix) {
    const raw = catalog && catalog.publications;
    if (!raw || typeof raw !== "object") return [];

    return Object.entries(raw)
      .map(([refKey, value]) => {
        if (!value || typeof value !== "object") return null;
        const doi = normalizeDoi(value.doi);
        return {
          ref_key: cleanText(refKey),
          doi,
          doi_link: buildDoiUrl(doi),
          title: cleanText(value.title),
          authors: cleanText(value.authors),
          year: cleanText(value.year),
          journal: cleanText(value.journal),
          volume: cleanText(value.volume),
          page: cleanText(value.page),
          graph_abs: resolveAssetPath(value.graph_abs, basePrefix)
        };
      })
      .filter(Boolean);
  }

  function getProjectTitle(project, lang) {
    if (!project) return "Project";
    if (lang === "zh") return project.title_zh || project.title_en || project.key;
    return project.title_en || project.title_zh || project.key;
  }

  function getProjectAbstract(project, lang) {
    if (!project) return "";
    if (lang === "zh") return project.abs_zh || project.abs_en || "";
    return project.abs_en || project.abs_zh || "";
  }

  function hasProjectFunding(project) {
    if (!project) return false;
    return Boolean(cleanText(project.funding_en) || cleanText(project.funding_zh) || cleanText(project.funding_no));
  }

  function formatProjectFunding(project, lang) {
    if (!hasProjectFunding(project)) return "";
    const fundingEn = cleanText(project.funding_en);
    const fundingZh = cleanText(project.funding_zh);
    const funding = lang === "zh" ? fundingZh || fundingEn : fundingEn || fundingZh;
    const fundingNo = cleanText(project.funding_no);
    if (lang === "zh") {
      if (funding && fundingNo) return `基金：${funding}（${fundingNo}）`;
      if (funding) return `基金：${funding}`;
      return `基金编号：${fundingNo}`;
    }

    if (funding && fundingNo) return `Funding: ${funding} (${fundingNo})`;
    if (funding) return `Funding: ${funding}`;
    return `Funding No.: ${fundingNo}`;
  }

  function createImagePlaceholderDataUri(text) {
    const safeText = encodeURIComponent(cleanText(text) || "Project");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='720' viewBox='0 0 1200 720'><rect width='1200' height='720' fill='#132139'/><text x='80' y='380' fill='#dde9ff' font-size='56' font-family='JetBrains Mono,Consolas,monospace'>${safeText}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${svg}`;
  }

  function clearIntervals(intervals) {
    intervals.forEach((id) => clearInterval(id));
    intervals.length = 0;
  }

  function addImageDots(container, count, activeIndex) {
    container.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement("span");
      dot.className = "project-card-media-dot";
      if (i === activeIndex) dot.classList.add("is-active");
      container.appendChild(dot);
    }
  }
  function createProjectCard(project, options) {
    const variant = options.variant || "home";
    const lang = options.lang || "en";
    const onOpen = typeof options.onOpen === "function" ? options.onOpen : null;
    const imageIntervalMs = options.imageIntervalMs || 4000;
    const intervalStore = Array.isArray(options.intervalStore) ? options.intervalStore : null;

    const card = document.createElement("article");
    card.className = `project-card project-card--${variant}`;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.dataset.projectKey = project.key;

    const media = document.createElement("div");
    media.className = "project-card-media";
    const image = document.createElement("img");
    image.alt = `${getProjectTitle(project, lang)} preview`;
    image.loading = "lazy";
    image.decoding = "async";
    const dots = document.createElement("div");
    dots.className = "project-card-media-dots";
    media.appendChild(image);
    media.appendChild(dots);

    const imgs = project.imgs.length ? project.imgs.slice() : [createImagePlaceholderDataUri(getProjectTitle(project, lang))];
    let imageIndex = 0;
    image.src = imgs[imageIndex];
    addImageDots(dots, imgs.length, imageIndex);

    if (imgs.length > 1 && intervalStore) {
      const timer = setInterval(() => {
        imageIndex = (imageIndex + 1) % imgs.length;
        image.src = imgs[imageIndex];
        addImageDots(dots, imgs.length, imageIndex);
      }, Math.max(1200, imageIntervalMs));
      intervalStore.push(timer);
    }

    const title = document.createElement("h3");
    title.className = "project-card-title";
    title.textContent = getProjectTitle(project, lang);

    const abs = document.createElement("p");
    abs.className = "project-card-abs";
    abs.textContent = getProjectAbstract(project, lang) || "No abstract provided yet.";

    const fundingText = formatProjectFunding(project, lang);
    let funding = null;
    if (fundingText) {
      funding = document.createElement("p");
      funding.className = "project-card-funding";
      funding.textContent = fundingText;
    }

    if (onOpen) {
      card.addEventListener("click", () => onOpen(project));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(project);
        }
      });
    }

    card.appendChild(media);
    card.appendChild(title);
    card.appendChild(abs);
    if (funding) {
      card.appendChild(funding);
    }
    return card;
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
    zhButton.textContent = "中文";
    zhButton.classList.toggle("is-active", lang === "zh");
    zhButton.addEventListener("click", () => onChange("zh"));

    wrap.appendChild(enButton);
    wrap.appendChild(zhButton);
    container.appendChild(wrap);
  }

  function splitPages(items, pageSize) {
    const pages = [];
    for (let i = 0; i < items.length; i += pageSize) {
      pages.push(items.slice(i, i + pageSize));
    }
    return pages;
  }

  function renderHomeView() {
    const { homeView } = indexState.refs;
    if (!homeView) return;

    homeView.innerHTML = "";
    if (!indexState.projects.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "Projects will appear here soon.";
      homeView.appendChild(empty);
      return;
    }

    const shell = document.createElement("div");
    shell.className = "projects-home-shell";
    const viewport = document.createElement("div");
    viewport.className = "projects-carousel-viewport";
    const track = document.createElement("div");
    track.className = "projects-carousel-track";
    const pager = document.createElement("div");
    pager.className = "projects-home-pager";

    const cardWidth = indexState.settings.homeCardWidth;
    const gap = indexState.settings.cardGap;
    const width = Math.max(
      260,
      homeView.clientWidth ||
        (window.innerWidth > 1100 ? Math.floor(window.innerWidth * 0.52) : Math.max(260, window.innerWidth - 80))
    );
    const cardsPerPage = Math.max(1, Math.floor((width + gap) / (cardWidth + gap)));
    const pages = splitPages(indexState.projects, cardsPerPage);

    if (indexState.homePageIndex >= pages.length) {
      indexState.homePageIndex = Math.max(0, pages.length - 1);
    }

    pages.forEach((pageProjects) => {
      const page = document.createElement("div");
      page.className = "projects-carousel-page";
      pageProjects.forEach((project) => {
        const card = createProjectCard(project, {
          variant: "home",
          lang: indexState.lang,
          imageIntervalMs: indexState.settings.imageCarouselSeconds * 1000,
          intervalStore: indexState.intervals,
          onOpen: () => navigateToRoute({ view: "project", key: project.key })
        });
        page.appendChild(card);
      });
      track.appendChild(page);
    });

    function applyPage(nextPage) {
      const clamped = Math.min(Math.max(nextPage, 0), pages.length - 1);
      indexState.homePageIndex = clamped;
      track.style.transform = `translateX(-${clamped * 100}%)`;
      Array.from(pager.children).forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === clamped);
      });
    }

    pages.forEach((_, pageIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "projects-home-dot";
      dot.setAttribute("aria-label", `Go to project page ${pageIndex + 1}`);
      dot.addEventListener("click", () => applyPage(pageIndex));
      pager.appendChild(dot);
    });

    let touchStartX = 0;
    viewport.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0].clientX;
      },
      { passive: true }
    );
    viewport.addEventListener(
      "touchend",
      (event) => {
        const deltaX = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) < 42) return;
        if (deltaX < 0) {
          applyPage(indexState.homePageIndex + 1);
        } else {
          applyPage(indexState.homePageIndex - 1);
        }
      },
      { passive: true }
    );

    viewport.appendChild(track);
    shell.appendChild(viewport);
    if (pages.length > 1) {
      shell.appendChild(pager);
    }
    homeView.appendChild(shell);
    applyPage(indexState.homePageIndex);
  }

  function renderOverviewView(target, options) {
    if (!target) return;
    const lang = options.lang || "en";
    const intervalStore = options.intervalStore || null;
    const onOpen = options.onOpen || null;

    target.innerHTML = "";
    if (!indexState.projects.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "No projects loaded.";
      target.appendChild(empty);
      return;
    }

    const shell = document.createElement("div");
    shell.className = "projects-overview-shell";
    const grid = document.createElement("div");
    grid.className = "projects-overview-grid";

    indexState.projects.forEach((project) => {
      const card = createProjectCard(project, {
        variant: "overview",
        lang,
        imageIntervalMs: indexState.settings.imageCarouselSeconds * 1000,
        intervalStore,
        onOpen
      });
      grid.appendChild(card);
    });

    shell.appendChild(grid);
    target.appendChild(shell);
  }
  function collectIndexRefs() {
    return {
      rightColumn: document.getElementById("right-column"),
      routeNav: document.getElementById("route-nav"),
      projectsSectionNav: document.getElementById("projects-section-nav"),
      projectsHomeLangToggle: document.getElementById("projects-home-lang-toggle"),
      projectsOverviewLangToggle: document.getElementById("projects-overview-lang-toggle"),
      projectsOverviewHomeBtn: document.getElementById("projects-overview-home-btn"),
      homeView: document.getElementById("projects-home-view"),
      overviewView: document.getElementById("projects-overview-view"),
      defaultStack: document.getElementById("right-default-stack"),
      overviewCard: document.getElementById("projects-overview-card"),
      detailCard: document.getElementById("project-detail-card"),
      detailTitle: document.getElementById("project-detail-title"),
      detailLangToggle: document.getElementById("project-detail-lang-toggle"),
      detailBackButton: document.getElementById("project-detail-back-btn"),
      detailFrameWrap: document.getElementById("project-detail-frame-wrap")
    };
  }

  function applyProjectSettings(settings) {
    const rootStyle = document.documentElement.style;
    const projectSettings = settings && settings.projects ? settings.projects : {};

    const next = {
      homeCardWidth: Math.max(220, normalizeNonNegativeNumber(projectSettings.home_card_width_px, 290)),
      homeCardHeight: Math.max(220, normalizeNonNegativeNumber(projectSettings.home_card_height_px, 320)),
      overviewCardWidth: Math.max(220, normalizeNonNegativeNumber(projectSettings.overview_card_width_px, 300)),
      overviewCardHeight: Math.max(220, normalizeNonNegativeNumber(projectSettings.overview_card_height_px, 320)),
      cardGap: Math.max(8, normalizeNonNegativeNumber(projectSettings.card_gap_px, 16)),
      imageCarouselSeconds: normalizePositiveInteger(projectSettings.image_carousel_seconds, 4, 120)
    };
    indexState.settings = next;

    rootStyle.setProperty("--projects-home-card-width", `${next.homeCardWidth}px`);
    rootStyle.setProperty("--projects-home-card-height", `${next.homeCardHeight}px`);
    rootStyle.setProperty("--projects-overview-card-width", `${next.overviewCardWidth}px`);
    rootStyle.setProperty("--projects-overview-card-height", `${next.overviewCardHeight}px`);
    rootStyle.setProperty("--projects-card-gap", `${next.cardGap}px`);
  }

  function buildHash(route) {
    if (!route || route.view === "home") return "#home";
    if (route.view === "projects") return "#projects";
    if (route.view === "project" && route.key) return `#projects/${encodeURIComponent(route.key)}`;
    return "#home";
  }

  function parseHashRoute(hashText) {
    const raw = String(hashText || "").replace(/^#/, "").trim();
    if (!raw || raw === "home") {
      return { view: "home" };
    }

    const parts = raw.split("/").filter(Boolean);
    if (!parts.length) return { view: "home" };
    if (parts[0] !== "projects") return { view: "home" };
    if (parts.length === 1) return { view: "projects" };
    return { view: "project", key: decodeURIComponent(parts[1]) };
  }

  function replaceHash(route) {
    const hash = buildHash(route);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${hash}`);
  }

  function createRouteItem(label, isCurrent, onClick) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "route-nav-item";
    if (isCurrent) {
      item.setAttribute("aria-current", "page");
    } else {
      item.classList.add("route-nav-item--link");
      item.addEventListener("click", onClick);
    }
    item.textContent = label;
    return item;
  }

  function addRouteSeparator(nav) {
    const sep = document.createElement("span");
    sep.className = "route-nav-sep";
    sep.textContent = ">";
    nav.appendChild(sep);
  }

  function renderRouteNav(route) {
    const nav = indexState.refs.routeNav;
    if (!nav) return;
    nav.innerHTML = "";

    const homeIsCurrent = route.view === "home";
    nav.appendChild(createRouteItem("Home", homeIsCurrent, () => navigateToRoute({ view: "home" })));

    if (route.view === "home") {
      return;
    }

    addRouteSeparator(nav);
    const projectsIsCurrent = route.view === "projects";
    nav.appendChild(createRouteItem("Projects", projectsIsCurrent, () => navigateToRoute({ view: "projects" })));

    if (route.view === "project") {
      const project = indexState.projectMap.get(route.key);
      addRouteSeparator(nav);
      nav.appendChild(createRouteItem(getProjectTitle(project, indexState.lang), true, null));
    }
  }

  function applyProjectContentLanguage(container, lang) {
    if (!container) return;
    container.classList.toggle("lang-en", lang !== "zh");
    container.classList.toggle("lang-zh", lang === "zh");
  }

  function openIndexGraphAbsModal(imageSrc, imageAlt) {
    const modal = document.getElementById("graph-abs-modal");
    const modalImage = document.getElementById("graph-abs-modal-img");
    if (!modal || !modalImage || !imageSrc) return;
    modalImage.src = imageSrc;
    modalImage.alt = imageAlt || "Graphical abstract";
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  async function loadProjectDocumentNode(projectKey) {
    if (indexState.projectDocCache.has(projectKey)) {
      const cached = indexState.projectDocCache.get(projectKey);
      return cached.cloneNode(true);
    }

    const filePath = `projects/${encodeURIComponent(projectKey)}.html`;
    const response = await fetch(filePath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}`);
    }

    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const root =
      doc.querySelector("[data-project-doc]") ||
      doc.querySelector("#project-doc") ||
      doc.querySelector("main") ||
      doc.body;
    const node = root.cloneNode(true);
    node.querySelectorAll("script").forEach((script) => script.remove());
    rebaseRelativeUrls(node, filePath);
    indexState.projectDocCache.set(projectKey, node.cloneNode(true));
    return node;
  }

  function ensureAutoSummarySection(projectRoot, project) {
    if (!projectRoot || !project) return;
    const existing = projectRoot.querySelector("[data-project-slot='auto-summary']");
    if (existing) {
      existing.remove();
    }

    const section = document.createElement("section");
    section.className = "project-doc-section";
    section.setAttribute("data-project-slot", "auto-summary");

    const summaryEn = document.createElement("h3");
    summaryEn.className = "project-doc-heading proj-en";
    summaryEn.textContent = "Project Summary";
    section.appendChild(summaryEn);

    const summaryZh = document.createElement("h3");
    summaryZh.className = "project-doc-heading proj-zh";
    summaryZh.textContent = "项目摘要";
    section.appendChild(summaryZh);

    const titleEn = document.createElement("p");
    titleEn.className = "project-doc-text project-doc-emphasis proj-en";
    titleEn.textContent = getProjectTitle(project, "en");
    section.appendChild(titleEn);

    const titleZh = document.createElement("p");
    titleZh.className = "project-doc-text project-doc-emphasis proj-zh";
    titleZh.textContent = getProjectTitle(project, "zh");
    section.appendChild(titleZh);

    const overrideAbsEn = readProjectOverrideText(projectRoot, "abs_en");
    const overrideAbsZh = readProjectOverrideText(projectRoot, "abs_zh");

    const absEn = document.createElement("p");
    absEn.className = "project-doc-text proj-en";
    absEn.textContent = overrideAbsEn || getProjectAbstract(project, "en") || "No English abstract provided yet.";
    section.appendChild(absEn);

    const absZh = document.createElement("p");
    absZh.className = "project-doc-text proj-zh";
    absZh.textContent = overrideAbsZh || getProjectAbstract(project, "zh") || "暂无中文摘要。";
    section.appendChild(absZh);

    const fundingEnText = formatProjectFunding(project, "en");
    if (fundingEnText) {
      const fundingEn = document.createElement("p");
      fundingEn.className = "project-doc-text project-doc-funding proj-en";
      fundingEn.textContent = fundingEnText;
      section.appendChild(fundingEn);
    }

    const fundingZhText = formatProjectFunding(project, "zh");
    if (fundingZhText) {
      const fundingZh = document.createElement("p");
      fundingZh.className = "project-doc-text project-doc-funding proj-zh";
      fundingZh.textContent = fundingZhText;
      section.appendChild(fundingZh);
    }

    const firstSection = projectRoot.querySelector(".project-doc-section");
    if (firstSection) {
      projectRoot.insertBefore(section, firstSection);
    } else {
      projectRoot.appendChild(section);
    }
  }

  function readProjectOverrideText(projectRoot, key) {
    if (!projectRoot || !key) return "";
    const selector = `[data-project-override="${key}"]`;
    const node = projectRoot.querySelector(selector);
    if (!node) return "";

    if (node.tagName && node.tagName.toLowerCase() === "template") {
      return cleanText(node.content ? node.content.textContent : node.textContent);
    }
    return cleanText(node.textContent);
  }

  function ensureRelatedPublicationsSlot(projectRoot) {
    if (!projectRoot) return null;
    let slot = projectRoot.querySelector("[data-project-slot='related-publications']");
    if (slot) return slot;

    const section = document.createElement("section");
    section.className = "project-doc-section";
    section.setAttribute("data-project-slot", "auto-related");

    const headingEn = document.createElement("h3");
    headingEn.className = "project-doc-heading proj-en";
    headingEn.textContent = "Related Publications";
    section.appendChild(headingEn);

    const headingZh = document.createElement("h3");
    headingZh.className = "project-doc-heading proj-zh";
    headingZh.textContent = "相关论文";
    section.appendChild(headingZh);

    slot = document.createElement("div");
    slot.className = "placeholder-list";
    slot.setAttribute("data-project-slot", "related-publications");
    section.appendChild(slot);

    projectRoot.appendChild(section);
    return slot;
  }

  async function renderProjectDetail(project) {
    const { detailTitle, detailFrameWrap } = indexState.refs;
    if (!detailFrameWrap || !detailTitle) return;
    const renderToken = ++indexState.detailRenderToken;

    detailFrameWrap.innerHTML = "";
    if (!project) {
      detailTitle.textContent = "Project not found";
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "This project key is not available in config/projects.json.";
      detailFrameWrap.appendChild(empty);
      return;
    }

    detailTitle.textContent = getProjectTitle(project, indexState.lang);
    const loading = document.createElement("div");
    loading.className = "placeholder-item";
    loading.textContent = "Loading project content...";
    detailFrameWrap.appendChild(loading);

    try {
      const docNode = await loadProjectDocumentNode(project.key);
      if (renderToken !== indexState.detailRenderToken) return;

      const shell = document.createElement("div");
      shell.className = "project-detail-content";
      applyProjectContentLanguage(shell, indexState.lang);
      shell.appendChild(docNode);
      detailFrameWrap.innerHTML = "";
      detailFrameWrap.appendChild(shell);

      const projectRoot = shell.querySelector("[data-project-doc]") || shell;
      ensureAutoSummarySection(projectRoot, project);
      const publicationSlot = ensureRelatedPublicationsSlot(projectRoot);
      const relatedItems = project.related_publications
        .map((key) => indexState.publicationsMap.get(key))
        .filter(Boolean);
      renderPublicationList(publicationSlot, relatedItems, {
        authorKeywords: indexState.publicationAuthorKeywords,
        onOpenGraphAbs: null,
        showGraphAbs: false
      });
    } catch (error) {
      if (renderToken !== indexState.detailRenderToken) return;
      detailFrameWrap.innerHTML = "";
      const failed = document.createElement("div");
      failed.className = "placeholder-item";
      failed.textContent = `Failed to load projects/${project.key}.html`;
      detailFrameWrap.appendChild(failed);
      console.error(error);
    }
  }

  function applyRoute(route) {
    const validRoute = route || { view: "home" };
    const refs = indexState.refs;
    if (!refs) return;

    let nextRoute = validRoute;
    if (validRoute.view === "project" && !indexState.projectMap.has(validRoute.key)) {
      nextRoute = { view: "projects" };
    }

    const isHome = nextRoute.view === "home";
    const isProjects = nextRoute.view === "projects";
    const isProjectDetail = nextRoute.view === "project";

    refs.defaultStack.hidden = !isHome;
    refs.defaultStack.style.display = isHome ? "" : "none";
    refs.overviewCard.hidden = !isProjects;
    refs.overviewCard.style.display = isProjects ? "" : "none";
    refs.detailCard.hidden = !isProjectDetail;
    refs.detailCard.style.display = isProjectDetail ? "" : "none";

    if (refs.rightColumn) {
      refs.rightColumn.classList.toggle("route-home", isHome);
      refs.rightColumn.classList.toggle("route-projects", isProjects);
      refs.rightColumn.classList.toggle("route-project", isProjectDetail);
    }
    indexState.currentRoute = nextRoute;

    if (nextRoute.view === "project") {
      renderProjectDetail(indexState.projectMap.get(nextRoute.key));
    }

    renderRouteNav(nextRoute);
  }

  function navigateToRoute(route, options) {
    const replaceState = options && options.replaceState;
    const hash = buildHash(route);

    applyRoute(route);

    if (replaceState) {
      replaceHash(route);
      return;
    }

    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }

  function rerenderIndexProjectViews() {
    clearIntervals(indexState.intervals);
    renderHomeView();
    renderOverviewView(indexState.refs.overviewView, {
      lang: indexState.lang,
      intervalStore: indexState.intervals,
      onOpen: (project) => navigateToRoute({ view: "project", key: project.key })
    });

    if (indexState.currentRoute.view === "project") {
      renderProjectDetail(indexState.projectMap.get(indexState.currentRoute.key));
    }
    renderRouteNav(indexState.currentRoute);
  }

  function handleIndexMessage(event) {
    if (event.origin !== window.location.origin) return;
    const payload = event.data;
    if (!payload || typeof payload !== "object") return;
    if (payload.type !== "project:navigate") return;

    if (payload.route === "home") {
      navigateToRoute({ view: "home" });
      return;
    }
    if (payload.route === "projects") {
      navigateToRoute({ view: "projects" });
      return;
    }
    if (payload.route === "project" && payload.key) {
      navigateToRoute({ view: "project", key: cleanText(payload.key) });
    }
  }

  async function initIndexPage(options) {
    const refs = collectIndexRefs();
    if (!refs.homeView || !refs.overviewView || !refs.defaultStack || !refs.overviewCard || !refs.detailCard) {
      return;
    }

    const settings = options && options.settings ? options.settings : {};
    applyProjectSettings(settings);

    const [catalog, publicationCatalog] = await Promise.all([
      loadProjectsCatalog(""),
      loadPublicationsCatalog("")
    ]);
    const projects = normalizeProjectsCatalog(catalog, "");
    indexState.projects = projects;
    indexState.projectMap = new Map(projects.map((project) => [project.key, project]));
    const publicationItems = normalizePublicationsCatalog(publicationCatalog || {}, "");
    indexState.publicationsMap = new Map(publicationItems.map((pub) => [pub.ref_key, pub]));
    indexState.publicationAuthorKeywords =
      settings && settings.publications && Array.isArray(settings.publications.author_highlight_keywords)
        ? settings.publications.author_highlight_keywords.map((name) => cleanText(name)).filter(Boolean)
        : ["Fanding Xu", "徐凡丁"];
    indexState.refs = refs;

    function setLang(nextLang) {
      if (nextLang === indexState.lang) return;
      indexState.lang = nextLang;
      createLanguageToggle(refs.projectsHomeLangToggle, indexState.lang, setLang);
      createLanguageToggle(refs.projectsOverviewLangToggle, indexState.lang, setLang);
      createLanguageToggle(refs.detailLangToggle, indexState.lang, setLang);
      const detailContent = refs.detailFrameWrap && refs.detailFrameWrap.querySelector(".project-detail-content");
      applyProjectContentLanguage(detailContent, indexState.lang);
      rerenderIndexProjectViews();
    }

    createLanguageToggle(refs.projectsHomeLangToggle, indexState.lang, setLang);
    createLanguageToggle(refs.projectsOverviewLangToggle, indexState.lang, setLang);
    createLanguageToggle(refs.detailLangToggle, indexState.lang, setLang);

    if (!indexState.initialized) {
      if (refs.projectsSectionNav) {
        refs.projectsSectionNav.addEventListener("click", () => {
          navigateToRoute({ view: "projects" });
        });
      }
      if (refs.detailBackButton) {
        refs.detailBackButton.addEventListener("click", () => {
          navigateToRoute({ view: "projects" });
        });
      }
      if (refs.projectsOverviewHomeBtn) {
        refs.projectsOverviewHomeBtn.addEventListener("click", () => {
          navigateToRoute({ view: "home" });
        });
      }

      window.addEventListener("hashchange", () => {
        applyRoute(parseHashRoute(window.location.hash));
      });
      window.addEventListener("message", handleIndexMessage);
      window.addEventListener("resize", () => {
        if (indexState.resizeTimer) clearTimeout(indexState.resizeTimer);
        indexState.resizeTimer = setTimeout(() => {
          rerenderIndexProjectViews();
        }, 120);
      });
    }

    rerenderIndexProjectViews();
    const initialRoute = parseHashRoute(window.location.hash);
    applyRoute(initialRoute);
    if (!window.location.hash) {
      replaceHash(initialRoute);
    }
    indexState.initialized = true;
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

  function renderPublicationList(container, publications, options) {
    container.innerHTML = "";
    if (!publications.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "No related publications linked yet.";
      container.appendChild(empty);
      return;
    }

    const keywords = Array.isArray(options.authorKeywords) ? options.authorKeywords : [];
    const onOpenGraphAbs = typeof options.onOpenGraphAbs === "function" ? options.onOpenGraphAbs : null;
    const showGraphAbs = options.showGraphAbs !== false;

    publications.forEach((pub) => {
      const item = document.createElement("article");
      item.className = "publication-item";
      if (pub.ref_key) item.dataset.pubKey = pub.ref_key;

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
        const icon = document.createElement("i");
        icon.className = "publication-title-doi-icon fa-solid fa-link";
        icon.setAttribute("aria-hidden", "true");
        titleLink.appendChild(icon);
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
        authors.appendChild(buildAuthorsFragment(pub.authors, keywords));
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

      if (showGraphAbs && pub.graph_abs) {
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
        if (onOpenGraphAbs) {
          graphWrap.addEventListener("click", () => onOpenGraphAbs(pub.graph_abs, graphImg.alt));
        }
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

      container.appendChild(item);
    });
  }

  function renderStandaloneRouteNav(nav, entries) {
    if (!nav) return;
    nav.innerHTML = "";

    entries.forEach((entry, index) => {
      if (index > 0) addRouteSeparator(nav);
      nav.appendChild(createRouteItem(entry.label, Boolean(entry.current), entry.onClick));
    });
  }

  async function initProjectDocOnlyPage() {
    const projectDoc = document.querySelector("[data-project-doc]");
    if (!projectDoc) return;
    if (document.getElementById("main-content")) return;
    if (document.getElementById("projects-standalone-root")) return;
    if (document.getElementById("project-standalone-root")) return;

    const basePrefix = getBasePrefix();
    const [settings, projectCatalog, publicationCatalog] = await Promise.all([
      loadSettings(basePrefix),
      loadProjectsCatalog(basePrefix),
      loadPublicationsCatalog(basePrefix)
    ]);

    const projects = normalizeProjectsCatalog(projectCatalog, basePrefix);
    const projectMap = new Map(projects.map((project) => [project.key, project]));
    const publicationItems = normalizePublicationsCatalog(publicationCatalog || {}, basePrefix);
    const publicationMap = new Map(publicationItems.map((pub) => [pub.ref_key, pub]));
    const authorKeywords =
      settings && settings.publications && Array.isArray(settings.publications.author_highlight_keywords)
        ? settings.publications.author_highlight_keywords.map((name) => cleanText(name)).filter(Boolean)
        : ["Fanding Xu", "徐凡丁"];

    const keyFromDoc = cleanText(projectDoc.getAttribute("data-project-key"));
    const keyFromBody = cleanText(document.body && document.body.getAttribute("data-project-key"));
    const keyFromPath = cleanText((window.location.pathname.split("/").pop() || "").replace(/\.html$/i, ""));
    const projectKey = keyFromDoc || keyFromBody || keyFromPath;
    const project = projectMap.get(projectKey);
    if (!project) return;

    document.title = `${getProjectTitle(project, "en")} | Project`;
    ensureAutoSummarySection(projectDoc, project);
    const publicationSlot = ensureRelatedPublicationsSlot(projectDoc);
    const relatedItems = project.related_publications
      .map((key) => publicationMap.get(key))
      .filter(Boolean);
    renderPublicationList(publicationSlot, relatedItems, {
      authorKeywords,
      onOpenGraphAbs: null,
      showGraphAbs: false
    });

    let currentLang = "zh";
    document.body.classList.add("project-doc-page");
    document.body.classList.add("lang-zh");

    const toggleHost = document.querySelector("[data-project-slot='lang-toggle']");
    if (toggleHost) {
      function setLang(nextLang) {
        if (nextLang === currentLang) return;
        currentLang = nextLang;
        document.body.classList.toggle("lang-en", currentLang !== "zh");
        document.body.classList.toggle("lang-zh", currentLang === "zh");
        createLanguageToggle(toggleHost, currentLang, setLang);
      }
      createLanguageToggle(toggleHost, currentLang, setLang);
    }
  }

  async function initStandaloneProjectsPage() {
    const root = document.getElementById("projects-standalone-root");
    if (!root) return;

    const [settings, catalog] = await Promise.all([loadSettings(""), loadProjectsCatalog("")]);
    applyProjectSettings(settings);
    const projects = normalizeProjectsCatalog(catalog, "");

    const langState = { lang: "zh", intervals: [] };
    const langToggle = document.getElementById("projects-standalone-lang-toggle");
    const view = document.getElementById("projects-standalone-overview-view");
    const nav = document.getElementById("projects-standalone-route-nav");

    renderStandaloneRouteNav(nav, [
      { label: "Home", current: false, onClick: () => (window.location.href = "index.html#home") },
      { label: "Projects", current: true, onClick: null }
    ]);

    function render() {
      clearIntervals(langState.intervals);
      const previousProjects = indexState.projects;
      const previousSettings = indexState.settings;
      indexState.projects = projects;
      indexState.settings = {
        ...indexState.settings,
        imageCarouselSeconds: normalizePositiveInteger(
          settings && settings.projects && settings.projects.image_carousel_seconds,
          DEFAULT_PROJECT_SETTINGS.imageCarouselSeconds,
          120
        )
      };
      renderOverviewView(view, {
        lang: langState.lang,
        intervalStore: langState.intervals,
        onOpen: (project) => {
          window.location.href = `index.html#projects/${encodeURIComponent(project.key)}`;
        }
      });
      indexState.projects = previousProjects;
      indexState.settings = previousSettings;
    }

    function setLang(nextLang) {
      if (nextLang === langState.lang) return;
      langState.lang = nextLang;
      createLanguageToggle(langToggle, langState.lang, setLang);
      render();
    }

    createLanguageToggle(langToggle, langState.lang, setLang);
    render();
  }

  async function initStandaloneProjectPage() {
    const root = document.getElementById("project-standalone-root");
    if (!root) return;
    const isEmbedded = String(window.location.hash || "").replace(/^#/, "") === "embedded";
    if (isEmbedded) {
      document.body.classList.add("project-embedded");
    }

    const basePrefix = getBasePrefix();
    const [settings, projectCatalog, publicationsCatalog] = await Promise.all([
      loadSettings(basePrefix),
      loadProjectsCatalog(basePrefix),
      loadPublicationsCatalog(basePrefix)
    ]);

    applyProjectSettings(settings);

    const projects = normalizeProjectsCatalog(projectCatalog, basePrefix);
    const projectMap = new Map(projects.map((project) => [project.key, project]));
    const publicationItems = normalizePublicationsCatalog(publicationsCatalog || {}, basePrefix);
    const publicationMap = new Map(publicationItems.map((pub) => [pub.ref_key, pub]));
    const authorKeywords =
      settings && settings.publications && Array.isArray(settings.publications.author_highlight_keywords)
        ? settings.publications.author_highlight_keywords.map((name) => cleanText(name)).filter(Boolean)
        : ["Fanding Xu", "徐凡丁"];

    const keyFromData = cleanText(root.dataset.projectKey);
    const pathPart = window.location.pathname.split("/").pop() || "";
    const keyFromFileName = pathPart.replace(/\.html$/i, "");
    const projectKey = keyFromData || keyFromFileName;
    const project = projectMap.get(projectKey);

    const titleEl = document.getElementById("project-single-title");
    const absEnEl = document.getElementById("project-single-abs-en");
    const absZhEl = document.getElementById("project-single-abs-zh");
    const gallery = document.getElementById("project-single-gallery");
    const publicationsWrap = document.getElementById("project-single-publications");
    const backButton = document.getElementById("project-single-back-btn");
    const routeNav = document.getElementById("project-standalone-route-nav");
    const modal = document.getElementById("project-graph-abs-modal");
    const modalImg = document.getElementById("project-graph-abs-modal-img");
    const modalClose = document.getElementById("project-graph-abs-modal-close");

    function postParentRoute(route, key) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "project:navigate",
            route,
            key: key || ""
          },
          window.location.origin
        );
        return true;
      }
      return false;
    }

    function goHome() {
      if (postParentRoute("home")) return;
      window.location.href = `${basePrefix}index.html#home`;
    }

    function goProjects() {
      if (postParentRoute("projects")) return;
      window.location.href = `${basePrefix}index.html#projects`;
    }

    if (backButton) {
      backButton.addEventListener("click", goProjects);
    }

    renderStandaloneRouteNav(routeNav, [
      { label: "Home", current: false, onClick: goHome },
      { label: "Projects", current: false, onClick: goProjects },
      { label: projectKey || "Project", current: true, onClick: null }
    ]);

    function openGraphAbsModal(src, alt) {
      if (!modal || !modalImg || !src) return;
      modalImg.src = src;
      modalImg.alt = alt || "Graphical abstract";
      modal.hidden = false;
      document.body.classList.add("modal-open");
    }

    function closeGraphAbsModal() {
      if (!modal || !modalImg) return;
      modal.hidden = true;
      modalImg.src = "";
      modalImg.alt = "Graphical abstract";
      document.body.classList.remove("modal-open");
    }

    if (modalClose) {
      modalClose.addEventListener("click", closeGraphAbsModal);
    }
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeGraphAbsModal();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal && !modal.hidden) closeGraphAbsModal();
    });

    if (!project) {
      if (titleEl) titleEl.textContent = "Project not found";
      if (absEnEl) absEnEl.textContent = "Cannot find this project key in config/projects.json.";
      if (absZhEl) absZhEl.textContent = "未在 config/projects.json 中找到该项目。";
      if (gallery) gallery.innerHTML = "";
      if (publicationsWrap) {
        publicationsWrap.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "placeholder-item";
        empty.textContent = "No related publications linked yet.";
        publicationsWrap.appendChild(empty);
      }
      return;
    }

    document.title = `${getProjectTitle(project, "en")} | Project`;
    if (titleEl) titleEl.textContent = `${project.title_en || project.key} | ${project.title_zh || "项目"}`;
    if (absEnEl) absEnEl.textContent = project.abs_en || "No English abstract provided.";
    if (absZhEl) absZhEl.textContent = project.abs_zh || "暂无中文摘要。";

    if (gallery) {
      gallery.innerHTML = "";
      const images = project.imgs.length ? project.imgs : [createImagePlaceholderDataUri(getProjectTitle(project, "en"))];
      images.forEach((src, index) => {
        const item = document.createElement("div");
        item.className = "project-single-gallery-item";
        const img = document.createElement("img");
        img.src = src;
        img.alt = `${getProjectTitle(project, "en")} image ${index + 1}`;
        img.loading = "lazy";
        img.decoding = "async";
        item.appendChild(img);
        gallery.appendChild(item);
      });
    }

    if (publicationsWrap) {
      const related = project.related_publications
        .map((key) => publicationMap.get(key))
        .filter(Boolean);
      renderPublicationList(publicationsWrap, related, {
        authorKeywords,
        onOpenGraphAbs: null,
        showGraphAbs: false
      });
    }
  }

  function bootstrapStandalonePages() {
    const docOnlyRoot = document.querySelector("[data-project-doc]");
    if (docOnlyRoot) {
      initProjectDocOnlyPage().catch((error) => console.error(error));
    }

    const standaloneProjectsRoot = document.getElementById("projects-standalone-root");
    if (standaloneProjectsRoot) {
      initStandaloneProjectsPage().catch((error) => console.error(error));
    }

    const standaloneProjectRoot = document.getElementById("project-standalone-root");
    if (standaloneProjectRoot) {
      initStandaloneProjectPage().catch((error) => console.error(error));
    }
  }

  window.ProjectFeature = {
    initIndexPage
  };

  bootstrapStandalonePages();
})();
