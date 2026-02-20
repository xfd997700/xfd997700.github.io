const terminalScreen = document.getElementById("terminal-screen");
const terminalInput = document.getElementById("terminal-input");
const terminalMessage = document.getElementById("terminal-message");
const mainContent = document.getElementById("main-content");
const TERMINAL_ASCII_CONTAINER_ID = "terminal-ascii-bg";
const TERMINAL_ASCII_CANVAS_CLASS = "terminal-ascii-canvas";
const TERMINAL_ASCII_SYMBOLS = "RGB0123456789ABCDEF#(),[]{}:;+-=*/<>x";

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
const terminalAsciiState = {
  enabled: false,
  container: null,
  canvas: null,
  ctx: null,
  charRows: [],
  noise: null,
  resizeHandler: null,
  resizeDebounceTimer: null,
  rafId: 0,
  reducedMotion: false,
  isMobile: false,
  dpr: 1,
  width: 0,
  height: 0,
  cols: 0,
  rows: 0,
  cellWidth: 0,
  cellHeight: 0,
  fontPx: 10,
  frameIntervalMs: 34,
  lastFrameTs: 0,
  startTs: 0,
  directionX: 1,
  directionY: 0,
  waveWidthRatio: 0.12,
  waveSpeedPxPerMs: 0.18,
  waveIntervalMs: 5200,
  isWaveActive: false,
  waveCenterProj: 0,
  waveWidthPx: 0,
  waveMinProj: 0,
  waveMaxProj: 0,
  nextWaveStartTs: 0,
  lastWaveStepTs: 0,
  hueSpeedDegPerMs: 0.028
};

function clampNumber(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function randomInt(minValue, maxValue) {
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

function randomHexPair() {
  return randomInt(0, 255).toString(16).padStart(2, "0").toUpperCase();
}

function randomDirectionVector() {
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function buildAsciiToken() {
  const random = Math.random();
  if (random < 0.24) {
    return `rgb(${randomInt(0, 255)},${randomInt(0, 255)},${randomInt(0, 255)})`;
  }
  if (random < 0.46) {
    return `#${randomHexPair()}${randomHexPair()}${randomHexPair()}`;
  }
  if (random < 0.68) {
    return `0x${randomHexPair()}${randomHexPair()}${randomHexPair()}`;
  }
  if (random < 0.84) {
    return `R${randomHexPair()} G${randomHexPair()} B${randomHexPair()}`;
  }
  const tokenLength = randomInt(3, 9);
  let token = "";
  for (let i = 0; i < tokenLength; i += 1) {
    token += TERMINAL_ASCII_SYMBOLS.charAt(randomInt(0, TERMINAL_ASCII_SYMBOLS.length - 1));
  }
  return token;
}

function buildAsciiRows(columns, rows) {
  const lines = new Array(rows);
  for (let row = 0; row < rows; row += 1) {
    let line = row % 5 === 0 ? "rgb(255,0,0) " : "";
    while (line.length < columns + 16) {
      line += `${buildAsciiToken()} `;
    }
    lines[row] = line.slice(0, columns);
  }
  return lines;
}

function getTerminalAsciiContainer() {
  return document.getElementById(TERMINAL_ASCII_CONTAINER_ID);
}

function ensureTerminalAsciiCanvas() {
  if (!terminalScreen) return null;
  let container = getTerminalAsciiContainer();
  if (!container) {
    container = document.createElement("div");
    container.id = TERMINAL_ASCII_CONTAINER_ID;
    container.className = "terminal-ascii-bg";
    container.setAttribute("aria-hidden", "true");

    const canvas = document.createElement("canvas");
    canvas.className = TERMINAL_ASCII_CANVAS_CLASS;
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    terminalScreen.insertBefore(container, terminalScreen.firstChild);
  }

  const canvas = container.querySelector("canvas");
  if (!canvas) return null;

  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true }) || canvas.getContext("2d");
  if (!ctx) return null;

  terminalAsciiState.container = container;
  terminalAsciiState.canvas = canvas;
  terminalAsciiState.ctx = ctx;
  return container;
}

function resolveAsciiGrid(width, height, isMobile) {
  const maxCells = isMobile ? 1400 : 3200;
  const ratio = width / Math.max(height, 1);
  let rows = Math.floor(Math.sqrt(maxCells / Math.max(ratio, 0.3)));
  let cols = Math.floor(rows * ratio);

  rows = clampNumber(rows, isMobile ? 14 : 20, isMobile ? 34 : 56);
  cols = clampNumber(cols, isMobile ? 28 : 42, isMobile ? 86 : 132);

  while (cols * rows > maxCells) {
    if (cols >= rows && cols > (isMobile ? 24 : 34)) {
      cols -= 1;
      continue;
    }
    if (rows > (isMobile ? 14 : 18)) {
      rows -= 1;
      continue;
    }
    break;
  }

  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const fontPx = clampNumber(
    Math.floor(Math.min(cellHeight * 0.9, cellWidth * 0.95)),
    isMobile ? 8 : 9,
    isMobile ? 12 : 14
  );

  return { cols, rows, cellWidth, cellHeight, fontPx };
}

function rebuildTerminalAsciiField() {
  const container = ensureTerminalAsciiCanvas();
  if (!container || !terminalAsciiState.canvas || !terminalAsciiState.ctx) return;

  const width = Math.max(1, terminalScreen ? terminalScreen.clientWidth : window.innerWidth);
  const height = Math.max(1, terminalScreen ? terminalScreen.clientHeight : window.innerHeight);
  const isMobile = width <= 700;
  const { cols, rows, cellWidth, cellHeight, fontPx } = resolveAsciiGrid(width, height, isMobile);
  const dpr = clampNumber(window.devicePixelRatio || 1, 1, 2);
  const canvas = terminalAsciiState.canvas;
  const ctx = terminalAsciiState.ctx;

  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${isMobile ? 500 : 600} ${fontPx}px "JetBrains Mono", Consolas, "SFMono-Regular", monospace`;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  terminalAsciiState.isMobile = isMobile;
  terminalAsciiState.dpr = dpr;
  terminalAsciiState.width = width;
  terminalAsciiState.height = height;
  terminalAsciiState.cols = cols;
  terminalAsciiState.rows = rows;
  terminalAsciiState.cellWidth = cellWidth;
  terminalAsciiState.cellHeight = cellHeight;
  terminalAsciiState.fontPx = fontPx;
  terminalAsciiState.frameIntervalMs = isMobile ? 42 : 34;
  terminalAsciiState.charRows = buildAsciiRows(cols, rows);
  terminalAsciiState.noise = new Float32Array(cols * rows);

  for (let index = 0; index < terminalAsciiState.noise.length; index += 1) {
    terminalAsciiState.noise[index] = Math.random();
  }

  terminalAsciiState.hueSpeedDegPerMs = isMobile ? 0.022 : 0.028;
  terminalAsciiState.isWaveActive = false;
  terminalAsciiState.waveCenterProj = 0;
  terminalAsciiState.waveWidthPx = 0;
  terminalAsciiState.waveMinProj = 0;
  terminalAsciiState.waveMaxProj = 0;
  terminalAsciiState.nextWaveStartTs = 0;
  terminalAsciiState.lastWaveStepTs = 0;
}

function getProjectionBounds(directionX, directionY, width, height) {
  const p0 = 0;
  const p1 = width * directionX;
  const p2 = height * directionY;
  const p3 = p1 + p2;
  const minProj = Math.min(p0, p1, p2, p3);
  const maxProj = Math.max(p0, p1, p2, p3);
  const span = Math.max(1, maxProj - minProj);
  return { minProj, maxProj, span };
}

function startNextTerminalAsciiWave(now) {
  const direction = randomDirectionVector();
  terminalAsciiState.directionX = direction.x;
  terminalAsciiState.directionY = direction.y;

  const { minProj, maxProj, span } = getProjectionBounds(
    terminalAsciiState.directionX,
    terminalAsciiState.directionY,
    terminalAsciiState.width,
    terminalAsciiState.height
  );
  const widthRatio = terminalAsciiState.isMobile
    ? terminalAsciiState.waveWidthRatio * 1.1
    : terminalAsciiState.waveWidthRatio;
  const waveWidthPx = clampNumber(span * widthRatio, terminalAsciiState.cellHeight * 1.15, span * 0.72);

  terminalAsciiState.waveMinProj = minProj;
  terminalAsciiState.waveMaxProj = maxProj;
  terminalAsciiState.waveWidthPx = waveWidthPx;
  const spawnFactor = terminalAsciiState.waveIntervalMs <= 0 ? 0.78 : 1;
  terminalAsciiState.waveCenterProj = minProj - waveWidthPx * spawnFactor;
  terminalAsciiState.isWaveActive = true;
  terminalAsciiState.lastWaveStepTs = now;
}

function advanceTerminalAsciiWave(now) {
  if (!terminalAsciiState.lastWaveStepTs) {
    terminalAsciiState.lastWaveStepTs = now;
  }
  const deltaMs = clampNumber(now - terminalAsciiState.lastWaveStepTs, 0, 120);
  terminalAsciiState.lastWaveStepTs = now;

  if (!terminalAsciiState.isWaveActive) {
    if (now >= terminalAsciiState.nextWaveStartTs) {
      startNextTerminalAsciiWave(now);
    }
    return;
  }

  terminalAsciiState.waveCenterProj += deltaMs * terminalAsciiState.waveSpeedPxPerMs;
  if (terminalAsciiState.waveCenterProj > terminalAsciiState.waveMaxProj + terminalAsciiState.waveWidthPx) {
    if (terminalAsciiState.waveIntervalMs <= 0) {
      startNextTerminalAsciiWave(now);
    } else {
      terminalAsciiState.isWaveActive = false;
      terminalAsciiState.nextWaveStartTs = now + terminalAsciiState.waveIntervalMs;
    }
  }
}

function applyTerminalAsciiSettings(config) {
  const terminalConfig = config && typeof config === "object" ? config : {};
  const widthRatioRaw = normalizeNonNegativeNumber(terminalConfig.ascii_wave_width_ratio, terminalAsciiState.waveWidthRatio);
  const speedPxPerSRaw = normalizeNonNegativeNumber(
    terminalConfig.ascii_wave_speed_px_per_s,
    terminalAsciiState.waveSpeedPxPerMs * 1000
  );
  const intervalMsRaw = normalizeNonNegativeNumber(terminalConfig.ascii_wave_interval_ms, terminalAsciiState.waveIntervalMs);

  terminalAsciiState.waveWidthRatio = clampNumber(widthRatioRaw, 0.04, 0.55);
  terminalAsciiState.waveSpeedPxPerMs = clampNumber(speedPxPerSRaw, 20, 2400) / 1000;
  terminalAsciiState.waveIntervalMs = clampNumber(intervalMsRaw, 0, 30000);
  if (!terminalAsciiState.isWaveActive && terminalAsciiState.waveIntervalMs <= 0) {
    terminalAsciiState.nextWaveStartTs = 0;
  }
}

function renderTerminalAsciiWaveFrame(now) {
  if (!terminalAsciiState.enabled || state.entered) return;
  if (!terminalAsciiState.ctx || !terminalAsciiState.charRows.length || !terminalAsciiState.noise) return;

  const ctx = terminalAsciiState.ctx;
  const width = terminalAsciiState.width;
  const height = terminalAsciiState.height;
  const cols = terminalAsciiState.cols;
  const rows = terminalAsciiState.rows;
  const cellWidth = terminalAsciiState.cellWidth;
  const cellHeight = terminalAsciiState.cellHeight;
  if (!width || !height || !cols || !rows || !cellWidth || !cellHeight) return;

  const elapsedMs = now - terminalAsciiState.startTs;
  const directionX = terminalAsciiState.directionX;
  const directionY = terminalAsciiState.directionY;
  const span = Math.max(1, terminalAsciiState.waveMaxProj - terminalAsciiState.waveMinProj);
  const waveWidthPx = terminalAsciiState.waveWidthPx;
  const waveCenterProj = terminalAsciiState.waveCenterProj;
  const hueBase = (elapsedMs * terminalAsciiState.hueSpeedDegPerMs) % 360;
  const invWaveWidth = waveWidthPx > 0 ? 1 / waveWidthPx : 0;
  const hueSpatialScale = 220 / span;
  const liftScale = cellHeight * (terminalAsciiState.isMobile ? 0.45 : 0.58);
  const lines = terminalAsciiState.charRows;
  const noise = terminalAsciiState.noise;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (!terminalAsciiState.isWaveActive || waveWidthPx <= 0) return;

  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    const rowText = lines[row];
    const baseY = (row + 0.56) * cellHeight;
    for (let col = 0; col < cols; col += 1) {
      const baseX = (col + 0.5) * cellWidth;
      const proj = baseX * directionX + baseY * directionY;
      const distance = proj - waveCenterProj;
      const absDistance = Math.abs(distance);
      if (absDistance > waveWidthPx) {
        index += 1;
        continue;
      }

      let intensity = 1 - absDistance * invWaveWidth;
      intensity *= intensity;

      const phase = elapsedMs * 0.0024 + noise[index] * 6.2 + row * 0.08 + col * 0.035;
      intensity *= 0.88 + 0.12 * Math.sin(phase);
      if (intensity < 0.04) {
        index += 1;
        continue;
      }

      const hue = (hueBase + proj * hueSpatialScale + noise[index] * 92 + (distance * invWaveWidth) * 28 + 360) % 360;
      const alpha = clampNumber(intensity * 1.26, 0, 1);
      const lightness = 45 + intensity * 34;
      const lift = intensity * liftScale;
      const glyph = rowText.charAt(col) || " ";

      ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
      ctx.fillText(glyph, baseX, baseY - lift);

      if (intensity > 0.72) {
        const coreAlpha = clampNumber((intensity - 0.72) * 1.1, 0, 0.35);
        ctx.fillStyle = `hsla(${hue}, 100%, 83%, ${coreAlpha})`;
        ctx.fillText(glyph, baseX, baseY - lift - 1);
      }

      index += 1;
    }
  }
}

function runTerminalAsciiAnimationFrame(now) {
  if (!terminalAsciiState.enabled || state.entered) return;

  advanceTerminalAsciiWave(now);

  if (!terminalAsciiState.lastFrameTs || now - terminalAsciiState.lastFrameTs >= terminalAsciiState.frameIntervalMs) {
    terminalAsciiState.lastFrameTs = now;
    renderTerminalAsciiWaveFrame(now);
  }

  terminalAsciiState.rafId = requestAnimationFrame(runTerminalAsciiAnimationFrame);
}

function stopTerminalAsciiAnimation() {
  if (terminalAsciiState.rafId) {
    cancelAnimationFrame(terminalAsciiState.rafId);
    terminalAsciiState.rafId = 0;
  }
  if (terminalAsciiState.resizeDebounceTimer) {
    clearTimeout(terminalAsciiState.resizeDebounceTimer);
    terminalAsciiState.resizeDebounceTimer = null;
  }
  if (terminalAsciiState.resizeHandler) {
    window.removeEventListener("resize", terminalAsciiState.resizeHandler);
    terminalAsciiState.resizeHandler = null;
  }

  const container = getTerminalAsciiContainer();
  if (container) {
    container.remove();
  }

  terminalAsciiState.container = null;
  terminalAsciiState.canvas = null;
  terminalAsciiState.ctx = null;
  terminalAsciiState.charRows = [];
  terminalAsciiState.noise = null;
  terminalAsciiState.width = 0;
  terminalAsciiState.height = 0;
  terminalAsciiState.cols = 0;
  terminalAsciiState.rows = 0;
  terminalAsciiState.isWaveActive = false;
  terminalAsciiState.waveCenterProj = 0;
  terminalAsciiState.waveWidthPx = 0;
  terminalAsciiState.waveMinProj = 0;
  terminalAsciiState.waveMaxProj = 0;
  terminalAsciiState.nextWaveStartTs = 0;
  terminalAsciiState.lastWaveStepTs = 0;
  terminalAsciiState.lastFrameTs = 0;
  terminalAsciiState.startTs = 0;
}

function startTerminalAsciiAnimation() {
  if (!terminalScreen || state.entered || !terminalAsciiState.enabled) return;
  const container = ensureTerminalAsciiCanvas();
  if (!container || !terminalAsciiState.ctx) return;

  terminalAsciiState.reducedMotion =
    Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  rebuildTerminalAsciiField();
  const now = performance.now();
  terminalAsciiState.startTs = now;
  terminalAsciiState.lastFrameTs = 0;
  terminalAsciiState.lastWaveStepTs = now;
  terminalAsciiState.isWaveActive = false;
  terminalAsciiState.nextWaveStartTs = now;
  advanceTerminalAsciiWave(now);
  renderTerminalAsciiWaveFrame(now);

  if (!terminalAsciiState.reducedMotion) {
    if (terminalAsciiState.rafId) {
      cancelAnimationFrame(terminalAsciiState.rafId);
    }
    terminalAsciiState.rafId = requestAnimationFrame(runTerminalAsciiAnimationFrame);
  }

  if (!terminalAsciiState.resizeHandler) {
    terminalAsciiState.resizeHandler = () => {
      if (!terminalAsciiState.enabled || state.entered) return;
      if (terminalAsciiState.resizeDebounceTimer) {
        clearTimeout(terminalAsciiState.resizeDebounceTimer);
      }
      terminalAsciiState.resizeDebounceTimer = setTimeout(() => {
        terminalAsciiState.resizeDebounceTimer = null;
        rebuildTerminalAsciiField();
        const ts = performance.now();
        advanceTerminalAsciiWave(ts);
        renderTerminalAsciiWaveFrame(ts);
      }, 180);
    };
    window.addEventListener("resize", terminalAsciiState.resizeHandler, { passive: true });
  }
}

function setTerminalAsciiAnimationEnabled(value) {
  terminalAsciiState.enabled = normalizeBoolean(value, false);
  if (!terminalAsciiState.enabled || state.entered) {
    stopTerminalAsciiAnimation();
    return;
  }
  startTerminalAsciiAnimation();
}

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
  stopTerminalAsciiAnimation();
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

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return fallback;
  }
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

function isSectionEnabled(settings, sectionKey) {
  const section = settings && settings[sectionKey] && typeof settings[sectionKey] === "object" ? settings[sectionKey] : {};
  return normalizeBoolean(section.enable, true);
}

function setElementVisibilityById(elementId, isVisible) {
  const node = document.getElementById(elementId);
  if (!node) return;
  node.hidden = !isVisible;
  node.style.display = isVisible ? "" : "none";
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
  const terminal = settings && settings.terminal ? settings.terminal : {};
  const ui = settings && settings.ui ? settings.ui : {};
  const baseCardHoverEnabled = normalizeBoolean(ui.base_card_hover_enabled, true);

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

  if (baseCardHoverEnabled) {
    rootStyle.setProperty("--base-card-hover-lift-y", "var(--card-hover-lift-y)");
    rootStyle.setProperty("--base-card-hover-border", "var(--card-hover-border)");
    rootStyle.setProperty("--base-card-hover-bg", "var(--card-hover-bg)");
    rootStyle.setProperty("--base-card-hover-shadow", "var(--card-hover-shadow)");
  } else {
    rootStyle.setProperty("--base-card-hover-lift-y", "0px");
    rootStyle.setProperty("--base-card-hover-border", "var(--card-border)");
    rootStyle.setProperty("--base-card-hover-bg", "var(--card-bg)");
    rootStyle.setProperty("--base-card-hover-shadow", "var(--shadow)");
  }

  if (banner.hold_ms !== undefined) {
    siteBrandTypingState.holdMs = normalizeNonNegativeNumber(banner.hold_ms, 2600);
  }

  applyTerminalAsciiSettings(terminal);
  setTerminalAsciiAnimationEnabled(terminal.ascii_animation_enable);
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

  function renderMapLink(target, url, label, provider, providerClassName, hoverLabel) {
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
    const hoverText = cleanText(hoverLabel);
    if (hoverText) {
      link.setAttribute("data-hover-label", hoverText);
    }

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
          "profile-map-link--baidu",
          "百度地图"
        );
        renderMapLink(
          mapLinks,
          googleUrl,
          `Open Google Map for ${addressText}`,
          "google",
          "profile-map-link--google",
          "Google Map"
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
    const sectionVisibility = {
      career: isSectionEnabled(settings, "career"),
      openserver: isSectionEnabled(settings, "openserver"),
      news: isSectionEnabled(settings, "news"),
      projects: isSectionEnabled(settings, "projects"),
      publications: isSectionEnabled(settings, "publications")
    };

    applySettings(settings);
    if (window.EggFeature && typeof window.EggFeature.applySettings === "function") {
      window.EggFeature.applySettings(settings);
    }
    applyBackground(config);
    setElementVisibilityById("career-card", sectionVisibility.career);
    setElementVisibilityById("openserver-card", sectionVisibility.openserver);
    setElementVisibilityById("news-card", sectionVisibility.news);
    setElementVisibilityById("projects-card", sectionVisibility.projects);
    setElementVisibilityById("publications-card", sectionVisibility.publications);
    setElementVisibilityById("right-column", sectionVisibility.projects || sectionVisibility.publications);
    renderProfile(config.personal_info, config.banner || config.site_brand);
    if (sectionVisibility.career) {
      renderCareer(config.career);
    }
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
    if (
      (sectionVisibility.projects || sectionVisibility.publications) &&
      window.ProjectFeature &&
      typeof window.ProjectFeature.initIndexPage === "function"
    ) {
      try {
        await window.ProjectFeature.initIndexPage({ settings });
      } catch (projectError) {
        console.error("Failed to initialize projects module.", projectError);
      }
    }
    if (
      sectionVisibility.publications &&
      window.PublicationFeature &&
      typeof window.PublicationFeature.initIndexPage === "function"
    ) {
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
