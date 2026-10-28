// RamTrace Desktop Renderer Application Logic

(function () {
  'use strict';

  // --- Configuration and State ---
  const state = {
    running: true,
    intervalMs: 2000,
    unit: 'GB',
    videoEnabled: true,
    testResult: 'Pendiente',
    observations: '',
    hardware: null,
    metrics: null,
    values: [], // Array of recent utilization % (up to 60 samples)
    theme: 'dark', // 'dark' | 'light' | 'system'
    accent: '#7548ff',
    accent2: '#a15cff'
  };

  // Restore preferences from localStorage
  try {
    const savedInterval = localStorage.getItem('ramtrace_interval');
    if (savedInterval) state.intervalMs = Number(savedInterval);

    const savedUnit = localStorage.getItem('ramtrace_unit');
    if (savedUnit) state.unit = savedUnit;

    const savedVideo = localStorage.getItem('ramtrace_video');
    if (savedVideo !== null) state.videoEnabled = (savedVideo === 'true');

    const savedObs = localStorage.getItem('ramtrace_observations');
    if (savedObs) state.observations = savedObs;

    const savedTest = localStorage.getItem('ramtrace_test_result');
    if (savedTest) state.testResult = savedTest;

    const savedTheme = localStorage.getItem('ramtrace_theme');
    if (savedTheme) state.theme = savedTheme;

    const savedAccent = localStorage.getItem('ramtrace_accent');
    if (savedAccent) state.accent = savedAccent;

    const savedAccent2 = localStorage.getItem('ramtrace_accent2');
    if (savedAccent2) state.accent2 = savedAccent2;
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }

  // --- Page Definitions ---
  const pageNames = {
    inicio: ['Estado de memoria', 'Una visión clara del rendimiento de la RAM de tu equipo.'],
    memoria: ['Memoria RAM', 'Consulta la capacidad y el consumo de memoria del sistema.'],
    modulos: ['Módulos de memoria', 'Información de los módulos de hardware detectados en el equipo.'],
    monitoreo: ['Monitoreo', 'Observa cómo cambia la utilización a lo largo del tiempo con métricas reales.'],
    diagnostico: ['Diagnóstico', 'Recomendaciones e instrucciones para una prueba de memoria física.'],
    reportes: ['Reportes', 'Genera y exporta un archivo con el resumen de las mediciones reales.'],
    configuracion: ['Configuración', 'Preferencias operativas y visuales de la aplicación.'],
    acerca: ['Acerca de RamTrace', 'Información general, propósito y características de la aplicación.']
  };

  // --- Theme and Accent Initialization ---
  function applyTheme() {
    const root = document.documentElement;
    if (state.theme === 'system') {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      root.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
    } else {
      root.setAttribute('data-theme', state.theme === 'light' ? 'light' : 'dark');
    }
  }

  function applyAccent() {
    const root = document.documentElement;
    if (state.accent) root.style.setProperty('--accent', state.accent);
    if (state.accent2) root.style.setProperty('--accent-2', state.accent2);
    // Update glow based on accent
    root.style.setProperty('--accent-glow', state.accent ? state.accent.replace('rgb', 'rgba').replace(')', ',0.33)') : 'rgba(117,72,255,0.33)');
  }

  // --- Background Video Initialization ---
  const bgVideo = document.getElementById('bg-video');
  function initVideo() {
    if (!bgVideo) return;
    if (state.videoEnabled) {
      bgVideo.classList.remove('hidden');
      bgVideo.play().catch(() => {
        // Fallback gracefully if system policies block autoplay
      });
    } else {
      bgVideo.pause();
      bgVideo.classList.add('hidden');
    }
  }

  // --- Navigation Handling ---
  function showPage(id) {
    if (!pageNames[id]) return;

    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === id);
    });

    document.querySelectorAll('.nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.page === id);
    });

    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = pageNames[id][0];
    if (subtitleEl) subtitleEl.textContent = pageNames[id][1];

    // Trigger canvas redraw whenever the active page changes
    requestAnimationFrame(() => {
      drawCharts();
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Expose showPage globally for testing / buttons
  window.showPage = showPage;

  document.querySelectorAll('.nav button').forEach(b => {
    b.addEventListener('click', () => showPage(b.dataset.page));
  });

  document.querySelectorAll('[data-goto]').forEach(b => {
    b.addEventListener('click', () => showPage(b.dataset.goto));
  });

  // --- Chart Drawing Engine (Canvas) ---
  function drawChart(canvasId) {
    const c = document.getElementById(canvasId);
    if (!c || !c.offsetParent) return;

    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;

    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { l: 46, r: 16, t: 16, b: 36 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;

    ctx.clearRect(0, 0, w, h);

    const emptyEl = document.getElementById('chart-empty-state');
    const errEl = document.getElementById('chart-error-state');
    if (errEl) errEl.style.display = 'none';
    if (emptyEl) {
      if (!state.values || state.values.length === 0) {
        emptyEl.style.display = 'grid';
      } else {
        emptyEl.style.display = 'none';
      }
    }

    if (!state.values || state.values.length === 0) {
      // Draw axes only
      ctx.font = '11px Segoe UI, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      for (let n = 0; n <= 100; n += 20) {
        const y = pad.t + ch * (1 - n / 100);
        ctx.strokeStyle = '#24314c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(w - pad.r, y);
        ctx.stroke();
        ctx.fillStyle = '#9ba9ca';
        ctx.fillText(n + '%', pad.l - 8, y + 4);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8c9aba';
      ctx.fillText('Hora', pad.l + cw / 2, h - 10);
      return;
    }

    // Horizontal grid lines (0% to 100%)
    ctx.font = '11px Segoe UI, -apple-system, sans-serif';
    ctx.textAlign = 'right';

    for (let n = 0; n <= 100; n += 20) {
      const y = pad.t + ch * (1 - n / 100);
      ctx.strokeStyle = '#24314c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();

      ctx.fillStyle = '#9ba9ca';
      ctx.fillText(n + '%', pad.l - 8, y + 4);
    }

    // Vertical time lines
    const timeLabels = ['Hace 60s', '50s', '40s', '30s', '20s', '10s', 'Ahora'];
    for (let i = 0; i < 7; i++) {
      const x = pad.l + cw * (i / 6);
      ctx.strokeStyle = '#1b2943';
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + ch);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#8c9aba';
      ctx.fillText(timeLabels[i], x, h - 10);
    }

    const dataPoints = state.values.slice(-60);
    const len = Math.max(2, dataPoints.length);

    const pts = dataPoints.map((v, i) => ({
      x: pad.l + cw * (i / (len - 1)),
      y: pad.t + ch * (1 - Math.min(100, Math.max(0, Number(v))) / 100)
    }));

    // Area fill gradient
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineTo(pts[pts.length - 1].x, pad.t + ch);
    ctx.lineTo(pts[0].x, pad.t + ch);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
    grad.addColorStop(0, 'rgba(161, 92, 255, 0.46)');
    grad.addColorStop(1, 'rgba(91, 69, 255, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = '#b66bff';
    ctx.lineWidth = 2.8;
    ctx.shadowColor = '#9c5cff';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Points
    pts.forEach((p, i) => {
      if (i % Math.max(1, Math.floor(len / 12)) === 0 || i === len - 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === len - 1 ? 4.2 : 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#9e63ff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  function drawCharts() {
    drawChart('chart');
    drawChart('chart2');
  }

  window.addEventListener('resize', () => {
    drawCharts();
  });

  // --- Real-time Memory Data Binding ---
  function updateGauge(percent, context) {
    const hasValue = !(percent === undefined || percent === null || isNaN(percent));
    const p = hasValue ? Math.min(100, Math.max(0, percent)) : null;
    const pRounded = p === null ? null : Math.round(p);
    
    // Panel principal
    const needleHome = document.getElementById('home-gauge-needle');
    const arcHome = document.getElementById('home-gauge-arc');
    const pctElHome = document.getElementById('home-gauge-percent');
    const levelPillHome = document.getElementById('home-gauge-level-pill');
    
    // Memoria RAM
    const needleMem = document.getElementById('gauge-needle');
    const arcMem = document.getElementById('gauge-arc');
    const pctElMem = document.getElementById('gauge-percent');
    const levelPillMem = document.getElementById('gauge-level-pill');
    
    function apply(elNeedle, elArc, elPct, elPill) {
      if (!elPct) return;
      if (!hasValue) {
        elPct.textContent = 'Sin datos';
        if (elNeedle) elNeedle.style.transform = 'rotate(-90deg)';
        if (elArc) elArc.style.strokeDasharray = '0 ' + (2 * Math.PI * 80);
        if (elPill) {
          elPill.textContent = 'Sin datos';
          elPill.style.background = '#332916';
          elPill.style.color = '#ffd05b';
        }
        return;
      }
      elPct.textContent = pRounded + '%';
      if (elNeedle) {
        const angle = -90 + (p * 1.8);
        elNeedle.style.transform = `rotate(${angle}deg)`;
        elNeedle.style.transformOrigin = '100px 100px';
      }
      if (elArc) {
        const len = 2 * Math.PI * 80 * (p / 100);
        elArc.style.strokeDasharray = len + ' ' + (2 * Math.PI * 80);
      }
      if (elPill) {
        if (p >= 85) {
          elPill.textContent = '! Muy elevado';
          elPill.style.background = '#762d49';
          elPill.style.color = '#ffb4c7';
        } else if (p >= 70) {
          elPill.textContent = '⚠ Elevado';
          elPill.style.background = '#72511b';
          elPill.style.color = '#ffe08a';
        } else {
          elPill.textContent = '✓ Normal';
          elPill.style.background = '#0d654f';
          elPill.style.color = '#71f5ca';
        }
      }
    }
    
    apply(needleHome, arcHome, pctElHome, levelPillHome);
    apply(needleMem, arcMem, pctElMem, levelPillMem);
  }

  function updateRealtimeUI(metrics) {
    if (!metrics) return;
    const errEl = document.getElementById('chart-error-state');
    if (errEl) errEl.style.display = 'none';
    state.metrics = metrics;

    const currentRaw = metrics.percent;
    const hasValue = !(currentRaw === undefined || currentRaw === null || isNaN(currentRaw));
    const current = hasValue ? Math.min(100, Math.max(0, Math.round(currentRaw))) : NaN;

    if (hasValue) {
      state.values.push(current);
      if (state.values.length > 60) {
        state.values.shift();
      }
    }

    // 1. Home View Elements
    setElText('usage-percent', hasValue ? current + '%' : '--%');
    setElText('last-value', hasValue ? 'Último valor: ' + current + '%' : 'Último valor: --%');
    setElWidth('usage-bar', hasValue ? current + '%' : '0%');
    setElText('used-main', metrics.usedFormatted);
    setElText('free-main', metrics.freeFormatted);
    setElText('telemetry-used', metrics.usedFormatted);
    setElText('telemetry-free', metrics.freeFormatted);

    // Status pill
    const statusPill = document.getElementById('status-pill');
    if (statusPill) {
      if (!hasValue) {
        statusPill.textContent = 'Sin datos';
        statusPill.style.background = '#332916';
        statusPill.style.color = '#ffd05b';
      } else {
        let icon = '✓ ';
        let bg = '#0d654f';
        let color = '#71f5ca';

        if (metrics.level === 'critical' || current >= 85) {
          icon = '! ';
          bg = '#762d49';
          color = '#ffb4c7';
        } else if (metrics.level === 'warning' || (current >= 70 && current < 85)) {
          icon = '⚠ ';
          bg = '#72511b';
          color = '#ffe08a';
        }

        const statusText = metrics.statusText || (current >= 85 ? 'Muy elevado' : (current >= 70 ? 'Elevado' : 'Normal'));
        statusPill.textContent = icon + statusText;
        statusPill.style.background = bg;
        statusPill.style.color = color;
      }
    }

    // Recommendation card
    if (hasValue) {
      const recTitle = metrics.recommendTitle || (current >= 85 ? 'Utilización muy elevada' : (current >= 70 ? 'Utilización elevada' : 'Utilización dentro del rango definido'));
      const recText = metrics.recommendText || (current >= 85 ? 'Revisa la carga del equipo y considera cerrar aplicaciones que no necesites.' : (current >= 70 ? 'Revisa las aplicaciones abiertas y el consumo de memoria.' : 'El consumo actual está por debajo del umbral de alerta de esta práctica.'));
      setElText('recommend-title', recTitle);
      setElText('recommend-text', recText);
    } else {
      setElText('recommend-title', 'Sin datos de medición');
      setElText('recommend-text', 'No se ha podido obtener lectura de memoria en este momento.');
    }

    // 2. Memoria View Elements
    setElText('used-memory', metrics.usedFormatted);
    setElText('free-memory', metrics.freeFormatted);
    setElText('memory-pct', hasValue ? current + '%' : '--%');
    setElWidth('memory-bar', hasValue ? current + '%' : '0%');
    setElText('gauge-used', metrics.usedFormatted);
    setElText('gauge-free', metrics.freeFormatted);
    setElText('home-gauge-used', metrics.usedFormatted);
    setElText('home-gauge-free', metrics.freeFormatted);
    if (state.hardware) {
      setElText('gauge-installed', state.hardware.totalInstalledFormatted || state.hardware.totalUsableFormatted || '--');
      setElText('home-gauge-installed', state.hardware.totalInstalledFormatted || state.hardware.totalUsableFormatted || '--');
    }
    updateGauge(hasValue ? current : null);

    // 3. Monitoreo View Elements
    setElText('monitor-percent', hasValue ? current + '%' : '--%');
    setElText('monitor-percent-dup', hasValue ? current + '%' : '--%');
    setElText('monitor-legend-current', hasValue ? current + '%' : '--%');
    setElWidth('monitor-bar', hasValue ? current + '%' : '0%');
    const monStatus = document.getElementById('monitor-status');
    if (monStatus) {
      if (!hasValue) {
        monStatus.textContent = 'Sin datos';
        monStatus.style.background = '#332916';
        monStatus.style.color = '#ffd05b';
      } else if (statusPill) {
        monStatus.textContent = statusPill.textContent;
        monStatus.style.background = statusPill.style.background;
        monStatus.style.color = statusPill.style.color;
      } else {
        if (current >= 85) { monStatus.textContent = '! Muy elevado'; monStatus.style.background = '#762d49'; monStatus.style.color = '#ffb4c7'; }
        else if (current >= 70) { monStatus.textContent = '⚠ Elevado'; monStatus.style.background = '#72511b'; monStatus.style.color = '#ffe08a'; }
        else { monStatus.textContent = '✓ Normal'; monStatus.style.background = '#0d654f'; monStatus.style.color = '#71f5ca'; }
      }
    }

    // Statistics computation
    computeMonitoringStats();

    // 4. Reportes View Summary
    setElText('report-percent', hasValue ? current + '%' : '--%');
    setElText('report-used-ram', metrics.usedFormatted || '--');
    setElText('report-free-ram', metrics.freeFormatted || '--');
    setElText('report-last-time', new Date().toLocaleString('es-PA'));

    // Redraw graphs with new data point
    drawCharts();
  }

  function computeMonitoringStats() {
    if (state.values.length === 0) {
      setElText('stat-min', '--%');
      setElText('stat-max', '--%');
      setElText('stat-avg', '--%');
      setElText('stat-count', `0 / 60`);
      setElText('monitor-legend-max', '--%');
      setElText('monitor-legend-avg', '--%');
      return;
    }
    const valid = state.values.filter(v => typeof v === 'number' && !isNaN(v));
    if (valid.length === 0) {
      setElText('stat-min', '--%');
      setElText('stat-max', '--%');
      setElText('stat-avg', '--%');
      setElText('stat-count', `${state.values.length} / 60`);
      setElText('monitor-legend-max', '--%');
      setElText('monitor-legend-avg', '--%');
      return;
    }
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const avg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);

    setElText('stat-min', min + '%');
    setElText('stat-max', max + '%');
    setElText('stat-avg', avg + '%');
    setElText('stat-count', `${state.values.length} / 60`);
    setElText('monitor-legend-max', max + '%');
    setElText('monitor-legend-avg', avg + '%');
  }

  // --- Hardware Information Binding ---
  function updateHardwareUI(hw) {
    if (!hw) return;
    state.hardware = hw;

    // Hostname and OS
    setElText('top-device-name', hw.computerName || 'Windows PC');
    setElText('detail-pc-name', hw.computerName || 'Windows PC');
    setElText('detail-os-name', hw.osName || 'Windows');
    setElText('report-device-chip', hw.computerName || 'Equipo');

    // Device avatar initials
    const avatar = document.getElementById('user-avatar');
    if (avatar && hw.computerName) {
      avatar.textContent = hw.computerName.slice(0, 2).toUpperCase();
    }

    // Capacities
    setElText('main-installed-ram', hw.totalInstalledFormatted);
    setElText('main-usable-ram', hw.totalUsableFormatted);
    setElText('detail-installed-ram', hw.totalInstalledFormatted);
    setElText('detail-usable-ram', hw.totalUsableFormatted);
    setElText('report-installed-ram', hw.totalInstalledFormatted);
    setElText('report-usable-ram', hw.totalUsableFormatted);
    setElText('gauge-installed', hw.totalInstalledFormatted || hw.totalUsableFormatted || '--');
    setElText('home-gauge-installed', hw.totalInstalledFormatted || hw.totalUsableFormatted || '--');

    // Reserved RAM calculation
    if (hw.totalInstalledBytes && hw.totalUsableBytes) {
      const reservedBytes = Math.max(0, hw.totalInstalledBytes - hw.totalUsableBytes);
      const reservedGb = (reservedBytes / (1024 * 1024 * 1024)).toFixed(1).replace('.', ',') + ' GB';
      setElText('detail-reserved-ram', reservedGb);
    } else {
      setElText('detail-reserved-ram', 'No disponible');
    }

    // Virtual committed memory
    setElText('detail-virtual-ram', hw.totalVirtualFormatted || 'No disponible');
    setElText('detail-units', state.unit);

    // Modules table population
    populateModulesTables(hw.modules || []);
  }

  function populateModulesTables(modules) {
    const homeTbody = document.getElementById('home-modules-tbody');
    const fullTbody = document.getElementById('modules-full-tbody');
    const chip = document.getElementById('modules-count-chip');

    if (chip) {
      chip.textContent = `${modules.length} módulo${modules.length === 1 ? '' : 's'} detectado${modules.length === 1 ? '' : 's'}`;
    }

    if (!modules || modules.length === 0) {
      const emptyRow = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No se detectaron módulos o el acceso WMI está restringido.</td></tr>';
      if (homeTbody) homeTbody.innerHTML = emptyRow;
      if (fullTbody) fullTbody.innerHTML = emptyRow;
      return;
    }

    // Populate Home Preview table
    if (homeTbody) {
      homeTbody.innerHTML = modules.map(m => `
        <tr>
          <td>▦ ${escapeHtml(m.slot)}</td>
          <td>${escapeHtml(m.capacityFormatted)}</td>
          <td>${escapeHtml(m.manufacturer)}</td>
          <td>${escapeHtml(m.type)}</td>
          <td>${escapeHtml(m.speed)}</td>
        </tr>
      `).join('');
    }

    // Populate Full Modules table
    if (fullTbody) {
      fullTbody.innerHTML = modules.map(m => `
        <tr>
          <td><strong>▦ ${escapeHtml(m.slot)}</strong></td>
          <td>${escapeHtml(m.capacityFormatted)}</td>
          <td>${escapeHtml(m.manufacturer)}</td>
          <td>${escapeHtml(m.type)}</td>
          <td>${escapeHtml(m.speed)}</td>
          <td><code style="color:#ad8aff;font-size:11px">${escapeHtml(m.partNumber)}</code></td>
          <td><span class="chip" style="background:#0d654f;color:#71f5ca">● ${escapeHtml(m.status)}</span></td>
        </tr>
      `).join('');
    }
  }

  // --- Monitoring Controls ---
  async function startMonitoring() {
    state.running = true;
    updateMonitorLabels('Activo', true);
    if (window.ramtraceApi) {
      try {
        await window.ramtraceApi.setMonitoringActive(true);
      } catch (e) {
        console.warn('setMonitoringActive(true) failed:', e);
      }
    }
  }

  async function stopMonitoring() {
    state.running = false;
    updateMonitorLabels('Pausado', false);
    if (window.ramtraceApi) {
      try {
        await window.ramtraceApi.setMonitoringActive(false);
      } catch (e) {
        console.warn('setMonitoringActive(false) failed:', e);
      }
    }
  }

  function updateMonitorLabels(text, isActive) {
    ['monitor-label', 'monitor-label-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = text;
        el.style.background = isActive ? '#202b49' : '#332916';
        el.style.color = isActive ? '#c9d5f7' : '#ffd05b';
      }
    });

    const sideStatus = document.getElementById('sidebar-system-status');
    const sideNote = document.getElementById('sidebar-system-note');
    if (sideStatus) {
      sideStatus.innerHTML = isActive
        ? '<span class="positive">●</span> Sistema listo'
        : '<span class="warning">●</span> Monitoreo en pausa';
    }
    if (sideNote) {
      sideNote.textContent = isActive
        ? 'Conectado a Windows API en tiempo real.'
        : 'Medición pausada manualmente.';
    }
  }

  ['start-btn', 'start-btn-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', startMonitoring);
  });

  ['stop-btn', 'stop-btn-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', stopMonitoring);
  });

  const clearBtn = document.getElementById('clear-chart-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.values = [];
      drawCharts();
      computeMonitoringStats();
      setElText('last-value', 'Último valor: --%');
      setElText('monitor-percent', '--%');
      setElText('monitor-percent-dup', '--%');
      setElText('monitor-legend-current', '--%');
      setElWidth('monitor-bar', '0%');
    });
  }

  const monitorIntervalSelect = document.getElementById('monitor-interval-select');
  if (monitorIntervalSelect) {
    const allowed = [1000, 2000, 3000, 5000];
    if (!allowed.includes(state.intervalMs)) state.intervalMs = 2000;
    monitorIntervalSelect.value = String(state.intervalMs);
    monitorIntervalSelect.addEventListener('change', async (e) => {
      let ms = Number(e.target.value);
      if (isNaN(ms)) ms = 2000;
      if (!allowed.includes(ms)) ms = 2000;
      state.intervalMs = ms;
      try { localStorage.setItem('ramtrace_interval', String(state.intervalMs)); } catch (err) {}
      if (window.ramtraceApi) {
        try { await window.ramtraceApi.setMonitoringInterval(state.intervalMs); } catch (err) {}
      }
      const intervalSel = document.getElementById('interval');
      if (intervalSel) intervalSel.value = String(state.intervalMs);
    });
  }

  // --- Diagnostics Handling ---
  const testSelect = document.getElementById('test-result');
  const obsTextarea = document.getElementById('observations');
  const saveObsBtn = document.getElementById('save-observation');
  const saveMsg = document.getElementById('save-msg');
  const reportTestEl = document.getElementById('report-test');

  if (testSelect) {
    testSelect.value = state.testResult;
    testSelect.addEventListener('change', (e) => {
      state.testResult = e.target.value;
      if (reportTestEl) reportTestEl.textContent = state.testResult;
      try {
        localStorage.setItem('ramtrace_test_result', state.testResult);
      } catch (err) {}
    });
  }

  if (obsTextarea) {
    obsTextarea.value = state.observations;
    obsTextarea.addEventListener('input', (e) => {
      state.observations = e.target.value;
    });
  }

  if (saveObsBtn) {
    saveObsBtn.addEventListener('click', () => {
      try {
        localStorage.setItem('ramtrace_observations', state.observations);
        localStorage.setItem('ramtrace_test_result', state.testResult);
        if (saveMsg) {
          saveMsg.textContent = '✓ Observación guardada correctamente.';
          saveMsg.style.color = 'var(--green)';
          setTimeout(() => { saveMsg.textContent = ''; }, 3500);
        }
        if (reportTestEl) reportTestEl.textContent = state.testResult;
      } catch (e) {
        if (saveMsg) saveMsg.textContent = 'Guardado en la sesión actual.';
      }
    });
  }

  // Launch mdsched.exe button
  const launchMdschedBtn = document.getElementById('btn-launch-mdsched');
  const mdschedMsg = document.getElementById('mdsched-msg');
  if (launchMdschedBtn) {
    launchMdschedBtn.addEventListener('click', async () => {
      if (!window.ramtraceApi) return;
      if (mdschedMsg) mdschedMsg.textContent = 'Solicitando confirmación...';
      const res = await window.ramtraceApi.launchWindowsMemoryDiagnostic();
      if (res.success) {
        if (mdschedMsg) {
          mdschedMsg.textContent = '✓ Herramienta Diagnóstico de memoria de Windows iniciada.';
          mdschedMsg.style.color = 'var(--green)';
        }
      } else if (res.canceled) {
        if (mdschedMsg) {
          mdschedMsg.textContent = 'Operación cancelada.';
          mdschedMsg.style.color = 'var(--muted)';
        }
      } else {
        if (mdschedMsg) {
          mdschedMsg.textContent = 'Error: ' + res.error;
          mdschedMsg.style.color = 'var(--red)';
        }
      }
      setTimeout(() => { if (mdschedMsg) mdschedMsg.textContent = ''; }, 5000);
    });
  }

  // --- Reports Generation and Export ---
  async function triggerExport(format, exportType = 'report') {
    const statusMsg = document.getElementById('export-status-msg');
    const fmt = (exportType === 'events') ? 'csv' : (format === 'csv' ? 'csv' : 'txt');
    if (statusMsg) {
      statusMsg.textContent = `Generando y preparando ${exportType === 'events' ? 'registro de eventos' : ('reporte ' + fmt.toUpperCase())}...`;
      statusMsg.style.color = 'var(--muted)';
    }

    let min = undefined;
    let max = undefined;
    let avg = undefined;
    if (state.values.length > 0) {
      const valid = state.values.filter(v => typeof v === 'number' && !isNaN(v));
      if (valid.length > 0) {
        min = Math.min(...valid);
        max = Math.max(...valid);
        avg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
      }
    }

    let events = [];
    if (window.ramtraceApi && window.ramtraceApi.getEvents) {
      try {
        events = await window.ramtraceApi.getEvents(500);
      } catch (e) {
        events = [];
      }
    }

    const reportData = {
      hardware: state.hardware,
      metrics: state.metrics,
      history: (state.values || []).map((v, i) => ({
        timestamp: Date.now() - (state.values.length - 1 - i) * state.intervalMs,
        percent: v
      })),
      monitoringStats: {
        count: state.values.length,
        min: min !== undefined ? min : (state.metrics && state.metrics.percent !== undefined && !isNaN(state.metrics.percent) ? state.metrics.percent : undefined),
        max: max !== undefined ? max : (state.metrics && state.metrics.percent !== undefined && !isNaN(state.metrics.percent) ? state.metrics.percent : undefined),
        avg: avg !== undefined ? avg : (state.metrics && state.metrics.percent !== undefined && !isNaN(state.metrics.percent) ? state.metrics.percent : undefined)
      },
      testResult: state.testResult,
      observations: state.observations,
      events: events
    };

    if (window.ramtraceApi) {
      try {
        const res = await window.ramtraceApi.saveReport({ format: fmt, reportData, exportType: exportType === 'events' ? 'events' : 'report' });
        if (res && res.success) {
          if (statusMsg) {
            statusMsg.textContent = `✓ ${exportType === 'events' ? 'Registro de eventos' : 'Reporte'} guardado con éxito en: ${res.filePath}`;
            statusMsg.style.color = 'var(--green)';
          }
          try {
            if (window.ramtraceApi.logEvent) {
              await window.ramtraceApi.logEvent({ level: 'INFO', category: 'Reportes', message: `Exportación ${fmt.toUpperCase()} realizada`, result: 'OK' });
            }
          } catch (e) {}
        } else if (res && res.canceled) {
          if (statusMsg) {
            statusMsg.textContent = 'Guardado cancelado por el usuario.';
            statusMsg.style.color = 'var(--muted)';
          }
          try {
            if (window.ramtraceApi.logEvent) {
              await window.ramtraceApi.logEvent({ level: 'INFO', category: 'Reportes', message: `Exportación ${fmt.toUpperCase()} cancelada`, result: 'Cancelado' });
            }
          } catch (e) {}
        } else {
          if (statusMsg) {
            statusMsg.textContent = `Error al guardar: ${res && res.error ? res.error : 'Error desconocido'}`;
            statusMsg.style.color = 'var(--red)';
          }
          try {
            if (window.ramtraceApi.logEvent) {
              await window.ramtraceApi.logEvent({ level: 'ERROR', category: 'Reportes', message: `Error al exportar ${fmt.toUpperCase()}`, result: 'Error' });
            }
          } catch (e) {}
        }
      } catch (e) {
        if (statusMsg) {
          statusMsg.textContent = 'Error al generar/guardar el reporte.';
          statusMsg.style.color = 'var(--red)';
        }
      }
    } else {
      if (statusMsg) statusMsg.textContent = 'La exportación nativa requiere la aplicación de escritorio.';
    }
  }

  ['export-btn', 'export-btn-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => triggerExport('txt', 'report'));
  });

  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => triggerExport('csv', 'report'));
  }

  const exportLogCsvBtn = document.getElementById('export-log-csv');
  if (exportLogCsvBtn) {
    exportLogCsvBtn.addEventListener('click', () => triggerExport('csv', 'events'));
  }

  // --- Configuration Section Handling ---
  const intervalSelect = document.getElementById('interval');
  if (intervalSelect) {
    const allowed = [1000, 2000, 3000, 5000];
    if (!allowed.includes(state.intervalMs)) state.intervalMs = 2000;
    intervalSelect.value = String(state.intervalMs);
    intervalSelect.addEventListener('change', async (e) => {
      let ms = Number(e.target.value);
      if (isNaN(ms)) ms = 2000;
      if (!allowed.includes(ms)) ms = 2000;
      state.intervalMs = ms;
      try {
        localStorage.setItem('ramtrace_interval', String(state.intervalMs));
      } catch (err) {}
      if (window.ramtraceApi) {
        try {
          await window.ramtraceApi.setMonitoringInterval(state.intervalMs);
        } catch (err) {}
      }
    });
  }

  const unitSelect = document.getElementById('unit-selector');
  if (unitSelect) {
    unitSelect.value = state.unit === 'MB' ? 'MB' : 'GB';
    unitSelect.addEventListener('change', async (e) => {
      const newUnit = e.target.value === 'MB' ? 'MB' : 'GB';
      state.unit = newUnit;
      try {
        localStorage.setItem('ramtrace_unit', state.unit);
      } catch (err) {}
      // Refresh hardware and metrics with new unit
      if (window.ramtraceApi) {
        try {
          const hwRes = await window.ramtraceApi.getHardwareInfo(true);
          if (hwRes && hwRes.success) updateHardwareUI(hwRes.data);
        } catch (err) {}
        try {
          const m = await window.ramtraceApi.getRealtimeMetrics(state.unit);
          updateRealtimeUI(m);
        } catch (err) {}
      }
    });
  }

  const toggleVideoBtn = document.getElementById('btn-toggle-video');
  if (toggleVideoBtn) {
    toggleVideoBtn.textContent = state.videoEnabled ? 'Video: Activado' : 'Video: Desactivado';
    toggleVideoBtn.addEventListener('click', () => {
      state.videoEnabled = !state.videoEnabled;
      toggleVideoBtn.textContent = state.videoEnabled ? 'Video: Activado' : 'Video: Desactivado';
      try {
        localStorage.setItem('ramtrace_video', String(state.videoEnabled));
      } catch (err) {}
      initVideo();
    });
  }

  // Theme selector
  const themeSelector = document.getElementById('theme-selector');
  if (themeSelector) {
    themeSelector.value = state.theme;
    themeSelector.addEventListener('change', (e) => {
      state.theme = e.target.value;
      try { localStorage.setItem('ramtrace_theme', state.theme); } catch (err) {}
      applyTheme();
    });
  }

  // Accent selectors
  document.querySelectorAll('[data-accent]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.accent = btn.getAttribute('data-accent');
      state.accent2 = btn.getAttribute('data-accent2') || btn.getAttribute('data-accent');
      try {
        localStorage.setItem('ramtrace_accent', state.accent);
        localStorage.setItem('ramtrace_accent2', state.accent2);
      } catch (err) {}
      applyAccent();
    });
  });

  const accentPicker = document.getElementById('accent-picker');
  if (accentPicker) {
    accentPicker.value = state.accent;
    accentPicker.addEventListener('input', (e) => {
      state.accent = e.target.value;
      state.accent2 = e.target.value;
      try {
        localStorage.setItem('ramtrace_accent', state.accent);
        localStorage.setItem('ramtrace_accent2', state.accent2);
      } catch (err) {}
      applyAccent();
    });
  }

  const refreshHwBtn = document.getElementById('btn-refresh-hardware');
  const refreshMsg = document.getElementById('refresh-hw-msg');
  if (refreshHwBtn) {
    refreshHwBtn.addEventListener('click', async () => {
      if (refreshMsg) refreshMsg.textContent = 'Consultando hardware vía WMI...';
      if (window.ramtraceApi) {
        const res = await window.ramtraceApi.getHardwareInfo(true);
        if (res && res.success) {
          updateHardwareUI(res.data);
          if (refreshMsg) {
            refreshMsg.textContent = '✓ Hardware actualizado.';
            refreshMsg.style.color = 'var(--green)';
          }
        } else {
          if (refreshMsg) {
            refreshMsg.textContent = 'Error al consultar hardware.';
            refreshMsg.style.color = 'var(--red)';
          }
        }
        setTimeout(() => { if (refreshMsg) refreshMsg.textContent = ''; }, 3500);
      }
    });
  }

  // --- RAM Visual (predeterminado) ---
  function initRamVisual() {
    try {
      const vid = document.getElementById('ram-video');
      if (vid) {
        vid.play().catch(() => {});
      }
    } catch (e) {
      console.warn('RAM visual init failed:', e);
    }
  }

  // --- Initial Setup and Event Subscriptions ---
  async function initApp() {
    applyTheme();
    applyAccent();
    initVideo();
    initRamVisual();

    // Set initial date in report overview
    const reportDateEl = document.getElementById('report-date');
    if (reportDateEl) {
      reportDateEl.textContent = new Date().toLocaleDateString('es-PA');
    }

    if (reportTestEl) {
      reportTestEl.textContent = state.testResult;
    }

    const msel = document.getElementById('monitor-interval-select');
    if (msel) msel.value = String(state.intervalMs);

    if (window.ramtraceApi) {
      // 1. Fetch Hardware Specs (Motherboard slots, DIMMs, total installed RAM)
      try {
        const hwRes = await window.ramtraceApi.getHardwareInfo(false);
        if (hwRes && hwRes.success) {
          updateHardwareUI(hwRes.data);
        }
      } catch (e) {
        console.error('Error fetching hardware info:', e);
      }

      // 2. Initial real-time measurement
      try {
        const initialMetrics = await window.ramtraceApi.getRealtimeMetrics(state.unit);
        updateRealtimeUI(initialMetrics);
      } catch (e) {
        console.error('Error fetching initial metrics:', e);
      }

      // 3. Listen to periodic real-time ticks
      window.ramtraceApi.onMemoryTick((metrics) => {
        if (state.running) {
          updateRealtimeUI(metrics);
        }
      });

      // Synchronize initial interval with main process
      await window.ramtraceApi.setMonitoringInterval(state.intervalMs);
    }

    // Initial chart draw
    setTimeout(drawCharts, 100);
  }

  // Helper DOM functions
  function setElText(id, text) {
    const el = document.getElementById(id);
    if (el && text !== undefined && text !== null) el.textContent = text;
  }

  function setElWidth(id, width) {
    const el = document.getElementById(id);
    if (el && width !== undefined && width !== null) el.style.width = width;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
