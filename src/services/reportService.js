/**
 * Report generation service (TXT and CSV)
 */

const WIDTH = 80;

let fallbackAppVersion = 'No disponible';
try {
  const pkg = require('../../package.json');
  if (pkg && pkg.version) fallbackAppVersion = String(pkg.version);
} catch (error) {}

function safeStr(v) {
  if (v === null || v === undefined) return 'No disponible';
  const s = String(v).trim();
  return s === '' ? 'No disponible' : s;
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function oneLine(v) {
  return safeStr(v).replace(/\s+/g, ' ');
}

function truncateText(value, width) {
  const text = String(value);
  if (width <= 0) return '';
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return text.slice(0, width - 3) + '...';
}

function line(value = '') {
  return truncateText(String(value).replace(/[\r\n]+/g, ' '), WIDTH).padEnd(WIDTH, ' ');
}

function centerLine(value) {
  const text = truncateText(String(value), WIDTH);
  const left = Math.max(0, Math.floor((WIDTH - text.length) / 2));
  return line(' '.repeat(left) + text);
}

function wrapText(value, width) {
  const text = oneLine(value);
  if (!text) return [''];

  const output = [];
  let current = '';

  text.split(' ').forEach((word) => {
    if (!word) return;

    if (word.length > width) {
      if (current) {
        output.push(current);
        current = '';
      }
      let rest = word;
      while (rest.length > width) {
        output.push(rest.slice(0, width));
        rest = rest.slice(width);
      }
      current = rest;
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) output.push(current);
      current = word;
    }
  });

  if (current) output.push(current);
  return output.length ? output : [''];
}

function dividerLine(char = '-') {
  return line(char.repeat(WIDTH));
}

function sectionLines(number, title) {
  return [line(''), line(`${number}. ${String(title).toUpperCase()}`), dividerLine('-')];
}

function kvLines(label, value, labelWidth = 27) {
  const safeLabel = truncateText(oneLine(label), labelWidth).padEnd(labelWidth, ' ');
  const prefix = `  ${safeLabel}: `;
  const continuation = ' '.repeat(prefix.length);
  return wrapText(value, WIDTH - prefix.length).map((part, index) =>
    line((index === 0 ? prefix : continuation) + part)
  );
}

function bulletLines(value) {
  const prefix = '  - ';
  const continuation = '    ';
  return wrapText(value, WIDTH - prefix.length).map((part, index) =>
    line((index === 0 ? prefix : continuation) + part)
  );
}

function formatDateTime(value) {
  const date = value === undefined || value === null || value === '' ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  const pad = (number) => String(number).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  ].join(' ');
}

function formatLongDateTime(value) {
  const date = value === undefined || value === null || value === '' ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return date.toLocaleString('es-PA', { dateStyle: 'full', timeStyle: 'medium' });
}

function formatPercent(value) {
  const n = toNumber(value);
  return n === null ? 'No disponible' : `${Math.round(n)}%`;
}

function buildBar(value, width = 32) {
  const n = toNumber(value);
  const safeWidth = Math.max(1, Math.trunc(width));
  if (n === null) return '░'.repeat(safeWidth);
  const clamped = Math.min(100, Math.max(0, n));
  const filled = Math.round((clamped / 100) * safeWidth);
  return '█'.repeat(filled) + '░'.repeat(safeWidth - filled);
}

function resolveStatus(value) {
  const n = toNumber(value);
  if (n === null) return { flag: '[ -- ]', label: 'No disponible' };
  if (n >= 85) return { flag: '[ !! ]', label: 'Muy elevado' };
  if (n >= 70) return { flag: '[ !  ]', label: 'Elevado' };
  return { flag: '[ OK ]', label: 'Normal' };
}

function resolveAppVersion(data, options) {
  return safeStr(
    (options && options.appVersion) ||
    (data && data.appVersion) ||
    fallbackAppVersion
  );
}

function generateTxtReport(data = {}, options = {}) {
  const hardware = data.hardware || {};
  const metrics = data.metrics || {};
  const history = Array.isArray(data.history) ? data.history : [];
  const events = Array.isArray(data.events) ? data.events : [];
  const stats = data.monitoringStats || {};
  const modules = Array.isArray(hardware.modules) ? hardware.modules : [];
  const appVersion = resolveAppVersion(data, options);
  const now = formatLongDateTime(new Date());
  const generatedAt = formatDateTime(new Date());

  const historyValues = history
    .map((item) => toNumber(item && item.percent))
    .filter((value) => value !== null);
  const count = Math.max(0, Math.trunc(toNumber(stats.count) ?? history.length));
  const minValue = toNumber(stats.min) ?? (historyValues.length ? Math.min(...historyValues) : toNumber(metrics.percent));
  const maxValue = toNumber(stats.max) ?? (historyValues.length ? Math.max(...historyValues) : toNumber(metrics.percent));
  const avgRaw = toNumber(stats.avg) ?? (historyValues.length
    ? historyValues.reduce((sum, value) => sum + value, 0) / historyValues.length
    : toNumber(metrics.percent));
  const avgValue = avgRaw === null ? null : Math.round(avgRaw);
  const status = resolveStatus(metrics.percent);
  const currentPercent = formatPercent(metrics.percent);

  const lines = [];
  lines.push(dividerLine('='));
  lines.push(centerLine('RAMTRACE - INFORME TÉCNICO DE DIAGNÓSTICO Y MONITOREO'));
  lines.push(centerLine('MONITOREA · ANALIZA · PROTEGE'));
  lines.push(dividerLine('='));

  lines.push(...sectionLines(1, 'ENCABEZADO'));
  lines.push(...kvLines('Nombre del informe', 'Informe técnico RamTrace'));
  lines.push(...kvLines('Fecha de generación', now));
  lines.push(...kvLines('Equipo', hardware.computerName));
  lines.push(...kvLines('Sistema operativo', `${safeStr(hardware.osName)} (Versión: ${safeStr(hardware.osVersion)})`));
  lines.push(...kvLines('Versión aplicación', appVersion));

  lines.push(...sectionLines(2, 'RESUMEN EJECUTIVO'));
  lines.push(line(`  ESTADO GENERAL: ${status.flag}  ${status.label.toUpperCase()}`));
  lines.push(line(`  Utilización actual: ${currentPercent}`));
  lines.push(line(`  ${buildBar(metrics.percent, 50)}  ${currentPercent}`));
  lines.push(...kvLines('Memoria en uso', metrics.usedFormatted));
  lines.push(...kvLines('Memoria disponible', metrics.freeFormatted));
  lines.push(...kvLines('Prueba de memoria', data.testResult || 'Pendiente'));

  lines.push(...sectionLines(3, 'MÉTRICAS PRINCIPALES'));
  lines.push(...kvLines('RAM física instalada', hardware.totalInstalledFormatted));
  lines.push(...kvLines('RAM utilizable (Windows)', hardware.totalUsableFormatted));
  lines.push(...kvLines('RAM utilizada', metrics.usedFormatted));
  lines.push(...kvLines('RAM disponible', metrics.freeFormatted));
  lines.push(...kvLines('Porcentaje de utilización', currentPercent));
  lines.push(...kvLines('Muestras registradas', count));
  lines.push(...kvLines('Utilización mínima', formatPercent(minValue)));
  lines.push(...kvLines('Utilización máxima', formatPercent(maxValue)));
  lines.push(...kvLines('Utilización promedio', formatPercent(avgValue)));

  lines.push(...sectionLines(4, 'INFORMACIÓN DE HARDWARE (REAL)'));
  lines.push(...kvLines('Origen de datos', 'Windows API & CIM/WMI'));
  lines.push(...kvLines('Fuente hardware', hardware.hardwareSource));
  lines.push(...kvLines('Módulos detectados', modules.length));

  if (modules.length === 0) {
    lines.push(...bulletLines(`No se pudieron consultar módulos individuales. Origen: ${safeStr(hardware.hardwareSource)}`));
  } else {
    modules.forEach((module, index) => {
      const item = module || {};
      lines.push(line(''));
      lines.push(line(`  [MÓDULO ${index + 1}]`));
      lines.push(...kvLines('Ranura', item.slot || item.name));
      lines.push(...kvLines('Banco', item.bank));
      lines.push(...kvLines('Capacidad', item.capacityFormatted));
      lines.push(...kvLines('Fabricante', item.manufacturer));
      lines.push(...kvLines('Tipo', item.type));
      lines.push(...kvLines('Velocidad', item.speed));
      lines.push(...kvLines('N/P', item.partNumber));
      lines.push(...kvLines('Estado', item.status || 'Operativo'));
    });
  }

  lines.push(...sectionLines(5, 'HISTORIAL DE MEDICIONES'));
  lines.push(...kvLines('Muestras registradas', count));
  lines.push(...kvLines('Mínimo / Máximo / Promedio', `${formatPercent(minValue)} / ${formatPercent(maxValue)} / ${formatPercent(avgValue)}`));

  if (history.length === 0) {
    lines.push(...bulletLines('Sin historial de mediciones recopilado.'));
  } else {
    const recent = history.slice(-20);
    lines.push(line(''));
    lines.push(line(`  Mini gráfica de las últimas ${recent.length} muestras (0-100%):`));
    recent.forEach((item) => {
      const percent = toNumber(item && item.percent);
      const timestamp = item && item.timestamp ? item.timestamp : null;
      const percentText = percent === null ? ' -- ' : `${String(Math.round(percent)).padStart(3, ' ')}%`;
      lines.push(line(`  ${formatDateTime(timestamp)} [${buildBar(percent, 32)}] ${percentText}`));
    });
    if (history.length > recent.length) {
      lines.push(line(`  Se muestran ${recent.length} de ${history.length} muestras registradas.`));
    }
  }

  lines.push(...sectionLines(6, 'REGISTRO DE EVENTOS'));
  const eventColumns = [
    { label: 'Hora', width: 19 },
    { label: 'Nivel', width: 7 },
    { label: 'Categoría', width: 16 },
    { label: 'Mensaje', width: 27 }
  ];
  const eventSeparator = '  ' + eventColumns.map((column) => '-'.repeat(column.width)).join('-+-');

  lines.push(line('  ' + eventColumns.map((column) => column.label.padEnd(column.width, ' ')).join(' | ')));
  lines.push(line(eventSeparator));
  if (events.length === 0) {
    lines.push(...bulletLines('Sin eventos registrados.'));
  } else {
    events.slice(-50).forEach((event) => {
      const values = [
        formatDateTime(event && event.timestamp),
        event && event.level ? event.level : 'INFO',
        event && event.category ? event.category : 'General',
        event && event.message ? event.message : 'Sin mensaje'
      ];
      const wrapped = values.map((value, index) => wrapText(value, eventColumns[index].width));
      const height = Math.max(...wrapped.map((wrappedLines) => wrappedLines.length));
      for (let row = 0; row < height; row += 1) {
        const cells = wrapped.map((columnLines, index) =>
          truncateText(columnLines[row] || '', eventColumns[index].width).padEnd(eventColumns[index].width, ' ')
        );
        lines.push(line('  ' + cells.join(' | ')));
      }
    });
  }

  lines.push(...sectionLines(7, 'RECOMENDACIONES'));
  const percent = toNumber(metrics.percent);
  if (percent === null) {
    lines.push(...bulletLines('No hay medición de utilización disponible en este momento.'));
  } else if (percent >= 85) {
    lines.push(...bulletLines('Utilización muy elevada. Revisar procesos activos y considerar liberar memoria.'));
  } else if (percent >= 70) {
    lines.push(...bulletLines('Utilización elevada. Vigilar aplicaciones que consumen más recursos.'));
  } else {
    lines.push(...bulletLines('Utilización dentro del rango esperado para monitoreo.'));
  }
  lines.push(...bulletLines('Recuerde: el uso de memoria no confirma fallos físicos. Para diagnósticos físicos use el Diagnóstico de memoria de Windows (mdsched.exe).'));

  lines.push(...sectionLines(8, 'PIE DE PÁGINA'));
  lines.push(...kvLines('Fecha de generación', generatedAt));
  lines.push(...kvLines('Generado por', `RamTrace v${appVersion}`));
  lines.push(...bulletLines('Nota: Los datos son mediciones reales. El porcentaje de utilización no es, por sí solo, diagnóstico de daño físico de la RAM.'));
  lines.push(line(''));
  lines.push(dividerLine('='));

  return lines.join('\r\n') + '\r\n';
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
