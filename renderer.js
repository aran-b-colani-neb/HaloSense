const { ipcRenderer, clipboard } = require("electron");

let latestStats = null;
let latestAdvice = [];
let latestProcesses = [];
let activeView = "overview";
let previousViewBeforeSettings = "overview";
let isScanning = false;
let isProcessScanning = false;
let scanTimer = null;
let processTimer = null;
let lastScore = 0;
let lastManualViewChangeAt = 0;
let lastDetailSignature = "";

const defaultSettings = {
  refreshMs: 3500,
  processMs: 2000,
  diskWarnGB: 50,
  ramWarnPercent: 80,
  tempWarnC: 75,
  tempHotC: 85,
  animations: true,
  compact: false,
  privacyMode: false
};

let settings = normalizeSettings(loadSettings());

function el(id) {
  return document.getElementById(id);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function setText(id, text) {
  const node = el(id);
  if (node && node.textContent !== String(text)) {
    node.textContent = text;
  }
}

function setBar(id, value) {
  const node = el(id);
  if (node) node.style.width = `${clamp(value)}%`;
}

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem("haloSettings")) };
  } catch {
    return { ...defaultSettings };
  }
}

function normalizeSettings(raw) {
  const clean = { ...defaultSettings, ...raw };

  if (!Number.isFinite(Number(clean.refreshMs)) || clean.refreshMs < 2500) {
    clean.refreshMs = 3500;
  }

  if (!Number.isFinite(Number(clean.processMs)) || clean.processMs < 1200) {
    clean.processMs = 2000;
  }

  clean.diskWarnGB = clampNumber(clean.diskWarnGB, 10, 200, 50);
  clean.ramWarnPercent = clampNumber(clean.ramWarnPercent, 50, 95, 80);
  clean.tempWarnC = clampNumber(clean.tempWarnC, 50, 95, 75);
  clean.tempHotC = clampNumber(clean.tempHotC, 60, 110, 85);

  return clean;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function saveSettings() {
  settings = normalizeSettings(settings);
  localStorage.setItem("haloSettings", JSON.stringify(settings));
  applySettings();
}

function applySettings() {
  document.body.classList.toggle("reduce-motion", !settings.animations);
  document.body.classList.toggle("compact-mode", settings.compact);
}

function shouldHoldDetailUpdate() {
  return Date.now() - lastManualViewChangeAt < 950;
}

function getLoadLevel(value) {
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "good";
}

function getTempLevel(temp) {
  if (temp >= settings.tempHotC) return "danger";
  if (temp >= settings.tempWarnC) return "warning";
  return "good";
}

function setBarLevel(barId, level) {
  const bar = el(barId);
  if (!bar) return;

  if (!bar.classList.contains(level)) {
    bar.classList.remove("good", "warning", "danger");
    bar.classList.add(level);
  }
}

function setTileLevel(view, level) {
  const tile = document.querySelector(`.tile[data-view="${view}"]`);
  if (!tile) return;

  if (!tile.classList.contains(`tile-${level}`)) {
    tile.classList.remove("tile-good", "tile-warning", "tile-danger");
    tile.classList.add(`tile-${level}`);
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function tempToBar(temp) {
  if (temp === null || temp === undefined) return 0;
  return Math.round((temp / 100) * 100);
}

function cleanCpuName(name) {
  return String(name || "").replace(/\s+/g, " ").trim();
}

function safeIp(ip) {
  return settings.privacyMode ? "Hidden" : ip;
}

function stat(label, value) {
  return `
    <div class="stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function detailMeter(label, value, barValue, level, note) {
  return `
    <div class="detail-meter">
      <div class="detail-meter-top">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
      <div class="bar big-bar">
        <div class="fill ${level}" style="width:${clamp(barValue)}%"></div>
      </div>
      <p>${note}</p>
    </div>
  `;
}

function getBottleneck(stats) {
  const items = [
    { name: "CPU", value: stats.cpuUsagePercent || 0 },
    { name: "Memory", value: stats.ramUsagePercent || 0 },
    { name: "Storage", value: stats.diskPercent || 0 },
    { name: "GPU", value: stats.gpuUsagePercent || 0 }
  ];

  items.sort((a, b) => b.value - a.value);
  return items[0];
}

function getSystemMood(score) {
  if (score >= 92) return "Serene";
  if (score >= 80) return "Stable";
  if (score >= 65) return "Busy";
  return "Strained";
}

function getNextBestAction(stats, online) {
  if (!online) return "Check your network connection.";
  if (stats.security && stats.security.RealTimeProtectionEnabled === false) return "Open Windows Security.";
  if (stats.diskFreeGB < settings.diskWarnGB) return "Review Storage Settings.";
  if (stats.ramUsagePercent > settings.ramWarnPercent) return "Close unused memory-heavy apps.";
  if (stats.cpuUsagePercent > 80) return "Check Task Manager.";
  if ((stats.gpuUsagePercent || 0) > 80) return "Close overlays or graphics-heavy apps.";
  return "No action needed right now.";
}

function getAdvice(stats, online) {
  const advice = [];

  if (stats.security && stats.security.RealTimeProtectionEnabled === false) {
    advice.push({
      title: "Security protection is off",
      body: "Open Windows Security and review protection.",
      priority: "High"
    });
  }

  if (stats.cpuTempC !== null && stats.cpuTempC >= settings.tempHotC) {
    advice.push({
      title: "CPU temperature is high",
      body: "Close heavy apps and check cooling.",
      priority: "High"
    });
  } else if (stats.cpuTempC !== null && stats.cpuTempC >= settings.tempWarnC) {
    advice.push({
      title: "CPU is getting warm",
      body: "Watch temps during long sessions.",
      priority: "Medium"
    });
  }

  if (stats.gpuTempC !== null && stats.gpuTempC >= settings.tempHotC) {
    advice.push({
      title: "GPU temperature is high",
      body: "Improve airflow or close graphics-heavy apps.",
      priority: "High"
    });
  } else if (stats.gpuTempC !== null && stats.gpuTempC >= settings.tempWarnC) {
    advice.push({
      title: "GPU is getting warm",
      body: "Keep an eye on airflow and fan noise.",
      priority: "Medium"
    });
  }

  if (stats.diskFreeGB < 10) {
    advice.push({
      title: "C: drive is almost full",
      body: "Free space soon to avoid update issues.",
      priority: "High"
    });
  } else if (stats.diskFreeGB < settings.diskWarnGB) {
    advice.push({
      title: "Storage is getting low",
      body: "Remove old downloads or unused apps.",
      priority: "Medium"
    });
  }

  if (stats.ramUsagePercent > 85) {
    advice.push({
      title: "Memory usage is high",
      body: "Close unused apps or browser tabs.",
      priority: "High"
    });
  } else if (stats.ramUsagePercent > settings.ramWarnPercent) {
    advice.push({
      title: "Memory is climbing",
      body: "Check Top Apps before it slows down.",
      priority: "Medium"
    });
  }

  if (stats.cpuUsagePercent > 85) {
    advice.push({
      title: "CPU load is high",
      body: "Open Task Manager and check CPU usage.",
      priority: "Medium"
    });
  }

  if (stats.gpuUsagePercent !== null && stats.gpuUsagePercent > 85) {
    advice.push({
      title: "GPU load is high",
      body: "Close games, recording tools, or overlays.",
      priority: "Medium"
    });
  }

  if (!online) {
    advice.push({
      title: "Internet is offline",
      body: "Check Wi-Fi, Ethernet, or router.",
      priority: "High"
    });
  }

  if (stats.uptimeSeconds > 259200) {
    advice.push({
      title: "Restart recommended",
      body: "Your PC has been running for several days.",
      priority: "Low"
    });
  }

  if (advice.length === 0) {
    advice.push({
      title: "System looks calm",
      body: "No urgent fixes needed right now.",
      priority: "Good"
    });

    advice.push({
      title: "Ready for use",
      body: "Performance, memory, storage, network, and security look stable.",
      priority: "Good"
    });
  }

  return advice.slice(0, 3);
}

function getFixPlan(stats, online) {
  const plan = [];

  plan.push("Review live readings and check anything marked Medium or High.");

  if (stats.security && stats.security.RealTimeProtectionEnabled === false) {
    plan.push("Open Windows Security and turn real-time protection back on.");
  }

  if (stats.diskFreeGB < settings.diskWarnGB) {
    plan.push("Open Storage Settings and manually remove large unused files.");
  }

  if (stats.ramUsagePercent > settings.ramWarnPercent) {
    plan.push("Close apps from Top Memory Apps that you are not using.");
  }

  if (stats.cpuUsagePercent > 80) {
    plan.push("Open Task Manager and sort by CPU usage.");
  }

  if (stats.gpuUsagePercent !== null && stats.gpuUsagePercent > 80) {
    plan.push("Close games, overlays, or recording tools you are not using.");
  }

  if (!online) {
    plan.push("Check Wi-Fi or Ethernet connection.");
  }

  if (plan.length === 1) {
    plan.push("No cleanup needed right now.");
    plan.push("Keep at least 50GB free on C: for smooth updates.");
  }

  return plan.slice(0, 4);
}

function calculateScore(stats, online) {
  let score = 100;

  if (stats.security && stats.security.RealTimeProtectionEnabled === false) score -= 20;

  if (stats.diskFreeGB < 10) score -= 30;
  else if (stats.diskFreeGB < settings.diskWarnGB) score -= 12;

  if (stats.ramUsagePercent > 85) score -= 15;
  else if (stats.ramUsagePercent > settings.ramWarnPercent) score -= 6;

  if (stats.cpuUsagePercent > 85) score -= 15;
  else if (stats.cpuUsagePercent > 70) score -= 6;

  if (stats.gpuUsagePercent !== null) {
    if (stats.gpuUsagePercent > 90) score -= 12;
    else if (stats.gpuUsagePercent > 75) score -= 5;
  }

  if (stats.cpuTempC !== null) {
    if (stats.cpuTempC >= settings.tempHotC) score -= 15;
    else if (stats.cpuTempC >= settings.tempWarnC) score -= 6;
  }

  if (stats.gpuTempC !== null) {
    if (stats.gpuTempC >= settings.tempHotC) score -= 15;
    else if (stats.gpuTempC >= settings.tempWarnC) score -= 6;
  }

  if (stats.uptimeSeconds > 259200) score -= 6;
  if (!online) score -= 20;

  return Math.max(0, score);
}

function buildDetail(view) {
  if (view === "settings") {
    return {
      title: "Settings",
      subtitle: "Tune scan speed, warning thresholds, privacy, and quick actions.",
      body: renderSettings()
    };
  }

  if (!latestStats) {
    return {
      title: "Overview",
      subtitle: "Waiting for first system scan.",
      body: `<div class="info-box">HaloSense is starting the first scan...</div>`
    };
  }

  const s = latestStats;
  const online = navigator.onLine;

  if (view === "overview") {
    const bestTemp = Math.max(s.cpuTempC || 0, s.gpuTempC || 0);
    const topApp = latestProcesses[0] ? latestProcesses[0].Name : "Waiting...";
    const secure = s.security === null ? "Unknown" : s.security.RealTimeProtectionEnabled ? "Protected" : "Needs attention";
    const bottleneck = getBottleneck(s);

    return {
      title: "Overview",
      subtitle: "Launch summary, health mood, bottleneck, and next best action.",
      body: `
        ${detailMeter("System health", `${lastScore}/100`, lastScore, "good", `Current system mood: ${getSystemMood(lastScore)}.`)}
        <div class="insight-strip">
          <div>
            <span>System mood</span>
            <strong>${getSystemMood(lastScore)}</strong>
          </div>
          <div>
            <span>Main pressure</span>
            <strong>${bottleneck.name} ${bottleneck.value}%</strong>
          </div>
          <div>
            <span>Next action</span>
            <strong>${getNextBestAction(s, online)}</strong>
          </div>
        </div>
        <div class="detail-grid">
          ${stat("CPU", `${s.cpuUsagePercent}%`)}
          ${stat("Memory", `${s.ramUsagePercent}%`)}
          ${stat("Storage", `${s.diskPercent}% used`)}
          ${stat("Highest temp", bestTemp ? `${bestTemp}°C` : "Unavailable")}
          ${stat("Network", online ? "Online" : "Offline")}
          ${stat("Security", secure)}
          ${stat("Top app", topApp)}
          ${stat("Uptime", formatUptime(s.uptimeSeconds))}
        </div>
        <div class="info-box">HaloSense keeps the dashboard clean: performance, temperature, storage, network status, security, and top apps without noisy extra data.</div>
      `
    };
  }

  if (view === "network") {
    const adapter = s.networkAdapters && s.networkAdapters.length > 0 ? s.networkAdapters[0] : null;

    return {
      title: "Network",
      subtitle: "Connection status, local IP, and active adapter.",
      body: `
        ${detailMeter("Connection", online ? "Online" : "Offline", online ? 100 : 0, online ? "good" : "danger", "Current network status.")}
        <div class="detail-grid">
          ${stat("Local IP", safeIp(s.localIPv4))}
          ${stat("Adapter", adapter ? adapter.Name : "Unavailable")}
          ${stat("Link speed", adapter ? adapter.LinkSpeed : "Unavailable")}
          ${stat("Status", online ? "Connected" : "Disconnected")}
        </div>
        <div class="info-box">${adapter ? adapter.InterfaceDescription : "No active adapter details found."}</div>
        <div class="tool-row">
          <button class="small-btn" data-tool="network">Network Settings</button>
        </div>
      `
    };
  }

  if (view === "cpu") {
    const level = getLoadLevel(s.cpuUsagePercent);

    return {
      title: "CPU",
      subtitle: "Processor load, threads, and temperature visibility.",
      body: `
        ${detailMeter("CPU load", `${s.cpuUsagePercent}%`, s.cpuUsagePercent, level, "Live processor activity.")}
        <div class="detail-grid">
          ${stat("Threads", s.cpuThreads)}
          ${stat("Temperature", s.cpuTempC === null ? "Currently unavailable" : `${s.cpuTempC}°C`)}
          ${stat("Sensor", s.cpuTempC === null ? "Not exposed by Windows" : s.cpuTempSource)}
          ${stat("Action", s.cpuUsagePercent > 80 ? "Check Task Manager" : "No action needed")}
        </div>
        <div class="info-box">${cleanCpuName(s.cpuName)}</div>
        <div class="tool-row">
          <button class="small-btn" data-tool="taskmgr">Open Task Manager</button>
          <button class="small-btn" data-copy-summary="true">Copy Summary</button>
        </div>
      `
    };
  }

  if (view === "gpu") {
    const usage = s.gpuUsagePercent === null ? 0 : s.gpuUsagePercent;
    const level = getLoadLevel(usage);
    const vram =
      s.gpuMemoryUsedMB !== null && s.gpuMemoryTotalMB !== null
        ? `${s.gpuMemoryUsedMB} MB / ${s.gpuMemoryTotalMB} MB`
        : "Currently unavailable";

    return {
      title: "GPU",
      subtitle: "Graphics load, temperature, and VRAM usage.",
      body: `
        ${detailMeter("GPU load", s.gpuUsagePercent === null ? "Unavailable" : `${s.gpuUsagePercent}%`, usage, level, "Live graphics usage.")}
        <div class="detail-grid">
          ${stat("Temperature", s.gpuTempC === null ? "Currently unavailable" : `${s.gpuTempC}°C`)}
          ${stat("VRAM", vram)}
          ${stat("Status", s.gpuTempC && s.gpuTempC > 80 ? "Warm" : "Normal")}
          ${stat("Action", usage > 80 ? "Close overlays/games" : "No action needed")}
        </div>
        <div class="info-box">${s.gpuName}</div>
        <div class="tool-row">
          <button class="small-btn" data-tool="display">Display Settings</button>
          <button class="small-btn" data-copy-summary="true">Copy Summary</button>
        </div>
      `
    };
  }

  if (view === "memory") {
    const level = getLoadLevel(s.ramUsagePercent);

    return {
      title: "Memory",
      subtitle: "RAM usage and active memory pressure.",
      body: `
        ${detailMeter("Memory used", `${s.ramUsagePercent}%`, s.ramUsagePercent, level, "Live RAM pressure.")}
        <div class="detail-grid">
          ${stat("Free RAM", `${s.freeRamGB} GB`)}
          ${stat("Total RAM", `${s.totalRamGB} GB`)}
          ${stat("Top app", latestProcesses[0] ? latestProcesses[0].Name : "Unavailable")}
          ${stat("Action", s.ramUsagePercent > settings.ramWarnPercent ? "Close unused apps" : "No action needed")}
        </div>
        <div class="info-box">High memory usage can slow down games, browsers, and creative apps.</div>
      `
    };
  }

  if (view === "storage") {
    const level = getLoadLevel(s.diskPercent);

    return {
      title: "Storage",
      subtitle: "C: drive capacity and free space.",
      body: `
        ${detailMeter("C: drive used", `${s.diskPercent}%`, s.diskPercent, level, "Main drive usage.")}
        <div class="detail-grid">
          ${stat("Free space", `${s.diskFreeGB} GB`)}
          ${stat("Total size", `${s.diskTotalGB} GB`)}
          ${stat("Recommended free", `${settings.diskWarnGB} GB+`)}
          ${stat("Action", s.diskFreeGB < settings.diskWarnGB ? "Review storage" : "No action needed")}
        </div>
        <div class="info-box">Keep free space available for Windows updates, game patches, and temporary files.</div>
        <div class="tool-row">
          <button class="small-btn" data-tool="storage">Open Storage Settings</button>
        </div>
      `
    };
  }

  if (view === "temps") {
    const bestTemp = Math.max(s.cpuTempC || 0, s.gpuTempC || 0);
    const level = bestTemp ? getTempLevel(bestTemp) : "good";

    return {
      title: "Temperatures",
      subtitle: "Thermal readings from available Windows or driver sensors.",
      body: `
        ${detailMeter("Highest temp", bestTemp ? `${bestTemp}°C` : "Unavailable", tempToBar(bestTemp), level, "Best available thermal reading.")}
        <div class="detail-grid">
          ${stat("CPU temp", s.cpuTempC === null ? "Currently unavailable" : `${s.cpuTempC}°C`)}
          ${stat("GPU temp", s.gpuTempC === null ? "Currently unavailable" : `${s.gpuTempC}°C`)}
          ${stat("CPU source", s.cpuTempC === null ? "Needs hardware monitor" : s.cpuTempSource)}
          ${stat("GPU source", s.gpuTempC === null ? "Unavailable" : "NVIDIA")}
        </div>
        <div class="info-box">CPU temperature often needs LibreHardwareMonitor or OpenHardwareMonitor running because Windows usually hides CPU sensors.</div>
      `
    };
  }

  if (view === "system") {
    return {
      title: "System",
      subtitle: "Windows, device, startup, and uptime information.",
      body: `
        ${detailMeter("Uptime", formatUptime(s.uptimeSeconds), 100, "good", "How long this PC has been running.")}
        <div class="detail-grid">
          ${stat("Device", settings.privacyMode ? "Hidden" : s.hostname)}
          ${stat("OS", s.osCaption)}
          ${stat("Build", s.osBuild)}
          ${stat("Architecture", s.arch)}
          ${stat("Startup entries", s.startupCount === null ? "Unavailable" : s.startupCount)}
          ${stat("Platform", s.platform)}
        </div>
        <div class="info-box">Startup entries can affect boot speed. Use the Startup button to review them safely.</div>
        <div class="tool-row">
          <button class="small-btn" data-tool="startup">Startup Apps</button>
          <button class="small-btn" data-tool="update">Windows Update</button>
          <button class="small-btn" data-tool="power">Power Settings</button>
        </div>
      `
    };
  }

  if (view === "apps") {
    const topMemory = latestProcesses[0] ? latestProcesses[0].MemoryMB : 0;

    return {
      title: "Top Memory Apps",
      subtitle: "Live grouped memory usage by app name.",
      body: `
        ${detailMeter("Top memory app", latestProcesses[0] ? `${topMemory} MB` : "Unavailable", topMemory ? 100 : 0, "good", latestProcesses[0] ? latestProcesses[0].Name : "Waiting for process scan.")}
        ${renderProcessesForDetail()}
      `
    };
  }

  if (view === "power") {
    const batteryPercent = s.battery && Number.isFinite(Number(s.battery.Percent)) ? Number(s.battery.Percent) : null;
    const level = batteryPercent === null ? "good" : batteryPercent < 20 ? "danger" : batteryPercent < 40 ? "warning" : "good";

    return {
      title: "Power",
      subtitle: "Battery, power mode, and energy behavior.",
      body: `
        ${detailMeter("Battery", batteryPercent === null ? "Desktop / unavailable" : `${batteryPercent}%`, batteryPercent === null ? 100 : batteryPercent, level, "Battery data appears only on devices that expose it.")}
        <div class="detail-grid">
          ${stat("Power plan", s.powerPlan || "Unavailable")}
          ${stat("Battery", batteryPercent === null ? "Unavailable" : `${batteryPercent}%`)}
          ${stat("Uptime", formatUptime(s.uptimeSeconds))}
          ${stat("Action", batteryPercent !== null && batteryPercent < 25 ? "Charge soon" : "No action needed")}
        </div>
        <div class="tool-row">
          <button class="small-btn" data-tool="power">Power Settings</button>
        </div>
      `
    };
  }

  if (view === "display") {
    const res =
      s.display && s.display.CurrentHorizontalResolution
        ? `${s.display.CurrentHorizontalResolution} × ${s.display.CurrentVerticalResolution}`
        : "Unavailable";

    const hz =
      s.display && s.display.CurrentRefreshRate
        ? `${s.display.CurrentRefreshRate} Hz`
        : "Unavailable";

    return {
      title: "Display",
      subtitle: "Screen resolution, refresh rate, and graphics output.",
      body: `
        ${detailMeter("Refresh rate", hz, s.display && s.display.CurrentRefreshRate ? Math.min(100, s.display.CurrentRefreshRate) : 0, "good", "Higher refresh rates feel smoother if supported.")}
        <div class="detail-grid">
          ${stat("Resolution", res)}
          ${stat("Refresh", hz)}
          ${stat("Color depth", s.display && s.display.CurrentBitsPerPixel ? `${s.display.CurrentBitsPerPixel}-bit` : "Unavailable")}
          ${stat("GPU", s.gpuName)}
        </div>
        <div class="tool-row">
          <button class="small-btn" data-tool="display">Display Settings</button>
        </div>
      `
    };
  }

  if (view === "security") {
    const realtime = s.security ? s.security.RealTimeProtectionEnabled : null;
    const level = realtime === false ? "danger" : "good";

    return {
      title: "Security",
      subtitle: "Windows security and protection status.",
      body: `
        ${detailMeter("Real-time protection", realtime === null ? "Unavailable" : realtime ? "Enabled" : "Disabled", realtime === false ? 20 : 100, level, "Checks Microsoft Defender status when Windows exposes it.")}
        <div class="detail-grid">
          ${stat("Antivirus", s.security === null ? "Unavailable" : s.security.AntivirusEnabled ? "Enabled" : "Disabled")}
          ${stat("Real-time", realtime === null ? "Unavailable" : realtime ? "Enabled" : "Disabled")}
          ${stat("Service", s.security === null ? "Unavailable" : s.security.AMServiceEnabled ? "Running" : "Stopped")}
          ${stat("Last quick scan", s.security && s.security.QuickScanEndTime ? String(s.security.QuickScanEndTime).split("T")[0] : "Unavailable")}
        </div>
        <div class="info-box">HaloSense does not change security settings automatically. It only shows status and gives you a safe shortcut.</div>
        <div class="tool-row">
          <button class="small-btn" data-tool="security">Windows Security</button>
        </div>
      `
    };
  }

  return buildDetail("overview");
}

function renderDetail(options = {}) {
  const preserveScroll = options.preserveScroll ?? true;
  const animated = options.animated ?? false;
  const force = options.force ?? false;

  const detailBody = el("detailBody");
  if (!detailBody) return;

  const previousScroll = detailBody.scrollTop;
  const detail = buildDetail(activeView);
  const signature = `${activeView}|${detail.title}|${detail.subtitle}|${detail.body}`;

  if (!force && signature === lastDetailSignature) return;

  lastDetailSignature = signature;

  setText("detailTitle", detail.title);
  setText("detailSubtitle", detail.subtitle);

  detailBody.classList.remove("detail-animated");

  if (animated && settings.animations) {
    void detailBody.offsetWidth;
    detailBody.classList.add("detail-animated");
  }

  detailBody.innerHTML = detail.body;

  requestAnimationFrame(() => {
    detailBody.scrollTop = preserveScroll ? previousScroll : 0;
  });
}

function renderSettings() {
  return `
    <div class="settings-layout">
      <div class="setting-section">
        <h4>Scan Behavior</h4>

        <label class="setting-row">
          <span>System scan speed</span>
          <select data-setting="refreshMs">
            <option value="2500" ${settings.refreshMs === 2500 ? "selected" : ""}>Fast - 2.5 seconds</option>
            <option value="3500" ${settings.refreshMs === 3500 ? "selected" : ""}>Balanced - 3.5 seconds</option>
            <option value="6000" ${settings.refreshMs === 6000 ? "selected" : ""}>Quiet - 6 seconds</option>
          </select>
        </label>

        <label class="setting-row">
          <span>Top apps scan speed</span>
          <select data-setting="processMs">
            <option value="1200" ${settings.processMs === 1200 ? "selected" : ""}>Fast</option>
            <option value="2000" ${settings.processMs === 2000 ? "selected" : ""}>Balanced</option>
            <option value="4000" ${settings.processMs === 4000 ? "selected" : ""}>Quiet</option>
          </select>
        </label>
      </div>

      <div class="setting-section">
        <h4>Warning Thresholds</h4>

        <label class="setting-row">
          <span>Storage warning under GB</span>
          <input type="number" min="10" max="200" data-setting="diskWarnGB" value="${settings.diskWarnGB}" />
        </label>

        <label class="setting-row">
          <span>RAM warning over %</span>
          <input type="number" min="50" max="95" data-setting="ramWarnPercent" value="${settings.ramWarnPercent}" />
        </label>

        <label class="setting-row">
          <span>Temperature warning °C</span>
          <input type="number" min="50" max="95" data-setting="tempWarnC" value="${settings.tempWarnC}" />
        </label>

        <label class="setting-row">
          <span>Temperature danger °C</span>
          <input type="number" min="60" max="110" data-setting="tempHotC" value="${settings.tempHotC}" />
        </label>
      </div>

      <div class="setting-section">
        <h4>Experience</h4>

        <label class="setting-row check-row">
          <span>Animations</span>
          <input type="checkbox" data-setting="animations" ${settings.animations ? "checked" : ""} />
        </label>

        <label class="setting-row check-row">
          <span>Compact mode</span>
          <input type="checkbox" data-setting="compact" ${settings.compact ? "checked" : ""} />
        </label>

        <label class="setting-row check-row">
          <span>Privacy mode</span>
          <input type="checkbox" data-setting="privacyMode" ${settings.privacyMode ? "checked" : ""} />
        </label>
      </div>

      <div class="setting-section">
        <h4>Quick Actions</h4>
        <div class="tool-row inside-section">
          <button class="small-btn" data-tool="taskmgr">Task Manager</button>
          <button class="small-btn" data-tool="storage">Storage</button>
          <button class="small-btn" data-tool="startup">Startup</button>
          <button class="small-btn" data-tool="update">Windows Update</button>
          <button class="small-btn" data-tool="security">Security</button>
          <button class="small-btn" data-reset-settings="true">Reset</button>
          <button class="small-btn" data-copy-summary="true">Copy Summary</button>
        </div>
      </div>
    </div>

    <div class="info-box">
      Settings are saved locally on this computer. Privacy Mode hides local IP and device name from the visible report.
    </div>
  `;
}

function renderProcessesForDetail() {
  if (!latestProcesses || latestProcesses.length === 0) {
    return `<div class="info-box">Top apps currently unavailable.</div>`;
  }

  const maxMemory = Math.max(...latestProcesses.map((p) => p.MemoryMB || 1));

  return `
    <div class="process-list detail-processes">
      ${latestProcesses
        .map((process) => {
          const percent = Math.round(((process.MemoryMB || 0) / maxMemory) * 100);
          const countText = process.Count > 1 ? `${process.Count} processes` : "1 process";

          return `
            <div class="process-row">
              <div class="process-top">
                <div>
                  <strong>${process.Name}</strong>
                  <small>${countText}</small>
                </div>
                <span>${process.MemoryMB} MB</span>
              </div>
              <div class="process-bar">
                <div style="width:${percent}%"></div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAdvice(advice) {
  latestAdvice = advice;
  const target = el("recommendations");
  if (!target) return;

  const html = advice
    .map((item) => {
      return `
        <div class="advice-item ${item.priority.toLowerCase()}">
          <div>
            <strong>${item.title}</strong>
            <p>${item.body}</p>
          </div>
          <span>${item.priority}</span>
        </div>
      `;
    })
    .join("");

  if (target.innerHTML !== html) {
    target.innerHTML = html;
  }
}

function updateFixPlan(stats, online) {
  const target = el("fixPlan");
  if (!target) return;

  const plan = getFixPlan(stats, online);

  const html = plan
    .map((item, index) => {
      return `
        <div class="plan-step">
          <span>${index + 1}</span>
          <p>${item}</p>
        </div>
      `;
    })
    .join("");

  if (target.innerHTML !== html) {
    target.innerHTML = html;
  }
}

function updateProcessesList(processes) {
  latestProcesses = processes || [];

  if (latestProcesses.length > 0) {
    setText("appsSummary", `${latestProcesses.length}`);
  }

  if ((activeView === "apps" || activeView === "memory" || activeView === "overview") && !shouldHoldDetailUpdate()) {
    renderDetail({ preserveScroll: true, animated: false, force: false });
  }
}

async function loadTopProcesses() {
  if (isProcessScanning) return;
  isProcessScanning = true;

  try {
    const processes = await ipcRenderer.invoke("get-top-processes");
    updateProcessesList(processes);
  } finally {
    isProcessScanning = false;
  }
}

function buildReport(stats, advice) {
  const cpuTemp = stats.cpuTempC === null ? "Currently unavailable" : `${stats.cpuTempC} C`;
  const gpuTemp = stats.gpuTempC === null ? "Currently unavailable" : `${stats.gpuTempC} C`;
  const gpuUsage = stats.gpuUsagePercent === null ? "Currently unavailable" : `${stats.gpuUsagePercent}%`;

  return `
HaloSense Health Report
Generated: ${new Date().toLocaleString()}

Health Score:
${el("healthScore").textContent}/100

CPU:
${stats.cpuName}
Threads: ${stats.cpuThreads}
Usage: ${stats.cpuUsagePercent}%
Temperature: ${cpuTemp}

GPU:
${stats.gpuName}
Usage: ${gpuUsage}
Temperature: ${gpuTemp}

Memory:
${stats.ramUsagePercent}% used
${stats.freeRamGB}GB free of ${stats.totalRamGB}GB

Storage:
${stats.diskPercent}% used
${stats.diskFreeGB}GB free of ${stats.diskTotalGB}GB on C:

System:
Device: ${settings.privacyMode ? "Hidden" : stats.hostname}
OS: ${stats.osCaption}
Build: ${stats.osBuild}
Uptime: ${formatUptime(stats.uptimeSeconds)}
Internet: ${navigator.onLine ? "Online" : "Offline"}
Local IP: ${safeIp(stats.localIPv4)}

Advisor:
${advice.map((item, index) => `${index + 1}. ${item.title} - ${item.body}`).join("\n")}
`.trim();
}

async function loadStats() {
  if (isScanning) return;
  isScanning = true;

  try {
    const s = await ipcRenderer.invoke("get-pc-stats");
    latestStats = s;

    const online = navigator.onLine;

    const cpuLevel = getLoadLevel(s.cpuUsagePercent);
    setText("cpuUsage", `${s.cpuUsagePercent}%`);
    setBar("cpuBar", s.cpuUsagePercent);
    setBarLevel("cpuBar", cpuLevel);
    setTileLevel("cpu", cpuLevel);

    if (s.gpuUsagePercent === null) {
      setText("gpuUsage", "--%");
      setBar("gpuBar", 0);
      setBarLevel("gpuBar", "good");
      setTileLevel("gpu", "good");
    } else {
      const gpuLevel = getLoadLevel(s.gpuUsagePercent);
      setText("gpuUsage", `${s.gpuUsagePercent}%`);
      setBar("gpuBar", s.gpuUsagePercent);
      setBarLevel("gpuBar", gpuLevel);
      setTileLevel("gpu", gpuLevel);
    }

    const ramLevel = getLoadLevel(s.ramUsagePercent);
    setText("ramUsage", `${s.ramUsagePercent}%`);
    setBar("ramBar", s.ramUsagePercent);
    setBarLevel("ramBar", ramLevel);
    setTileLevel("memory", ramLevel);

    const storageLevel = getLoadLevel(s.diskPercent);
    setText("storageUsage", `${s.diskPercent}%`);
    setBar("storageBar", s.diskPercent);
    setBarLevel("storageBar", storageLevel);
    setTileLevel("storage", storageLevel);

    const bestTemp = Math.max(s.cpuTempC || 0, s.gpuTempC || 0);

    if (bestTemp > 0) {
      const tempLevel = getTempLevel(bestTemp);
      setText("tempSummary", `${bestTemp}°C`);
      setBar("tempBar", tempToBar(bestTemp));
      setBarLevel("tempBar", tempLevel);
      setTileLevel("temps", tempLevel);
    } else {
      setText("tempSummary", "--");
      setBar("tempBar", 0);
      setBarLevel("tempBar", "good");
      setTileLevel("temps", "good");
    }

    setText("networkSummary", online ? "Online" : "Offline");
    setBar("networkBar", online ? 100 : 0);
    setBarLevel("networkBar", online ? "good" : "danger");
    setTileLevel("network", online ? "good" : "danger");

    setText("systemSummary", formatUptime(s.uptimeSeconds));
    setBar("systemBar", 100);
    setBarLevel("systemBar", "good");
    setTileLevel("system", "good");

    setTileLevel("apps", "good");

    const batteryPercent = s.battery && Number.isFinite(Number(s.battery.Percent)) ? Number(s.battery.Percent) : null;
    const batteryLevel =
      batteryPercent !== null && batteryPercent < 20
        ? "danger"
        : batteryPercent !== null && batteryPercent < 40
        ? "warning"
        : "good";

    setText("powerSummary", batteryPercent === null ? "Plan" : `${batteryPercent}%`);
    setBar("powerBar", batteryPercent === null ? 100 : batteryPercent);
    setBarLevel("powerBar", batteryLevel);
    setTileLevel("power", batteryLevel);

    const displaySummary =
      s.display && s.display.CurrentRefreshRate
        ? `${s.display.CurrentRefreshRate}Hz`
        : "Ready";

    setText("displaySummary", displaySummary);
    setBar("displayBar", 100);
    setBarLevel("displayBar", "good");
    setTileLevel("display", "good");

    const secure = s.security === null ? true : s.security.RealTimeProtectionEnabled !== false;
    setText("securitySummary", secure ? "Safe" : "Alert");
    setBar("securityBar", secure ? 100 : 20);
    setBarLevel("securityBar", secure ? "good" : "danger");
    setTileLevel("security", secure ? "good" : "danger");

    const score = calculateScore(s, online);
    lastScore = score;

    const advice = getAdvice(s, online);

    document.title = `HaloSense • ${score}/100`;

    setText("healthScore", score);

    setText(
      "statusTitle",
      score >= 90
        ? "Premium Condition"
        : score >= 75
        ? "Stable With Minor Fixes"
        : "Needs Attention"
    );

    setText("statusText", "Click a category to open a focused detail view.");

    renderAdvice(advice);
    updateFixPlan(s, online);

    if (!shouldHoldDetailUpdate()) {
      renderDetail({ preserveScroll: true, animated: false, force: false });
    }
  } catch (error) {
    console.error(error);
    setText("statusTitle", "Scan Error");
    setText("statusText", "HaloSense hit a scan issue. Check the terminal for details.");
  } finally {
    isScanning = false;
  }
}

async function runSafeOptimizer() {
  setText("optimizerStatus", "Running safe optimizer. No files are deleted.");

  const result = await ipcRenderer.invoke("run-safe-optimizer");

  await loadStats();
  await loadTopProcesses();

  setText("optimizerStatus", `${result.Message} DNS cache: ${result.DNS}.`);
}

async function saveHealthReport() {
  if (!latestStats) return;

  const report = buildReport(latestStats, latestAdvice);
  const filePath = await ipcRenderer.invoke("save-health-report", report);

  setText("optimizerStatus", `Report saved: ${filePath}`);
}

function copySummary() {
  if (!latestStats) return;

  const report = buildReport(latestStats, latestAdvice);
  clipboard.writeText(report);
  setText("optimizerStatus", "Current health summary copied.");
}

function activateView(view) {
  if (view === "settings") {
    if (activeView === "settings") {
      view = previousViewBeforeSettings || "overview";
    } else {
      previousViewBeforeSettings = activeView || "overview";
    }
  } else {
    previousViewBeforeSettings = view;
  }

  const changedView = activeView !== view;
  lastManualViewChangeAt = Date.now();

  document.querySelectorAll(".tile").forEach((tile) => tile.classList.remove("active"));

  const tile = document.querySelector(`.tile[data-view="${view}"]`);

  if (tile) {
    tile.classList.add("active");
  }

  activeView = view;
  renderDetail({
    preserveScroll: !changedView,
    animated: false,
    force: true
  });
}

function startTimers() {
  if (scanTimer) clearInterval(scanTimer);
  if (processTimer) clearInterval(processTimer);

  scanTimer = setInterval(loadStats, settings.refreshMs);
  processTimer = setInterval(loadTopProcesses, settings.processMs);
}

document.querySelectorAll(".tile").forEach((tile) => {
  tile.title = `Open ${tile.querySelector("span:not(.icon)")?.textContent || "panel"} details`;

  tile.addEventListener("click", () => {
    activateView(tile.dataset.view);
  });
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const toolButton = target.closest("[data-tool]");
  const copyButton = target.closest("[data-copy-summary]");
  const resetButton = target.closest("[data-reset-settings]");

  if (toolButton) {
    ipcRenderer.invoke("open-windows-tool", toolButton.dataset.tool);
  }

  if (copyButton) {
    copySummary();
  }

  if (resetButton) {
    settings = { ...defaultSettings };
    saveSettings();
    startTimers();
    lastDetailSignature = "";
    renderDetail({ preserveScroll: true, animated: false, force: true });
  }
});

document.addEventListener("change", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const setting = target.dataset.setting;

  if (!setting) return;

  if (target.type === "checkbox") {
    settings[setting] = target.checked;
  } else {
    settings[setting] = Number(target.value);
  }

  saveSettings();
  startTimers();
  lastDetailSignature = "";
  renderDetail({ preserveScroll: true, animated: false, force: true });
  loadStats();
});

el("optimizeBtn").addEventListener("click", runSafeOptimizer);
el("reportBtn").addEventListener("click", saveHealthReport);
el("settingsBtn").addEventListener("click", () => activateView("settings"));

el("storageSettingsBtn").addEventListener("click", () => {
  ipcRenderer.invoke("open-windows-tool", "storage");
});

el("startupSettingsBtn").addEventListener("click", () => {
  ipcRenderer.invoke("open-windows-tool", "startup");
});

el("taskManagerBtn").addEventListener("click", () => {
  ipcRenderer.invoke("open-windows-tool", "taskmgr");
});

applySettings();
loadStats();
loadTopProcesses();
startTimers();