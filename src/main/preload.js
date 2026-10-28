const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ramtraceApi', {
  getHardwareInfo: (forceRefresh = false) => ipcRenderer.invoke('get-hardware-info', forceRefresh),
  getRealtimeMetrics: (unit = 'GB') => ipcRenderer.invoke('get-realtime-metrics', unit),
  saveReport: (options) => ipcRenderer.invoke('save-report', options),
  launchWindowsMemoryDiagnostic: () => ipcRenderer.invoke('launch-mdsched'),
  onMemoryTick: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('memory-tick', handler);
    return () => ipcRenderer.removeListener('memory-tick', handler);
  },
  setMonitoringInterval: (intervalMs) => ipcRenderer.invoke('set-monitoring-interval', intervalMs),
  setMonitoringActive: (active) => ipcRenderer.invoke('set-monitoring-active', active),
  getEvents: (limit = 200) => ipcRenderer.invoke('get-events', limit),
  logEvent: (event) => ipcRenderer.invoke('log-event', event),
  clearEvents: () => ipcRenderer.invoke('clear-events')
});
