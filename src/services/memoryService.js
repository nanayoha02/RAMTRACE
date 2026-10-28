const os = require('os');
const { execFile } = require('child_process');

// Cache for static hardware specs
let cachedHardware = null;
let lastHardwareFetchTime = 0;

// SMBIOS Memory Type mapping according to SMBIOS specification
const SMBIOS_TYPES = {
  18: 'DDR',
  19: 'DDR',
  20: 'DDR',
  21: 'DDR2',
  22: 'DDR2 FB-DIMM',
  24: 'DDR3',
  26: 'DDR4',
  27: 'LPDDR',
  28: 'LPDDR2',
  29: 'LPDDR3',
  30: 'LPDDR4',
  31: 'Logical non-volatile device',
  32: 'HBM',
  33: 'HBM2',
  34: 'DDR5',
  35: 'LPDDR5'
};

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, unit = 'GB') {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return 'No disponible';
  if (unit === 'MB') {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }
  // Standard GB (decimal or binary basis, decimal commonly shown for hardware, GiB for OS)
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1).replace('.', ',')} GB`;
}

/**
 * Query detailed hardware memory info using CIM / WMI
 */
function queryHardwareInfo() {
  return new Promise((resolve) => {
    const psScript = `
      try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop | Select-Object TotalVisibleMemorySize, FreePhysicalMemory, TotalVirtualMemorySize, FreeVirtualMemory, Caption, Version
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop | Select-Object Name, TotalPhysicalMemory
        $modules = Get-CimInstance Win32_PhysicalMemory -ErrorAction Stop | Select-Object BankLabel, DeviceLocator, Capacity, Manufacturer, Speed, ConfiguredClockSpeed, SMBIOSMemoryType, MemoryType, PartNumber, SerialNumber, Status
        [PSCustomObject]@{
          Success = $true
          OS = $os
          ComputerSystem = $cs
          Modules = @($modules)
        } | ConvertTo-Json -Depth 4
      } catch {
        [PSCustomObject]@{
          Success = $false
          Error = $_.Exception.Message
        } | ConvertTo-Json
      }
    `;

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 12000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve(getFallbackHardwareInfo());
      }
      try {
        const parsed = JSON.parse(stdout);
        if (!parsed.Success) {
          return resolve(getFallbackHardwareInfo());
        }
        resolve(parsed);
      } catch (parseErr) {
        resolve(getFallbackHardwareInfo());
      }
    });
  });
}

/**
 * Fallback in case WMI is restricted or unavailable
 * NOTE: Do NOT fabricate physical module entries. Only use OS-reported totals.
 */
function getFallbackHardwareInfo() {
  const total = os.totalmem();
  return {
    Success: true,
    Source: 'os-fallback',
    OS: {
      TotalVisibleMemorySize: Math.round(total / 1024),
      FreePhysicalMemory: Math.round(os.freemem() / 1024),
      TotalVirtualMemorySize: null,
      FreeVirtualMemory: null,
      Caption: `Windows (${os.type()} ${os.release()})`,
      Version: os.release()
    },
    ComputerSystem: {
      Name: os.hostname(),
      TotalPhysicalMemory: total
    },
    Modules: []
  };
}

/**
 * Get cached or fresh hardware information
 */
async function getHardwareInfo(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedHardware && (now - lastHardwareFetchTime < 60000)) {
    return cachedHardware;
  }
  const raw = await queryHardwareInfo();

  // Process and normalize modules
  const rawModules = Array.isArray(raw.Modules) ? raw.Modules : (raw.Modules ? [raw.Modules] : []);
  let totalInstalledHardwareBytes = 0;

  const processedModules = rawModules.map((m, index) => {
    const capBytes = Number(m.Capacity) || 0;
    totalInstalledHardwareBytes += capBytes;

    // Determine type
    let typeStr = 'No disponible';
    if (m.SMBIOSMemoryType && SMBIOS_TYPES[m.SMBIOSMemoryType]) {
      typeStr = SMBIOS_TYPES[m.SMBIOSMemoryType];
    } else if (m.MemoryType && SMBIOS_TYPES[m.MemoryType]) {
      typeStr = SMBIOS_TYPES[m.MemoryType];
    }

    // Determine speed in MT/s
    let speedStr = 'No disponible';
    const effectiveSpeed = m.ConfiguredClockSpeed || m.Speed;
    if (effectiveSpeed) {
      speedStr = `${effectiveSpeed} MT/s`;
    }

    return {
      index: index + 1,
      name: m.DeviceLocator || m.BankLabel || `DIMM ${index + 1}`,
      slot: m.DeviceLocator || m.BankLabel || `DIMM ${index + 1}`,
      bank: m.BankLabel || 'No disponible',
      capacityBytes: capBytes,
      capacityFormatted: formatBytes(capBytes, 'GB'),
      manufacturer: (m.Manufacturer && String(m.Manufacturer).trim()) || 'No disponible',
      type: typeStr,
      speed: speedStr,
      partNumber: (m.PartNumber && String(m.PartNumber).trim()) || 'No disponible',
      serialNumber: (m.SerialNumber && String(m.SerialNumber).trim()) || 'No disponible',
      status: 'Operativo'
    };
  });

  // If sum of modules was 0 and we got no real modules, do NOT invent modules.
  // Prefer OS total as fallback only if clearly from fallback source
  if (totalInstalledHardwareBytes === 0) {
    if (raw.Source === 'os-fallback') {
      totalInstalledHardwareBytes = os.totalmem();
    } else {
      // Try ComputerSystem.TotalPhysicalMemory as last resort
      const csTotal = raw.ComputerSystem && raw.ComputerSystem.TotalPhysicalMemory;
      if (csTotal) {
        totalInstalledHardwareBytes = Number(csTotal) || os.totalmem();
      } else {
        totalInstalledHardwareBytes = os.totalmem();
      }
    }
  }

  // Windows visible memory
  const visibleKb = raw.OS && raw.OS.TotalVisibleMemorySize;
  const usableBytes = visibleKb ? (visibleKb * 1024) : os.totalmem();

  // Committed virtual memory
  const totalVirtualKb = raw.OS && raw.OS.TotalVirtualMemorySize;
  const freeVirtualKb = raw.OS && raw.OS.FreeVirtualMemory;

  cachedHardware = {
    computerName: (raw.ComputerSystem && raw.ComputerSystem.Name) || os.hostname(),
    osName: (raw.OS && raw.OS.Caption) || `Windows (${os.release()})`,
    osVersion: (raw.OS && raw.OS.Version) || os.release(),
    totalInstalledBytes: totalInstalledHardwareBytes,
    totalUsableBytes: usableBytes,
    totalVirtualBytes: totalVirtualKb ? (totalVirtualKb * 1024) : null,
    freeVirtualBytes: freeVirtualKb ? (freeVirtualKb * 1024) : null,
    modules: processedModules,
    hardwareSource: raw.Source || (rawModules.length > 0 ? 'wmi-cim' : 'unknown')
  };
  lastHardwareFetchTime = now;
  return cachedHardware;
}

/**
 * Get instant real-time memory stats using Node native libuv (GlobalMemoryStatusEx)
 */
function getRealtimeMetrics(unit = 'GB') {
  const totalUsable = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(0, totalUsable - freeBytes);
  const percent = Math.min(100, Math.max(0, Math.round((usedBytes / totalUsable) * 100)));

  // Determine alert level according to project rubric
  // < 70% : Verde - Normal
  // 70% a < 85% : Amarillo - Elevado
  // >= 85% : Rojo - Muy elevado
  let level = 'normal';
  let statusText = 'Normal';
  let statusClass = 'positive';
  let recommendTitle = 'Utilización dentro del rango definido';
  let recommendText = 'El consumo actual está por debajo del umbral de alerta de esta práctica.';

  if (percent >= 85) {
    level = 'critical';
    statusText = 'Muy elevado';
    statusClass = 'danger';
    recommendTitle = 'Utilización muy elevada';
    recommendText = 'Revisa la carga del equipo y considera cerrar aplicaciones que no necesites.';
  } else if (percent >= 70) {
    level = 'warning';
    statusText = 'Elevado';
    statusClass = 'warning';
    recommendTitle = 'Utilización elevada';
    recommendText = 'Revisa las aplicaciones abiertas y el consumo de memoria.';
  }

  return {
    timestamp: Date.now(),
    percent,
    usedBytes,
    freeBytes,
    totalUsableBytes: totalUsable,
    usedFormatted: formatBytes(usedBytes, unit),
    freeFormatted: formatBytes(freeBytes, unit),
    totalUsableFormatted: formatBytes(totalUsable, unit),
    level,
    statusText,
    statusClass,
    recommendTitle,
    recommendText
  };
}

module.exports = {
  getHardwareInfo,
  getRealtimeMetrics,
  formatBytes
};
