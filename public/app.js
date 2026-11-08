/**
 * Pro Terminal — Terminal Institucional de Trading MT5, Metodología Price Action & Bitácora Real
 * Cálculo de interés compuesto basado puramente en porcentaje y puntos de oro.
 */

// Global State
let appState = {
  activeTab: 'fondeo',
  fondeo: {
    summary: {},
    trades: [],
    equityCurve: [],
    config: {
      initial_balance: 50000.0,
      risk_pct: 0.5,
      rr_ratio: 2.0,
      leverage: 30.0,
      asset: 'XAU/USD',
      gold_price: 2720.0,
      contract_size: 100,
      profit_target_usd: 2000.0,
      daily_loss_usd: 2000.0,
      max_loss_usd: 4000.0
    }
  },
  config: {
    initial_balance: 92.08,
    risk_pct: 1.0,
    rr_ratio: 2.0,
    leverage: 500,
    asset: 'XAU/USD',
    gold_price: 2720.0,
    contract_size: 100,
    min_lot: 0.01,
    lot_step: 0.01
  },
  backtest: {
    summary: {},
    trades: [],
    equityCurve: [],
    filter: 'all'
  },
  real: {
    summary: {},
    trades: [],
    equityCurve: [],
    filter: 'all'
  },
  calculator: {
    balance: 50000.0,
    risk_pct: 0.5,
    sl_points: 100,
    rr: 2.0,
    leverage: 100,
    gold_price: 2720.0
  }
};

// Chart instances
let equityChart = null;
let distributionChart = null;
let drawdownChart = null;
let backtestEquityChart = null;
let backtestDistributionChart = null;
let backtestDrawdownChart = null;
let btSimpleEquityChartInstance = null;
let btSimpleDrawdownChartInstance = null;

// Initialize on DOM Loaded
document.addEventListener('DOMContentLoaded', async () => {
  startMarketClock();
  initIcons();

  setupTabNavigation();
  initCharts();
  setupEventListeners();
  setupPrecisionRadarEvents();
  setupCollapsibleSections();
  setupMacroGuideModalEvents();
  setupTradingViewWebhookEvents();

  // Cargar configuración y datos de Fondeo Orion Nova 50K
  await loadConfig();
  await loadFondeoTrades();
  setupFondeoTradeForm();
  setupFondeoActionButtons();
  setupNewsView();
  setupPremarketView();
  setCurrentDateTime();
  loadGoldBiasData();

  // Backtesting Simple (Interés Compuesto)
  await loadBacktestSimpleData();
  setupBacktestSimpleView();

  // Bitácora Real Tickmill (XAU/USD)
  await loadTrades('real');
  setupRealJournalView();
});

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setupCollapsibleSections() {
  document.querySelectorAll('.btn-collapse-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSel = btn.dataset.target;
      if (!targetSel) return;
      const targetEl = document.querySelector(targetSel);
      if (!targetEl) return;

      const isHidden = targetEl.classList.toggle('hidden');
      const label = btn.querySelector('.btn-collapse-label');
      if (label) {
        label.textContent = isHidden ? 'Expandir' : 'Contraer';
      }

      const icon = btn.querySelector('[data-lucide], svg');
      if (icon) {
        const newIcon = document.createElement('i');
        newIcon.setAttribute('data-lucide', isHidden ? 'chevron-down' : 'chevron-up');
        newIcon.className = 'w-3.5 h-3.5 text-gray-400 shrink-0';
        icon.replaceWith(newIcon);
        initIcons();
      }
    });
  });
}

function setCurrentDateTime(force = false) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  
  const realDateField = document.getElementById('realTradeDate');
  if (realDateField && (!realDateField.value || force)) {
    realDateField.value = formatted;
  }
  const backtestDateField = document.getElementById('tradeDate');
  if (backtestDateField && (!backtestDateField.value || force)) {
    backtestDateField.value = formatted;
  }
  const autoDisplay = document.getElementById('realTradeAutoDateDisplay');
  if (autoDisplay) {
    autoDisplay.textContent = formatted;
  }
}

function roundNum(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function formatRRText(val) {
  const num = parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return '1.0';
  if (Number.isInteger(num)) return num.toFixed(1);
  return num.toFixed(2).replace(/0$/, '');
}

function formatRiskPctText(val) {
  const num = parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return '5.00';
  if (Number.isInteger(num)) return num.toFixed(1);
  return num.toFixed(2).replace(/0$/, '');
}

// ----------------------------------------------------
function formatMoney(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ----------------------------------------------------
// TAB NAVIGATION: 1. Fondeo Orion 50K | 2. Bitácora Real (Tickmill) | 3. Pre-Mercado NY | 4. Noticias | 5. Reglas | 6. Backtest Simple
// ----------------------------------------------------
function setupTabNavigation() {
  const btnFondeo = document.getElementById('tabBtnFondeo');
  const btnReal = document.getElementById('tabBtnReal');
  const btnPremarket = document.getElementById('tabBtnPremarket');
  const btnNews = document.getElementById('tabBtnNews');
  const btnRules = document.getElementById('tabBtnRules');
  const btnBacktestSimple = document.getElementById('tabBtnBacktestSimple');

  const viewFondeo = document.getElementById('viewFondeo');
  const viewRealJournal = document.getElementById('viewRealJournal');
  const viewPremarket = document.getElementById('viewPremarket');
  const viewNews = document.getElementById('viewNews');
  const viewRules = document.getElementById('viewRules');
  const viewBacktestSimple = document.getElementById('viewBacktestSimple');

  function switchTab(tab) {
    appState.activeTab = tab;
    try {
      localStorage.setItem('activeTab_orion_v3', tab);
    } catch (e) {}

    const activeClasses = ['bg-amber-500', 'bg-sky-600', 'bg-rose-600', 'bg-emerald-600', 'bg-purple-600', 'text-black', 'text-white', 'shadow-lg', 'shadow-amber-500/30', 'shadow-sky-600/30', 'shadow-rose-600/30', 'shadow-emerald-600/30', 'shadow-purple-600/30', 'font-black', 'font-bold'];
    const inactiveClasses = ['text-gray-400', 'hover:text-white', 'hover:bg-gray-800/60', 'font-semibold'];

    [btnFondeo, btnReal, btnPremarket, btnNews, btnRules, btnBacktestSimple].forEach(btn => {
      if (btn) {
        btn.classList.remove(...activeClasses);
        btn.classList.add(...inactiveClasses);
      }
    });

    if (viewFondeo) viewFondeo.classList.add('hidden');
    if (viewRealJournal) viewRealJournal.classList.add('hidden');
    if (viewPremarket) viewPremarket.classList.add('hidden');
    if (viewNews) viewNews.classList.add('hidden');
    if (viewRules) viewRules.classList.add('hidden');
    if (viewBacktestSimple) viewBacktestSimple.classList.add('hidden');

    // Adaptive Top Bar Badges according to current Active Tab / Account
    const headerModeBadge = document.getElementById('topHeaderModeBadge');
    const headerSubtitle = document.getElementById('topHeaderSubtitle');
    const fondeoBadges = document.getElementById('topHeaderFondeoBadges');
    const realBadges = document.getElementById('topHeaderRealBadges');

    if (tab === 'real') {
      if (headerModeBadge) {
        headerModeBadge.innerHTML = '<i data-lucide="wallet" class="w-3 h-3 text-emerald-400"></i> Tickmill Real MT5 (1:500)';
        headerModeBadge.className = 'hidden sm:inline-flex text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold items-center gap-1 font-mono tracking-wide';
      }
      if (headerSubtitle) {
        headerSubtitle.textContent = 'Operativa Personal Real • Broker Tickmill (1:500) • Contrato 100 oz • Cálculo Dinámico';
      }
      if (fondeoBadges) {
        fondeoBadges.classList.remove('lg:flex');
        fondeoBadges.classList.add('hidden');
      }
      if (realBadges) {
        realBadges.classList.remove('hidden');
        realBadges.classList.add('lg:flex');
        const s = appState.real.summary || {};
        const bEl = document.getElementById('badgeTopRealBalance');
        if (bEl) bEl.textContent = `$${(s.current_balance !== undefined ? s.current_balance : 97.72).toFixed(2)}`;
      }
    } else {
      if (headerModeBadge) {
        headerModeBadge.innerHTML = '<i data-lucide="shield-check" class="w-3 h-3 text-amber-400"></i> Orion Nova 50K';
        headerModeBadge.className = 'hidden sm:inline-flex text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold items-center gap-1 font-mono tracking-wide';
      }
      if (headerSubtitle) {
        headerSubtitle.textContent = 'Centro de Mando Exclusivo XAU/USD (Oro) • Reglas Orion Funded • Operativa 100% Manual';
      }
      if (realBadges) {
        realBadges.classList.remove('lg:flex');
        realBadges.classList.add('hidden');
      }
      if (fondeoBadges) {
        fondeoBadges.classList.remove('hidden');
        fondeoBadges.classList.add('lg:flex');
      }
    }

    if (tab === 'fondeo') {
      if (btnFondeo) {
        btnFondeo.classList.remove(...inactiveClasses);
        btnFondeo.classList.add('bg-amber-500', 'text-black', 'shadow-lg', 'shadow-amber-500/30', 'font-black');
      }
      if (viewFondeo) viewFondeo.classList.remove('hidden');
      renderFondeoDashboard();
      setTimeout(() => {
        if (fondeoEquityChart) fondeoEquityChart.resize();
      }, 50);
    } else if (tab === 'real') {
      if (btnReal) {
        btnReal.classList.remove(...inactiveClasses);
        btnReal.classList.add('bg-emerald-600', 'text-white', 'shadow-lg', 'shadow-emerald-600/30', 'font-bold');
      }
      if (viewRealJournal) viewRealJournal.classList.remove('hidden');
      loadTrades('real').then(() => {
        renderRealJournalDashboard();
        if (typeof recalculateRealQuickLot === 'function') recalculateRealQuickLot();
      });
    } else if (tab === 'premarket') {
      if (btnPremarket) {
        btnPremarket.classList.remove(...inactiveClasses);
        btnPremarket.classList.add('bg-sky-600', 'text-white', 'shadow-lg', 'shadow-sky-600/30', 'font-bold');
      }
      if (viewPremarket) viewPremarket.classList.remove('hidden');
      renderPremarketView();
    } else if (tab === 'news') {
      if (btnNews) {
        btnNews.classList.remove(...inactiveClasses);
        btnNews.classList.add('bg-rose-600', 'text-white', 'shadow-lg', 'shadow-rose-600/30', 'font-bold');
      }
      if (viewNews) viewNews.classList.remove('hidden');
      renderNewsView();
    } else if (tab === 'rules') {
      if (btnRules) {
        btnRules.classList.remove(...inactiveClasses);
        btnRules.classList.add('bg-emerald-600', 'text-white', 'shadow-lg', 'shadow-emerald-600/30', 'font-bold');
      }
      if (viewRules) viewRules.classList.remove('hidden');
    } else if (tab === 'backtest') {
      if (btnBacktestSimple) {
        btnBacktestSimple.classList.remove(...inactiveClasses);
        btnBacktestSimple.classList.add('bg-emerald-600', 'text-white', 'shadow-lg', 'shadow-emerald-600/30', 'font-bold');
      }
      if (viewBacktestSimple) viewBacktestSimple.classList.remove('hidden');
      renderBacktestSimpleDashboard();
      setTimeout(() => {
        if (btSimpleEquityChartInstance) btSimpleEquityChartInstance.resize();
        if (btSimpleDrawdownChartInstance) btSimpleDrawdownChartInstance.resize();
      }, 50);
    }

    initIcons();
  }

  window.switchTabTo = switchTab;

  if (btnFondeo) btnFondeo.addEventListener('click', () => switchTab('fondeo'));
  if (btnReal) btnReal.addEventListener('click', () => switchTab('real'));
  if (btnPremarket) btnPremarket.addEventListener('click', () => switchTab('premarket'));
  if (btnNews) btnNews.addEventListener('click', () => switchTab('news'));
  if (btnRules) btnRules.addEventListener('click', () => switchTab('rules'));
  if (btnBacktestSimple) btnBacktestSimple.addEventListener('click', () => switchTab('backtest'));

  let savedTab = localStorage.getItem('activeTab_orion_v3');
  if (!savedTab || !['fondeo', 'real', 'premarket', 'news', 'rules', 'backtest'].includes(savedTab)) {
    savedTab = 'fondeo';
  }
  switchTab(savedTab);
}

// ====================================================
// ORION NOVA 50K EVALUATION & FONDEO MODULE
// ====================================================
let fondeoEquityChart = null;

async function loadFondeoTrades() {
  try {
    const cached = localStorage.getItem('cached_fondeo_trades');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0 && (!appState.fondeo.trades || appState.fondeo.trades.length === 0)) {
          appState.fondeo.trades = parsed;
        }
      } catch (e) {}
    }

    const res = await fetch('/api/trades?mode=fondeo');
    if (res.ok) {
      const data = await res.json();
      appState.fondeo.summary = data.summary || {};
      appState.fondeo.equityCurve = data.equity_curve || [];
      appState.fondeo.trades = data.trades || [];
      try {
        localStorage.setItem('cached_fondeo_trades', JSON.stringify(appState.fondeo.trades));
      } catch (e) {}
    }
  } catch (err) {
    console.warn('Error cargando trades de fondeo:', err);
  }
  renderFondeoDashboard();
}

function renderFondeoDashboard() {
  const summary = appState.fondeo.summary || {};
  const orion = summary.orion_metrics || {
    initial_balance: 50000.0,
    target_balance: 52000.0,
    profit_target_usd: 2000.0,
    remaining_target: 2000.0,
    target_progress_pct: 0.0,
    daily_loss_limit_usd: 2000.0,
    today_loss_usd: 0.0,
    daily_loss_headroom: 2000.0,
    daily_loss_breached: false,
    trailing_floor: 46000.0,
    max_loss_headroom: 4000.0,
    max_loss_breached: false,
    is_trailing_locked: false,
    best_day_profit: 0.0,
    best_day_pct: 0.0,
    best_day_compliant: true,
    eval_status: 'FASE 1: EN EVALUACIÓN'
  };

  const curBalance = summary.current_balance !== undefined ? summary.current_balance : 50000.0;
  const netPnl = summary.net_pnl !== undefined ? summary.net_pnl : (summary.net_profit !== undefined ? summary.net_profit : 0.0);
  const winRate = summary.win_rate !== undefined ? summary.win_rate : 0.0;
  const pf = summary.profit_factor !== undefined ? summary.profit_factor : 0.0;
  const wins = summary.wins !== undefined ? summary.wins : 0;
  const losses = summary.losses !== undefined ? summary.losses : 0;
  const totalTrades = summary.total_trades !== undefined ? summary.total_trades : (appState.fondeo.trades ? appState.fondeo.trades.length : 0);

  // Quick header badges
  const badgeBal = document.getElementById('badgeFondeoBalance');
  if (badgeBal) badgeBal.textContent = formatMoney(curBalance);
  const badgeFloor = document.getElementById('badgeFondeoFloor');
  if (badgeFloor) badgeFloor.textContent = `$${formatMoney(orion.trailing_floor)}`;

  // Status Badge
  const elStatus = document.getElementById('badgeOrionEvalStatus');
  if (elStatus) {
    elStatus.textContent = orion.eval_status || 'FASE 1: EN EVALUACIÓN';
    if (orion.eval_status && orion.eval_status.includes('APROBADO')) {
      elStatus.className = 'px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-bold text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-emerald-500/20';
    } else if (orion.eval_status && (orion.eval_status.includes('FALLADA') || orion.eval_status.includes('VIOLADO'))) {
      elStatus.className = 'px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/40 rounded-full font-bold text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-red-500/20';
    } else {
      elStatus.className = 'px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-bold text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-amber-500/20';
    }
  }

  // 1. Balance & Target
  const elCurBal = document.getElementById('fondeoCurrentBalance');
  if (elCurBal) elCurBal.textContent = `$${formatMoney(curBalance)}`;
  const elTargetPct = document.getElementById('fondeoTargetPctBadge');
  if (elTargetPct) elTargetPct.textContent = `${(orion.target_progress_pct || 0).toFixed(1)}% Alcanzado`;
  const elRemTarget = document.getElementById('fondeoRemainingTarget');
  if (elRemTarget) {
    if (orion.remaining_target <= 0) {
      elRemTarget.textContent = '¡Meta $2,000 alcanzada!';
      elRemTarget.className = 'text-xs text-emerald-400 font-bold';
    } else {
      elRemTarget.textContent = `Faltan $${formatMoney(orion.remaining_target)} para $52,000`;
      elRemTarget.className = 'text-xs text-gray-400';
    }
  }
  const elBarTarget = document.getElementById('fondeoTargetProgressBar');
  if (elBarTarget) {
    const w = Math.min(100, Math.max(0, orion.target_progress_pct || 0));
    elBarTarget.style.width = `${w}%`;
  }

  // 2. Pérdida Diaria (Daily Loss Limit $2,000)
  const elDailyBadge = document.getElementById('fondeoDailyLossStatusBadge');
  const elDailyHeadroom = document.getElementById('fondeoDailyHeadroom');
  const elTodayLoss = document.getElementById('fondeoTodayLoss');
  const elDailyBar = document.getElementById('fondeoDailyHealthBar');

  if (elDailyHeadroom) elDailyHeadroom.textContent = `$${formatMoney(orion.daily_loss_headroom || 2000.0)}`;
  if (elTodayLoss) elTodayLoss.textContent = `Pérdida hoy: $${formatMoney(orion.today_loss_usd || 0.0)}`;
  
  const dailyHealthPct = Math.min(100, Math.max(0, ((orion.daily_loss_headroom || 2000.0) / 2000.0) * 100));
  if (elDailyBar) elDailyBar.style.width = `${dailyHealthPct}%`;

  if (elDailyBadge) {
    if (orion.daily_loss_breached) {
      elDailyBadge.textContent = 'LÍMITE VIOLADO';
      elDailyBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800';
    } else if (orion.daily_loss_headroom < 500) {
      elDailyBadge.textContent = '¡PRECAUCIÓN!';
      elDailyBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800';
    } else {
      elDailyBadge.textContent = 'SALUDABLE';
      elDailyBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800';
    }
  }

  // 3. Drawdown Máximo (Piso Trailing-Lock $46k -> $50k)
  const elFloor = document.getElementById('fondeoTrailingFloor');
  if (elFloor) elFloor.textContent = `$${formatMoney(orion.trailing_floor || 46000.0)}`;
  const elMaxDdHeadroom = document.getElementById('fondeoMaxDdHeadroom');
  if (elMaxDdHeadroom) elMaxDdHeadroom.textContent = `Colchón de seguridad: $${formatMoney(orion.max_loss_headroom || 4000.0)}`;
  const elLockBadge = document.getElementById('fondeoTrailingLockBadge');
  if (elLockBadge) {
    if (orion.is_trailing_locked) {
      elLockBadge.textContent = 'BLOQUEADO A $50,000';
      elLockBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800';
    } else {
      elLockBadge.textContent = 'TRAILING DINÁMICO';
      elLockBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800';
    }
  }

  // 4. Margen Disponible (1:100 Forex)
  const elFreeMargin = document.getElementById('fondeoFreeMargin');
  if (elFreeMargin) elFreeMargin.textContent = `$${formatMoney(curBalance)}`;

  // 5. Regla 20% Mejor Día
  const elBestDayBadge = document.getElementById('fondeoBestDayBadge');
  const elBestDayPct = document.getElementById('fondeoBestDayPct');
  const elBestDayProfit = document.getElementById('fondeoBestDayProfit');
  if (elBestDayPct) elBestDayPct.textContent = `${(orion.best_day_pct || 0).toFixed(1)}% / 20.0%`;
  if (elBestDayProfit) elBestDayProfit.textContent = `Mejor día: $${formatMoney(orion.best_day_profit || 0.0)}`;
  if (elBestDayBadge) {
    if (orion.best_day_compliant) {
      elBestDayBadge.textContent = 'CONFORME (≤ 20%)';
      elBestDayBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800';
    } else {
      elBestDayBadge.textContent = 'ADVERTENCIA (> 20%)';
      elBestDayBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800';
    }
  }

  // 6. Rendimiento y Estadísticas
  const elTradesBadge = document.getElementById('fondeoTotalTradesBadge');
  if (elTradesBadge) elTradesBadge.textContent = `${totalTrades} Trades`;
  const elWinRate = document.getElementById('fondeoWinRate');
  if (elWinRate) elWinRate.textContent = `${winRate.toFixed(1)}%`;
  const elPf = document.getElementById('fondeoProfitFactor');
  if (elPf) elPf.textContent = pf.toFixed(2);
  const elWlRatio = document.getElementById('fondeoWinLossRatio');
  if (elWlRatio) elWlRatio.textContent = `${wins}W / ${losses}L`;
  const elNetPnl = document.getElementById('fondeoNetPnL');
  if (elNetPnl) {
    const sign = netPnl >= 0 ? '+' : '';
    elNetPnl.textContent = `${sign}$${formatMoney(netPnl)}`;
    elNetPnl.className = `text-lg font-black font-mono ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
  }

  renderFondeoTradesTable();
  updateFondeoEquityChart();
}

function getAssetBadge(asset) {
  const a = (asset || 'XAU/USD').toUpperCase();
  if (a.includes('AUD')) {
    return '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 whitespace-nowrap">🔵 AUD/USD</span>';
  }
  if (a.includes('CAD') || a.includes('EUR/CAD') || a.includes('EURCAD')) {
    return '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 whitespace-nowrap">🟣 EUR/CAD</span>';
  }
  return '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">🟡 XAU/USD</span>';
}

function anyStringIncludes(str, arr) {
  if (!str) return false;
  const upper = String(str).toUpperCase();
  return arr.some(a => upper.includes(a));
}

function renderFondeoTradesTable() {
  const tbody = document.getElementById('fondeoTradesTableBody');
  if (!tbody) return;

  const trades = appState.fondeo.trades || [];
  if (trades.length === 0) {
    tbody.innerHTML = `
      <tr class="border-b border-gray-800 text-center">
        <td colspan="14" class="py-10 text-gray-500 font-medium">
          <i data-lucide="award" class="w-8 h-8 mx-auto mb-2 text-gray-600 opacity-50"></i>
          <p>Sin operaciones registradas en Orion Nova 50K aún.</p>
          <p class="text-xs text-gray-600 mt-1">Usa el formulario superior para registrar tus operaciones con precios de Entrada, Salida, SL y TP.</p>
        </td>
      </tr>
    `;
    initIcons();
    return;
  }

  const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = sorted.map((t, idx) => {
    const isWin = (t.status || '').toLowerCase() === 'win';
    const isLoss = (t.status || '').toLowerCase() === 'loss';
    const statusBadge = isWin
      ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">WIN</span>'
      : isLoss
      ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950 text-red-400 border border-red-800">LOSS</span>'
      : '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-800 text-gray-300 border border-gray-700">BE</span>';

    const dirBadge = (t.direction || 'BUY').toUpperCase() === 'BUY'
      ? '<span class="text-emerald-400 font-bold flex items-center gap-0.5">🟢 BUY</span>'
      : '<span class="text-red-400 font-bold flex items-center gap-0.5">🔴 SELL</span>';

    const pnl = t.pnl !== undefined ? Number(t.pnl) : 0;
    const pnlClass = pnl > 0 ? 'text-emerald-400 font-bold font-mono' : pnl < 0 ? 'text-red-400 font-bold font-mono' : 'text-gray-400 font-mono';
    const pnlSign = pnl > 0 ? '+' : '';

    const assetBadge = getAssetBadge(t.asset);
    const isGold = anyStringIncludes(t.asset || 'XAU/USD', ['XAU', 'GOLD', 'ORO']);
    const dec = isGold ? 2 : 4;

    // Prices: Entry ➔ Exit
    let priceFlow = '<span class="text-gray-600">-</span>';
    if (t.entry_price != null && t.exit_price != null) {
      priceFlow = `<span class="font-mono text-gray-200 font-semibold">${Number(t.entry_price).toFixed(dec)}</span> <span class="text-gray-500 font-bold">➔</span> <span class="font-mono ${pnlClass}">${Number(t.exit_price).toFixed(dec)}</span>`;
    } else if (t.entry_price != null) {
      priceFlow = `<span class="font-mono text-gray-200">${Number(t.entry_price).toFixed(dec)}</span>`;
    }

    // SL / TP
    let slTpDisplay = '<span class="text-gray-600">-</span>';
    if (t.sl_price != null || t.tp_price != null) {
      const slTxt = t.sl_price != null ? `<span class="text-rose-400 font-mono">${Number(t.sl_price).toFixed(dec)}</span>` : '-';
      const tpTxt = t.tp_price != null ? `<span class="text-emerald-400 font-mono">${Number(t.tp_price).toFixed(dec)}</span>` : '-';
      slTpDisplay = `${slTxt} <span class="text-gray-600">/</span> ${tpTxt}`;
    } else if (t.sl_pips) {
      slTpDisplay = `<span class="font-mono text-gray-400">${t.sl_pips} ${isGold ? 'pts' : 'pips'}</span>`;
    }

    // Points / Pips
    let ptsDisplay = '<span class="text-gray-600">-</span>';
    if (isGold) {
      if (t.points != null) {
        const ptSign = t.points > 0 ? '+' : '';
        const ptColor = t.points > 0 ? 'text-emerald-400' : (t.points < 0 ? 'text-rose-400' : 'text-gray-400');
        ptsDisplay = `<span class="font-mono font-bold ${ptColor}">${ptSign}${t.points} pts</span>`;
      } else if (t.sl_points || t.sl_pips) {
        ptsDisplay = `<span class="font-mono text-gray-400">${t.sl_points || t.sl_pips} pts</span>`;
      }
    } else {
      const pipsVal = t.pips != null ? t.pips : (t.sl_pips || 25);
      const pipSign = pipsVal > 0 ? '+' : '';
      const pipColor = pipsVal > 0 ? 'text-emerald-400' : (pipsVal < 0 ? 'text-rose-400' : 'text-gray-400');
      ptsDisplay = `<span class="font-mono font-bold ${pipColor}">${pipSign}${pipsVal} pips</span>`;
    }

    // Return %
    const retPct = t.ret_pct !== undefined ? Number(t.ret_pct) : 0;
    const retSign = retPct > 0 ? '+' : '';
    const retColor = retPct > 0 ? 'text-emerald-400' : (retPct < 0 ? 'text-rose-400' : 'text-gray-400');
    const retDisplay = `<span class="font-mono font-bold ${retColor}">${retSign}${retPct.toFixed(2)}%</span>`;

    const isManualBadge = t.is_manual_rr 
      ? '<span class="text-[9px] px-1 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-mono font-bold" title="R:R ajustado manualmente">M</span>' 
      : '';
    const rrFormatted = t.rr != null ? `1:${Number(t.rr).toFixed(2)}` : '1:3.00';
    const rrDisplay = `
      <div class="flex items-center gap-1.5">
        <span class="font-mono font-bold text-blue-300">${rrFormatted}</span>
        ${isManualBadge}
        <button onclick="handleQuickEditRr('${t.id}')" class="p-1 text-gray-500 hover:text-amber-400 rounded hover:bg-gray-800 transition cursor-pointer" title="Modificar R:R obtenido">
          <i data-lucide="edit-3" class="w-3 h-3"></i>
        </button>
      </div>
    `;

    const chartBtn = (t.tv_url || t.tv_chart_url)
      ? `<a href="${t.tv_url || t.tv_chart_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/70 hover:bg-blue-900 border border-blue-800/80 text-blue-300 text-[10px] font-medium transition" title="Ver captura en TradingView">
           <i data-lucide="external-link" class="w-3 h-3"></i>
         </a>`
      : '';

    return `
      <tr class="border-b border-gray-800/80 hover:bg-gray-800/40 transition">
        <td class="py-2.5 px-3 text-xs text-gray-500 font-mono">${trades.length - idx}</td>
        <td class="py-2.5 px-3 text-xs text-gray-400 font-mono whitespace-nowrap">${t.date || '-'}</td>
        <td class="py-2.5 px-3 text-xs whitespace-nowrap"><div class="flex items-center gap-1.5">${assetBadge} ${dirBadge}</div></td>
        <td class="py-2.5 px-3 text-xs whitespace-nowrap">${priceFlow}</td>
        <td class="py-2.5 px-3 text-xs whitespace-nowrap">${slTpDisplay}</td>
        <td class="py-2.5 px-3 text-xs font-mono font-bold text-amber-300">${(t.lot_size || t.suggested_lot || 0.01).toFixed(2)}</td>
        <td class="py-2.5 px-3 text-xs whitespace-nowrap">${ptsDisplay}</td>
        <td class="py-2.5 px-3 text-xs font-mono text-blue-300">${rrDisplay}</td>
        <td class="py-2.5 px-3 text-xs">${statusBadge}</td>
        <td class="py-2.5 px-3 text-xs ${pnlClass}">${pnlSign}$${formatMoney(pnl)}</td>
        <td class="py-2.5 px-3 text-xs whitespace-nowrap">${retDisplay}</td>
        <td class="py-2.5 px-3 text-xs font-mono font-bold text-white whitespace-nowrap">$${formatMoney(t.balance_after || 50000)}</td>
        <td class="py-2.5 px-3 text-xs text-gray-400">${t.session || 'New York'}</td>
        <td class="py-2.5 px-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1">
            ${chartBtn}
            <button onclick="handleOpenEditModal('${t.id}', 'fondeo')" class="p-1.5 text-gray-500 hover:text-amber-400 rounded hover:bg-amber-950/40 transition cursor-pointer" title="Editar Operación">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="handleDeleteTrade('${t.id}', 'fondeo')" class="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-red-950/40 transition cursor-pointer" title="Eliminar Trade">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  initIcons();
}

function updateFondeoEquityChart() {
  const canvas = document.getElementById('fondeoEquityChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const curve = appState.fondeo.equityCurve || [];
  const initial = 50000.0;
  const target = 52000.0;
  const summary = appState.fondeo.summary || {};
  const orion = summary.orion_metrics || {};
  const floor = orion.trailing_floor || 46000.0;

  let labels = ['Inicio'];
  let balances = [initial];
  let targets = [target];
  let floors = [floor];

  if (curve.length > 0) {
    labels = curve.map(c => c.trade_num === 0 ? 'Inicio' : `T#${c.trade_num}`);
    balances = curve.map(c => c.balance);
    targets = curve.map(() => target);
    floors = curve.map(() => floor);
  }

  if (!fondeoEquityChart) {
    const ctx = canvas.getContext('2d');
    fondeoEquityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Balance ($ USD)',
            data: balances,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            borderWidth: 2.5,
            tension: 0.2,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#f59e0b'
          },
          {
            label: 'Meta Aprobación ($52,000)',
            data: targets,
            borderColor: '#3b82f6',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Piso Trailing Drawdown ($46,000)',
            data: floors,
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#9ca3af', font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: '#374151',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(55, 65, 81, 0.3)' },
            ticks: { color: '#9ca3af', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(55, 65, 81, 0.3)' },
            ticks: {
              color: '#9ca3af',
              font: { size: 10 },
              callback: (v) => `$${v.toLocaleString('en-US')}`
            }
          }
        }
      }
    });
  } else {
    fondeoEquityChart.data.labels = labels;
    fondeoEquityChart.data.datasets[0].data = balances;
    fondeoEquityChart.data.datasets[1].data = targets;
    fondeoEquityChart.data.datasets[2].data = floors;
    fondeoEquityChart.update();
  }
}

let selectedFondeoRr = 3.0;

function setupFondeoCalculator() {
  const assetSelect = document.getElementById('fondeoCalcAsset');
  const slInput = document.getElementById('fondeoCalcSlPips');
  const riskSelect = document.getElementById('fondeoCalcRiskPct');
  const manualRiskGroup = document.getElementById('fondeoCalcManualRiskGroup');
  const manualRiskInput = document.getElementById('fondeoCalcManualUsd');
  const rrButtons = document.querySelectorAll('#fondeoRrButtons button');
  const btnApply = document.getElementById('btnApplyCalcToForm');

  function calculateFondeoMetrics() {
    const summary = appState.fondeo.summary || {};
    const curBalance = summary.current_balance !== undefined ? summary.current_balance : 50000.0;
    const asset = assetSelect ? assetSelect.value : 'XAU/USD';
    const isGold = asset.includes('XAU') || asset.includes('GOLD') || asset.includes('ORO') || true;

    const slInputVal = parseFloat(slInput ? slInput.value : 30.0) || 30.0;
    const riskType = riskSelect ? riskSelect.value : '0.5';

    let dollarRisk = 250.0;
    let riskPct = 0.5;

    if (riskType === 'manual') {
      if (manualRiskGroup) manualRiskGroup.classList.remove('hidden');
      dollarRisk = parseFloat(manualRiskInput ? manualRiskInput.value : 250.0) || 250.0;
      riskPct = curBalance > 0 ? (dollarRisk / curBalance) * 100 : 0.5;
    } else {
      if (manualRiskGroup) manualRiskGroup.classList.add('hidden');
      riskPct = parseFloat(riskType) || 0.5;
      dollarRisk = curBalance * (riskPct / 100.0);
    }

    // Normalización de SL para Oro (XAU/USD):
    // <= 15.0: dólares de precio ($3.00)
    // 15 - 150: pips (30 pips = $3.00)
    // > 150: puntos (300 pts = $3.00)
    let slPriceDist = 3.0;
    if (slInputVal <= 15.0) {
      slPriceDist = slInputVal;
    } else if (slInputVal <= 150.0) {
      slPriceDist = slInputVal / 10.0;
    } else {
      slPriceDist = slInputVal / 100.0;
    }

    const lossPerLot = slPriceDist * 100.0; // 1 lote estándar = 100 oz de oro
    let lot = lossPerLot > 0 ? dollarRisk / lossPerLot : 0.01;
    lot = Math.max(0.01, Math.round(lot * 100) / 100);

    // Apalancamiento 1:30 para Oro en Orion Funded
    const goldPrice = 2720.0;
    const margin = (goldPrice * 100.0 * lot) / 30.0;
    const pipVal = 10.0 * lot; // $10 por pip (0.10) por lote

    const reward = dollarRisk * selectedFondeoRr;
    const marginPct = curBalance > 0 ? (margin / curBalance) * 100 : 0;

    const elLot = document.getElementById('fondeoCalcLot');
    if (elLot) elLot.textContent = lot.toFixed(2);
    const elRisk = document.getElementById('fondeoCalcDollarRisk');
    if (elRisk) elRisk.textContent = `$${formatMoney(dollarRisk)}`;
    const elMargin = document.getElementById('fondeoCalcMargin');
    if (elMargin) elMargin.textContent = `$${formatMoney(margin)}`;
    const elReward = document.getElementById('fondeoCalcReward');
    if (elReward) elReward.textContent = `+$${formatMoney(reward)}`;
    const elPipVal = document.getElementById('fondeoCalcPipVal');
    if (elPipVal) elPipVal.textContent = `$${formatMoney(pipVal)}/pip`;
    const elMarginPct = document.getElementById('fondeoCalcMarginPct');
    if (elMarginPct) elMarginPct.textContent = `${marginPct.toFixed(1)}% (1:30)`;

    const orion = summary.orion_metrics || {};
    const dailyHeadroom = orion.daily_loss_headroom !== undefined ? orion.daily_loss_headroom : 2000.0;
    const banner = document.getElementById('fondeoSafetyBanner');
    const bannerText = document.getElementById('fondeoSafetyBannerText');

    if (banner && bannerText) {
      if (dollarRisk > dailyHeadroom) {
        banner.className = 'p-3 rounded-xl border flex items-start gap-2 bg-red-950/40 border-red-800/80 text-red-300';
        bannerText.innerHTML = `⚠️ <b>¡ALERTA DE RIESGO EN ORO!</b> Esta operación arriesga <b>$${formatMoney(dollarRisk)}</b>, superando tu colchón diario disponible de <b>$${formatMoney(dailyHeadroom)}</b>. Podrías violar la regla de pérdida diaria del 4% ($2,000)!`;
      } else if (margin > curBalance * 0.40) {
        banner.className = 'p-3 rounded-xl border flex items-start gap-2 bg-amber-950/40 border-amber-800/80 text-amber-300';
        bannerText.innerHTML = `⚠️ <b>PRECAUCIÓN DE MARGEN (1:30):</b> Este lote en Oro retiene <b>$${formatMoney(margin)} (${marginPct.toFixed(1)}%)</b>. Mantén suficiente margen libre para soportar fluctuaciones.`;
      } else {
        const lossesUntilBreach = Math.floor(dailyHeadroom / dollarRisk);
        banner.className = 'p-3 rounded-xl border flex items-start gap-2 bg-emerald-950/40 border-emerald-800/80 text-emerald-300';
        bannerText.innerHTML = `🛡️ <b>Operación Segura en Oro:</b> Arriesgas <b>${riskPct.toFixed(2)}% ($${formatMoney(dollarRisk)})</b> con SL de <b>$${slPriceDist.toFixed(2)}</b>. Soportas <b>${lossesUntilBreach} pérdidas seguidas</b> hoy sin violar el 4% diario ($2,000). Margen retenido: <b>$${formatMoney(margin)} (${marginPct.toFixed(1)}%)</b>.`;
      }
    }
  }

  if (assetSelect) assetSelect.addEventListener('change', calculateFondeoMetrics);
  if (slInput) slInput.addEventListener('input', calculateFondeoMetrics);
  if (riskSelect) riskSelect.addEventListener('change', calculateFondeoMetrics);
  if (manualRiskInput) manualRiskInput.addEventListener('input', calculateFondeoMetrics);

  // Quick preset buttons for Gold SL ($2, $3, $5, $8)
  document.querySelectorAll('.btn-sl-gold-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pips = btn.dataset.pips || '30';
      if (slInput) {
        slInput.value = pips;
        calculateFondeoMetrics();
      }
    });
  });

  rrButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      rrButtons.forEach(b => {
        b.classList.remove('bg-amber-500', 'text-black', 'font-black');
        b.classList.add('bg-gray-800', 'text-gray-300');
      });
      btn.classList.remove('bg-gray-800', 'text-gray-300');
      btn.classList.add('bg-amber-500', 'text-black', 'font-black');
      selectedFondeoRr = parseFloat(btn.dataset.rr || 2.0);
      calculateFondeoMetrics();
    });
  });

  if (btnApply) {
    btnApply.addEventListener('click', () => {
      const asset = assetSelect ? assetSelect.value : 'XAU/USD';
      const lot = document.getElementById('fondeoCalcLot') ? document.getElementById('fondeoCalcLot').textContent : '0.83';
      const sl = slInput ? slInput.value : '30';

      const formAsset = document.getElementById('fondeoFormAsset');
      const formLot = document.getElementById('fondeoFormLot');
      const formSl = document.getElementById('fondeoFormSlPips');
      const formRr = document.getElementById('fondeoFormRr');

      if (formAsset) formAsset.value = asset;
      if (formLot) formLot.value = lot;
      if (formSl) formSl.value = sl;
      if (formRr) formRr.value = selectedFondeoRr;

      const form = document.getElementById('formFondeoTrade');
      if (form) form.scrollIntoView({ behavior: 'smooth' });
    });
  }

  calculateFondeoMetrics();
}

function calculateTradePrices({
  asset = 'XAU/USD',
  direction = 'BUY',
  lot = 0.83,
  entry = null,
  sl = null,
  tp = null,
  exit = null,
  commission = 0.0,
  balance = 50000.0
}) {
  const isGold = anyStringIncludes(asset, ['XAU', 'GOLD', 'ORO']);
  const isAudUsd = anyStringIncludes(asset, ['AUD']);
  const isEurCad = anyStringIncludes(asset, ['CAD', 'EURCAD']);
  const dir = (direction || 'BUY').toUpperCase();
  let mult = 100.0;
  let pointMult = 100.0;
  let pipMult = 10.0;
  if (isGold) {
    mult = 100.0;
    pointMult = 100.0;
    pipMult = 10.0;
  } else if (isAudUsd) {
    mult = 100000.0; // 0.0001 * 100000 = $10.00 / pip
    pointMult = 100000.0;
    pipMult = 10000.0;
  } else {
    mult = 100000.0 / 1.39; // 0.0001 * 100000 / 1.39 ~= $7.20 / pip
    pointMult = 100000.0;
    pipMult = 10000.0;
  }

  let slDist = null;
  let slPoints = null;
  let slPips = null;
  let riskUsd = null;
  let riskPct = null;

  if (entry != null && sl != null && !isNaN(entry) && !isNaN(sl) && entry > 0 && sl > 0) {
    slDist = Math.abs(entry - sl);
    slPoints = Math.round(slDist * pointMult);
    slPips = Number((slDist * pipMult).toFixed(1));
    riskUsd = Number((lot * mult * slDist).toFixed(2));
    if (balance > 0) {
      riskPct = Number(((riskUsd / balance) * 100).toFixed(2));
    }
  }

  let tpDist = null;
  let tpPoints = null;
  let tpPips = null;
  let projectedRr = null;
  let projectedRewardUsd = null;

  if (entry != null && tp != null && !isNaN(entry) && !isNaN(tp) && entry > 0 && tp > 0) {
    tpDist = Math.abs(tp - entry);
    tpPoints = Math.round(tpDist * pointMult);
    tpPips = Number((tpDist * pipMult).toFixed(1));
    projectedRewardUsd = Number((lot * mult * tpDist).toFixed(2));
    if (slDist && slDist > 0) {
      projectedRr = Number((tpDist / slDist).toFixed(2));
    }
  }

  let exitDiff = null;
  let points = null;
  let pips = null;
  let grossPnl = null;
  let netPnl = null;
  let realizedRr = null;
  let retPct = null;
  let status = 'win';

  if (entry != null && exit != null && !isNaN(entry) && !isNaN(exit) && entry > 0 && exit > 0) {
    exitDiff = dir === 'BUY' ? (exit - entry) : (entry - exit);
    points = Math.round(exitDiff * pointMult);
    pips = Number((exitDiff * pipMult).toFixed(1));
    grossPnl = Number((lot * mult * exitDiff).toFixed(2));
    netPnl = Number((grossPnl - Math.abs(commission)).toFixed(2));
    
    if (slDist && slDist > 0) {
      realizedRr = Number((Math.abs(exitDiff) / slDist).toFixed(2));
    }
    if (balance > 0) {
      retPct = Number(((netPnl / balance) * 100).toFixed(2));
    }
    
    if (netPnl > 0.05) {
      status = 'win';
    } else if (netPnl < -0.05) {
      status = 'loss';
    } else {
      status = 'be';
    }
  }

  return {
    isGold,
    slDist,
    slPoints,
    slPips,
    riskUsd,
    riskPct,
    tpDist,
    tpPoints,
    tpPips,
    projectedRr,
    projectedRewardUsd,
    exitDiff,
    points,
    pips,
    grossPnl,
    netPnl,
    realizedRr,
    retPct,
    status
  };
}

function setupFondeoTradeForm() {
  const form = document.getElementById('formFondeoTrade');
  if (!form) return;

  const entryEl = document.getElementById('fondeoFormEntry');
  const slEl = document.getElementById('fondeoFormSl');
  const tpEl = document.getElementById('fondeoFormTp');
  const exitEl = document.getElementById('fondeoFormExit');
  const lotEl = document.getElementById('fondeoFormLot');
  const dirEl = document.getElementById('fondeoFormDirection');
  const assetEl = document.getElementById('fondeoFormAsset');
  const dateEl = document.getElementById('fondeoFormDate');
  const riskPctEl = document.getElementById('fondeoFormRiskPct');
  const manualRiskGroup = document.getElementById('fondeoManualRiskGroup');
  const manualUsdInp = document.getElementById('fondeoManualUsdInput');

  const pnlEl = document.getElementById('fondeoFormPnl');
  const rrEl = document.getElementById('fondeoFormRr');
  const badgeRrMode = document.getElementById('badgeRrMode');
  const btnResetRrAuto = document.getElementById('btnResetRrAuto');
  const isManualRrEl = document.getElementById('fondeoFormIsManualRr');
  const slPipsEl = document.getElementById('fondeoFormSlPips');
  const statusEl = document.getElementById('fondeoFormStatus');

  const slBadge = document.getElementById('fondeoFormSlPtsBadge');
  const tpBadge = document.getElementById('fondeoFormTpPtsBadge');
  const ptsDisp = document.getElementById('fondeoCalcPointsDisplay');
  const rrDisp = document.getElementById('fondeoCalcRrDisplay');
  const statusDisp = document.getElementById('fondeoCalcStatusDisplay');
  const pnlDisp = document.getElementById('fondeoCalcPnlDisplay');
  const pctDisp = document.getElementById('fondeoCalcPctDisplay');

  const marginDisp = document.getElementById('fondeoFormMarginDisplay');
  const riskUsdDisp = document.getElementById('fondeoFormRiskUsdDisplay');
  const safetyText = document.getElementById('fondeoFormSafetyText');
  const safetyBanner = document.getElementById('fondeoFormSafetyBanner');
  const autoLotHint = document.getElementById('badgeAutoLotHint');

  const btnTp = document.getElementById('btnFondeoExitTp');
  const btnSl = document.getElementById('btnFondeoExitSl');
  const btnBe = document.getElementById('btnFondeoExitBe');

  if (dateEl && !dateEl.value) {
    const d = new Date();
    dateEl.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function updateFondeoCalculation() {
    const curBal = (appState.fondeo?.summary?.current_balance !== undefined) 
      ? Number(appState.fondeo.summary.current_balance) 
      : 50000.0;

    const riskChoice = riskPctEl ? riskPctEl.value : '0.5';
    let riskPct = 0.50;
    let dollarRisk = 250.00;

    if (riskChoice === 'manual') {
      if (manualRiskGroup) manualRiskGroup.classList.remove('hidden');
      dollarRisk = parseFloat(manualUsdInp?.value) || 250.0;
      riskPct = (dollarRisk / curBal) * 100.0;
    } else {
      if (manualRiskGroup) manualRiskGroup.classList.add('hidden');
      riskPct = parseFloat(riskChoice) || 0.50;
      dollarRisk = curBal * (riskPct / 100.0);
    }

    const entry = parseFloat(entryEl?.value);
    const dir = dirEl?.value || 'BUY';
    const asset = assetEl?.value || 'XAU/USD';
    const isGold = anyStringIncludes(asset, ['XAU', 'GOLD', 'ORO']);
    const isAudUsd = asset.includes('AUD');
    const isEurCad = asset.includes('CAD');

    // Adaptar etiquetas y badges según símbolo
    const levBadge = document.getElementById('fondeoAssetLevBadge');
    const slLabel = document.getElementById('fondeoSlPointsLabel');
    const slSuffix = document.getElementById('fondeoSlPointsSuffix');
    const dynamicFormula = document.getElementById('fondeoDynamicFormulaText');

    if (levBadge) levBadge.textContent = isGold ? '1:30 Oro' : '1:100 Forex';
    if (slLabel) slLabel.textContent = isGold ? 'Stop Loss en Puntos (Oro XAU/USD)' : `Stop Loss en Pips (${isAudUsd ? 'AUD/USD' : 'EUR/CAD'})`;
    if (slSuffix) slSuffix.textContent = isGold ? 'PTS' : 'PIPS';

    // Auto-completar SL y TP de acuerdo al símbolo y SL seleccionado
    const slPointsEl = document.getElementById('fondeoFormSlPoints');
    const slValCustom = parseFloat(slPointsEl?.value) || (isGold ? 300 : 25);
    const rrVal = parseFloat(rrEl?.value) || 3.0;

    let slDollarDist = 3.0;
    let tpDollarDist = 9.0;
    let lossPerLot = 300.0;
    let formulaHtml = '';

    if (isGold) {
      slDollarDist = slValCustom / 100.0;
      tpDollarDist = slDollarDist * rrVal;
      lossPerLot = slValCustom * 1.0;
      const slDistEl = document.getElementById('fondeoSlDollarDist');
      if (slDistEl) slDistEl.textContent = `=$${slDollarDist.toFixed(2)} en Oro`;
      formulaHtml = `Cálculo dinámico: <code>Lote = Riesgo $ / (Puntos × $1)</code>`;
    } else if (isAudUsd) {
      slDollarDist = slValCustom * 0.0001;
      tpDollarDist = slDollarDist * rrVal;
      lossPerLot = slValCustom * 10.0;
      const slDistEl = document.getElementById('fondeoSlDollarDist');
      if (slDistEl) slDistEl.textContent = `=$10.00/pip por lote`;
      formulaHtml = `Cálculo dinámico: <code>Lote = Riesgo $ / (Pips × $10)</code>`;
    } else {
      slDollarDist = slValCustom * 0.0001;
      tpDollarDist = slDollarDist * rrVal;
      lossPerLot = slValCustom * 7.20;
      const slDistEl = document.getElementById('fondeoSlDollarDist');
      if (slDistEl) slDistEl.textContent = `≈$7.20/pip por lote`;
      formulaHtml = `Cálculo dinámico: <code>Lote = Riesgo $ / (Pips × $7.20)</code>`;
    }

    if (dynamicFormula) dynamicFormula.innerHTML = formulaHtml;

    if (!isNaN(entry) && entry > 0) {
      const dec = isGold ? 2 : 4;
      if (slEl && (!slEl.dataset.userEdited || !slEl.value)) {
        const autoSl = dir === 'BUY' ? roundNum(entry - slDollarDist, dec) : roundNum(entry + slDollarDist, dec);
        slEl.value = autoSl.toFixed(dec);
      }
      if (tpEl && (!tpEl.dataset.userEdited || !tpEl.value)) {
        const autoTp = dir === 'BUY' ? roundNum(entry + tpDollarDist, dec) : roundNum(entry - tpDollarDist, dec);
        tpEl.value = autoTp.toFixed(dec);
      }
    }

    const sl = parseFloat(slEl?.value);
    const tp = parseFloat(tpEl?.value);
    const exit = parseFloat(exitEl?.value);

    // Cálculo dinámico de lotaje basado en la unidad del símbolo
    const autoLot = Math.max(0.01, roundNum(dollarRisk / lossPerLot, 2));
    const formulaPrevEl = document.getElementById('fondeoLotFormulaPreview');
    if (formulaPrevEl) {
      if (isGold) {
        formulaPrevEl.textContent = `$${dollarRisk.toFixed(0)} / ${slValCustom} pts = ${autoLot.toFixed(2)} lotes`;
      } else if (isAudUsd) {
        formulaPrevEl.textContent = `$${dollarRisk.toFixed(0)} / (${slValCustom} pips × $10) = ${autoLot.toFixed(2)} lotes`;
      } else {
        formulaPrevEl.textContent = `$${dollarRisk.toFixed(0)} / (${slValCustom} pips × $7.20) = ${autoLot.toFixed(2)} lotes`;
      }
    }

    if (autoLotHint) autoLotHint.textContent = `Auto (${slValCustom} ${isGold ? 'pts' : 'pips'}): ${autoLot.toFixed(2)} lotes`;
    if (lotEl && !lotEl.dataset.userModified) {
      lotEl.value = autoLot.toFixed(2);
    }

    const lot = parseFloat(lotEl?.value) || autoLot;

    // Margin calculation
    let marginToUse = 7525.0;
    if (isGold) {
      marginToUse = roundNum((2720.0 * 100.0 * lot) / 30.0, 2);
    } else if (isAudUsd) {
      marginToUse = roundNum((100000.0 * 0.6550 * lot) / 30.0, 2);
    } else {
      marginToUse = roundNum((100000.0 * 1.0850 * lot) / 30.0, 2);
    }
    const marginPct = (marginToUse / curBal) * 100.0;

    if (marginDisp) marginDisp.textContent = `$${formatMoney(marginToUse)} (${marginPct.toFixed(1)}%)`;
    if (riskUsdDisp) riskUsdDisp.textContent = `$${formatMoney(dollarRisk)} (${riskPct.toFixed(2)}%)`;

    const dailyHeadroom = (appState.fondeo?.summary?.daily_loss_headroom !== undefined) 
      ? Number(appState.fondeo.summary.daily_loss_headroom) 
      : 2000.0;
    const lossesAllowed = Math.floor(dailyHeadroom / Math.max(1, dollarRisk));

    if (safetyText) {
      if (dollarRisk > dailyHeadroom * 0.5) {
        safetyText.innerHTML = `⚠️ <b>Riesgo Elevado:</b> Arriesgas <b>$${formatMoney(dollarRisk)}</b>, consumiendo más del 50% de tu colchón diario ($${formatMoney(dailyHeadroom)}). Soportas solo <strong>${lossesAllowed} pérdidas</strong> hoy.`;
        if (safetyBanner) safetyBanner.className = 'text-[11px] p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center gap-1.5';
      } else {
        const symbolBadgeText = isGold ? 'Oro (SL 300 / TP 900)' : `${isAudUsd ? 'AUD/USD' : 'EUR/CAD'} (${slValCustom} pips)`;
        safetyText.innerHTML = `🛡️ <b>Riesgo Óptimo en ${symbolBadgeText}:</b> Arriesgas <b>${riskPct.toFixed(2)}% ($${formatMoney(dollarRisk)})</b>. Soportas <strong>${lossesAllowed} pérdidas seguidas</strong> hoy sin violar el 4% diario ($2,000).`;
        if (safetyBanner) safetyBanner.className = 'text-[11px] p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center gap-1.5';
      }
    }

    const calc = calculateTradePrices({
      asset,
      direction: dir,
      lot,
      entry: isNaN(entry) ? null : entry,
      sl: isNaN(sl) ? null : sl,
      tp: isNaN(tp) ? null : tp,
      exit: isNaN(exit) ? null : exit,
      commission: 0.0,
      balance: curBal
    });

    if (calc.slPoints !== null) {
      if (slBadge) slBadge.textContent = isGold ? `${calc.slPoints} pts ($${calc.slDist.toFixed(2)})` : `${calc.slPips} pips`;
      if (slPipsEl) slPipsEl.value = isGold ? calc.slPoints : calc.slPips;
    } else {
      if (slBadge) slBadge.textContent = isGold ? '300 pts ($3.00)' : `${slValCustom} pips`;
    }

    if (calc.tpPoints !== null) {
      const projRr = calc.projectedRr ? `1:${calc.projectedRr}` : '1:3.0';
      if (tpBadge) tpBadge.textContent = isGold ? `${calc.tpPoints} pts (${projRr})` : `${calc.tpPips} pips (${projRr})`;
      if (calc.projectedRr !== null && rrEl && !rrEl.dataset.userManual && isNaN(parseFloat(exitEl?.value))) {
        rrEl.value = calc.projectedRr.toFixed(2);
      }
    } else {
      if (tpBadge) tpBadge.textContent = isGold ? '900 pts (1:3.0)' : `${Math.round(slValCustom * rrVal)} pips (1:3.0)`;
    }

    const isManualRr = rrEl?.dataset.userManual === 'true';

    if (calc.points !== null) {
      const sign = calc.points > 0 ? '+' : '';
      if (ptsDisp) ptsDisp.textContent = isGold ? `${sign}${calc.points} pts` : `${sign}${calc.pips} pips`;
      
      let finalPnl = calc.netPnl;
      let finalRetPct = calc.retPct;
      let finalStatus = calc.status;

      // Si el usuario especificó manualmente el R:R obtenido al finalizar:
      if (isManualRr && dollarRisk > 0) {
        const manualRrVal = parseFloat(rrEl.value) || 3.0;
        finalPnl = roundNum(dollarRisk * manualRrVal, 2);
        finalRetPct = roundNum(riskPct * manualRrVal, 2);
        finalStatus = manualRrVal > 0 ? 'win' : (manualRrVal < 0 ? 'loss' : 'be');
      }

      if (pnlDisp) {
        const pSign = finalPnl > 0 ? '+' : '';
        pnlDisp.textContent = `${pSign}$${formatMoney(finalPnl)}`;
        pnlDisp.className = `font-bold text-sm ${finalPnl > 0 ? 'text-emerald-400' : (finalPnl < 0 ? 'text-rose-400' : 'text-gray-400')}`;
      }
      if (pctDisp) {
        const pctSign = finalRetPct > 0 ? '+' : '';
        pctDisp.textContent = `${pctSign}${finalRetPct.toFixed(2)}%`;
        pctDisp.className = `font-bold text-sm ${finalRetPct > 0 ? 'text-emerald-400' : (finalRetPct < 0 ? 'text-rose-400' : 'text-amber-400')}`;
      }
      if (statusDisp) {
        statusDisp.textContent = finalStatus.toUpperCase();
        statusDisp.className = `font-bold px-2 py-0.5 rounded text-[10px] ${finalStatus === 'win' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : (finalStatus === 'loss' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-gray-800 text-gray-300 border border-gray-700')}`;
      }
      if (pnlEl) pnlEl.value = finalPnl.toFixed(2);
      if (statusEl) statusEl.value = finalStatus;

      if (!isManualRr) {
        if (calc.realizedRr !== null && rrEl) {
          rrEl.value = calc.realizedRr.toFixed(2);
        }
      }

      if (rrDisp) {
        const displayRr = isManualRr ? (parseFloat(rrEl?.value) || 3.0).toFixed(2) : (calc.realizedRr !== null ? calc.realizedRr.toFixed(2) : (calc.projectedRr ? calc.projectedRr.toFixed(2) : '3.00'));
        rrDisp.textContent = `1:${displayRr}`;
      }
    } else {
      if (isManualRr && dollarRisk > 0) {
        const manualRrVal = parseFloat(rrEl.value) || 3.0;
        const manualPnl = roundNum(dollarRisk * manualRrVal, 2);
        const manualPct = roundNum(riskPct * manualRrVal, 2);
        if (ptsDisp) ptsDisp.textContent = `${Math.round(manualRrVal * (calc.slPoints || 300))} pts (implícito)`;
        if (pnlDisp) {
          pnlDisp.textContent = `+$${formatMoney(manualPnl)}`;
          pnlDisp.className = 'font-bold text-emerald-400 text-sm';
        }
        if (pctDisp) {
          pctDisp.textContent = `+${manualPct.toFixed(2)}%`;
          pctDisp.className = 'font-bold text-emerald-400 text-sm';
        }
        if (pnlEl) pnlEl.value = manualPnl.toFixed(2);
        if (statusEl) statusEl.value = 'win';
        if (statusDisp) {
          statusDisp.textContent = 'WIN (3R)';
          statusDisp.className = 'font-bold px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800';
        }
        if (rrDisp) rrDisp.textContent = `1:${manualRrVal.toFixed(2)}`;
      } else {
        if (ptsDisp) ptsDisp.textContent = '300 SL / 900 TP';
        const expectedPnl = roundNum(dollarRisk * 3.0, 2);
        const expectedPct = roundNum(riskPct * 3.0, 2);
        if (pnlDisp) {
          pnlDisp.textContent = `+$${formatMoney(expectedPnl)}`;
          pnlDisp.className = 'font-bold text-emerald-400 text-sm';
        }
        if (pctDisp) {
          pctDisp.textContent = `+${expectedPct.toFixed(2)}%`;
          pctDisp.className = 'font-bold text-emerald-400 text-sm';
        }
        if (statusDisp) {
          statusDisp.textContent = 'WIN (3R)';
          statusDisp.className = 'font-bold px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800';
        }
        if (rrDisp) rrDisp.textContent = `1:${calc.projectedRr ? calc.projectedRr.toFixed(2) : (rrEl?.value || '3.00')}`;
      }
    }
  }

  function setManualRr(val) {
    if (rrEl) {
      rrEl.value = Number(val).toFixed(2);
      rrEl.dataset.userManual = 'true';
    }
    if (isManualRrEl) isManualRrEl.value = '1';
    if (badgeRrMode) {
      badgeRrMode.textContent = val === 3.0 ? '1:3 FIJO' : 'MANUAL';
      badgeRrMode.className = `text-[9px] font-mono px-2 py-0.5 rounded-full ${val === 3.0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'} font-bold`;
    }
    if (btnResetRrAuto) btnResetRrAuto.classList.remove('hidden');

    // Si el precio de salida está vacío pero hay entrada y sl, autocompletar precio de salida implícito
    const entry = parseFloat(entryEl?.value);
    const sl = parseFloat(slEl?.value);
    const dir = dirEl?.value || 'BUY';
    if (!isNaN(entry) && !isNaN(sl) && (!exitEl || !exitEl.value)) {
      const slDist = Math.abs(entry - sl);
      const impliedExit = dir === 'BUY' ? (entry + slDist * val) : (entry - slDist * val);
      if (exitEl) exitEl.placeholder = `Implícito 1:${val}: ${impliedExit.toFixed(2)}`;
    }
    updateFondeoCalculation();
  }

  function resetAutoRr() {
    if (rrEl) {
      delete rrEl.dataset.userManual;
      rrEl.value = '3.00';
    }
    if (isManualRrEl) isManualRrEl.value = '0';
    if (badgeRrMode) {
      badgeRrMode.textContent = '1:3 FIJO';
      badgeRrMode.className = 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold';
    }
    if (btnResetRrAuto) btnResetRrAuto.classList.add('hidden');
    if (exitEl) exitEl.placeholder = 'ej. 2729.50 (TP) o 2717.50 (SL)';
    updateFondeoCalculation();
  }

  // Renderizador dinámico de chips de Stop Loss según el activo
  function renderFondeoSlChips() {
    const chipsContainer = document.getElementById('fondeoSlChipsContainer');
    if (!chipsContainer) return;
    const curAsset = assetEl?.value || 'XAU/USD';
    const curIsGold = anyStringIncludes(curAsset, ['XAU', 'GOLD', 'ORO']);
    const curSlInp = document.getElementById('fondeoFormSlPoints');
    const curVal = parseFloat(curSlInp?.value) || (curIsGold ? 300 : 25);
    const presets = curIsGold ? [150, 200, 250, 300, 350, 400] : [15, 20, 25, 30, 40, 50];

    chipsContainer.innerHTML = presets.map(p => {
      const isSel = (p === curVal);
      const cls = isSel 
        ? 'btnFondeoSlPtsChip px-2 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition cursor-pointer'
        : 'btnFondeoSlPtsChip px-2 py-1 rounded text-[10px] font-mono font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition cursor-pointer';
      return `<button type="button" class="${cls}" data-pts="${p}">${p}</button>`;
    }).join('');

    chipsContainer.querySelectorAll('.btnFondeoSlPtsChip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const p = parseFloat(chip.dataset.pts) || (curIsGold ? 300 : 25);
        if (curSlInp) curSlInp.value = p;
        if (slEl) delete slEl.dataset.userEdited;
        if (tpEl) delete tpEl.dataset.userEdited;
        renderFondeoSlChips();
        updateFondeoCalculation();
      });
    });
  }

  // Cambio de activo en formulario de fondeo
  if (assetEl) {
    assetEl.addEventListener('change', () => {
      const curAsset = assetEl.value;
      const curIsGold = anyStringIncludes(curAsset, ['XAU', 'GOLD', 'ORO']);
      const curSlInp = document.getElementById('fondeoFormSlPoints');
      if (curSlInp) {
        const prevVal = parseFloat(curSlInp.value) || 300;
        if (curIsGold && prevVal < 100) {
          curSlInp.value = 300;
        } else if (!curIsGold && prevVal >= 100) {
          curSlInp.value = 25;
        }
      }
      if (slEl) {
        delete slEl.dataset.userEdited;
        slEl.value = '';
      }
      if (tpEl) {
        delete tpEl.dataset.userEdited;
        tpEl.value = '';
      }
      if (entryEl) {
        if (curIsGold) {
          entryEl.placeholder = 'ej. 2724.50';
        } else if (curAsset.includes('AUD')) {
          entryEl.placeholder = 'ej. 0.6550';
        } else {
          entryEl.placeholder = 'ej. 1.4850';
        }
      }
      renderFondeoSlChips();
      updateFondeoCalculation();
    });
  }

  // Botón para fijar estrictamente 1:3 en Fondeo
  const btnLockSlTp = document.getElementById('btnLock300Sl900Tp');
  if (btnLockSlTp) {
    btnLockSlTp.addEventListener('click', (e) => {
      e.preventDefault();
      const curAsset = assetEl?.value || 'XAU/USD';
      const curIsGold = anyStringIncludes(curAsset, ['XAU', 'GOLD', 'ORO']);
      if (slEl) delete slEl.dataset.userEdited;
      if (tpEl) delete tpEl.dataset.userEdited;
      if (lotEl) delete lotEl.dataset.userModified;
      if (rrEl) {
        delete rrEl.dataset.userManual;
        rrEl.value = '3.00';
      }
      if (isManualRrEl) isManualRrEl.value = '0';
      if (badgeRrMode) {
        badgeRrMode.textContent = '1:3 FIJO';
        badgeRrMode.className = 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold';
      }
      const slPointsInp = document.getElementById('fondeoFormSlPoints');
      const targetSl = curIsGold ? 300 : 25;
      if (slPointsInp) slPointsInp.value = targetSl;
      renderFondeoSlChips();
      
      const entryVal = parseFloat(entryEl?.value);
      const dirVal = dirEl?.value || 'BUY';
      const dec = curIsGold ? 2 : 4;
      const slDelta = curIsGold ? 3.00 : 0.0025;
      const tpDelta = curIsGold ? 9.00 : 0.0075;
      if (!isNaN(entryVal) && entryVal > 0) {
        const fixedSl = dirVal === 'BUY' ? roundNum(entryVal - slDelta, dec) : roundNum(entryVal + slDelta, dec);
        const fixedTp = dirVal === 'BUY' ? roundNum(entryVal + tpDelta, dec) : roundNum(entryVal - tpDelta, dec);
        if (slEl) slEl.value = fixedSl.toFixed(dec);
        if (tpEl) tpEl.value = fixedTp.toFixed(dec);
      }
      updateFondeoCalculation();
      if (typeof showToast === 'function') {
        const unitTxt = curIsGold ? '300 pts / 900 pts' : '25 pips / 75 pips';
        showToast(`⚡ Stop Loss y Take Profit (${unitTxt} - 1:3) fijados con éxito.`, 'success', 2500);
      }
    });
  }

  const slPtsInput = document.getElementById('fondeoFormSlPoints');
  if (slPtsInput) {
    slPtsInput.addEventListener('input', () => {
      if (slEl) delete slEl.dataset.userEdited;
      if (tpEl) delete tpEl.dataset.userEdited;
      renderFondeoSlChips();
      updateFondeoCalculation();
    });
  }
  renderFondeoSlChips();

  if (rrEl) {
    rrEl.addEventListener('input', () => {
      rrEl.dataset.userManual = 'true';
      if (isManualRrEl) isManualRrEl.value = '1';
      if (badgeRrMode) {
        badgeRrMode.textContent = 'MANUAL';
        badgeRrMode.className = 'text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold';
      }
      if (btnResetRrAuto) btnResetRrAuto.classList.remove('hidden');
      updateFondeoCalculation();
    });
  }

  if (btnResetRrAuto) {
    btnResetRrAuto.addEventListener('click', resetAutoRr);
  }

  document.querySelectorAll('.btnQuickRr').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.rr);
      if (!isNaN(val)) setManualRr(val);
    });
  });

  function anyStringIncludes(str, arr) {
    if (!str) return false;
    const upper = String(str).toUpperCase();
    return arr.some(a => upper.includes(a));
  }

  if (slEl) {
    slEl.addEventListener('input', () => {
      slEl.dataset.userEdited = 'true';
      const entryVal = parseFloat(entryEl?.value);
      const slVal = parseFloat(slEl.value);
      if (!isNaN(entryVal) && !isNaN(slVal) && entryVal > 0) {
        const detected = Math.round(Math.abs(entryVal - slVal) * 100);
        const slPointsInp = document.getElementById('fondeoFormSlPoints');
        if (detected > 0 && slPointsInp) {
          slPointsInp.value = detected;
        }
      }
      updateFondeoCalculation();
    });
  }

  if (tpEl) {
    tpEl.addEventListener('input', () => {
      tpEl.dataset.userEdited = 'true';
    });
  }

  if (dirEl) {
    dirEl.addEventListener('change', () => {
      const entryVal = parseFloat(entryEl?.value);
      const dirVal = dirEl.value || 'BUY';
      const slPointsInp = document.getElementById('fondeoFormSlPoints');
      const ptsVal = parseFloat(slPointsInp?.value) || 300;
      const dist = ptsVal / 100.0;
      const rrVal = parseFloat(rrEl?.value) || 3.0;
      if (!isNaN(entryVal) && entryVal > 0) {
        if (slEl && (!slEl.dataset.userEdited || !slEl.value)) {
          slEl.value = (dirVal === 'BUY' ? roundNum(entryVal - dist, 2) : roundNum(entryVal + dist, 2)).toFixed(2);
        }
        if (tpEl && (!tpEl.dataset.userEdited || !tpEl.value)) {
          tpEl.value = (dirVal === 'BUY' ? roundNum(entryVal + dist * rrVal, 2) : roundNum(entryVal - dist * rrVal, 2)).toFixed(2);
        }
      }
      updateFondeoCalculation();
    });
  }

  [entryEl, slEl, tpEl, exitEl, assetEl, riskPctEl, manualUsdInp].forEach(el => {
    if (el) {
      el.addEventListener('input', updateFondeoCalculation);
      el.addEventListener('change', updateFondeoCalculation);
    }
  });

  if (lotEl) {
    lotEl.addEventListener('input', () => {
      lotEl.dataset.userModified = 'true';
      updateFondeoCalculation();
    });
  }

  if (btnTp) {
    btnTp.addEventListener('click', () => {
      if (tpEl && tpEl.value) {
        exitEl.value = tpEl.value;
        updateFondeoCalculation();
      }
    });
  }
  if (btnSl) {
    btnSl.addEventListener('click', () => {
      if (slEl && slEl.value) {
        exitEl.value = slEl.value;
        updateFondeoCalculation();
      }
    });
  }
  if (btnBe) {
    btnBe.addEventListener('click', () => {
      if (entryEl && entryEl.value) {
        exitEl.value = entryEl.value;
        updateFondeoCalculation();
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const asset = document.getElementById('fondeoFormAsset')?.value || 'XAU/USD';
    const direction = document.getElementById('fondeoFormDirection')?.value || 'BUY';
    const lot = parseFloat(lotEl?.value) || 0.83;
    const slPips = parseFloat(slPipsEl?.value) || 30.0;
    const status = statusEl?.value || 'win';
    const pnlInput = pnlEl?.value;
    const rr = parseFloat(rrEl?.value) || 3.0;
    const isManualRr = rrEl?.dataset.userManual === 'true' || isManualRrEl?.value === '1';
    const session = document.getElementById('fondeoFormSession')?.value || 'New York';
    const tvUrl = document.getElementById('fondeoFormTvUrl')?.value || '';
    const notes = document.getElementById('fondeoFormNotes')?.value || '';
    const dateVal = dateEl?.value || '';

    const entry = parseFloat(entryEl?.value);
    const sl = parseFloat(slEl?.value);
    const tp = parseFloat(tpEl?.value);
    const exit = parseFloat(exitEl?.value);

    const slPtsVal = parseFloat(document.getElementById('fondeoFormSlPoints')?.value) || 300;
    const payload = {
      mode: 'fondeo',
      asset: asset,
      direction: direction,
      manual_lot: lot,
      lot_size: lot,
      sl_pips: slPips,
      sl_points: slPtsVal,
      tv_points: slPtsVal,
      status: status,
      rr: rr,
      manual_rr: rr,
      is_manual_rr: isManualRr,
      session: session,
      tv_url: tvUrl,
      notes: notes
    };

    if (dateVal) payload.date = dateVal;
    if (!isNaN(entry)) payload.entry_price = entry;
    if (!isNaN(sl)) payload.sl_price = sl;
    if (!isNaN(tp)) payload.tp_price = tp;
    if (!isNaN(exit)) payload.exit_price = exit;

    if (pnlInput && String(pnlInput).trim() !== '') {
      payload.pnl = parseFloat(pnlInput);
    }

    try {
      const res = await fetch('/api/trades?mode=fondeo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        form.reset();
        if (slEl) delete slEl.dataset.userEdited;
        if (tpEl) delete tpEl.dataset.userEdited;
        if (lotEl) delete lotEl.dataset.userModified;
        resetAutoRr();
        updateFondeoCalculation();
        await loadFondeoTrades();
        if (typeof showToast === 'function') {
          showToast('✅ Operación registrada en Orion Nova 50K con éxito.', 'success', 3000);
        }
      } else {
        const err = await res.json();
        alert('Error registrando trade: ' + (err.error || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error enviando trade:', err);
      alert('Error de conexión al registrar trade');
    }
  });

  // Initial calculation trigger
  updateFondeoCalculation();
}

function setupFondeoActionButtons() {
  const btnExport = document.getElementById('btnExportFondeoJson');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const trades = appState.fondeo.trades || [];
      const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orion_nova_50k_trades_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const btnClear = document.getElementById('btnClearFondeoTrades');
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      if (!confirm('¿Estás seguro de reiniciar todas las operaciones de la bitácora Orion Nova 50K? Esta acción restablecerá el balance inicial a $50,000.00.')) {
        return;
      }
      try {
        const res = await fetch('/api/trades/clear?mode=fondeo', { method: 'POST' });
        if (res.ok) {
          await loadFondeoTrades();
        }
      } catch (err) {
        console.error('Error al limpiar fondeo:', err);
      }
    });
  }

  const btnClearAll = document.getElementById('btnClearData');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
      const currentTab = appState.activeTab;
      const tabName = currentTab === 'fondeo' ? 'Orion Nova 50K' : currentTab === 'real' ? 'Cuenta Real' : 'Backtest';
      if (!confirm(`¿Deseas reiniciar y limpiar los datos de la pestaña activa (${tabName})?`)) return;

      try {
        const res = await fetch(`/api/trades/clear?mode=${currentTab}`, { method: 'POST' });
        if (res.ok) {
          if (currentTab === 'fondeo') await loadFondeoTrades();
          else if (currentTab === 'real') {
            await loadTrades('real');
            renderRealJournalDashboard();
          }
        }
      } catch (err) {
        console.error('Error al limpiar:', err);
      }
    });
  }
}

// ----------------------------------------------------
// API Communication
// ----------------------------------------------------
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      appState.config = data.config || data;
      updateConfigUI();
    }
  } catch (err) {
    console.warn('Config local:', err);
  }
}

async function loadTrades(mode = 'backtest') {
  if (mode === 'real') {
    // 1. Carga inmediata desde el respaldo de seguridad local (espejo anti-pérdida)
    try {
      const cached = localStorage.getItem('cached_real_trades_v2') || localStorage.getItem('cached_real_trades');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0 && (!appState.real.trades || appState.real.trades.length === 0)) {
          appState.real.trades = parsed;
          renderRealJournalDashboard();
        }
      }
    } catch (e) {}
  }

  try {
    const res = await fetch(`/api/trades?mode=${mode}`);
    if (res.ok) {
      const data = await res.json();
      if (mode === 'real') {
        const serverTrades = data.trades || [];
        appState.real.summary = data.summary || {};
        appState.real.equityCurve = data.equity_curve || [];
        
        if (serverTrades.length > 0) {
          appState.real.trades = serverTrades;
          try {
            localStorage.setItem('cached_real_trades_v2', JSON.stringify(serverTrades));
          } catch (e) {}
        } else {
          // Si el servidor retornara array vacío por fallo temporal, verificar si localmente hay trades y auto-sincronizar
          try {
            const cached = localStorage.getItem('cached_real_trades_v2') || localStorage.getItem('cached_real_trades');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                appState.real.trades = parsed;
                for (const t of parsed) {
                  fetch('/api/trades?mode=real', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(t)
                  }).catch(() => {});
                }
              } else {
                appState.real.trades = [];
              }
            } else {
              appState.real.trades = [];
            }
          } catch (e) {
            appState.real.trades = [];
          }
        }
        renderRealJournalDashboard();
      } else {
        appState.backtest.summary = data.summary || {};
        appState.backtest.equityCurve = data.equity_curve || [];
        appState.backtest.trades = data.trades || [];
        renderBacktestDashboard();
      }
    }
  } catch (err) {
    console.error(`Error cargando trades (${mode}):`, err);
  }
}

function updateConfigUI() {
  const cfg = appState.config;
  const initial = Number(cfg.initial_balance || 110.0);
  const risk = Number(cfg.risk_pct || 5.0);
  const rr = Number(cfg.rr_ratio || 1.0);

  document.getElementById('badgeInitialBalance').textContent = initial.toFixed(2);
  document.getElementById('badgeRiskPct').textContent = formatRiskPctText(risk);
  document.getElementById('badgeCurrentRR').textContent = formatRRText(rr);
  document.getElementById('statInitialLabel').textContent = initial.toFixed(2);

  // Recalculation Console inputs
  const initialInput = document.getElementById('globalInitialInput');
  if (initialInput) initialInput.value = Math.round(initial);
  const labelActiveInitial = document.getElementById('labelActiveInitialBal');
  if (labelActiveInitial) labelActiveInitial.textContent = `$${initial.toFixed(2)}`;

  const globRisk = document.getElementById('globalRiskInput');
  if (globRisk) globRisk.value = formatRiskPctText(risk);
  const globRR = document.getElementById('globalRRInput');
  if (globRR) globRR.value = formatRRText(rr);
  const lblRisk = document.getElementById('labelActiveRiskPct');
  if (lblRisk) lblRisk.textContent = `${formatRiskPctText(risk)}%`;
  const lblRR = document.getElementById('labelActiveRR');
  if (lblRR) lblRR.textContent = `1:${formatRRText(rr)}`;

  // Trade form RR input
  const specRR = document.getElementById('tradeSpecificRR');
  if (specRR && !specRR.value) specRR.value = formatRRText(rr);

  // Settings modal
  document.getElementById('settingInitialBalance').value = initial;
  document.getElementById('settingRiskPct').value = formatRiskPctText(risk);
  document.getElementById('settingRR').value = formatRRText(rr);
  document.getElementById('settingRR').value = rr;
  document.getElementById('settingLeverage').value = cfg.leverage || 300;
}

// ----------------------------------------------------
// Pure Percentage Compounding Recalculation Engine
// ----------------------------------------------------
let recalcDebounceTimer = null;

async function triggerRecalculate(newRisk, newRR, newInitial) {
  const initial = (newInitial !== undefined && !isNaN(newInitial) && newInitial > 0)
    ? Number(newInitial)
    : Number(appState.config.initial_balance || 110.0);
  const leverage = Number(appState.config.leverage || 300);

  appState.config.initial_balance = initial;
  appState.config.risk_pct = newRisk;
  appState.config.rr_ratio = newRR;

  // Update labels instantly
  const lblInit = document.getElementById('labelActiveInitialBal');
  if (lblInit) lblInit.textContent = `$${initial.toFixed(2)}`;
  const lblRisk = document.getElementById('labelActiveRiskPct');
  if (lblRisk) lblRisk.textContent = `${formatRiskPctText(newRisk)}%`;
  const lblRR = document.getElementById('labelActiveRR');
  if (lblRR) lblRR.textContent = `1:${formatRRText(newRR)}`;

  document.getElementById('badgeInitialBalance').textContent = initial.toFixed(2);
  document.getElementById('badgeRiskPct').textContent = formatRiskPctText(newRisk);
  document.getElementById('badgeCurrentRR').textContent = formatRRText(newRR);
  document.getElementById('statInitialLabel').textContent = initial.toFixed(2);

  // Immediate Client-Side Pure Percentage Compounding Recalculation
  let currBal = initial;
  let peak = initial;
  let maxDdAmount = 0.0;
  let maxDdPct = 0.0;
  let wins = 0;
  let losses = 0;
  let be = 0;
  let totalGain = 0.0;
  let totalLoss = 0.0;
  let streakWin = 0;
  let streakLoss = 0;
  let maxStreakWin = 0;
  let maxStreakLoss = 0;
  let totalSlPoints = 0;
  let minSlPoints = 999999;
  let maxSlPoints = 0;

  const curve = [{
    trade_num: 0,
    date: 'Inicio',
    balance: roundNum(initial, 2),
    drawdown_pct: 0.0,
    pnl: 0.0
  }];

  const updatedTrades = appState.backtest.trades.map((t, idx) => {
    // Invariant Stop Loss points
    let points, price;
    if (t.tv_points !== undefined && Number(t.tv_points) >= 20) {
      points = Math.round(Number(t.tv_points));
      price = (points / 100).toFixed(2);
    } else if (t.sl_points !== undefined && Number(t.sl_points) >= 20) {
      points = Math.round(Number(t.sl_points));
      price = (points / 100).toFixed(2);
    } else {
      const parsed = parseTradingViewInput(t.sl_distance || 2.50);
      points = parsed.points;
      price = parsed.price;
    }

    const tradeRR = Number(t.rr_custom || newRR);
    const status = (t.status || 'win').toLowerCase();

    totalSlPoints += points;
    if (points < minSlPoints) minSlPoints = points;
    if (points > maxSlPoints) maxSlPoints = points;

    // Pure Percentage Compounding Calculation
    let retPct = 0.0;
    let pnl = 0.0;
    const dollarRisk = roundNum(currBal * (newRisk / 100.0), 2);
    const rawLot = points > 0 ? (dollarRisk / points) : 0.01;
    const lotSize = Math.max(0.01, roundNum(rawLot, 2));

    if (status === 'win') {
      retPct = newRisk * tradeRR;
      pnl = roundNum(currBal * (retPct / 100.0), 2);
      wins++;
      totalGain += pnl;
      streakWin++;
      streakLoss = 0;
      if (streakWin > maxStreakWin) maxStreakWin = streakWin;
    } else if (status === 'loss') {
      retPct = -newRisk;
      pnl = -roundNum(currBal * (newRisk / 100.0), 2);
      losses++;
      totalLoss += Math.abs(pnl);
      streakLoss++;
      streakWin = 0;
      if (streakLoss > maxStreakLoss) maxStreakLoss = streakLoss;
    } else {
      be++;
      streakWin = 0;
      streakLoss = 0;
    }

    const balBefore = currBal;
    currBal += pnl;
    if (currBal < 0) currBal = 0.0;

    if (currBal > peak) peak = currBal;
    const ddAmount = peak - currBal;
    const ddPct = peak > 0 ? (ddAmount / peak) * 100.0 : 0.0;
    if (ddAmount > maxDdAmount) maxDdAmount = ddAmount;
    if (ddPct > maxDdPct) maxDdPct = ddPct;

    curve.push({
      trade_num: idx + 1,
      date: t.date || `T#${idx + 1}`,
      balance: roundNum(currBal, 2),
      drawdown_pct: roundNum(ddPct, 2),
      pnl: roundNum(pnl, 2)
    });

    const marginUsed = roundNum((2720.0 * 100 * lotSize) / leverage, 2);

    return {
      ...t,
      tv_points: points,
      price_dist: price,
      sl_points: points,
      tp_points: Math.round(points * tradeRR),
      sl_distance: price,
      lot_size: lotSize,
      risk_budget: roundNum(dollarRisk, 2),
      margin_used: marginUsed,
      pnl: pnl,
      ret_pct: roundNum(retPct, 2),
      rr: tradeRR,
      balance_before: roundNum(balBefore, 2),
      balance_after: roundNum(currBal, 2)
    };
  });

  appState.backtest.trades = updatedTrades;
  appState.backtest.equityCurve = curve;

  const totalClosed = wins + losses + be;
  const winRate = totalClosed > 0 ? (wins / totalClosed) * 100.0 : 0.0;
  const lossRate = totalClosed > 0 ? (losses / totalClosed) * 100.0 : 0.0;
  const pf = totalLoss > 0 ? totalGain / totalLoss : (totalGain > 0 ? 999.0 : 0.0);
  const netPnl = currBal - initial;
  const netRet = initial > 0 ? (netPnl / initial) * 100.0 : 0.0;
  const avgWin = wins > 0 ? totalGain / wins : 0.0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0.0;
  const expectancy = (winRate / 100.0 * avgWin) - (lossRate / 100.0 * avgLoss);
  const beWinrate = newRR > 0 ? (1.0 / (1.0 + newRR)) * 100.0 : 50.0;

  const avgSlPoints = totalClosed > 0 ? roundNum(totalSlPoints / totalClosed, 1) : 0;
  const avgSlPrice = roundNum(avgSlPoints / 100.0, 2);
  const finalMinSl = totalClosed > 0 ? minSlPoints : 0;
  const finalMaxSl = totalClosed > 0 ? maxSlPoints : 0;

  appState.backtest.summary = {
    initial_balance: roundNum(initial, 2),
    current_balance: roundNum(currBal, 2),
    net_pnl: roundNum(netPnl, 2),
    net_return_pct: roundNum(netRet, 2),
    total_trades: totalClosed,
    wins,
    losses,
    breakevens: be,
    win_rate: roundNum(winRate, 2),
    loss_rate: roundNum(lossRate, 2),
    profit_factor: pf === 999.0 ? '∞' : roundNum(pf, 2),
    total_gain: roundNum(totalGain, 2),
    total_loss: roundNum(totalLoss, 2),
    avg_win: roundNum(avgWin, 2),
    avg_loss: roundNum(avgLoss, 2),
    avg_sl_points: avgSlPoints,
    avg_sl_price: avgSlPrice,
    min_sl_points: finalMinSl,
    max_sl_points: finalMaxSl,
    max_drawdown_amount: roundNum(maxDdAmount, 2),
    max_drawdown_pct: roundNum(maxDdPct, 2),
    max_streak_win: maxStreakWin,
    max_streak_loss: maxStreakLoss,
    expectancy_usd: roundNum(expectancy, 2),
    be_winrate: roundNum(beWinrate, 1)
  };

  // Render Backtest Dashboard
  updateConfigUI();
  renderBacktestDashboard();
  recalculateTradingViewValues();

  // Debounced API call to sync with server
  clearTimeout(recalcDebounceTimer);
  recalcDebounceTimer = setTimeout(async () => {
    try {
      await fetch('/api/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: 'backtest',
          initial_balance: initial,
          risk_pct: newRisk, 
          rr_ratio: newRR 
        })
      });
    } catch (err) {
      console.warn('Error sincronizando recálculo:', err);
    }
  }, 300);
}

// ----------------------------------------------------
// Parsing helper for Gold Points
// ----------------------------------------------------
function parseTradingViewInput(rawVal) {
  let strVal = String(rawVal).trim().replace(',', '.');
  let val = parseFloat(strVal);
  if (isNaN(val) || val <= 0) val = 250;

  let points, price;
  // Si val >= 20.0, fue ingresado directamente en puntos TradingView (ej. 250, 250.0, 350, 500)
  // Si val < 20.0, fue ingresado como distancia en dólares (ej. 2.50, 3.50, 1.50)
  if (val >= 20.0) {
    points = Math.round(val);
    price = (points / 100).toFixed(2);
  } else {
    points = Math.round(val * 100);
    price = (points / 100).toFixed(2);
  }
  return { points, price };
}

// ----------------------------------------------------
// Form 1: Backtest Widget Calculations
// ----------------------------------------------------
function recalculateTradingViewValues() {
  const curBal = (appState.backtest.summary && appState.backtest.summary.current_balance !== undefined) 
    ? appState.backtest.summary.current_balance 
    : (parseFloat(appState.config.initial_balance) || 110.0);

  const riskInput = document.getElementById('tradeRiskPct');
  const riskPct = riskInput ? (parseFloat(String(riskInput.value).replace(',', '.')) || 5.0) : 5.0;

  const rrInput = document.getElementById('tradeSpecificRR');
  const tradeRR = rrInput ? (parseFloat(String(rrInput.value).replace(',', '.')) || 2.0) : 2.0;

  // Pure % Compounding based on balance x % de riesgo
  const dollarRisk = roundNum(curBal * (riskPct / 100.0), 2);
  const dollarReward = roundNum(dollarRisk * tradeRR, 2);

  // Update Backtest form preview elements
  const riskUsdPreview = document.getElementById('backtestRiskUsdPreview');
  if (riskUsdPreview) riskUsdPreview.textContent = `-$${dollarRisk.toFixed(2)}`;

  const rewardUsdPreview = document.getElementById('backtestRewardUsdPreview');
  if (rewardUsdPreview) rewardUsdPreview.textContent = `+$${dollarReward.toFixed(2)}`;

  const backtestBalDisplay = document.getElementById('backtestFormCurrentBalDisplay');
  if (backtestBalDisplay) backtestBalDisplay.textContent = `$${curBal.toFixed(2)}`;

  const badgeCurrentRiskUsd = document.getElementById('badgeCurrentRiskUsd');
  if (badgeCurrentRiskUsd) badgeCurrentRiskUsd.textContent = `$${dollarRisk.toFixed(2)}`;
  const formCurrentBalanceDisplay = document.getElementById('formCurrentBalanceDisplay');
  if (formCurrentBalanceDisplay) formCurrentBalanceDisplay.textContent = `$${curBal.toFixed(2)}`;
  const formCurrentRiskBudgetDisplay = document.getElementById('formCurrentRiskBudgetDisplay');
  if (formCurrentRiskBudgetDisplay) formCurrentRiskBudgetDisplay.textContent = `$${dollarRisk.toFixed(2)}`;
}

// ----------------------------------------------------
// Form 2: Real Journal Live Preview
// ----------------------------------------------------
function recalculateRealJournalPreview() {
  const curBal = (appState.real.summary && appState.real.summary.current_balance !== undefined)
    ? Number(appState.real.summary.current_balance)
    : Number(appState.config.initial_balance || 110.0);

  const entryEl = document.getElementById('realTradeEntry');
  const slEl = document.getElementById('realTradeSl');
  const tpEl = document.getElementById('realTradeTp');
  const exitEl = document.getElementById('realTradeExit');
  const dirInput = document.getElementById('realTradeDirection');
  const direction = dirInput?.value || 'BUY';

  const entry = parseFloat(entryEl?.value);
  const sl = parseFloat(slEl?.value);
  const tp = parseFloat(tpEl?.value);
  const exit = parseFloat(exitEl?.value);

  const slBadge = document.getElementById('realTradeSlPtsBadge');
  const tpBadge = document.getElementById('realTradeTpPtsBadge');
  const ptsDisp = document.getElementById('realCalcPointsDisplay');
  const rrDisp = document.getElementById('realCalcRrDisplay');
  const pnlDisp = document.getElementById('realCalcPnlDisplay');
  const pctDisp = document.getElementById('realCalcPctDisplay');

  let slDist = null;
  if (!isNaN(entry) && !isNaN(sl) && entry > 0 && sl > 0) {
    slDist = Math.abs(entry - sl);
    const slPts = Math.round(slDist * 100);
    const ptsInput = document.getElementById('realTradeTvPoints');
    if (ptsInput) ptsInput.value = slPts;
    if (slBadge) slBadge.textContent = `${slPts} pts ($${slDist.toFixed(2)})`;
  } else {
    if (slBadge) slBadge.textContent = '0 pts';
  }

  let tpDist = null;
  if (!isNaN(entry) && !isNaN(tp) && entry > 0 && tp > 0) {
    tpDist = Math.abs(tp - entry);
    const tpPts = Math.round(tpDist * 100);
    if (tpBadge) tpBadge.textContent = `${tpPts} pts ($${tpDist.toFixed(2)})`;
    if (slDist && slDist > 0) {
      const projRR = roundNum(tpDist / slDist, 2);
      const rrInput = document.getElementById('realTradeRR');
      if (rrInput && isNaN(exit)) rrInput.value = projRR;
    }
  } else {
    if (tpBadge) tpBadge.textContent = '0 pts';
  }

  const rawInput = document.getElementById('realTradeTvPoints')?.value || '250';
  const { points, price } = parseTradingViewInput(rawInput);
  
  const riskPctStr = document.getElementById('realTradeRiskPct')?.value || '5.0';
  let riskPct = parseFloat(String(riskPctStr).replace(',', '.').trim()) || 5.0;
  
  const rrStr = document.getElementById('realTradeRR')?.value || '1.0';
  const rr = parseFloat(String(rrStr).replace(',', '.').trim()) || 1.0;
  
  const leverage = parseFloat(appState.config.leverage) || 300;

  const dollarRiskBudget = roundNum(curBal * (riskPct / 100.0), 2);
  const rawLot = points > 0 ? (dollarRiskBudget / points) : 0.01;
  const suggestedLot = Math.max(0.01, roundNum(rawLot, 2));

  // Actualización del badge de lote sugerido
  const suggestedBadge = document.getElementById('realTradeSuggestedLotBadge');
  if (suggestedBadge) suggestedBadge.textContent = suggestedLot.toFixed(2);

  // Manejo de lote manual ingresado por el usuario
  const manualLotInput = document.getElementById('realTradeManualLot');
  const manualLotVal = manualLotInput && manualLotInput.value ? parseFloat(String(manualLotInput.value).replace(',', '.').trim()) : null;
  const effectiveLot = (manualLotVal && manualLotVal > 0) ? roundNum(manualLotVal, 2) : suggestedLot;

  // Manejo de comisión (permite negativos -0.06 o -0,06 o positivos 0.06)
  const commInput = document.getElementById('realTradeCommission');
  let commVal = 0.0;
  if (commInput && commInput.value) {
    const rawComm = parseFloat(String(commInput.value).replace(',', '.').trim());
    if (!isNaN(rawComm)) commVal = Math.abs(rawComm);
  }

  // Si hay Entrada y Salida, calcular PnL y puntos exactos
  if (!isNaN(entry) && !isNaN(exit) && entry > 0 && exit > 0) {
    const exitDiff = direction === 'BUY' ? (exit - entry) : (entry - exit);
    const wonPts = Math.round(exitDiff * 100);
    const calcPnl = roundNum((effectiveLot * 100 * exitDiff) - commVal, 2);
    const calcRetPct = curBal > 0 ? roundNum((calcPnl / curBal) * 100, 2) : 0.0;

    const manualPnlInput = document.getElementById('realTradeManualPnl');
    if (manualPnlInput) manualPnlInput.value = calcPnl.toFixed(2);

    const winRadio = document.querySelector('input[name="realTradeResult"][value="win"]');
    const lossRadio = document.querySelector('input[name="realTradeResult"][value="loss"]');
    const beRadio = document.querySelector('input[name="realTradeResult"][value="be"]');

    if (calcPnl > 0.05 && winRadio) winRadio.checked = true;
    else if (calcPnl < -0.05 && lossRadio) lossRadio.checked = true;
    else if (beRadio) beRadio.checked = true;

    if (ptsDisp) {
      const sign = wonPts > 0 ? '+' : '';
      ptsDisp.textContent = `${sign}${wonPts} pts`;
      ptsDisp.className = `font-bold text-sm ${wonPts > 0 ? 'text-emerald-400' : (wonPts < 0 ? 'text-rose-400' : 'text-gray-400')}`;
    }
    if (pnlDisp) {
      const sign = calcPnl > 0 ? '+' : '';
      pnlDisp.textContent = `${sign}$${Number(calcPnl).toFixed(2)}`;
      pnlDisp.className = `font-bold text-sm ${calcPnl > 0 ? 'text-emerald-400' : (calcPnl < 0 ? 'text-rose-400' : 'text-gray-400')}`;
    }
    if (pctDisp) {
      const sign = calcRetPct > 0 ? '+' : '';
      pctDisp.textContent = `${sign}${calcRetPct.toFixed(2)}%`;
      pctDisp.className = `font-bold text-sm ${calcRetPct > 0 ? 'text-emerald-400' : (calcRetPct < 0 ? 'text-rose-400' : 'text-amber-400')}`;
    }
    if (rrDisp) {
      const rRatio = slDist && slDist > 0 ? roundNum(Math.abs(exitDiff) / slDist, 2) : rr;
      rrDisp.textContent = `1:${rRatio}`;
    }
  } else {
    if (ptsDisp) {
      ptsDisp.textContent = '0 pts';
      ptsDisp.className = 'font-bold text-white text-sm';
    }
    if (pnlDisp) {
      pnlDisp.textContent = '+$0.00';
      pnlDisp.className = 'font-bold text-emerald-400 text-sm';
    }
    if (pctDisp) {
      pctDisp.textContent = '0.00%';
      pctDisp.className = 'font-bold text-amber-400 text-sm';
    }
    if (rrDisp) rrDisp.textContent = `1:${rr}`;
  }

  const effectiveMargin = roundNum((2720.0 * 100 * effectiveLot) / leverage, 2);
  const effectiveRiskDollar = roundNum(points * effectiveLot, 2);
  const effectiveRewardDollar = roundNum(points * effectiveLot * rr, 2);
  const effectiveRiskPct = curBal > 0 ? roundNum(((effectiveRiskDollar + commVal) / curBal) * 100, 2) : riskPct;
  const effectiveRewardPct = curBal > 0 ? roundNum(((effectiveRewardDollar - commVal) / curBal) * 100, 2) : (riskPct * rr);

  const slExplain = document.getElementById('realSlExplain');
  if (slExplain) slExplain.textContent = `${points} pts ($${price})`;

  const curBalDisplay = document.getElementById('realFormCurrentBalDisplay');
  if (curBalDisplay) curBalDisplay.textContent = `$${curBal.toFixed(2)}`;

  const previewRisk = document.getElementById('realPreviewRiskDollar');
  if (previewRisk) {
    const totalRiskDol = roundNum(effectiveRiskDollar + commVal, 2);
    previewRisk.textContent = `-$${totalRiskDol.toFixed(2)} (-${effectiveRiskPct.toFixed(2)}%)`;
  }

  const previewReward = document.getElementById('realPreviewRewardDollar');
  if (previewReward) {
    const totalRewardDol = roundNum(effectiveRewardDollar - commVal, 2);
    previewReward.textContent = `+$${totalRewardDol.toFixed(2)} (+${effectiveRewardPct.toFixed(2)}%)`;
  }

  const previewLot = document.getElementById('realPreviewLot');
  if (previewLot) previewLot.textContent = effectiveLot.toFixed(2);

  const previewMargin = document.getElementById('realPreviewMargin');
  if (previewMargin) previewMargin.textContent = `~$${effectiveMargin.toFixed(2)}`;
}

// ----------------------------------------------------
// View 3: Myfxbook Style Calculator Logic
// ----------------------------------------------------
function getRealAccountBalance() {
  const s = appState.real?.summary || {};
  const cfg = appState.config || {};
  return s.current_balance !== undefined ? s.current_balance : (cfg.initial_balance || 110.0);
}

function initCalculatorBalance() {
  const calcBal = document.getElementById('calcBalInput');
  if (calcBal) {
    const saved = localStorage.getItem('calc_independent_balance');
    if (saved && !isNaN(parseFloat(saved))) {
      calcBal.value = parseFloat(saved).toFixed(2);
    } else if (!calcBal.value || calcBal.value === '110') {
      calcBal.value = '1000.00';
    }
  }
}

function updateCalculatorBalances() {
  const curRealBal = (appState.real.summary && appState.real.summary.current_balance !== undefined) 
    ? appState.real.summary.current_balance 
    : (parseFloat(appState.config.initial_balance) || 115.64);

  const lReal = document.getElementById('labelSyncRealBal');
  if (lReal) lReal.textContent = curRealBal.toFixed(2);

  // Auto-sync input value if not focused
  const inReal = document.getElementById('calcBalInput');
  if (inReal && document.activeElement !== inReal) {
    inReal.value = curRealBal.toFixed(2);
  }

  runRealCalculator();
}

function runRealCalculator() {
  const curRealBal = (appState.real.summary && appState.real.summary.current_balance !== undefined) 
    ? appState.real.summary.current_balance 
    : 115.64;

  const balInput = document.getElementById('calcBalInput');
  const balance = balInput && balInput.value !== '' && !isNaN(parseFloat(String(balInput.value).replace(',', '.')))
    ? parseFloat(String(balInput.value).replace(',', '.'))
    : curRealBal;
  const riskInput = document.getElementById('calcRiskPctInput');
  const riskPct = riskInput && riskInput.value !== '' && !isNaN(parseFloat(String(riskInput.value).replace(',', '.')))
    ? parseFloat(String(riskInput.value).replace(',', '.'))
    : 10.0;
  const rawSl = document.getElementById('calcSlPointsInput')?.value || '250';
  const { points, price } = parseTradingViewInput(rawSl);
  const rr = parseFloat(String(document.getElementById('calcRRInput')?.value).replace(',', '.')) || 2.0;
  const leverage = parseFloat(document.getElementById('calcLeverageInput')?.value) || 300;
  const goldPrice = 2720.0;

  // Dollar Risk & Reward
  const dollarRisk = roundNum(balance * (riskPct / 100.0), 2);
  const dollarReward = roundNum(dollarRisk * rr, 2);
  const rewardPct = roundNum(riskPct * rr, 2);

  // Position Sizing: Suggested Lot = Dollar Risk / Points
  const rawLot = points > 0 ? (dollarRisk / points) : 0.01;
  const suggestedLot = Math.max(0.01, roundNum(rawLot, 2));

  // Margin at given leverage
  const notional = goldPrice * 100 * suggestedLot;
  const marginReq = roundNum(notional / leverage, 2);
  const marginPct = balance > 0 ? roundNum((marginReq / balance) * 100.0, 1) : 0.0;

  // Update UI Labels
  const balLabel = document.getElementById('myfxBalLabel');
  if (balLabel) balLabel.textContent = `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const riskLabel = document.getElementById('myfxRiskLabel');
  if (riskLabel) riskLabel.textContent = `${formatRiskPctText(riskPct)}%`;
  const rrLabel = document.getElementById('myfxRRLabel');
  if (rrLabel) rrLabel.textContent = `1:${formatRRText(rr)}`;
  const slLabel = document.getElementById('myfxSlLabel');
  if (slLabel) slLabel.textContent = `${points} pts ($${price})`;
  const slText = document.getElementById('myfxSlText');
  if (slText) slText.textContent = `${points} puntos ($${price})`;

  // Hero Lot Card
  const heroLot = document.getElementById('myfxHeroLot');
  if (heroLot) heroLot.textContent = suggestedLot.toFixed(2);
  const heroRaw = document.getElementById('myfxHeroRawLot');
  if (heroRaw) heroRaw.textContent = `Lote exacto sin redondeo: ${rawLot.toFixed(4)}`;

  // Breakdown Cards
  const riskUsd = document.getElementById('myfxRiskUsd');
  if (riskUsd) riskUsd.textContent = `-$${dollarRisk.toFixed(2)}`;
  const riskPctText = document.getElementById('myfxRiskPctText');
  if (riskPctText) riskPctText.textContent = `${formatRiskPctText(riskPct)}% de la cuenta`;

  const rewardUsd = document.getElementById('myfxRewardUsd');
  if (rewardUsd) rewardUsd.textContent = `+$${dollarReward.toFixed(2)}`;
  const rewardPctText = document.getElementById('myfxRewardPctText');
  if (rewardPctText) rewardPctText.textContent = `+${formatRiskPctText(rewardPct)}% (1:${formatRRText(rr)} RR)`;

  const priceDist = document.getElementById('myfxPriceDist');
  if (priceDist) priceDist.textContent = `$${price}`;
  const pointsDist = document.getElementById('myfxPointsDist');
  if (pointsDist) pointsDist.textContent = `${points} puntos`;

  const marginReqEl = document.getElementById('myfxMarginReq');
  if (marginReqEl) marginReqEl.textContent = `~$${marginReq.toFixed(2)}`;
  const marginPctEl = document.getElementById('myfxMarginPct');
  if (marginPctEl) marginPctEl.textContent = `${marginPct}% del balance`;

  initIcons();
}

function runMyfxbookCalculator() {
  runRealCalculator();
}

// ----------------------------------------------------
// BACKTESTING SIMPLE (INTERÉS COMPUESTO PURO) MODULE
// ----------------------------------------------------
async function loadBacktestSimpleData() {
  try {
    const [resTrades, resConfig] = await Promise.all([
      fetch('/api/trades?mode=backtest'),
      fetch('/api/config?mode=backtest')
    ]);

    if (resConfig.ok) {
      const cfg = await resConfig.json();
      appState.backtest.config = cfg;
      const inpBal = document.getElementById('btSimpleInitialBalance');
      if (inpBal && (!inpBal.value || document.activeElement !== inpBal)) {
        inpBal.value = cfg.initial_balance !== undefined ? cfg.initial_balance : 1000.0;
      }
      const inpRr = document.getElementById('btSimpleRR');
      if (inpRr && (!inpRr.value || document.activeElement !== inpRr)) {
        inpRr.value = cfg.rr_ratio !== undefined ? cfg.rr_ratio : 3.0;
      }
      const inpRisk = document.getElementById('btSimpleRiskPct');
      if (inpRisk && (!inpRisk.value || document.activeElement !== inpRisk)) {
        inpRisk.value = cfg.risk_pct !== undefined ? cfg.risk_pct : 1.0;
      }
    }

    if (resTrades.ok) {
      const data = await resTrades.json();
      appState.backtest.summary = data.summary || {};
      appState.backtest.equityCurve = data.equity_curve || [];
      appState.backtest.trades = data.trades || [];
    }

    updateBacktestSimplePreviews();
    renderBacktestSimpleDashboard();
  } catch (err) {
    console.error('Error cargando backtesting simple:', err);
  }
}

function updateBacktestSimplePreviews() {
  const inpBal = document.getElementById('btSimpleInitialBalance');
  const inpRr = document.getElementById('btSimpleRR');
  const inpRisk = document.getElementById('btSimpleRiskPct');

  const curBal = (appState.backtest.summary && appState.backtest.summary.current_balance !== undefined)
    ? Number(appState.backtest.summary.current_balance)
    : (parseFloat(inpBal ? inpBal.value : '1000') || 1000.0);

  const rrVal = parseFloat(inpRr ? inpRr.value : '3.0') || 3.0;
  const riskPctVal = parseFloat(inpRisk ? inpRisk.value : '1.0') || 1.0;

  // Breakeven Win Rate formula: 1 / (1 + RR)
  const bePct = rrVal > 0 ? ((1 / (1 + rrVal)) * 100).toFixed(1) : '50.0';
  const beBadge = document.getElementById('btSimpleBreakevenBadge');
  if (beBadge) beBadge.textContent = `BE: ${bePct}%`;

  // Dynamic next trade risk / win preview
  const nextRiskUsd = curBal * (riskPctVal / 100.0);
  const nextWinUsd = nextRiskUsd * rrVal;
  const nextWinPct = (riskPctVal * rrVal).toFixed(2);

  const riskPreview = document.getElementById('btSimpleRiskUsdPreview');
  if (riskPreview) riskPreview.textContent = `$${nextRiskUsd.toFixed(2)} / op`;

  const liveBalText = document.getElementById('btSimpleLiveBalText');
  if (liveBalText) liveBalText.textContent = `$${formatMoney(curBal)}`;

  const liveRiskText = document.getElementById('btSimpleLiveRiskText');
  if (liveRiskText) liveRiskText.textContent = `$${nextRiskUsd.toFixed(2)} (${riskPctVal.toFixed(1)}%)`;

  const winSubtext = document.getElementById('btSimpleWinRewardSubtext');
  if (winSubtext) {
    winSubtext.textContent = `+${nextWinPct}% (+${rrVal.toFixed(1)}R) · +$${formatMoney(nextWinUsd)}`;
  }

  const lossSubtext = document.getElementById('btSimpleLossRiskSubtext');
  if (lossSubtext) {
    lossSubtext.textContent = `-${riskPctVal.toFixed(2)}% (-1R) · -$${formatMoney(nextRiskUsd)}`;
  }
}

function setupBacktestSimpleView() {
  let selectedBtSimpleAsset = 'XAU/USD';

  function updateBtSimpleAssetUI() {
    const isGold = anyStringIncludes(selectedBtSimpleAsset, ['XAU', 'GOLD', 'ORO']);
    const isAudUsd = selectedBtSimpleAsset.includes('AUD');
    const isEurCad = selectedBtSimpleAsset.includes('CAD');

    document.querySelectorAll('.btn-bt-asset').forEach(btn => {
      const a = btn.dataset.asset;
      const isSel = (a === selectedBtSimpleAsset);
      if (isSel) {
        if (a && a.includes('AUD')) {
          btn.className = 'btn-bt-asset px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm shadow-blue-500/20';
        } else if (a && a.includes('CAD')) {
          btn.className = 'btn-bt-asset px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/20';
        } else {
          btn.className = 'btn-bt-asset px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20';
        }
      } else {
        btn.className = 'btn-bt-asset px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 border border-gray-700';
      }
    });

    const manualAssetSel = document.getElementById('btSimpleManualAsset');
    if (manualAssetSel) manualAssetSel.value = selectedBtSimpleAsset;

    const slLabel = document.getElementById('btSimpleManualSlLabel');
    if (slLabel) slLabel.textContent = isGold ? 'Stop Loss en Puntos' : `Stop Loss en Pips (${isAudUsd ? 'AUD/USD' : 'EUR/CAD'})`;

    const slInput = document.getElementById('btSimpleManualSlPoints');
    if (slInput) {
      const curVal = parseFloat(slInput.value) || 300;
      if (isGold && curVal < 100) slInput.value = 300;
      else if (!isGold && curVal >= 100) slInput.value = 25;
    }

    updateBacktestSimplePreviews();
  }

  document.querySelectorAll('.btn-bt-asset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedBtSimpleAsset = btn.dataset.asset || 'XAU/USD';
      updateBtSimpleAssetUI();
    });
  });

  // Preset Chips: Capital Inicial
  document.querySelectorAll('.btn-bt-chip-balance').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.val);
      const inp = document.getElementById('btSimpleInitialBalance');
      if (inp) {
        inp.value = val;
        updateBacktestSimplePreviews();
      }
    });
  });

  // Preset Chips: R:R
  document.querySelectorAll('.btn-bt-chip-rr').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.val);
      const inp = document.getElementById('btSimpleRR');
      if (inp) {
        inp.value = val;
        updateBacktestSimplePreviews();
      }
    });
  });

  // Preset Chips: % Riesgo
  document.querySelectorAll('.btn-bt-chip-risk').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.val);
      const inp = document.getElementById('btSimpleRiskPct');
      if (inp) {
        inp.value = val;
        updateBacktestSimplePreviews();
      }
    });
  });

  // Live input events for dynamic recalculation previews
  ['btSimpleInitialBalance', 'btSimpleRR', 'btSimpleRiskPct'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateBacktestSimplePreviews);
      el.addEventListener('change', updateBacktestSimplePreviews);
    }
  });

  // Botón: Recalcular Todo con Interés Compuesto
  const btnRecalc = document.getElementById('btnBtSimpleRecalculate');
  if (btnRecalc) {
    btnRecalc.addEventListener('click', async () => {
      const initBal = parseFloat(document.getElementById('btSimpleInitialBalance')?.value) || 1000.0;
      const rr = parseFloat(document.getElementById('btSimpleRR')?.value) || 3.0;
      const risk = parseFloat(document.getElementById('btSimpleRiskPct')?.value) || 1.0;

      btnRecalc.disabled = true;
      btnRecalc.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Recalculando...</span>';
      initIcons();

      try {
        const res = await fetch('/api/recalculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'backtest',
            initial_balance: initBal,
            rr_ratio: rr,
            risk_pct: risk
          })
        });
        if (res.ok) {
          const data = await res.json();
          appState.backtest.summary = data.summary || {};
          appState.backtest.equityCurve = data.equity_curve || [];
          appState.backtest.trades = data.trades || [];
          renderBacktestSimpleDashboard();
        }
      } catch (err) {
        console.error('Error recalculando backtesting simple:', err);
      } finally {
        btnRecalc.disabled = false;
        btnRecalc.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i><span>⚡ Recalcular Todo con Interés Compuesto</span>';
        initIcons();
      }
    });
  }

  // Helper para registrar trade rápido
  async function submitQuickBtTrade(status) {
    const rr = parseFloat(document.getElementById('btSimpleRR')?.value) || 3.0;
    const risk = parseFloat(document.getElementById('btSimpleRiskPct')?.value) || 1.0;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const isGold = anyStringIncludes(selectedBtSimpleAsset, ['XAU', 'GOLD', 'ORO']);
    const slUnits = isGold ? 300 : 25;

    try {
      const res = await fetch('/api/trades?mode=backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'backtest',
          asset: selectedBtSimpleAsset,
          status: status,
          direction: status === 'loss' ? 'SELL' : 'BUY',
          rr: rr,
          risk_pct: risk,
          sl_pips: slUnits,
          tv_points: slUnits,
          date: dateStr,
          strategy: `Estrategia Rápida 1-Click (${selectedBtSimpleAsset})`,
          emotion: 'Plan 100% Seguido',
          notes: `Trade Rápido ${selectedBtSimpleAsset} (${status.toUpperCase()} ${status === 'win' ? `+${rr}R` : (status === 'loss' ? '-1R' : 'BE')})`
        })
      });
      if (res.ok) {
        const data = await res.json();
        appState.backtest.summary = data.analytics.summary || {};
        appState.backtest.equityCurve = data.analytics.equity_curve || [];
        appState.backtest.trades = data.analytics.trades || [];
        renderBacktestSimpleDashboard();
      }
    } catch (e) {
      console.error('Error enviando trade rápido backtest:', e);
    }
  }

  const btnWin = document.getElementById('btnBtSimpleQuickWin');
  if (btnWin) btnWin.addEventListener('click', () => submitQuickBtTrade('win'));
  const btnLoss = document.getElementById('btnBtSimpleQuickLoss');
  if (btnLoss) btnLoss.addEventListener('click', () => submitQuickBtTrade('loss'));
  const btnBe = document.getElementById('btnBtSimpleQuickBe');
  if (btnBe) btnBe.addEventListener('click', () => submitQuickBtTrade('be'));

  // Formulario Manual Detallado
  const btnAddManual = document.getElementById('btnBtSimpleAddManualTrade');
  if (btnAddManual) {
    btnAddManual.addEventListener('click', async () => {
      const asset = document.getElementById('btSimpleManualAsset')?.value || selectedBtSimpleAsset || 'XAU/USD';
      const dir = document.getElementById('btSimpleManualDirection')?.value || 'BUY';
      const status = document.getElementById('btSimpleManualStatus')?.value || 'win';
      const manualRrInput = document.getElementById('btSimpleManualRR')?.value;
      const globalRr = parseFloat(document.getElementById('btSimpleRR')?.value) || 3.0;
      const slPoints = parseFloat(document.getElementById('btSimpleManualSlPoints')?.value) || (asset.includes('XAU') ? 300 : 25);
      const dateVal = document.getElementById('btSimpleManualDate')?.value;
      const notes = document.getElementById('btSimpleManualNotes')?.value || '';
      const risk = parseFloat(document.getElementById('btSimpleRiskPct')?.value) || 1.0;

      const tradeRr = (manualRrInput && !isNaN(parseFloat(manualRrInput))) ? parseFloat(manualRrInput) : globalRr;
      const isManualRr = Boolean(manualRrInput && !isNaN(parseFloat(manualRrInput)));

      try {
        const res = await fetch('/api/trades?mode=backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'backtest',
            asset: asset,
            direction: dir,
            status: status,
            rr: tradeRr,
            is_manual_rr: isManualRr,
            manual_rr: isManualRr ? tradeRr : null,
            sl_pips: slPoints,
            tv_points: slPoints,
            risk_pct: risk,
            date: dateVal || undefined,
            strategy: `Manual Backtest (${asset})`,
            notes: notes
          })
        });
        if (res.ok) {
          const data = await res.json();
          appState.backtest.summary = data.analytics.summary || {};
          appState.backtest.equityCurve = data.analytics.equity_curve || [];
          appState.backtest.trades = data.analytics.trades || [];
          if (document.getElementById('btSimpleManualNotes')) document.getElementById('btSimpleManualNotes').value = '';
          renderBacktestSimpleDashboard();
        }
      } catch (err) {
        console.error('Error registrando trade manual backtest:', err);
      }
    });
  }

  // Cargar Muestra
  const btnSample = document.getElementById('btnBtSimpleLoadSample');
  if (btnSample) {
    btnSample.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/trades/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'backtest' })
        });
        if (res.ok) {
          const data = await res.json();
          appState.backtest.summary = data.summary || {};
          appState.backtest.equityCurve = data.equity_curve || [];
          appState.backtest.trades = data.trades || [];
          renderBacktestSimpleDashboard();
        }
      } catch (e) {
        console.error('Error cargando muestra:', e);
      }
    });
  }

  // Limpiar Backtest
  const btnClear = document.getElementById('btnBtSimpleClear');
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      if (!confirm('¿Estás seguro de que deseas limpiar todas las operaciones del Backtesting Simple?')) return;
      try {
        const res = await fetch('/api/trades/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'backtest' })
        });
        if (res.ok) {
          const data = await res.json();
          appState.backtest.summary = data.summary || {};
          appState.backtest.equityCurve = data.equity_curve || [];
          appState.backtest.trades = data.trades || [];
          renderBacktestSimpleDashboard();
        }
      } catch (e) {
        console.error('Error limpiando backtest:', e);
      }
    });
  }

  // Filtros de tabla
  document.querySelectorAll('.btn-bt-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = btn.dataset.filter;
      appState.backtest.filter = filter;
      document.querySelectorAll('.btn-bt-filter').forEach(b => {
        b.className = 'btn-bt-filter px-3 py-1 rounded-lg font-semibold transition text-gray-400 hover:text-white cursor-pointer';
      });
      btn.className = 'btn-bt-filter px-3 py-1 rounded-lg font-semibold transition bg-emerald-600 text-white cursor-pointer';
      renderBacktestSimpleTradesTable();
    });
  });

  // Exportar CSV
  const btnCsv = document.getElementById('btnBtSimpleExportCsv');
  if (btnCsv) {
    btnCsv.addEventListener('click', () => exportTradesToCsv('backtest'));
  }

  // Modal de Simulación en Serie
  const modalSim = document.getElementById('modalBtSimpleSimulate');
  const btnOpenSim = document.getElementById('btnBtSimpleSimulateModalOpen');
  const btnCloseSim = document.getElementById('btnCloseBtSimulateModal');
  const btnCancelSim = document.getElementById('btnCancelBtSimulation');
  const btnExecSim = document.getElementById('btnExecuteBtSimulation');

  if (btnOpenSim && modalSim) {
    btnOpenSim.addEventListener('click', () => {
      modalSim.classList.remove('hidden');
      initIcons();
    });
  }
  [btnCloseSim, btnCancelSim].forEach(btn => {
    if (btn && modalSim) {
      btn.addEventListener('click', () => modalSim.classList.add('hidden'));
    }
  });

  const numRange = document.getElementById('btSimModalNumRange');
  const numInput = document.getElementById('btSimModalNumInput');
  if (numRange && numInput) {
    numRange.addEventListener('input', () => { numInput.value = numRange.value; });
    numInput.addEventListener('input', () => { numRange.value = numInput.value; });
  }

  const wrRange = document.getElementById('btSimModalWrRange');
  const wrInput = document.getElementById('btSimModalWrInput');
  if (wrRange && wrInput) {
    wrRange.addEventListener('input', () => { wrInput.value = wrRange.value; });
    wrInput.addEventListener('input', () => { wrRange.value = wrInput.value; });
  }

  document.querySelectorAll('.btn-bt-sim-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const trades = btn.dataset.trades;
      const wr = btn.dataset.wr;
      if (numRange) numRange.value = trades;
      if (numInput) numInput.value = trades;
      if (wrRange) wrRange.value = wr;
      if (wrInput) wrInput.value = wr;
    });
  });

  if (btnExecSim) {
    btnExecSim.addEventListener('click', async () => {
      const nTrades = parseInt(document.getElementById('btSimModalNumInput')?.value) || 30;
      const winRate = parseFloat(document.getElementById('btSimModalWrInput')?.value) || 50.0;
      const initBal = parseFloat(document.getElementById('btSimpleInitialBalance')?.value) || 1000.0;
      const rr = parseFloat(document.getElementById('btSimpleRR')?.value) || 3.0;
      const risk = parseFloat(document.getElementById('btSimpleRiskPct')?.value) || 1.0;

      btnExecSim.disabled = true;
      btnExecSim.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Simulando...</span>';
      initIcons();

      try {
        const res = await fetch('/api/trades/generate-series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'backtest',
            num_trades: nTrades,
            win_rate: winRate,
            initial_balance: initBal,
            risk_pct: risk,
            rr_ratio: rr
          })
        });
        if (res.ok) {
          const data = await res.json();
          appState.backtest.summary = data.summary || {};
          appState.backtest.equityCurve = data.equity_curve || [];
          appState.backtest.trades = data.trades || [];
          if (modalSim) modalSim.classList.add('hidden');
          renderBacktestSimpleDashboard();
        }
      } catch (err) {
        console.error('Error generando simulación:', err);
      } finally {
        btnExecSim.disabled = false;
        btnExecSim.innerHTML = '<i data-lucide="zap" class="w-4 h-4"></i><span>Generar y Calcular Curva</span>';
        initIcons();
      }
    });
  }

  // Inicializar estado del activo en Backtesting Simple
  updateBtSimpleAssetUI();
}

function renderBacktestSimpleDashboard() {
  const s = appState.backtest.summary || {};
  const trades = appState.backtest.trades || [];

  const initBal = s.initial_balance !== undefined ? s.initial_balance : (parseFloat(document.getElementById('btSimpleInitialBalance')?.value) || 1000.0);
  const curBal = s.current_balance !== undefined ? s.current_balance : initBal;
  const netPnl = s.net_pnl !== undefined ? s.net_pnl : (curBal - initBal);
  const netRet = s.net_return_pct !== undefined ? s.net_return_pct : (initBal > 0 ? (netPnl / initBal * 100) : 0);
  const total = s.total_trades !== undefined ? s.total_trades : trades.length;
  const wins = s.wins !== undefined ? s.wins : trades.filter(t => t.status === 'win').length;
  const losses = s.losses !== undefined ? s.losses : trades.filter(t => t.status === 'loss').length;
  const be = s.breakevens !== undefined ? s.breakevens : trades.filter(t => t.status === 'be').length;
  const winRate = s.win_rate !== undefined ? s.win_rate : (total > 0 ? (wins / total * 100) : 0);
  const pf = s.profit_factor !== undefined ? s.profit_factor : 0;
  const maxDd = s.max_drawdown_pct !== undefined ? s.max_drawdown_pct : 0;
  const maxDdUsd = s.max_drawdown_amount !== undefined ? s.max_drawdown_amount : 0;
  const maxWinStreak = s.max_streak_win || 0;
  const maxLossStreak = s.max_streak_loss || 0;
  const expectancy = s.expectancy_usd !== undefined ? s.expectancy_usd : 0;
  const beWinrate = s.be_winrate !== undefined ? s.be_winrate : 25.0;
  const totalGain = s.total_gain || 0;
  const totalLoss = s.total_loss || 0;
  const avgWin = s.avg_win || (wins > 0 ? totalGain / wins : 0);
  const avgLoss = s.avg_loss || (losses > 0 ? totalLoss / losses : 0);

  // 1. Balance Final Card
  const elBal = document.getElementById('btSimpleStatBalance');
  if (elBal) elBal.textContent = `$${formatMoney(curBal)}`;
  const elNetPnl = document.getElementById('btSimpleStatNetPnl');
  if (elNetPnl) {
    const sign = netPnl >= 0 ? '+' : '';
    const color = netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
    elNetPnl.innerHTML = `<span class="${color}">${sign}$${formatMoney(netPnl)} (${sign}${netRet.toFixed(2)}%)</span>`;
  }

  // 2. Max DD Card
  const elMaxDd = document.getElementById('btSimpleStatMaxDd');
  if (elMaxDd) elMaxDd.textContent = `${maxDd.toFixed(1)}%`;
  const elMaxDdUsd = document.getElementById('btSimpleStatMaxDdUsd');
  if (elMaxDdUsd) elMaxDdUsd.textContent = `-$${formatMoney(maxDdUsd)} USD`;

  // 3. Win Rate Card
  const elWr = document.getElementById('btSimpleStatWinRate');
  if (elWr) elWr.textContent = `${winRate.toFixed(1)}%`;
  const elWrBadge = document.getElementById('btSimpleStatWinRateBadge');
  if (elWrBadge) {
    if (total === 0) {
      elWrBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-bold bg-gray-800 text-gray-400 shrink-0';
      elWrBadge.textContent = '0 ops';
    } else if (winRate >= beWinrate) {
      elWrBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0';
      elWrBadge.textContent = `>BE (${beWinrate}%)`;
      elWrBadge.title = `Rentable: Supera el Breakeven necesario de ${beWinrate}%`;
    } else {
      elWrBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-bold bg-rose-950 text-rose-400 border border-rose-800 shrink-0';
      elWrBadge.textContent = `<BE (${beWinrate}%)`;
      elWrBadge.title = `Por debajo del Breakeven necesario de ${beWinrate}%`;
    }
  }
  const elWrBar = document.getElementById('btSimpleStatWinRateBar');
  if (elWrBar) elWrBar.style.width = `${Math.min(100, Math.max(0, winRate))}%`;
  const elBeComp = document.getElementById('btSimpleStatBeComparison');
  if (elBeComp) elBeComp.textContent = `BE necesario: ${beWinrate}%`;

  // 4. Profit Factor Card
  const elPf = document.getElementById('btSimpleStatProfitFactor');
  if (elPf) elPf.textContent = pf === '∞' ? '∞' : (Number(pf) >= 999 ? '∞' : Number(pf).toFixed(2));
  const elGainsVsLosses = document.getElementById('btSimpleStatGainsVsLosses');
  if (elGainsVsLosses) {
    elGainsVsLosses.innerHTML = `<span class="text-emerald-400 truncate font-semibold" title="Total Ganado: $${formatMoney(totalGain)}">+$${formatMoney(totalGain)}</span><span class="text-gray-600 shrink-0">/</span><span class="text-rose-400 truncate font-semibold" title="Total Perdido: $${formatMoney(totalLoss)}">-$${formatMoney(totalLoss)}</span>`;
    elGainsVsLosses.title = `Total Ganado: $${formatMoney(totalGain)} | Total Perdido: $${formatMoney(totalLoss)}`;
  }

  // 5. Expectancy Card
  const elExp = document.getElementById('btSimpleStatExpectancy');
  if (elExp) {
    const expSign = expectancy >= 0 ? '+' : '';
    elExp.textContent = `${expSign}$${formatMoney(expectancy)}`;
    elExp.className = expectancy >= 0 ? 'text-xl sm:text-2xl font-black text-emerald-400 font-mono' : 'text-xl sm:text-2xl font-black text-rose-400 font-mono';
  }

  // 6. Streaks Card
  const elStreakWin = document.getElementById('btSimpleStatMaxStreakWin');
  if (elStreakWin) elStreakWin.textContent = `${maxWinStreak} W`;
  const elStreakLoss = document.getElementById('btSimpleStatMaxStreakLoss');
  if (elStreakLoss) elStreakLoss.textContent = `${maxLossStreak} L`;

  // 7. Total Trades Card
  const elTotal = document.getElementById('btSimpleStatTotalTrades');
  if (elTotal) elTotal.textContent = total;
  const elBreakdown = document.getElementById('btSimpleStatBreakdown');
  if (elBreakdown) {
    elBreakdown.innerHTML = `<span class="text-emerald-400">${wins} W</span> · <span class="text-rose-400">${losses} L</span> · <span class="text-gray-400">${be} BE</span>`;
  }

  // 8. Avg Win / Avg Loss Card
  const elAvgWinLoss = document.getElementById('btSimpleStatAvgWinLoss');
  if (elAvgWinLoss) {
    elAvgWinLoss.textContent = `+$${formatMoney(avgWin)} / -$${formatMoney(avgLoss)}`;
  }
  const elRatioReal = document.getElementById('btSimpleStatRatioReal');
  if (elRatioReal) {
    const realRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0.00';
    elRatioReal.textContent = `Ratio Real: ${realRatio}R`;
  }

  updateBacktestSimplePreviews();
  updateBacktestSimpleCharts();
  renderBacktestSimpleTradesTable();
  initIcons();
}

// Retrocompatibilidad con otros módulos
function renderBacktestDashboard() {
  renderBacktestSimpleDashboard();
}

function initBacktestSimpleCharts() {
  const canvasEquity = document.getElementById('btSimpleEquityChart');
  const canvasDd = document.getElementById('btSimpleDrawdownChart');

  if (canvasEquity && !btSimpleEquityChartInstance) {
    const ctxEq = canvasEquity.getContext('2d');
    btSimpleEquityChartInstance = new Chart(ctxEq, {
      type: 'line',
      data: {
        labels: ['Inicio'],
        datasets: [
          {
            label: 'Balance Compuesto ($)',
            data: [1000],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            borderWidth: 2.5,
            tension: 0.25,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10B981'
          },
          {
            label: 'Base Inicial',
            data: [1000],
            borderColor: 'rgba(156, 163, 175, 0.4)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            borderColor: '#059669',
            borderWidth: 1,
            titleColor: '#F8FAFC',
            bodyColor: '#34D399',
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#94A3B8', font: { family: 'monospace', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#94A3B8',
              font: { family: 'monospace', size: 10 },
              callback: (v) => `$${Number(v).toLocaleString('en-US')}`
            }
          }
        }
      }
    });
  }

  if (canvasDd && !btSimpleDrawdownChartInstance) {
    const ctxDd = canvasDd.getContext('2d');
    btSimpleDrawdownChartInstance = new Chart(ctxDd, {
      type: 'line',
      data: {
        labels: ['Inicio'],
        datasets: [{
          label: 'Drawdown (%)',
          data: [0],
          borderColor: '#F43F5E',
          backgroundColor: 'rgba(244, 63, 94, 0.15)',
          borderWidth: 2,
          tension: 0.2,
          fill: true,
          pointRadius: 2,
          pointBackgroundColor: '#F43F5E'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            borderColor: '#BE123C',
            borderWidth: 1,
            titleColor: '#F8FAFC',
            bodyColor: '#FB7185',
            callbacks: {
              label: (ctx) => ` Drawdown: -${Number(ctx.parsed.y).toFixed(2)}%`
            }
          }
        },
        scales: {
          x: { display: false },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#FB7185',
              font: { family: 'monospace', size: 10 },
              callback: (v) => `-${v}%`
            }
          }
        }
      }
    });
  }
}

function updateBacktestSimpleCharts() {
  initBacktestSimpleCharts();
  const curve = appState.backtest.equityCurve || [];
  const s = appState.backtest.summary || {};
  const initBal = s.initial_balance !== undefined ? s.initial_balance : (parseFloat(document.getElementById('btSimpleInitialBalance')?.value) || 1000.0);
  const curBal = s.current_balance !== undefined ? s.current_balance : initBal;

  if (btSimpleEquityChartInstance) {
    if (curve.length <= 1) {
      btSimpleEquityChartInstance.data.labels = ['Inicio'];
      btSimpleEquityChartInstance.data.datasets[0].data = [initBal];
      btSimpleEquityChartInstance.data.datasets[1].data = [initBal];
    } else {
      btSimpleEquityChartInstance.data.labels = curve.map(c => c.trade_num === 0 ? 'Inicio' : `T#${c.trade_num}`);
      btSimpleEquityChartInstance.data.datasets[0].data = curve.map(c => c.balance);
      btSimpleEquityChartInstance.data.datasets[1].data = curve.map(() => initBal);

      const isProfitable = curBal >= initBal;
      const color = isProfitable ? '#10B981' : '#F43F5E';
      const bg = isProfitable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
      btSimpleEquityChartInstance.data.datasets[0].borderColor = color;
      btSimpleEquityChartInstance.data.datasets[0].backgroundColor = bg;
      btSimpleEquityChartInstance.data.datasets[0].pointBackgroundColor = color;
    }
    btSimpleEquityChartInstance.update();
  }

  if (btSimpleDrawdownChartInstance) {
    if (curve.length <= 1) {
      btSimpleDrawdownChartInstance.data.labels = ['Inicio'];
      btSimpleDrawdownChartInstance.data.datasets[0].data = [0];
    } else {
      btSimpleDrawdownChartInstance.data.labels = curve.map(c => c.trade_num === 0 ? 'Inicio' : `T#${c.trade_num}`);
      btSimpleDrawdownChartInstance.data.datasets[0].data = curve.map(c => c.drawdown_pct);
    }
    btSimpleDrawdownChartInstance.update();

    const ddDisp = document.getElementById('btSimpleChartCurrentDdDisplay');
    if (ddDisp) {
      const maxDd = s.max_drawdown_pct !== undefined ? s.max_drawdown_pct : 0;
      ddDisp.textContent = `${maxDd.toFixed(1)}% Max DD`;
    }
  }
}

function renderBacktestSimpleTradesTable() {
  const tbody = document.getElementById('btSimpleTradesTableBody');
  if (!tbody) return;

  const countAll = document.getElementById('btFilterCountAll');
  const countWins = document.getElementById('btFilterCountWins');
  const countLosses = document.getElementById('btFilterCountLosses');

  const trades = appState.backtest.trades || [];
  const winsCount = trades.filter(t => t.status === 'win').length;
  const lossesCount = trades.filter(t => t.status === 'loss').length;

  if (countAll) countAll.textContent = trades.length;
  if (countWins) countWins.textContent = winsCount;
  if (countLosses) countLosses.textContent = lossesCount;

  let filtered = trades;
  const filter = appState.backtest.filter || 'all';
  if (filter === 'win') {
    filtered = trades.filter(t => t.status === 'win');
  } else if (filter === 'loss') {
    filtered = trades.filter(t => t.status === 'loss');
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="py-12 text-center text-gray-500 font-sans">
          ${trades.length === 0 
            ? 'Aún no has registrado operaciones. Usa los botones rápidos 🟢 WIN / 🔴 LOSS o simula una serie con el botón superior.' 
            : 'No hay operaciones que coincidan con el filtro seleccionado.'}
        </td>
      </tr>
    `;
    return;
  }

  const globalRr = parseFloat(document.getElementById('btSimpleRR')?.value) || 3.0;

  const rowsHtml = filtered.slice().reverse().map((t, idx) => {
    const isWin = t.status === 'win';
    const isLoss = t.status === 'loss';
    const pnlNum = Number(t.pnl || 0);
    const pnlSign = pnlNum > 0 ? '+' : '';
    const pnlColor = isWin ? 'text-emerald-400 font-bold' : (isLoss ? 'text-rose-400 font-bold' : 'text-gray-400');
    
    const tradeRr = Number(t.rr || globalRr);
    const badgeOutcome = isWin
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">WIN (+${tradeRr.toFixed(1)}R)</span>`
      : (isLoss 
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">LOSS (-1R)</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">BE ($0)</span>');

    const dirBadge = t.direction === 'BUY'
      ? '<span class="text-emerald-400 font-bold flex items-center gap-0.5"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> BUY</span>'
      : '<span class="text-rose-400 font-bold flex items-center gap-0.5"><i data-lucide="arrow-down-right" class="w-3 h-3"></i> SELL</span>';

    const assetBadge = getAssetBadge(t.asset);

    const riskBudgetUsd = t.dollar_risk !== undefined ? `$${Number(t.dollar_risk).toFixed(2)}` : (t.balance_before ? `$${(t.balance_before * ((t.risk_pct || 1) / 100)).toFixed(2)}` : '$0.00');
    const riskPctStr = `${Number(t.risk_pct || t.risk_pct_custom || 1.0).toFixed(1)}%`;
    const retPctStr = t.ret_pct !== undefined ? `${t.ret_pct >= 0 ? '+' : ''}${Number(t.ret_pct).toFixed(2)}%` : '-';
    const balBeforeStr = t.balance_before !== undefined ? `$${formatMoney(t.balance_before)}` : '-';
    const balAfterStr = t.balance_after !== undefined ? `$${formatMoney(t.balance_after)}` : '-';

    const curvePoint = (appState.backtest.equityCurve || []).find(c => c.trade_num === (filtered.length - idx));
    const ddStr = curvePoint ? `${curvePoint.drawdown_pct.toFixed(1)}%` : '0.0%';

    return `
      <tr class="transition hover:bg-gray-800/40">
        <td class="py-2.5 px-3 text-gray-500">${filtered.length - idx}</td>
        <td class="py-2.5 px-3 text-gray-400 text-[11px] whitespace-nowrap">${t.date || '-'}</td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${assetBadge}
            ${dirBadge}
          </div>
        </td>
        <td class="py-2.5 px-3 text-blue-300 font-bold font-mono">1:${tradeRr.toFixed(1)}</td>
        <td class="py-2.5 px-3 text-amber-300 font-mono">${riskBudgetUsd} <span class="text-[10px] text-amber-400/90 font-bold">(${riskPctStr})</span></td>
        <td class="py-2.5 px-3">${badgeOutcome}</td>
        <td class="py-2.5 px-3 ${pnlColor}">${pnlSign}$${formatMoney(pnlNum)}</td>
        <td class="py-2.5 px-3 ${pnlColor}">${retPctStr}</td>
        <td class="py-2.5 px-3 text-gray-400 font-mono">${balBeforeStr}</td>
        <td class="py-2.5 px-3 text-white font-bold font-mono">${balAfterStr}</td>
        <td class="py-2.5 px-3 text-rose-400 font-mono">${ddStr}</td>
        <td class="py-2.5 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="handleOpenEditModal('${t.id}', 'backtest')" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-emerald-400 transition cursor-pointer" title="Editar trade">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="handleDeleteTrade('${t.id}', 'backtest')" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-rose-400 transition cursor-pointer" title="Borrar trade">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
  initIcons();
}

// Retrocompatibilidad
function renderBacktestTradesTable() {
  renderBacktestSimpleTradesTable();
}

// ----------------------------------------------------
// Render Real Journal Dashboard & Table
// ----------------------------------------------------
function renderRealJournalDashboard() {
  const s = appState.real.summary || {};
  const trades = appState.real.trades || [];
  const cfg = appState.config || {};
  
  const curBal = s.current_balance !== undefined ? s.current_balance : cfg.initial_balance;
  const netPnl = s.net_pnl !== undefined ? s.net_pnl : 0.0;
  const netRet = s.net_return_pct !== undefined ? s.net_return_pct : 0.0;
  const winRate = s.win_rate !== undefined ? s.win_rate : 0.0;
  const wins = s.wins || 0;
  const losses = s.losses || 0;
  const total = trades.length;
  const pf = s.profit_factor !== undefined ? s.profit_factor : 0.0;
  const maxDd = s.max_drawdown_pct !== undefined ? s.max_drawdown_pct : 0.0;
  const maxDdUsd = s.max_drawdown_amount !== undefined ? s.max_drawdown_amount : 0.0;
  const avgSlPts = s.avg_sl_points !== undefined ? s.avg_sl_points : 0;
  const avgSlPrice = s.avg_sl_price !== undefined ? s.avg_sl_price : 0;

  // Calculate Discipline metric (% where emotion was not FOMO or Revancha)
  const disciplinedTrades = trades.filter(t => {
    const emo = (t.emotion || '').toLowerCase();
    return !emo.includes('fomo') && !emo.includes('venganza') && !emo.includes('revancha');
  });
  const disciplinePct = total > 0 ? roundNum((disciplinedTrades.length / total) * 100.0, 1) : 100.0;

  const tabBadgeReal = document.getElementById('tabBadgeReal');
  if (tabBadgeReal) {
    tabBadgeReal.textContent = `${total} ops guardadas`;
  }
  document.getElementById('realStatTotalOps').textContent = total;
  const realStatTotalOpsBadge = document.getElementById('realStatTotalOpsBadge');
  if (realStatTotalOpsBadge) realStatTotalOpsBadge.textContent = total;
  document.getElementById('realStatBalance').textContent = `$${curBal.toFixed(2)}`;
  const initBalVal = s.initial_balance !== undefined ? s.initial_balance : (cfg.initial_balance || 110.0);
  document.getElementById('realStatInitBal').textContent = Number(initBalVal).toFixed(2);
  
  const badgeRealMt5 = document.getElementById('badgeRealMt5');
  if (badgeRealMt5) {
    if (s.mt5_connected) {
      badgeRealMt5.textContent = `🟢 MT5 (${s.broker || 'Tickmill'})`;
      badgeRealMt5.classList.remove('hidden');
    } else {
      badgeRealMt5.classList.add('hidden');
    }
  }
  
  const pnlSign = netPnl >= 0 ? '+' : '';
  const netPnlEl = document.getElementById('realStatNetPnL');
  netPnlEl.textContent = `${pnlSign}$${netPnl.toFixed(2)} (${pnlSign}${netRet.toFixed(1)}%)`;
  netPnlEl.className = netPnl >= 0 ? 'font-bold text-emerald-400' : 'font-bold text-rose-400';

  document.getElementById('realStatWinRate').textContent = `${winRate.toFixed(1)}%`;
  document.getElementById('realStatWins').textContent = wins;
  document.getElementById('realStatLosses').textContent = losses;
  document.getElementById('realStatWinRateBar').style.width = `${Math.min(100, winRate)}%`;

  document.getElementById('realStatPF').textContent = pf === '∞' ? '∞' : Number(pf).toFixed(2);
  document.getElementById('realStatGain').textContent = Number(s.total_gain || 0).toFixed(2);
  document.getElementById('realStatLoss').textContent = Number(s.total_loss || 0).toFixed(2);

  const discPctEl = document.getElementById('realStatDisciplinePct');
  if (discPctEl) discPctEl.textContent = `${disciplinePct}%`;
  const discCountEl = document.getElementById('realStatDisciplineCount');
  if (discCountEl) discCountEl.textContent = `${disciplinedTrades.length}/${total}`;

  document.getElementById('realStatAvgSl').textContent = total > 0 ? avgSlPts : '0';
  document.getElementById('realStatAvgSlPrice').textContent = total > 0 ? avgSlPrice.toFixed(2) : '0.00';

  document.getElementById('realStatDD').textContent = `${maxDd.toFixed(1)}%`;
  document.getElementById('realStatDDUsd').textContent = `-$${maxDdUsd.toFixed(2)}`;

  // Cálculos de Mediciones Cuantitativas Avanzadas
  let ev = 0.0;
  if (total > 0) {
    const winRateDec = wins / total;
    const lossRateDec = losses / total;
    const avgWin = wins > 0 ? ((s.total_gain || 0) / wins) : 0;
    const avgLoss = losses > 0 ? ((s.total_loss || 0) / losses) : 0;
    ev = (winRateDec * avgWin) - (lossRateDec * avgLoss);
  }
  const evEl = document.getElementById('metricEV');
  if (evEl) {
    const evSign = ev >= 0 ? '+' : '';
    evEl.textContent = `${evSign}$${ev.toFixed(2)}`;
    evEl.className = ev >= 0 ? 'text-base sm:text-lg font-black text-emerald-400 mt-1' : 'text-base sm:text-lg font-black text-rose-400 mt-1';
  }

  let avgRR = 0.0;
  if (total > 0) {
    const sumRR = trades.reduce((acc, t) => acc + (Number(t.rr) || 1.0), 0);
    avgRR = sumRR / total;
  }
  const avgRREl = document.getElementById('metricAvgRR');
  if (avgRREl) avgRREl.textContent = `1:${formatRRText(avgRR)}`;

  let bestTradePnl = 0.0;
  let worstTradePnl = 0.0;
  if (trades.length > 0) {
    const pnls = trades.map(t => Number(t.pnl) || 0);
    bestTradePnl = Math.max(...pnls);
    worstTradePnl = Math.min(...pnls);
  }
  const bestEl = document.getElementById('metricBestTrade');
  if (bestEl) bestEl.textContent = bestTradePnl > 0 ? `+$${bestTradePnl.toFixed(2)}` : '$0.00';
  const worstEl = document.getElementById('metricWorstTrade');
  if (worstEl) worstEl.textContent = worstTradePnl < 0 ? `-$${Math.abs(worstTradePnl).toFixed(2)}` : '$0.00';

  let maxWins = 0, maxLosses = 0, curW = 0, curL = 0;
  trades.forEach(t => {
    if (t.status === 'win') {
      curW++;
      curL = 0;
      if (curW > maxWins) maxWins = curW;
    } else if (t.status === 'loss') {
      curL++;
      curW = 0;
      if (curL > maxLosses) maxLosses = curL;
    } else {
      curW = 0;
      curL = 0;
    }
  });
  const streaksEl = document.getElementById('metricStreaks');
  if (streaksEl) streaksEl.textContent = `${maxWins}W / ${maxLosses}L`;

  let recFactor = 0.0;
  if (netPnl > 0 && maxDdUsd > 0) {
    recFactor = netPnl / maxDdUsd;
  }
  const recEl = document.getElementById('metricRecoveryFactor');
  if (recEl) recEl.textContent = Number(recFactor).toFixed(2);

  const curDDEl = document.getElementById('currentDrawdownDisplay');
  if (curDDEl) curDDEl.textContent = `${maxDd.toFixed(1)}%`;

  updateCharts();

  renderRealTradesTable();
  recalculateRealJournalPreview();
  updateCalculatorBalances();
  initIcons();
}

function renderRealTradesTable() {
  const tbody = document.getElementById('realTradesTableBody');
  const trades = appState.real.trades || [];

  if (trades.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" class="py-12 text-center text-gray-500 font-sans">
          Aún no has registrado operaciones en tu Bitácora Real. Llena el formulario superior para documentar tu primera operación.
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = trades.slice().reverse().map((t, idx) => {
    const isWin = t.status === 'win';
    const isLoss = t.status === 'loss';
    const pnlSign = t.pnl > 0 ? '+' : '';
    const pnlColor = isWin ? 'text-emerald-400 font-bold' : (isLoss ? 'text-rose-400 font-bold' : 'text-gray-400');
    const tradeRR = Number(t.rr || 1.0);

    const badgeOutcome = isWin
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">WIN (+${formatRRText(tradeRR)}R)</span>`
      : (isLoss 
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">LOSS (-1R)</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">BE (0)</span>');

    const dirBadge = t.direction === 'BUY'
      ? '<span class="text-tvGreen font-bold flex items-center gap-0.5"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> BUY</span>'
      : '<span class="text-tvRed font-bold flex items-center gap-0.5"><i data-lucide="arrow-down-right" class="w-3 h-3"></i> SELL</span>';

    const assetBadge = getAssetBadge(t.asset);
    const isGold = anyStringIncludes(t.asset || 'XAU/USD', ['XAU', 'GOLD', 'ORO']);
    const pts = t.tv_points || t.sl_points || (isGold ? 250 : 25);
    const slText = isGold ? `${pts} pts <span class="text-[10px] text-gray-500 font-normal">($${(pts / 100).toFixed(2)})</span>` : `${t.sl_pips || pts} pips`;

    const chartBtn = t.tv_chart_url 
      ? `<a href="${t.tv_chart_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/70 hover:bg-blue-900 border border-blue-800/80 text-blue-300 text-[10px] font-medium transition" title="Ver captura en TradingView">
           <i data-lucide="external-link" class="w-3 h-3"></i> Gráfico
         </a>`
      : `<span class="text-gray-600 text-[10px]">-</span>`;

    return `
      <tr class="transition hover:bg-gray-800/40">
        <td class="py-2.5 px-3 text-gray-500">${trades.length - idx}</td>
        <td class="py-2.5 px-3 text-gray-300 font-sans text-xs">${t.date || '-'}</td>
        <td class="py-2.5 px-3 text-gray-300 font-sans text-xs font-semibold">${t.session || 'New York'}</td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${assetBadge}
            ${dirBadge}
          </div>
        </td>
        <td class="py-2.5 px-3 text-rose-300 font-bold font-mono">${slText}</td>
        <td class="py-2.5 px-3 text-blue-300 font-bold font-mono">1:${formatRRText(tradeRR)}</td>
        <td class="py-2.5 px-3 text-amber-300 font-mono">$${Number(t.dollar_risk || t.risk_budget || 0).toFixed(2)} <span class="text-[10px] text-amber-400/90 font-bold">(${formatRiskPctText(t.risk_pct || t.risk_pct_custom || 0)}%)</span></td>
        <td class="py-2.5 px-3 text-gold-400 font-bold font-mono">${Number(t.lot_size || t.suggested_lot || 0.01).toFixed(2)}</td>
        <td class="py-2.5 px-3">${badgeOutcome}</td>
        <td class="py-2.5 px-3 text-rose-400 font-mono font-bold">${t.commission ? '-$' + Number(Math.abs(t.commission)).toFixed(2) : '$0.00'}</td>
        <td class="py-2.5 px-3 ${pnlColor}">${pnlSign}$${Number(t.pnl).toFixed(2)}</td>
        <td class="py-2.5 px-3 text-white font-bold font-mono">$${Number(t.balance_after || 0).toFixed(2)}</td>
        <td class="py-2.5 px-3">${chartBtn}</td>
        <td class="py-2.5 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="handleOpenEditModal('${t.id}', 'real')" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gold-400 transition" title="Editar trade">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="handleDeleteTrade('${t.id}', 'real')" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-rose-400 transition" title="Borrar trade">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
  initIcons();
}

// ====================================================
// BITÁCORA REAL TICKMILL — CALCULADORA MULTI-ACTIVO & 1-CLICK
// ====================================================

let selectedRealAsset = 'XAU/USD';

function recalculateRealQuickLot() {
  const balInp = document.getElementById('realCalcBalance');
  const riskInp = document.getElementById('realCalcRiskPct');
  const slInp = document.getElementById('realCalcSlPoints');
  const rrInp = document.getElementById('realCalcRR');

  const s = appState.real.summary || {};
  const currentBal = (s.current_balance !== undefined && s.current_balance !== null) 
    ? Number(s.current_balance) 
    : 97.72;

  let bal = parseFloat(balInp?.value);
  if (isNaN(bal) || bal <= 0) {
    bal = currentBal > 0 ? currentBal : 97.72;
    if (balInp) balInp.value = bal.toFixed(2);
  }

  const isGold = anyStringIncludes(selectedRealAsset, ['XAU', 'GOLD', 'ORO']);
  const isAudUsd = selectedRealAsset.includes('AUD');
  const isEurCad = selectedRealAsset.includes('CAD');

  const riskPct = parseFloat(riskInp?.value) || 1.0;
  const slPts = parseFloat(slInp?.value) || (isGold ? 250 : 25);
  const rr = parseFloat(rrInp?.value) || 2.0;

  const dollarRisk = bal * (riskPct / 100.0);

  // Pérdida por lote según activo:
  // - Oro: 1 punto = $1.00 USD por 1.00 lote
  // - AUD/USD: 1 pip = $10.00 USD por 1.00 lote estándar
  // - EUR/CAD: 1 pip = 10 CAD ≈ $7.20 USD por 1.00 lote estándar (USDCAD 1.39)
  let lossPerLot = slPts * 1.00;
  let pointValue = 1.00;
  let pointUnit = 'pt';
  let marginRequired = 0.0;
  let formulaText = '';

  if (isGold) {
    lossPerLot = slPts * 1.00;
    pointValue = 1.00;
    pointUnit = 'pt';
    formulaText = `Lote = $${dollarRisk.toFixed(2)} / (${slPts} pts × $1.00)`;
  } else if (isAudUsd) {
    lossPerLot = slPts * 10.00;
    pointValue = 10.00;
    pointUnit = 'pip';
    formulaText = `Lote = $${dollarRisk.toFixed(2)} / (${slPts} pips × $10.00)`;
  } else {
    lossPerLot = slPts * 7.20;
    pointValue = 7.20;
    pointUnit = 'pip';
    formulaText = `Lote = $${dollarRisk.toFixed(2)} / (${slPts} pips × $7.20)`;
  }

  const rawLot = (slPts > 0 && lossPerLot > 0) ? (dollarRisk / lossPerLot) : 0.01;
  const recommendedLot = Math.max(0.01, roundNum(rawLot, 2));

  const actualRiskUsd = roundNum(recommendedLot * lossPerLot, 2);
  const actualRiskPct = bal > 0 ? (actualRiskUsd / bal) * 100.0 : 0.0;

  const actualRewardUsd = roundNum(recommendedLot * lossPerLot * rr, 2);
  const actualRewardPct = bal > 0 ? (actualRewardUsd / bal) * 100.0 : 0.0;
  const tpPts = Math.round(slPts * rr);

  // Margen en Tickmill (Apalancamiento 1:500 para Oro y Forex)
  if (isGold) {
    marginRequired = roundNum((2720.0 * 100.0 * recommendedLot) / 500.0, 2);
  } else if (isAudUsd) {
    marginRequired = roundNum((100000.0 * 0.6550 * recommendedLot) / 500.0, 2);
  } else {
    marginRequired = roundNum((100000.0 * 1.0850 * recommendedLot) / 500.0, 2);
  }

  const currentPtVal = roundNum(recommendedLot * pointValue, 2);

  // Elementos del Hero
  const heroLotEl = document.getElementById('realTickmillHeroLot');
  if (heroLotEl) heroLotEl.textContent = recommendedLot.toFixed(2);

  const heroRiskEl = document.getElementById('realHeroRiskUsd');
  if (heroRiskEl) heroRiskEl.textContent = `-$${formatMoney(actualRiskUsd)} (-${actualRiskPct.toFixed(2)}%)`;

  const heroSlSub = document.getElementById('realHeroSlSub');
  if (heroSlSub) {
    heroSlSub.textContent = isGold ? `${slPts} pts ($${(slPts / 100).toFixed(2)})` : `${slPts} pips`;
  }

  const heroRewardEl = document.getElementById('realHeroRewardUsd');
  if (heroRewardEl) heroRewardEl.textContent = `+$${formatMoney(actualRewardUsd)} (+${actualRewardPct.toFixed(2)}%)`;

  const heroTpSub = document.getElementById('realHeroTpSub');
  if (heroTpSub) {
    heroTpSub.textContent = isGold ? `${tpPts} pts (1:${formatRRText(rr)})` : `${tpPts} pips (1:${formatRRText(rr)})`;
  }

  const heroMarginEl = document.getElementById('realHeroMargin');
  if (heroMarginEl) heroMarginEl.textContent = `~$${formatMoney(marginRequired)} USD`;

  const heroPtValEl = document.getElementById('realHeroPointValue');
  if (heroPtValEl) heroPtValEl.textContent = `$${currentPtVal.toFixed(2)} / ${pointUnit}`;

  const heroPtValTitle = document.getElementById('realHeroPtValTitle');
  if (heroPtValTitle) heroPtValTitle.textContent = isGold ? 'VALOR POR PUNTO' : 'VALOR POR PIP';

  const heroPtValSub = document.getElementById('realHeroPtValSub');
  if (heroPtValSub) {
    if (isGold) heroPtValSub.textContent = '100 oz · $1.00/pt por lote';
    else if (isAudUsd) heroPtValSub.textContent = '100k AUD · $10.00/pip por lote';
    else heroPtValSub.textContent = '100k EUR · ~$7.20/pip por lote';
  }

  const formulaExpEl = document.getElementById('realFormulaExplanation');
  if (formulaExpEl) {
    formulaExpEl.innerHTML = `Fórmula Tickmill ${selectedRealAsset}: <code>${formulaText} = <b>${recommendedLot.toFixed(2)} lotes</b></code>`;
  }

  const riskBadge = document.getElementById('realCalcRiskUsdBadge');
  if (riskBadge) riskBadge.textContent = `$${formatMoney(dollarRisk)} USD`;

  const slBadge = document.getElementById('realCalcSlDistBadge');
  if (slBadge) slBadge.textContent = isGold ? `$${(slPts / 100).toFixed(2)} Oro` : `${slPts} pips`;

  const tpBadge = document.getElementById('realCalcTpPtsBadge');
  if (tpBadge) tpBadge.textContent = isGold ? `TP: ${tpPts} pts` : `TP: ${tpPts} pips`;

  const winSub = document.getElementById('realWinRewardSubtext');
  if (winSub) winSub.textContent = `+${actualRewardPct.toFixed(1)}% (+${formatRRText(rr)}R) · +$${formatMoney(actualRewardUsd)}`;

  const lossSub = document.getElementById('realLossRiskSubtext');
  if (lossSub) lossSub.textContent = `-${actualRiskPct.toFixed(1)}% (-1R) · -$${formatMoney(actualRiskUsd)}`;

  const liveHeader = document.getElementById('realLiveBalHeader');
  if (liveHeader) liveHeader.textContent = `$${currentBal.toFixed(2)}`;

  const topRealBal = document.getElementById('badgeTopRealBalance');
  if (topRealBal) topRealBal.textContent = `$${currentBal.toFixed(2)}`;

  return {
    bal,
    riskPct,
    slPts,
    rr,
    recommendedLot,
    actualRiskUsd,
    actualRewardUsd,
    tpPts
  };
}

function setupRealJournalView() {
  // Actualizador dinámico del selector de Activos en Bitácora Real
  function updateRealAssetUI() {
    const isGold = anyStringIncludes(selectedRealAsset, ['XAU', 'GOLD', 'ORO']);
    const isAudUsd = selectedRealAsset.includes('AUD');
    const isEurCad = selectedRealAsset.includes('CAD');

    // Botones de Activo
    document.querySelectorAll('.btn-real-asset').forEach(btn => {
      const a = btn.dataset.asset;
      const isSel = (a === selectedRealAsset);
      if (isSel) {
        if (a && a.includes('AUD')) {
          btn.className = 'btn-real-asset px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm shadow-blue-500/20';
        } else if (a && a.includes('CAD')) {
          btn.className = 'btn-real-asset px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/20';
        } else {
          btn.className = 'btn-real-asset px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20';
        }
      } else {
        btn.className = 'btn-real-asset px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 border border-gray-700';
      }
    });

    // Etiquetas y sufijos de Stop Loss
    const slLabel = document.getElementById('realCalcSlLabel');
    const slSuffix = document.getElementById('realCalcSlSuffix');
    if (slLabel) slLabel.textContent = isGold ? '3. Stop Loss en Puntos (Oro)' : `3. Stop Loss en Pips (${isAudUsd ? 'AUD/USD' : 'EUR/CAD'})`;
    if (slSuffix) slSuffix.textContent = isGold ? 'pts' : 'pips';

    // Chips dinámicos para SL
    const chipsContainer = document.getElementById('realCalcSlChips');
    const slInp = document.getElementById('realCalcSlPoints');
    if (chipsContainer && slInp) {
      const currentSl = parseFloat(slInp.value) || (isGold ? 250 : 25);
      const presets = isGold ? [150, 200, 250, 300, 400] : [15, 20, 25, 30, 40];
      chipsContainer.innerHTML = presets.map(v => {
        const isSel = (v === currentSl);
        const cls = isSel 
          ? 'btn-real-chip-sl py-1 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 transition text-center cursor-pointer'
          : 'btn-real-chip-sl py-1 rounded text-[9px] font-mono font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition text-center cursor-pointer';
        return `<button type="button" class="${cls}" data-val="${v}">${v}</button>`;
      }).join('');

      chipsContainer.querySelectorAll('.btn-real-chip-sl').forEach(c => {
        c.addEventListener('click', (e) => {
          e.preventDefault();
          const val = parseFloat(c.dataset.val);
          slInp.value = val;
          updateRealAssetUI();
          recalculateRealQuickLot();
        });
      });
    }

    // Sincronizar select en formulario manual
    const tradeAssetSelect = document.getElementById('realTradeAsset');
    if (tradeAssetSelect) tradeAssetSelect.value = selectedRealAsset;

    recalculateRealQuickLot();
  }

  // Event listener para botones de activo
  document.querySelectorAll('.btn-real-asset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedRealAsset = btn.dataset.asset || 'XAU/USD';
      const isGold = anyStringIncludes(selectedRealAsset, ['XAU', 'GOLD', 'ORO']);
      const slInp = document.getElementById('realCalcSlPoints');
      if (slInp) {
        const curVal = parseFloat(slInp.value) || 250;
        if (isGold && curVal < 100) slInp.value = 250;
        else if (!isGold && curVal >= 100) slInp.value = 25;
      }
      updateRealAssetUI();
    });
  });

  // Preset Chips: Balance
  document.querySelectorAll('.btn-real-chip-bal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.val);
      const inp = document.getElementById('realCalcBalance');
      if (inp) {
        inp.value = val;
        recalculateRealQuickLot();
      }
    });
  });

  // Preset Chips: % Riesgo
  document.querySelectorAll('.btn-real-chip-risk').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.val);
      const inp = document.getElementById('realCalcRiskPct');
      if (inp) {
        inp.value = val;
        document.querySelectorAll('.btn-real-chip-risk').forEach(c => {
          c.className = 'btn-real-chip-risk py-1 rounded text-[9px] font-mono font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition text-center cursor-pointer';
        });
        btn.className = 'btn-real-chip-risk py-1 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 transition text-center cursor-pointer';
        recalculateRealQuickLot();
      }
    });
  });

  // Preset Chips: Stop Loss iniciales
  document.querySelectorAll('.btn-real-chip-sl').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.val);
      const inp = document.getElementById('realCalcSlPoints');
      if (inp) {
        inp.value = val;
        updateRealAssetUI();
        recalculateRealQuickLot();
      }
    });
  });

  // Preset Chips: R:R
  document.querySelectorAll('.btn-real-chip-rr').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseFloat(btn.dataset.val);
      const inp = document.getElementById('realCalcRR');
      if (inp) {
        inp.value = val;
        document.querySelectorAll('.btn-real-chip-rr').forEach(c => {
          c.className = 'btn-real-chip-rr py-1 rounded text-[10px] font-mono font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition text-center cursor-pointer';
        });
        btn.className = 'btn-real-chip-rr py-1 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 transition text-center cursor-pointer';
        recalculateRealQuickLot();
      }
    });
  });

  // Live input events para inputs directos
  ['realCalcBalance', 'realCalcRiskPct', 'realCalcSlPoints', 'realCalcRR'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', recalculateRealQuickLot);
      el.addEventListener('change', recalculateRealQuickLot);
    }
  });

  // Botón Copiar Lote al Portapapeles
  const btnCopyLot = document.getElementById('btnCopyRealLot');
  if (btnCopyLot) {
    btnCopyLot.addEventListener('click', () => {
      const heroLotEl = document.getElementById('realTickmillHeroLot');
      const lot = heroLotEl ? heroLotEl.textContent.trim() : '0.01';
      navigator.clipboard.writeText(lot).then(() => {
        showToast(`📋 ¡Lotaje copiado: ${lot}! Pégalo en tu orden de Tickmill MT4/MT5 (${selectedRealAsset}).`, 'success', 4000);
      }).catch(() => {
        showToast(`Lotaje Tickmill: ${lot}`, 'info');
      });
    });
  }

  // Helper para Registrar Trade Rápido 1-Click en Bitácora Real
  async function submitQuickRealTrade(status) {
    const calc = recalculateRealQuickLot();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // Tickmill comisión estándar: -$0.06 por 0.01 lote (-$6.00 por lote estándar)
    const comm = -roundNum(0.06 * Math.round(calc.recommendedLot / 0.01), 2);

    const payload = {
      mode: 'real',
      asset: selectedRealAsset,
      status: status,
      direction: status === 'loss' ? 'SELL' : 'BUY',
      rr: calc.rr,
      risk_pct: calc.riskPct,
      sl_points: calc.slPts,
      sl_pips: calc.slPts,
      tv_points: calc.slPts,
      lot_size: calc.recommendedLot,
      manual_lot: calc.recommendedLot,
      commission: comm,
      date: dateStr,
      session: 'New York',
      strategy: `Price Action Tickmill (${selectedRealAsset})`,
      emotion: 'Plan Seguido',
      notes: `Tickmill ${selectedRealAsset} (${status.toUpperCase()} ${status === 'win' ? '+' + calc.rr + 'R' : (status === 'loss' ? '-1R' : 'BE')})`
    };

    try {
      const res = await fetch('/api/trades?mode=real', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analytics) {
          appState.real.summary = data.analytics.summary || {};
          appState.real.equityCurve = data.analytics.equity_curve || [];
          appState.real.trades = data.analytics.trades || [];
        } else {
          await loadTrades('real');
        }
        renderRealJournalDashboard();
        recalculateRealQuickLot();
        showToast(`Operación Real registrada: ${status.toUpperCase()} (${calc.recommendedLot} lotes)`, 'success', 3500);
      }
    } catch (err) {
      console.error('Error registrando trade real:', err);
      showToast('Error al registrar operación real', 'error');
    }
  }

  const btnWin = document.getElementById('btnRealQuickWin');
  if (btnWin) btnWin.addEventListener('click', () => submitQuickRealTrade('win'));
  const btnLoss = document.getElementById('btnRealQuickLoss');
  if (btnLoss) btnLoss.addEventListener('click', () => submitQuickRealTrade('loss'));
  const btnBe = document.getElementById('btnRealQuickBe');
  if (btnBe) btnBe.addEventListener('click', () => submitQuickRealTrade('be'));

  // Sincronizar Balance y Métricas Reales
  const btnSync = document.getElementById('btnSyncRealBalance');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      btnSync.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Sincronizando...</span>';
      initIcons();
      await loadTrades('real');
      renderRealJournalDashboard();
      recalculateRealQuickLot();
      btnSync.disabled = false;
      btnSync.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Sincronizar</span>';
      initIcons();
      showToast('Datos de Bitácora Real sincronizados correctamente', 'success');
    });
  }

  // Limpiar Operaciones de la Cuenta Real
  const btnClear = document.getElementById('btnClearRealData');
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de que deseas limpiar el historial de operaciones de tu Bitácora Real?')) {
        try {
          const res = await fetch('/api/trades/clear?mode=real', { method: 'POST' });
          if (res.ok) {
            localStorage.removeItem('cached_real_trades_v2');
            localStorage.removeItem('cached_real_trades');
            appState.real.trades = [];
            appState.real.summary = {};
            await loadTrades('real');
            renderRealJournalDashboard();
            recalculateRealQuickLot();
            showToast('Historial real reiniciado', 'info');
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  // Inicializar UI de activos y cálculo al iniciar
  updateRealAssetUI();
  recalculateRealQuickLot();
}

// ----------------------------------------------------
// Chart.js Setup
// ----------------------------------------------------
function initCharts() {
  const equityCanvas = document.getElementById('equityChart');
  const distCanvas = document.getElementById('distributionChart');
  const ddCanvas = document.getElementById('drawdownChart');

  if (!equityCanvas || !distCanvas || !ddCanvas) return;
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, skipping chart initialization');
    return;
  }

  const equityCtx = equityCanvas.getContext('2d');
  const distCtx = distCanvas.getContext('2d');
  const ddCtx = ddCanvas.getContext('2d');

  equityChart = new Chart(equityCtx, {
    type: 'line',
    data: {
      labels: ['Inicio'],
      datasets: [
        {
          label: 'Balance ($ USD)',
          data: [110],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 2.5,
          tension: 0.25,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10B981'
        },
        {
          label: 'Base Inicial',
          data: [110],
          borderColor: 'rgba(156, 163, 175, 0.35)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` Balance: $${Number(ctx.parsed.y).toFixed(2)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(31, 41, 55, 0.5)' },
          ticks: { color: '#6B7280', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(31, 41, 55, 0.5)' },
          ticks: {
            color: '#6B7280',
            font: { size: 10 },
            callback: (val) => `$${val}`
          }
        }
      }
    }
  });

  distributionChart = new Chart(distCtx, {
    type: 'doughnut',
    data: {
      labels: ['Ganadas', 'Perdidas', 'Breakeven'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#089981', '#F23645', '#4B5563'],
        borderWidth: 2,
        borderColor: '#111827'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9CA3AF', font: { size: 10 }, boxWidth: 10 }
        }
      }
    }
  });

  drawdownChart = new Chart(ddCtx, {
    type: 'line',
    data: {
      labels: ['Inicio'],
      datasets: [{
        label: 'Drawdown %',
        data: [0],
        borderColor: '#F23645',
        backgroundColor: 'rgba(242, 54, 69, 0.15)',
        borderWidth: 1.5,
        fill: true,
        pointRadius: 0,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          reverse: true,
          grid: { color: 'rgba(31, 41, 55, 0.4)' },
          ticks: {
            color: '#F23645',
            font: { size: 9 },
            callback: (v) => `-${v}%`
          }
        }
      }
    }
  });

  const btEquityCanvas = document.getElementById('backtestEquityChart');
  const btDistCanvas = document.getElementById('backtestDistributionChart');
  const btDdCanvas = document.getElementById('backtestDrawdownChart');

  if (btEquityCanvas && btDistCanvas && btDdCanvas) {
    const btEquityCtx = btEquityCanvas.getContext('2d');
    const btDistCtx = btDistCanvas.getContext('2d');
    const btDdCtx = btDdCanvas.getContext('2d');

    backtestEquityChart = new Chart(btEquityCtx, {
      type: 'line',
      data: {
        labels: ['Inicio'],
        datasets: [
          {
            label: 'Balance Backtest ($)',
            data: [110],
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            borderWidth: 2.5,
            tension: 0.25,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3B82F6'
          },
          {
            label: 'Base Inicial',
            data: [110],
            borderColor: 'rgba(156, 163, 175, 0.35)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: '#1E40AF',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => ` Balance: $${Number(ctx.parsed.y).toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(31, 41, 55, 0.5)' },
            ticks: { color: '#6B7280', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(31, 41, 55, 0.5)' },
            ticks: {
              color: '#6B7280',
              font: { size: 10 },
              callback: (val) => `$${val}`
            }
          }
        }
      }
    });

    backtestDistributionChart = new Chart(btDistCtx, {
      type: 'doughnut',
      data: {
        labels: ['Ganadas', 'Perdidas', 'Breakeven'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: ['#089981', '#F23645', '#4B5563'],
          borderWidth: 2,
          borderColor: '#111827'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9CA3AF', font: { size: 10 }, boxWidth: 10 }
          }
        }
      }
    });

    backtestDrawdownChart = new Chart(btDdCtx, {
      type: 'line',
      data: {
        labels: ['Inicio'],
        datasets: [{
          label: 'Drawdown %',
          data: [0],
          borderColor: '#F23645',
          backgroundColor: 'rgba(242, 54, 69, 0.15)',
          borderWidth: 1.5,
          fill: true,
          pointRadius: 0,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            reverse: true,
            grid: { color: 'rgba(31, 41, 55, 0.4)' },
            ticks: {
              color: '#F23645',
              font: { size: 9 },
              callback: (v) => `-${v}%`
            }
          }
        }
      }
    });
  }
}

function updateBacktestCharts() {
  updateBacktestSimpleCharts();
  const curve = appState.backtest.equityCurve || [];
  const s = appState.backtest.summary || {};
  const initial = s.initial_balance !== undefined ? s.initial_balance : (appState.config.initial_balance || 110);
  const wins = s.wins || 0;
  const losses = s.losses || 0;
  const be = s.breakevens || 0;

  if (backtestEquityChart) {
    if (curve.length === 0) {
      backtestEquityChart.data.labels = ['Inicio'];
      backtestEquityChart.data.datasets[0].data = [initial];
      backtestEquityChart.data.datasets[1].data = [initial];
    } else {
      backtestEquityChart.data.labels = curve.map(c => c.trade_num === 0 ? 'Inicio' : `T#${c.trade_num}`);
      const balances = curve.map(c => c.balance);
      backtestEquityChart.data.datasets[0].data = balances;
      backtestEquityChart.data.datasets[1].data = curve.map(() => initial);

      const current = balances[balances.length - 1];
      const color = current >= initial ? '#3B82F6' : '#F23645';
      const bg = current >= initial ? 'rgba(59, 130, 246, 0.15)' : 'rgba(242, 54, 69, 0.12)';
      backtestEquityChart.data.datasets[0].borderColor = color;
      backtestEquityChart.data.datasets[0].backgroundColor = bg;
      backtestEquityChart.data.datasets[0].pointBackgroundColor = color;
    }
    backtestEquityChart.update();
  }

  if (backtestDistributionChart) {
    backtestDistributionChart.data.datasets[0].data = [wins, losses, be];
    const donutEl = document.getElementById('backtestDonutTotalCount');
    if (donutEl) donutEl.textContent = `${wins + losses + be} trades`;
    backtestDistributionChart.update();
  }

  if (backtestDrawdownChart) {
    if (curve.length === 0) {
      backtestDrawdownChart.data.labels = ['Inicio'];
      backtestDrawdownChart.data.datasets[0].data = [0];
    } else {
      backtestDrawdownChart.data.labels = curve.map(c => c.trade_num);
      backtestDrawdownChart.data.datasets[0].data = curve.map(c => c.drawdown_pct);
    }
    backtestDrawdownChart.update();
  }
}

function updateCharts() {
  const targetState = appState.real;
  const curve = targetState.equityCurve || [];
  const s = targetState.summary || {};
  const initial = s.initial_balance !== undefined ? s.initial_balance : (appState.config.initial_balance || 110);
  const wins = s.wins || 0;
  const losses = s.losses || 0;
  const be = s.breakevens || 0;

  if (equityChart) {
    if (curve.length === 0) {
      equityChart.data.labels = ['Inicio'];
      equityChart.data.datasets[0].data = [initial];
      equityChart.data.datasets[1].data = [initial];
    } else {
      equityChart.data.labels = curve.map(c => c.trade_num === 0 ? 'Inicio' : `T#${c.trade_num}`);
      const balances = curve.map(c => c.balance);
      equityChart.data.datasets[0].data = balances;
      equityChart.data.datasets[1].data = curve.map(() => initial);

      const current = balances[balances.length - 1];
      const color = current >= initial ? '#10B981' : '#F23645';
      const bg = current >= initial ? 'rgba(16, 185, 129, 0.12)' : 'rgba(242, 54, 69, 0.12)';
      equityChart.data.datasets[0].borderColor = color;
      equityChart.data.datasets[0].backgroundColor = bg;
      equityChart.data.datasets[0].pointBackgroundColor = color;
    }
    equityChart.update();
  }

  if (distributionChart) {
    distributionChart.data.datasets[0].data = [wins, losses, be];
    document.getElementById('donutTotalCount').textContent = `${wins + losses + be} trades`;
    distributionChart.update();
  }

  if (drawdownChart) {
    if (curve.length === 0) {
      drawdownChart.data.labels = ['Inicio'];
      drawdownChart.data.datasets[0].data = [0];
    } else {
      drawdownChart.data.labels = curve.map(c => c.trade_num);
      drawdownChart.data.datasets[0].data = curve.map(c => c.drawdown_pct);
    }
    drawdownChart.update();
  }
}

// ----------------------------------------------------
// Event Listeners Setup
// ----------------------------------------------------
function setupEventListeners() {
  // Backtest Buy/Sell Buttons (if present)
  const btnBuy = document.getElementById('btnDirBuy');
  const btnSell = document.getElementById('btnDirSell');
  const dirInput = document.getElementById('tradeDirection');

  if (btnBuy && btnSell && dirInput) {
    btnBuy.addEventListener('click', () => {
      dirInput.value = 'BUY';
      btnBuy.className = 'py-2.5 rounded-lg text-center font-bold text-xs bg-tvGreen text-white shadow transition flex items-center justify-center gap-1';
      btnSell.className = 'py-2.5 rounded-lg text-center font-bold text-xs text-gray-400 hover:text-white transition flex items-center justify-center gap-1';
    });

    btnSell.addEventListener('click', () => {
      dirInput.value = 'SELL';
      btnSell.className = 'py-2.5 rounded-lg text-center font-bold text-xs bg-tvRed text-white shadow transition flex items-center justify-center gap-1';
      btnBuy.className = 'py-2.5 rounded-lg text-center font-bold text-xs text-gray-400 hover:text-white transition flex items-center justify-center gap-1';
    });
  }

  // Real Journal Buy/Sell Buttons
  const btnRealBuy = document.getElementById('btnRealDirBuy');
  const btnRealSell = document.getElementById('btnRealDirSell');
  const realDirInput = document.getElementById('realTradeDirection');

  if (btnRealBuy && btnRealSell && realDirInput) {
    btnRealBuy.addEventListener('click', () => {
      realDirInput.value = 'BUY';
      btnRealBuy.className = 'py-1.5 rounded-lg text-center font-bold text-xs bg-tvGreen text-white shadow transition flex items-center justify-center';
      btnRealSell.className = 'py-1.5 rounded-lg text-center font-bold text-xs text-gray-400 hover:text-white transition flex items-center justify-center';
      recalculateRealJournalPreview();
    });
    btnRealSell.addEventListener('click', () => {
      realDirInput.value = 'SELL';
      btnRealSell.className = 'py-1.5 rounded-lg text-center font-bold text-xs bg-tvRed text-white shadow transition flex items-center justify-center';
      btnRealBuy.className = 'py-1.5 rounded-lg text-center font-bold text-xs text-gray-400 hover:text-white transition flex items-center justify-center';
      recalculateRealJournalPreview();
    });
  }

  // Botón para fijar fecha y hora actual en la Bitácora Real
  const btnSetRealDate = document.getElementById('btnSetRealTradeDateNow');
  if (btnSetRealDate) {
    btnSetRealDate.addEventListener('click', () => {
      setCurrentDateTime(true);
    });
  }

  // Backtest points change (if present)
  const tvPtsInput = document.getElementById('tradeTvPoints');
  const tvRRInput = document.getElementById('tradeSpecificRR');
  if (tvPtsInput) tvPtsInput.addEventListener('input', recalculateTradingViewValues);
  if (tvRRInput) tvRRInput.addEventListener('input', recalculateTradingViewValues);

  // Quick buttons for Backtest Stop Loss points
  document.querySelectorAll('.btnQuickTv').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btnQuickTv').forEach(b => {
        b.className = 'btnQuickTv px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[10px] font-mono';
      });
      btn.className = 'btnQuickTv px-1.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded text-[10px] font-mono font-bold';
      const ptInput = document.getElementById('tradeTvPoints');
      if (ptInput) ptInput.value = btn.dataset.val;
      recalculateTradingViewValues();
    });
  });

  const btnUseAvgSl = document.getElementById('btnUseAvgSl');
  if (btnUseAvgSl) {
    btnUseAvgSl.addEventListener('click', () => {
      const avg = (appState.backtest.summary && appState.backtest.summary.avg_sl_points) ? appState.backtest.summary.avg_sl_points : 250;
      const ptInput = document.getElementById('tradeTvPoints');
      if (ptInput) ptInput.value = avg;
      recalculateTradingViewValues();
    });
  }

  // Dynamic Recalculation Console Controls (if present)
  const globalInitialInput = document.getElementById('globalInitialInput');
  const globalRiskInput = document.getElementById('globalRiskInput');
  const globalRRInput = document.getElementById('globalRRInput');

  function getActiveConsoleValues() {
    const init = parseFloat(globalInitialInput ? globalInitialInput.value : null) || parseFloat(appState.config.initial_balance) || 110.0;
    const risk = parseFloat(globalRiskInput ? globalRiskInput.value : null) || parseFloat(appState.config.risk_pct) || 5.0;
    const rr = parseFloat(globalRRInput ? globalRRInput.value : null) || parseFloat(appState.config.rr_ratio) || 1.0;
    return { init, risk, rr };
  }

  if (globalInitialInput) {
    globalInitialInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        document.querySelectorAll('.btnQuickInitial').forEach(b => {
          b.className = parseFloat(b.dataset.initial) === val
            ? 'btnQuickInitial px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/50 rounded text-xs font-mono font-bold'
            : 'btnQuickInitial px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono text-gray-300';
        });
        const { risk, rr } = getActiveConsoleValues();
        triggerRecalculate(risk, rr, val);
      }
    });

    document.querySelectorAll('.btnQuickInitial').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btnQuickInitial').forEach(b => {
          b.className = 'btnQuickInitial px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono text-gray-300';
        });
        btn.className = 'btnQuickInitial px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/50 rounded text-xs font-mono font-bold';
        const initVal = parseFloat(btn.dataset.initial);
        globalInitialInput.value = initVal;
        const { risk, rr } = getActiveConsoleValues();
        triggerRecalculate(risk, rr, initVal);
      });
    });
  }

  if (globalRiskInput) {
    globalRiskInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        document.querySelectorAll('.btnQuickRisk').forEach(b => {
          b.className = parseFloat(b.dataset.risk) === val
            ? 'btnQuickRisk px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/50 rounded text-xs font-mono font-bold'
            : 'btnQuickRisk px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono text-gray-300';
        });
        const { init, rr } = getActiveConsoleValues();
        triggerRecalculate(val, rr, init);
      }
    });

    document.querySelectorAll('.btnQuickRisk').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btnQuickRisk').forEach(b => {
          b.className = 'btnQuickRisk px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono text-gray-300';
        });
        btn.className = 'btnQuickRisk px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/50 rounded text-xs font-mono font-bold';
        const riskVal = parseFloat(btn.dataset.risk);
        globalRiskInput.value = riskVal.toFixed(1);
        const { init, rr } = getActiveConsoleValues();
        triggerRecalculate(riskVal, rr, init);
      });
    });
  }

  if (globalRRInput) {
    globalRRInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        document.querySelectorAll('.btnQuickRR').forEach(b => {
          b.className = parseFloat(b.dataset.rr) === val
            ? 'btnQuickRR px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/50 rounded text-xs font-mono font-bold'
            : 'btnQuickRR px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono text-gray-300';
        });
        const { init, risk } = getActiveConsoleValues();
        triggerRecalculate(risk, val, init);
      }
    });

    document.querySelectorAll('.btnQuickRR').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btnQuickRR').forEach(b => {
          b.className = 'btnQuickRR px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono text-gray-300';
        });
        btn.className = 'btnQuickRR px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/50 rounded text-xs font-mono font-bold';
        const rrVal = parseFloat(btn.dataset.rr);
        globalRRInput.value = rrVal.toFixed(1);
        const { init, risk } = getActiveConsoleValues();
        triggerRecalculate(risk, rrVal, init);
      });
    });
  }

  // Backtest Submit (if present)
  const tradeForm = document.getElementById('tradeForm');
  if (tradeForm) {
    tradeForm.addEventListener('submit', handleAddBacktestTrade);

    const bPts = document.getElementById('tradeTvPoints');
    if (bPts) bPts.addEventListener('input', recalculateTradingViewValues);
    const bRisk = document.getElementById('tradeRiskPct');
    if (bRisk) bRisk.addEventListener('input', recalculateTradingViewValues);
    const bRR = document.getElementById('tradeSpecificRR');
    if (bRR) bRR.addEventListener('input', recalculateTradingViewValues);
    const bLot = document.getElementById('tradeManualLot');
    if (bLot) bLot.addEventListener('input', recalculateTradingViewValues);

    const btnSetDate = document.getElementById('btnSetBacktestDateNow');
    if (btnSetDate) {
      btnSetDate.addEventListener('click', () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const d = document.getElementById('tradeDate');
        if (d) d.value = formatted;
      });
    }

    const btnUpdateBtBal = document.getElementById('btnUpdateBacktestBal');
    if (btnUpdateBtBal) {
      btnUpdateBtBal.addEventListener('click', async () => {
        const input = document.getElementById('backtestInitialBalInput');
        const val = parseFloat(input?.value);
        if (isNaN(val) || val <= 0) {
          alert('Por favor ingresa un balance inicial válido');
          return;
        }
        try {
          const res = await fetch('/api/recalculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'backtest', initial_balance: val })
          });
          if (res.ok) {
            const data = await res.json();
            appState.backtest.summary = data.summary;
            appState.backtest.equityCurve = data.equity_curve;
            appState.backtest.trades = data.trades;
            renderBacktestDashboard();
            recalculateTradingViewValues();
          }
        } catch (err) {
          console.error('Error al actualizar balance backtest:', err);
        }
      });
    }
  }

  // Real Journal Submit
  const realTradeForm = document.getElementById('realTradeForm');
  if (realTradeForm) {
    realTradeForm.addEventListener('submit', handleAddRealTrade);
    const rPts = document.getElementById('realTradeTvPoints');
    if (rPts) rPts.addEventListener('input', recalculateRealJournalPreview);
    const rRisk = document.getElementById('realTradeRiskPct');
    if (rRisk) rRisk.addEventListener('input', recalculateRealJournalPreview);
    const rRR = document.getElementById('realTradeRR');
    if (rRR) rRR.addEventListener('input', recalculateRealJournalPreview);
    const rLot = document.getElementById('realTradeManualLot');
    if (rLot) rLot.addEventListener('input', recalculateRealJournalPreview);
    const rComm = document.getElementById('realTradeCommission');
    if (rComm) rComm.addEventListener('input', recalculateRealJournalPreview);

    // Price inputs (Entry, SL, TP, Exit)
    ['realTradeEntry', 'realTradeSl', 'realTradeTp', 'realTradeExit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', recalculateRealJournalPreview);
        el.addEventListener('change', recalculateRealJournalPreview);
      }
    });

    // Helper buttons for Exit (TP, SL, BE)
    const btnRealTp = document.getElementById('btnRealExitTp');
    const btnRealSl = document.getElementById('btnRealExitSl');
    const btnRealBe = document.getElementById('btnRealExitBe');
    if (btnRealTp) {
      btnRealTp.addEventListener('click', () => {
        const tpVal = document.getElementById('realTradeTp')?.value;
        const exitEl = document.getElementById('realTradeExit');
        if (tpVal && exitEl) {
          exitEl.value = tpVal;
          recalculateRealJournalPreview();
        }
      });
    }
    if (btnRealSl) {
      btnRealSl.addEventListener('click', () => {
        const slVal = document.getElementById('realTradeSl')?.value;
        const exitEl = document.getElementById('realTradeExit');
        if (slVal && exitEl) {
          exitEl.value = slVal;
          recalculateRealJournalPreview();
        }
      });
    }
    if (btnRealBe) {
      btnRealBe.addEventListener('click', () => {
        const entryVal = document.getElementById('realTradeEntry')?.value;
        const exitEl = document.getElementById('realTradeExit');
        if (entryVal && exitEl) {
          exitEl.value = entryVal;
          recalculateRealJournalPreview();
        }
      });
    }
  }

  // Clear Button
  const btnClear = document.getElementById('btnClearData');
  if (btnClear) {
    btnClear.addEventListener('click', handleClearData);
  }

  // Backtest Table Filters (if present)
  const filterAll = document.getElementById('filterAll');
  if (filterAll) filterAll.addEventListener('click', () => setBacktestFilter('all'));
  const filterWins = document.getElementById('filterWins');
  if (filterWins) filterWins.addEventListener('click', () => setBacktestFilter('win'));
  const filterLosses = document.getElementById('filterLosses');
  if (filterLosses) filterLosses.addEventListener('click', () => setBacktestFilter('loss'));

  // CSV & JSON Export Buttons
  const btnExport = document.getElementById('btnExportCsv');
  if (btnExport) {
    btnExport.addEventListener('click', () => exportTradesToCsv('backtest'));
  }
  const btnExportReal = document.getElementById('btnExportRealCsv');
  if (btnExportReal) {
    btnExportReal.addEventListener('click', () => exportTradesToCsv('real'));
  }
  const btnExportRealJson = document.getElementById('btnExportRealJson');
  if (btnExportRealJson) {
    btnExportRealJson.addEventListener('click', () => exportTradesToJson('real'));
  }

  // Calculator Listeners (Bitácora Real)
  const calcBal = document.getElementById('calcBalInput');
  const calcRisk = document.getElementById('calcRiskPctInput');
  const calcSl = document.getElementById('calcSlPointsInput');
  const calcRR = document.getElementById('calcRRInput');

  if (calcBal) calcBal.addEventListener('input', runRealCalculator);
  if (calcRisk) calcRisk.addEventListener('input', runRealCalculator);
  if (calcSl) calcSl.addEventListener('input', runRealCalculator);
  if (calcRR) calcRR.addEventListener('input', runRealCalculator);

  const btnSyncBal = document.getElementById('btnSyncBalToCalc');
  if (btnSyncBal) {
    btnSyncBal.addEventListener('click', () => {
      const realBal = (appState.real.summary && appState.real.summary.current_balance !== undefined) 
        ? appState.real.summary.current_balance 
        : (parseFloat(appState.config.initial_balance) || 115.64);
      if (calcBal) calcBal.value = Number(realBal).toFixed(2);
      runRealCalculator();
      showToast(`Balance real ($${realBal.toFixed(2)}) sincronizado.`, 'success', 2000);
    });
  }

  const btnCopyLot = document.getElementById('btnCopyLot');
  if (btnCopyLot) {
    btnCopyLot.addEventListener('click', () => {
      const lotVal = document.getElementById('myfxHeroLot')?.textContent || '0.01';
      navigator.clipboard.writeText(lotVal).then(() => {
        const textSpan = document.getElementById('btnCopyLotText');
        if (textSpan) {
          const orig = textSpan.textContent;
          textSpan.textContent = '¡Copiado!';
          setTimeout(() => { textSpan.textContent = orig; }, 1800);
        }
      }).catch(err => console.warn('Clipboard failed:', err));
    });
  }

  const btnCopyCalc = document.getElementById('btnCopyCalcToJournal');
  if (btnCopyCalc) {
    btnCopyCalc.addEventListener('click', () => {
      const pts = document.getElementById('calcSlPointsInput')?.value || '250';
      const risk = document.getElementById('calcRiskPctInput')?.value || '10.0';
      const rr = document.getElementById('calcRRInput')?.value || '2.0';
      const heroLot = document.getElementById('myfxHeroLot')?.textContent || '0.01';

      const realPts = document.getElementById('realTradeTvPoints');
      if (realPts) realPts.value = pts;
      const realRisk = document.getElementById('realTradeRiskPct');
      if (realRisk) realRisk.value = risk;
      const realRR = document.getElementById('realTradeRR');
      if (realRR) realRR.value = rr;
      const realLot = document.getElementById('realTradeManualLot');
      if (realLot) realLot.value = heroLot;

      switchTab('real');
      recalculateRealJournalPreview();
      showToast('📋 Parámetros transferidos a la Bitácora Real.', 'success', 3500);
    });
  }

  // Settings Modal
  const modalSettings = document.getElementById('modalSettings');
  document.getElementById('btnOpenSettings').addEventListener('click', () => {
    modalSettings.classList.remove('hidden');
    initIcons();
  });
  document.getElementById('btnCloseSettings').addEventListener('click', () => modalSettings.classList.add('hidden'));
  document.getElementById('btnSaveSettings').addEventListener('click', handleSaveSettings);

  // Edit Trade Modal
  const modalEdit = document.getElementById('modalEditTrade');
  document.getElementById('btnCloseEditModal').addEventListener('click', () => modalEdit.classList.add('hidden'));
  document.getElementById('btnCancelEditTrade').addEventListener('click', () => modalEdit.classList.add('hidden'));
  document.getElementById('btnSaveEditedTrade').addEventListener('click', handleSaveEditedTrade);
}

function setBacktestFilter(filter) {
  appState.backtest.filter = filter;
  const btnAll = document.getElementById('filterAll');
  const btnWins = document.getElementById('filterWins');
  const btnLosses = document.getElementById('filterLosses');

  btnAll.className = filter === 'all' 
    ? 'px-2.5 py-1 rounded text-white font-semibold bg-gray-800' 
    : 'px-2.5 py-1 rounded text-gray-400 hover:text-white';
  btnWins.className = filter === 'win' 
    ? 'px-2.5 py-1 rounded text-emerald-400 font-semibold bg-gray-800' 
    : 'px-2.5 py-1 rounded text-gray-400 hover:text-emerald-400';
  btnLosses.className = filter === 'loss' 
    ? 'px-2.5 py-1 rounded text-rose-400 font-semibold bg-gray-800' 
    : 'px-2.5 py-1 rounded text-gray-400 hover:text-rose-400';

  renderBacktestTradesTable();
  updateCalculatorBalances();
  initIcons();
}

// ----------------------------------------------------
// Handlers: Add Trades
// ----------------------------------------------------
async function handleAddBacktestTrade(e) {
  e.preventDefault();

  const curBal = (appState.backtest.summary && appState.backtest.summary.current_balance !== undefined) 
    ? appState.backtest.summary.current_balance 
    : (parseFloat(appState.config.initial_balance) || 110.0);

  const direction = document.getElementById('tradeDirection')?.value || 'BUY';
  const tradeRR = roundNum(parseFloat(String(document.getElementById('tradeSpecificRR')?.value).replace(',', '.')) || parseFloat(appState.config.rr_ratio) || 2.0, 2);
  const riskPct = roundNum(parseFloat(String(document.getElementById('tradeRiskPct')?.value).replace(',', '.')) || parseFloat(appState.config.risk_pct) || 5.0, 2);

  const statusRadio = document.querySelector('input[name="tradeResult"]:checked');
  const status = statusRadio ? statusRadio.value : 'win';

  // Pure % Compounding: balance x % de riesgo
  let retPct = 0.0;
  if (status === 'win') {
    retPct = roundNum(riskPct * tradeRR, 2);
  } else if (status === 'loss') {
    retPct = -roundNum(riskPct, 2);
  }
  const dollarRisk = roundNum(curBal * (riskPct / 100.0), 2);
  const pnl = roundNum(curBal * (retPct / 100.0), 2);

  const payload = {
    mode: 'backtest',
    direction,
    risk_pct: riskPct,
    risk_pct_custom: riskPct,
    ret_pct: retPct,
    dollar_risk: dollarRisk,
    status,
    pnl,
    rr: tradeRR
  };

  try {
    const res = await fetch('/api/trades?mode=backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      appState.backtest.summary = data.analytics.summary;
      appState.backtest.equityCurve = data.analytics.equity_curve;
      appState.backtest.trades = data.analytics.trades;
      
      renderBacktestDashboard();
      recalculateTradingViewValues();
      updateCalculatorBalances();
      showToast('✅ Operación registrada al Backtest con éxito.', 'success', 2500);
    }
  } catch (err) {
    console.error('Error al guardar trade:', err);
    alert('Error al registrar la operación al backtest');
  }
}

async function handleAddRealTrade(e) {
  e.preventDefault();

  const curBal = (appState.real.summary && appState.real.summary.current_balance !== undefined) 
    ? appState.real.summary.current_balance 
    : appState.config.initial_balance;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const inputDate = document.getElementById('realTradeDate')?.value?.trim();
  const date = inputDate || defaultDate;
  const session = 'New York';
  const direction = document.getElementById('realTradeDirection')?.value || 'BUY';
  const asset = document.getElementById('realTradeAsset')?.value || selectedRealAsset || 'XAU/USD';
  const isGold = anyStringIncludes(asset, ['XAU', 'GOLD', 'ORO']);
  const isAudUsd = asset.includes('AUD');
  const isEurCad = asset.includes('CAD');

  const rawInput = document.getElementById('realTradeTvPoints')?.value || '250';
  const { points, price } = parseTradingViewInput(rawInput);

  const riskPctRaw = document.getElementById('realTradeRiskPct')?.value || '5.0';
  const riskPct = roundNum(parseFloat(String(riskPctRaw).replace(',', '.').trim()) || 5.0, 2);
  const rrRaw = document.getElementById('realTradeRR')?.value || '1.0';
  const rr = roundNum(parseFloat(String(rrRaw).replace(',', '.').trim()) || 1.0, 2);
  const strategy = `Price Action (${asset})`;
  const emotion = '';
  const tvChartUrl = document.getElementById('realTradeChartUrl')?.value || '';

  const statusRadio = document.querySelector('input[name="realTradeResult"]:checked');
  const status = statusRadio ? statusRadio.value : 'win';

  let lossPerLot = points * 1.0;
  if (isGold) {
    lossPerLot = points * 1.0;
  } else if (isAudUsd) {
    lossPerLot = points * 10.0;
  } else {
    lossPerLot = points * 7.20;
  }

  const dollarRiskBudget = roundNum(curBal * (riskPct / 100.0), 2);
  const rawLot = (points > 0 && lossPerLot > 0) ? (dollarRiskBudget / lossPerLot) : 0.01;
  const suggested_lot = Math.max(0.01, roundNum(rawLot, 2));

  // Opción de lote manual
  const manualLotInput = document.getElementById('realTradeManualLot');
  const manualLotVal = manualLotInput && manualLotInput.value ? parseFloat(String(manualLotInput.value).replace(',', '.').trim()) : null;
  const lot_size = (manualLotVal && manualLotVal > 0) ? roundNum(manualLotVal, 2) : suggested_lot;

  const commissionInput = document.getElementById('realTradeCommission');
  let commission = 0.0;
  if (commissionInput && commissionInput.value) {
    const rawComm = parseFloat(String(commissionInput.value).replace(',', '.').trim());
    if (!isNaN(rawComm)) {
      commission = roundNum(Math.abs(rawComm), 2);
    }
  }

  // PnL Neto Manual o Calculado Automático
  const manualPnlInput = document.getElementById('realTradeManualPnl');
  let manualPnlVal = null;
  if (manualPnlInput && manualPnlInput.value && manualPnlInput.value.trim() !== '') {
    const rawVal = parseFloat(String(manualPnlInput.value).replace(',', '.').trim());
    if (!isNaN(rawVal)) {
      manualPnlVal = roundNum(rawVal, 2);
    }
  }

  const actualDollarRisk = roundNum(lossPerLot * lot_size, 2);
  let pnl = 0.0;
  let retPct = 0.0;

  if (manualPnlVal !== null) {
    pnl = manualPnlVal;
    retPct = curBal > 0 ? roundNum((pnl / curBal) * 100.0, 2) : 0.0;
  } else {
    if (status === 'win') {
      pnl = roundNum((lossPerLot * lot_size * rr) - commission, 2);
      retPct = curBal > 0 ? roundNum((pnl / curBal) * 100.0, 2) : (riskPct * rr);
    } else if (status === 'loss') {
      pnl = roundNum(-actualDollarRisk - commission, 2);
      retPct = curBal > 0 ? roundNum((pnl / curBal) * 100.0, 2) : -riskPct;
    } else {
      pnl = roundNum(-commission, 2);
      retPct = curBal > 0 ? roundNum((pnl / curBal) * 100.0, 2) : 0.0;
    }
  }

  const leverage = parseFloat(appState.config.leverage) || 500;
  let margin_used = 0.0;
  if (isGold) {
    margin_used = roundNum((2720.0 * 100 * lot_size / leverage), 2);
  } else if (isAudUsd) {
    margin_used = roundNum((100000.0 * 0.6550 * lot_size / leverage), 2);
  } else {
    margin_used = roundNum((100000.0 * 1.0850 * lot_size / leverage), 2);
  }

  const entry = parseFloat(document.getElementById('realTradeEntry')?.value);
  const sl = parseFloat(document.getElementById('realTradeSl')?.value);
  const tp = parseFloat(document.getElementById('realTradeTp')?.value);
  const exit = parseFloat(document.getElementById('realTradeExit')?.value);

  const payload = {
    mode: 'real',
    asset,
    date,
    session,
    direction,
    tv_points: points,
    price_dist: price,
    sl_points: points,
    sl_pips: points,
    tp_points: Math.round(points * rr),
    sl_distance: price,
    risk_pct: riskPct,
    ret_pct: retPct,
    dollar_risk: actualDollarRisk,
    suggested_lot,
    lot_size,
    manual_lot: manualLotVal || null,
    commission,
    margin_used,
    status,
    pnl,
    rr,
    strategy,
    emotion,
    tv_chart_url: tvChartUrl,
    notes: `Tickmill ${asset}`
  };

  if (!isNaN(entry)) payload.entry_price = entry;
  if (!isNaN(sl)) payload.sl_price = sl;
  if (!isNaN(tp)) payload.tp_price = tp;
  if (!isNaN(exit)) payload.exit_price = exit;

  try {
    const res = await fetch('/api/trades?mode=real', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      appState.real.summary = data.analytics.summary;
      appState.real.equityCurve = data.analytics.equity_curve;
      appState.real.trades = data.analytics.trades;
      
      // Espejo de persistencia local inmediata
      try {
        localStorage.setItem('cached_real_trades_v2', JSON.stringify(appState.real.trades));
      } catch (e) {}

      renderRealJournalDashboard();
      setCurrentDateTime(true);
      if (manualLotInput) manualLotInput.value = '';
      if (manualPnlInput) manualPnlInput.value = '';
      const chartUrlEl = document.getElementById('realTradeChartUrl');
      if (chartUrlEl) chartUrlEl.value = '';

      if (document.getElementById('realTradeEntry')) document.getElementById('realTradeEntry').value = '';
      if (document.getElementById('realTradeSl')) document.getElementById('realTradeSl').value = '';
      if (document.getElementById('realTradeTp')) document.getElementById('realTradeTp').value = '';
      if (document.getElementById('realTradeExit')) document.getElementById('realTradeExit').value = '';
      const slBadge = document.getElementById('realTradeSlPtsBadge');
      if (slBadge) slBadge.textContent = '0 pts';
      const tpBadge = document.getElementById('realTradeTpPtsBadge');
      if (tpBadge) tpBadge.textContent = '0 pts';
      const ptsDisp = document.getElementById('realCalcPointsDisplay');
      if (ptsDisp) ptsDisp.textContent = '0 pts';
      const pnlDisp = document.getElementById('realCalcPnlDisplay');
      if (pnlDisp) pnlDisp.textContent = '+$0.00';
      const pctDisp = document.getElementById('realCalcPctDisplay');
      if (pctDisp) pctDisp.textContent = '0.00%';

      if (typeof showToast === 'function') {
        showToast('✅ Operación registrada en Bitácora Real con éxito.', 'success', 3000);
      }
    }
  } catch (err) {
    console.error('Error al guardar trade real:', err);
    alert('Error al registrar operación en bitácora real');
  }
}

// ----------------------------------------------------
// Handlers: Delete, Edit, Clear
// ----------------------------------------------------
window.handleDeleteTrade = async function(id, mode = 'backtest') {
  const modeText = mode === 'fondeo' ? 'la bitácora Orion Nova 50K' : mode === 'real' ? 'la bitácora real' : 'el backtesting';
  if (!confirm(`¿Deseas eliminar esta operación de ${modeText}?`)) return;

  try {
    const res = await fetch(`/api/trades/${id}?mode=${mode}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      if (mode === 'fondeo') {
        appState.fondeo.summary = data.summary;
        appState.fondeo.equityCurve = data.equity_curve;
        appState.fondeo.trades = data.trades;
        try {
          localStorage.setItem('cached_fondeo_trades', JSON.stringify(appState.fondeo.trades));
        } catch (e) {}
        renderFondeoDashboard();
      } else if (mode === 'real') {
        appState.real.summary = data.summary;
        appState.real.equityCurve = data.equity_curve;
        appState.real.trades = data.trades;
        try {
          localStorage.setItem('cached_real_trades_v2', JSON.stringify(appState.real.trades));
        } catch (e) {}
        renderRealJournalDashboard();
      } else {
        appState.backtest.summary = data.summary;
        appState.backtest.equityCurve = data.equity_curve;
        appState.backtest.trades = data.trades;
        renderBacktestDashboard();
        recalculateTradingViewValues();
      }
    }
  } catch (err) {
    console.error(`Error eliminando trade (${mode}):`, err);
  }
};

window.handleQuickEditRr = async function(id) {
  const trade = (appState.fondeo.trades || []).find(t => t.id === id);
  if (!trade) return;
  const currentRr = trade.rr !== undefined ? Number(trade.rr).toFixed(2) : '2.00';
  const input = prompt(`Ajustar R:R obtenido final para esta operación (ID: ${id.slice(0, 8)}...):\nActualmente: 1:${currentRr}\n\nIngresa el nuevo R:R obtenido final (ej: 2.5):`, currentRr);
  if (input === null) return;
  const newRr = parseFloat(String(input).replace(',', '.').trim());
  if (isNaN(newRr)) {
    alert('Por favor ingresa un número válido (ej. 2.5)');
    return;
  }

  try {
    const res = await fetch(`/api/trades/${id}?mode=fondeo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'fondeo',
        rr: newRr,
        manual_rr: newRr,
        is_manual_rr: true
      })
    });
    if (res.ok) {
      await loadFondeoTrades();
      if (typeof showToast === 'function') {
        showToast(`✅ R:R de la operación actualizado a 1:${newRr.toFixed(2)}`, 'success', 3000);
      }
    } else {
      const err = await res.json();
      alert('Error actualizando R:R: ' + (err.error || 'Desconocido'));
    }
  } catch (err) {
    console.error('Error al actualizar R:R:', err);
    alert('Error de conexión al actualizar R:R.');
  }
};

window.handleOpenEditModal = function(id, mode = 'backtest') {
  const tradeList = mode === 'fondeo' ? (appState.fondeo.trades || []) : (mode === 'real' ? appState.real.trades : appState.backtest.trades);
  const trade = tradeList.find(t => t.id === id);
  if (!trade) return;

  const pts = trade.tv_points || trade.sl_points || (trade.sl_distance ? Math.round(trade.sl_distance * 100) : 250);
  document.getElementById('editTradeId').value = trade.id;
  document.getElementById('editTradeMode').value = mode;
  const assetSelect = document.getElementById('editTradeAsset');
  if (assetSelect) assetSelect.value = trade.asset || 'XAU/USD';

  const dateEl = document.getElementById('editTradeDate');
  if (dateEl) dateEl.value = trade.date || '';
  document.getElementById('editTradeTvPoints').value = pts;
  const modalRrEl = document.getElementById('editTradeRR');
  if (modalRrEl) {
    modalRrEl.value = trade.rr !== undefined ? formatRRText(trade.rr) : '1.0';
    modalRrEl.dataset.userModified = trade.is_manual_rr ? 'true' : 'false';
  }
  document.getElementById('editTradeDirection').value = trade.direction || 'BUY';
  document.getElementById('editTradeStatus').value = trade.status || 'win';
  const lotEl = document.getElementById('editTradeLot');
  if (lotEl) lotEl.value = Number(trade.lot_size || trade.suggested_lot || 0.01).toFixed(2);
  const riskEl = document.getElementById('editTradeRiskPct');
  if (riskEl) riskEl.value = (trade.risk_pct !== undefined || trade.risk_pct_custom !== undefined) ? formatRiskPctText(trade.risk_pct || trade.risk_pct_custom) : '5.00';
  const pnlEl = document.getElementById('editTradePnl');
  if (pnlEl) pnlEl.value = trade.pnl !== undefined ? (trade.pnl >= 0 ? `+${Number(trade.pnl).toFixed(2)}` : `${Number(trade.pnl).toFixed(2)}`) : '';
  const commEl = document.getElementById('editTradeCommission');
  if (commEl) commEl.value = trade.commission ? `-${Math.abs(trade.commission).toFixed(2)}` : '-0.00';
  const stratEl = document.getElementById('editTradeStrategy');
  if (stratEl) stratEl.value = trade.strategy || 'Price Action';
  const emoEl = document.getElementById('editTradeEmotion');
  if (emoEl) emoEl.value = trade.emotion || '';
  document.getElementById('editTradeChartUrl').value = trade.tv_chart_url || trade.tv_url || '';

  // Execution Prices
  const entryEl = document.getElementById('editTradeEntry');
  if (entryEl) entryEl.value = (trade.entry_price !== undefined && trade.entry_price !== null) ? trade.entry_price : '';
  const exitEl = document.getElementById('editTradeExit');
  if (exitEl) exitEl.value = (trade.exit_price !== undefined && trade.exit_price !== null) ? trade.exit_price : '';
  const slEl = document.getElementById('editTradeSl');
  if (slEl) slEl.value = (trade.sl_price !== undefined && trade.sl_price !== null) ? trade.sl_price : '';
  const tpEl = document.getElementById('editTradeTp');
  if (tpEl) tpEl.value = (trade.tp_price !== undefined && trade.tp_price !== null) ? trade.tp_price : '';

  // Setup live dynamic preview calculation on modal inputs
  const recalculateModalPnlPreview = () => {
    const curAsset = document.getElementById('editTradeAsset')?.value || trade.asset || 'XAU/USD';
    const isGold = anyStringIncludes(curAsset, ['XAU', 'GOLD', 'ORO']);
    const isAudUsd = curAsset.includes('AUD');
    const isEurCad = curAsset.includes('CAD');
    let mult = 100.0;
    let lossPerLot = 100.0;

    const curStatus = document.getElementById('editTradeStatus').value;
    const curRR = parseFloat(String(document.getElementById('editTradeRR').value).replace(',', '.')) || 1.0;
    const curRisk = parseFloat(String(document.getElementById('editTradeRiskPct').value).replace(',', '.')) || 5.0;
    let curPts = parseFloat(String(document.getElementById('editTradeTvPoints').value).replace(',', '.')) || (isGold ? 250 : 25);
    const curComm = Math.abs(parseFloat(String(document.getElementById('editTradeCommission').value).replace(',', '.')) || 0.0);
    const balBefore = trade.balance_before !== undefined ? Number(trade.balance_before) : (Number(appState.config.initial_balance) || 110.0);
    const curDir = document.getElementById('editTradeDirection').value;
    const curLot = parseFloat(String(document.getElementById('editTradeLot').value).replace(',', '.')) || 0.01;

    if (isGold) {
      mult = 100.0;
      lossPerLot = curPts * 1.0;
    } else if (isAudUsd) {
      mult = 100000.0;
      lossPerLot = curPts * 10.0;
    } else {
      mult = 100000.0 / 1.39;
      lossPerLot = curPts * 7.20;
    }

    const curEntry = parseFloat(String(document.getElementById('editTradeEntry')?.value || '').replace(',', '.'));
    const curExit = parseFloat(String(document.getElementById('editTradeExit')?.value || '').replace(',', '.'));
    const curSl = parseFloat(String(document.getElementById('editTradeSl')?.value || '').replace(',', '.'));

    if (!isNaN(curEntry) && !isNaN(curExit)) {
      const exitDiff = curDir === 'BUY' ? (curExit - curEntry) : (curEntry - curExit);
      const pointsDiff = Math.round(exitDiff * (isGold ? 100 : 10000));
      curPts = Math.abs(pointsDiff);
      if (document.getElementById('editTradeTvPoints')) {
        document.getElementById('editTradeTvPoints').value = curPts;
      }
      let computedPnl = roundNum(curLot * mult * exitDiff - curComm, 2);
      
      if (!isNaN(curSl)) {
        const slDiff = Math.abs(curEntry - curSl);
        if (slDiff > 0 && rrInputEl && rrInputEl.dataset.userModified !== 'true') {
          const rrVal = roundNum(Math.abs(exitDiff) / slDiff, 2);
          rrInputEl.value = rrVal.toFixed(2);
        } else if (rrInputEl && rrInputEl.dataset.userModified === 'true') {
          const userManualRr = parseFloat(String(rrInputEl.value).replace(',', '.')) || 1.0;
          const dRisk = curLot * mult * slDiff;
          if (curStatus === 'win') {
            computedPnl = roundNum(dRisk * userManualRr - curComm, 2);
          }
        }
      }

      if (pnlEl) {
        pnlEl.value = computedPnl >= 0 ? `+${computedPnl.toFixed(2)}` : `${computedPnl.toFixed(2)}`;
      }
      if (statusEl) {
        if (computedPnl > 0.05) statusEl.value = 'win';
        else if (computedPnl < -0.05) statusEl.value = 'loss';
        else statusEl.value = 'be';
      }
      return;
    }

    let ret = 0.0;
    if (curStatus === 'win') {
      ret = curRisk * curRR;
    } else if (curStatus === 'loss') {
      ret = -curRisk;
    }
    const computedPnl = mode === 'backtest' 
      ? roundNum(balBefore * (ret / 100.0), 2)
      : roundNum(balBefore * (ret / 100.0) - (curStatus === 'win' ? curComm : (curStatus === 'loss' ? curComm : 0)), 2);
    
    if (pnlEl) {
      pnlEl.value = computedPnl >= 0 ? `+${computedPnl.toFixed(2)}` : `${computedPnl.toFixed(2)}`;
    }
    if (lotEl && curPts > 0 && lossPerLot > 0) {
      const dRisk = balBefore * (curRisk / 100.0);
      const sLot = Math.max(0.01, roundNum(dRisk / lossPerLot, 2));
      lotEl.value = sLot.toFixed(2);
    }
  };

  const statusEl = document.getElementById('editTradeStatus');
  const rrInputEl = document.getElementById('editTradeRR');
  const riskInputEl = document.getElementById('editTradeRiskPct');
  const ptsInputEl = document.getElementById('editTradeTvPoints');
  const entryInp = document.getElementById('editTradeEntry');
  const exitInp = document.getElementById('editTradeExit');
  const slInp = document.getElementById('editTradeSl');
  const tpInp = document.getElementById('editTradeTp');
  const dirInp = document.getElementById('editTradeDirection');
  const assetInp = document.getElementById('editTradeAsset');

  if (rrInputEl) {
    rrInputEl.addEventListener('input', () => {
      rrInputEl.dataset.userModified = 'true';
    });
  }

  if (statusEl) statusEl.onchange = recalculateModalPnlPreview;
  if (rrInputEl) rrInputEl.oninput = recalculateModalPnlPreview;
  if (riskInputEl) riskInputEl.oninput = recalculateModalPnlPreview;
  if (ptsInputEl) ptsInputEl.oninput = recalculateModalPnlPreview;
  if (entryInp) entryInp.oninput = recalculateModalPnlPreview;
  if (exitInp) exitInp.oninput = recalculateModalPnlPreview;
  if (slInp) slInp.oninput = recalculateModalPnlPreview;
  if (tpInp) tpInp.oninput = recalculateModalPnlPreview;
  if (dirInp) dirInp.onchange = recalculateModalPnlPreview;
  if (assetInp) assetInp.onchange = recalculateModalPnlPreview;

  document.getElementById('modalEditTrade').classList.remove('hidden');
  initIcons();
};

async function handleSaveEditedTrade() {
  const id = document.getElementById('editTradeId').value;
  const mode = document.getElementById('editTradeMode').value || 'backtest';
  if (!id) return;

  const asset = document.getElementById('editTradeAsset')?.value || 'XAU/USD';
  const rawInput = document.getElementById('editTradeTvPoints').value;
  const { points, price } = parseTradingViewInput(rawInput);
  const tradeRR = roundNum(parseFloat(String(document.getElementById('editTradeRR').value).replace(',', '.')), 2) || 1.0;
  const status = document.getElementById('editTradeStatus').value;
  const direction = document.getElementById('editTradeDirection').value;
  const lotEl = document.getElementById('editTradeLot');
  const manualLot = (lotEl && lotEl.value) ? roundNum(parseFloat(String(lotEl.value).replace(',', '.')), 2) : null;
  const strategy = document.getElementById('editTradeStrategy')?.value || 'Price Action';
  const emotion = document.getElementById('editTradeEmotion')?.value || '';
  const tvChartUrl = document.getElementById('editTradeChartUrl')?.value || '';

  const entryVal = document.getElementById('editTradeEntry')?.value;
  const exitVal = document.getElementById('editTradeExit')?.value;
  const slVal = document.getElementById('editTradeSl')?.value;
  const tpVal = document.getElementById('editTradeTp')?.value;

  const parsedEntry = (entryVal !== undefined && entryVal !== null && String(entryVal).trim() !== '') ? parseFloat(String(entryVal).replace(',', '.')) : null;
  const parsedExit = (exitVal !== undefined && exitVal !== null && String(exitVal).trim() !== '') ? parseFloat(String(exitVal).replace(',', '.')) : null;
  const parsedSl = (slVal !== undefined && slVal !== null && String(slVal).trim() !== '') ? parseFloat(String(slVal).replace(',', '.')) : null;
  const parsedTp = (tpVal !== undefined && tpVal !== null && String(tpVal).trim() !== '') ? parseFloat(String(tpVal).replace(',', '.')) : null;

  const riskEl = document.getElementById('editTradeRiskPct');
  let riskVal = null;
  if (riskEl && riskEl.value) {
    const parsedRisk = parseFloat(String(riskEl.value).replace(',', '.').trim());
    if (!isNaN(parsedRisk)) riskVal = roundNum(parsedRisk, 2);
  }

  const pnlEl = document.getElementById('editTradePnl');
  let pnlVal = null;
  if (pnlEl && pnlEl.value && pnlEl.value.trim() !== '') {
    const parsedPnl = parseFloat(String(pnlEl.value).replace(',', '.').trim());
    if (!isNaN(parsedPnl)) pnlVal = roundNum(parsedPnl, 2);
  }

  const commEl = document.getElementById('editTradeCommission');
  let commVal = null;
  if (commEl && commEl.value) {
    const parsedComm = parseFloat(String(commEl.value).replace(',', '.').trim());
    if (!isNaN(parsedComm)) commVal = roundNum(Math.abs(parsedComm), 2);
  }

  const payload = {
    mode,
    asset,
    tv_points: points,
    price_dist: price,
    sl_points: points,
    sl_pips: points,
    tp_points: Math.round(points * tradeRR),
    sl_distance: price,
    direction,
    status,
    lot_size: manualLot,
    manual_lot: manualLot,
    rr: tradeRR,
    rr_custom: tradeRR,
    manual_rr: tradeRR,
    is_manual_rr: true,
    strategy,
    emotion,
    tv_chart_url: tvChartUrl
  };

  if (parsedEntry !== null && !isNaN(parsedEntry)) payload.entry_price = parsedEntry;
  if (parsedExit !== null && !isNaN(parsedExit)) payload.exit_price = parsedExit;
  if (parsedSl !== null && !isNaN(parsedSl)) payload.sl_price = parsedSl;
  if (parsedTp !== null && !isNaN(parsedTp)) payload.tp_price = parsedTp;

  if (mode === 'real' || mode === 'fondeo') {
    if (pnlVal !== null) {
      payload.pnl = pnlVal;
    }
    if (commVal !== null) {
      payload.commission = commVal;
    }
  }

  if (riskVal !== null) {
    payload.risk_pct = riskVal;
    payload.risk_pct_custom = riskVal;
  }

  const dateEl = document.getElementById('editTradeDate');
  const dateVal = dateEl && dateEl.value ? dateEl.value.trim() : null;
  if (dateVal) {
    payload.date = dateVal;
  }

  try {
    const res = await fetch(`/api/trades/${id}?mode=${mode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (mode === 'fondeo') {
        appState.fondeo.trades = data.trades || [];
        appState.fondeo.summary = data.summary || {};
        renderFondeoDashboard();
        renderFondeoTradesTable();
      } else if (mode === 'real') {
        appState.real.summary = data.summary;
        appState.real.equityCurve = data.equity_curve;
        appState.real.trades = data.trades;
        try {
          localStorage.setItem('cached_real_trades_v2', JSON.stringify(appState.real.trades));
        } catch (e) {}
        renderRealJournalDashboard();
        updateCharts();
      } else {
        appState.backtest.summary = data.summary;
        appState.backtest.equityCurve = data.equity_curve;
        appState.backtest.trades = data.trades;
        renderBacktestDashboard();
        updateBacktestCharts();
        recalculateTradingViewValues();
      }
      updateCalculatorBalances();
      document.getElementById('modalEditTrade').classList.add('hidden');
      showToast('Operación actualizada y métricas recalculadas.', 'success', 2500);
    }
  } catch (err) {
    console.error('Error editando trade:', err);
    alert('Error al actualizar la operación');
  }
}

async function handleClearData() {
  const activeTab = appState.activeTab;
  const mode = activeTab === 'real' ? 'real' : 'backtest';
  const label = mode === 'real' ? 'la BITÁCORA REAL' : 'el BACKTESTING';

  const userConfirm = prompt(`⚠️ ATENCIÓN: Esta acción eliminará permanentemente las operaciones de ${label}.\nPara proceder escribe "BORRAR":`);
  if (userConfirm !== 'BORRAR') {
    return;
  }

  try {
    const res = await fetch('/api/trades/clear', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    if (res.ok) {
      const data = await res.json();
      if (mode === 'real') {
        appState.real.summary = data.summary;
        appState.real.equityCurve = data.equity_curve;
        appState.real.trades = data.trades;
        try {
          localStorage.removeItem('cached_real_trades_v2');
          localStorage.removeItem('cached_real_trades');
        } catch (e) {}
        renderRealJournalDashboard();
      } else {
        appState.backtest.summary = data.summary;
        appState.backtest.equityCurve = data.equity_curve;
        appState.backtest.trades = data.trades;
        renderBacktestDashboard();
        recalculateTradingViewValues();
      }
    }
  } catch (err) {
    console.error(`Error limpiando datos (${mode}):`, err);
  }
}

// ----------------------------------------------------
// Settings & Export
// ----------------------------------------------------
async function handleSaveSettings() {
  const initial_balance = parseFloat(document.getElementById('settingInitialBalance').value);
  const risk_pct = parseFloat(document.getElementById('settingRiskPct').value);
  const rr_ratio = parseFloat(document.getElementById('settingRR').value);
  const leverage = parseFloat(document.getElementById('settingLeverage').value);

  const payload = { initial_balance, risk_pct, rr_ratio, leverage };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      appState.config = data.config || appState.config;
      if (data.analytics) {
        appState.backtest.summary = data.analytics.summary;
        appState.backtest.equityCurve = data.analytics.equity_curve;
        appState.backtest.trades = data.analytics.trades;
      }
      
      updateConfigUI();
      document.getElementById('modalSettings').classList.add('hidden');
      renderBacktestDashboard();
      recalculateTradingViewValues();
      runMyfxbookCalculator();
    }
  } catch (err) {
    console.error('Error guardando configuración:', err);
  }
}

function exportTradesToCsv(mode = 'backtest') {
  const trades = mode === 'real' ? appState.real.trades : appState.backtest.trades;
  if (!trades || trades.length === 0) {
    alert(`No hay operaciones en ${mode === 'real' ? 'la bitácora real' : 'el backtesting'} para exportar.`);
    return;
  }

  const headers = mode === 'real'
    ? ['#', 'Fecha', 'Sesion', 'Direccion', 'StopLoss_Pts', 'TakeProfit_Pts', 'Ratio_RR', 'Riesgo_USD', 'Lote_MT4', 'Resultado', 'PnL_USD', 'Balance', 'URL_TradingView']
    : ['#', 'Direccion', 'Ratio_RR', 'Riesgo_Compuesto_USD', 'Riesgo_Pct', 'Resultado', 'PnL_USD', 'Balance_Compuesto'];

  const rows = trades.map((t, idx) => {
    let pts = t.tv_points || t.sl_points || 250;
    const priceVal = (pts / 100).toFixed(2);
    const tradeRR = Number(t.rr || 1.0);
    const tpPts = Math.round(pts * tradeRR);
    const tpPriceVal = (tpPts / 100).toFixed(2);

    if (mode === 'real') {
      return [
        idx + 1,
        `"${t.date || ''}"`,
        `"${t.session || 'New York'}"`,
        t.direction,
        `"${pts} ($${priceVal})"`,
        `"${tpPts} ($${tpPriceVal})"`,
        `"1:${formatRRText(tradeRR)}"`,
        t.dollar_risk || 0,
        t.lot_size || t.suggested_lot || 0.01,
        t.status,
        t.pnl,
        t.balance_after,
        `"${t.tv_chart_url || ''}"`
      ];
    } else {
      return [
        idx + 1,
        t.direction,
        `"1:${formatRRText(tradeRR)}"`,
        t.risk_budget || t.dollar_risk || 0,
        `"${formatRiskPctText(t.risk_pct || t.risk_pct_custom || 5.0)}%"`,
        t.status,
        t.pnl,
        t.balance_after
      ];
    }
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `xauusd_${mode}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportTradesToJson(mode = 'real') {
  const trades = mode === 'real' ? appState.real.trades : appState.backtest.trades;
  if (!trades || trades.length === 0) {
    alert(`No hay operaciones en ${mode === 'real' ? 'la bitácora real' : 'el backtesting'} para exportar.`);
    return;
  }

  const jsonStr = JSON.stringify(trades, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trades_${mode}_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ----------------------------------------------------
// GOLD MACRO BIAS & 1-TRADE PROTOCOL ENGINE
// ----------------------------------------------------
let goldBiasState = null;

async function loadGoldBiasData() {
  try {
    const res = await fetch("/api/gold-bias");
    if (!res.ok) return;
    const data = await res.json();
    goldBiasState = data;
    renderGoldBiasUI(data);
  } catch (err) {
    console.error("Error loading gold bias:", err);
  }
}

function renderGoldBiasUI(data) {
  if (!data) return;

  const titleText = document.getElementById("biasTitleText");
  if (titleText && data.bias_title) titleText.textContent = data.bias_title;

  const headline = document.getElementById("biasHeadlineText");
  if (headline && data.headline) headline.textContent = data.headline;

  const summary = document.getElementById("biasSummaryText");
  if (summary && data.macro_summary) summary.textContent = data.macro_summary;

  const confBadge = document.getElementById("biasConfidenceBadge");
  if (confBadge && data.confidence_label) confBadge.textContent = data.confidence_label;

  // Hero Direction Badge & Banner Color Theme
  const dirBadge = document.getElementById("biasDirectionBadge");
  const heroBanner = document.getElementById("biasHeroBanner");
  const cardRuleText = document.getElementById("cardinalRuleText");
  const cardRuleSub = document.getElementById("cardinalRuleSub");
  const cardRuleBox = document.getElementById("cardinalRuleContainer");

  if (data.bias === "BULLISH") {
    if (dirBadge) {
      dirBadge.className = "text-sm sm:text-base font-black px-3.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-2";
      dirBadge.innerHTML = '<i data-lucide="trending-up" class="w-5 h-5 text-emerald-400"></i><span id="biasTitleText">' + (data.bias_title || "SESGO INSTITUCIONAL: ALCISTA (Buy-Only)") + '</span>';
    }
    if (heroBanner) {
      heroBanner.className = "p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-950/60 via-gray-900 to-green-950/60 border-2 border-emerald-500/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all";
    }
    if (cardRuleText) {
      cardRuleText.textContent = "SOLO COMPRAS";
      cardRuleText.className = "text-base font-black text-emerald-400 uppercase mt-0.5 tracking-wide";
    }
    if (cardRuleSub) cardRuleSub.textContent = "Prohibido ventas en contratendencia";
    if (cardRuleBox) cardRuleBox.className = "flex-shrink-0 bg-emerald-950/50 p-3.5 rounded-xl border border-emerald-500/40 text-center min-w-[160px] transition-all";
  } else if (data.bias === "BEARISH") {
    if (dirBadge) {
      dirBadge.className = "text-sm sm:text-base font-black px-3.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-2";
      dirBadge.innerHTML = '<i data-lucide="trending-down" class="w-5 h-5 text-red-400"></i><span id="biasTitleText">' + (data.bias_title || "SESGO INSTITUCIONAL: BAJISTA (Sell-Only)") + '</span>';
    }
    if (heroBanner) {
      heroBanner.className = "p-4 sm:p-5 rounded-xl bg-gradient-to-r from-red-950/60 via-gray-900 to-rose-950/60 border-2 border-red-500/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all";
    }
    if (cardRuleText) {
      cardRuleText.textContent = "SOLO VENTAS";
      cardRuleText.className = "text-base font-black text-red-400 uppercase mt-0.5 tracking-wide";
    }
    if (cardRuleSub) cardRuleSub.textContent = "Prohibido compras en contratendencia";
    if (cardRuleBox) cardRuleBox.className = "flex-shrink-0 bg-red-950/50 p-3.5 rounded-xl border border-red-500/40 text-center min-w-[160px] transition-all";
  } else {
    if (dirBadge) {
      dirBadge.className = "text-sm sm:text-base font-black px-3.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-2";
      dirBadge.innerHTML = '<i data-lucide="minus-circle" class="w-5 h-5 text-yellow-400"></i><span id="biasTitleText">' + (data.bias_title || "SESGO INSTITUCIONAL: NEUTRAL / RANGO (Cautela)") + '</span>';
    }
    if (heroBanner) {
      heroBanner.className = "p-4 sm:p-5 rounded-xl bg-gradient-to-r from-yellow-950/60 via-gray-900 to-amber-950/60 border-2 border-yellow-500/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all";
    }
    if (cardRuleText) {
      cardRuleText.textContent = "RANGO / ESPERA";
      cardRuleText.className = "text-base font-black text-yellow-400 uppercase mt-0.5 tracking-wide";
    }
    if (cardRuleSub) cardRuleSub.textContent = "Esperar confirmación de salida";
    if (cardRuleBox) cardRuleBox.className = "flex-shrink-0 bg-yellow-950/50 p-3.5 rounded-xl border border-yellow-500/40 text-center min-w-[160px] transition-all";
  }

  // Render Smart Money Flow Barometer
  const flowVerdict = document.getElementById("moneyFlowVerdict");
  if (flowVerdict && data.money_flow && data.money_flow.verdict) {
    flowVerdict.textContent = data.money_flow.verdict;
  }
  const flowSummary = document.getElementById("moneyFlowSummary");
  if (flowSummary && data.money_flow && data.money_flow.summary) {
    flowSummary.textContent = data.money_flow.summary;
  }

  const flowAssetsContainer = document.getElementById("moneyFlowAssetsContainer");
  if (flowAssetsContainer && data.money_flow && Array.isArray(data.money_flow.assets)) {
    flowAssetsContainer.innerHTML = data.money_flow.assets.map(asset => {
      const isBull = asset.trend === "bullish";
      const isBear = asset.trend === "bearish";
      const tagBg = isBull 
        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
        : (isBear ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-gray-800 text-gray-300 border-gray-700");
      const barColor = isBull ? "bg-emerald-500" : (isBear ? "bg-red-500" : "bg-yellow-500");
      const barWidth = isBull ? "w-4/5" : (isBear ? "w-4/5" : "w-1/2");
      const statCol = isBull ? "text-emerald-400" : (isBear ? "text-red-400" : "text-yellow-400");
      
      return `
        <div class="p-3.5 rounded-xl bg-gray-900/90 border border-gray-800 space-y-2 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-black text-white font-mono">${asset.symbol}</span>
              <span class="text-[11px] text-gray-400 font-medium">${asset.name}</span>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border ${tagBg}">${asset.action}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="font-mono font-bold ${statCol}">${asset.stat}</span>
            <span class="text-[10px] text-gray-500 uppercase font-mono">${isBull ? "Entrada Neta" : (isBear ? "Salida Neta" : "Neutro")}</span>
          </div>
          <div class="w-full bg-gray-800/80 rounded-full h-1.5 overflow-hidden">
            <div class="h-full rounded-full ${barColor} ${barWidth} transition-all duration-500"></div>
          </div>
          <p class="text-[11px] text-gray-400 leading-tight">${asset.desc}</p>
        </div>
      `;
    }).join("");
  }

  const tabBadge = document.getElementById("tabBadgeBias");
  if (tabBadge) {
    const isBear = data.bias === "BEARISH";
    const isBull = data.bias === "BULLISH";
    tabBadge.textContent = (isBear ? "BAJISTA" : (isBull ? "ALCISTA" : "NEUTRAL")) + " " + (data.confidence || 85) + "%";
    tabBadge.className = isBear 
      ? "px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-950 text-red-300 border border-red-800"
      : (isBull 
          ? "px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800"
          : "px-2 py-0.5 rounded-full text-[10px] font-mono bg-yellow-950 text-yellow-300 border border-yellow-800");
  }

  // Render 6 Macro Sources Grid
  const macroContainer = document.getElementById("macroSourcesContainer");
  if (macroContainer && Array.isArray(data.macro_sources)) {
    macroContainer.innerHTML = data.macro_sources.map(src => {
      const isBear = src.status === "bearish_gold";
      const isBull = src.status === "bullish_gold";
      const badgeBg = isBear 
        ? "bg-red-500/20 text-red-300 border-red-500/30" 
        : (isBull ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30");
      return `
        <div class="p-3.5 rounded-xl bg-gray-900/90 border border-gray-800 space-y-2 shadow-sm hover:border-gray-700 transition">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">${src.source}</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded border ${badgeBg}">${src.signal}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-[11px] text-gray-400 font-medium">${src.indicator}</span>
            <span class="font-mono font-bold text-yellow-400">${src.value}</span>
          </div>
          <p class="text-[11px] text-gray-400 leading-tight">${src.desc}</p>
          <div class="pt-1 text-[10px] text-gray-500 flex items-center justify-between border-t border-gray-800/60">
            <span>Impacto: <strong class="text-gray-300">${src.impact}</strong></span>
          </div>
        </div>
      `;
    }).join("");
  }

  // Actualizar Módulo Cuantitativo: Termómetro de Fuerza, Sugerencia, Radar A+ y ADR
  updateMacroQuantIntelligence(data);

  // Inicializar listeners y sincronizar el escáner M5 100% automático
  setupM5StateListeners();
  if (lastM5ScanData) {
    renderM5ScanResults(lastM5ScanData);
  } else {
    triggerM5Scan();
  }

  initIcons();
}

// -------------------------------------------------------------
// Inteligencia Cuantitativa Macro: Fuerza, Sugerencia, Radar & ADR
// -------------------------------------------------------------
function updateMacroQuantIntelligence(data) {
  if (!data) return;

  const bias = data.bias || "BEARISH";
  const conf = parseInt(data.confidence, 10) || 85;
  const isBear = bias === "BEARISH";
  const isBull = bias === "BULLISH";
  const isNeut = bias === "NEUTRAL";

  // 1. Termómetro de Fuerza Fundamental Cuantitativo
  const scoreBadge = document.getElementById("macroScoreBadge");
  const scoreValue = document.getElementById("macroScoreValue");
  const gaugeMarker = document.getElementById("macroGaugeMarker");
  const bearPower = document.getElementById("macroBearPowerText");
  const bullPower = document.getElementById("macroBullPowerText");
  const dominantDriver = document.getElementById("macroDominantDriverText");
  const driverVotes = document.getElementById("macroDriverVotesCount");

  const scoreNum = isBear ? -conf : (isBull ? conf : 0);
  const markerPos = Math.max(3, Math.min(97, ((scoreNum + 100) / 200) * 100));

  if (gaugeMarker) {
    gaugeMarker.style.left = `${markerPos}%`;
  }

  if (scoreValue) {
    if (isBear) {
      scoreValue.textContent = `-${conf}% • PRESIÓN VENDEDORA INSTITUCIONAL`;
    } else if (isBull) {
      scoreValue.textContent = `+${conf}% • PRESIÓN COMPRADORA INSTITUCIONAL`;
    } else {
      scoreValue.textContent = `0% • EQUILIBRIO DE MERCADO / RANGO`;
    }
  }

  if (scoreBadge) {
    if (isBear) {
      scoreBadge.className = "px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5";
      scoreBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span><span id="macroScoreValue">-' + conf + '% • PRESIÓN VENDEDORA INSTITUCIONAL</span>';
    } else if (isBull) {
      scoreBadge.className = "px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5";
      scoreBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span><span id="macroScoreValue">+' + conf + '% • PRESIÓN COMPRADORA INSTITUCIONAL</span>';
    } else {
      scoreBadge.className = "px-2.5 py-1 rounded-lg bg-yellow-950/80 border border-yellow-500/40 text-yellow-300 text-xs font-mono font-bold flex items-center gap-1.5";
      scoreBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span><span id="macroScoreValue">0% • EQUILIBRIO DE MERCADO</span>';
    }
  }

  if (bearPower) bearPower.textContent = `${isBear ? conf : (isBull ? (100 - conf) : 50)}%`;
  if (bullPower) bullPower.textContent = `${isBull ? conf : (isBear ? (100 - conf) : 50)}%`;

  // Conteo de votos de fuentes macro
  let bearCount = 0;
  let bullCount = 0;
  let neutCount = 0;
  if (Array.isArray(data.macro_sources)) {
    data.macro_sources.forEach(s => {
      if (s.status === "bearish_gold") bearCount++;
      else if (s.status === "bullish_gold") bullCount++;
      else neutCount++;
    });
  } else {
    bearCount = isBear ? 5 : (isBull ? 0 : 2);
    bullCount = isBull ? 5 : (isBear ? 1 : 2);
    neutCount = isNeut ? 2 : 1;
  }

  if (driverVotes) {
    driverVotes.textContent = `${bearCount} Bajistas · ${neutCount} Neutral · ${bullCount} Alcistas`;
  }

  if (dominantDriver) {
    dominantDriver.innerHTML = isBear 
      ? 'Driver Dominante: <strong class="text-white">TIPS 10A Real (+2.12%)</strong>' 
      : (isBull 
          ? 'Driver Dominante: <strong class="text-white">DXY en Retroceso & Compras PBoC</strong>' 
          : 'Driver Dominante: <strong class="text-white">Curva de Tipos en Espera FOMC</strong>');
  }

  // 2. Caja de Sugerencia Algorítmica Accionable
  const advisorBox = document.getElementById("macroAdvisorBox");
  const verdictTitle = document.getElementById("macroVerdictTitle");
  const triggerAdvice = document.getElementById("macroTriggerAdvice");
  const riskAdvice = document.getElementById("macroRiskAdvice");
  const convicBadge = document.getElementById("advisorConvicBadge");

  const resZone = (data.technical_zones && data.technical_zones.key_resistance) || "$3,920 – $4,000";
  const supZone = (data.technical_zones && data.technical_zones.key_support) || "$3,800 – $3,850";

  if (advisorBox) {
    advisorBox.className = isBear
      ? "lg:col-span-5 bg-gradient-to-b from-gray-900 to-red-950/40 border-2 border-red-500/50 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-inner"
      : (isBull
          ? "lg:col-span-5 bg-gradient-to-b from-gray-900 to-emerald-950/40 border-2 border-emerald-500/50 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-inner"
          : "lg:col-span-5 bg-gradient-to-b from-gray-900 to-yellow-950/40 border-2 border-yellow-500/50 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-inner");
  }

  if (convicBadge) {
    convicBadge.className = isBear
      ? "text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold"
      : (isBull
          ? "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
          : "text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-bold");
    convicBadge.textContent = conf >= 75 ? "ALTA PROBABILIDAD" : "CONVICCIÓN MODERADA";
  }

  if (verdictTitle) {
    verdictTitle.textContent = isBear
      ? "VENTA DE ALTA CONVICCIÓN (SELL-ONLY)"
      : (isBull ? "COMPRA DE ALTA CONVICCIÓN (BUY-ONLY)" : "RANGO / CONSOLIDACIÓN (CAUTELA)");
    verdictTitle.className = isBear
      ? "text-sm font-black text-red-400 mt-0.5"
      : (isBull ? "text-sm font-black text-emerald-400 mt-0.5" : "text-sm font-black text-yellow-400 mt-0.5");
  }

  if (triggerAdvice) {
    if (isBear) {
      triggerAdvice.innerHTML = `Ejecutar venta únicamente en vela M5 cerrada con flecha roja o cambio de banda tras retesteo a la <strong>Zona de Resistencia (${resZone})</strong>. Descartar el 100% de compras.`;
    } else if (isBull) {
      triggerAdvice.innerHTML = `Ejecutar compra únicamente en vela M5 cerrada con flecha verde o cambio de banda tras retesteo a la <strong>Zona de Soporte (${supZone})</strong>. Descartar el 100% de ventas.`;
    } else {
      triggerAdvice.innerHTML = `Operativa de rango acotado o abstenerse. Tomar rebotes en extremos con riesgo reducido al 1.5% o esperar confirmación de ruptura.`;
    }
  }

  if (riskAdvice) {
    riskAdvice.innerHTML = `Riesgo recomendado: <strong>3% a 5%</strong>. Si el SL en TradingView es de 1,500 a 2,500 pts ($15 a $25), operar con <strong>0.01 – 0.02 lotes</strong> según la Calculadora.`;
  }

  // 3. News Risk Shield (Semáforo Dinámico de Noticias) & Radar Item 3
  evaluateDynamicNewsShield();

  // 4. Radar de Confluencia "A+ Setup"
  const conf1 = document.getElementById("confluenceCheck1");
  const conf2 = document.getElementById("confluenceCheck2");
  const conf4 = document.getElementById("confluenceCheck4");
  const confScore = document.getElementById("confluenceScoreBadge");
  const confBanner = document.getElementById("confluenceVerdictBanner");

  if (conf1) {
    conf1.textContent = isBear ? `✓ BAJISTA (${conf}%)` : (isBull ? `✓ ALCISTA (${conf}%)` : `🟡 NEUTRAL (${conf}%)`);
  }
  if (conf2) {
    conf2.textContent = isBear ? `✓ EN RESISTENCIA` : (isBull ? `✓ EN SOPORTE` : `🟡 ZONA MEDIA`);
  }
  if (conf4) {
    conf4.textContent = `⏳ ESPERANDO VELA`;
  }

  // 5. Proyección ADR (Escala TradingView)
  const adrDaily = document.getElementById("adrDailyAvgDisplay");
  const adrConsumed = document.getElementById("adrConsumedDisplay");
  const adrRemaining = document.getElementById("adrRemainingDisplay");
  const adrBar = document.getElementById("adrProgressBar");
  const adrDiag = document.getElementById("adrDiagnosticText");

  let consumedPts = 2650;
  if (data.session_levels && data.session_levels.london_range_pts) {
    const lPts = (data.session_levels.london_range_pts || 24) * 100;
    consumedPts = Math.min(4500, Math.max(1800, Math.round(lPts * 1.1)));
  }

  const totalAdrPts = 5500;
  const remPts = Math.max(800, totalAdrPts - consumedPts);
  const pctConsumed = Math.round((consumedPts / totalAdrPts) * 100);

  if (adrDaily) adrDaily.textContent = `5,500 pts ($55.00)`;
  if (adrConsumed) adrConsumed.textContent = `${consumedPts.toLocaleString("en-US")} pts ($${(consumedPts/100).toFixed(2)})`;
  if (adrRemaining) adrRemaining.textContent = `${remPts.toLocaleString("en-US")} pts ($${(remPts/100).toFixed(2)})`;
  if (adrBar) adrBar.style.width = `${pctConsumed}%`;
  if (adrDiag) {
    adrDiag.innerHTML = `🟢 <strong>Margen Óptimo:</strong> El oro aún tiene ~${remPts.toLocaleString("en-US")} puntos ($${(remPts/100).toFixed(2)}) de recorrido libre esperado en Nueva York. Espacio suficiente para buscar Take Profits de 1,500 a 2,500 pts sin riesgo de agotamiento.`;
  }

  // Reflejar métricas en Tab 2 (Radar de Precisión)
  const precAdrRemaining = document.getElementById("precAdrRemainingDisplay");
  const precAdrBar = document.getElementById("precAdrProgressBar");
  const precAdrDiag = document.getElementById("precAdrDiagnosticText");
  if (precAdrRemaining) precAdrRemaining.textContent = `${remPts.toLocaleString("en-US")} pts ($${(remPts/100).toFixed(2)})`;
  if (precAdrBar) precAdrBar.style.width = `${pctConsumed}%`;
  if (precAdrDiag) {
    precAdrDiag.innerHTML = `🟢 <strong>Margen Óptimo:</strong> El oro aún tiene ~${remPts.toLocaleString("en-US")} puntos ($${(remPts/100).toFixed(2)}) de recorrido libre esperado en Nueva York. Espacio suficiente para buscar TP1 y TP2 sin agotamiento.`;
  }

  const precBiasBadge = document.getElementById("precBiasBadge");
  const precBiasRule = document.getElementById("precBiasRuleText");
  const precBiasDxy = document.getElementById("precBiasDxyText");
  const isBearBias = data.bias === "BEARISH";
  const isBullBias = data.bias === "BULLISH";
  const biasConfVal = data.conviction_score || data.confidence || 85;

  if (precBiasBadge) {
    precBiasBadge.textContent = isBearBias ? `🔴 BAJISTA ${biasConfVal}%` : (isBullBias ? `🟢 ALCISTA ${biasConfVal}%` : `🟡 NEUTRAL ${biasConfVal}%`);
    precBiasBadge.className = isBearBias 
      ? "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold"
      : (isBullBias ? "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold" : "text-[10px] font-mono px-2 py-0.5 rounded-full bg-yellow-950 text-yellow-300 border border-yellow-600 font-bold");
  }
  if (precBiasRule) {
    precBiasRule.textContent = isBearBias ? "VENTA / SELL-ONLY" : (isBullBias ? "COMPRA / BUY-ONLY" : "RANGO / ESPERA");
    precBiasRule.className = isBearBias ? "text-sm font-black text-rose-400 font-mono" : (isBullBias ? "text-sm font-black text-emerald-400 font-mono" : "text-sm font-black text-yellow-400 font-mono");
  }
  if (precBiasDxy) {
    precBiasDxy.textContent = isBearBias 
      ? "DXY alcista + TIPS 10Y positivos. Prohibido buscar compras contra la liquidez interbancaria."
      : (isBullBias 
          ? "DXY en debilidad + TIPS a la baja. Prohibido buscar ventas contra la tendencia."
          : "DXY lateral sin dirección clara. Paciencia.");
  }

  // 6. Actualizar Elementos Técnicos Cuantitativos M5 (Parte 2)
  const updateTs = document.getElementById("lastBiasUpdateTimestamp");
  if (updateTs && data.updated_at) {
    updateTs.textContent = `Actualizado: ${data.updated_at}`;
  }

  if (data.session_levels) {
    const lh = document.getElementById("londonHighDisplay");
    const ll = document.getElementById("londonLowDisplay");
    const lr = document.getElementById("londonRangeDisplay");
    if (lh && data.session_levels.london_high) lh.textContent = data.session_levels.london_high;
    if (ll && data.session_levels.london_low) ll.textContent = data.session_levels.london_low;
    if (lr && data.session_levels.london_range_pts) {
      lr.textContent = `${data.session_levels.london_range_pts.toLocaleString("en-US")} pts ($${(data.session_levels.london_range_pts/100).toFixed(2)})`;
    }

    const pdh = document.getElementById("pdhDisplay");
    const pdl = document.getElementById("pdlDisplay");
    const piv = document.getElementById("dailyPivotDisplay");
    if (pdh && data.session_levels.pdh) pdh.textContent = data.session_levels.pdh;
    if (pdl && data.session_levels.pdl) pdl.textContent = data.session_levels.pdl;
    if (piv && data.session_levels.current_pivot) piv.textContent = data.session_levels.current_pivot;
  }

  if (data.technical_zones && data.technical_zones.invalidation) {
    const inv = document.getElementById("invalidationDisplay");
    if (inv) inv.textContent = data.technical_zones.invalidation;
  }

  if (data.technical_m5) {
    const t5 = data.technical_m5;
    
    // London Breakout
    if (t5.london_breakout) {
      const lbBadge = document.getElementById("londonStatusBadge");
      const lbDetail = document.getElementById("londonBreakoutDetail");
      const jsStatus = document.getElementById("judasSwingStatus");
      if (lbBadge && t5.london_breakout.badge) lbBadge.textContent = t5.london_breakout.badge;
      if (lbDetail && t5.london_breakout.description) lbDetail.textContent = t5.london_breakout.description;
      if (jsStatus && t5.london_breakout.judas_swing) jsStatus.textContent = t5.london_breakout.judas_swing;
    }

    // Heikin Ashi M5
    if (t5.heikin_ashi) {
      const haBadge = document.getElementById("heikinAshiBadge");
      const haCandles = document.getElementById("heikinAshiCandles");
      const haDesc = document.getElementById("heikinAshiDesc");
      if (haBadge && t5.heikin_ashi.badge) haBadge.textContent = t5.heikin_ashi.badge;
      if (haCandles && t5.heikin_ashi.consecutive_candles) {
        haCandles.textContent = `${t5.heikin_ashi.consecutive_candles} Velas Rojas Planas`;
      }
      if (haDesc && t5.heikin_ashi.description) haDesc.textContent = t5.heikin_ashi.description;
    }

    // Squeeze Momentum LazyBear
    if (t5.squeeze_momentum) {
      const sqBadge = document.getElementById("squeezeStatusBadge");
      const sqVal = document.getElementById("squeezeLinregVal");
      const sqDesc = document.getElementById("squeezeDesc");
      if (sqBadge && t5.squeeze_momentum.badge) sqBadge.textContent = t5.squeeze_momentum.badge;
      if (sqVal && t5.squeeze_momentum.linreg_val !== undefined) {
        sqVal.textContent = `${t5.squeeze_momentum.linreg_val} pts (Rojo Acelerando)`;
      }
      if (sqDesc && t5.squeeze_momentum.description) sqDesc.textContent = t5.squeeze_momentum.description;
    }
  }

  // 7. Actualizar Síntesis de Confluencia Institucional Maestra (Parte 3)
  // Nota: setM5MarketState sincronizará el estado activo (en rango, ruptura bajista o ruptura alcista)
  if (data.current_m5_state) {
    setM5MarketState(data.current_m5_state);
  } else {
    setM5MarketState(currentM5StateKey || "in_range");
  }

  // 8. Botón Cargar Parámetros en Calculadora Myfxbook
  const btnLoadCalc = document.getElementById("btnLoadConfluenceIntoCalc");
  if (btnLoadCalc) {
    btnLoadCalc.onclick = () => {
      let slPts = "1800";
      let riskPct = "5";
      if (goldBiasState && goldBiasState.m5_states && goldBiasState.m5_states[currentM5StateKey]) {
        if (currentM5StateKey === "breakout_up") {
          slPts = "1100";
          riskPct = "1.5";
        } else if (currentM5StateKey === "in_range") {
          slPts = "1800";
          riskPct = "3";
        } else {
          slPts = "1800";
          riskPct = "5";
        }
      }
      const slInput = document.getElementById("calcStopLoss");
      const riskInput = document.getElementById("calcRiskPct");
      if (slInput) slInput.value = slPts;
      if (riskInput) riskInput.value = riskPct;
      if (typeof runMyfxbookCalculator === "function") {
        runMyfxbookCalculator();
      }
      if (typeof window.switchTabTo === "function") {
        window.switchTabTo("calculator");
      }
      try {
        const toast = document.createElement("div");
        toast.className = "fixed bottom-5 right-5 z-50 bg-emerald-900 border border-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold font-mono flex items-center gap-2 animate-bounce";
        toast.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i><span>¡Parámetros de M5 (${currentM5StateKey}) cargados en la Calculadora (SL: ${slPts} pts, Riesgo: ${riskPct}%)!</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
        initIcons();
      } catch (e) {}
    };
  }
}

// -------------------------------------------------------------
// Laboratorio Técnico de Precisión & Escáner M5 Autónomo en Tiempo Real (XAU/USD)
// -------------------------------------------------------------
let m5ScanInterval = null;
let autoScanActive = true;
let currentM5StateKey = "in_range";
let m5StateListenersAttached = false;
let lastM5ScanData = null;
let m5CandleCountdownSec = 300;
let m5CountdownInterval = null;

function startM5CountdownTicker() {
  if (m5CountdownInterval) clearInterval(m5CountdownInterval);
  m5CountdownInterval = setInterval(() => {
    if (m5CandleCountdownSec > 0) {
      m5CandleCountdownSec--;
    } else {
      m5CandleCountdownSec = 300;
      if (autoScanActive) triggerM5Scan();
    }
    const mm = String(Math.floor(m5CandleCountdownSec / 60)).padStart(2, "0");
    const ss = String(m5CandleCountdownSec % 60).padStart(2, "0");
    const cdEl = document.getElementById("labCandleCountdown");
    if (cdEl) cdEl.textContent = `${mm}:${ss}`;
  }, 1000);
}

function updateTestingBayButtons(mode) {
  const btnAuto = document.getElementById("btnLabAuto");
  const btnRange = document.getElementById("btnLabRange");
  const btnDown = document.getElementById("btnLabDown");
  const btnUp = document.getElementById("btnLabUp");

  const idle = "px-2.5 py-1 rounded-lg bg-gray-900 text-gray-400 border border-gray-800 flex items-center gap-1.5 cursor-pointer transition hover:bg-gray-800 hover:text-white";

  if (btnAuto) {
    btnAuto.className = mode === "auto" 
      ? "px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer shadow-md"
      : idle;
  }
  if (btnRange) {
    btnRange.className = mode === "in_range"
      ? "px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1.5 cursor-pointer shadow-md"
      : idle;
  }
  if (btnDown) {
    btnDown.className = mode === "breakout_down"
      ? "px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5 cursor-pointer shadow-md"
      : idle;
  }
  if (btnUp) {
    btnUp.className = mode === "breakout_up"
      ? "px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 cursor-pointer shadow-md"
      : idle;
  }
}

function setupM5StateListeners() {
  if (m5StateListenersAttached) return;
  autoScanActive = true;
  m5StateListenersAttached = true;
}

function startM5RealTimeScanner() {
  setupM5StateListeners();
  setupDualTerminalControls();
  startM5CountdownTicker();
  if (m5ScanInterval) clearInterval(m5ScanInterval);

  // Ejecución inmediata inicial
  triggerM5Scan();
  fetchDualScannerSignals();

  // Escaneo continuo cada 4 segundos
  m5ScanInterval = setInterval(() => {
    if (autoScanActive) {
      triggerM5Scan();
      fetchDualScannerSignals();
    }
  }, 4000);
}

async function triggerM5Scan() {
  try {
    const res = await fetch("/api/m5-scanner");
    if (!res.ok) return;
    const scan = await res.json();
    if (!scan || scan.status !== "success") return;
    lastM5ScanData = scan;
    renderM5ScanResults(scan);
  } catch (err) {
    console.error("Error en escaneo M5:", err);
  }
}

function renderM5ScanResults(scan) {
  if (!scan) return;

  // 1. Cronómetro de Vela M5
  if (scan.candle_remaining_sec !== undefined) {
    m5CandleCountdownSec = scan.candle_remaining_sec;
  }
  const cdEl = document.getElementById("labCandleCountdown");
  if (cdEl && scan.candle_countdown) {
    cdEl.textContent = scan.candle_countdown;
  }

  // 2. Telemetría del Escáner
  const livePrice = document.getElementById("scannerLivePrice");
  const scanTime = document.getElementById("scannerScanTime");
  const zoneDesc = document.getElementById("scannerZoneDesc");
  const distExtremes = document.getElementById("scannerDistToExtremes");
  const zoneAlert = document.getElementById("scannerZoneAlert");

  if (livePrice && scan.current_price) {
    livePrice.textContent = `$${scan.current_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (scanTime && scan.scanned_at) {
    scanTime.textContent = scan.scanned_at;
  }
  if (zoneDesc && scan.zone_desc) {
    zoneDesc.textContent = scan.zone_desc;
  }
  if (distExtremes && scan.m5_range) {
    distExtremes.textContent = `Precio: $${scan.current_price.toFixed(2)} · A ${scan.m5_range.pct_position}% del Rango M5`;
  }

  // Color de Alerta de Zona
  if (zoneAlert) {
    if (scan.detected_state === "in_range") {
      zoneAlert.className = "p-2.5 rounded-xl bg-yellow-950/40 border border-yellow-500/40 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-inner";
    } else if (scan.detected_state === "breakout_down") {
      zoneAlert.className = "p-2.5 rounded-xl bg-red-950/40 border border-red-500/50 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-inner";
    } else {
      zoneAlert.className = "p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-inner";
    }
  }

  // 3. Card de Régimen M5 & Distancias de Liquidez
  const regimeBadge = document.getElementById("m5RegimeBadge");
  const regimeHeadline = document.getElementById("m5RegimeHeadline");
  const regimeSummary = document.getElementById("m5RegimeSummary");
  const rangeHigh = document.getElementById("m5RangeHigh");
  const rangeLow = document.getElementById("m5RangeLow");
  const rangeEQ = document.getElementById("m5RangeEQ");
  const rangeWidth = document.getElementById("m5RangeWidth");
  const rangeMarker = document.getElementById("m5RangeProgressMarker");
  const monitorCard = document.getElementById("m5RangeMonitorCard");
  const distBsl = document.getElementById("labDistToBsl");
  const distSsl = document.getElementById("labDistToSsl");
  const nyVwapTop = document.getElementById("labNyVwapTop");

  if (regimeBadge && scan.detected_badge) {
    regimeBadge.textContent = scan.detected_badge;
    regimeBadge.className = scan.detected_state === "in_range"
      ? "text-xs font-mono font-black px-2.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
      : (scan.detected_state === "breakout_down"
          ? "text-xs font-mono font-black px-2.5 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40"
          : "text-xs font-mono font-black px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40");
  }

  if (regimeHeadline && scan.headline) regimeHeadline.textContent = scan.headline;
  if (regimeSummary && scan.summary) regimeSummary.textContent = scan.summary;

  if (scan.m5_range) {
    if (rangeHigh) rangeHigh.textContent = `$${scan.m5_range.range_high.toFixed(2)}`;
    if (rangeLow) rangeLow.textContent = `$${scan.m5_range.range_low.toFixed(2)}`;
    if (rangeEQ) rangeEQ.textContent = `$${scan.m5_range.range_eq.toFixed(2)}`;
    if (rangeWidth) {
      rangeWidth.textContent = `${scan.m5_range.range_width_pts.toLocaleString("en-US")} pts (${scan.m5_range.range_width_usd})`;
    }
    if (distBsl && scan.m5_range.dist_to_bsl_pts !== undefined) {
      distBsl.textContent = `${scan.m5_range.dist_to_bsl_pts.toLocaleString()} pts`;
    }
    if (distSsl && scan.m5_range.dist_to_ssl_pts !== undefined) {
      distSsl.textContent = `${scan.m5_range.dist_to_ssl_pts.toLocaleString()} pts`;
    }
    const rLowLbl = document.getElementById("m5RangeLowLabel");
    const rEqLbl = document.getElementById("m5RangeEqLabel");
    const rHighLbl = document.getElementById("m5RangeHighLabel");
    if (rLowLbl) rLowLbl.textContent = scan.m5_range.support_label || `Soporte $${scan.m5_range.range_low.toFixed(2)}`;
    if (rEqLbl) rEqLbl.textContent = scan.m5_range.eq_label || `Equilibrio / VWAP $${scan.m5_range.range_eq.toFixed(2)}`;
    if (rHighLbl) rHighLbl.textContent = scan.m5_range.resistance_label || `Resistencia $${scan.m5_range.range_high.toFixed(2)}`;

    if (rangeMarker && scan.m5_range.pct_position !== undefined) {
      rangeMarker.style.left = `${scan.m5_range.pct_position}%`;
      const innerDot = rangeMarker.querySelector("div");
      if (innerDot) {
        if (scan.detected_state === "in_range") {
          innerDot.className = "w-4 h-4 rounded-full bg-yellow-400 border-2 border-black shadow-lg shadow-yellow-400/50 flex items-center justify-center";
        } else if (scan.detected_state === "breakout_down") {
          innerDot.className = "w-4 h-4 rounded-full bg-red-500 border-2 border-black shadow-lg shadow-red-500/50 flex items-center justify-center animate-ping";
        } else {
          innerDot.className = "w-4 h-4 rounded-full bg-emerald-400 border-2 border-black shadow-lg shadow-emerald-400/50 flex items-center justify-center animate-ping";
        }
      }
    }
  }

  if (monitorCard) {
    if (scan.detected_state === "in_range") {
      monitorCard.className = "p-4 sm:p-5 rounded-xl bg-gradient-to-b from-gray-900/90 via-gray-950 to-amber-950/20 border-2 border-amber-500/40 space-y-4 shadow-xl transition-all";
    } else if (scan.detected_state === "breakout_down") {
      monitorCard.className = "p-4 sm:p-5 rounded-xl bg-gradient-to-b from-gray-900/90 via-gray-950 to-red-950/20 border-2 border-red-500/50 space-y-4 shadow-xl transition-all";
    } else {
      monitorCard.className = "p-4 sm:p-5 rounded-xl bg-gradient-to-b from-gray-900/90 via-gray-950 to-emerald-950/20 border-2 border-emerald-500/50 space-y-4 shadow-xl transition-all";
    }
  }

  // 4. Tarjeta de Ruptura de Londres
  const lbBadge = document.getElementById("londonStatusBadge");
  const lbDetail = document.getElementById("londonBreakoutDetail");
  const jsStatus = document.getElementById("judasSwingStatus");
  const lhDisp = document.getElementById("londonHighDisplay");
  const llDisp = document.getElementById("londonLowDisplay");
  const lrDisp = document.getElementById("londonRangeDisplay");

  if (scan.london_session) {
    const ls = scan.london_session;
    if (lhDisp) lhDisp.textContent = `$${ls.london_high.toFixed(2)}`;
    if (llDisp) llDisp.textContent = `$${ls.london_low.toFixed(2)}`;
    if (lrDisp) lrDisp.textContent = `${ls.london_range_pts.toLocaleString()} pts ($${(ls.london_range_pts / 100).toFixed(2)})`;
    if (lbBadge && ls.status_badge) {
      lbBadge.textContent = ls.status_badge;
      lbBadge.className = ls.status_badge.includes("ROJO") || ls.status_badge.includes("BAJISTA")
        ? "text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold"
        : (ls.status_badge.includes("ALCISTA")
            ? "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold"
            : "text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-800 font-bold");
    }
    if (lbDetail && ls.status_detail) lbDetail.textContent = ls.status_detail;
    if (jsStatus && ls.judas_swing) jsStatus.textContent = ls.judas_swing;
  } else if (lbBadge) {
    if (scan.detected_state === "in_range") {
      lbBadge.textContent = "🟡 EN RANGO";
      lbBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-800 font-bold";
      if (lbDetail) lbDetail.textContent = `El precio comprime dentro del rango de M5 ($${scan.m5_range.range_low.toFixed(2)} – $${scan.m5_range.range_high.toFixed(2)}).`;
      if (jsStatus) jsStatus.textContent = "Monitoreando extremos por posibles barridos de manipulación";
    } else if (scan.detected_state === "breakout_down") {
      lbBadge.textContent = "🔴 RUPTURA BAJISTA";
      lbBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold";
      if (lbDetail) lbDetail.textContent = `Ruptura bajista confirmada bajo $${scan.m5_range.range_low.toFixed(2)} con desplazamiento.`;
      if (jsStatus) jsStatus.textContent = "No detectado (Ruptura limpia sostenida a favor de la macro)";
    } else {
      lbBadge.textContent = "🟢 RUPTURA ALCISTA";
      lbBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold";
      if (lbDetail) lbDetail.textContent = `Ruptura alcista sobre el techo de M5 ($${scan.m5_range.range_high.toFixed(2)}).`;
      if (jsStatus) jsStatus.textContent = "Atención: posible barrido de liquidez alcista contra la macro";
    }
  }

  // 5. Desviómetro NY Anchored VWAP (Z-Score)
  if (scan.session_vwap) {
    const v = scan.session_vwap;
    const vwapBadge = document.getElementById("labVwapBadge");
    const vwapZScore = document.getElementById("labVwapZScore");
    const vwapDist = document.getElementById("labVwapDist");
    const labNyVwap = document.getElementById("labNyVwap");
    const vwapBandUp = document.getElementById("labVwapBandUp");
    const vwapBandDown = document.getElementById("labVwapBandDown");
    const vwapTp = document.getElementById("labVwapTp");

    if (vwapBadge) {
      vwapBadge.textContent = v.badge || `${v.z_score > 0 ? '+' : ''}${v.z_score}σ`;
      vwapBadge.className = v.z_score < -0.5
        ? "text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold"
        : (v.z_score > 0.5
            ? "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold"
            : "text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-800 font-bold");
    }
    if (vwapZScore) {
      vwapZScore.textContent = `${v.z_score > 0 ? '+' : ''}${v.z_score.toFixed(2)}σ (${v.status})`;
      vwapZScore.className = v.z_score < -0.5 ? "font-black text-red-400 text-xs" : (v.z_score > 0.5 ? "font-black text-emerald-400 text-xs" : "font-black text-yellow-300 text-xs");
    }
    if (vwapDist) {
      vwapDist.textContent = `${v.dist_pts > 0 ? '+' : ''}${v.dist_pts} pts (${v.dist_usd > 0 ? '+$' : '-$'}${Math.abs(v.dist_usd).toFixed(2)})`;
    }
    if (labNyVwap) labNyVwap.textContent = `$${v.ny_vwap.toFixed(2)}`;
    if (nyVwapTop) nyVwapTop.textContent = `$${v.ny_vwap.toFixed(2)}`;
    if (vwapBandUp && v.band_up_1) vwapBandUp.textContent = `$${v.band_up_1.toFixed(2)}`;
    if (vwapBandDown && v.band_down_1) vwapBandDown.textContent = `$${v.band_down_1.toFixed(2)}`;
    if (vwapTp && v.band_down_2) vwapTp.textContent = `$${v.band_down_2.toFixed(2)}`;
  }

  // 6. Microscopio Anatómico Heikin Ashi M5
  const haBadge = document.getElementById("heikinAshiBadge");
  const haCandles = document.getElementById("heikinAshiCandles");
  const haDesc = document.getElementById("heikinAshiDesc");
  const haUpper = document.getElementById("labHaUpperWick");
  const haBody = document.getElementById("labHaBody");
  const haLower = document.getElementById("labHaLowerWick");
  const haRatio = document.getElementById("labHaRatio");
  const haMicro = document.getElementById("labHaMicroscope");

  if (scan.heikin_ashi) {
    const ha = scan.heikin_ashi;
    if (haBadge && ha.badge) {
      haBadge.textContent = ha.badge;
      haBadge.className = ha.flat_top 
        ? "text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold"
        : (ha.flat_bottom 
            ? "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold"
            : "text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-800 font-bold");
    }
    if (haCandles && ha.candles_label) {
      haCandles.textContent = ha.candles_label;
      haCandles.className = ha.flat_top 
        ? "font-mono text-red-400 font-black" 
        : (ha.flat_bottom ? "font-mono text-emerald-400 font-black" : "font-mono text-yellow-400 font-black");
    }
    if (haDesc && ha.desc) {
      haDesc.textContent = ha.desc;
    }
    if (haUpper) haUpper.textContent = `${ha.upper_wick_pts || 0} pts`;
    if (haBody) haBody.textContent = `${ha.body_pts || 0} pts`;
    if (haLower) haLower.textContent = `${ha.lower_wick_pts || 0} pts`;
    if (haRatio) haRatio.textContent = `Mecha/Cuerpo: ${ha.wick_ratio || 0}%`;
    if (haMicro) {
      if (ha.flat_top) {
        haMicro.textContent = `🔬 Microscopio: Cero mecha superior detectada (${ha.upper_wick_pts} pts). Desplazamiento institucional bajista limpio.`;
        haMicro.className = "text-[9px] font-mono text-red-300 leading-tight";
      } else if (ha.flat_bottom) {
        haMicro.textContent = `🔬 Microscopio: Cero mecha inferior detectada (${ha.lower_wick_pts} pts). Desplazamiento institucional alcista limpio.`;
        haMicro.className = "text-[9px] font-mono text-emerald-300 leading-tight";
      } else {
        haMicro.textContent = `🔬 Microscopio: Mechas duales activas (Sup ${ha.upper_wick_pts} pts / Inf ${ha.lower_wick_pts} pts). Vela Doji de indecisión.`;
        haMicro.className = "text-[9px] font-mono text-yellow-300 leading-tight";
      }
    }
  }

  // 7. Osciloscopio Squeeze Momentum (LazyBear)
  const sqBadge = document.getElementById("squeezeStatusBadge");
  const sqVal = document.getElementById("squeezeLinregVal");
  const sqDesc = document.getElementById("squeezeDesc");
  const bbWidth = document.getElementById("labBbWidth");
  const kcWidth = document.getElementById("labKcWidth");
  const compRatio = document.getElementById("labCompressionRatio");
  const linregVec = document.getElementById("labLinregVector");

  if (scan.squeeze_momentum) {
    const sq = scan.squeeze_momentum;
    if (sqBadge && sq.status_badge) {
      sqBadge.textContent = sq.status_badge;
      sqBadge.className = sq.sqz_on
        ? "text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-800 font-bold"
        : (scan.detected_state === "breakout_down"
            ? "text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold"
            : "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold");
    }
    if (sqVal) {
      sqVal.textContent = sq.histogram_badge || `${sq.linreg_val} pts`;
      sqVal.className = sq.linreg_val < 0 
        ? "font-mono text-red-400 font-black" 
        : (sq.linreg_val > 0 ? "font-mono text-emerald-400 font-black" : "font-mono text-yellow-400 font-black");
    }
    if (sqDesc && sq.desc) sqDesc.textContent = sq.desc;

    if (bbWidth && sq.bb_width_pts) bbWidth.textContent = `${sq.bb_width_pts} pts`;
    if (kcWidth && sq.kc_width_pts) kcWidth.textContent = `${sq.kc_width_pts} pts`;
    if (compRatio && sq.compression_ratio) {
      compRatio.textContent = `Compresión: ${sq.compression_ratio}%`;
      compRatio.className = sq.sqz_on ? "text-yellow-400 font-bold" : "text-emerald-400 font-bold";
    }
    if (linregVec) {
      linregVec.textContent = sq.sqz_on
        ? `Resorte Acumulando (${sq.linreg_val > 0 ? '+' : ''}${sq.linreg_val} pts)`
        : (sq.linreg_val < 0 ? `Inercia Bajista (${sq.linreg_val} pts)` : `Inercia Alcista (+${sq.linreg_val} pts)`);
      linregVec.className = sq.sqz_on ? "text-yellow-400 font-bold" : (sq.linreg_val < 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold");
    }
  }

  // 8. Matriz de Confluencia: 4 Pills Dinámicos (Filtros 4, 5, 6, 7)
  const p4Badge = document.getElementById("confPill4Badge");
  const p4Title = document.getElementById("confPill4Title");
  const p4Desc = document.getElementById("confPill4Desc");

  const p5Badge = document.getElementById("confPill5Badge");
  const p5Title = document.getElementById("confPill5Title");
  const p5Desc = document.getElementById("confPill5Desc");

  const p6Badge = document.getElementById("confPill6Badge");
  const p6Title = document.getElementById("confPill6Title");
  const p6Desc = document.getElementById("confPill6Desc");

  const p7Badge = document.getElementById("confPill7Badge");
  const p7Title = document.getElementById("confPill7Title");
  const p7Desc = document.getElementById("confPill7Desc");

  if (scan.detected_state === "in_range") {
    if (p4Badge) { p4Badge.textContent = "🟡 EN RANGO M5"; p4Badge.className = "text-yellow-400 font-bold"; }
    if (p4Title) p4Title.textContent = "COMPRESIÓN BSL/SSL";
    if (p4Desc) p4Desc.textContent = `Rango M5 $${scan.m5_range.range_low.toFixed(2)} – $${scan.m5_range.range_high.toFixed(2)}.`;

    if (p5Badge) { p5Badge.textContent = "🟡 EN EL VWAP"; p5Badge.className = "text-yellow-400 font-bold"; }
    if (p5Title) p5Title.textContent = "OSCILACIÓN CHOP";
    if (p5Desc) p5Desc.textContent = `A ${scan.m5_range.pct_position}% del rango intradía.`;

    if (p6Badge) { p6Badge.textContent = scan.heikin_ashi.badge.includes("TECHO") ? "🔴 TECHO PLANO" : (scan.heikin_ashi.badge.includes("BASE") ? "🟢 BASE PLANA" : "🟡 MECHAS DUALES"); }
    if (p6Title) p6Title.textContent = scan.heikin_ashi.indecision ? "INDECISIÓN DOJI" : "VELA CON DIRECCIÓN";
    if (p6Desc) p6Desc.textContent = scan.heikin_ashi.candles_label;

    if (p7Badge) { p7Badge.textContent = scan.squeeze_momentum.sqz_on ? "🟡 SQUEEZE ON" : "⚡ SQUEEZE OFF"; }
    if (p7Title) p7Title.textContent = scan.squeeze_momentum.sqz_on ? "RESORTE COMPRIMIDO" : "EXPANSIÓN ACTIVA";
    if (p7Desc) p7Desc.textContent = `Linreg ${scan.squeeze_momentum.linreg_val > 0 ? '+' : ''}${scan.squeeze_momentum.linreg_val} pts.`;
  } else if (scan.detected_state === "breakout_down") {
    if (p4Badge) { p4Badge.textContent = "🔴 RUPTURA LL"; p4Badge.className = "text-red-400 font-bold"; }
    if (p4Title) p4Title.textContent = "MSS DESPLAZAMIENTO";
    if (p4Desc) p4Desc.textContent = `Bajo London Low ($${scan.m5_range.range_low.toFixed(2)}).`;

    if (p5Badge) { p5Badge.textContent = "🔴 BAJO VWAP"; p5Badge.className = "text-red-400 font-bold"; }
    if (p5Title) p5Title.textContent = "CONTROL VENDEDOR";
    if (p5Desc) p5Desc.textContent = "Desplazamiento bajista activo.";

    if (p6Badge) { p6Badge.textContent = "🔴 TECHO PLANO"; p6Badge.className = "text-red-400 font-bold"; }
    if (p6Title) p6Title.textContent = "CERO MECHA ARRIBA";
    if (p6Desc) p6Desc.textContent = "Venta institucional agresiva.";

    if (p7Badge) { p7Badge.textContent = "⚡ EXPANSIÓN"; p7Badge.className = "text-red-400 font-bold"; }
    if (p7Title) p7Title.textContent = "ROJO ACELERANDO";
    if (p7Desc) p7Desc.textContent = `Linreg ${scan.squeeze_momentum.linreg_val} pts.`;
  } else {
    if (p4Badge) { p4Badge.textContent = "🟢 RUPTURA ALTO"; p4Badge.className = "text-emerald-400 font-bold"; }
    if (p4Title) p4Title.textContent = "EXPANSIÓN BSL";
    if (p4Desc) p4Desc.textContent = `Sobre techo Rango M5 ($${scan.m5_range.range_high.toFixed(2)}).`;

    if (p5Badge) { p5Badge.textContent = "🟢 SOBRE VWAP"; p5Badge.className = "text-emerald-400 font-bold"; }
    if (p5Title) p5Title.textContent = "CONTROL COMPRADOR";
    if (p5Desc) p5Desc.textContent = "Impulso comprador intradía.";

    if (p6Badge) { p6Badge.textContent = "🟢 BASE PLANA"; p6Badge.className = "text-emerald-400 font-bold"; }
    if (p6Title) p6Title.textContent = "CERO MECHA ABAJO";
    if (p6Desc) p6Desc.textContent = "Compras contratendencia.";

    if (p7Badge) { p7Badge.textContent = "⚡ EXPANSIÓN"; p7Badge.className = "text-emerald-400 font-bold"; }
    if (p7Title) p7Title.textContent = "VERDE ACELERANDO";
    if (p7Desc) p7Desc.textContent = `Linreg ${scan.squeeze_momentum.linreg_val > 0 ? '+' : ''}${scan.squeeze_momentum.linreg_val} pts.`;
  }

  // 9. Confluencia Institucional Maestra & Plan de Acción
  if (scan.confluence) {
    const c = scan.confluence;
    const masterBadge = document.getElementById("confluenceMasterBadge");
    const ratingText = document.getElementById("confluenceRatingText");
    const dir = document.getElementById("confActionDirection");
    const trig = document.getElementById("confActionTrigger");
    const sl = document.getElementById("confActionSL");
    const tp = document.getElementById("confActionTP");

    if (ratingText && c.rating) {
      ratingText.textContent = `${c.rating} · ${c.score_pct}%`;
    }

    if (masterBadge) {
      if (scan.detected_state === "in_range") {
        masterBadge.className = "text-xs font-mono px-3 py-1.5 rounded-xl bg-yellow-950 text-yellow-300 border border-yellow-800 flex items-center gap-2 font-bold shadow-md";
        masterBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span><span id="confluenceRatingText">${c.rating} · ${c.score_pct}% RANGO</span>`;
      } else if (scan.detected_state === "breakout_down") {
        masterBadge.className = "text-xs font-mono px-3 py-1.5 rounded-xl bg-red-950 text-red-300 border border-red-800 flex items-center gap-2 font-bold shadow-md";
        masterBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span><span id="confluenceRatingText">${c.rating} · ${c.score_pct}% SELL-ONLY</span>`;
      } else {
        masterBadge.className = "text-xs font-mono px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-2 font-bold shadow-md";
        masterBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span id="confluenceRatingText">${c.rating} · ${c.score_pct}% BUY-CAUTION</span>`;
      }
    }

    if (dir && c.direction) {
      dir.textContent = c.direction;
      dir.className = scan.detected_state === "in_range" 
        ? "text-sm font-black text-yellow-400 font-mono" 
        : (scan.detected_state === "breakout_down" ? "text-sm font-black text-red-400 font-mono" : "text-sm font-black text-emerald-400 font-mono");
    }
    if (trig && c.trigger) trig.textContent = c.trigger;
    if (sl && c.sl) sl.textContent = c.sl;
    if (tp && c.tp) tp.textContent = c.tp;
  }

  // 10. Actualización Dinámica de Niveles SMC, Order Block y Reglas de Precisión
  if (scan.smc_levels) {
    const s = scan.smc_levels;
    const mssClose = document.getElementById("labMssClose");
    const mssPts = document.getElementById("labMssPts");
    const fvgRange = document.getElementById("labFvgRange");
    const fvgCe = document.getElementById("labFvgCe");
    const obBox = document.getElementById("labOrderBlock");
    const fvgProto = document.getElementById("labFvgProtocolText");
    const pocEl = document.getElementById("labPoc");
    const vahEl = document.getElementById("labVah");
    const valEl = document.getElementById("labVal");
    const ruleForbid = document.getElementById("labRuleForbiddenText");
    const ruleA = document.getElementById("labStrategyAText");
    const ruleB = document.getElementById("labStrategyBText");

    if (mssClose) mssClose.textContent = `$${s.mss_close.toFixed(2)}`;
    if (mssPts && scan.m5_range) mssPts.textContent = `${scan.m5_range.range_width_pts.toLocaleString()} pts (${scan.m5_range.range_width_usd})`;
    if (fvgRange) fvgRange.textContent = s.fvg_range;
    if (fvgCe) fvgCe.textContent = `$${s.fvg_ce.toFixed(2)}`;
    if (obBox) obBox.textContent = s.order_block;
    if (fvgProto) fvgProto.innerHTML = `<strong>Punto de entrada de alta precisión:</strong> Esperar retroceso hacia el 50% C.E. del FVG ($${s.fvg_ce.toFixed(2)}) con Stop Loss justo por encima del Bearish Order Block (${s.order_block.split('–')[1] || s.order_block}).`;
    if (pocEl) pocEl.textContent = `$${s.poc.toFixed(2)}`;
    if (vahEl) vahEl.textContent = `$${s.vah.toFixed(2)}`;
    if (valEl) valEl.textContent = `$${s.val.toFixed(2)}`;

    if (ruleForbid && s.forbidden_rule) ruleForbid.textContent = s.forbidden_rule;
    if (ruleA && s.strategy_a) ruleA.textContent = s.strategy_a;
    if (ruleB && s.strategy_b) ruleB.textContent = s.strategy_b;
  }

  currentM5StateKey = scan.detected_state;
  initIcons();
}

function setM5MarketState(stateKey) {
  currentM5StateKey = stateKey;
  if (lastM5ScanData) {
    renderM5ScanResults(lastM5ScanData);
    return;
  }
  triggerM5Scan();
}

// -------------------------------------------------------------
// Reloj Institucional, Guardia de Sesión NY & Horarios Óptimos
// -------------------------------------------------------------
let marketClockInterval = null;
let lastCalculatedSessionStatus = { isInSession: false, countdownFormatted: "--", optimalInfo: null };

function convertNyTimeToLocal(nyHour, nyMin) {
  try {
    const now = new Date();
    const nyStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyStr);
    const diffMs = now.getTime() - nyDate.getTime();

    const targetDate = new Date(nyDate);
    targetDate.setHours(nyHour, nyMin, 0, 0);
    const localDate = new Date(targetDate.getTime() + diffMs);

    return localDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch (e) {
    const period = nyHour >= 12 ? "PM" : "AM";
    const h12 = nyHour % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(nyMin).padStart(2, "0")} ${period}`;
  }
}

function calculateOptimalTradingWindow(weekday, year, month, day, weeklyNews) {
  const dayNamesMap = {
    Mon: "Lunes",
    Tue: "Martes",
    Wed: "Miércoles",
    Thu: "Jueves",
    Fri: "Viernes",
    Sat: "Sábado",
    Sun: "Domingo"
  };
  const dayName = dayNamesMap[weekday] || weekday;
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  let targetDayData = null;
  if (weeklyNews && Array.isArray(weeklyNews.days)) {
    targetDayData = weeklyNews.days.find(d => d.date === dateStr);
  }

  if (!targetDayData && weeklyNews && Array.isArray(weeklyNews.days)) {
    targetDayData = weeklyNews.days.find(d => d.day_name && d.day_name.toLowerCase().startsWith(dayName.toLowerCase().slice(0, 3)));
  }

  let hasEvent830 = false;
  let hasEvent815 = false;
  let hasEvent1000 = false;
  let hasEventFomc = false;
  let mainEventTitle = "";

  if (targetDayData && Array.isArray(targetDayData.events)) {
    for (const ev of targetDayData.events) {
      const timeStr = String(ev.time || "");
      const isHigh = ev.impact === "HIGH" || ev.impact === "CRITICAL";

      if (isHigh && timeStr.includes("08:30")) {
        hasEvent830 = true;
        mainEventTitle = ev.title;
      } else if (isHigh && timeStr.includes("08:15")) {
        hasEvent815 = true;
        mainEventTitle = ev.title;
      } else if (isHigh && timeStr.includes("10:00")) {
        hasEvent1000 = true;
        mainEventTitle = ev.title;
      } else if (isHigh && (timeStr.includes("02:00 PM") || timeStr.includes("14:00"))) {
        hasEventFomc = true;
        mainEventTitle = ev.title;
      }
    }
  }

  let nyWindow = "08:15 AM – 11:30 AM NY";
  let localWindow = `${convertNyTimeToLocal(8, 15)} – ${convertNyTimeToLocal(11, 30)}`;
  let newsReason = "Día limpio sin noticias rojas matutinas. Spreads estables y vía libre.";

  if (hasEvent830) {
    nyWindow = "08:45 AM – 11:30 AM NY";
    localWindow = `${convertNyTimeToLocal(8, 45)} – ${convertNyTimeToLocal(11, 30)}`;
    newsReason = `⚠️ Noticia a las 08:30 AM (${mainEventTitle}). Iniciar tras 15 min de absorción.`;
  } else if (hasEvent815) {
    nyWindow = "08:30 AM – 11:30 AM NY";
    localWindow = `${convertNyTimeToLocal(8, 30)} – ${convertNyTimeToLocal(11, 30)}`;
    newsReason = `⚠️ Noticia ADP a las 08:15 AM (${mainEventTitle}). Operativa tras vela 08:30.`;
  } else if (hasEvent1000) {
    nyWindow = "08:15 AM – 09:45 AM NY & 10:15 AM – 11:30 AM NY";
    localWindow = `${convertNyTimeToLocal(8, 15)} – ${convertNyTimeToLocal(9, 45)} & ${convertNyTimeToLocal(10, 15)} – ${convertNyTimeToLocal(11, 30)}`;
    newsReason = `⚠️ Pausa táctica obligatoria de 09:45 a 10:15 NY por ${mainEventTitle} (10:00 AM NY).`;
  } else if (hasEventFomc) {
    nyWindow = "08:30 AM – 10:30 AM NY (Scalping breve)";
    localWindow = `${convertNyTimeToLocal(8, 30)} – ${convertNyTimeToLocal(10, 30)}`;
    newsReason = `🔥 Decisión de Tasas FOMC (14:00 NY). Todo trade cerrado antes de las 11:00 NY.`;
  }

  if (weekday === "Sat" || (weekday === "Sun" && new Date().getHours() < 18)) {
    nyWindow = "Lunes 08:15 AM – 11:30 AM NY";
    localWindow = `Lunes ${convertNyTimeToLocal(8, 15)} – ${convertNyTimeToLocal(11, 30)}`;
    newsReason = "Mercado Spot cerrado por fin de semana. Reapertura de sesión el lunes.";
  }

  return { dayName, nyWindow, localWindow, newsReason };
}

function getNySessionStatus(now) {
  const nyFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const parts = nyFormatter.formatToParts(now);
  const getPart = type => (parts.find(x => x.type === type) || {}).value;

  const weekday = getPart("weekday");
  const year = parseInt(getPart("year"), 10) || 2026;
  const month = parseInt(getPart("month"), 10) || 11;
  const day = parseInt(getPart("day"), 10) || 2;
  const hour = parseInt(getPart("hour"), 10) || 0;
  const min = parseInt(getPart("minute"), 10) || 0;
  const sec = parseInt(getPart("second"), 10) || 0;

  const currentSecsOfDay = hour * 3600 + min * 60 + sec;
  const sessionStartSecs = 8 * 3600; // 08:00:00 NY
  const sessionEndSecs = 11 * 3600 + 30 * 60; // 11:30:00 NY

  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  const isInSession = isWeekday && currentSecsOfDay >= sessionStartSecs && currentSecsOfDay < sessionEndSecs;

  let countdownText = "";
  let countdownFormatted = "";

  if (isInSession) {
    const remainingSecs = Math.max(0, sessionEndSecs - currentSecsOfDay);
    const rH = Math.floor(remainingSecs / 3600);
    const rM = Math.floor((remainingSecs % 3600) / 60);
    const rS = remainingSecs % 60;
    countdownFormatted = `${String(rH).padStart(2, "0")}h ${String(rM).padStart(2, "0")}m ${String(rS).padStart(2, "0")}s`;
    countdownText = `⏳ Restan: ${countdownFormatted} de sesión`;
  } else {
    let daysToAdd = 0;
    if (["Mon", "Tue", "Wed", "Thu"].includes(weekday)) {
      daysToAdd = (currentSecsOfDay < sessionStartSecs) ? 0 : 1;
    } else if (weekday === "Fri") {
      daysToAdd = (currentSecsOfDay < sessionStartSecs) ? 0 : 3;
    } else if (weekday === "Sat") {
      daysToAdd = 2;
    } else if (weekday === "Sun") {
      daysToAdd = 1;
    }

    const targetSecs = (daysToAdd * 86400) + sessionStartSecs;
    const remainingSecs = Math.max(0, targetSecs - currentSecsOfDay);
    const rH = Math.floor(remainingSecs / 3600);
    const rM = Math.floor((remainingSecs % 3600) / 60);
    const rS = remainingSecs % 60;
    countdownFormatted = `${String(rH).padStart(2, "0")}h ${String(rM).padStart(2, "0")}m ${String(rS).padStart(2, "0")}s`;
    countdownText = `⏳ Inicia en: ${countdownFormatted}`;
  }

  const optimalInfo = calculateOptimalTradingWindow(weekday, year, month, day, weeklyNewsState);

  lastCalculatedSessionStatus = {
    isInSession,
    countdownText,
    countdownFormatted,
    optimalInfo,
    weekday,
    hour,
    min,
    sec
  };

  return lastCalculatedSessionStatus;
}

// -------------------------------------------------------------
// Semáforo Dinámico en Tiempo Real (News Risk Shield)
// -------------------------------------------------------------
let lastNewsShieldStatus = {
  isBlocked: false,
  isWarning: false,
  event: null,
  diffMinutes: null,
  statusText: "🟢 VÍA LIBRE",
  headline: "Sin noticias de alto impacto en las próximas 2 horas.",
  advice: "Operativa 100% autorizada con lotaje y Stop Loss normal. Spreads estables en el broker.",
  bannerText: ""
};

function parseNewsTimeMinutes(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function evaluateDynamicNewsShield() {
  const now = new Date();
  const nyFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = nyFormatter.formatToParts(now);
  const getP = t => (parts.find(x => x.type === t) || {}).value;
  const nyDateStr = `${getP("year")}-${getP("month")}-${getP("day")}`;
  const currentTotalMin = parseInt(getP("hour"), 10) * 60 + parseInt(getP("minute"), 10);

  // 1. Obtener eventos de hoy desde weeklyNewsState o fallback oficial
  let todayEvents = [];
  if (weeklyNewsState && Array.isArray(weeklyNewsState.days)) {
    const todayObj = weeklyNewsState.days.find(d => d.date === nyDateStr);
    if (todayObj && Array.isArray(todayObj.events)) {
      todayEvents = todayObj.events;
    }
  }

  // Fallback con el calendario exacto de la semana si aún no cargó el JSON
  if (todayEvents.length === 0) {
    if (nyDateStr === "2026-11-02") {
      todayEvents = [
        { time: "10:00 AM NY", title: "ISM PMI Manufacturero de EE.UU.", impact: "HIGH" },
        { time: "10:00 AM NY", title: "Precios Pagados en Manufactura ISM", impact: "MEDIUM" }
      ];
    } else if (nyDateStr === "2026-11-03") {
      todayEvents = [
        { time: "10:00 AM NY", title: "Encuesta de Ofertas de Empleo JOLTS", impact: "HIGH" },
        { time: "01:30 PM NY", title: "Discurso Miembros Fed", impact: "MEDIUM" }
      ];
    } else if (nyDateStr === "2026-11-04") {
      todayEvents = [
        { time: "08:15 AM NY", title: "Informe de Empleo No Agrícola ADP", impact: "HIGH" },
        { time: "10:00 AM NY", title: "ISM PMI del Sector Servicios", impact: "HIGH" }
      ];
    } else if (nyDateStr === "2026-11-05") {
      todayEvents = [
        { time: "08:30 AM NY", title: "Nuevas Peticiones de Subsidio por Desempleo", impact: "HIGH" },
        { time: "08:30 AM NY", title: "Balanza Comercial EE.UU.", impact: "MEDIUM" }
      ];
    } else if (nyDateStr === "2026-11-06") {
      todayEvents = [
        { time: "08:30 AM NY", title: "NFP (Nóminas No Agrícolas de EE.UU.)", impact: "CRITICAL" },
        { time: "08:30 AM NY", title: "Tasa de Desempleo de EE.UU.", impact: "HIGH" }
      ];
    }
  }

  let activeBlock = null;
  let activeWarning = null;

  for (const ev of todayEvents) {
    if (ev.impact === "HIGH" || ev.impact === "CRITICAL") {
      const evMin = parseNewsTimeMinutes(ev.time);
      if (evMin !== null) {
        const diff = evMin - currentTotalMin;
        // Ventana estricta de bloqueo institucional: 15 min antes hasta 15 min después (-15 a +15)
        if (diff >= -15 && diff <= 15) {
          activeBlock = { event: ev, diffMinutes: diff, evMin };
          break;
        } else if (diff > 15 && diff <= 120) {
          if (!activeWarning || diff < activeWarning.diffMinutes) {
            activeWarning = { event: ev, diffMinutes: diff, evMin };
          }
        }
      }
    }
  }

  const badgeEl = document.getElementById("newsShieldStatusBadge");
  const textEl = document.getElementById("newsShieldStatusText");
  const headlineEl = document.getElementById("newsShieldHeadline");
  const adviceEl = document.getElementById("newsShieldAdvice");
  const confDot3 = document.getElementById("confluenceDot3");
  const confCheck3 = document.getElementById("confluenceCheck3");

  const precBadgeEl = document.getElementById("precNewsShieldBadge");
  const precTextEl = document.getElementById("precNewsShieldStatusText");
  const precHeadlineEl = document.getElementById("precNewsShieldHeadline");
  const precAdviceEl = document.getElementById("precNewsShieldAdvice");

  const newsTrafficLight = document.getElementById("newsTrafficLightStatus");
  const newsCountdownText = document.getElementById("newsCountdownText");
  const newsTrafficIconBox = document.getElementById("newsTrafficIconBox");

  if (activeBlock) {
    const { event, diffMinutes } = activeBlock;
    const isPre = diffMinutes > 0;
    const absMin = Math.abs(diffMinutes);
    const remCoolDown = Math.max(1, 15 - absMin);

    if (newsTrafficLight) {
      if (absMin <= 2) {
        newsTrafficLight.innerHTML = '<span class="w-3 h-3 rounded-full bg-red-500 animate-ping shrink-0"></span><span class="text-rose-400 font-black">VENTANA CRÍTICA ±2 MIN (PROHIBIDO OPERAR EN FONDEADO)</span>';
        if (newsCountdownText) newsCountdownText.textContent = `⛔ Regla Orion: No abrir, cerrar ni modificar órdenes (${absMin} min de ${event.title})`;
        if (newsTrafficIconBox) newsTrafficIconBox.className = "p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/40 shrink-0";
      } else {
        newsTrafficLight.innerHTML = '<span class="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0"></span><span class="text-amber-400 font-bold">ALERTA NOTICIA (< 15 MIN)</span>';
        if (newsCountdownText) newsCountdownText.textContent = `${event.title} a las ${event.time} (${absMin} min)`;
        if (newsTrafficIconBox) newsTrafficIconBox.className = "p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 shrink-0";
      }
    }

    lastNewsShieldStatus = {
      isBlocked: true,
      isWarning: false,
      event,
      diffMinutes,
      statusText: isPre ? `🔴 BLOQUEO PRE-NOTICIA (-${absMin}m)` : `💥 EN VENTANA DE SHOCK (+${absMin}m)`,
      headline: isPre 
        ? `🚨 ${event.title} en ${absMin} min (${event.time})`
        : `💥 ${event.title} publicado hace ${absMin} min`,
      advice: isPre
        ? `⛔ OPERATIVA CONGELADA: Ventana de seguridad de 15 min antes del anuncio. Cero aperturas de trades. Spreads en expansión y riesgo inminente de deslizamiento.`
        : `⛔ OPERATIVA CONGELADA: Fase 1 y 2 de shock y absorción. Esperar ${remCoolDown} min más para estabilización de spreads y confirmación de vela M5.`,
      bannerText: isPre
        ? `🚫 <strong>NO OPERAR · NOTICIA EN ${absMin} MIN:</strong> Publicación inminente de ${event.title} (${event.time}). Regla institucional de congelar ±15 min activa.`
        : `🚫 <strong>NO OPERAR · VENTANA DE SHOCK POST-NOTICIA:</strong> ${event.title} publicado hace ${absMin} min. Faltan ${remCoolDown} min de absorción institucional para buscar confluencia segura.`
    };

    if (badgeEl) badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center gap-1 animate-pulse";
    if (textEl) textEl.textContent = lastNewsShieldStatus.statusText;
    if (headlineEl) headlineEl.innerHTML = `<span class="text-rose-400 font-black">${lastNewsShieldStatus.headline}</span>`;
    if (adviceEl) adviceEl.textContent = lastNewsShieldStatus.advice;

    if (precBadgeEl) precBadgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center gap-1 animate-pulse";
    if (precTextEl) precTextEl.textContent = lastNewsShieldStatus.statusText;
    if (precHeadlineEl) precHeadlineEl.innerHTML = `<span class="text-rose-400 font-black">${lastNewsShieldStatus.headline}</span>`;
    if (precAdviceEl) precAdviceEl.textContent = lastNewsShieldStatus.advice;

    if (confDot3) confDot3.className = "w-2 h-2 rounded-full bg-rose-500 animate-pulse";
    if (confCheck3) {
      confCheck3.textContent = isPre ? `✗ BLOQUEO: ${event.title} (-${absMin}m)` : `✗ SHOCK: ${event.title} (+${absMin}m)`;
      confCheck3.className = "font-mono text-rose-400 font-bold text-[10px]";
    }

  } else if (activeWarning) {
    const { event, diffMinutes } = activeWarning;
    lastNewsShieldStatus = {
      isBlocked: false,
      isWarning: true,
      event,
      diffMinutes,
      statusText: `🟡 NOTICIA EN ${diffMinutes}m`,
      headline: `⚠️ Próxima noticia: ${event.title} (${event.time})`,
      advice: `Operativa autorizada con precaución. Si abres un trade en M5, asegúrate de tomar ganancias o ajustar a Breakeven antes de las ${event.time} (${diffMinutes} min restantes).`,
      bannerText: ""
    };

    if (badgeEl) badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-yellow-950 text-yellow-300 border border-yellow-600 font-bold flex items-center gap-1";
    if (textEl) textEl.textContent = lastNewsShieldStatus.statusText;
    if (headlineEl) headlineEl.innerHTML = `<span class="text-yellow-300 font-bold">${lastNewsShieldStatus.headline}</span>`;
    if (adviceEl) adviceEl.textContent = lastNewsShieldStatus.advice;

    if (precBadgeEl) precBadgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-yellow-950 text-yellow-300 border border-yellow-600 font-bold flex items-center gap-1";
    if (precTextEl) precTextEl.textContent = lastNewsShieldStatus.statusText;
    if (precHeadlineEl) precHeadlineEl.innerHTML = `<span class="text-yellow-300 font-bold">${lastNewsShieldStatus.headline}</span>`;
    if (precAdviceEl) precAdviceEl.textContent = lastNewsShieldStatus.advice;

    if (confDot3) confDot3.className = "w-2 h-2 rounded-full bg-yellow-400";
    if (confCheck3) {
      confCheck3.textContent = `✓ VÍA LIBRE (${event.title} en ${diffMinutes}m)`;
      confCheck3.className = "font-mono text-yellow-400 font-bold text-[10px]";
    }

  } else {
    lastNewsShieldStatus = {
      isBlocked: false,
      isWarning: false,
      event: null,
      diffMinutes: null,
      statusText: "🟢 VÍA LIBRE",
      headline: "Sin noticias de alto impacto en las próximas 2 horas.",
      advice: "Operativa 100% autorizada con lotaje y Stop Loss normal. Spreads estables en el broker.",
      bannerText: ""
    };

    if (newsTrafficLight) {
      newsTrafficLight.innerHTML = '<span class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0"></span><span class="text-emerald-400 font-bold">ZONA SEGURA (Sin noticias rojas)</span>';
      if (newsCountdownText) newsCountdownText.textContent = "Spreads y volatilidad normales para operativa manual";
      if (newsTrafficIconBox) newsTrafficIconBox.className = "p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0";
    }

    if (badgeEl) badgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold flex items-center gap-1";
    if (textEl) textEl.textContent = "🟢 VÍA LIBRE";
    if (headlineEl) headlineEl.textContent = lastNewsShieldStatus.headline;
    if (adviceEl) adviceEl.textContent = lastNewsShieldStatus.advice;

    if (precBadgeEl) precBadgeEl.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold flex items-center gap-1";
    if (precTextEl) precTextEl.textContent = "🟢 VÍA LIBRE";
    if (precHeadlineEl) precHeadlineEl.textContent = lastNewsShieldStatus.headline;
    if (precAdviceEl) precAdviceEl.textContent = lastNewsShieldStatus.advice;

    if (confDot3) confDot3.className = "w-2 h-2 rounded-full bg-emerald-400";
    if (confCheck3) {
      confCheck3.textContent = "✓ VÍA LIBRE";
      confCheck3.className = "font-mono text-emerald-400 font-bold text-[10px]";
    }
  }

  return lastNewsShieldStatus;
}

function setupNewsView() {
  renderNewsView();
}

async function renderNewsView() {
  try {
    const res = await fetch('/api/news');
    if (!res.ok) return;
    const data = await res.json();
    if (data) {
      weeklyNewsState = data;
      evaluateDynamicNewsShield();
    }
  } catch (e) {
    console.error('Error cargando noticias:', e);
  }
}

// ====================================================
// PRE-MERCADO INSTITUCIONAL XAU/USD (DAY TRADING M5/M15)
// ====================================================
let premarketDataState = null;

function setupPremarketView() {
  const btnScan = document.getElementById('btnScanMarket');
  const btnQuickScan = document.getElementById('btnQuickPremarketScan');
  const btnCopy = document.getElementById('btnCopyPremarket');
  const btnRefresh = document.getElementById('btnRefreshPremarket');

  if (btnScan) {
    btnScan.addEventListener('click', triggerPremarketScan);
  }
  if (btnQuickScan) {
    btnQuickScan.addEventListener('click', () => {
      if (typeof window.switchTabTo === 'function') {
        window.switchTabTo('premarket');
      }
      setTimeout(() => {
        triggerPremarketScan();
      }, 150);
    });
  }
  if (btnCopy) {
    btnCopy.addEventListener('click', copyPremarketReportToClipboard);
  }
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      showToast('🔄 Recargando datos de Pre-Mercado...', 'info', 2500);
      await renderPremarketView();
      showToast('✅ Informe Pre-Mercado actualizado', 'success', 3000);
    });
  }

  renderPremarketView();
}

async function triggerPremarketScan() {
  const btnScan = document.getElementById('btnScanMarket');
  const textScan = document.getElementById('textScanMarket');
  const iconScan = document.getElementById('iconScanMarket');
  const progressBox = document.getElementById('premarketScanProgressBox');
  const progressBar = document.getElementById('scanProgressBar');
  const progressPct = document.getElementById('scanProgressPct');
  const statusTitle = document.getElementById('scanStatusTitle');

  if (btnScan) {
    btnScan.disabled = true;
    btnScan.classList.add('opacity-75', 'cursor-not-allowed');
  }
  if (textScan) textScan.textContent = "Escaneando...";
  if (iconScan) iconScan.classList.add('animate-spin');

  if (progressBox) progressBox.classList.remove('hidden');
  if (statusTitle) statusTitle.textContent = "Escaneando Absolutamente Todo (Pre-Mercado XAU/USD)...";
  if (progressBar) progressBar.style.width = "0%";
  if (progressPct) progressPct.textContent = "0% Analizado";

  const steps = [
    { id: "scanStep1", name: "1. Noticias Macro (12h)", pct: "18%" },
    { id: "scanStep2", name: "2. Calendario UTC-5 & Bloqueo", pct: "36%" },
    { id: "scanStep3", name: "3. Cierre Anterior & Sesión de Londres", pct: "54%" },
    { id: "scanStep4", name: "4. Mapa Técnico & ADR 14", pct: "72%" },
    { id: "scanStep5", name: "5. Plan de Sesión New York", pct: "90%" },
    { id: "scanStep6", name: "6. Riesgos & Regla de Oro", pct: "100%" }
  ];

  // Reset steps visually
  steps.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) {
      el.className = "p-2 rounded-lg bg-gray-900/90 border border-gray-800 flex items-center gap-2 transition";
      const icon = el.querySelector('.step-icon');
      if (icon) {
        icon.textContent = "⏳";
        icon.className = "step-icon text-gray-400";
      }
    }
  });

  // Launch backend scan in parallel
  const scanPromise = fetch('/api/premarket/scan', { method: 'POST' })
    .then(r => r.json())
    .catch(err => {
      console.error('Error en fetch /api/premarket/scan:', err);
      return null;
    });

  // Animate checklist progressively
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 260));
    const step = steps[i];
    const el = document.getElementById(step.id);
    if (el) {
      el.className = "p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/50 flex items-center gap-2 transition shadow-md shadow-emerald-950/40";
      const icon = el.querySelector('.step-icon');
      if (icon) {
        icon.textContent = "✓";
        icon.className = "step-icon text-emerald-400 font-bold";
      }
    }
    if (progressBar) progressBar.style.width = step.pct;
    if (progressPct) progressPct.textContent = `${step.pct} Analizado`;
  }

  const scanResult = await scanPromise;
  if (scanResult) {
    premarketDataState = scanResult;
  }

  await new Promise(r => setTimeout(r, 200));

  if (statusTitle) statusTitle.textContent = "✅ Escaneo Pre-Sesión Completado: Todo Analizado para New York";
  if (progressPct) progressPct.textContent = "100% Listo";
  if (textScan) textScan.textContent = "Escanear";
  if (iconScan) iconScan.classList.remove('animate-spin');
  if (btnScan) {
    btnScan.disabled = false;
    btnScan.classList.remove('opacity-75', 'cursor-not-allowed');
  }

  showToast("⚡ Escaneo Completo: Análisis Pre-Sesión XAU/USD listo para operar", "success", 4000);
}

async function renderPremarketView() {
  try {
    const res = await fetch('/api/premarket');
    if (!res.ok) return;
    const data = await res.json();
    if (data) {
      premarketDataState = data;
    }
  } catch (e) {
    console.error('Error al cargar datos de premercado:', e);
  }
}

function copyPremarketReportToClipboard() {
  const reportText = `🏛️ INFORME PRE-MERCADO INSTITUCIONAL — XAU/USD (ORO SPOT)
Sesión: New York Killzone (08:00 – 11:30 AM UTC-5 NY)
Estilo: Day Trading M5 (Sesgo direccional tomado en M15)
Horario Base: UTC-5 (New York / Eastern Time - ET)
Gestión: Orion Nova 50K (0.50% / $250 - Máx 1.00%) · Bloqueo ±15 min noticias

⚡ RESUMEN FLASH EN 20 SEGUNDOS (5 LÍNEAS CLAVE):
1. Sesgo: Bajista institucional (Sell-Side) en XAU/USD; estructura 1H y 15m con máximos decrecientes.
2. Entrada: Venta en retroceso a FVG M15 entre $2,731.50 y $2,733.50 post-apertura.
3. Invalidación: $2,736.50 (SL técnico $3.00 / 30 pips; riesgo máx 0.50% / $250 con 0.83 lotes).
4. Objetivo (TP): $2,718.50 (PDL - Mínimo de ayer) con extensión a $2,712.00 (R:R 1:3.0 a 1:4.2).
5. Ventana Prohibida: Cero trades entre 08:15 y 08:45 AM (UTC-5 NY) por NFP y empleo de EE.UU.

1. NOTICIAS DE LAS ÚLTIMAS 12 HORAS:
• NFP y Empleo EE.UU. superan previsiones (165K vs 65K exp) ➔ Afecta: DXY (104.20), US10Y (4.38%), Oro ➔ Sesgo: BEARISH (Presión Vendedora)
• Tono Hawkish miembros Fed ➔ Afecta: XAU/USD, Bonos ➔ Sesgo: BEARISH (Techo Intradiario)
• Demanda física Banco Central de China (PBoC) y Geopolítica ➔ Afecta: XAU/USD ➔ Sesgo: BULLISH_FLOOR (Piso Estructural)

2. CALENDARIO ECONÓMICO DE HOY (HORA UTC-5 NY):
• 08:30 AM (UTC-5 NY) | USD | Nóminas No Agrícolas (NFP Oct) | ALTO | Exp: 180K/65K | Prev: 254K | ⛔ NO OPERAR (08:15 – 08:45 AM)
• 08:30 AM (UTC-5 NY) | USD | Tasa Desempleo EE.UU. | ALTO | Exp: 4.1% | Prev: 4.1% | ⛔ NO OPERAR (08:15 – 08:45 AM)
• 08:30 AM (UTC-5 NY) | USD | Salario Medio por Hora (m/m) | MEDIO | Exp: +0.3% | Prev: +0.4%
• 10:00 AM (UTC-5 NY) | USD | Confianza Univ. Michigan | MEDIO | Exp: 70.8 | Prev: 70.5 | ⚠️ Pausa táctica 09:45 – 10:15 AM
• 01:00 PM (UTC-5 NY) | USD | Subasta Tesoro 10 Años (US10Y) | BAJO | Prev: 4.35% | Fuera de Killzone principal

3. CIERRE ANTERIOR & SESIÓN DE LONDRES:
• Cierre Ayer: $2,725.80 (-0.65% / -$17.80 USD) | Rango: $29.70 (2,970 pts) | Posición: Parte Baja (35%)
• Máximo (PDH): $2,748.20 | Mínimo (PDL): $2,718.50
• Sesión de Londres: Barrió liquidez previa hasta $2,731.50 y fue absorbido con ventas institucionales hacia $2,724.00.
• Veredicto: Movimiento de CONTINUACIÓN BAJISTA respecto a los últimos días tras rechazo en $2,750+.

4. MAPA TÉCNICO DE XAU/USD:
• Tendencias: 1H Bajista Estructural | 15m Bajista con Consolidación pre-NFP (Bandera bajista)
• Niveles clave: PDH $2,748.20 | PDL $2,718.50 | Daily Open $2,725.50 | NY Open $2,724.00
• Resistencias: $2,732.00–$2,735.50 (FVG M15/Londres - ALTA) | $2,742.00–$2,748.20 (OB H1/PDH - EXTREMA)
• Soportes: $2,718.00–$2,720.00 (PDL - MEDIA) | $2,705.00–$2,710.00 (Demanda H1 - ALTA)
• Volatilidad ATR (14): $34.50 (3,450 pts) | Consumido: $13.20 (38.2%) | Remanente NY: $21.30 (61.8%)
• Estado: Equilibrium intradiario ($2,724.00), zona Premium de Oferta respecto al soporte de $2,718.50.

5. PLAN DE SESIÓN NEW YORK:
• Sesgo Direccional: BEARISH (Sell-Side Institucional)
• Escenario Bajista (Principal): Venta en retroceso a FVG M15 ($2,732.00 – $2,735.00) tras NFP. Entrada: $2,731.50 – $2,733.50. SL: $2,736.50 (SL $3.00 / 30 pips). TP: $2,718.50 ➔ $2,712.00. R:R 1:3.0 a 1:4.2.
• Escenario Alcista (Alternativo): Barrido de PDL falso rompimiento < $2,718.50 con rechazo en M5 y MSS. Entrada: $2,721.50. SL: $2,716.50. TP: $2,734.00. R:R 1:2.30.
• Veredicto de Ejecución: El mejor setup es la VENTA en la 2da onda post-NFP (08:50 – 09:30 AM UTC-5 NY). Si rompe directo sin retroceso a $2,732.00, DEJARLO QUIETO.

6. RIESGOS, CORRELACIONES & REGLA DE ORO:
• Correlaciones Activas: DXY (104.20, inv. -0.88), US10Y Yield (+4.38%, inv.), VIX (16.20, calma), WTI Crude ($71.50, neutral).
• Horas Ilíquidas: 06:00 – 07:00 AM UTC-5 NY (London Lunch), 11:00 – 11:30 AM UTC-5 NY (London Fix).
• ¿Qué me haría quedarme fuera hoy?: "Si tras las noticias de las 08:30 AM (UTC-5 NY) el spread de Oro supera los 40 puntos después de las 08:45 AM (UTC-5 NY), o si una vela M15 cierra con cuerpo por encima de $2,738.00, anulo el sesgo y cierro la plataforma sin operar."`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(reportText).then(() => {
      showToast('📋 Informe Pre-Mercado copiado al portapapeles', 'info', 4000);
    }).catch(err => {
      console.error('Error al copiar:', err);
      fallbackCopyTextToClipboard(reportText);
    });
  } else {
    fallbackCopyTextToClipboard(reportText);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('📋 Informe Pre-Mercado copiado al portapapeles', 'info', 4000);
  } catch (err) {
    showToast('⚠️ No se pudo copiar automáticamente', 'error', 3000);
  }
  document.body.removeChild(textArea);
}

function startMarketClock() {
  function tick() {
    const now = new Date();
    const session = getNySessionStatus(now);

    const nyClockEl = document.getElementById("marketNyClock");
    if (nyClockEl) {
      nyClockEl.textContent = `${String(session.hour).padStart(2, "0")}:${String(session.min).padStart(2, "0")}:${String(session.sec).padStart(2, "0")} NY (ET)`;
    }

    const newsNyClock = document.getElementById("newsNyClock");
    if (newsNyClock) {
      newsNyClock.textContent = `${String(session.hour).padStart(2, "0")}:${String(session.min).padStart(2, "0")}:${String(session.sec).padStart(2, "0")} NY`;
    }

    const newsUtcClock = document.getElementById("newsUtcClock");
    if (newsUtcClock) {
      newsUtcClock.textContent = `UTC: ${now.toUTCString().slice(17, 25)}`;
    }

    const newsCurrentSession = document.getElementById("newsCurrentSession");
    if (newsCurrentSession) {
      let sessionName = "Pre-Londres (Fuera de Horario)";
      if (session.hour >= 3 && session.hour < 8) sessionName = "Sesión Londres (03:00 - 08:00 NY)";
      else if (session.hour >= 8 && (session.hour < 11 || (session.hour === 11 && session.min <= 30))) sessionName = "New York Killzone (08:00 - 11:30 NY)";
      else if (session.hour >= 11 && session.hour < 13) sessionName = "London Fix & Post-Killzone";
      else if (session.hour >= 13 && session.hour < 17) sessionName = "Sesión Tarde New York";
      else sessionName = "Mercado Fuera de Sesión (Cierre NY)";
      newsCurrentSession.textContent = sessionName;
    }

    const localClockEl = document.getElementById("marketLocalClock");
    if (localClockEl) {
      localClockEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    // Actualizar Banner de Guardia de Sesión NY
    const guardBanner = document.getElementById("sessionGuardBanner");
    const guardBadge = document.getElementById("sessionGuardStatusBadge");
    const guardCountdown = document.getElementById("sessionGuardCountdownText");
    const guardHeadline = document.getElementById("sessionGuardHeadline");
    const guardIconBox = document.getElementById("sessionGuardIconBox");

    const optDayLabel = document.getElementById("optimalDayLabel");
    const optNyWindow = document.getElementById("optimalNyWindowDisplay");
    const optLocalWindow = document.getElementById("optimalLocalWindowDisplay");
    const optReason = document.getElementById("optimalNewsReasonDisplay");

    if (optDayLabel && session.optimalInfo) optDayLabel.textContent = session.optimalInfo.dayName;
    if (optNyWindow && session.optimalInfo) optNyWindow.textContent = session.optimalInfo.nyWindow;
    if (optLocalWindow && session.optimalInfo) optLocalWindow.textContent = session.optimalInfo.localWindow;
    if (optReason && session.optimalInfo) optReason.textContent = session.optimalInfo.newsReason;

    if (session.isInSession) {
      if (guardBanner) {
        guardBanner.className = "p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 shadow-xl bg-emerald-950/40 border-emerald-500/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4";
      }
      if (guardIconBox) {
        guardIconBox.className = "w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg";
        guardIconBox.innerHTML = '<i data-lucide="activity" class="w-6 h-6"></i>';
      }
      if (guardBadge) {
        guardBadge.className = "px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs uppercase tracking-wider font-mono shadow-md flex items-center gap-1.5 animate-pulse";
        guardBadge.innerHTML = '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>SESIÓN NY ACTIVA · EN HORARIO</span>';
      }
      if (guardCountdown) {
        guardCountdown.textContent = session.countdownText;
      }
      if (guardHeadline) {
        guardHeadline.innerHTML = `Ventana Dorada de New York abierta (08:00 – 11:30 NY). Spreads mínimos y volumen bancario óptimo en XAU/USD. Ejecuta únicamente confluencia con el sesgo diario y gatillo M5.`;
      }
    } else {
      if (guardBanner) {
        guardBanner.className = "p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 shadow-xl bg-rose-950/40 border-rose-600/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4";
      }
      if (guardIconBox) {
        guardIconBox.className = "w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-lg";
        guardIconBox.innerHTML = '<i data-lucide="moon" class="w-6 h-6"></i>';
      }
      if (guardBadge) {
        guardBadge.className = "px-3 py-1 rounded-lg bg-rose-600 text-white font-black text-xs uppercase tracking-wider font-mono shadow-md flex items-center gap-1.5 animate-pulse";
        guardBadge.innerHTML = '<i data-lucide="alert-octagon" class="w-3.5 h-3.5"></i><span>NO OPERAR · FUERA DE SESIÓN NY</span>';
      }
      if (guardCountdown) {
        guardCountdown.textContent = session.countdownText;
      }
      if (guardHeadline) {
        guardHeadline.innerHTML = `El mercado Spot de Oro se encuentra fuera de la <strong>Ventana Dorada de New York</strong> (08:00 AM – 11:30 AM NY). Fuera de este horario el volumen interbancario cae drásticamente y los spreads se ensanchan. <strong>Disciplina: No regales tu dinero operando fuera de sesión.</strong>`;
      }
    }

    // Actualizar Guardia de Sesión en Tab 2 (Radar de Precisión)
    const precBanner = document.getElementById("precisionSessionGuardBanner");
    const precBadge = document.getElementById("precisionSessionGuardBadge");
    const precCountdown = document.getElementById("precisionSessionGuardCountdown");
    const precHeadline = document.getElementById("precisionSessionGuardHeadline");
    const precIconBox = document.getElementById("precisionSessionGuardIconBox");

    if (precBanner || precBadge || precCountdown || precHeadline) {
      if (session.isInSession) {
        if (precBanner) {
          precBanner.className = "p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 shadow-xl bg-emerald-950/40 border-emerald-500/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4";
        }
        if (precIconBox) {
          precIconBox.className = "w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg";
          precIconBox.innerHTML = '<i data-lucide="activity" class="w-6 h-6"></i>';
        }
        if (precBadge) {
          precBadge.className = "px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs uppercase tracking-wider font-mono shadow-md flex items-center gap-1.5 animate-pulse";
          precBadge.innerHTML = '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>SESIÓN NY ACTIVA · VENTANA DORADA</span>';
        }
        if (precCountdown) {
          precCountdown.textContent = session.countdownText;
          precCountdown.className = "text-xs font-mono font-bold text-emerald-300";
        }
        if (precHeadline) {
          precHeadline.innerHTML = `Ventana Dorada abierta (08:00 – 11:30 NY). Spreads mínimos y volumen bancario óptimo en XAU/USD. <strong>Operativa autorizada con confluencia del Gatillo M5 y R:R 1:2 mínimo.</strong>`;
        }
      } else {
        if (precBanner) {
          precBanner.className = "p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 shadow-xl bg-rose-950/40 border-rose-600/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4";
        }
        if (precIconBox) {
          precIconBox.className = "w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-lg";
          precIconBox.innerHTML = '<i data-lucide="moon" class="w-6 h-6"></i>';
        }
        if (precBadge) {
          precBadge.className = "px-3 py-1 rounded-lg bg-rose-600 text-white font-black text-xs uppercase tracking-wider font-mono shadow-md flex items-center gap-1.5 animate-pulse";
          precBadge.innerHTML = '<i data-lucide="alert-octagon" class="w-3.5 h-3.5"></i><span>NO OPERAR · MERCADO FUERA DE HORARIO NY</span>';
        }
        if (precCountdown) {
          precCountdown.textContent = session.countdownText;
          precCountdown.className = "text-xs font-mono font-bold text-rose-300";
        }
        if (precHeadline) {
          precHeadline.innerHTML = `Mercado fuera de la ventana operativa autorizada. Spreads ensanchados y bajo volumen interbancario. <strong>El 80% del volumen y los movimientos de R:R 1:2 y 1:3 ocurren exclusivamente en New York (08:00 – 11:30 UTC-5).</strong>`;
        }
      }
    }

    // Actualizar Estado en vivo de la Ficha Técnica MT5 si estamos fuera de sesión
    const tBadgeLive = document.getElementById("ticketStateBadge");
    const tTextLive = document.getElementById("ticketStateText");
    if (tBadgeLive && tTextLive) {
      if (!session.isInSession) {
        tBadgeLive.className = "px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 bg-rose-950 text-rose-300 border border-rose-600/80 shadow-md animate-pulse";
        tTextLive.textContent = `🚫 FUERA DE HORARIO NY · ${session.countdownText}`;
      } else if (currentPrecisionRadarData && currentPrecisionRadarData.precision_radar && currentPrecisionRadarData.precision_radar.execution_ticket) {
        const liveTicket = currentPrecisionRadarData.precision_radar.execution_ticket;
        tTextLive.textContent = liveTicket.state_label;
        if (liveTicket.state_color === 'emerald') {
          tBadgeLive.className = "px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-md animate-pulse";
        } else if (liveTicket.state_color === 'amber') {
          tBadgeLive.className = "px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 bg-amber-950 text-amber-300 border border-amber-600 shadow-md animate-pulse";
        } else {
          tBadgeLive.className = "px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 bg-blue-950 text-blue-300 border border-blue-600/80 shadow-md";
        }
      }
    }

    // Evaluar Semáforo Dinámico de Noticias en tiempo real cada segundo
    const newsStatus = evaluateDynamicNewsShield();

    // Actualizar Radar de Confluencia Item 2 (Sesión NY)
    const confDot2 = document.getElementById("confluenceDot2");
    const confCheck2 = document.getElementById("confluenceCheck2");
    const confScore = document.getElementById("confluenceScoreBadge");
    const confBanner = document.getElementById("confluenceVerdictBanner");

    if (session.isInSession) {
      if (confDot2) confDot2.className = "w-2 h-2 rounded-full bg-emerald-400";
      if (confCheck2) {
        confCheck2.className = "font-mono text-emerald-400 font-bold text-[10px]";
        confCheck2.textContent = "✓ SESIÓN ACTIVA (NY)";
      }

      // Si hay bloqueo activo por noticias de alto impacto (±15 min), el semáforo sobreescribe el radar
      if (newsStatus && newsStatus.isBlocked) {
        if (confScore) {
          confScore.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center gap-1 animate-pulse";
          confScore.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span>⛔ BLOQUEADO POR NOTICIA</span>';
        }
        if (confBanner) {
          confBanner.className = "p-2 rounded-lg bg-rose-950/60 border border-rose-500/60 text-[10px] text-rose-200 font-medium leading-tight";
          confBanner.innerHTML = newsStatus.bannerText;
        }
      }
    } else {
      if (confDot2) confDot2.className = "w-2 h-2 rounded-full bg-rose-500 animate-pulse";
      if (confCheck2) {
        confCheck2.className = "font-mono text-rose-400 font-bold text-[10px]";
        confCheck2.textContent = "✗ FUERA DE SESIÓN";
      }
      if (!lastProcessedSignalId) {
        if (confScore) {
          confScore.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center gap-1";
          confScore.textContent = "🚫 NO OPERAR (FUERA DE SESIÓN)";
        }
        if (confBanner) {
          confBanner.className = "p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-300 font-medium leading-tight";
          confBanner.innerHTML = `🚫 <strong>NO OPERAR · MERCADO FUERA DE SESIÓN NY:</strong> Faltan ${session.countdownFormatted} para la apertura. Hora óptima: ${session.optimalInfo ? session.optimalInfo.nyWindow : "08:15 – 11:30 NY"}. Disciplina: jamás operes sin liquidez bancaria.`;
        }
      }
    }

    // Actualizar Badge en el Header
    const badgeEl = document.getElementById("marketLiveBadge");
    if (badgeEl) {
      if (session.isInSession) {
        badgeEl.className = "h-8 px-2.5 rounded-xl font-mono text-xs font-bold border flex items-center gap-1.5 shadow-sm bg-emerald-950/80 border-emerald-500/50 text-emerald-300";
        badgeEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>🟢 SESIÓN NY ACTIVA</span>';
      } else {
        badgeEl.className = "h-8 px-2.5 rounded-xl font-mono text-xs font-bold border flex items-center gap-1.5 shadow-sm bg-rose-950/80 border-rose-500/50 text-rose-300";
        badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span><span>🔴 FUERA DE SESIÓN (${session.countdownFormatted})</span>`;
      }
    }

  }

  tick();
  if (marketClockInterval) clearInterval(marketClockInterval);
  marketClockInterval = setInterval(tick, 1000);
}

let isAutoRefreshingM5 = false;

async function executeM5AutoRefresh(isUserClick = false) {
  if (isAutoRefreshingM5) return;
  isAutoRefreshingM5 = true;

  const btnRefresh = document.getElementById("btnRefreshBias");

  if (btnRefresh) {
    btnRefresh.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Sincronizando...</span>';
    initIcons();
  }

  try {
    await Promise.all([
      loadTrades('real')
    ]);

    if (btnRefresh) {
      btnRefresh.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span>¡Actualizado!</span>';
      initIcons();
      setTimeout(() => {
        btnRefresh.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Refrescar</span>';
        initIcons();
      }, 1500);
    }

    if (isUserClick) {
      showToast("🔄 <strong>Bitácora Actualizada:</strong> Datos de la cuenta sincronizados.", "success", 3000);
    }
  } catch (err) {
    console.warn("Refresh error:", err);
  } finally {
    isAutoRefreshingM5 = false;
  }
}

function setupGoldBiasDashboard() {
  startMarketClock();

  // Botón Refrescar Manual
  const btnRefresh = document.getElementById("btnRefreshBias");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => executeM5AutoRefresh(true));
  }
}

// -------------------------------------------------------------
// Motor Python Nativo: Adaptive Supertrend M5 (Creative Quant)
// -------------------------------------------------------------
let lastProcessedPythonEngineSignalId = null;

async function loadPythonEngineSignal(isUserClick = false) {
  try {
    const btnScan = document.getElementById("btnRunPythonScan");
    if (btnScan && isUserClick) {
      btnScan.innerHTML = '<i data-lucide="loader" class="w-3 h-3 animate-spin text-yellow-400"></i><span>Escaneando...</span>';
      initIcons();
    }

    let brokerOffset = 120;
    try {
      const saved = localStorage.getItem("m5_broker_offset");
      if (saved !== null) brokerOffset = parseInt(saved, 10);
    } catch (e) {}

    const res = await fetch(`/api/adaptive-supertrend?offset=${brokerOffset}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.analysis) return;

    renderPythonEngineCard(data.analysis, isUserClick);

    if (btnScan && isUserClick) {
      setTimeout(() => {
        btnScan.innerHTML = '<i data-lucide="refresh-cw" class="w-3 h-3 text-yellow-400"></i><span>Escanear M5 Ahora</span>';
        initIcons();
      }, 700);
    }
  } catch (err) {
    console.warn("Could not load Python engine analysis:", err);
  }
}

let lastConfirmedCandleStamp = null;

function renderPythonEngineCard(analysis, isUserClick = false) {
  if (!analysis) return;

  const titleEl = document.getElementById("pythonSignalTitle");
  const iconWrap = document.getElementById("pythonSignalIconWrap");
  const iconEl = document.getElementById("pythonSignalIcon");
  const timingEl = document.getElementById("pythonSignalTiming");
  const liveBadge = document.getElementById("pythonEngineLiveStatus");
  const priceEl = document.getElementById("pythonSigPrice");
  const slEl = document.getElementById("pythonSigSl");
  const slPtsEl = document.getElementById("pythonSigSlPts");
  const tp1El = document.getElementById("pythonSigTp1");
  const tp2El = document.getElementById("pythonSigTp2");
  const rsiEl = document.getElementById("pythonSigRsi");
  const macdEl = document.getElementById("pythonSigMacd");
  const regimeEl = document.getElementById("pythonSigRegime");
  const confPill = document.getElementById("pythonSigConfluencePill");
  const card = document.getElementById("pythonEngineSignalCard");

  const confDot4 = document.getElementById("confluenceDot4");
  const confCheck4 = document.getElementById("confluenceCheck4");
  const confScore = document.getElementById("confluenceScoreBadge");
  const confBanner = document.getElementById("confluenceVerdictBanner");

  const isBuy = analysis.indicator_signal === "BUY";
  const isSell = analysis.indicator_signal === "SELL";
  const candleState = analysis.candle_state || "EN_DESARROLLO"; // "EN_DESARROLLO" | "CONFIRMADA_AL_CIERRE" | "ALREADY_TRIGGERED"
  const isNewsBlocked = lastNewsShieldStatus && lastNewsShieldStatus.isBlocked;
  const hasConfluence = analysis.has_confluence === true && !isNewsBlocked;
  const session = getNySessionStatus(new Date());

  if (priceEl && analysis.current_price) priceEl.textContent = `$${Number(analysis.current_price).toFixed(2)}`;
  if (slEl && analysis.sl_price) slEl.textContent = `$${Number(analysis.sl_price).toFixed(2)}`;
  if (slPtsEl && analysis.sl_points) slPtsEl.textContent = `${analysis.sl_points} pts`;
  if (tp1El && analysis.target_1_price) tp1El.textContent = `$${Number(analysis.target_1_price).toFixed(2)}`;
  if (tp2El && analysis.target_2_price) tp2El.textContent = `$${Number(analysis.target_2_price).toFixed(2)}`;
  if (rsiEl && analysis.rsi !== undefined) rsiEl.textContent = analysis.rsi;
  if (macdEl && analysis.macd_hist !== undefined) {
    macdEl.textContent = analysis.macd_hist <= 0 ? "Bajista" : "Alcista";
    macdEl.className = analysis.macd_hist <= 0 ? "text-rose-400" : "text-emerald-400";
  }
  if (regimeEl && analysis.multiplier_used) {
    const regLabel = analysis.regime === 'HIGH_VOLATILITY' ? 'Alta' : (analysis.regime === 'LOW_VOLATILITY' ? 'Baja' : 'Normal');
    regimeEl.textContent = `${regLabel} (${analysis.multiplier_used})`;
  }

  // 1. ESTADO: VELA EN DESARROLLO (Vela M5 abierta oscilando. PROHIBIDO confirmar o disparar)
  if (candleState === "EN_DESARROLLO") {
    if (titleEl) {
      titleEl.textContent = analysis.display_title || (isBuy ? "COMPRA EN DESARROLLO (Esperar)" : (isSell ? "VENTA EN DESARROLLO (Esperar)" : "VELA EN FORMACIÓN"));
      titleEl.className = "font-mono font-black text-xs text-amber-400";
    }
    if (iconWrap) iconWrap.className = "w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold";
    if (iconEl) iconEl.setAttribute("data-lucide", "clock");

    if (timingEl) {
      timingEl.textContent = analysis.display_timing || "Vela en formación";
      timingEl.className = "text-[9px] font-mono text-amber-400/90 font-bold";
    }
    if (liveBadge) {
      const rem = analysis.timing ? analysis.timing.remaining_formatted : "";
      liveBadge.className = "text-[9px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/80 font-bold";
      liveBadge.textContent = rem ? `VELA EN FORMACIÓN (${rem})` : "VELA EN FORMACIÓN";
    }

    if (card) {
      card.className = "p-2.5 rounded-xl bg-gray-900/90 border border-amber-500/50 space-y-2 shadow-inner";
    }
    if (confPill) {
      confPill.innerHTML = '<i data-lucide="clock" class="w-3 h-3 text-amber-400 animate-spin"></i><span>EN DESARROLLO (ESPERAR)</span>';
      confPill.className = "text-amber-400 font-bold flex items-center gap-1";
    }

    // Actualizar Radar de Confluencia
    if (confCheck4) {
      const sigName = isBuy ? "COMPRA" : (isSell ? "VENTA" : "VELA");
      confCheck4.textContent = `⏳ ${sigName} EN DESARROLLO (Esperar cierre)`;
      confCheck4.className = "font-mono text-amber-400 font-bold text-[10px]";
    }
    if (confDot4) confDot4.className = "w-2 h-2 rounded-full bg-amber-400 animate-pulse";

    if (session.isInSession) {
      if (confScore) {
        confScore.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/80 font-bold flex items-center gap-1";
        confScore.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span><span>⏳ ESPERANDO CIERRE VELA M5</span>';
      }
      if (confBanner) {
        confBanner.className = "p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-300 font-medium leading-tight";
        confBanner.innerHTML = analysis.status_banner || `⏳ <strong>VELA EN DESARROLLO:</strong> Vela M5 abierta y oscilando en Tickmill. NO confirmar ni disparar trade hasta el cierre de vela.`;
      }
    }
  }

  // 2. ESTADO: SEÑAL ANTERIOR YA EJECUTADA (Trade en curso. Prohibido perseguir el precio)
  else if (candleState === "ALREADY_TRIGGERED") {
    if (titleEl) {
      titleEl.textContent = analysis.display_title || "SEÑAL ANTERIOR YA EJECUTADA · ESPERAR PRÓXIMO SETUP";
      titleEl.className = "font-mono font-bold text-xs text-blue-300";
    }
    if (iconWrap) iconWrap.className = "w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold";
    if (iconEl) iconEl.setAttribute("data-lucide", "history");

    if (timingEl) {
      timingEl.textContent = analysis.display_timing || "Trade en curso · Prohibido perseguir el precio";
      timingEl.className = "text-[9px] font-mono text-blue-300/80";
    }
    if (liveBadge) {
      liveBadge.className = "text-[9px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-600/80 font-bold";
      liveBadge.textContent = "TRADE EN CURSO";
    }

    if (card) {
      card.className = "p-2.5 rounded-xl bg-gray-900/80 border border-blue-500/40 space-y-2";
    }
    if (confPill) {
      confPill.innerHTML = '<i data-lucide="shield" class="w-3 h-3 text-blue-400"></i><span>ESPERAR PRÓXIMO SETUP</span>';
      confPill.className = "text-blue-400 font-bold flex items-center gap-1";
    }

    // Actualizar Radar de Confluencia
    if (confCheck4) {
      confCheck4.textContent = "🛡️ SEÑAL ANTERIOR YA EJECUTADA (Esperar)";
      confCheck4.className = "font-mono text-blue-400 font-bold text-[10px]";
    }
    if (confDot4) confDot4.className = "w-2 h-2 rounded-full bg-blue-400";

    if (session.isInSession) {
      if (confScore) {
        confScore.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-600/80 font-bold flex items-center gap-1";
        confScore.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span><span>🛡️ ESPERAR SIGUIENTE SETUP</span>';
      }
      if (confBanner) {
        confBanner.className = "p-2 rounded-lg bg-blue-950/40 border border-blue-500/40 text-[10px] text-blue-200 font-medium leading-tight";
        confBanner.innerHTML = analysis.status_banner || `🛡️ <strong>DISCIPLINA INSTITUCIONAL:</strong> La señal anterior ya se activó y el trade está en desarrollo. No perseguir el mercado; esperar pacientemente al siguiente setup.`;
      }
    }
  }

  // 3. ESTADO: CONFIRMADA AL CIERRE (Vela M5 recién cerrada en Tickmill. Ventana de entrada activa)
  else {
    if (hasConfluence) {
      if (titleEl) {
        titleEl.textContent = analysis.display_title || (isBuy ? "COMPRA CONFIRMADA (BUY M5)" : "VENTA CONFIRMADA (SELL M5)");
        titleEl.className = isBuy ? "font-mono font-black text-xs text-emerald-400" : "font-mono font-black text-xs text-rose-400";
      }
      if (iconWrap) {
        iconWrap.className = isBuy ? "w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold" : "w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold";
      }
      if (iconEl) iconEl.setAttribute("data-lucide", isBuy ? "arrow-up-circle" : "arrow-down-circle");

      if (timingEl) {
        timingEl.textContent = analysis.display_timing || "✓ Cierre Confirmado · Ventana de Entrada Activa";
        timingEl.className = "text-[9px] font-mono text-emerald-400 font-bold";
      }
      if (liveBadge) {
        liveBadge.className = "text-[9px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/80 font-bold animate-pulse";
        liveBadge.textContent = "CIERRE CONFIRMADO";
      }

      if (card) {
        card.className = "p-2.5 rounded-xl bg-gray-900/90 border border-emerald-500/60 shadow-lg shadow-emerald-950/20 space-y-2";
      }
      if (confPill) {
        confPill.innerHTML = '<i data-lucide="check-check" class="w-3 h-3 text-emerald-400"></i><span>4/4 CONFLUENCIA A+</span>';
        confPill.className = "text-emerald-400 font-bold flex items-center gap-1";
      }

      // Actualizar Radar de Confluencia
      if (confCheck4) {
        confCheck4.textContent = `✓ GATILLO: ${analysis.indicator_signal} M5 @ $${analysis.current_price}`;
        confCheck4.className = isBuy ? "font-mono text-emerald-400 font-bold text-[10px]" : "font-mono text-rose-400 font-bold text-[10px]";
      }
      if (confDot4) confDot4.className = isBuy ? "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" : "w-2 h-2 rounded-full bg-rose-400 animate-pulse";

      if (session.isInSession) {
        if (confScore) {
          confScore.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500 font-bold flex items-center gap-1 animate-pulse";
          confScore.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>4/4 SETUP A+ CONFIRMADO</span>';
        }
        if (confBanner) {
          confBanner.className = "p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-[10px] text-emerald-300 font-bold leading-tight";
          confBanner.innerHTML = analysis.status_banner || `🔥 <strong>¡GATILLO CONFIRMADO AL CIERRE DE VELA!</strong> Señal de ${analysis.indicator_signal} M5 @ $${analysis.current_price} validada con confluencia 4/4 A+. Dispara en tu broker y anota el trade.`;
        }

        // Emitir alerta sonora solo 1 vez por confirmación de vela cerrada
        const stamp = `${analysis.indicator_signal}_${analysis.current_price}`;
        if (lastConfirmedCandleStamp !== stamp) {
          lastConfirmedCandleStamp = stamp;
          playTradeAlertSound(true);
        }
      }
    } else {
      // Señal al cierre pero filtrada contra el sesgo O BLOQUEADA POR NOTICIA
      if (titleEl) {
        if (isNewsBlocked) {
          titleEl.textContent = `BLOQUEADO POR NOTICIA (${analysis.indicator_signal})`;
          titleEl.className = "font-mono font-bold text-xs text-rose-400";
        } else {
          titleEl.textContent = analysis.display_title || `${analysis.indicator_signal} AL CIERRE (FILTRADO)`;
          titleEl.className = "font-mono font-bold text-xs text-yellow-400";
        }
      }
      if (iconWrap) {
        iconWrap.className = isNewsBlocked ? "w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold" : "w-5 h-5 rounded-md bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold";
      }
      if (iconEl) iconEl.setAttribute("data-lucide", "shield-alert");

      if (timingEl) {
        timingEl.textContent = isNewsBlocked ? (lastNewsShieldStatus ? lastNewsShieldStatus.statusText : "Ventana ±15 min") : (analysis.display_timing || "Descartado por ir contra el sesgo diario");
        timingEl.className = isNewsBlocked ? "text-[9px] font-mono text-rose-400/90 font-bold" : "text-[9px] font-mono text-yellow-400/80";
      }
      if (liveBadge) {
        liveBadge.className = isNewsBlocked ? "text-[9px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600/80 font-bold" : "text-[9px] px-2 py-0.5 rounded-full bg-yellow-950 text-yellow-300 border border-yellow-600/80 font-bold";
        liveBadge.textContent = isNewsBlocked ? "BLOQUEO NOTICIA" : "SEÑAL FILTRADA";
      }

      if (card) {
        card.className = isNewsBlocked ? "p-2.5 rounded-xl bg-gray-900/90 border border-rose-500/50 space-y-2 shadow-inner" : "p-2.5 rounded-xl bg-gray-900/80 border border-yellow-500/30 space-y-2";
      }
      if (confPill) {
        if (isNewsBlocked) {
          confPill.innerHTML = '<i data-lucide="shield-alert" class="w-3 h-3 text-rose-400"></i><span>BLOQUEADO POR NOTICIA</span>';
          confPill.className = "text-rose-400 font-bold flex items-center gap-1";
        } else {
          confPill.innerHTML = '<i data-lucide="shield-alert" class="w-3 h-3 text-yellow-500"></i><span>FILTRADO CONTRA SESGO</span>';
          confPill.className = "text-yellow-500 font-bold flex items-center gap-1";
        }
      }

      if (confCheck4) {
        confCheck4.textContent = isNewsBlocked ? `⚠️ ${analysis.indicator_signal} (BLOQUEO POR NOTICIA)` : `⚠️ ${analysis.indicator_signal} (FILTRADO CONTRA SESGO)`;
        confCheck4.className = isNewsBlocked ? "font-mono text-rose-400 font-bold text-[10px]" : "font-mono text-yellow-400 font-bold text-[10px]";
      }
      if (confDot4) confDot4.className = isNewsBlocked ? "w-2 h-2 rounded-full bg-rose-400" : "w-2 h-2 rounded-full bg-yellow-400";

      if (session.isInSession && confBanner) {
        if (isNewsBlocked && lastNewsShieldStatus && lastNewsShieldStatus.bannerText) {
          confBanner.className = "p-2 rounded-lg bg-rose-950/60 border border-rose-500/60 text-[10px] text-rose-200 font-medium leading-tight";
          confBanner.innerHTML = lastNewsShieldStatus.bannerText;
        } else {
          confBanner.className = "p-2 rounded-lg bg-yellow-950/40 border border-yellow-500/40 text-[10px] text-yellow-300 font-medium leading-tight";
          confBanner.innerHTML = analysis.status_banner || `⚠️ <strong>SEÑAL FILTRADA:</strong> Señal técnica de ${analysis.indicator_signal} descartada por oponerse al sesgo macro.`;
        }
      }
    }
  }

  initIcons();

  if (isUserClick) {
    showToast(`⚡ <strong>Motor Python M5:</strong> ${analysis.display_title || analysis.indicator_signal} @ $${analysis.current_price}`, hasConfluence ? "success" : "info", 4000);
  }
}

// -------------------------------------------------------------
// TradingView Real-Time Signal Integration & Webhook Handler
// -------------------------------------------------------------
let lastProcessedSignalId = null;

// Sistema de Notificaciones Flotantes (Toasts)
function showToast(message, type = "info", duration = 5000) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-2xl border backdrop-blur-md transform transition-all duration-300 translate-y-[-10px] opacity-0 text-xs";

  let borderBg = "bg-gray-900/95 border-gray-700 text-gray-200";
  let iconName = "info";
  let iconColor = "text-blue-400";

  if (type === "success") {
    borderBg = "bg-emerald-950/95 border-emerald-500/80 text-emerald-200 shadow-emerald-950/50";
    iconName = "check-circle";
    iconColor = "text-emerald-400";
  } else if (type === "error" || type === "danger") {
    borderBg = "bg-rose-950/95 border-rose-500/80 text-rose-200 shadow-rose-950/50";
    iconName = "alert-triangle";
    iconColor = "text-rose-400";
  } else if (type === "warning") {
    borderBg = "bg-amber-950/95 border-amber-500/80 text-amber-200 shadow-amber-950/50";
    iconName = "alert-circle";
    iconColor = "text-amber-400";
  }

  toast.className += ` ${borderBg}`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 shrink-0 ${iconColor} mt-0.5"></i>
    <div class="flex-1 font-medium leading-relaxed">${message}</div>
    <button type="button" class="text-gray-400 hover:text-white shrink-0 cursor-pointer ml-1 p-0.5">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  const btnClose = toast.querySelector("button");
  const removeToast = () => {
    toast.classList.add("opacity-0", "translate-y-[-10px]");
    setTimeout(() => toast.remove(), 300);
  };
  if (btnClose) btnClose.addEventListener("click", removeToast);

  container.appendChild(toast);
  initIcons();

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-[-10px]");
  });

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

function playTradeAlertSound(isAcknowledge = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    if (isAcknowledge) {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
    }
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("Audio chime prevented:", e);
  }
}

function applySignalToUI(signal, isManual = false) {
  if (!signal) return;

  const confDot2 = document.getElementById("confluenceDot2");
  const confCheck2 = document.getElementById("confluenceCheck2");
  const confDot4 = document.getElementById("confluenceDot4");
  const confCheck4 = document.getElementById("confluenceCheck4");
  const confBadge = document.getElementById("confluenceScoreBadge");
  const confBanner = document.getElementById("confluenceVerdictBanner");

  const session = getNySessionStatus(new Date());
  const isValidA = signal.status === "VALIDATED_A_PLUS";

  // Protección News Shield: Bloquear ejecución si estamos dentro de la ventana ±15 min de noticia
  if (lastNewsShieldStatus && lastNewsShieldStatus.isBlocked) {
    if (confBadge) {
      confBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center gap-1 animate-pulse";
      confBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span>🚫 BLOQUEADO POR NOTICIA</span>';
    }
    if (confBanner) {
      confBanner.className = "p-2 rounded-lg bg-rose-950/60 border border-rose-500/60 text-[10px] text-rose-200 font-medium leading-tight";
      confBanner.innerHTML = lastNewsShieldStatus.bannerText;
    }
    playTradeAlertSound(false);
    showToast(`🚫 <strong>GATILLO BLOQUEADO POR NOTICIA:</strong> Señal ${signal.action} M5 descartada por coincidir con ventana de alto impacto (±15 min). Capital protegido.`, "error", 8000);
    return;
  }

  if (isValidA) {
    if (session.isInSession) {
      if (confDot2) confDot2.className = "w-2 h-2 rounded-full bg-emerald-400";
      if (confCheck2) {
        confCheck2.className = "font-mono text-emerald-400 font-bold text-[10px]";
        confCheck2.textContent = "✓ SESIÓN ACTIVA (NY)";
      }
      if (confDot4) confDot4.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping";
      if (confCheck4) {
        confCheck4.className = "font-mono text-emerald-400 font-bold text-[10px]";
        confCheck4.textContent = `✓ GATILLO: ${signal.action} M5 @ $${Number(signal.price || 2720.5).toFixed(1)}`;
      }
      if (confBadge) {
        confBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500 font-bold flex items-center gap-1 animate-pulse";
        confBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>4/4 SETUP A+ CONFIRMADO</span>';
      }
      if (confBanner) {
        confBanner.className = "p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-[10px] text-emerald-300 font-bold leading-tight";
        confBanner.innerHTML = `🔥 <strong>¡GATILLO CONFIRMADO EN TRADINGVIEW!</strong> Señal de ${signal.action} M5 @ $${Number(signal.price || 2720.5).toFixed(2)}. Confluencia 4/4 activa en New York. Dispara en tu broker y anota el trade.`;
      }

      // Sonido campana de éxito
      playTradeAlertSound(true);

      // Pre-rellenar formulario de Bitácora Real automáticamente
      const dirBuy = document.getElementById("btnRealDirBuy");
      const dirSell = document.getElementById("btnRealDirSell");
      const pointsInput = document.getElementById("realTradeTvPoints");

      if (signal.action === "BUY") {
        if (dirBuy) dirBuy.click();
      } else if (signal.action === "SELL") {
        if (dirSell) dirSell.click();
      }
      if (pointsInput && signal.sl_points) {
        pointsInput.value = signal.sl_points;
      }

      showToast(`🚨 <strong>¡GATILLO A+ CONFIRMADO!</strong> Señal de <strong>${signal.action}</strong> M5 alineada con el sesgo diario en plena sesión NY. Confluencia 4/4 activa.`, "success", 6000);
    } else {
      // Gatillo técnico presente PERO fuera de sesión
      if (confDot2) confDot2.className = "w-2 h-2 rounded-full bg-rose-500 animate-pulse";
      if (confCheck2) {
        confCheck2.className = "font-mono text-rose-400 font-bold text-[10px]";
        confCheck2.textContent = "✗ FUERA DE SESIÓN";
      }
      if (confDot4) confDot4.className = "w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping";
      if (confCheck4) {
        confCheck4.className = "font-mono text-yellow-400 font-bold text-[10px]";
        confCheck4.textContent = `⚠️ GATILLO ${signal.action} (BLOQUEADO)`;
      }
      if (confBadge) {
        confBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center gap-1";
        confBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span>🚫 BLOQUEADO: FUERA DE SESIÓN</span>';
      }
      if (confBanner) {
        confBanner.className = "p-2 rounded-lg bg-rose-950/60 border border-rose-500/60 text-[10px] text-rose-200 font-medium leading-tight";
        confBanner.innerHTML = `🚫 <strong>NO OPERAR · GATILLO BLOQUEADO POR SESIÓN:</strong> Señal técnica de ${signal.action} M5 detectada, pero el mercado está en horas asiáticas/madrugada. Faltan ${session.countdownFormatted} para la sesión de New York. Disciplina: no abras operaciones sin volumen interbancario.`;
      }

      // Sonido advertencia
      playTradeAlertSound(false);

      showToast(`🚫 <strong>NO OPERAR · FUERA DE SESIÓN NY:</strong> Señal ${signal.action} en M5 detectada pero bloqueada. Faltan <strong>${session.countdownFormatted}</strong> para la apertura (08:00 NY). Hora óptima: <strong>${session.optimalInfo ? session.optimalInfo.nyWindow : "08:15 – 11:30 NY"}</strong>.`, "error", 8000);
    }
  } else {
    // Señal en contratendencia
    if (confDot4) confDot4.className = "w-2.5 h-2.5 rounded-full bg-rose-400";
    if (confCheck4) {
      confCheck4.className = "font-mono text-rose-400 font-bold text-[10px]";
      confCheck4.textContent = `✗ ${signal.action} DESCARTADO`;
    }
    if (confBadge) {
      confBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 font-bold flex items-center gap-1";
      confBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span>3/4 SEÑAL RECHAZADA</span>';
    }
    if (confBanner) {
      confBanner.className = "p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-300 font-medium leading-tight";
      confBanner.textContent = `⚠️ Señal de ${signal.action} en M5 descartada por contradecir el sesgo institucional (${signal.bias_at_time || "BEARISH"}). Disciplina: jamás operar contratendencia.`;
    }

    // Sonido advertencia
    playTradeAlertSound(false);

    showToast(`⚠️ <strong>SEÑAL DESCARTADA:</strong> Señal de <strong>${signal.action}</strong> rechazada por ir contra el sesgo macro diario (${signal.bias_at_time || "BEARISH"}). Capital protegido.`, "warning", 6000);
  }
}

async function triggerSimulatedTvSignal(forcedAction = null, triggerBtn = null) {
  const currentBias = (goldBiasState && goldBiasState.bias) ? goldBiasState.bias : "BEARISH";
  
  let action = forcedAction;
  if (!action) {
    action = (currentBias === "BEARISH") ? "SELL" : "BUY";
  }

  const isAligned = (currentBias === "BEARISH" && action === "SELL") || (currentBias === "BULLISH" && action === "BUY");
  const status = isAligned ? "VALIDATED_A_PLUS" : "FILTERED_DISCARDED";

  const payload = {
    id: Date.now(),
    ticker: "XAUUSD",
    action: action,
    price: 2720.50,
    timeframe: "5",
    sl_points: 2100,
    status: status,
    bias_at_time: currentBias,
    timestamp: new Date().toISOString()
  };

  lastProcessedSignalId = payload.id;

  // Feedback inmediato en la interfaz
  applySignalToUI(payload, true);

  // Animación / feedback en el botón que disparó la acción
  const targetBtn = triggerBtn || document.getElementById("btnSimulateTvSignal");
  if (targetBtn) {
    const origHtml = targetBtn.innerHTML;
    targetBtn.innerHTML = isAligned 
      ? '<i data-lucide="check" class="w-3 h-3 text-white"></i><span>¡Gatillo Disparado!</span>'
      : '<i data-lucide="shield-alert" class="w-3 h-3 text-white"></i><span>¡Filtro Activado!</span>';
    initIcons();
    setTimeout(() => {
      targetBtn.innerHTML = origHtml;
      initIcons();
    }, 2000);
  }

  try {
    await fetch("/api/webhook/tradingview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Webhook post logged locally:", err);
  }
}

async function pollLiveSignal() {
  try {
    const res = await fetch("/api/live-signal");
    if (!res.ok) return;
    const signal = await res.json();
    if (!signal || !signal.id) return;

    if (signal.epoch) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec - signal.epoch > 30 * 60) return; // Más de 30 min
    }

    if (lastProcessedSignalId !== signal.id) {
      lastProcessedSignalId = signal.id;
      applySignalToUI(signal, false);
    }
  } catch (err) {
    // Silently continue polling
  }
}

function setupTradingViewWebhookEvents() {
  const modalTv = document.getElementById("modalTvWebhookInfo");
  const btnOpen = document.getElementById("btnOpenTvWebhookModal");
  const btnClose = document.getElementById("btnCloseTvWebhookModal");
  const btnCloseBottom = document.getElementById("btnCloseTvWebhookModalBottom");
  const btnSimulate = document.getElementById("btnSimulateTvSignal");
  const btnCounter = document.getElementById("btnSimulateCounterSignal");
  const btnTestModal = document.getElementById("btnTestWebhookSignalFromModal");
  const btnCounterModal = document.getElementById("btnTestCounterSignalFromModal");
  const btnCopyUrl = document.getElementById("btnCopyWebhookUrl");
  const btnCopyPayload = document.getElementById("btnCopyWebhookPayload");

  if (btnOpen && modalTv) {
    btnOpen.addEventListener("click", () => {
      modalTv.classList.remove("hidden");
      initIcons();
    });
  }

  const closeTvModal = () => {
    if (modalTv) modalTv.classList.add("hidden");
  };

  if (btnClose) btnClose.addEventListener("click", closeTvModal);
  if (btnCloseBottom) btnCloseBottom.addEventListener("click", closeTvModal);

  if (modalTv) {
    modalTv.addEventListener("click", (e) => {
      if (e.target === modalTv) closeTvModal();
    });
  }

  if (btnCopyUrl) {
    btnCopyUrl.addEventListener("click", () => {
      const urlInput = document.getElementById("tvWebhookUrlInput");
      if (urlInput) {
        navigator.clipboard.writeText(urlInput.value);
        showToast("📋 URL de Webhook copiada al portapapeles", "info");
      }
    });
  }

  if (btnCopyPayload) {
    btnCopyPayload.addEventListener("click", () => {
      const payloadArea = document.getElementById("tvWebhookPayloadArea");
      if (payloadArea) {
        navigator.clipboard.writeText(payloadArea.value);
        showToast("📋 JSON de plantilla copiado", "info");
      }
    });
  }

  if (btnSimulate) {
    btnSimulate.addEventListener("click", () => {
      const currentBias = (goldBiasState && goldBiasState.bias) ? goldBiasState.bias : "BEARISH";
      const action = (currentBias === "BEARISH") ? "SELL" : "BUY";
      triggerSimulatedTvSignal(action, btnSimulate);
    });
  }

  if (btnCounter) {
    btnCounter.addEventListener("click", () => {
      const currentBias = (goldBiasState && goldBiasState.bias) ? goldBiasState.bias : "BEARISH";
      const counterAction = (currentBias === "BEARISH") ? "BUY" : "SELL";
      triggerSimulatedTvSignal(counterAction, btnCounter);
    });
  }

  if (btnTestModal) {
    btnTestModal.addEventListener("click", () => {
      const currentBias = (goldBiasState && goldBiasState.bias) ? goldBiasState.bias : "BEARISH";
      const action = (currentBias === "BEARISH") ? "SELL" : "BUY";
      triggerSimulatedTvSignal(action, btnTestModal);
      closeTvModal();
    });
  }

  if (btnCounterModal) {
    btnCounterModal.addEventListener("click", () => {
      const currentBias = (goldBiasState && goldBiasState.bias) ? goldBiasState.bias : "BEARISH";
      const counterAction = (currentBias === "BEARISH") ? "BUY" : "SELL";
      triggerSimulatedTvSignal(counterAction, btnCounterModal);
      closeTvModal();
    });
  }

  // Polling cada 3 segundos
  setInterval(pollLiveSignal, 3000);
  pollLiveSignal();
}

// -------------------------------------------------------------
// Modal: Manual Operativo & Guía Macro XAU/USD (PDF)
// -------------------------------------------------------------
function setupMacroGuideModalEvents() {
  const modalGuide = document.getElementById("modalMacroGuide");
  if (!modalGuide) return;

  const btnOpenHeader = document.getElementById("btnOpenMacroGuideModal");
  const btnOpenSection = document.getElementById("btnOpenMacroGuideFromSection");
  const btnOpenBanner = document.getElementById("btnLaunchFullGuideText");

  const btnClose = document.getElementById("btnCloseMacroGuideModal");
  const btnCloseBottom = document.getElementById("btnCloseMacroGuideBottom");
  const btnPrintHeader = document.getElementById("btnDownloadGuidePdf");
  const btnPrintBottom = document.getElementById("btnPrintGuideBottom");

  const openGuide = () => {
    modalGuide.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    initIcons();
  };

  const closeGuide = () => {
    modalGuide.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
  };

  const printGuide = () => {
    window.print();
  };

  if (btnOpenHeader) btnOpenHeader.addEventListener("click", openGuide);
  if (btnOpenSection) btnOpenSection.addEventListener("click", () => {
    if (window.switchTabTo) window.switchTabTo('manual_guide');
    else openGuide();
  });
  if (btnOpenBanner) btnOpenBanner.addEventListener("click", () => {
    if (window.switchTabTo) window.switchTabTo('manual_guide');
    else openGuide();
  });

  if (btnClose) btnClose.addEventListener("click", closeGuide);
  if (btnCloseBottom) btnCloseBottom.addEventListener("click", closeGuide);
  if (btnPrintHeader) btnPrintHeader.addEventListener("click", printGuide);
  if (btnPrintBottom) btnPrintBottom.addEventListener("click", printGuide);

  modalGuide.addEventListener("click", (e) => {
    if (e.target === modalGuide) {
      closeGuide();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalGuide.classList.contains("hidden")) {
      closeGuide();
    }
  });
}

// -------------------------------------------------------------
// Calendario Económico Semanal de Noticias (XAU/USD)
// -------------------------------------------------------------
let weeklyNewsState = null;
let activeNewsDay = "all";
let filterHighImpactOnly = false;
let weeklyNewsEventsInitialized = false;

async function loadWeeklyNews() {
  const container = document.getElementById("weeklyNewsContainer");
  if (!container) return;

  try {
    let res = await fetch("/api/news");
    if (!res.ok) {
      res = await fetch("/weekly_news.json");
    }
    if (res.ok) {
      weeklyNewsState = await res.json();
    }
  } catch (e) {
    try {
      const res = await fetch("/weekly_news.json");
      if (res.ok) weeklyNewsState = await res.json();
    } catch (e2) {
      console.warn("Could not fetch weekly news:", e2);
    }
  }

  // Fallback si no hay conexión al backend
  if (!weeklyNewsState || !weeklyNewsState.days) {
    weeklyNewsState = {
      week_label: "Semana Operativa · 02 al 06 de Noviembre (Semana NFP & Empleo)",
      days: [
        {
          date: "2026-11-02",
          day_name: "Lunes",
          day_short: "LUN",
          impact_level: "HIGH",
          badge_text: "🔴 ISM MANUFACTURERO",
          events: [
            {
              time: "10:00 AM NY",
              currency: "USD",
              title: "ISM PMI Manufacturero de EE.UU.",
              impact: "HIGH",
              forecast: "49.5",
              previous: "47.2",
              actual: "48.6",
              impact_gold: "Cae en plena Killzone de NY. Si sale por debajo de 50 (contracción prolongada), debilita el dólar y da soporte alcista al Oro.",
              rule_action: "⚠️ Pausa Táctica: Cero entradas de 09:58 a 10:05 NY. Esperar vela M5 cerrada."
            },
            {
              time: "10:00 AM NY",
              currency: "USD",
              title: "Precios Pagados en Manufactura ISM",
              impact: "MEDIUM",
              forecast: "52.0",
              previous: "48.3",
              actual: "51.2",
              impact_gold: "Componente inflacionario temprano. Un repunte eleva los rendimientos de los bonos a 10 años.",
              rule_action: "Seguimiento simultáneo con el PMI principal."
            }
          ]
        },
        {
          date: "2026-11-03",
          day_name: "Martes",
          day_short: "MAR",
          impact_level: "HIGH",
          badge_text: "🔴 VACANTES JOLTS",
          events: [
            {
              time: "10:00 AM NY",
              currency: "USD",
              title: "Encuesta de Ofertas de Empleo JOLTS",
              impact: "HIGH",
              forecast: "7.98M",
              previous: "8.04M",
              actual: "--",
              impact_gold: "Termómetro vital de la Fed para el empleo. Menos vacantes confirma enfriamiento laboral, impulsando compras en Oro.",
              rule_action: "⚠️ Pausa Táctica 09:58 a 10:06 NY. Posible latigazo de 40 a 70 pts TV."
            },
            {
              time: "01:30 PM NY",
              currency: "USD",
              title: "Discurso de Miembros de la Reserva Federal (Fed Speeches)",
              impact: "MEDIUM",
              forecast: "--",
              previous: "--",
              actual: "--",
              impact_gold: "Riesgo de volatilidad en sesión de la tarde. No se recomienda abrir nuevos trades tras el London Fix (11:30 NY).",
              rule_action: "Sesión ya finalizada según el plan institucional."
            }
          ]
        },
        {
          date: "2026-11-04",
          day_name: "Miércoles",
          day_short: "MIÉ",
          impact_level: "HIGH",
          badge_text: "🔥 ADP + ISM SERVICIOS",
          events: [
            {
              time: "08:15 AM NY",
              currency: "USD",
              title: "Informe de Empleo No Agrícola ADP",
              impact: "HIGH",
              forecast: "145K",
              previous: "143K",
              actual: "--",
              impact_gold: "Preludio directo de NFP. Genera quiebres anticipados en el rango previo de New York 15 min antes de la apertura de Wall Street.",
              rule_action: "⛔ Bloqueo Estricto: 08:10 a 08:25 NY. Esperar que el spread regrese a lo normal."
            },
            {
              time: "10:00 AM NY",
              currency: "USD",
              title: "ISM PMI del Sector Servicios (No Manufacturero)",
              impact: "HIGH",
              forecast: "53.8",
              previous: "54.9",
              actual: "--",
              impact_gold: "El sector servicios representa más del 70% de la economía de EE.UU. Noticia catalizadora de gran recorrido direccional.",
              rule_action: "⚠️ Alerta Killzone: No tener órdenes pendientes abiertas a las 09:59 NY."
            }
          ]
        },
        {
          date: "2026-11-05",
          day_name: "Jueves",
          day_short: "JUE",
          impact_level: "HIGH",
          badge_text: "🔴 PETICIONES SUBSIDIO",
          events: [
            {
              time: "08:30 AM NY",
              currency: "USD",
              title: "Nuevas Peticiones de Subsidio por Desempleo (Initial Jobless Claims)",
              impact: "HIGH",
              forecast: "221K",
              previous: "218K",
              actual: "--",
              impact_gold: "Peticiones semanales. Cifras superiores al pronóstico (>225K) debilitan al dólar y habilitan compras en soporte clave del Oro.",
              rule_action: "⛔ Bloqueo: 08:25 a 08:40 NY. Buscar confirmación de entrada M5 a las 08:45 NY."
            },
            {
              time: "08:30 AM NY",
              currency: "USD",
              title: "Balanza Comercial de EE.UU.",
              impact: "MEDIUM",
              forecast: "-70.2B",
              previous: "-70.4B",
              actual: "--",
              impact_gold: "Publicación simultánea con peticiones de desempleo.",
              rule_action: "Seguimiento unificado con Jobless Claims."
            }
          ]
        },
        {
          date: "2026-11-06",
          day_name: "Viernes",
          day_short: "VIE",
          impact_level: "CRITICAL",
          badge_text: "💥 NFP VIERNES (MÁXIMA VOLATILIDAD)",
          events: [
            {
              time: "08:30 AM NY",
              currency: "USD",
              title: "NFP (Nóminas No Agrícolas de EE.UU.)",
              impact: "CRITICAL",
              forecast: "180K",
              previous: "254K",
              actual: "--",
              impact_gold: "El evento de mayor volatilidad mensual. Mueve entre 1,500 y 3,000 puntos TV ($15.00 a $30.00) en velas de 1 a 5 minutos. Spreads bancarios se disparan.",
              rule_action: "⛔ PROHIBIDO DISPARAR ANTES DE LAS 08:45 NY. Cero apuestas previas. Esperar vela M5 cerrada."
            },
            {
              time: "08:30 AM NY",
              currency: "USD",
              title: "Tasa de Desempleo de EE.UU.",
              impact: "HIGH",
              forecast: "4.1%",
              previous: "4.1%",
              actual: "--",
              impact_gold: "Si el desempleo sube a 4.2% o superior, desata rally comprador agresivo en metales preciosos.",
              rule_action: "Alineado con el bloqueo estricto de NFP."
            },
            {
              time: "08:30 AM NY",
              currency: "USD",
              title: "Ingresos Medios por Hora (Salarios m/m)",
              impact: "HIGH",
              forecast: "+0.3%",
              previous: "+0.4%",
              actual: "--",
              impact_gold: "Presión salarial subyacente. Clave para la reunión de política monetaria de la Reserva Federal.",
              rule_action: "Esperar absorción completa antes de operar el Adaptive Supertrend."
            }
          ]
        }
      ]
    };
  }

  renderWeeklyNews();
  if (!weeklyNewsEventsInitialized) {
    setupWeeklyNewsEventListeners();
    weeklyNewsEventsInitialized = true;
  }
}

function renderWeeklyNews() {
  const container = document.getElementById("weeklyNewsContainer");
  if (!container || !weeklyNewsState || !Array.isArray(weeklyNewsState.days)) return;

  const badge = document.getElementById("newsWeekBadge");
  if (badge && weeklyNewsState.week_label) {
    badge.textContent = `🔥 ${weeklyNewsState.week_label}`;
  }

  // Filtrar días
  const filteredDays = weeklyNewsState.days.filter(d => {
    if (activeNewsDay !== "all" && d.date !== activeNewsDay) return false;
    return true;
  });

  if (filteredDays.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-gray-400 text-xs bg-gray-900/40 rounded-xl border border-gray-800">No hay noticias programadas para el día seleccionado.</div>`;
    return;
  }

  let html = "";

  filteredDays.forEach(day => {
    let events = day.events || [];
    if (filterHighImpactOnly) {
      events = events.filter(e => e.impact === "HIGH" || e.impact === "CRITICAL");
    }

    if (events.length === 0 && filterHighImpactOnly) {
      return;
    }

    const dayHeaderClass = day.impact_level === "CRITICAL" 
      ? "border-red-500/50 bg-red-950/40 text-red-300"
      : (day.impact_level === "HIGH" ? "border-amber-500/40 bg-amber-950/30 text-amber-300" : "border-gray-800 bg-gray-900/60 text-gray-300");

    html += `
      <div class="rounded-2xl border border-gray-800/90 bg-gray-950/70 p-4 sm:p-5 space-y-3.5 shadow-xl">
        <!-- Day Banner -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-gray-900 border border-gray-700 flex items-center justify-center font-black text-xs text-white font-mono shadow-inner">
              ${day.day_short || day.day_name.substring(0,3).toUpperCase()}
            </span>
            <div>
              <div class="text-sm font-black text-white flex items-center gap-2">
                <span>${day.day_name}, ${day.date}</span>
                <span class="text-[10px] text-gray-400 font-mono font-normal">· New York (UTC-4)</span>
              </div>
              <div class="text-[11px] text-gray-400">Ventana Operativa de Oro (08:30 – 11:30 NY)</div>
            </div>
          </div>
          <span class="text-[10px] font-mono font-bold px-3 py-1 rounded-lg border ${dayHeaderClass} flex items-center gap-1.5 shadow-sm">
            <span class="w-1.5 h-1.5 rounded-full ${day.impact_level === 'CRITICAL' ? 'bg-red-400 animate-pulse' : 'bg-amber-400'}"></span>
            <span>${day.badge_text || (day.impact_level === 'CRITICAL' ? '💥 MÁXIMA VOLATILIDAD' : '🔴 ALTO IMPACTO')}</span>
          </span>
        </div>

        <!-- Events List -->
        <div class="grid grid-cols-1 ${events.length > 1 ? 'lg:grid-cols-2' : ''} gap-3.5">
          ${events.map(ev => {
            const isCritical = ev.impact === "CRITICAL";
            const isHigh = ev.impact === "HIGH";
            const impactBadge = isCritical 
              ? `<span class="px-2.5 py-0.5 rounded bg-red-900/80 text-red-200 border border-red-500 font-mono text-[10px] font-black animate-pulse flex items-center gap-1"><span>💥</span><span>CRÍTICA (NFP)</span></span>`
              : (isHigh 
                  ? `<span class="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-mono text-[10px] font-bold">🔴 ALTO IMPACTO</span>`
                  : `<span class="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono text-[10px] font-bold">🟡 MEDIO IMPACTO</span>`);

            return `
              <div class="p-4 rounded-xl bg-gray-900/80 border ${isCritical ? 'border-red-500/40 shadow-lg shadow-red-950/20' : 'border-gray-800/90 hover:border-gray-700'} space-y-3 transition">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-lg bg-gray-950 border border-gray-700 font-mono text-xs font-black text-yellow-300 flex items-center gap-1.5 shadow-inner">
                      <i data-lucide="clock" class="w-3.5 h-3.5 text-yellow-400"></i>
                      <span>${ev.time}</span>
                    </span>
                    <span class="px-2 py-1 rounded-lg bg-blue-950/80 border border-blue-800 font-mono text-[10px] text-blue-300 font-bold">
                      🇺🇸 ${ev.currency}
                    </span>
                  </div>
                  ${impactBadge}
                </div>

                <div>
                  <h4 class="text-xs sm:text-sm font-bold text-white leading-snug">${ev.title}</h4>
                  <p class="text-[11px] text-gray-300 mt-1.5 leading-relaxed">${ev.impact_gold || ''}</p>
                </div>

                <!-- Consensus Metrics: Forecast / Prev / Actual -->
                <div class="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-gray-950 border border-gray-800/80 text-center font-mono text-xs">
                  <div>
                    <span class="text-gray-500 block text-[9px] uppercase tracking-wider font-sans">Previo</span>
                    <span class="text-gray-300 font-bold">${ev.previous || '--'}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 block text-[9px] uppercase tracking-wider font-sans">Previsión</span>
                    <span class="text-yellow-400 font-black">${ev.forecast || '--'}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 block text-[9px] uppercase tracking-wider font-sans">Real</span>
                    <span class="${ev.actual && ev.actual !== '--' ? 'text-emerald-400 font-black' : 'text-gray-600 font-bold'}">${ev.actual || '--'}</span>
                  </div>
                </div>

                <!-- Protective Action / Protocol -->
                <div class="p-2.5 rounded-lg ${isCritical ? 'bg-red-950/40 border border-red-500/40 text-red-300' : 'bg-yellow-950/30 border border-yellow-500/30 text-yellow-300'} text-[11px] font-medium leading-relaxed flex items-start gap-2">
                  <i data-lucide="shield-alert" class="w-4 h-4 mt-0.5 shrink-0 ${isCritical ? 'text-red-400' : 'text-yellow-400'}"></i>
                  <span><strong class="text-white">Regla Operativa Oro:</strong> ${ev.rule_action || 'Esperar digestión de spreads en M5.'}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  initIcons();
}

function setupWeeklyNewsEventListeners() {
  const dayBtns = document.querySelectorAll(".news-day-btn");
  dayBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const day = btn.getAttribute("data-day");
      activeNewsDay = day;

      dayBtns.forEach(b => {
        b.classList.remove("active", "bg-blue-600", "text-white", "shadow-md", "shadow-blue-600/30", "font-black");
        b.classList.add("bg-gray-900", "text-gray-300", "font-bold");
      });

      btn.classList.remove("bg-gray-900", "text-gray-300", "font-bold");
      btn.classList.add("active", "bg-blue-600", "text-white", "shadow-md", "shadow-blue-600/30", "font-black");

      renderWeeklyNews();
    });
  });

  const btnFilter = document.getElementById("btnFilterHighImpactNews");
  const filterText = document.getElementById("btnFilterNewsText");
  if (btnFilter) {
    btnFilter.addEventListener("click", () => {
      filterHighImpactOnly = !filterHighImpactOnly;
      if (filterHighImpactOnly) {
        btnFilter.className = "px-3 py-1.5 rounded-xl border border-red-500 bg-red-600 text-white transition flex items-center gap-1.5 font-bold cursor-pointer shadow-md shadow-red-600/30";
        if (filterText) filterText.textContent = "Mostrando: Solo Alto Impacto";
      } else {
        btnFilter.className = "px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-900/60 transition flex items-center gap-1.5 font-bold cursor-pointer";
        if (filterText) filterText.textContent = "Solo Alto Impacto (Carpeta Roja)";
      }
      renderWeeklyNews();
    });
  }
}

// ----------------------------------------------------
// RADAR DE PRECISIÓN DE ENTRADAS & ALERTA DEL SETUP
// ----------------------------------------------------
let currentRadarMode = 'PRECISION';
let currentPrecisionRadarData = null;

async function loadPrecisionRadarData(mode = null) {
  if (mode) currentRadarMode = mode;
  const refreshBtn = document.getElementById('btnRefreshPrecisionRadar');
  if (refreshBtn) {
    refreshBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin text-emerald-400"></i>';
    initIcons();
  }

  try {
    const res = await fetch(`/api/precision-radar?mode=${currentRadarMode.toLowerCase()}`);
    if (!res.ok) return;
    const data = await res.json();
    currentPrecisionRadarData = data;
    renderPrecisionRadarUI(data);
  } catch (err) {
    console.warn("Error cargando radar de precisión:", err);
  } finally {
    if (refreshBtn) {
      setTimeout(() => {
        refreshBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i>';
        initIcons();
      }, 500);
    }
  }
}

function renderPrecisionRadarUI(data) {
  if (!data || !data.precision_radar) return;
  const radar = data.precision_radar;
  const entry = radar.upcoming_entry;
  if (!entry) return;

  // 1. Badge Direction & Action
  const actBadge = document.getElementById('radarActionBadge');
  if (actBadge) {
    const isSell = entry.direction === 'SELL';
    actBadge.className = isSell 
      ? "px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase font-mono bg-rose-950 text-rose-300 border border-rose-600 flex items-center gap-1.5 shadow-lg shadow-rose-950/40"
      : "px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase font-mono bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center gap-1.5 shadow-lg shadow-emerald-950/40";
    actBadge.innerHTML = `<i data-lucide="${isSell ? 'arrow-down-circle' : 'arrow-up-circle'}" class="w-4 h-4"></i><span>${entry.action_label}</span>`;
  }

  // 2. Proximity Badge
  const proxBadge = document.getElementById('radarProximityBadge');
  const proxText = document.getElementById('radarProximityText');
  if (proxBadge && proxText) {
    proxText.textContent = entry.proximity_state;
    if (entry.proximity_code === 'READY') {
      proxBadge.className = "px-3 py-1 rounded-xl text-xs font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-500 flex items-center gap-1.5 animate-pulse shadow-md shadow-emerald-950/50";
    } else if (entry.proximity_code === 'IMMINENT') {
      proxBadge.className = "px-3 py-1 rounded-xl text-xs font-bold font-mono bg-amber-950 text-amber-300 border border-amber-600 flex items-center gap-1.5 animate-pulse";
    } else {
      proxBadge.className = "px-3 py-1 rounded-xl text-xs font-bold font-mono bg-blue-950 text-blue-300 border border-blue-600/80 flex items-center gap-1.5";
    }
  }

  // 3. Tab Badge
  const tabBadge = document.getElementById('tabBadgePrecision');
  if (tabBadge) {
    if (entry.proximity_code === 'READY') {
      tabBadge.textContent = "GATILLO LISTO";
      tabBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500 font-bold animate-pulse";
    } else if (entry.proximity_code === 'IMMINENT') {
      tabBadge.textContent = "RETESTEO CERCA";
      tabBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-600 font-bold";
    } else {
      tabBadge.textContent = "MONITOREO M5";
      tabBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 font-bold";
    }
  }

  // 4. Setup Name & Key Metrics
  const nameEl = document.getElementById('radarSetupName');
  if (nameEl) nameEl.textContent = entry.setup_name;

  const zoneEl = document.getElementById('radarEntryZone');
  if (zoneEl) zoneEl.textContent = `$${entry.entry_zone_min.toFixed(2)} – $${entry.entry_zone_max.toFixed(2)}`;

  const targetEl = document.getElementById('radarEntryTarget');
  if (targetEl) targetEl.textContent = `$${entry.entry_target_price.toFixed(2)}`;

  const curPriceEl = document.getElementById('radarCurrentPrice');
  if (curPriceEl) curPriceEl.textContent = `$${entry.current_price.toFixed(2)}`;

  const distEl = document.getElementById('radarDistancePts');
  if (distEl) {
    distEl.textContent = `${Math.abs(entry.distance_points).toFixed(0)} pts ($${(Math.abs(entry.distance_points)/100).toFixed(2)})`;
    distEl.className = entry.proximity_code === 'READY' ? "text-emerald-400 font-bold" : "text-yellow-300 font-bold";
  }

  const slPriceEl = document.getElementById('radarSlPrice');
  if (slPriceEl) slPriceEl.textContent = `$${entry.sl_price.toFixed(2)}`;

  const slPtsEl = document.getElementById('radarSlPoints');
  if (slPtsEl) slPtsEl.textContent = `${entry.sl_points.toFixed(0)} pts ($${(entry.sl_points/100).toFixed(2)})`;

  const tp1El = document.getElementById('radarTp1Price');
  if (tp1El) tp1El.textContent = `$${entry.tp1_price.toFixed(2)}`;

  const tp2El = document.getElementById('radarTp2Price');
  if (tp2El) tp2El.textContent = `$${entry.tp2_price.toFixed(2)}`;

  const tp3El = document.getElementById('radarTp3Price');
  if (tp3El && entry.tp3_price) tp3El.textContent = `$${entry.tp3_price.toFixed(2)}`;

  // 5. Matriz Matemática R:R
  const mathTp1 = document.getElementById('mathTp1Price');
  const mathTp1Pts = document.getElementById('mathTp1Pts');
  if (mathTp1) mathTp1.textContent = `$${entry.tp1_price.toFixed(2)}`;
  if (mathTp1Pts) mathTp1Pts.textContent = `+${(entry.sl_points * 2.0).toFixed(1)} pts ($${((entry.sl_points * 2.0)/100).toFixed(2)})`;

  const mathTp2 = document.getElementById('mathTp2Price');
  const mathTp2Pts = document.getElementById('mathTp2Pts');
  if (mathTp2) mathTp2.textContent = `$${entry.tp2_price.toFixed(2)}`;
  if (mathTp2Pts) mathTp2Pts.textContent = `+${(entry.sl_points * 3.0).toFixed(1)} pts ($${((entry.sl_points * 3.0)/100).toFixed(2)})`;

  const mathTp3 = document.getElementById('mathTp3Price');
  const mathTp3Pts = document.getElementById('mathTp3Pts');
  if (mathTp3 && entry.tp3_price) mathTp3.textContent = `$${entry.tp3_price.toFixed(2)}`;
  if (mathTp3Pts) mathTp3Pts.textContent = `+${(entry.sl_points * 5.0).toFixed(1)} pts ($${((entry.sl_points * 5.0)/100).toFixed(2)})`;

  const descEl = document.getElementById('radarActionDesc');
  if (descEl) descEl.textContent = entry.action_desc;

  const noteEl = document.getElementById('radarProtectionNote');
  if (noteEl) noteEl.textContent = entry.protection_note;

  // 6. Ficha Técnica / Ticket de Entrada Quirúrgica (Card 6)
  const ticket = radar.execution_ticket;
  if (ticket) {
    const tBadge = document.getElementById('ticketStateBadge');
    const tText = document.getElementById('ticketStateText');
    if (tBadge && tText) {
      tText.textContent = ticket.state_label;
      if (ticket.state_color === 'emerald') {
        tBadge.className = "px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-md animate-pulse";
      } else if (ticket.state_color === 'amber') {
        tBadge.className = "px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 bg-amber-950 text-amber-300 border border-amber-600 shadow-md animate-pulse";
      } else {
        tBadge.className = "px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 bg-blue-950 text-blue-300 border border-blue-600/80 shadow-md";
      }
    }

    const tAction = document.getElementById('ticketActionText');
    if (tAction) {
      tAction.textContent = ticket.action_badge;
      tAction.className = ticket.action === 'SELL' ? "text-base font-black text-rose-400 block" : "text-base font-black text-emerald-400 block";
    }

    const tEntry = document.getElementById('ticketEntryText');
    if (tEntry) tEntry.textContent = `$${ticket.entry_exact.toFixed(2)}`;

    const tRange = document.getElementById('ticketRangeText');
    if (tRange) tRange.textContent = ticket.entry_range;

    const tSl = document.getElementById('ticketSlText');
    if (tSl) tSl.textContent = `$${ticket.sl_price.toFixed(2)}`;

    const tSlPts = document.getElementById('ticketSlPtsText');
    if (tSlPts) tSlPts.textContent = `${ticket.sl_points.toFixed(0)} pts (-$${ticket.sl_dollars_001.toFixed(2)})`;

    const tTp1 = document.getElementById('ticketTp1Text');
    if (tTp1) tTp1.textContent = `$${ticket.tp1_price.toFixed(2)}`;

    const tTp1Pts = document.getElementById('ticketTp1PtsText');
    if (tTp1Pts) tTp1Pts.textContent = `+${ticket.tp1_pts.toFixed(0)} pts (+$${ticket.tp1_dollars_001.toFixed(2)})`;

    const tTp2 = document.getElementById('ticketTp2Text');
    if (tTp2) tTp2.textContent = `$${ticket.tp2_price.toFixed(2)}`;

    const tTp2Pts = document.getElementById('ticketTp2PtsText');
    if (tTp2Pts) tTp2Pts.textContent = `+${ticket.tp2_pts.toFixed(0)} pts (+$${ticket.tp2_dollars_001.toFixed(2)})`;

    const tStepPrice = document.getElementById('ticketStepPrice');
    if (tStepPrice) tStepPrice.textContent = `$${ticket.current_price.toFixed(2)}`;
  }

  // 7. Mode Buttons State
  const btnPrecision = document.getElementById('btnRadarModePrecision');
  const btnMacro = document.getElementById('btnRadarModeMacro');
  if (btnPrecision && btnMacro) {
    if (currentRadarMode === 'PRECISION') {
      btnPrecision.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-md shadow-emerald-600/30";
      btnMacro.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60";
    } else {
      btnMacro.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-blue-600 text-white shadow-md shadow-blue-600/30";
      btnPrecision.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60";
    }
  }

  initIcons();
}

function setupPrecisionRadarEvents() {
  const btnPrecision = document.getElementById('btnRadarModePrecision');
  const btnMacro = document.getElementById('btnRadarModeMacro');
  const refreshBtn = document.getElementById('btnRefreshPrecisionRadar');
  const btnCopyCalc = document.getElementById('btnCopySetupToCalculator');
  const btnCopyTicket = document.getElementById('btnCopyTicketParams');

  if (btnPrecision) {
    btnPrecision.addEventListener('click', () => loadPrecisionRadarData('PRECISION'));
  }
  if (btnMacro) {
    btnMacro.addEventListener('click', () => loadPrecisionRadarData('MACRO'));
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadPrecisionRadarData());
  }
  if (btnCopyCalc) {
    btnCopyCalc.addEventListener('click', copyRadarSetupToCalculator);
  }
  if (btnCopyTicket) {
    btnCopyTicket.addEventListener('click', copyTicketParamsToClipboard);
  }
  const btnTransfer = document.getElementById('btnTransferTicketToJournal');
  if (btnTransfer) {
    btnTransfer.addEventListener('click', transferRadarTicketToJournal);
  }
}

function transferRadarTicketToJournal() {
  if (!currentPrecisionRadarData || !currentPrecisionRadarData.precision_radar) {
    showToast("⚠️ Ficha no cargada aún. Espera un momento.", "warning");
    return;
  }
  const t = currentPrecisionRadarData.precision_radar.execution_ticket;
  if (!t) return;

  if (typeof window.switchTabTo === 'function') {
    window.switchTabTo('real');
  }

  const dir = t.action === 'SELL' ? 'SELL' : 'BUY';
  const btnBuy = document.getElementById('btnRealDirBuy');
  const btnSell = document.getElementById('btnRealDirSell');
  const dirInput = document.getElementById('realTradeDirection');
  if (dir === 'SELL') {
    if (btnSell) btnSell.className = "py-1.5 rounded-lg text-center font-bold text-xs bg-tvRed text-white shadow transition flex items-center justify-center";
    if (btnBuy) btnBuy.className = "py-1.5 rounded-lg text-center font-bold text-xs text-gray-400 hover:text-white transition flex items-center justify-center";
    if (dirInput) dirInput.value = "SELL";
  } else {
    if (btnBuy) btnBuy.className = "py-1.5 rounded-lg text-center font-bold text-xs bg-tvGreen text-white shadow transition flex items-center justify-center";
    if (btnSell) btnSell.className = "py-1.5 rounded-lg text-center font-bold text-xs text-gray-400 hover:text-white transition flex items-center justify-center";
    if (dirInput) dirInput.value = "BUY";
  }

  const ptsInput = document.getElementById('realTradeTvPoints');
  if (ptsInput) ptsInput.value = t.sl_points.toFixed(0);

  const riskInput = document.getElementById('realTradeRiskPct');
  if (riskInput) riskInput.value = "1.70";

  const rrInput = document.getElementById('realTradeRR');
  if (rrInput) rrInput.value = "2.0";

  const lotInput = document.getElementById('realTradeManualLot');
  if (lotInput) lotInput.value = Number(t.lot_recommended || 0.01).toFixed(2);

  const commInput = document.getElementById('realTradeCommission');
  if (commInput) commInput.value = "-0.06";

  recalculateRealJournalPreview();

  showToast(`📋 <strong>Orden MT5 pre-cargada:</strong> ${dir} en Oro, SL ${t.sl_points.toFixed(0)} pts, Riesgo 1.70%, Lote 0.01 y Comisión -$0.06.`, "success", 5000);
}

function copyTicketParamsToClipboard() {
  if (!currentPrecisionRadarData || !currentPrecisionRadarData.precision_radar) {
    showToast("⚠️ Ficha no cargada aún. Espera un momento.", "warning");
    return;
  }
  const t = currentPrecisionRadarData.precision_radar.execution_ticket;
  if (!t) return;

  const textToCopy = `📌 ORDEN INST. XAU/USD (ORO)
• Acción: ${t.action} (Sell-Only)
• Entrada Óptima: $${t.entry_exact.toFixed(2)} (Zona: ${t.entry_range})
• Stop Loss: $${t.sl_price.toFixed(2)} (${t.sl_points.toFixed(0)} pts)
• TP1 (1:2.0 Mínimo): $${t.tp1_price.toFixed(2)} (+${t.tp1_pts.toFixed(0)} pts) -> Cerrar 70% y Mover a BE
• TP2 (1:3.0 Óptimo): $${t.tp2_price.toFixed(2)} (+${t.tp2_pts.toFixed(0)} pts)
• Lotaje Sugerido para tu cuenta: ${t.lot_recommended} lotes`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    const btnText = document.getElementById('btnCopyTicketText');
    if (btnText) {
      const orig = btnText.textContent;
      btnText.textContent = "¡Parámetros Copiados!";
      setTimeout(() => { btnText.textContent = orig; }, 2000);
    }
    showToast("📋 ¡Parámetros de orden MT5 copiados al portapapeles!", "success", 3000);
  }).catch(err => {
    console.warn("Clipboard error:", err);
  });
}

function copyRadarSetupToCalculator() {
  if (!currentPrecisionRadarData || !currentPrecisionRadarData.precision_radar) {
    showToast("⚠️ Radar no cargado aún. Por favor espera un momento.", "warning");
    return;
  }
  const entry = currentPrecisionRadarData.precision_radar.upcoming_entry;
  if (!entry) return;

  const slPtsInput = document.getElementById('calcSlPoints');
  const goldPriceInput = document.getElementById('calcGoldPrice');

  const slPts = Math.round(entry.sl_points);
  const targetPrice = entry.entry_target_price;

  if (slPtsInput) slPtsInput.value = slPts;
  if (goldPriceInput) goldPriceInput.value = targetPrice;

  appState.calculator.sl_points = slPts;
  appState.calculator.gold_price = targetPrice;

  runMyfxbookCalculator();

  if (window.switchTabTo) {
    window.switchTabTo('calculator');
  }

  showToast(`🎯 ¡Parámetros transferidos a la Calculadora! SL: ${slPts} pts ($${(slPts/100).toFixed(2)}) @ $${targetPrice}`, 'success', 3500);
}



// -------------------------------------------------------------
// TERMINAL INSTITUCIONAL MT5 (Price Action M5 Institutional)
// -------------------------------------------------------------
let selectedScannerAsset = 'XAUUSD';
let selectedRiskPct = 1.0;
let lastDualSignalsData = null;
let lastTriggerIdXau = null;
let lastTriggerIdEur = null;
let lastChimeTimeXau = 0;
let lastChimeTimeEur = 0;
const TRIGGER_CHIME_COOLDOWN_MS = 180000; // 3 minutos de silencio mínimo entre alertas para el mismo activo
let dualTerminalListenersAttached = false;
let audioContext = null;

function playTriggerChime() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880.00, audioContext.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.35);
  } catch (e) {
    console.warn("Audio chime not allowed:", e);
  }
}

function setupDualTerminalControls() {
  if (dualTerminalListenersAttached) return;
  dualTerminalListenersAttached = true;

  selectedScannerAsset = 'EURUSD';

  // Function to apply risk percentage (presets or manual)
  function applyRisk(pct, notify = false) {
    const num = parseFloat(pct);
    if (isNaN(num) || num <= 0) {
      if (notify) showToast("⚠️ Ingresa un porcentaje de riesgo válido (ej: 1.5, 3.0, 5.0).", "warning");
      return;
    }
    selectedRiskPct = Math.round(num * 10) / 10;

    // Sync manual input
    const manualInput = document.getElementById('inputManualRiskPct');
    if (manualInput && document.activeElement !== manualInput) {
      manualInput.value = selectedRiskPct;
    }

    // Sync preset buttons
    const riskBtns = document.querySelectorAll('.btn-risk-choice');
    let matchedPreset = false;
    riskBtns.forEach(b => {
      const bRisk = parseFloat(b.getAttribute('data-risk'));
      if (Math.abs(bRisk - selectedRiskPct) < 0.05) {
        matchedPreset = true;
        b.className = "btn-risk-choice flex-1 py-1 rounded-md text-[10px] font-mono font-black bg-blue-500 text-white shadow-sm transition";
      } else {
        b.className = "btn-risk-choice flex-1 py-1 rounded-md text-[10px] font-mono font-bold bg-gray-800 text-gray-300 hover:text-white transition";
      }
    });

    if (manualInput) {
      if (!matchedPreset) {
        manualInput.parentElement.classList.add('border-blue-400', 'bg-blue-950/40');
      } else {
        manualInput.parentElement.classList.remove('border-blue-400', 'bg-blue-950/40');
      }
    }

    // Immediate optimistic update of labels
    const labelRiskDollar = document.getElementById('labelRiskDollar');
    const eurTicketRiskPctText = document.getElementById('eurTicketRiskPctText');
    if (eurTicketRiskPctText) eurTicketRiskPctText.textContent = `${selectedRiskPct}% riesgo exacto`;

    if (labelRiskDollar && lastDualSignalsData && lastDualSignalsData.account) {
      const bal = lastDualSignalsData.account.balance || 97.72;
      const usd = (bal * (selectedRiskPct / 100.0)).toFixed(2);
      labelRiskDollar.textContent = `$${usd} (${selectedRiskPct}%)`;
    }

    if (notify) {
      showToast(`🎯 Riesgo actualizado a ${selectedRiskPct}% por operación. Recalculando lotaje...`, "info", 2000);
    }
    fetchDualScannerSignals();
  }

  // Presets
  const riskBtns = document.querySelectorAll('.btn-risk-choice');
  riskBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.getAttribute('data-risk')) || 1.0;
      applyRisk(val);
    });
  });

  // Manual Input & Button
  const inputManual = document.getElementById('inputManualRiskPct');
  const btnApplyManual = document.getElementById('btnApplyManualRisk');

  if (btnApplyManual && inputManual) {
    btnApplyManual.addEventListener('click', () => {
      applyRisk(inputManual.value, true);
    });
  }

  if (inputManual) {
    inputManual.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyRisk(inputManual.value, true);
      }
    });
    inputManual.addEventListener('change', () => {
      applyRisk(inputManual.value, false);
    });
  }

  // Copy Ticket EUR
  const btnCopyEur = document.getElementById('btnCopyTicketEur');
  if (btnCopyEur) {
    btnCopyEur.addEventListener('click', () => {
      copyTicketToClipboard('EURUSD');
    });
  }

  // Modal MT5 Guide
  const btnOpenGuide = document.getElementById('btnOpenMt5Guide');
  const btnCloseGuide = document.getElementById('btnCloseMt5Guide');
  const btnGotItGuide = document.getElementById('btnGotItMt5');
  const modalGuide = document.getElementById('modalMt5Guide');

  if (btnOpenGuide && modalGuide) {
    btnOpenGuide.addEventListener('click', () => { modalGuide.classList.remove('hidden'); });
  }
  if (btnCloseGuide && modalGuide) {
    btnCloseGuide.addEventListener('click', () => { modalGuide.classList.add('hidden'); });
  }
  if (btnGotItGuide && modalGuide) {
    btnGotItGuide.addEventListener('click', () => { modalGuide.classList.add('hidden'); });
  }

  // Refresh Button
  const btnRefresh = document.getElementById('btnRefreshScanner');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      showToast("🔄 Escaneando EUR/USD en vivo...", "info", 1500);
      fetchDualScannerSignals();
    });
  }
}

function copyTicketToClipboard(asset) {
  if (!lastDualSignalsData) {
    showToast("⚠️ Datos no disponibles aún.", "warning");
    return;
  }
  const data = lastDualSignalsData.eurusd;
  if (!data || !data.ticket) return;

  const t = data.ticket;
  if (t.action && (t.action.includes('EXPIRAD') || t.action.includes('INVALIDAD') || t.action.includes('ESPERA'))) {
    showToast("⚪ Esta oportunidad ya expiró o el precio ya se expandió. Espera un nuevo ciclo.", "info", 3000);
    return;
  }
  const tp1Title = t.tp1_label || 'Take Profit 1 (Ratio 1:3)';
  const tp2Title = t.tp2_label || 'Take Profit 2 (Ratio 1:5+)';
  const text = `${t.asset} ${t.action}
Entrada: ${t.entry}
Stop Loss: ${t.sl} (${asset === 'XAUUSD' ? t.sl_dist_pts + ' pts' : t.sl_pips + ' pips'})
${tp1Title}: ${t.tp1}
${tp2Title}: ${t.tp2}
Lotaje MT5: ${t.suggested_lot} lotes (Riesgo: ${t.risk_pct}% · $${t.risk_usd} USD)
Estrategia: ${t.strategy}`;

  navigator.clipboard.writeText(text).then(() => {
    const lbl = document.getElementById(asset === 'XAUUSD' ? 'labelCopyXau' : 'labelCopyEur');
    if (lbl) {
      const orig = lbl.textContent;
      lbl.textContent = "¡Copiado!";
      setTimeout(() => { lbl.textContent = orig; }, 2000);
    }
    showToast(`📋 ¡Orden MT5 de ${t.asset} copiada! Abre MetaTrader y ejecuta.`, "success", 3000);
  }).catch(err => {
    console.error("Clipboard err:", err);
  });
}

async function fetchDualScannerSignals() {
  setupDualTerminalControls();
  try {
    const res = await fetch(`/api/scanner/signals?risk_pct=${selectedRiskPct}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data || data.status !== "success") return;
    lastDualSignalsData = data;
    renderDualSignals(data);
  } catch (err) {
    console.error("Error fetching dual scanner signals:", err);
  }
}

function renderDualSignals(data) {
  if (!data) return;

  // 1. Telemetría de Conexión MT5 & Cuenta
  const badgeMt5 = document.getElementById('badgeMt5Status');
  const iconBox = document.getElementById('mt5StatusIconBox');
  const subTitle = document.getElementById('mt5StatusSubtitle');
  const statBroker = document.getElementById('statMt5Broker');
  const statPing = document.getElementById('statMt5Ping');
  const statBalance = document.getElementById('statMt5Balance');
  const statEquity = document.getElementById('statMt5Equity');
  const statSpreadXau = document.getElementById('statSpreadXau');
  const statSpreadEur = document.getElementById('statSpreadEur');
  const labelRiskDollar = document.getElementById('labelRiskDollar');

  const isMt5 = data.mt5_connected;
  if (badgeMt5) {
    if (isMt5) {
      badgeMt5.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse";
      badgeMt5.textContent = `🟢 MT5 CONECTADO (TICK EXACTO)`;
    } else {
      badgeMt5.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30";
      badgeMt5.textContent = "🟡 MODO SPOT WEB (Esperando MT5)";
    }
  }

  if (iconBox) {
    iconBox.className = isMt5 
      ? "w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0"
      : "w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0";
  }

  if (subTitle && data.source) {
    subTitle.textContent = isMt5
      ? `Transmisión directa desde tu MetaTrader 5 (${data.mt5_status.broker}) · 0.00 desfase`
      : "Transmisión Spot en Vivo · Conecta GhostBridge_MT5.mq5 para sincronizar tu broker al centavo";
  }

  if (statBroker && data.account) {
    statBroker.textContent = isMt5 ? (data.mt5_status.broker || "MetaTrader 5") : "Esperando MT5...";
  }

  if (statPing && data.mt5_status) {
    statPing.textContent = isMt5 ? `Último tick: hace ${data.mt5_status.seconds_since_ping}s` : "MT5 desconectado";
  }

  if (statBalance && data.account) {
    statBalance.textContent = `$${data.account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${data.account.currency}`;
  }

  if (statEquity && data.mt5_status && data.mt5_status.equity) {
    statEquity.textContent = `Equidad: $${data.mt5_status.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (labelRiskDollar && data.account) {
    labelRiskDollar.textContent = `$${data.account.risk_usd.toFixed(2)} (${data.account.risk_pct}%)`;
  }

  // 3. Render EUR/USD (Price Action M5)
  if (data.eurusd) {
    const e = data.eurusd;
    const t = e.ticket || {};

    const priceEl = document.getElementById('eurLivePrice');
    const badgeEl = document.getElementById('eurStateBadge');
    const descEl = document.getElementById('eurStatusDesc');
    const p1El = document.getElementById('eurPhase1');
    const p2El = document.getElementById('eurPhase2');
    const p3El = document.getElementById('eurPhase3');

    if (priceEl && e.current_price) priceEl.textContent = e.current_price.toFixed(5);
    if (badgeEl && e.badge) badgeEl.textContent = e.badge;
    if (descEl && e.status_desc) descEl.textContent = e.status_desc;
    if (p1El && e.structure) p1El.textContent = e.structure;
    if (p2El) p2El.textContent = e.state === "WAITING_RETEST" || e.state === "TRIGGER_CONFIRMED" ? "CONFIRMADO" : "BUSCANDO";
    if (p3El) p3El.textContent = e.state === "TRIGGER_CONFIRMED" ? "CONFIRMADO" : "ESPERANDO";

    // Ticket fields
    const actBadge = document.getElementById('eurTicketActionBadge');
    const entryEl = document.getElementById('eurTicketEntry');
    const slEl = document.getElementById('eurTicketSl');
    const slPipsEl = document.getElementById('eurTicketSlPips');
    const tp1El = document.getElementById('eurTicketTp1');
    const tp2El = document.getElementById('eurTicketTp2');
    const lotEl = document.getElementById('eurTicketLot');
    const riskUsdEl = document.getElementById('eurTicketRiskDollar');
    const btnCopyEur = document.getElementById('btnCopyTicketEur');
    const lblCopyEur = document.getElementById('labelCopyEur');

    const isExpiredEur = t.action && (t.action.includes('EXPIRAD') || t.action.includes('INVALIDAD') || t.action.includes('ESPERA'));

    if (actBadge && t.action) {
      actBadge.textContent = t.action;
      if (isExpiredEur) {
        actBadge.className = "px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700";
      } else if (t.action.includes('BUY')) {
        actBadge.className = "px-2.5 py-0.5 rounded-md text-xs font-mono font-black bg-blue-500 text-black shadow-md";
      } else {
        actBadge.className = "px-2.5 py-0.5 rounded-md text-xs font-mono font-black bg-red-500 text-white shadow-md";
      }
    }

    if (isExpiredEur) {
      const waitMsg = t.action.includes('ESPERA') ? "— (Esperando Setup)" : "— (Expirada)";
      if (entryEl) entryEl.textContent = waitMsg;
      if (slEl) slEl.textContent = "—";
      if (slPipsEl) slPipsEl.textContent = t.action.includes('ESPERA') ? "Sin zona activa" : "Fuera de zona";
      if (tp1El) tp1El.textContent = "—";
      if (tp2El) tp2El.textContent = "—";
      if (lotEl) lotEl.textContent = "0.00 lotes";
      if (riskUsdEl) riskUsdEl.textContent = "$0.00";
      if (btnCopyEur) {
        btnCopyEur.classList.add('opacity-40', 'cursor-not-allowed');
        btnCopyEur.disabled = true;
      }
      if (lblCopyEur) lblCopyEur.textContent = t.action.includes('ESPERA') ? "⚪ Esperando Retesteo" : "⚪ Oportunidad Finalizada";
    } else {
      if (entryEl && t.entry) entryEl.textContent = t.entry.toFixed(5);
      if (slEl && t.sl) slEl.textContent = t.sl.toFixed(5);
      if (slPipsEl && t.sl_pips) slPipsEl.textContent = `${t.sl_pips} pips`;
      if (tp1El && t.tp1) tp1El.textContent = t.tp1.toFixed(5);
      if (tp2El && t.tp2) tp2El.textContent = t.tp2.toFixed(5);
      if (lotEl && t.suggested_lot) lotEl.textContent = `${t.suggested_lot.toFixed(2)} lotes`;
      if (riskUsdEl && t.risk_usd) riskUsdEl.textContent = `$${t.risk_usd.toFixed(2)}`;
      const riskPctEl = document.getElementById('eurTicketRiskPctText');
      if (riskPctEl) {
        const curPct = (t.risk_pct !== undefined && t.risk_pct !== null) ? t.risk_pct : selectedRiskPct;
        riskPctEl.textContent = `${curPct}% riesgo exacto`;
      }
      if (btnCopyEur) {
        btnCopyEur.classList.remove('opacity-40', 'cursor-not-allowed');
        btnCopyEur.disabled = false;
      }
      if (lblCopyEur) lblCopyEur.textContent = "Copiar Parámetros MT5";
    }

    // Extra Price Action Metrics
    const keyZone = document.getElementById('eurKeyZone');
    const zoneTouches = document.getElementById('eurZoneTouches');
    const structDesc = document.getElementById('eurStructureDesc');
    if (statSpreadEur && e.spread_pips) statSpreadEur.textContent = `${e.spread_pips} pips`;

    if (e.key_zone) {
      if (keyZone) keyZone.textContent = e.key_zone.center.toFixed(5);
      if (zoneTouches) zoneTouches.textContent = `${e.key_zone.touches} toques previos confirmados`;
    }
    if (structDesc && e.structure_desc) structDesc.textContent = e.structure_desc;

    // Sound chime ONLY when a genuine NEW trigger_id is confirmed and cooldown has passed
    const eurTriggerId = e.trigger_id || (e.state === "TRIGGER_CONFIRMED" ? `EUR_${e.ticket?.action}_${e.ticket?.entry}` : null);
    if (e.state === "TRIGGER_CONFIRMED" && eurTriggerId && eurTriggerId !== lastTriggerIdEur && (nowMs - lastChimeTimeEur > TRIGGER_CHIME_COOLDOWN_MS)) {
      lastTriggerIdEur = eurTriggerId;
      lastChimeTimeEur = nowMs;
      playTriggerChime();
      showToast("🎯 ¡GATILLO CONFIRMADO EN EUR/USD! Abre tu MT5 y coloca los parámetros.", "success", 7000);
    }
  }

  initIcons();
}
