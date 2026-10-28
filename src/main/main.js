const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const memoryService = require('../services/memoryService');
const reportService = require('../services/reportService');

let mainWindow = null;
let monitoringTimer = null;
let currentIntervalMs = 2000;
let isMonitoring = true;
let currentUnit = 'GB';

const eventsLog = [];
const MAX_EVENTS = 500;

function logAppEvent(level, category, message, result = 'OK') {
  try {
    const ev = {
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
      level: level || 'INFO',
      category: category || 'Sistema',
      message: message || '',
      result: result || 'OK'
    };
    eventsLog.unshift(ev);
    if (eventsLog.length > MAX_EVENTS) {
      eventsLog.length = MAX_EVENTS;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('events-updated', eventsLog.slice(0, 200));
    }
  } catch (e) {
    // ignore
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '../assets/logo.ico');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 650,
    title: 'RamTrace — Diagnóstico y monitoreo de memoria RAM',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#080d1c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    logAppEvent('INFO', 'Sistema', 'Aplicación iniciada', 'OK');
    startMonitoringLoop();
    logAppEvent('INFO', 'Monitoreo', 'Monitoreo iniciado', 'OK');
  });

  mainWindow.on('closed', () => {
    stopMonitoringLoop();
    mainWindow = null;
  });
}

function startMonitoringLoop() {
  stopMonitoringLoop();
  if (!isMonitoring) return;

  function tick() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const metrics = memoryService.getRealtimeMetrics(currentUnit);
    mainWindow.webContents.send('memory-tick', metrics);
  }

  // initial tick
  tick();
  monitoringTimer = setInterval(tick, currentIntervalMs);
}

function stopMonitoringLoop() {
  if (monitoringTimer) {
    clearInterval(monitoringTimer);
    monitoringTimer = null;
  }
}

// IPC Handlers

ipcMain.handle('get-hardware-info', async (event, forceRefresh) => {
  try {
    const force = Boolean(forceRefresh);
    const hw = await memoryService.getHardwareInfo(force);
    if (!hw) {
      logAppEvent('WARN', 'Hardware', 'No se pudo obtener información de hardware', 'Fallo');
      return { success: false, error: 'No se pudo obtener información de hardware' };
    }
    logAppEvent('INFO', 'Hardware', force ? 'Consulta de hardware forzada' : 'Consulta de hardware', 'OK');
    return {
      success: true,
      data: {
        ...hw,
        totalInstalledFormatted: memoryService.formatBytes(hw.totalInstalledBytes, currentUnit),
        totalUsableFormatted: memoryService.formatBytes(hw.totalUsableBytes, currentUnit),
        totalVirtualFormatted: hw.totalVirtualBytes ? memoryService.formatBytes(hw.totalVirtualBytes, currentUnit) : 'No disponible',
        freeVirtualFormatted: hw.freeVirtualBytes ? memoryService.formatBytes(hw.freeVirtualBytes, currentUnit) : 'No disponible'
      }
    };
  } catch (err) {
    logAppEvent('ERROR', 'Hardware', 'Error al obtener información de hardware', 'Error');
    return { success: false, error: err && err.message ? err.message : 'Error desconocido' };
  }
});

ipcMain.handle('get-realtime-metrics', async (event, unit) => {
  if (typeof unit === 'string' && (unit === 'GB' || unit === 'MB')) {
    currentUnit = unit;
  }
  try {
    return memoryService.getRealtimeMetrics(currentUnit);
  } catch (err) {
    // Fallback minimal
    const totalUsable = require('os').totalmem();
    const freeBytes = require('os').freemem();
    const usedBytes = Math.max(0, totalUsable - freeBytes);
    const percent = Math.min(100, Math.max(0, Math.round((usedBytes / totalUsable) * 100)));
    return {
      timestamp: Date.now(),
      percent,
      usedBytes,
      freeBytes,
      totalUsableBytes: totalUsable,
      usedFormatted: memoryService.formatBytes(usedBytes, currentUnit),
      freeFormatted: memoryService.formatBytes(freeBytes, currentUnit),
      totalUsableFormatted: memoryService.formatBytes(totalUsable, currentUnit),
      level: percent >= 85 ? 'critical' : (percent >= 70 ? 'warning' : 'normal'),
      statusText: percent >= 85 ? 'Muy elevado' : (percent >= 70 ? 'Elevado' : 'Normal'),
      statusClass: percent >= 85 ? 'danger' : (percent >= 70 ? 'warning' : 'positive'),
      recommendTitle: percent >= 85 ? 'Utilización muy elevada' : (percent >= 70 ? 'Utilización elevada' : 'Utilización dentro del rango definido'),
      recommendText: percent >= 85 ? 'Revisa la carga del equipo y considera cerrar aplicaciones que no necesites.' : (percent >= 70 ? 'Revisa las aplicaciones abiertas y el consumo de memoria.' : 'El consumo actual está por debajo del umbral de alerta de esta práctica.')
    };
  }
});

ipcMain.handle('set-monitoring-interval', async (event, intervalMs) => {
  let ms = Number(intervalMs);
  if (isNaN(ms)) ms = 2000;
  ms = Math.max(500, Math.min(5000, ms));
  currentIntervalMs = ms;
  if (isMonitoring) {
    startMonitoringLoop();
  }
  logAppEvent('INFO', 'Monitoreo', `Intervalo actualizado a ${ms} ms`, 'OK');
  return { success: true, intervalMs: currentIntervalMs };
});

ipcMain.handle('set-monitoring-active', async (event, active) => {
  isMonitoring = Boolean(active);
  if (isMonitoring) {
    startMonitoringLoop();
    logAppEvent('INFO', 'Monitoreo', 'Monitoreo iniciado', 'OK');
  } else {
    stopMonitoringLoop();
    logAppEvent('WARN', 'Monitoreo', 'Monitoreo pausado', 'OK');
  }
  return { success: true, active: isMonitoring };
});

ipcMain.handle('save-report', async (event, payload) => {
  if (!mainWindow) return { success: false, error: 'Ventana no disponible' };
  if (!payload || typeof payload !== 'object') {
    logAppEvent('WARN', 'Reportes', 'Intento de exportación con datos inválidos', 'Fallo');
    return { success: false, error: 'Datos de reporte inválidos' };
  }

  try {
    const format = payload.format === 'csv' ? 'csv' : 'txt';
    const reportData = payload.reportData || {};
    const isCsv = format === 'csv';
    const ext = isCsv ? 'csv' : 'txt';
    const defaultName = `Reporte_RamTrace_${Date.now()}.${ext}`;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: `Guardar reporte ${ext.toUpperCase()}`,
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [
        { name: isCsv ? 'Archivo CSV (*.csv)' : 'Archivo de texto (*.txt)', extensions: [ext] },
        { name: 'Todos los archivos (*.*)', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      logAppEvent('INFO', 'Reportes', `Exportación ${ext.toUpperCase()} cancelada`, 'Cancelado');
      return { success: false, canceled: true };
    }

    let content;
    if (payload.exportType === 'events') {
      content = reportService.generateEventsCsv ? reportService.generateEventsCsv(reportData) : reportService.generateCsvReport(reportData);
    } else {
      content = isCsv
        ? reportService.generateCsvReport(reportData)
        : reportService.generateTxtReport(reportData, { appVersion: app.getVersion() });
    }

    // Write UTF-8 with BOM for Excel compatibility on Windows CSV
    const bom = (isCsv || payload.exportType === 'events') ? '\ufeff' : '';
    fs.writeFileSync(filePath, bom + content, 'utf8');

    logAppEvent('INFO', 'Reportes', `Exportación ${ext.toUpperCase()} exitosa`, 'OK');
    return { success: true, filePath };
  } catch (err) {
    logAppEvent('ERROR', 'Reportes', 'Error al guardar reporte', 'Error');
    return { success: false, error: err && err.message ? err.message : 'Error al guardar reporte' };
  }
});

ipcMain.handle('launch-mdsched', async () => {
  if (!mainWindow) return { success: false, error: 'Ventana no disponible' };

  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Continuar y abrir herramienta', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    title: 'Diagnóstico de memoria de Windows (mdsched.exe)',
    message: '¿Deseas iniciar la herramienta oficial de Diagnóstico de memoria de Windows?',
    detail: 'Esta herramienta comprobará posibles fallos físicos en los módulos de RAM.\n\nRequiere permisos de administrador y te permitirá elegir cuándo reiniciar el equipo.\n\nRamTrace NO reiniciará tu equipo automáticamente.'
  });

  if (choice.response === 0) {
    logAppEvent('INFO', 'Diagnóstico', 'Lanzamiento de mdsched.exe solicitado', 'OK');
    return new Promise((resolve) => {
      try {
        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Start-Process -FilePath "mdsched.exe" -Verb RunAs'], (err) => {
          if (err) {
            logAppEvent('ERROR', 'Diagnóstico', 'Fallo al iniciar mdsched.exe', 'Error');
            resolve({ success: false, error: 'No se pudo iniciar mdsched.exe o se rechazaron los permisos de administrador.' });
          } else {
            logAppEvent('INFO', 'Diagnóstico', 'mdsched.exe iniciado', 'OK');
            resolve({ success: true });
          }
        });
      } catch (e) {
        logAppEvent('ERROR', 'Diagnóstico', 'Error al lanzar diagnóstico', 'Error');
        resolve({ success: false, error: 'Error al intentar lanzar la herramienta de diagnóstico.' });
      }
    });
  }

  logAppEvent('INFO', 'Diagnóstico', 'Lanzamiento de mdsched.exe cancelado', 'Cancelado');
  return { success: false, canceled: true };
});

ipcMain.handle('get-events', async (event, limit) => {
  try {
    const l = Number(limit) || 200;
    return eventsLog.slice(0, l);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('log-event', async (event, ev) => {
  try {
    if (!ev) return { success: false };
    logAppEvent(ev.level, ev.category, ev.message, ev.result);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
});

ipcMain.handle('clear-events', async () => {
  try {
    eventsLog.length = 0;
    logAppEvent('INFO', 'Sistema', 'Registro de eventos limpiado', 'OK');
    return { success: true };
  } catch (e) {
    return { success: false };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
