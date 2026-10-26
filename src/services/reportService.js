/**
 * Report generation service (TXT and CSV)
 */

function safeStr(v) {
  if (v === null || v === undefined) return 'No disponible';
  const s = String(v).trim();
  return s === '' ? 'No disponible' : s;
}

function formatNumPct(v) {
  if (v === undefined || v === null || isNaN(v)) return 'No disponible';
  return v + '%';
}

function generateTxtReport(data) {
  const now = new Date().toLocaleString('es-PA', { dateStyle: 'full', timeStyle: 'medium' });
  const genTime = new Date().toLocaleString('es-PA');
  const hardware = data.hardware || {};
  const metrics = data.metrics || {};
  const history = Array.isArray(data.history) ? data.history : [];
  const events = Array.isArray(data.events) ? data.events : [];
  const stats = data.monitoringStats || { count: history.length || 0, min: metrics.percent, max: metrics.percent, avg: metrics.percent };
  const modules = Array.isArray(hardware.modules) ? hardware.modules : [];

  const count = Number(stats.count) || history.length || 0;
  const minPctVal = stats.min !== undefined && stats.min !== null && !isNaN(stats.min) ? stats.min : null;
  const maxPctVal = stats.max !== undefined && stats.max !== null && !isNaN(stats.max) ? stats.max : null;
  const avgPctVal = stats.avg !== undefined && stats.avg !== null && !isNaN(stats.avg) ? Math.round(stats.avg) : null;

  let utilStatus = 'No disponible';
  if (metrics.percent !== undefined && metrics.percent !== null && !isNaN(metrics.percent)) {
    if (metrics.percent >= 85) utilStatus = 'Muy elevado';
    else if (metrics.percent >= 70) utilStatus = 'Elevado';
    else utilStatus = 'Normal';
  }

  let modulesText = '';
  if (modules.length === 0) {
    modulesText = '  - No se pudieron consultar módulos individuales. Origen: ' + safeStr(hardware.hardwareSource) + '\n';
  } else {
    modules.forEach((m, i) => {
      const slot = safeStr(m.slot || m.name);
      const cap = safeStr(m.capacityFormatted);
      const man = safeStr(m.manufacturer);
      const type = safeStr(m.type);
      const speed = safeStr(m.speed);
      const part = safeStr(m.partNumber);
      modulesText += `  [Módulo ${i + 1}] ${slot} | Capacidad: ${cap} | Fabricante: ${man} | Tipo: ${type} | Velocidad: ${speed} | N/P: ${part}\n`;
    });
  }

  let historyText = '';
  if (history.length === 0) {
    historyText = '  - Sin historial de mediciones recopilado.\n';
  } else {
    history.slice(-60).forEach((h, i) => {
      const t = h.timestamp ? new Date(h.timestamp).toLocaleString('es-PA') : 'No disponible';
      const p = h.percent !== undefined && h.percent !== null && !isNaN(h.percent) ? h.percent + '%' : 'No disponible';
      historyText += `  [${i + 1}] ${t} | Utilización: ${p}\n`;
    });
  }

  let eventsText = '';
  if (events.length === 0) {
    eventsText = '  - Sin eventos registrados.\n';
  } else {
    events.slice(-50).forEach((e, i) => {
      const t = e.timestamp ? new Date(e.timestamp).toLocaleString('es-PA') : 'No disponible';
      eventsText += `  [${i + 1}] ${t} | ${safeStr(e.level)} | ${safeStr(e.category)} | ${safeStr(e.message)} | ${safeStr(e.result)}\n`;
    });
  }

  let recs = [];
  if (metrics.percent !== undefined && metrics.percent !== null && !isNaN(metrics.percent)) {
    if (metrics.percent >= 85) recs.push('- Utilización muy elevada. Revisar procesos activos y considerar liberar memoria.');
    else if (metrics.percent >= 70) recs.push('- Utilización elevada. Vigilar aplicaciones que consumen más recursos.');
    else recs.push('- Utilización dentro del rango esperado para monitoreo.');
  } else {
    recs.push('- No hay medición de utilización disponible en este momento.');
  }
  recs.push('- Recuerde: el uso de memoria no confirma fallos físicos. Para diagnósticos físicos use el Diagnóstico de memoria de Windows (mdsched.exe).');

  return `================================================================================
RAMTRACE - INFORME TÉCNICO DE DIAGNÓSTICO Y MONITOREO
MONITOREA · ANALIZA · PROTEGE
================================================================================

1. ENCABEZADO
--------------------------------------------------------------------------------
Nombre del informe : Informe técnico RamTrace
Fecha de generación: ${now}
Equipo              : ${safeStr(hardware.computerName)}
Sistema operativo   : ${safeStr(hardware.osName)} (Versión: ${safeStr(hardware.osVersion)})
Versión aplicación  : 1.0.0

2. RESUMEN EJECUTIVO
--------------------------------------------------------------------------------
Estado de utilización : ${utilStatus}
Porcentaje actual      : ${formatNumPct(metrics.percent)}
Memoria en uso         : ${safeStr(metrics.usedFormatted)}
Memoria disponible     : ${safeStr(metrics.freeFormatted)}

3. MÉTRICAS PRINCIPALES
--------------------------------------------------------------------------------
RAM física instalada   : ${safeStr(hardware.totalInstalledFormatted)}
RAM utilizable (Win)   : ${safeStr(hardware.totalUsableFormatted)}
RAM utilizada          : ${safeStr(metrics.usedFormatted)}
RAM disponible         : ${safeStr(metrics.freeFormatted)}
Porcentaje de utilización: ${formatNumPct(metrics.percent)}
Muestras registradas   : ${count}
Mínimo / Máximo / Promedio: ${minPctVal === null ? 'No disponible' : minPctVal + '%'} / ${maxPctVal === null ? 'No disponible' : maxPctVal + '%'} / ${avgPctVal === null ? 'No disponible' : avgPctVal + '%'}

4. INFORMACIÓN DE HARDWARE (REAL)
--------------------------------------------------------------------------------
Origen de datos        : Windows API & CIM/WMI
Fuente hardware        : ${safeStr(hardware.hardwareSource)}
Módulos detectados     : ${modules.length}
${modulesText}
5. HISTORIAL DE MEDICIONES
--------------------------------------------------------------------------------
${historyText}
6. REGISTRO DE EVENTOS
--------------------------------------------------------------------------------
${eventsText}
7. RECOMENDACIONES
--------------------------------------------------------------------------------
${recs.join('\n')}

8. PIE DE PÁGINA
--------------------------------------------------------------------------------
Fecha de generación: ${genTime}
Generado por: RamTrace v1.0.0
Nota: Los datos son mediciones reales. El porcentaje de utilización no es, por sí solo, diagnóstico de daño físico de la RAM.

================================================================================
`;
}

function generateCsvReport(data) {
  const now = new Date().toLocaleString('es-PA');
  const hardware = data.hardware || {};
  const metrics = data.metrics || {};
  const history = Array.isArray(data.history) ? data.history : [];
  const modules = Array.isArray(hardware.modules) ? hardware.modules : [];

  const fmtPct = (v) => (v === undefined || v === null || isNaN(v) ? 'No disponible' : v);
  const fmtVal = (v) => (v === undefined || v === null || v === '' ? 'No disponible' : v);
  const fmtNum = (v) => (v === undefined || v === null || isNaN(v) ? 'No disponible' : v);

  const rows = [
    ['Fecha y hora', 'Aplicación', 'Equipo', 'Sistema operativo', 'Versión de SO', 'Fuente hardware', 'RAM instalada (GB)', 'RAM utilizable (GB)', 'RAM usada (GB)', 'RAM disponible (GB)', 'Utilización (%)', 'Estado de utilización', 'Módulos detectados (cantidad)', 'Estado prueba de memoria', 'Observaciones']
  ];

  rows.push([
    now,
    'RamTrace',
    fmtVal(hardware.computerName),
    fmtVal(hardware.osName),
    fmtVal(hardware.osVersion),
    fmtVal(hardware.hardwareSource),
    fmtVal(hardware.totalInstalledFormatted),
    fmtVal(hardware.totalUsableFormatted),
    fmtVal(metrics.usedFormatted),
    fmtVal(metrics.freeFormatted),
    fmtPct(metrics.percent),
    fmtVal(metrics.statusText),
    modules.length,
    fmtVal(data.testResult || 'Pendiente'),
    fmtVal(data.observations)
  ]);

  if (history.length > 0) {
    rows.push(['---HISTORIAL DE MEDICIONES---']);
    rows.push(['Fecha y hora', 'Utilización (%)', 'RAM instalada (GB)', 'RAM utilizable (GB)', 'RAM usada (GB)', 'RAM disponible (GB)']);
    history.slice(-120).forEach(h => {
      const t = h.timestamp ? new Date(h.timestamp).toLocaleString('es-PA') : now;
      rows.push([t, fmtNum(h.percent), fmtVal(hardware.totalInstalledFormatted), fmtVal(hardware.totalUsableFormatted), fmtVal(h.usedFormatted), fmtVal(h.freeFormatted)]);
    });
  }

  return rows
    .map(r => r.map(cell => {
      const s = String(cell === null || cell === undefined ? 'No disponible' : cell);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(','))
    .join('\r\n');
}

function generateEventsCsv(data) {
  const events = Array.isArray(data.events) ? data.events : [];
  const rows = [
    ['Fecha y hora', 'Nivel', 'Categoría', 'Mensaje', 'Resultado']
  ];
  if (events.length === 0) {
    rows.push(['No disponible', 'INFO', 'Sistema', 'Sin eventos registrados', 'Sin datos']);
  } else {
    events.slice(-200).forEach(e => {
      const t = e.timestamp ? new Date(e.timestamp).toLocaleString('es-PA') : 'No disponible';
      rows.push([t, e.level || 'INFO', e.category || 'General', e.message || '', e.result || '']);
    });
  }
  return rows
    .map(r => r.map(cell => {
      const s = String(cell === null || cell === undefined ? '' : cell);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(','))
    .join('\r\n');
}

module.exports = {
  generateTxtReport,
  generateCsvReport,
  generateEventsCsv
};
