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

function applyBackground(config) {
  const local = (config.background_img_local || "").trim();
  const api = (config.background_img_api || "").trim();

  if (local) {
    document.body.style.backgroundImage = `url(${local})`;
    return;
  }

  if (api) {
    document.body.style.backgroundImage = `url(${api})`;
  }
}

function renderProfile(info) {
  if (!info) return;
  const brand = document.getElementById("site-brand");
  const avatar = document.getElementById("avatar-img");
  const name = document.getElementById("profile-name");
  const signature = document.getElementById("profile-signature");
  const linksWrap = document.getElementById("link-buttons");
  const tagsWrap = document.getElementById("profile-tags");

  brand.textContent = info.nickname || info.name || "Personal Page";
  name.textContent = info.nickname || info.name || "Personal Page";
  signature.textContent = info.signature || "";
  if (info.avatar) {
    avatar.src = info.avatar;
  }

  linksWrap.innerHTML = "";
  const links = info.links || {};
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
  const tags = info.tags || [];
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
    const item = document.createElement("div");
    item.className = "placeholder-item";
    const title = pub.title || "Untitled";
    const venue = pub.venue ? ` | ${pub.venue}` : "";
    const year = pub.year ? ` (${pub.year})` : "";
    item.textContent = `${title}${venue}${year}`;
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
    const config = await loadConfig();
    applyBackground(config);
    renderProfile(config.personal_info);
    renderCareer(config.career);
    renderPublications(config.publications);
    renderProjects(config.projects);
  } catch (error) {
    console.error(error);
  }
}

init();
