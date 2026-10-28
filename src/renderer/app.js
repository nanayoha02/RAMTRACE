// RamTrace Desktop Renderer Application Logic

(function () {
  'use strict';

  // --- Configuration and State ---
  const state = {
    running: true,
    intervalMs: 2000,
    unit: 'GB',
    videoEnabled: true,
    neonVideoEnabled: false,
    crimsonVideoEnabled: false,
    testResult: 'Pendiente',
    observations: '',
    hardware: null,
    metrics: null,
    values: [], // Array of recent utilization % (up to 60 samples)
    theme: 'dark', // 'dark' | 'light' | 'system' | 'lavender' | 'neon' | 'crimson'
    accent: '#7548ff',
    accent2: '#7c3aed',
    reducedEffects: false,
    reducedEffectsPref: null,
    reducedEffectsAuto: false,
    autoSuppressed: false,
    lowFpsStreak: 0
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

    if (state.accent === '#7548ff' && state.accent2 === '#a15cff') {
      state.accent2 = '#7c3aed';
    }

    const savedReducedEffects = localStorage.getItem('ramtrace_reduced_effects');
    if (savedReducedEffects !== null) {
      state.reducedEffects = savedReducedEffects === 'true';
      state.reducedEffectsPref = state.reducedEffects;
    }
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
  const THEMES = ['dark', 'light', 'lavender', 'neon', 'crimson'];
  const ACCENT_THEMES = ['dark', 'light'];

  function prefersLightScheme() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }

  function resolveTheme(theme) {
    if (theme === 'system') return prefersLightScheme() ? 'light' : 'dark';
    return THEMES.includes(theme) ? theme : 'dark';
  }

  function effectiveTheme() {
    return resolveTheme(state.theme);
  }

  function hexToRgba(hex, alpha) {
    let value = String(hex || '').replace('#', '');
    if (value.length === 3) {
      value = value.split('').map(function (c) { return c + c; }).join('');
    }
    if (!/^[0-9a-f]{6}$/i.test(value)) return 'rgba(117,72,255,' + alpha + ')';
    const number = parseInt(value, 16);
    return 'rgba(' + ((number >> 16) & 255) + ',' + ((number >> 8) & 255) + ',' + (number & 255) + ',' + alpha + ')';
  }

  function hexLuminance(hex) {
    let value = String(hex || '').replace('#', '');
    if (value.length === 3) {
      value = value.split('').map(function (c) { return c + c; }).join('');
    }
    if (!/^[0-9a-f]{6}$/i.test(value)) return 0;
    const number = parseInt(value, 16);
    const channels = [(number >> 16) & 255, (number >> 8) & 255, number & 255];
    const linear = channels.map(function (channel) {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastRatio(a, b) {
    const lumA = hexLuminance(a);
    const lumB = hexLuminance(b);
    const light = Math.max(lumA, lumB);
    const dark = Math.min(lumA, lumB);
    return (light + 0.05) / (dark + 0.05);
  }

  function accentTextColor(colors) {
    const candidates = ['#ffffff', '#0b1220'];
    let best = candidates[0];
    let bestScore = -1;
    candidates.forEach(function (candidate) {
      const score = Math.min.apply(null, colors.map(function (color) {
        return contrastRatio(candidate, color);
      }));
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    });
    return best;
  }

  function clearAccentOverrides() {
    const root = document.documentElement;
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-2');
    root.style.removeProperty('--accent-glow');
    root.style.removeProperty('--text-on-accent');
    root.style.removeProperty('--btn-primary-text');
    root.style.removeProperty('--nav-active-text');
    root.style.removeProperty('--accent-contrast');
  }

  function applyTheme() {
    const root = document.documentElement;
    const theme = effectiveTheme();
    root.setAttribute('data-theme', theme);
    updateThemeControls(theme);
    applyAccent();
    syncAccentControls(theme);
  }

  function applyAccent() {
    const root = document.documentElement;
    if (!ACCENT_THEMES.includes(effectiveTheme())) {
      clearAccentOverrides();
      return;
    }
    if (state.accent) root.style.setProperty('--accent', state.accent);
    if (state.accent2) root.style.setProperty('--accent-2', state.accent2);
    root.style.setProperty('--accent-glow', hexToRgba(state.accent || '#7548ff', 0.33));
    const onAccent = accentTextColor([state.accent || '#7548ff', state.accent2 || '#7c3aed']);
    root.style.setProperty('--text-on-accent', onAccent);
    root.style.setProperty('--btn-primary-text', onAccent);
    root.style.setProperty('--nav-active-text', onAccent);
    root.style.setProperty('--accent-contrast', onAccent);
  }

  function setTheme(theme) {
    state.theme = theme;
    if (theme === 'neon') state.neonVideoEnabled = false;
    if (theme === 'crimson') state.crimsonVideoEnabled = false;
    try {
      localStorage.setItem('ramtrace_theme', state.theme);
    } catch (err) {}
    applyTheme();
    initVideo();
    drawCharts();
  }

  function updateThemeControls(theme) {
    document.querySelectorAll('[data-theme-choice]').forEach(function (card) {
      card.setAttribute('aria-checked', String(card.dataset.themeChoice === theme));
    });
    const systemToggle = document.getElementById('theme-system');
    if (systemToggle) systemToggle.checked = state.theme === 'system';
  }

  function syncAccentControls(theme) {
    const enabled = ACCENT_THEMES.includes(theme);
    document.querySelectorAll('[data-accent]').forEach(function (button) {
      button.disabled = !enabled;
      button.setAttribute('aria-pressed', String(button.dataset.accent === state.accent));
    });
    const picker = document.getElementById('accent-picker');
    if (picker) picker.disabled = !enabled;
    const row = document.getElementById('accent-row');
    if (row) row.classList.toggle('is-disabled', !enabled);
    const note = document.getElementById('accent-disabled-note');
    if (note) note.hidden = enabled;
  }

  // --- Reduced Effects ---
  function applyReducedEffects() {
    const root = document.documentElement;
    if (state.reducedEffects) {
      root.setAttribute('data-reduced-effects', 'true');
    } else {
      root.removeAttribute('data-reduced-effects');
    }
    updateReducedEffectsUI();
  }

  function updateReducedEffectsUI() {
    const button = document.getElementById('btn-toggle-effects');
    const label = button ? button.querySelector('.switch-label') : null;
    const status = document.getElementById('reduced-effects-status');
    if (button) button.setAttribute('aria-checked', String(state.reducedEffects));
    if (label) label.textContent = state.reducedEffects ? 'Activado' : 'Desactivado';
    if (status) {
      if (state.reducedEffectsAuto) {
        status.textContent = 'Activado automáticamente por rendimiento bajo.';
      } else if (state.reducedEffectsPref === false) {
        status.textContent = 'Desactivado manualmente.';
      } else if (state.reducedEffectsPref === true) {
        status.textContent = 'Activado manualmente.';
      } else {
        status.textContent = '';
      }
    }
  }

  function setReducedEffects(enabled, options) {
    const opts = options || {};
    state.reducedEffects = Boolean(enabled);
    if (opts.auto) {
      state.reducedEffectsAuto = true;
    } else {
      state.reducedEffectsAuto = false;
    }
    if (opts.persist) {
      state.reducedEffectsPref = state.reducedEffects;
      try {
        localStorage.setItem('ramtrace_reduced_effects', String(state.reducedEffects));
      } catch (err) {}
    }
    applyReducedEffects();
  }

  function toggleReducedEffects() {
    const next = !state.reducedEffects;
    state.autoSuppressed = !next;
    setReducedEffects(next, { persist: true });
  }

  function startFpsMonitor() {
    if (state.reducedEffectsPref === false) return;

    let frames = 0;
    let windowStart = performance.now();

    function sample(now) {
      if (document.hidden) {
        frames = 0;
        windowStart = now;
        requestAnimationFrame(sample);
        return;
      }

      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 2000) {
        const fps = (frames * 1000) / elapsed;
        if (fps < 40) {
          state.lowFpsStreak += 1;
          if (
            state.lowFpsStreak >= 2 &&
            !state.reducedEffects &&
            !state.autoSuppressed &&
            state.reducedEffectsPref === null
          ) {
            setReducedEffects(true, { auto: true });
          }
        } else {
          state.lowFpsStreak = 0;
        }
        frames = 0;
        windowStart = now;
      }
      requestAnimationFrame(sample);
    }

    requestAnimationFrame(sample);
  }

  // --- Background Video Initialization ---
  const bgVideo = document.getElementById('bg-video');
  function isVideoVisible() {
    const theme = effectiveTheme();
    if (theme === 'neon') return state.neonVideoEnabled;
    if (theme === 'crimson') return state.crimsonVideoEnabled;
    return state.videoEnabled;
  }
  function updateVideoButton() {
    const button = document.getElementById('btn-toggle-video');
    if (!button) return;
    button.textContent = isVideoVisible() ? 'Video: Activado' : 'Video: Desactivado';
  }
  function initVideo() {
    if (!bgVideo) return;
    if (isVideoVisible()) {
      bgVideo.classList.remove('hidden');
      bgVideo.play().catch(() => {
        // Fallback gracefully if system policies block autoplay
      });
    } else {
      bgVideo.pause();
      bgVideo.classList.add('hidden');
    }
    updateVideoButton();
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
  function themeColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function chartPalette() {
    const bodyFont = getComputedStyle(document.body).fontFamily || 'sans-serif';
    return {
      grid: themeColor('--chart-grid', '#24314c'),
      gridVertical: themeColor('--chart-grid-vertical', '#1b2943'),
      axis: themeColor('--chart-axis', '#9ba9ca'),
      label: themeColor('--chart-label', '#8c9aba'),
      line: themeColor('--chart-line', '#b66bff'),
      lineGlow: themeColor('--chart-line-glow', 'rgba(156,92,255,.75)'),
      areaFrom: themeColor('--chart-area-from', 'rgba(161,92,255,.46)'),
      areaTo: themeColor('--chart-area-to', 'rgba(91,69,255,.02)'),
      pointFill: themeColor('--chart-point-fill', '#ffffff'),
      pointStroke: themeColor('--chart-point-stroke', '#9e63ff'),
      font: bodyFont
    };
  }

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

    const palette = chartPalette();
    const chartFont = '11px ' + palette.font;

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
      ctx.font = chartFont;
      ctx.textAlign = 'right';
      for (let n = 0; n <= 100; n += 20) {
        const y = pad.t + ch * (1 - n / 100);
        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(w - pad.r, y);
        ctx.stroke();
        ctx.fillStyle = palette.axis;
        ctx.fillText(n + '%', pad.l - 8, y + 4);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.label;
      ctx.fillText('Hora', pad.l + cw / 2, h - 10);
      return;
    }

    // Horizontal grid lines (0% to 100%)
    ctx.font = chartFont;
    ctx.textAlign = 'right';

    for (let n = 0; n <= 100; n += 20) {
      const y = pad.t + ch * (1 - n / 100);
      ctx.strokeStyle = palette.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();

      ctx.fillStyle = palette.axis;
      ctx.fillText(n + '%', pad.l - 8, y + 4);
    }

    // Vertical time lines
    const timeLabels = ['Hace 60s', '50s', '40s', '30s', '20s', '10s', 'Ahora'];
    for (let i = 0; i < 7; i++) {
      const x = pad.l + cw * (i / 6);
      ctx.strokeStyle = palette.gridVertical;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + ch);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = palette.label;
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
    grad.addColorStop(0, palette.areaFrom);
    grad.addColorStop(1, palette.areaTo);
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 2.8;
    ctx.shadowColor = palette.lineGlow;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Points
    pts.forEach((p, i) => {
      if (i % Math.max(1, Math.floor(len / 12)) === 0 || i === len - 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === len - 1 ? 4.2 : 3, 0, Math.PI * 2);
        ctx.fillStyle = palette.pointFill;
        ctx.fill();
        ctx.strokeStyle = palette.pointStroke;
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
  const RAM_WARN = 70;
  const RAM_CRIT = 85;

  function getRamState(p) {
    if (p === undefined || p === null || isNaN(p)) return { level: 'unknown', text: 'Sin datos', cls: 'warn' };
    const val = Math.min(100, Math.max(0, p));
    if (val >= RAM_CRIT) return { level: 'critical', text: '! Muy elevado', cls: 'crit' };
    if (val >= RAM_WARN) return { level: 'warning', text: '⚠ Elevado', cls: 'warn' };
    return { level: 'normal', text: '✓ Normal', cls: 'ok' };
  }

  function setStatusPill(el, stateInfo) {
    if (!el) return;
    el.dataset.level = stateInfo && stateInfo.cls ? stateInfo.cls : 'unknown';
    el.textContent = stateInfo && stateInfo.text ? stateInfo.text : 'Sin datos';
  }

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
    
    function apply(elNeedle, elArc, elPct, elPill, normalNeedle, normalArc) {
      if (!elPct) return;
      if (!hasValue) {
        elPct.textContent = 'Sin datos';
        if (elNeedle) { elNeedle.style.transform = 'rotate(-90deg)'; elNeedle.style.transformOrigin = '100px 100px'; }
        if (elArc) { elArc.style.strokeDasharray = '0 ' + (2 * Math.PI * 80); elArc.style.stroke = 'var(--muted)'; }
        setStatusPill(elPill, { cls: 'unknown', text: 'Sin datos' });
        return;
      }
      elPct.textContent = pRounded + '%';
      const stateInfo = getRamState(p);
      if (elNeedle) {
        const angle = -90 + (p * 1.8);
        elNeedle.style.transform = `rotate(${angle}deg)`;
        elNeedle.style.transformOrigin = '100px 100px';
        if (stateInfo.cls === 'crit') elNeedle.style.stroke = 'var(--crit)';
        else if (stateInfo.cls === 'warn') elNeedle.style.stroke = 'var(--warn)';
        else elNeedle.style.stroke = normalNeedle;
      }
      if (elArc) {
        const len = 2 * Math.PI * 80 * (p / 100);
        elArc.style.strokeDasharray = len + ' ' + (2 * Math.PI * 80);
        if (stateInfo.cls === 'crit') elArc.style.stroke = 'var(--crit)';
        else if (stateInfo.cls === 'warn') elArc.style.stroke = 'var(--warn)';
        else elArc.style.stroke = normalArc;
      }
      setStatusPill(elPill, stateInfo);
    }

    apply(needleHome, arcHome, pctElHome, levelPillHome, 'var(--gauge-3)', 'url(#home-gauge-grad)');
    apply(needleMem, arcMem, pctElMem, levelPillMem, 'var(--gauge-needle)', 'url(#gauge-grad)');
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
        setStatusPill(statusPill, { cls: 'unknown', text: 'Sin datos' });
      } else {
        const st = getRamState(current);
        const icon = st.cls === 'crit' ? '! ' : (st.cls === 'warn' ? '⚠ ' : '✓ ');
        const statusText = metrics.statusText || (st.cls === 'crit' ? 'Muy elevado' : (st.cls === 'warn' ? 'Elevado' : 'Normal'));
        setStatusPill(statusPill, { cls: st.cls, text: icon + statusText });
      }
    }

    // Recommendation card
    if (hasValue) {
      const st = getRamState(current);
      const recTitle = metrics.recommendTitle || (st.cls === 'crit' ? 'Utilización muy elevada' : (st.cls === 'warn' ? 'Utilización elevada' : 'Utilización dentro del rango definido'));
      const recText = metrics.recommendText || (st.cls === 'crit' ? 'Revisa la carga del equipo y considera cerrar aplicaciones que no necesites.' : (st.cls === 'warn' ? 'Revisa las aplicaciones abiertas y el consumo de memoria.' : 'El consumo actual está por debajo del umbral de alerta de esta práctica.'));
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
        setStatusPill(monStatus, { cls: 'unknown', text: 'Sin datos' });
      } else if (statusPill) {
        monStatus.dataset.level = statusPill.dataset.level;
        monStatus.textContent = statusPill.textContent;
      } else {
        setStatusPill(monStatus, getRamState(current));
      }
    }

    // Statistics computation
    computeMonitoringStats();

    // 4. Reportes View Summary
    setElText('report-percent', hasValue ? current + '%' : '--%');
    setElText('report-used-ram', metrics.usedFormatted || '--');
    setElText('report-free-ram', metrics.freeFormatted || '--');
    setElText('report-last-time', new Date().toLocaleString('es-PA'));
    setStatusPill(
      document.getElementById('report-status-pill'),
      hasValue ? getRamState(current) : { cls: 'unknown', text: 'Sin datos' }
    );

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
      const emptyRow = '<tr><td colspan="7" class="table-empty">No se detectaron módulos o el acceso WMI está restringido.</td></tr>';
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
          <td><code class="part-number">${escapeHtml(m.partNumber)}</code></td>
          <td><span class="chip chip-ok">● ${escapeHtml(m.status)}</span></td>
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
        el.dataset.level = isActive ? 'info' : 'warn';
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
          saveMsg.style.color = 'var(--ok-text)';
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
          mdschedMsg.style.color = 'var(--ok-text)';
        }
      } else if (res.canceled) {
        if (mdschedMsg) {
          mdschedMsg.textContent = 'Operación cancelada.';
          mdschedMsg.style.color = 'var(--muted)';
        }
      } else {
        if (mdschedMsg) {
          mdschedMsg.textContent = 'Error: ' + res.error;
          mdschedMsg.style.color = 'var(--crit-text)';
        }
      }
      setTimeout(() => { if (mdschedMsg) mdschedMsg.textContent = ''; }, 5000);
    });
  }

  // --- Reports Generation and Export ---
  const CSV_TABLE_LABELS = {
    summary: 'Resumen',
    history: 'Historial',
    modules: 'Módulos',
    events: 'Eventos'
  };

  async function triggerExport(format, table = 'summary') {
    const statusMsg = document.getElementById('export-status-msg');
    const fmt = format === 'csv' ? 'csv' : 'txt';
    const requestedTable = String(table || 'summary').toLowerCase();
    const csvTable = Object.prototype.hasOwnProperty.call(CSV_TABLE_LABELS, requestedTable)
      ? requestedTable
      : 'summary';
    const exportLabel = fmt === 'csv' ? `CSV de ${CSV_TABLE_LABELS[csvTable]}` : 'reporte TXT';
    if (statusMsg) {
      statusMsg.textContent = `Generando y preparando ${exportLabel}...`;
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
        const payload = { format: fmt, reportData };
        if (fmt === 'csv') payload.table = csvTable;
        const res = await window.ramtraceApi.saveReport(payload);
        if (res && res.success) {
          if (statusMsg) {
            statusMsg.textContent = `✓ ${exportLabel} guardado con éxito en: ${res.filePath}`;
            statusMsg.style.color = 'var(--ok-text)';
          }
          try {
            if (window.ramtraceApi.logEvent) {
              await window.ramtraceApi.logEvent({ level: 'INFO', category: 'Reportes', message: `Exportación ${exportLabel} realizada`, result: 'OK' });
            }
          } catch (e) {}
        } else if (res && res.canceled) {
          if (statusMsg) {
            statusMsg.textContent = 'Guardado cancelado por el usuario.';
            statusMsg.style.color = 'var(--muted)';
          }
          try {
            if (window.ramtraceApi.logEvent) {
              await window.ramtraceApi.logEvent({ level: 'INFO', category: 'Reportes', message: `Exportación ${exportLabel} cancelada`, result: 'Cancelado' });
            }
          } catch (e) {}
        } else {
          if (statusMsg) {
            statusMsg.textContent = `Error al guardar: ${res && res.error ? res.error : 'Error desconocido'}`;
            statusMsg.style.color = 'var(--crit-text)';
          }
          try {
            if (window.ramtraceApi.logEvent) {
              await window.ramtraceApi.logEvent({ level: 'ERROR', category: 'Reportes', message: `Error al exportar ${exportLabel}`, result: 'Error' });
            }
          } catch (e) {}
        }
      } catch (e) {
        if (statusMsg) {
          statusMsg.textContent = 'Error al generar/guardar el reporte.';
          statusMsg.style.color = 'var(--crit-text)';
        }
      }
    } else {
      if (statusMsg) statusMsg.textContent = 'La exportación nativa requiere la aplicación de escritorio.';
    }
  }

  ['export-btn', 'export-btn-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => triggerExport('txt'));
  });

  const csvTableSelect = document.getElementById('csv-table-select');
  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      triggerExport('csv', csvTableSelect ? csvTableSelect.value : 'summary');
    });
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
    toggleVideoBtn.addEventListener('click', () => {
      const theme = effectiveTheme();
      if (theme === 'neon') {
        state.neonVideoEnabled = !state.neonVideoEnabled;
      } else if (theme === 'crimson') {
        state.crimsonVideoEnabled = !state.crimsonVideoEnabled;
      } else {
        state.videoEnabled = !state.videoEnabled;
        try {
          localStorage.setItem('ramtrace_video', String(state.videoEnabled));
        } catch (err) {}
      }
      initVideo();
    });
  }

  // Theme selector
  document.querySelectorAll('[data-theme-choice]').forEach(card => {
    card.addEventListener('click', () => setTheme(card.dataset.themeChoice));
  });

  const themeSystem = document.getElementById('theme-system');
  if (themeSystem) {
    themeSystem.checked = state.theme === 'system';
    themeSystem.addEventListener('change', () => {
      setTheme(themeSystem.checked ? 'system' : resolveTheme(state.theme));
    });
  }

  const systemThemeQuery = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null;
  if (systemThemeQuery) {
    const onSystemThemeChange = () => {
      if (state.theme === 'system') {
        applyTheme();
        drawCharts();
      }
    };
    if (systemThemeQuery.addEventListener) systemThemeQuery.addEventListener('change', onSystemThemeChange);
    else if (systemThemeQuery.addListener) systemThemeQuery.addListener(onSystemThemeChange);
  }

  // Accent selectors
  document.querySelectorAll('[data-accent]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      state.accent = btn.getAttribute('data-accent');
      state.accent2 = btn.getAttribute('data-accent2') || btn.getAttribute('data-accent');
      try {
        localStorage.setItem('ramtrace_accent', state.accent);
        localStorage.setItem('ramtrace_accent2', state.accent2);
      } catch (err) {}
      applyAccent();
      syncAccentControls(effectiveTheme());
      drawCharts();
    });
  });

  const accentPicker = document.getElementById('accent-picker');
  if (accentPicker) {
    accentPicker.value = state.accent || '#7548ff';
    accentPicker.addEventListener('input', (e) => {
      if (accentPicker.disabled) return;
      state.accent = e.target.value;
      state.accent2 = e.target.value;
      try {
        localStorage.setItem('ramtrace_accent', state.accent);
        localStorage.setItem('ramtrace_accent2', state.accent2);
      } catch (err) {}
      applyAccent();
      syncAccentControls(effectiveTheme());
      drawCharts();
    });
  }

  const effectsToggle = document.getElementById('btn-toggle-effects');
  if (effectsToggle) {
    effectsToggle.addEventListener('click', toggleReducedEffects);
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
            refreshMsg.style.color = 'var(--ok-text)';
          }
        } else {
          if (refreshMsg) {
            refreshMsg.textContent = 'Error al consultar hardware.';
            refreshMsg.style.color = 'var(--crit-text)';
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
    applyReducedEffects();
    startFpsMonitor();
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
