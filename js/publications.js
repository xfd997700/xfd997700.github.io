(function () {
  "use strict";

  const refs = {
    homeSortBtn: document.getElementById("publications-sort-btn"),
    homeGraphAbsBtn: document.getElementById("publications-graph-abs-btn"),
    homeFilterBtn: document.getElementById("publications-filter-btn"),
    homeFilterPanel: document.getElementById("publications-filter-panel"),
    homeMinInput: document.getElementById("publications-filter-min-year"),
    homeMaxInput: document.getElementById("publications-filter-max-year"),
    homeApplyBtn: document.getElementById("publications-filter-apply-btn"),
    homeResetBtn: document.getElementById("publications-filter-reset-btn"),
    homeList: document.getElementById("publications-list"),
    homePagination: document.getElementById("publications-pagination"),
    pageSortBtn: document.getElementById("publications-page-sort-btn"),
    pageGraphAbsBtn: document.getElementById("publications-page-graph-abs-btn"),
    pageFilterBtn: document.getElementById("publications-page-filter-btn"),
    pageFilterPanel: document.getElementById("publications-page-filter-panel"),
    pageMinInput: document.getElementById("publications-page-filter-min-year"),
    pageMaxInput: document.getElementById("publications-page-filter-max-year"),
    pageApplyBtn: document.getElementById("publications-page-filter-apply-btn"),
    pageResetBtn: document.getElementById("publications-page-filter-reset-btn"),
    pageView: document.getElementById("publications-page-view"),
    pagePagination: document.getElementById("publications-page-pagination"),
    pageViewToggle: document.getElementById("publications-page-view-toggle"),
    modal: document.getElementById("graph-abs-modal"),
    modalImg: document.getElementById("graph-abs-modal-img"),
    modalClose: document.getElementById("graph-abs-modal-close"),
    detailModal: document.getElementById("publication-detail-modal"),
    detailModalClose: document.getElementById("publication-detail-modal-close"),
    detailYear: document.getElementById("publication-detail-year"),
    detailVenue: document.getElementById("publication-detail-venue"),
    detailTitle: document.getElementById("publication-detail-title"),
    detailAuthors: document.getElementById("publication-detail-authors"),
    detailAbsWrap: document.getElementById("publication-detail-abs-wrap"),
    detailAbs: document.getElementById("publication-detail-abs"),
    detailGraphWrap: document.getElementById("publication-detail-graph-wrap"),
    detailGraphImg: document.getElementById("publication-detail-graph-img"),
    detailDoiLine: document.getElementById("publication-detail-doi-line"),
    detailDoiLink: document.getElementById("publication-detail-doi-link")
  };

  const state = {
    initialized: false,
    items: [],
    authorKeywords: ["Fanding Xu", "徐凡丁"],
    cardTitleLinkEnabled: true,
    detailTitleLinkEnabled: true,
    home: { sortMode: "default", minYear: "", maxYear: "", page: 1, pageSize: 5, showGraphAbs: true },
    page: {
      sortMode: "default",
      minYear: "",
      maxYear: "",
      page: 1,
      mode: "list",
      listPageSize: 10,
      gridRows: 3,
      gridCols: 3,
      gridPageSize: 9,
      listShowGraphAbs: true,
      gridShowGraphAbs: false
    }
  };

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizePositiveInteger(value, fallback, maxValue) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, maxValue);
  }

  function normalizeNonNegativeNumber(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
  }

  function normalizeGridShape(value, fallbackRows, fallbackCols) {
    if (!Array.isArray(value) || value.length < 2) {
      return null;
    }
    const rows = normalizePositiveInteger(value[0], fallbackRows, 20);
    const cols = normalizePositiveInteger(value[1], fallbackCols, 20);
    if (!rows || !cols) return null;
    return [rows, cols];
  }

  function isMobileViewport() {
    if (!window || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 700px)").matches;
  }

  function normalizeDoi(doi) {
    return cleanText(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  }

  function buildDoiUrl(doi) {
    const normalized = normalizeDoi(doi);
    if (!normalized) return "";
    return `https://doi.org/${encodeURIComponent(normalized).replace(/%2F/gi, "/")}`;
  }

  function normalizeAuthorKeyword(value) {
    return cleanText(value).toLowerCase().replace(/[.*†‡]/g, "").replace(/\s+/g, "");
  }

  function shouldHighlightAuthor(authorName, keywords) {
    const normalized = normalizeAuthorKeyword(authorName);
    if (!normalized) return false;
    return keywords.some((keyword) => {
      const normalizedKeyword = normalizeAuthorKeyword(keyword);
      return normalizedKeyword && (normalized === normalizedKeyword || normalized.includes(normalizedKeyword));
    });
  }

  function buildAuthorsFragment(authorsText, keywords) {
    const fragment = document.createDocumentFragment();
    const parts = cleanText(authorsText)
      .split(/[;,，]/)
      .map((part) => cleanText(part))
      .filter(Boolean);
    if (!parts.length) return fragment;
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

  function formatAuthorList(authors) {
    if (!Array.isArray(authors)) return cleanText(authors);
    return authors
      .map((author) => {
        if (typeof author === "string") return cleanText(author);
        if (!author || typeof author !== "object") return "";
        return cleanText(`${cleanText(author.given)} ${cleanText(author.family)}`);
      })
      .filter(Boolean)
      .join(", ");
  }

  function parseCrossrefMessage(message) {
    if (!message || typeof message !== "object") return null;
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

  async function fetchByDoi(doi, options) {
    const normalized = normalizeDoi(doi);
    if (!normalized) return { status: "empty", data: null };

    const timeoutMs = normalizePositiveInteger(options && options.timeoutMs, 12000, 60000);
    const proxyPrefix = cleanText(options && options.proxyUrlPrefix);
    const directUrl = `https://api.crossref.org/works/${encodeURIComponent(normalized)}`;
    const targetUrl = proxyPrefix ? `${proxyPrefix}${encodeURIComponent(directUrl)}` : directUrl;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(targetUrl, { cache: "no-store", signal: controller.signal });
      if (response.status === 404) return { status: "not_found", data: null };
      if (response.status === 429) return { status: "rate_limited", data: null };
      if (!response.ok) return { status: `http_${response.status}`, data: null };
      const payload = await response.json();
      const parsed = parseCrossrefMessage(payload && payload.message ? payload.message : payload);
      return parsed ? { status: "ok", data: parsed } : { status: "invalid_payload", data: null };
    } catch (error) {
      return { status: error && error.name === "AbortError" ? "timeout" : "network", data: null };
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizePublicationLocal(pub, refKey) {
    if (!pub || typeof pub !== "object") return null;
    const doi = normalizeDoi(pub.doi);
    const title = cleanText(pub.title);
    if (!doi && !title) return null;
    return {
      ref_key: cleanText(refKey),
      doi,
      title,
      authors: formatAuthorList(pub.authors),
      year: cleanText(pub.year),
      journal: cleanText(pub.journal),
      volume: cleanText(pub.volume),
      page: cleanText(pub.page),
      abs: cleanText(pub.abs),
      graph_abs: cleanText(pub.graph_abs),
      doi_link: buildDoiUrl(doi)
    };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  async function resolvePublications(catalog, settings, onUpdate) {
    const rawEntries = catalog && catalog.publications && typeof catalog.publications === "object"
      ? Object.entries(catalog.publications)
      : [];
    const resolved = rawEntries.map(([refKey, item]) => normalizePublicationLocal(item, refKey)).filter(Boolean);
    if (typeof onUpdate === "function") onUpdate([...resolved]);

    const pubSettings = (settings && settings.publications) || {};
    if (pubSettings.resolve_doi_enabled === false) return resolved;
    const timeoutMs = pubSettings.doi_timeout_ms !== undefined ? pubSettings.doi_timeout_ms : 12000;
    const reqIntervalMs = pubSettings.doi_request_interval_ms !== undefined
      ? normalizePositiveInteger(pubSettings.doi_request_interval_ms, 300, 60000)
      : 300;
    const stopAfterFailures = pubSettings.doi_stop_after_failures !== undefined
      ? normalizePositiveInteger(pubSettings.doi_stop_after_failures, 5, 100)
      : 5;
    const proxyPrefix = cleanText(pubSettings.doi_proxy_url_prefix);

    let failures = 0;
    for (let i = 0; i < resolved.length; i += 1) {
      if (!resolved[i].doi) continue;
      const result = await fetchByDoi(resolved[i].doi, { timeoutMs, proxyUrlPrefix: proxyPrefix });
      if (result.status === "ok" && result.data) {
        const doi = result.data.doi || resolved[i].doi;
        resolved[i] = {
          ...resolved[i],
          doi,
          doi_link: buildDoiUrl(doi),
          title: result.data.title || resolved[i].title,
          authors: result.data.authors || resolved[i].authors,
          year: result.data.year || resolved[i].year,
          journal: result.data.journal || resolved[i].journal,
          volume: result.data.volume || resolved[i].volume,
          page: result.data.page || resolved[i].page
        };
        failures = 0;
        if (typeof onUpdate === "function") onUpdate([...resolved]);
      } else {
        failures += 1;
        if (result.status === "network" && !proxyPrefix) break;
        if (failures >= stopAfterFailures) break;
      }
      if (i < resolved.length - 1) {
        await wait(result.status === "rate_limited" ? reqIntervalMs * 2 : reqIntervalMs);
      }
    }
    return resolved;
  }

  function parsePublicationYear(pub) {
    const match = cleanText(pub && pub.year).match(/\d{4}/);
    return match ? parseInt(match[0], 10) : 0;
  }

  function getPreparedPublications(items, viewState) {
    const minRaw = parseInt(String(viewState.minYear || "").trim(), 10);
    const maxRaw = parseInt(String(viewState.maxYear || "").trim(), 10);
    let minYear = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : null;
    let maxYear = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : null;
    if (minYear !== null && maxYear !== null && minYear > maxYear) {
      const t = minYear;
      minYear = maxYear;
      maxYear = t;
    }

    const ordered = viewState.sortMode === "year"
      ? items.map((item, index) => ({ item, index })).sort((a, b) => {
        const ay = parsePublicationYear(a.item);
        const by = parsePublicationYear(b.item);
        return by === ay ? a.index - b.index : by - ay;
      }).map((entry) => entry.item)
      : items;

    return ordered.filter((pub) => {
      if (minYear === null && maxYear === null) return true;
      const year = parsePublicationYear(pub);
      if (!year) return false;
      if (minYear !== null && year < minYear) return false;
      if (maxYear !== null && year > maxYear) return false;
      return true;
    });
  }

  function paginate(items, page, pageSize) {
    const size = normalizePositiveInteger(pageSize, 10, 200);
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const parsedPage = parseInt(page, 10);
    const safePage = Math.min(Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1), totalPages);
    return {
      page: safePage,
      totalPages,
      items: items.slice((safePage - 1) * size, safePage * size)
    };
  }

  function createPublicationTitle(pub, className, options) {
    const enableLink = !(options && options.enableLink === false);
    const doiUrl = enableLink ? (pub.doi_link || buildDoiUrl(pub.doi)) : "";
    const title = document.createElement(doiUrl ? "a" : "div");
    title.className = className;
    const text = document.createElement("span");
    text.textContent = pub.title || "Untitled";
    title.appendChild(text);
    if (doiUrl) {
      title.href = doiUrl;
      title.target = "_blank";
      title.rel = "noreferrer";
      const icon = document.createElement("i");
      icon.className = "publication-title-doi-icon fa-solid fa-link";
      icon.setAttribute("aria-hidden", "true");
      title.appendChild(icon);
    }
    return title;
  }

  function getPublicationVenueText(pub) {
    const venueParts = [];
    if (pub && pub.journal) venueParts.push(pub.journal);
    if (pub && pub.volume) venueParts.push(`Vol. ${pub.volume}`);
    if (pub && pub.page) venueParts.push(`pp. ${pub.page}`);
    return venueParts.join(" | ");
  }

  function bindPublicationItemOpen(host, pub) {
    if (!host || !pub) return;
    host.classList.add("publication-item-clickable");
    host.setAttribute("role", "button");
    host.setAttribute("aria-label", `Open publication details for ${cleanText(pub.title) || "publication"}`);
    host.tabIndex = 0;

    host.addEventListener("click", (event) => {
      if (event.target && event.target.closest("a, button")) return;
      openPublicationDetailModal(pub);
    });

    host.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target && event.target.closest("a, button")) return;
      event.preventDefault();
      openPublicationDetailModal(pub);
    });
  }

  function createPublicationItem(pub, options) {
    const showGraphAbs = options && options.showGraphAbs !== false;
    const item = document.createElement("article");
    item.className = "publication-item";
    if (pub.ref_key) item.dataset.pubKey = pub.ref_key;
    const head = document.createElement("div");
    head.className = "publication-head";
    head.appendChild(createPublicationTitle(pub, "publication-title", { enableLink: state.cardTitleLinkEnabled }));
    if (pub.year) {
      const yearBadge = document.createElement("span");
      yearBadge.className = "publication-year";
      yearBadge.textContent = pub.year;
      head.appendChild(yearBadge);
    }
    item.appendChild(head);
    bindPublicationItemOpen(item, pub);
    if (pub.authors) {
      const authors = document.createElement("div");
      authors.className = "publication-authors";
      authors.appendChild(buildAuthorsFragment(pub.authors, state.authorKeywords));
      item.appendChild(authors);
    }
    const venueText = getPublicationVenueText(pub);
    if (venueText) {
      const venue = document.createElement("div");
      venue.className = "publication-venue";
      venue.textContent = venueText;
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
      graphWrap.addEventListener("click", (event) => {
        event.stopPropagation();
        openGraphAbsModal(pub.graph_abs, graphImg.alt);
      });
      item.appendChild(graphWrap);
    }
    if (pub.doi) {
      const doiLine = document.createElement("div");
      doiLine.className = "publication-doi-line";
      const label = document.createElement("span");
      label.textContent = "DOI: ";
      doiLine.appendChild(label);
      const link = document.createElement("a");
      link.href = pub.doi_link || buildDoiUrl(pub.doi);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = pub.doi;
      doiLine.appendChild(link);
      item.appendChild(doiLine);
    }
    return item;
  }

  function createPublicationGridItem(pub, options) {
    const showGraphAbs = options && options.showGraphAbs !== false;
    const hasGraphAbs = showGraphAbs && Boolean(pub.graph_abs);
    const item = document.createElement("article");
    item.className = `publication-grid-item ${hasGraphAbs ? "is-rich" : "is-compact"}`;
    const head = document.createElement("div");
    head.className = "publication-grid-head";
    head.appendChild(createPublicationTitle(pub, "publication-grid-title", { enableLink: state.cardTitleLinkEnabled }));
    if (pub.year) {
      const year = document.createElement("span");
      year.className = "publication-grid-year";
      year.textContent = pub.year;
      head.appendChild(year);
    }
    item.appendChild(head);
    bindPublicationItemOpen(item, pub);
    if (pub.authors) {
      const authors = document.createElement("div");
      authors.className = "publication-grid-authors";
      authors.appendChild(buildAuthorsFragment(pub.authors, state.authorKeywords));
      item.appendChild(authors);
    }
    const venueText = getPublicationVenueText(pub);
    if (venueText) {
      const venue = document.createElement("div");
      venue.className = "publication-grid-venue";
      venue.textContent = venueText;
      item.appendChild(venue);
    }
    if (hasGraphAbs) {
      const graphWrap = document.createElement("button");
      graphWrap.type = "button";
      graphWrap.className = "publication-grid-graph";
      graphWrap.setAttribute("aria-label", `Open graphical abstract for ${pub.title || "publication"}`);
      const graphImg = document.createElement("img");
      graphImg.src = pub.graph_abs;
      graphImg.alt = `${pub.title || "Publication"} graphical abstract`;
      graphImg.loading = "lazy";
      graphImg.decoding = "async";
      graphWrap.appendChild(graphImg);
      graphWrap.addEventListener("click", (event) => {
        event.stopPropagation();
        openGraphAbsModal(pub.graph_abs, graphImg.alt);
      });
      item.appendChild(graphWrap);
    }
    if (pub.doi) {
      const doiLine = document.createElement("div");
      doiLine.className = "publication-grid-doi-line";
      const label = document.createElement("span");
      label.textContent = "DOI: ";
      doiLine.appendChild(label);
      const link = document.createElement("a");
      link.href = pub.doi_link || buildDoiUrl(pub.doi);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = pub.doi;
      doiLine.appendChild(link);
      item.appendChild(doiLine);
    }
    return item;
  }

  function createPaginationButton(label, onClick, disabled, isCurrent) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `publication-page-btn${isCurrent ? " is-current" : ""}`;
    button.disabled = disabled;
    button.textContent = label;
    if (!disabled) button.addEventListener("click", onClick);
    return button;
  }

  function renderPagination(container, page, totalPages, onNavigate) {
    if (!container) return;
    container.innerHTML = "";
    if (totalPages <= 1) return;
    const wrap = document.createElement("div");
    wrap.className = "publication-page-wrap";
    wrap.appendChild(createPaginationButton("«", () => onNavigate(1), page <= 1, false));
    wrap.appendChild(createPaginationButton("‹", () => onNavigate(page - 1), page <= 1, false));
    const pages = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let p = start; p <= end; p += 1) pages.push(p);
    if (totalPages > 1) pages.push(totalPages);
    let last = 0;
    pages.forEach((p) => {
      if (p - last > 1) {
        const ellipsis = document.createElement("span");
        ellipsis.className = "publication-page-ellipsis";
        ellipsis.textContent = "...";
        wrap.appendChild(ellipsis);
      }
      wrap.appendChild(createPaginationButton(String(p), () => onNavigate(p), false, p === page));
      last = p;
    });
    wrap.appendChild(createPaginationButton("›", () => onNavigate(page + 1), page >= totalPages, false));
    wrap.appendChild(createPaginationButton("»", () => onNavigate(totalPages), page >= totalPages, false));
    container.appendChild(wrap);
  }

  function updateSortButton(button, sortMode) {
    if (!button) return;
    const isYearMode = sortMode === "year";
    button.textContent = isYearMode ? "Sort by Default" : "Sort by Year";
    button.setAttribute("aria-pressed", isYearMode ? "true" : "false");
  }

  function updateFilterButton(button, viewState) {
    if (!button) return;
    const active = Boolean(cleanText(viewState.minYear) || cleanText(viewState.maxYear));
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.classList.toggle("is-active", active);
  }

  function updateGraphAbsButton(button, isShown) {
    if (!button) return;
    const shown = Boolean(isShown);
    const title = shown
      ? "Hide graphical abstracts | 隐藏图形摘要"
      : "Show graphical abstracts | 显示图形摘要";
    button.setAttribute("aria-pressed", shown ? "true" : "false");
    button.setAttribute("title", title);
    button.setAttribute("aria-label", title);
    button.classList.toggle("is-active", shown);

    const icon = button.querySelector("i");
    if (icon) {
      icon.classList.remove(shown ? "fa-regular" : "fa-solid");
      icon.classList.add(shown ? "fa-solid" : "fa-regular");
    }
  }

  function syncFilterInputs(viewState, minInput, maxInput) {
    if (minInput && document.activeElement !== minInput) minInput.value = viewState.minYear || "";
    if (maxInput && document.activeElement !== maxInput) maxInput.value = viewState.maxYear || "";
  }

  function parseFilterYearInput(input) {
    const raw = cleanText(input ? input.value : "");
    if (!raw) return "";
    const match = raw.match(/\d{4}/);
    if (!match) return "";
    const year = parseInt(match[0], 10);
    return Number.isFinite(year) && year > 0 ? String(year) : "";
  }

  function applyFilterInputs(viewState, minInput, maxInput) {
    let minYear = parseFilterYearInput(minInput);
    let maxYear = parseFilterYearInput(maxInput);
    if (minYear && maxYear && parseInt(minYear, 10) > parseInt(maxYear, 10)) {
      const t = minYear;
      minYear = maxYear;
      maxYear = t;
    }
    viewState.minYear = minYear;
    viewState.maxYear = maxYear;
    if (minInput) minInput.value = minYear;
    if (maxInput) maxInput.value = maxYear;
    viewState.page = 1;
  }

  function resetFilterInputs(viewState, minInput, maxInput) {
    viewState.minYear = "";
    viewState.maxYear = "";
    if (minInput) minInput.value = "";
    if (maxInput) maxInput.value = "";
    viewState.page = 1;
  }

  function updateViewToggle() {
    if (!refs.pageViewToggle) return;
    refs.pageViewToggle.querySelectorAll("button[data-mode]").forEach((button) => {
      const active = button.dataset.mode === state.page.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function renderHomePublications() {
    if (!refs.homeList) return;
    const filtered = getPreparedPublications(state.items, state.home);
    const page = paginate(filtered, state.home.page, state.home.pageSize);
    state.home.page = page.page;
    refs.homeList.innerHTML = "";
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "No publications match current filter.";
      refs.homeList.appendChild(empty);
    } else {
      page.items.forEach((pub) => refs.homeList.appendChild(createPublicationItem(pub, { showGraphAbs: state.home.showGraphAbs })));
    }
    renderPagination(refs.homePagination, page.page, page.totalPages, (nextPage) => {
      state.home.page = nextPage;
      renderHomePublications();
    });
    updateSortButton(refs.homeSortBtn, state.home.sortMode);
    updateGraphAbsButton(refs.homeGraphAbsBtn, state.home.showGraphAbs);
    updateFilterButton(refs.homeFilterBtn, state.home);
    syncFilterInputs(state.home, refs.homeMinInput, refs.homeMaxInput);
  }

  function renderPublicationsPage() {
    if (!refs.pageView) return;
    const pageState = state.page;
    const filtered = getPreparedPublications(state.items, pageState);
    const pageSize = pageState.mode === "grid" ? pageState.gridPageSize : pageState.listPageSize;
    const showGraphAbs = pageState.mode === "grid" ? pageState.gridShowGraphAbs : pageState.listShowGraphAbs;
    const page = paginate(filtered, pageState.page, pageSize);
    pageState.page = page.page;
    refs.pageView.innerHTML = "";
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-item";
      empty.textContent = "No publications match current filter.";
      refs.pageView.appendChild(empty);
    } else if (pageState.mode === "grid") {
      const grid = document.createElement("div");
      grid.className = "publications-grid";
      page.items.forEach((pub) => grid.appendChild(createPublicationGridItem(pub, { showGraphAbs })));
      refs.pageView.appendChild(grid);
    } else {
      const list = document.createElement("div");
      list.className = "placeholder-list";
      page.items.forEach((pub) => list.appendChild(createPublicationItem(pub, { showGraphAbs })));
      refs.pageView.appendChild(list);
    }
    renderPagination(refs.pagePagination, page.page, page.totalPages, (nextPage) => {
      pageState.page = nextPage;
      renderPublicationsPage();
    });
    updateSortButton(refs.pageSortBtn, pageState.sortMode);
    updateGraphAbsButton(
      refs.pageGraphAbsBtn,
      pageState.mode === "grid" ? pageState.gridShowGraphAbs : pageState.listShowGraphAbs
    );
    updateFilterButton(refs.pageFilterBtn, pageState);
    syncFilterInputs(pageState, refs.pageMinInput, refs.pageMaxInput);
    updateViewToggle();
  }

  function rerenderPublicationViews() {
    renderHomePublications();
    renderPublicationsPage();
  }

  function syncBodyModalState() {
    const graphOpen = Boolean(refs.modal && !refs.modal.hidden);
    const detailOpen = Boolean(refs.detailModal && !refs.detailModal.hidden);
    document.body.classList.toggle("modal-open", graphOpen || detailOpen);
  }

  function openGraphAbsModal(src, alt) {
    if (!refs.modal || !refs.modalImg || !src) return;
    refs.modalImg.src = src;
    refs.modalImg.alt = alt || "Graphical abstract";
    refs.modal.hidden = false;
    syncBodyModalState();
  }

  function closeGraphAbsModal() {
    if (!refs.modal || !refs.modalImg || refs.modal.hidden) return;
    refs.modal.hidden = true;
    refs.modalImg.src = "";
    refs.modalImg.alt = "Graphical abstract";
    syncBodyModalState();
  }

  function openPublicationDetailModal(pub) {
    if (!refs.detailModal || !pub) return;
    const yearText = cleanText(pub.year);
    const venueText = getPublicationVenueText(pub);
    const titleText = cleanText(pub.title) || "Untitled";
    const doiText = cleanText(pub.doi);
    const doiUrl = cleanText(pub.doi_link) || buildDoiUrl(doiText);
    const authorsText = cleanText(pub.authors);
    const absText = cleanText(pub.abs);
    const graphSrc = cleanText(pub.graph_abs);

    if (refs.detailYear) refs.detailYear.textContent = yearText || "N/A";
    if (refs.detailVenue) {
      refs.detailVenue.textContent = venueText || "-";
      refs.detailVenue.hidden = !venueText;
    }
    if (refs.detailTitle) {
      refs.detailTitle.innerHTML = "";
      const titleNode = createPublicationTitle(
        { title: titleText, doi: doiText, doi_link: doiUrl },
        "publication-detail-title-link",
        { enableLink: state.detailTitleLinkEnabled }
      );
      refs.detailTitle.appendChild(titleNode);
    }
    if (refs.detailAuthors) {
      refs.detailAuthors.innerHTML = "";
      if (authorsText) {
        refs.detailAuthors.appendChild(buildAuthorsFragment(authorsText, state.authorKeywords));
      } else {
        refs.detailAuthors.textContent = "Unknown authors";
      }
    }

    if (refs.detailAbsWrap && refs.detailAbs) {
      refs.detailAbsWrap.hidden = !absText;
      refs.detailAbs.textContent = absText;
    }

    if (refs.detailGraphWrap && refs.detailGraphImg) {
      const hasGraph = Boolean(graphSrc);
      refs.detailGraphWrap.hidden = !hasGraph;
      refs.detailGraphImg.src = hasGraph ? graphSrc : "";
      refs.detailGraphImg.alt = hasGraph ? `${titleText} graphical abstract` : "Graphical abstract";
    }

    if (refs.detailDoiLine && refs.detailDoiLink) {
      const hasDoi = Boolean(doiText && doiUrl);
      refs.detailDoiLine.hidden = !hasDoi;
      refs.detailDoiLink.textContent = hasDoi ? doiText : "";
      refs.detailDoiLink.href = hasDoi ? doiUrl : "";
    }

    refs.detailModal.hidden = false;
    syncBodyModalState();
  }

  function closePublicationDetailModal() {
    if (!refs.detailModal || refs.detailModal.hidden) return;
    refs.detailModal.hidden = true;
    if (refs.detailGraphImg) {
      refs.detailGraphImg.src = "";
      refs.detailGraphImg.alt = "Graphical abstract";
    }
    if (refs.detailDoiLine) refs.detailDoiLine.hidden = true;
    if (refs.detailDoiLink) {
      refs.detailDoiLink.textContent = "";
      refs.detailDoiLink.href = "";
    }
    syncBodyModalState();
  }

  function applyPublicationSettings(settings) {
    const rootStyle = document.documentElement.style;
    const pubSettings = settings && settings.publications ? settings.publications : {};

    if (pubSettings.graph_abs_width_px !== undefined) {
      const width = Math.max(120, normalizeNonNegativeNumber(pubSettings.graph_abs_width_px, 520));
      rootStyle.setProperty("--pub-graph-abs-width", `${width}px`);
    }
    if (pubSettings.graph_abs_height_px !== undefined) {
      const height = Math.max(120, normalizeNonNegativeNumber(pubSettings.graph_abs_height_px, 240));
      rootStyle.setProperty("--pub-graph-abs-height", `${height}px`);
    }

    if (Array.isArray(pubSettings.author_highlight_keywords)) {
      state.authorKeywords = pubSettings.author_highlight_keywords.map((name) => cleanText(name)).filter(Boolean);
    }
    state.cardTitleLinkEnabled =
      pubSettings.card_title_link_enabled === undefined ? true : Boolean(pubSettings.card_title_link_enabled);
    state.detailTitleLinkEnabled =
      pubSettings.detail_title_link_enabled === undefined ? true : Boolean(pubSettings.detail_title_link_enabled);

    const home = pubSettings.home && typeof pubSettings.home === "object" ? pubSettings.home : {};
    const page = pubSettings.page && typeof pubSettings.page === "object" ? pubSettings.page : {};
    state.home.pageSize = normalizePositiveInteger(home.page_size, 5, 60);
    state.home.showGraphAbs = home.show_graph_abs === undefined ? true : Boolean(home.show_graph_abs);
    state.page.listPageSize = normalizePositiveInteger(page.list_page_size, 10, 120);
    const shape = normalizeGridShape(page.grid_shape, state.page.gridRows, state.page.gridCols);
    if (shape) {
      state.page.gridRows = shape[0];
      state.page.gridCols = shape[1];
      state.page.gridPageSize = state.page.gridRows * state.page.gridCols;
    } else {
      state.page.gridPageSize = normalizePositiveInteger(page.grid_page_size, state.page.gridPageSize, 120);
      if (!state.page.gridRows || !state.page.gridCols) {
        state.page.gridRows = 3;
        state.page.gridCols = Math.max(1, Math.min(12, state.page.gridPageSize));
      }
    }
    rootStyle.setProperty("--pub-grid-columns", `${Math.max(1, state.page.gridCols)}`);
    const desktopDefaultMode = page.default_view === "grid" ? "grid" : "list";
    const mobileDefaultMode = page.default_view_mobile === "grid" ? "grid" : "list";
    state.page.mode = isMobileViewport() ? mobileDefaultMode : desktopDefaultMode;
    state.page.listShowGraphAbs = page.list_show_graph_abs === undefined ? true : Boolean(page.list_show_graph_abs);
    state.page.gridShowGraphAbs = page.grid_show_graph_abs === undefined ? false : Boolean(page.grid_show_graph_abs);
  }

  async function loadPublicationsCatalog() {
    try {
      const response = await fetch("config/publications.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load config/publications.json");
      return response.json();
    } catch (error) {
      console.warn("Using fallback publications from main config.", error);
      return null;
    }
  }

  function bindEvents() {
    if (refs.homeSortBtn) {
      refs.homeSortBtn.addEventListener("click", () => {
        state.home.sortMode = state.home.sortMode === "year" ? "default" : "year";
        state.home.page = 1;
        renderHomePublications();
      });
    }
    if (refs.homeGraphAbsBtn) {
      refs.homeGraphAbsBtn.addEventListener("click", () => {
        state.home.showGraphAbs = !state.home.showGraphAbs;
        renderHomePublications();
      });
    }
    if (refs.homeFilterBtn) {
      refs.homeFilterBtn.addEventListener("click", () => {
        if (!refs.homeFilterPanel) return;
        refs.homeFilterPanel.hidden = !refs.homeFilterPanel.hidden;
      });
    }
    if (refs.homeApplyBtn) refs.homeApplyBtn.addEventListener("click", () => {
      applyFilterInputs(state.home, refs.homeMinInput, refs.homeMaxInput);
      renderHomePublications();
    });
    if (refs.homeResetBtn) refs.homeResetBtn.addEventListener("click", () => {
      resetFilterInputs(state.home, refs.homeMinInput, refs.homeMaxInput);
      renderHomePublications();
    });

    if (refs.pageSortBtn) refs.pageSortBtn.addEventListener("click", () => {
      state.page.sortMode = state.page.sortMode === "year" ? "default" : "year";
      state.page.page = 1;
      renderPublicationsPage();
    });
    if (refs.pageGraphAbsBtn) {
      refs.pageGraphAbsBtn.addEventListener("click", () => {
        if (state.page.mode === "grid") {
          state.page.gridShowGraphAbs = !state.page.gridShowGraphAbs;
        } else {
          state.page.listShowGraphAbs = !state.page.listShowGraphAbs;
        }
        renderPublicationsPage();
      });
    }
    if (refs.pageFilterBtn) refs.pageFilterBtn.addEventListener("click", () => {
      if (!refs.pageFilterPanel) return;
      refs.pageFilterPanel.hidden = !refs.pageFilterPanel.hidden;
    });
    if (refs.pageApplyBtn) refs.pageApplyBtn.addEventListener("click", () => {
      applyFilterInputs(state.page, refs.pageMinInput, refs.pageMaxInput);
      renderPublicationsPage();
    });
    if (refs.pageResetBtn) refs.pageResetBtn.addEventListener("click", () => {
      resetFilterInputs(state.page, refs.pageMinInput, refs.pageMaxInput);
      renderPublicationsPage();
    });

    [refs.homeMinInput, refs.homeMaxInput].forEach((input) => {
      if (!input) return;
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        applyFilterInputs(state.home, refs.homeMinInput, refs.homeMaxInput);
        renderHomePublications();
      });
    });
    [refs.pageMinInput, refs.pageMaxInput].forEach((input) => {
      if (!input) return;
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        applyFilterInputs(state.page, refs.pageMinInput, refs.pageMaxInput);
        renderPublicationsPage();
      });
    });

    if (refs.pageViewToggle) {
      refs.pageViewToggle.querySelectorAll("button[data-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          const mode = button.dataset.mode === "grid" ? "grid" : "list";
          if (state.page.mode === mode) return;
          state.page.mode = mode;
          state.page.page = 1;
          renderPublicationsPage();
        });
      });
    }

    window.addEventListener("hashchange", rerenderPublicationViews);
    if (refs.modalClose) refs.modalClose.addEventListener("click", closeGraphAbsModal);
    if (refs.modal) {
      refs.modal.addEventListener("click", (event) => {
        if (event.target === refs.modal) closeGraphAbsModal();
      });
    }
    if (refs.detailModalClose) refs.detailModalClose.addEventListener("click", closePublicationDetailModal);
    if (refs.detailModal) {
      refs.detailModal.addEventListener("click", (event) => {
        if (event.target === refs.detailModal) closePublicationDetailModal();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (refs.modal && !refs.modal.hidden) closeGraphAbsModal();
      if (refs.detailModal && !refs.detailModal.hidden) closePublicationDetailModal();
    });
  }

  async function initIndexPage(options) {
    const settings = options && options.settings ? options.settings : {};
    const fallbackCatalog = options && options.fallbackCatalog ? options.fallbackCatalog : { publications: [] };

    applyPublicationSettings(settings);
    if (!state.initialized) {
      bindEvents();
      state.initialized = true;
    }

    const loadedCatalog = await loadPublicationsCatalog();
    const source = loadedCatalog || fallbackCatalog;
    state.items = await resolvePublications(source, settings, (nextItems) => {
      state.items = nextItems;
      rerenderPublicationViews();
    });
    rerenderPublicationViews();
  }

  window.PublicationFeature = {
    initIndexPage,
    rerenderIndexPage: rerenderPublicationViews
  };
})();
