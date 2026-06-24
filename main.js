const { app, BrowserWindow, ipcMain, shell, Menu } = require("electron");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

let lastCpuSnapshot = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 780,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#060f1c",
    title: "HaloSense",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile("index.html");
}

function runPowerShell(script, timeout = 9000) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout },
      (error, stdout) => {
        if (error) return resolve("");
        resolve(stdout.trim());
      }
    );
  });
}

function getCpuUsagePercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  cpus.forEach((cpu) => {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.idle +
      cpu.times.irq;
  });

  if (!lastCpuSnapshot) {
    lastCpuSnapshot = { idle, total };
    return 0;
  }

  const idleDiff = idle - lastCpuSnapshot.idle;
  const totalDiff = total - lastCpuSnapshot.total;
  lastCpuSnapshot = { idle, total };

  if (totalDiff <= 0) return 0;

  const usage = 100 - Math.round((idleDiff / totalDiff) * 100);
  return Math.max(0, Math.min(100, usage));
}

function getLocalIPv4() {
  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  return "Unavailable";
}

async function getTopProcesses() {
  const topProcessScript = `
    $groups = Get-Process |
      Where-Object { $_.WorkingSet64 -gt 0 } |
      Group-Object ProcessName;

    $groups |
      ForEach-Object {
        $sum = ($_.Group | Measure-Object -Property WorkingSet64 -Sum).Sum;

        [pscustomobject]@{
          Name = $_.Name;
          MemoryMB = [math]::Round($sum / 1MB, 0);
          Count = $_.Count
        }
      } |
      Sort-Object MemoryMB -Descending |
      Select-Object -First 8 |
      ConvertTo-Json -Compress
  `;

  const raw = await runPowerShell(topProcessScript, 5000);

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

ipcMain.handle("get-top-processes", async () => {
  return await getTopProcesses();
});

ipcMain.handle("get-pc-stats", async () => {
  const totalRam = os.totalmem();
  const freeRam = os.freemem();
  const usedRam = totalRam - freeRam;

  const diskScript = `
    $d = Get-PSDrive -Name C;
    [pscustomobject]@{
      Used = $d.Used;
      Free = $d.Free;
      Total = ($d.Used + $d.Free)
    } | ConvertTo-Json -Compress
  `;

  const gpuNameScript = `
    Get-CimInstance Win32_VideoController |
    Where-Object { $_.Name -notmatch 'Microsoft|Remote' } |
    Select-Object -First 1 -ExpandProperty Name
  `;

  const nvidiaScript = `
    $nvidia = $null;

    $cmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue;
    if ($null -ne $cmd) {
      $nvidia = $cmd.Source;
    }

    if ($null -eq $nvidia) {
      $possible = @(
        "$env:ProgramFiles\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe",
        "$env:SystemRoot\\System32\\nvidia-smi.exe"
      );

      foreach ($p in $possible) {
        if (Test-Path $p) {
          $nvidia = $p;
          break;
        }
      }
    }

    if ($null -eq $nvidia) {
      "UNAVAILABLE"
    } else {
      & $nvidia --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>$null |
      Select-Object -First 1
    }
  `;

  const gpuCounterScript = `
    $samples = (Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples;

    if ($null -eq $samples) {
      "UNAVAILABLE"
    } else {
      $sum = ($samples | Where-Object { $_.CookedValue -gt 0 } | Measure-Object -Property CookedValue -Sum).Sum;

      if ($null -eq $sum) {
        0
      } else {
        [math]::Min(100, [math]::Round($sum, 0))
      }
    }
  `;

  const cpuTempScript = `
    $temps = @();

    foreach ($ns in @("root\\LibreHardwareMonitor", "root\\OpenHardwareMonitor")) {
      try {
        $items = Get-CimInstance -Namespace $ns -ClassName Sensor -ErrorAction Stop |
          Where-Object {
            $_.SensorType -eq "Temperature" -and
            ($_.Name -match "CPU Package|Core Max|CPU Core|CPU")
          };

        foreach ($item in $items) {
          $temps += [pscustomobject]@{
            Name = $item.Name;
            Value = [math]::Round($item.Value, 0);
            Source = $ns
          };
        }
      } catch {}
    }

    if ($temps.Count -gt 0) {
      $temps |
        Sort-Object Value -Descending |
        Select-Object -First 1 |
        ConvertTo-Json -Compress
    } else {
      "UNAVAILABLE"
    }
  `;

  const osInfoScript = `
    Get-CimInstance Win32_OperatingSystem |
    Select-Object Caption, Version, BuildNumber |
    ConvertTo-Json -Compress
  `;

  const startupScript = `
    try {
      $items = Get-CimInstance Win32_StartupCommand -ErrorAction Stop;
      [pscustomobject]@{
        Count = ($items | Measure-Object).Count
      } | ConvertTo-Json -Compress
    } catch {
      "UNAVAILABLE"
    }
  `;

  const networkAdapterScript = `
    try {
      Get-NetAdapter |
      Where-Object { $_.Status -eq "Up" } |
      Select-Object -First 2 Name, InterfaceDescription, LinkSpeed |
      ConvertTo-Json -Compress
    } catch {
      "UNAVAILABLE"
    }
  `;

  const batteryScript = `
    try {
      $b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1;

      if ($null -eq $b) {
        "UNAVAILABLE"
      } else {
        [pscustomobject]@{
          Percent = $b.EstimatedChargeRemaining;
          Status = $b.BatteryStatus
        } | ConvertTo-Json -Compress
      }
    } catch {
      "UNAVAILABLE"
    }
  `;

  const powerPlanScript = `
    try {
      $raw = powercfg /getactivescheme;
      $name = "Unknown";

      if ($raw -match "\\((.*?)\\)") {
        $name = $Matches[1];
      }

      [pscustomobject]@{
        Plan = $name
      } | ConvertTo-Json -Compress
    } catch {
      "UNAVAILABLE"
    }
  `;

  const displayScript = `
    try {
      Get-CimInstance Win32_VideoController |
      Where-Object { $_.CurrentHorizontalResolution -ne $null } |
      Select-Object -First 1 CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate, CurrentBitsPerPixel |
      ConvertTo-Json -Compress
    } catch {
      "UNAVAILABLE"
    }
  `;

  const securityScript = `
    try {
      $mp = Get-MpComputerStatus -ErrorAction Stop;
      [pscustomobject]@{
        AMServiceEnabled = $mp.AMServiceEnabled;
        AntivirusEnabled = $mp.AntivirusEnabled;
        RealTimeProtectionEnabled = $mp.RealTimeProtectionEnabled;
        QuickScanEndTime = $mp.QuickScanEndTime
      } | ConvertTo-Json -Compress
    } catch {
      "UNAVAILABLE"
    }
  `;

  const [
    diskRaw,
    gpuNameRaw,
    nvidiaRaw,
    gpuCounterRaw,
    cpuTempRaw,
    osInfoRaw,
    startupRaw,
    adapterRaw,
    batteryRaw,
    powerPlanRaw,
    displayRaw,
    securityRaw
  ] = await Promise.all([
    runPowerShell(diskScript),
    runPowerShell(gpuNameScript),
    runPowerShell(nvidiaScript),
    runPowerShell(gpuCounterScript),
    runPowerShell(cpuTempScript),
    runPowerShell(osInfoScript),
    runPowerShell(startupScript),
    runPowerShell(networkAdapterScript),
    runPowerShell(batteryScript),
    runPowerShell(powerPlanScript),
    runPowerShell(displayScript),
    runPowerShell(securityScript)
  ]);

  let diskFree = 0;
  let diskTotal = 0;
  let diskPercent = 0;

  try {
    const disk = JSON.parse(diskRaw);
    const diskUsed = disk.Used || 0;
    diskFree = disk.Free || 0;
    diskTotal = disk.Total || diskUsed + diskFree;

    if (diskTotal > 0) {
      diskPercent = Math.round((diskUsed / diskTotal) * 100);
    }
  } catch {}

  let gpuUsagePercent = null;
  let gpuTempC = null;
  let gpuMemoryUsedMB = null;
  let gpuMemoryTotalMB = null;

  if (nvidiaRaw && nvidiaRaw !== "UNAVAILABLE") {
    const line = nvidiaRaw.split(/\r?\n/)[0];
    const parts = line.split(",").map((part) => Number.parseInt(part.trim(), 10));

    if (Number.isFinite(parts[0])) gpuUsagePercent = parts[0];
    if (Number.isFinite(parts[1])) gpuTempC = parts[1];
    if (Number.isFinite(parts[2])) gpuMemoryUsedMB = parts[2];
    if (Number.isFinite(parts[3])) gpuMemoryTotalMB = parts[3];
  }

  if (gpuUsagePercent === null) {
    const fallbackGpuUsage = Number.parseInt(gpuCounterRaw, 10);
    gpuUsagePercent = Number.isFinite(fallbackGpuUsage) ? fallbackGpuUsage : null;
  }

  let cpuTempC = null;
  let cpuTempSource = "Currently unavailable";

  if (cpuTempRaw && cpuTempRaw !== "UNAVAILABLE") {
    try {
      const temp = JSON.parse(cpuTempRaw);
      if (Number.isFinite(Number(temp.Value))) {
        cpuTempC = Number(temp.Value);
        cpuTempSource = temp.Source || temp.Name || "Windows sensor";
      }
    } catch {}
  }

  let osCaption = "Windows";
  let osVersion = os.release();
  let osBuild = "Unknown";

  try {
    const parsedOS = JSON.parse(osInfoRaw);
    osCaption = parsedOS.Caption || osCaption;
    osVersion = parsedOS.Version || osVersion;
    osBuild = parsedOS.BuildNumber || osBuild;
  } catch {}

  let startupCount = null;

  if (startupRaw && startupRaw !== "UNAVAILABLE") {
    try {
      const parsedStartup = JSON.parse(startupRaw);
      startupCount = Number.isFinite(Number(parsedStartup.Count))
        ? Number(parsedStartup.Count)
        : null;
    } catch {}
  }

  let networkAdapters = [];

  if (adapterRaw && adapterRaw !== "UNAVAILABLE") {
    try {
      const parsedAdapters = JSON.parse(adapterRaw);
      networkAdapters = Array.isArray(parsedAdapters) ? parsedAdapters : [parsedAdapters];
    } catch {}
  }

  let battery = null;

  if (batteryRaw && batteryRaw !== "UNAVAILABLE") {
    try {
      battery = JSON.parse(batteryRaw);
    } catch {}
  }

  let powerPlan = "Unavailable";

  if (powerPlanRaw && powerPlanRaw !== "UNAVAILABLE") {
    try {
      const parsedPower = JSON.parse(powerPlanRaw);
      powerPlan = parsedPower.Plan || "Unavailable";
    } catch {}
  }

  let display = null;

  if (displayRaw && displayRaw !== "UNAVAILABLE") {
    try {
      display = JSON.parse(displayRaw);
    } catch {}
  }

  let security = null;

  if (securityRaw && securityRaw !== "UNAVAILABLE") {
    try {
      security = JSON.parse(securityRaw);
    } catch {}
  }

  return {
    cpuName: os.cpus()[0].model,
    cpuThreads: os.cpus().length,
    cpuUsagePercent: getCpuUsagePercent(),
    cpuTempC,
    cpuTempSource,

    totalRamGB: Math.round(totalRam / 1024 / 1024 / 1024),
    freeRamGB: Math.round(freeRam / 1024 / 1024 / 1024),
    ramUsagePercent: Math.round((usedRam / totalRam) * 100),

    diskPercent,
    diskFreeGB: Math.round(diskFree / 1024 / 1024 / 1024),
    diskTotalGB: Math.round(diskTotal / 1024 / 1024 / 1024),

    gpuName: gpuNameRaw || "GPU not detected",
    gpuUsagePercent,
    gpuTempC,
    gpuMemoryUsedMB,
    gpuMemoryTotalMB,

    hostname: os.hostname(),
    arch: os.arch(),
    platform: os.platform(),
    localIPv4: getLocalIPv4(),
    uptimeSeconds: Math.round(os.uptime()),

    osCaption,
    osVersion,
    osBuild,
    startupCount,
    networkAdapters,

    battery,
    powerPlan,
    display,
    security
  };
});

ipcMain.handle("run-safe-optimizer", async () => {
  const optimizerScript = `
    $closed = @();
    $protected = @();
    $suggested = @();
    $errors = @();
    $memoryFreed = 0;

    try {
      ipconfig /flushdns | Out-Null;
      $dns = "Refreshed";
    } catch {
      $dns = "Skipped";
    }

    $protectedPatterns = @(
      "^system$", "^idle$", "^registry$", "^secure system$", "^smss$", "^csrss$", "^wininit$", "^winlogon$",
      "^services$", "^lsass$", "^svchost$", "^dwm$", "^explorer$", "^taskhostw$", "^sihost$", "^fontdrvhost$",
      "^audiodg$", "^spoolsv$", "^ctfmon$", "^wlanext$", "^wmiprvse$", "^msmpeng$", "^securityhealthservice$",
      "^nissrv$", "^powershell$", "^pwsh$", "^cmd$", "^conhost$", "^node$", "^electron$", "^halosense$",
      "^code$", "^chrome$", "^msedge$", "^firefox$", "^brave$", "^opera$", "^steam$", "^epicgameslauncher$", "^battle.net$", "^riotclientservices$",
      "lighting", "aura", "armoury", "crate", "icue", "corsair", "razer", "synapse", "signalrgb", "openrgb", "rgb", "mystic",
      "lghub", "logitech", "steelseries", "nzxt", "cam", "gigabyte", "msi", "gskill", "hyperx", "thermaltake", "tt rgb", "polychrome"
    );

    $safeClosable = @(
      "Widgets", "PhoneExperienceHost", "YourPhone", "GameBar", "GameBarFTServer", "GameBarPresenceWriter", "XboxGameBar", "Cortana"
    );

    function Test-ProtectedProcess($name) {
      foreach ($pattern in $protectedPatterns) {
        if ($name -match $pattern) { return $true; }
      }
      return $false;
    }

    function Test-SafeClosableProcess($name) {
      foreach ($safeName in $safeClosable) {
        if ($name -ieq $safeName) { return $true; }
      }
      if ($name -like "GameBar*") { return $true; }
      if ($name -like "Xbox*") { return $true; }
      return $false;
    }

    $processes = Get-Process |
      Where-Object { $_.Id -ne $PID -and $_.WorkingSet64 -gt 0 } |
      Sort-Object WorkingSet64 -Descending;

    foreach ($process in $processes) {
      $name = $process.ProcessName;
      $memoryMB = [math]::Round($process.WorkingSet64 / 1MB, 0);
      $hasWindow = -not [string]::IsNullOrWhiteSpace($process.MainWindowTitle);
      $isProtected = Test-ProtectedProcess $name;
      $isSafeClosable = Test-SafeClosableProcess $name;

      if ($isProtected) {
        if ($memoryMB -ge 80 -and $protected.Count -lt 12) {
          $protected += [pscustomobject]@{ Name = $name; MemoryMB = $memoryMB; Reason = "Protected app, system app, browser, launcher, or RGB/lighting software" };
        }
        continue;
      }

      if ($isSafeClosable -and -not $hasWindow -and $memoryMB -ge 40) {
        try {
          Stop-Process -Id $process.Id -Force -ErrorAction Stop;
          $memoryFreed += $memoryMB;
          $closed += [pscustomobject]@{ Name = $name; MemoryMB = $memoryMB; Reason = "Safe optional background process" };
        } catch {
          $errors += [pscustomobject]@{ Name = $name; MemoryMB = $memoryMB; Reason = "Could not close safely" };
        }
        continue;
      }

      if (-not $hasWindow -and $memoryMB -ge 250 -and $suggested.Count -lt 6) {
        $suggested += [pscustomobject]@{ Name = $name; MemoryMB = $memoryMB; Reason = "High-memory background process; review before closing" };
      }
    }

    [pscustomobject]@{
      FilesDeleted = 0;
      PersonalFilesTouched = $false;
      DNS = $dns;
      ClosedCount = $closed.Count;
      MemoryFreedMB = $memoryFreed;
      ProtectedCount = $protected.Count;
      SuggestedCount = $suggested.Count;
      ClosedApps = $closed;
      ProtectedApps = $protected;
      SuggestedApps = $suggested;
      Errors = $errors;
      Message = "Smart optimizer completed. Safe background cleanup ran without touching personal files. RGB and lighting apps were protected."
    } | ConvertTo-Json -Compress -Depth 5
  `;

  const raw = await runPowerShell(optimizerScript, 15000);

  try {
    return JSON.parse(raw);
  } catch {
    return {
      FilesDeleted: 0,
      PersonalFilesTouched: false,
      DNS: "Skipped",
      ClosedCount: 0,
      MemoryFreedMB: 0,
      ProtectedCount: 0,
      SuggestedCount: 0,
      ClosedApps: [],
      ProtectedApps: [],
      SuggestedApps: [],
      Errors: [],
      Message: "Smart optimizer completed, but detailed cleanup results were unavailable. No files were deleted."
    };
  }
});

ipcMain.handle("open-windows-tool", async (_, tool) => {
  if (tool === "storage") {
    await shell.openExternal("ms-settings:storagesense");
    return true;
  }

  if (tool === "startup") {
    await shell.openExternal("ms-settings:startupapps");
    return true;
  }

  if (tool === "update") {
    await shell.openExternal("ms-settings:windowsupdate");
    return true;
  }

  if (tool === "network") {
    await shell.openExternal("ms-settings:network");
    return true;
  }

  if (tool === "display") {
    await shell.openExternal("ms-settings:display");
    return true;
  }

  if (tool === "power") {
    await shell.openExternal("ms-settings:powersleep");
    return true;
  }

  if (tool === "security") {
    await shell.openExternal("ms-settings:windowsdefender");
    return true;
  }

  if (tool === "taskmgr") {
    execFile("cmd.exe", ["/c", "start", "", "taskmgr"], { windowsHide: false });
    return true;
  }

  return false;
});

ipcMain.handle("save-health-report", async (_, text) => {
  const desktop = app.getPath("desktop");
  const stamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");

  const filePath = path.join(desktop, `HaloSense_Report_${stamp}.txt`);

  fs.writeFileSync(filePath, text, "utf8");
  shell.showItemInFolder(filePath);

  return filePath;
});


ipcMain.on("window:minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on("window:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on("window:close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});