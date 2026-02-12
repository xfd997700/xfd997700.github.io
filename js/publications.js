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
    detailDoiLine: document.getElementById("publication-detail-doi-line")
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

  const citeUi = {
    popup: null,
    body: null,
    activeButton: null,
    activeIdentity: ""
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

  function normalizeDatePart(value, min, max) {
    const parsed = parseInt(cleanText(value), 10);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
    return parsed;
  }

  function formatDatePart(part) {
    return String(part).padStart(2, "0");
  }

  function getPublicationDateText(pub) {
    const yearText = cleanText(pub && pub.year);
    if (!yearText) return "";
    const month = normalizeDatePart(pub && pub.month, 1, 12);
    const day = normalizeDatePart(pub && pub.day, 1, 31);
    if (month === null || day === null) return yearText;
    const match = yearText.match(/\d{4}/);
    const year = match ? match[0] : yearText;
    return `${year}.${formatDatePart(month)}.${formatDatePart(day)}`;
  }

  function splitAuthorNames(authorsText) {
    return cleanText(authorsText)
      .split(/[;,，；]/)
      .map((name) => cleanText(name))
      .filter(Boolean);
  }

  function hasCjkCharacters(value) {
    return /[\u3400-\u9fff]/.test(cleanText(value));
  }

  function parsePersonName(rawName) {
    const name = cleanText(rawName);
    if (!name) return null;
    const compact = name.replace(/\s+/g, "");
    if (hasCjkCharacters(compact)) {
      return { family: name, given: "", cjk: true };
    }
    if (name.includes(",")) {
      const parts = name.split(",");
      return {
        family: cleanText(parts[0]),
        given: cleanText(parts.slice(1).join(" ")),
        cjk: false
      };
    }
    const tokens = name.split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    const family = cleanText(tokens[tokens.length - 1]);
    const given = cleanText(tokens.slice(0, -1).join(" "));
    return { family, given, cjk: false };
  }

  function getGivenInitials(givenName, withDots) {
    const parts = cleanText(givenName).split(/[\s-]+/).filter(Boolean);
    if (!parts.length) return "";
    return parts
      .map((part) => {
        const initial = part.charAt(0).toUpperCase();
        return withDots ? `${initial}.` : initial;
      })
      .join(" ");
  }

  function formatAuthorGbt(rawName) {
    const person = parsePersonName(rawName);
    if (!person) return "";
    if (person.cjk) return person.family;
    const initials = getGivenInitials(person.given, false);
    return cleanText(`${person.family} ${initials}`);
  }

  function formatAuthorMla(rawName) {
    const person = parsePersonName(rawName);
    if (!person) return "";
    if (person.cjk || !person.given) return person.family;
    return `${person.family}, ${person.given}`;
  }

  function formatAuthorApa(rawName) {
    const person = parsePersonName(rawName);
    if (!person) return "";
    if (person.cjk) return person.family;
    const initials = getGivenInitials(person.given, true);
    return initials ? `${person.family}, ${initials}` : person.family;
  }

  function ensureTerminalPeriod(text) {
    const value = cleanText(text);
    if (!value) return "";
    return /[.!?]$/.test(value) ? value : `${value}.`;
  }

  function normalizePublicationType(type) {
    return cleanText(type).toLowerCase() === "inproceedings" ? "inproceedings" : "article";
  }

  function isConferencePublication(pub) {
    return normalizePublicationType(pub && pub.type) === "inproceedings";
  }

  function buildGbtCitation(pub) {
    const conference = isConferencePublication(pub);
    const authors = splitAuthorNames(pub && pub.authors).map(formatAuthorGbt).filter(Boolean);
    const authorText = authors.length > 3 ? `${authors.slice(0, 3).join(", ")}, et al` : authors.join(", ");
    const safeAuthors = authorText || "Unknown Author";
    const titleText = cleanText(pub && pub.title) || "Untitled";
    const venue = cleanText(pub && pub.journal) || (conference ? "Unknown Conference" : "Unknown Journal");
    const year = cleanText(pub && pub.year);
    const volume = cleanText(pub && pub.volume);
    const issue = cleanText(pub && pub.issue);
    const page = cleanText(pub && pub.page);
    if (conference) {
      let source = `//${venue}`;
      if (year) source += `, ${year}`;
      if (page) source += `: ${page}`;
      return `${safeAuthors}. ${titleText}[C]. ${ensureTerminalPeriod(source)}`;
    }
    const meta = [];
    if (year) meta.push(year);
    if (volume) {
      meta.push(issue ? `${volume}(${issue})` : volume);
    } else if (issue) {
      meta.push(`(${issue})`);
    }
    let source = venue;
    if (meta.length) source += `, ${meta.join(", ")}`;
    if (page) source += `${meta.length ? ": " : ", "}${page}`;
    return `${safeAuthors}. ${titleText}[J]. ${ensureTerminalPeriod(source)}`;
  }

  function buildMlaCitation(pub) {
    const conference = isConferencePublication(pub);
    const authors = splitAuthorNames(pub && pub.authors);
    const firstAuthor = authors.length ? formatAuthorMla(authors[0]) : "";
    const safeAuthors = authors.length > 1 ? `${firstAuthor}, et al` : firstAuthor || "Unknown Author";
    const titleText = cleanText(pub && pub.title) || "Untitled";
    const venue = cleanText(pub && pub.journal) || (conference ? "Unknown Conference" : "Unknown Journal");
    const year = cleanText(pub && pub.year);
    const volume = cleanText(pub && pub.volume);
    const issue = cleanText(pub && pub.issue);
    const page = cleanText(pub && pub.page);
    if (conference) {
      let source = `Proceedings of ${venue}`;
      if (year) source += `, ${year}`;
      if (page) source += `, pp. ${page}`;
      return `${safeAuthors}. "${ensureTerminalPeriod(titleText)}" ${ensureTerminalPeriod(source)}`;
    }
    let source = venue;
    if (volume) source += `, vol. ${volume}`;
    if (issue) source += `, no. ${issue}`;
    if (year) source += ` (${year})`;
    if (page) source += `: ${page}`;
    return `${safeAuthors}. "${ensureTerminalPeriod(titleText)}" ${ensureTerminalPeriod(source)}`;
  }

  function buildApaCitation(pub) {
    const conference = isConferencePublication(pub);
    const authors = splitAuthorNames(pub && pub.authors).map(formatAuthorApa).filter(Boolean);
    const safeAuthors = authors.length
      ? (authors.length === 1
        ? authors[0]
        : authors.length === 2
          ? `${authors[0]} & ${authors[1]}`
          : `${authors.slice(0, -1).join(", ")}, & ${authors[authors.length - 1]}`)
      : "Unknown Author";
    const titleText = cleanText(pub && pub.title) || "Untitled";
    const year = cleanText(pub && pub.year) || "n.d.";
    const venue = cleanText(pub && pub.journal) || (conference ? "Unknown Conference" : "Unknown Journal");
    const volume = cleanText(pub && pub.volume);
    const issue = cleanText(pub && pub.issue);
    const page = cleanText(pub && pub.page);
    if (conference) {
      let source = `In ${venue}`;
      if (page) source += ` (pp. ${page})`;
      return `${safeAuthors} (${year}). ${ensureTerminalPeriod(titleText)} ${ensureTerminalPeriod(source)}`;
    }
    let source = venue;
    if (volume) source += `, ${volume}${issue ? `(${issue})` : ""}`;
    else if (issue) source += ` (${issue})`;
    if (page) source += `, ${page}`;
    return `${safeAuthors} (${year}). ${ensureTerminalPeriod(titleText)} ${ensureTerminalPeriod(source)}`;
  }

  function escapeBibtexField(value) {
    return cleanText(value).replace(/[{}]/g, "\\$&");
  }

  function buildBibtexKey(pub) {
    const refKey = cleanText(pub && pub.ref_key).replace(/[^\w-]+/g, "");
    if (refKey) return refKey;
    const firstAuthor = splitAuthorNames(pub && pub.authors)[0] || "pub";
    const parsed = parsePersonName(firstAuthor);
    const family = cleanText(parsed && parsed.family).replace(/[^\w-]+/g, "").toLowerCase() || "pub";
    const year = (cleanText(pub && pub.year).match(/\d{4}/) || ["nd"])[0];
    return `${family}${year}`;
  }

  function buildBibtexCitation(pub) {
    const conference = isConferencePublication(pub);
    const fields = [];
    const authorList = splitAuthorNames(pub && pub.authors).join(" and ");
    const title = cleanText(pub && pub.title);
    const venue = cleanText(pub && pub.journal);
    const year = cleanText(pub && pub.year);
    const volume = cleanText(pub && pub.volume);
    const issue = cleanText(pub && pub.issue);
    const page = cleanText(pub && pub.page);
    const doi = cleanText(pub && pub.doi);

    if (title) fields.push(["title", title]);
    if (authorList) fields.push(["author", authorList]);
    if (venue) fields.push([conference ? "booktitle" : "journal", venue]);
    if (year) fields.push(["year", year]);
    if (volume) fields.push(["volume", volume]);
    if (issue) fields.push(["number", issue]);
    if (page) fields.push(["pages", page]);
    if (doi) fields.push(["doi", doi]);

    const lines = fields.map(([key, value]) => `  ${key} = {${escapeBibtexField(value)}}`);
    return `@${conference ? "inproceedings" : "article"}{${buildBibtexKey(pub)},\n${lines.join(",\n")}\n}`;
  }

  function getCitationBlocks(pub) {
    return [
      { key: "gbt", label: "GB/T 7714", text: buildGbtCitation(pub), bibtex: false },
      { key: "mla", label: "MLA", text: buildMlaCitation(pub), bibtex: false },
      { key: "apa", label: "APA", text: buildApaCitation(pub), bibtex: false },
      { key: "bibtex", label: "BibTeX", text: buildBibtexCitation(pub), bibtex: true }
    ];
  }

  async function copyTextToClipboard(text) {
    const content = String(text || "");
    if (!content) return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(content);
        return true;
      } catch (error) {
        // Fallback below.
      }
    }
    const area = document.createElement("textarea");
    area.value = content;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.top = "-9999px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (error) {
      success = false;
    }
    document.body.removeChild(area);
    return success;
  }

  function markCopyButtonState(button, copied) {
    if (!button) return;
    if (button._copyStateTimer) {
      clearTimeout(button._copyStateTimer);
      button._copyStateTimer = null;
    }
    button.classList.toggle("is-copied", Boolean(copied));
    button.classList.toggle("is-copy-failed", copied === false);
    button.setAttribute("aria-label", copied ? "Copied" : copied === false ? "Copy failed" : "Copy citation");
    button._copyStateTimer = setTimeout(() => {
      button.classList.remove("is-copied", "is-copy-failed");
      button.setAttribute("aria-label", "Copy citation");
      button._copyStateTimer = null;
    }, 1200);
  }

  function ensureCitationPopup() {
    if (citeUi.popup && citeUi.body) return citeUi.popup;
    const popup = document.createElement("div");
    popup.id = "publication-cite-popup";
    popup.className = "publication-cite-popup";
    popup.hidden = true;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "false");
    popup.setAttribute("aria-label", "Citation formats");
    const body = document.createElement("div");
    body.className = "publication-cite-popup-body";
    popup.appendChild(body);
    document.body.appendChild(popup);
    citeUi.popup = popup;
    citeUi.body = body;
    return popup;
  }

  function getPublicationIdentity(pub) {
    return cleanText(pub && pub.ref_key) || cleanText(pub && pub.doi) || cleanText(pub && pub.title) || "";
  }

  function closeCitationPopup() {
    if (!citeUi.popup || citeUi.popup.hidden) return;
    citeUi.popup.hidden = true;
    citeUi.popup.style.left = "";
    citeUi.popup.style.top = "";
    if (citeUi.activeButton) {
      citeUi.activeButton.classList.remove("is-open");
      citeUi.activeButton.setAttribute("aria-expanded", "false");
    }
    citeUi.activeButton = null;
    citeUi.activeIdentity = "";
  }

  function positionCitationPopup(anchorButton) {
    if (!citeUi.popup || citeUi.popup.hidden || !anchorButton) return;
    const popup = citeUi.popup;
    const rect = anchorButton.getBoundingClientRect();
    const gap = 8;
    const padding = 10;
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    const maxLeft = Math.max(padding, window.innerWidth - width - padding);
    const left = Math.max(padding, Math.min(rect.left, maxLeft));
    const availableBelow = Math.max(0, window.innerHeight - rect.bottom - gap - padding);
    const availableAbove = Math.max(0, rect.top - gap - padding);
    let top = rect.bottom + gap;
    if (availableBelow < height && availableAbove > availableBelow) {
      top = rect.top - height - gap;
    }
    if (top < padding) top = padding;
    if (top + height > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - height - padding);
    }
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  }

  function renderCitationPopup(pub) {
    const popup = ensureCitationPopup();
    if (!citeUi.body) return popup;
    citeUi.body.innerHTML = "";
    getCitationBlocks(pub).forEach((block) => {
      const item = document.createElement("section");
      item.className = "publication-cite-item";
      const head = document.createElement("div");
      head.className = "publication-cite-item-head";
      const label = document.createElement("strong");
      label.className = "publication-cite-item-label";
      label.textContent = block.label;
      head.appendChild(label);
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "publication-inline-icon-btn publication-copy-btn";
      copyBtn.setAttribute("aria-label", "Copy citation");
      copyBtn.setAttribute("title", "Copy");
      copyBtn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
      copyBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const copied = await copyTextToClipboard(block.text);
        markCopyButtonState(copyBtn, copied);
      });
      head.appendChild(copyBtn);
      item.appendChild(head);
      const text = document.createElement(block.bibtex ? "pre" : "div");
      text.className = `publication-cite-item-text${block.bibtex ? " is-bibtex" : ""}`;
      text.textContent = block.text;
      item.appendChild(text);
      citeUi.body.appendChild(item);
    });
    return popup;
  }

  function openCitationPopup(anchorButton, pub) {
    if (!anchorButton || !pub) return;
    const popup = renderCitationPopup(pub);
    popup.hidden = false;
    if (citeUi.activeButton && citeUi.activeButton !== anchorButton) {
      citeUi.activeButton.classList.remove("is-open");
      citeUi.activeButton.setAttribute("aria-expanded", "false");
    }
    citeUi.activeButton = anchorButton;
    citeUi.activeIdentity = getPublicationIdentity(pub);
    anchorButton.classList.add("is-open");
    anchorButton.setAttribute("aria-expanded", "true");
    positionCitationPopup(anchorButton);
  }

  function toggleCitationPopup(anchorButton, pub) {
    const identity = getPublicationIdentity(pub);
    if (
      citeUi.popup &&
      !citeUi.popup.hidden &&
      citeUi.activeIdentity &&
      citeUi.activeIdentity === identity
    ) {
      closeCitationPopup();
      return;
    }
    openCitationPopup(anchorButton, pub);
  }

  function createCiteButton(pub) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "publication-inline-icon-btn publication-cite-btn";
    button.setAttribute("aria-label", "Cite | 引用");
    button.setAttribute("data-hover-label", "Cite | 引用");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = '<i class="fa-solid fa-quote-left" aria-hidden="true"></i>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCitationPopup(button, pub);
    });
    return button;
  }

  function fillPublicationDoiLine(container, pub) {
    if (!container) return false;
    const doiText = cleanText(pub && pub.doi);
    const doiUrl = cleanText(pub && pub.doi_link) || buildDoiUrl(doiText);
    if (!doiText || !doiUrl) {
      container.innerHTML = "";
      return false;
    }
    container.innerHTML = "";
    container.appendChild(createCiteButton(pub));
    const label = document.createElement("span");
    label.textContent = "DOI: ";
    container.appendChild(label);
    const link = document.createElement("a");
    link.href = doiUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = doiText;
    container.appendChild(link);
    return true;
  }

  function createPublicationDoiLine(pub, className) {
    const line = document.createElement("div");
    line.className = className;
    return fillPublicationDoiLine(line, pub) ? line : null;
  }

  function normalizeSortMode(sortMode) {
    if (sortMode === "time_desc" || sortMode === "time_asc" || sortMode === "default") return sortMode;
    return sortMode === "year" ? "time_desc" : "default";
  }

  function getNextSortMode(sortMode) {
    const normalized = normalizeSortMode(sortMode);
    if (normalized === "default") return "time_desc";
    if (normalized === "time_desc") return "time_asc";
    return "default";
  }

  function parseCrossrefMessage(message) {
    if (!message || typeof message !== "object") return null;
    const title = cleanText(Array.isArray(message.title) ? message.title[0] : message.title);
    const journal = cleanText(
      Array.isArray(message["container-title"]) ? message["container-title"][0] : message["container-title"]
    );
    const issuedParts =
      message.issued &&
      Array.isArray(message.issued["date-parts"]) &&
      Array.isArray(message.issued["date-parts"][0])
        ? message.issued["date-parts"][0]
        : [];
    const year = cleanText(
      Array.isArray(issuedParts) && issuedParts.length
        ? issuedParts[0]
        : ""
    );
    return {
      doi: normalizeDoi(message.DOI),
      title,
      authors: formatAuthorList(message.author),
      year,
      month: normalizeDatePart(Array.isArray(issuedParts) ? issuedParts[1] : null, 1, 12),
      day: normalizeDatePart(Array.isArray(issuedParts) ? issuedParts[2] : null, 1, 31),
      journal,
      volume: cleanText(message.volume),
      issue: cleanText(message.issue),
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
      month: normalizeDatePart(pub.month, 1, 12),
      day: normalizeDatePart(pub.day, 1, 31),
      type: normalizePublicationType(pub.type),
      journal: cleanText(pub.journal),
      volume: cleanText(pub.volume),
      issue: cleanText(pub.issue),
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
          month: result.data.month || resolved[i].month,
          day: result.data.day || resolved[i].day,
          journal: result.data.journal || resolved[i].journal,
          volume: result.data.volume || resolved[i].volume,
          issue: result.data.issue || resolved[i].issue,
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

  function parsePublicationSortStamp(pub) {
    const year = parsePublicationYear(pub);
    if (!year) return null;
    const month = normalizeDatePart(pub && pub.month, 1, 12) || 0;
    const day = normalizeDatePart(pub && pub.day, 1, 31) || 0;
    return year * 10000 + month * 100 + day;
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

    const sortMode = normalizeSortMode(viewState.sortMode);
    const ordered = sortMode === "default"
      ? items
      : items.map((item, index) => ({ item, index })).sort((a, b) => {
        const at = parsePublicationSortStamp(a.item);
        const bt = parsePublicationSortStamp(b.item);
        if (at === null && bt === null) return a.index - b.index;
        if (at === null) return 1;
        if (bt === null) return -1;
        const diff = sortMode === "time_desc" ? bt - at : at - bt;
        return diff === 0 ? a.index - b.index : diff;
      }).map((entry) => entry.item);

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
    if (pub && pub.volume) {
      venueParts.push(pub.issue ? `Vol. ${pub.volume} (${pub.issue})` : `Vol. ${pub.volume}`);
    } else if (pub && pub.issue) {
      venueParts.push(`Issue ${pub.issue}`);
    }
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
    const dateText = getPublicationDateText(pub);
    const item = document.createElement("article");
    item.className = "publication-item";
    if (pub.ref_key) item.dataset.pubKey = pub.ref_key;
    const head = document.createElement("div");
    head.className = "publication-head";
    head.appendChild(createPublicationTitle(pub, "publication-title", { enableLink: state.cardTitleLinkEnabled }));
    if (dateText) {
      const yearBadge = document.createElement("span");
      yearBadge.className = "publication-year";
      yearBadge.textContent = dateText;
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
    const doiLine = createPublicationDoiLine(pub, "publication-doi-line");
    if (doiLine) item.appendChild(doiLine);
    return item;
  }

  function createPublicationGridItem(pub, options) {
    const showGraphAbs = options && options.showGraphAbs !== false;
    const hasGraphAbs = showGraphAbs && Boolean(pub.graph_abs);
    const dateText = getPublicationDateText(pub);
    const item = document.createElement("article");
    item.className = `publication-grid-item ${hasGraphAbs ? "is-rich" : "is-compact"}`;
    const head = document.createElement("div");
    head.className = "publication-grid-head";
    head.appendChild(createPublicationTitle(pub, "publication-grid-title", { enableLink: state.cardTitleLinkEnabled }));
    if (dateText) {
      const year = document.createElement("span");
      year.className = "publication-grid-year";
      year.textContent = dateText;
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
    const doiLine = createPublicationDoiLine(pub, "publication-grid-doi-line");
    if (doiLine) item.appendChild(doiLine);
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

  function setStateButtonLabel(button, label) {
    if (!button) return;
    button.setAttribute("aria-label", label);
    button.setAttribute("data-hover-label", label);
  }

  function updateSortButton(button, sortMode) {
    if (!button) return;
    const mode = normalizeSortMode(sortMode);
    const isDesc = mode === "time_desc";
    const isAsc = mode === "time_asc";
    const isActive = isDesc || isAsc;
    const label = isDesc
      ? "Sort newest to oldest | \u65f6\u95f4\u4ece\u65b0\u5230\u65e7"
      : isAsc
        ? "Sort oldest to newest | \u65f6\u95f4\u4ece\u65e7\u5230\u65b0"
        : "Sort by time | \u6309\u65f6\u95f4\u6392\u5e8f";
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("is-active", isActive);
    button.classList.toggle("is-sort-desc", isDesc);
    button.classList.toggle("is-sort-asc", isAsc);
    setStateButtonLabel(button, label);

    const icon = button.querySelector("i");
    if (icon) {
      icon.classList.remove("fa-sort", "fa-arrow-down-wide-short", "fa-arrow-up-wide-short");
      icon.classList.add(isDesc ? "fa-arrow-down-wide-short" : isAsc ? "fa-arrow-up-wide-short" : "fa-sort");
    }
  }

  function updateFilterButton(button, filterPanel) {
    if (!button) return;
    const active = Boolean(filterPanel && !filterPanel.hidden);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-filter-active", active);
    button.classList.remove("is-sort-desc", "is-sort-asc");
    setStateButtonLabel(
      button,
      active
        ? "Filter active | \u5e74\u4efd\u7b5b\u9009\u5df2\u542f\u7528"
        : "Filter by year | \u6309\u5e74\u4efd\u7b5b\u9009"
    );
  }

  function updateGraphAbsButton(button, isShown) {
    if (!button) return;
    const shown = Boolean(isShown);
    const title = shown
      ? "Hide graphical abstracts | 隐藏图形摘要"
      : "Show graphical abstracts | 显示图形摘要";
    button.setAttribute("aria-pressed", shown ? "true" : "false");
    setStateButtonLabel(button, title);
    button.classList.toggle("is-active", shown);
    button.classList.remove("is-filter-active");
    button.classList.remove("is-sort-desc", "is-sort-asc");

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
    updateFilterButton(refs.homeFilterBtn, refs.homeFilterPanel);
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
    updateFilterButton(refs.pageFilterBtn, refs.pageFilterPanel);
    syncFilterInputs(pageState, refs.pageMinInput, refs.pageMaxInput);
    updateViewToggle();
  }

  function rerenderPublicationViews() {
    closeCitationPopup();
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
    const yearText = getPublicationDateText(pub);
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

    if (refs.detailDoiLine) {
      const hasDoi = fillPublicationDoiLine(refs.detailDoiLine, {
        ...pub,
        title: titleText,
        doi: doiText,
        doi_link: doiUrl
      });
      refs.detailDoiLine.hidden = !hasDoi;
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
    if (refs.detailDoiLine) {
      refs.detailDoiLine.innerHTML = "";
    }
    closeCitationPopup();
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
        state.home.sortMode = getNextSortMode(state.home.sortMode);
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
        updateFilterButton(refs.homeFilterBtn, refs.homeFilterPanel);
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
      state.page.sortMode = getNextSortMode(state.page.sortMode);
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
      updateFilterButton(refs.pageFilterBtn, refs.pageFilterPanel);
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
      closeCitationPopup();
      if (refs.modal && !refs.modal.hidden) closeGraphAbsModal();
      if (refs.detailModal && !refs.detailModal.hidden) closePublicationDetailModal();
    });
    document.addEventListener("click", (event) => {
      if (!citeUi.popup || citeUi.popup.hidden) return;
      const target = event.target;
      if (target && target.closest("#publication-cite-popup")) return;
      if (target && target.closest(".publication-cite-btn")) return;
      closeCitationPopup();
    });
    window.addEventListener("resize", closeCitationPopup);
    window.addEventListener("scroll", closeCitationPopup, true);
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

