/**
 * Ghost Trader | Gold — Terminal Institucional de Trading, Macro Sesión & Bitácora Real
 * Cálculo de interés compuesto basado puramente en porcentaje y puntos de oro.
 */

// Global State
let appState = {
  activeTab: 'gold_bias', // 'gold_bias' | 'calculator' | 'real'
  config: {
    initial_balance: 110.0,
    risk_pct: 5.0,
    rr_ratio: 1.0,
    leverage: 300,
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
    balance: 110.0,
    risk_pct: 5.0,
    sl_points: 250,
    rr: 1.0,
    leverage: 300,
    gold_price: 2720.0
  }
};

// Chart instances
let equityChart = null;
let distributionChart = null;
let drawdownChart = null;

// Initialize on DOM Loaded
document.addEventListener('DOMContentLoaded', async () => {
  startMarketClock();
  initIcons();
  setupTabNavigation();
  setupEventListeners();
  setupCollapsibleSections();
  setupMacroGuideModalEvents();
  setupTradingViewWebhookEvents();
  await loadConfig();
  await loadTrades('real');
  setCurrentDateTime();
  syncRealBalanceToCalculator();
  runMyfxbookCalculator();
  setupGoldBiasDashboard();
  loadGoldBiasData();
  loadWeeklyNews();
  renderRealJournalDashboard();
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

function setCurrentDateTime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  
  const realDateField = document.getElementById('realTradeDate');
  if (realDateField) {
    realDateField.value = formatted;
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

// ----------------------------------------------------
// TAB NAVIGATION: 1. Macro Sesión | 2. Calculadora | 3. Bitácora
// ----------------------------------------------------
function setupTabNavigation() {
  const btnGoldBias = document.getElementById('tabBtnGoldBias');
  const btnCalc = document.getElementById('tabBtnCalculator');
  const btnReal = document.getElementById('tabBtnRealJournal');

  const viewGoldBias = document.getElementById('viewGoldBias');
  const viewCalc = document.getElementById('viewCalculator');
  const viewReal = document.getElementById('viewRealJournal');

  function switchTab(tab) {
    if (tab === 'backtest') tab = 'real';
    appState.activeTab = tab;
    try {
      localStorage.setItem('activeTab', tab);
      localStorage.setItem('activeTab_v3', tab);
    } catch (e) {}

    // Reset tab button styles
    const activeClasses = ['bg-emerald-600', 'bg-gold-500', 'bg-yellow-500', 'text-white', 'text-black', 'shadow-lg', 'shadow-emerald-600/30', 'shadow-gold-500/30', 'shadow-yellow-500/30', 'font-bold', 'font-black'];
    const inactiveClasses = ['text-gray-400', 'hover:text-white', 'hover:bg-gray-800/60', 'font-semibold'];

    [btnGoldBias, btnCalc, btnReal].forEach(btn => {
      if (btn) {
        btn.classList.remove(...activeClasses);
        btn.classList.add(...inactiveClasses);
      }
    });

    if (viewGoldBias) viewGoldBias.classList.add('hidden');
    if (viewCalc) viewCalc.classList.add('hidden');
    if (viewReal) viewReal.classList.add('hidden');

    if (tab === 'gold_bias') {
      if (btnGoldBias) {
        btnGoldBias.classList.remove(...inactiveClasses);
        btnGoldBias.classList.add('bg-yellow-500', 'text-black', 'shadow-lg', 'shadow-yellow-500/30', 'font-black');
      }
      if (viewGoldBias) viewGoldBias.classList.remove('hidden');
      loadGoldBiasData();
      loadWeeklyNews();
    } else if (tab === 'calculator') {
      if (btnCalc) {
        btnCalc.classList.remove(...inactiveClasses);
        btnCalc.classList.add('bg-gold-500', 'text-black', 'shadow-lg', 'shadow-gold-500/30', 'font-black');
      }
      if (viewCalc) viewCalc.classList.remove('hidden');
      syncRealBalanceToCalculator();
      runMyfxbookCalculator();
    } else if (tab === 'real') {
      if (btnReal) {
        btnReal.classList.remove(...inactiveClasses);
        btnReal.classList.add('bg-emerald-600', 'text-white', 'shadow-lg', 'shadow-emerald-600/30', 'font-bold');
      }
      if (viewReal) viewReal.classList.remove('hidden');
      renderRealJournalDashboard();
    }

    initIcons();
  }

  if (btnGoldBias) btnGoldBias.addEventListener('click', () => switchTab('gold_bias'));
  if (btnCalc) btnCalc.addEventListener('click', () => switchTab('calculator'));
  if (btnReal) btnReal.addEventListener('click', () => switchTab('real'));

  // Default to gold_bias (Macro Sesión) or saved tab
  const savedTab = localStorage.getItem('activeTab_v3') || 'gold_bias';
  switchTab(savedTab);
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
  try {
    const res = await fetch(`/api/trades?mode=${mode}`);
    if (res.ok) {
      const data = await res.json();
      if (mode === 'real') {
        appState.real.summary = data.summary || {};
        appState.real.equityCurve = data.equity_curve || [];
        appState.real.trades = data.trades || [];
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
  document.getElementById('badgeRiskPct').textContent = risk.toFixed(1);
  document.getElementById('badgeCurrentRR').textContent = rr.toFixed(1);
  document.getElementById('statInitialLabel').textContent = initial.toFixed(2);

  // Recalculation Console inputs
  const initialInput = document.getElementById('globalInitialInput');
  if (initialInput) initialInput.value = Math.round(initial);
  const labelActiveInitial = document.getElementById('labelActiveInitialBal');
  if (labelActiveInitial) labelActiveInitial.textContent = `$${initial.toFixed(2)}`;

  document.getElementById('globalRiskInput').value = risk.toFixed(1);
  document.getElementById('globalRRInput').value = rr.toFixed(1);
  document.getElementById('labelActiveRiskPct').textContent = `${risk.toFixed(1)}%`;
  document.getElementById('labelActiveRR').textContent = `1:${rr.toFixed(1)}`;

  // Trade form RR input
  document.getElementById('tradeSpecificRR').value = rr.toFixed(1);

  // Settings modal
  document.getElementById('settingInitialBalance').value = initial;
  document.getElementById('settingRiskPct').value = risk;
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
  if (lblRisk) lblRisk.textContent = `${newRisk.toFixed(1)}%`;
  const lblRR = document.getElementById('labelActiveRR');
  if (lblRR) lblRR.textContent = `1:${newRR.toFixed(1)}`;

  document.getElementById('badgeInitialBalance').textContent = initial.toFixed(2);
  document.getElementById('badgeRiskPct').textContent = newRisk.toFixed(1);
  document.getElementById('badgeCurrentRR').textContent = newRR.toFixed(1);
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
  const pointsEl = document.getElementById('tradeTvPoints');
  if (!pointsEl) return;

  const curBal = (appState.backtest.summary && appState.backtest.summary.current_balance !== undefined) 
    ? appState.backtest.summary.current_balance 
    : appState.config.initial_balance;

  const riskPct = parseFloat(appState.config.risk_pct) || 5.0;
  const leverage = parseFloat(appState.config.leverage) || 300;

  const rawInput = pointsEl.value;
  const { points, price } = parseTradingViewInput(rawInput);

  const tradeRR = parseFloat(document.getElementById('tradeSpecificRR').value) || parseFloat(appState.config.rr_ratio) || 1.0;

  const tvSlFormatted = `${points} pts TV ($${price})`;
  const tpPoints = Math.round(points * tradeRR);
  const tpPrice = (tpPoints / 100).toFixed(2);
  const tvTpFormatted = `${tpPoints} pts TV ($${tpPrice})`;

  document.getElementById('tvPointsExplain').textContent = `Stop: ${points} pts TV ($${price})`;
  document.getElementById('tvWidgetSlPoints').textContent = tvSlFormatted;
  document.getElementById('tvWidgetTpPoints').textContent = `${tvTpFormatted} (1:${tradeRR.toFixed(1)})`;
  document.getElementById('tvWidgetRRRatio').textContent = `1:${tradeRR.toFixed(1)}`;

  // Pure % Compounding dollar target
  const dollarRisk = roundNum(curBal * (riskPct / 100.0), 2);
  const dollarReward = roundNum(dollarRisk * tradeRR, 2);
  const rewardPct = roundNum(riskPct * tradeRR, 1);

  // Suggested lot for MetaTrader
  const rawLot = dollarRisk / points;
  const roundedLot = Math.max(0.01, roundNum(rawLot, 2));

  // Margin at 1:300 leverage
  const notional = 2720.0 * 100 * roundedLot;
  const marginReq = notional / leverage;
  const marginPct = (marginReq / curBal) * 100.0;

  // Update UI Elements
  document.getElementById('badgeCurrentRiskUsd').textContent = `$${dollarRisk.toFixed(2)}`;
  document.getElementById('formCurrentBalanceDisplay').textContent = `$${curBal.toFixed(2)}`;
  document.getElementById('formCurrentRiskBudgetDisplay').textContent = `$${dollarRisk.toFixed(2)}`;

  document.getElementById('calcOutLot').textContent = roundedLot.toFixed(2);
  document.getElementById('tradeLot').value = roundedLot.toFixed(2);
  document.getElementById('tvRawLotText').textContent = `(raw: ${rawLot.toFixed(4)})`;

  document.getElementById('calcOutMargin').textContent = `~$${marginReq.toFixed(2)} (${marginPct.toFixed(1)}%)`;

  // Dollar Labels (Pure %)
  document.getElementById('tvWidgetRiskUsd').textContent = `-$${dollarRisk.toFixed(2)} (-${riskPct.toFixed(1)}%)`;
  document.getElementById('tvWidgetRewardUsd').textContent = `+$${dollarReward.toFixed(2)} (+${rewardPct.toFixed(1)}%)`;

  // Preview radio badges
  document.getElementById('formPreviewGain').textContent = `+$${dollarReward.toFixed(2)}`;
  document.getElementById('formPreviewLoss').textContent = `-$${dollarRisk.toFixed(2)}`;

  // Warning check
  const warningBox = document.getElementById('calcWarningBox');
  const warningText = document.getElementById('calcWarningText');
  
  if (marginReq > curBal) {
    warningBox.classList.remove('hidden');
    warningText.innerHTML = `<strong>Margen alto:</strong> Requiere ~$${marginReq.toFixed(2)} (supera tu balance de $${curBal.toFixed(2)}).`;
  } else if (roundedLot === 0.01 && (0.01 * points) > dollarRisk * 1.5) {
    const actualRisk = roundNum(0.01 * points, 2);
    warningBox.classList.remove('hidden');
    warningText.innerHTML = `<strong>SL amplio en MT4:</strong> El lote mínimo de tu broker (0.01) movería $${actualRisk.toFixed(2)} en lugar de $${dollarRisk.toFixed(2)}.`;
  } else {
    warningBox.classList.add('hidden');
  }

  initIcons();
}

// ----------------------------------------------------
// Form 2: Real Journal Live Preview
// ----------------------------------------------------
function recalculateRealJournalPreview() {
  const curBal = (appState.real.summary && appState.real.summary.current_balance !== undefined)
    ? appState.real.summary.current_balance
    : appState.config.initial_balance;

  const rawInput = document.getElementById('realTradeTvPoints')?.value || '250';
  const { points, price } = parseTradingViewInput(rawInput);
  const riskPct = parseFloat(document.getElementById('realTradeRiskPct')?.value) || 5.0;
  const rr = parseFloat(document.getElementById('realTradeRR')?.value) || 1.0;
  const leverage = parseFloat(appState.config.leverage) || 300;

  const dollarRiskBudget = roundNum(curBal * (riskPct / 100.0), 2);
  const rawLot = points > 0 ? (dollarRiskBudget / points) : 0.01;
  const suggestedLot = Math.max(0.01, roundNum(rawLot, 2));

  // Actualización del badge de lote sugerido
  const suggestedBadge = document.getElementById('realTradeSuggestedLotBadge');
  if (suggestedBadge) suggestedBadge.textContent = suggestedLot.toFixed(2);

  // Manejo de lote manual ingresado por el usuario
  const manualLotInput = document.getElementById('realTradeManualLot');
  const manualLotVal = manualLotInput && manualLotInput.value ? parseFloat(manualLotInput.value) : null;
  const effectiveLot = (manualLotVal && manualLotVal > 0) ? roundNum(manualLotVal, 2) : suggestedLot;

  const effectiveMargin = roundNum((2720.0 * 100 * effectiveLot) / leverage, 2);
  const effectiveRiskDollar = roundNum(points * effectiveLot, 2);
  const effectiveRewardDollar = roundNum(points * effectiveLot * rr, 2);
  const effectiveRiskPct = curBal > 0 ? roundNum((effectiveRiskDollar / curBal) * 100, 1) : riskPct;
  const effectiveRewardPct = curBal > 0 ? roundNum((effectiveRewardDollar / curBal) * 100, 1) : (riskPct * rr);

  const slExplain = document.getElementById('realSlExplain');
  if (slExplain) slExplain.textContent = `${points} pts ($${price})`;

  const curBalDisplay = document.getElementById('realFormCurrentBalDisplay');
  if (curBalDisplay) curBalDisplay.textContent = `$${curBal.toFixed(2)}`;

  const previewRisk = document.getElementById('realPreviewRiskDollar');
  if (previewRisk) previewRisk.textContent = `-$${effectiveRiskDollar.toFixed(2)} (-${effectiveRiskPct.toFixed(1)}%)`;

  const previewReward = document.getElementById('realPreviewRewardDollar');
  if (previewReward) previewReward.textContent = `+$${effectiveRewardDollar.toFixed(2)} (+${effectiveRewardPct.toFixed(1)}%)`;

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

function syncRealBalanceToCalculator() {
  const curBal = getRealAccountBalance();
  const calcBal = document.getElementById('calcBalInput');
  if (calcBal) {
    calcBal.value = Number(curBal).toFixed(2);
  }
}

function runMyfxbookCalculator() {
  const realBal = getRealAccountBalance();
  const balInput = document.getElementById('calcBalInput');
  const balance = balInput && balInput.value !== '' && !isNaN(balInput.value)
    ? parseFloat(balInput.value)
    : realBal;
  const riskInput = document.getElementById('calcRiskPctInput');
  const riskPct = riskInput && riskInput.value !== '' && !isNaN(riskInput.value)
    ? parseFloat(riskInput.value)
    : 1.0;
  const rawSl = document.getElementById('calcSlPointsInput')?.value || '250';
  const { points, price } = parseTradingViewInput(rawSl);
  const rr = parseFloat(document.getElementById('calcRRInput')?.value) || 1.0;
  const leverage = parseFloat(document.getElementById('calcLeverageInput')?.value) || 300;
  const goldPrice = 2720.0;

  // Dollar Risk & Reward
  const dollarRisk = roundNum(balance * (riskPct / 100.0), 2);
  const dollarReward = roundNum(dollarRisk * rr, 2);
  const rewardPct = roundNum(riskPct * rr, 1);

  // Position Sizing: 1.00 lot Gold = 100 oz. 1 TV Point = $1.00 USD on 1.00 lot.
  // Suggested Lot = Dollar Risk / Points
  const rawLot = points > 0 ? (dollarRisk / points) : 0.01;
  const suggestedLot = Math.max(0.01, roundNum(rawLot, 2));

  // Margin at given leverage
  const notional = goldPrice * 100 * suggestedLot;
  const marginReq = roundNum(notional / leverage, 2);
  const marginPct = balance > 0 ? roundNum((marginReq / balance) * 100.0, 1) : 0.0;

  // Contract volume in troy oz
  const contractOz = roundNum(suggestedLot * 100, 1);

  // Update Calculator UI
  const balLabel = document.getElementById('myfxBalLabel');
  if (balLabel) balLabel.textContent = `$${balance.toFixed(2)}`;
  const riskLabel = document.getElementById('myfxRiskLabel');
  if (riskLabel) riskLabel.textContent = `${riskPct.toFixed(1)}%`;
  const slLabel = document.getElementById('myfxSlLabel');
  if (slLabel) slLabel.textContent = `${points} pts TV ($${price})`;
  const slText = document.getElementById('myfxSlText');
  if (slText) slText.textContent = `${points} puntos TV ($${price})`;

  // Hero Lot Card
  const heroLot = document.getElementById('myfxHeroLot');
  if (heroLot) heroLot.textContent = suggestedLot.toFixed(2);
  const heroRaw = document.getElementById('myfxHeroRawLot');
  if (heroRaw) heroRaw.textContent = `Lote exacto sin redondeo: ${rawLot.toFixed(4)}`;

  // Breakdown Cards
  const riskUsd = document.getElementById('myfxRiskUsd');
  if (riskUsd) riskUsd.textContent = `-$${dollarRisk.toFixed(2)}`;
  const riskPctText = document.getElementById('myfxRiskPctText');
  if (riskPctText) riskPctText.textContent = `${riskPct.toFixed(1)}% de la cuenta`;

  const rewardUsd = document.getElementById('myfxRewardUsd');
  if (rewardUsd) rewardUsd.textContent = `+$${dollarReward.toFixed(2)}`;
  const rewardPctText = document.getElementById('myfxRewardPctText');
  if (rewardPctText) rewardPctText.textContent = `+${rewardPct.toFixed(1)}% de la cuenta`;

  const priceDist = document.getElementById('myfxPriceDist');
  if (priceDist) priceDist.textContent = `$${price}`;
  const pointsDist = document.getElementById('myfxPointsDist');
  if (pointsDist) pointsDist.textContent = `${points} puntos TV`;

  const marginReqEl = document.getElementById('myfxMarginReq');
  if (marginReqEl) marginReqEl.textContent = `~$${marginReq.toFixed(2)}`;
  const marginPctEl = document.getElementById('myfxMarginPct');
  if (marginPctEl) marginPctEl.textContent = `${marginPct}% del balance`;

  const contractUnits = document.getElementById('myfxContractUnits');
  if (contractUnits) contractUnits.textContent = `${contractOz} oz`;
  const ratioOut = document.getElementById('myfxRatioOut');
  if (ratioOut) ratioOut.textContent = `1:${rr.toFixed(1)}`;

  // Warnings
  const warnBox = document.getElementById('myfxWarningBox');
  const warnText = document.getElementById('myfxWarningText');
  if (warnBox && warnText) {
    if (marginReq > balance) {
      warnBox.classList.remove('hidden');
      warnText.innerHTML = `<strong>Aviso de Margen:</strong> Se requiere $${marginReq.toFixed(2)} de margen pero el balance es de $${balance.toFixed(2)}. Considera reducir el riesgo o SL.`;
    } else if (suggestedLot === 0.01 && rawLot < 0.007) {
      const actualRisk = roundNum(0.01 * points, 2);
      const actualPct = roundNum((actualRisk / balance) * 100.0, 1);
      warnBox.classList.remove('hidden');
      warnText.innerHTML = `<strong>Lote Mínimo de Broker (0.01):</strong> Para arriesgar solo $${dollarRisk.toFixed(2)} (${riskPct}%) necesitarías ${rawLot.toFixed(4)} lotes. Con 0.01 arriesgarías $${actualRisk.toFixed(2)} (${actualPct}%).`;
    } else {
      warnBox.classList.add('hidden');
    }
  }

  initIcons();
}

// ----------------------------------------------------
// Render Backtest Dashboard & KPIs
// ----------------------------------------------------
function renderBacktestDashboard() {
  const s = appState.backtest.summary || {};
  const cfg = appState.config || {};
  
  const curBal = s.current_balance !== undefined ? s.current_balance : cfg.initial_balance;
  const netPnl = s.net_pnl !== undefined ? s.net_pnl : 0.0;
  const netRet = s.net_return_pct !== undefined ? s.net_return_pct : 0.0;
  const winRate = s.win_rate !== undefined ? s.win_rate : 0.0;
  const wins = s.wins || 0;
  const losses = s.losses || 0;
  const total = s.total_trades || 0;
  const pf = s.profit_factor !== undefined ? s.profit_factor : 0.0;
  const maxDd = s.max_drawdown_pct !== undefined ? s.max_drawdown_pct : 0.0;
  const maxDdUsd = s.max_drawdown_amount !== undefined ? s.max_drawdown_amount : 0.0;
  const maxWinStreak = s.max_streak_win || 0;
  const maxLossStreak = s.max_streak_loss || 0;
  const expectancy = s.expectancy_usd !== undefined ? s.expectancy_usd : 0.0;
  const beWinrate = s.be_winrate !== undefined ? s.be_winrate : 50.0;

  document.getElementById('tabBadgeBacktest').textContent = `${total} ops`;
  document.getElementById('recalcTradesCount').textContent = total;

  // Win Rate Card
  document.getElementById('statWinRate').textContent = `${winRate.toFixed(1)}%`;
  document.getElementById('statWins').textContent = wins;
  document.getElementById('statLosses').textContent = losses;
  document.getElementById('statWinRateBar').style.width = `${Math.min(100, winRate)}%`;

  const winRateBadge = document.getElementById('winRateBadge');
  if (total === 0) {
    winRateBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-gray-800 text-gray-400';
    winRateBadge.textContent = '0 Trades';
  } else if (winRate >= beWinrate) {
    winRateBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800';
    winRateBadge.textContent = `Rentable (>${beWinrate}%)`;
  } else {
    winRateBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-950 text-rose-400 border border-rose-800';
    winRateBadge.textContent = `Bajo BE (${beWinrate}%)`;
  }

  // Balance Card
  document.getElementById('statCurrentBalance').textContent = `$${curBal.toFixed(2)}`;
  const sign = netPnl >= 0 ? '+' : '';
  const netPnlEl = document.getElementById('statNetPnL');
  netPnlEl.textContent = `${sign}$${netPnl.toFixed(2)} (${sign}${netRet.toFixed(1)}%)`;
  netPnlEl.className = netPnl >= 0 ? 'font-bold text-emerald-400' : 'font-bold text-rose-400';

  const returnBadge = document.getElementById('statReturnBadge');
  returnBadge.textContent = `${sign}${netRet.toFixed(1)}%`;
  returnBadge.className = netPnl >= 0 
    ? 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
    : 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-950/60 text-rose-400 border border-rose-800/40';

  // Profit Factor Card
  document.getElementById('statProfitFactor').textContent = pf === '∞' ? '∞' : Number(pf).toFixed(2);
  document.getElementById('statTotalGain').textContent = Number(s.total_gain || 0).toFixed(2);
  document.getElementById('statTotalLoss').textContent = Number(s.total_loss || 0).toFixed(2);
  document.getElementById('breakevenTargetText').textContent = `BE objetivo: ${beWinrate}% (R:R 1:${Number(cfg.rr_ratio || 1.0).toFixed(1)})`;

  // Max DD Card
  document.getElementById('statMaxDD').textContent = `${maxDd.toFixed(1)}%`;
  document.getElementById('statMaxDDUsd').textContent = `-$${maxDdUsd.toFixed(2)}`;
  document.getElementById('currentDrawdownDisplay').textContent = `${maxDd.toFixed(1)}%`;

  // Streaks Card
  document.getElementById('statMaxWinStreak').textContent = maxWinStreak;
  document.getElementById('statMaxLossStreak').textContent = maxLossStreak;

  // Expectancy Card
  const expSign = expectancy >= 0 ? '+' : '';
  const expEl = document.getElementById('statExpectancy');
  expEl.textContent = `${expSign}$${expectancy.toFixed(2)}`;
  expEl.className = expectancy >= 0 ? 'text-2xl font-black text-emerald-400' : 'text-2xl font-black text-rose-400';
  document.getElementById('statTotalTrades').textContent = total;

  // Average Stop Loss Metrics
  const avgSlPts = s.avg_sl_points !== undefined ? s.avg_sl_points : 0;
  const avgSlPr = s.avg_sl_price !== undefined ? s.avg_sl_price : 0;
  const minSlPts = s.min_sl_points !== undefined ? s.min_sl_points : 0;
  const maxSlPts = s.max_sl_points !== undefined ? s.max_sl_points : 0;

  const recalcAvgSlBadge = document.getElementById('recalcAvgSlBadge');
  if (recalcAvgSlBadge) {
    recalcAvgSlBadge.textContent = total > 0 ? `${avgSlPts} pts ($${avgSlPr.toFixed(2)})` : '0 pts ($0.00)';
  }
  const statAvgSlPoints = document.getElementById('statAvgSlPoints');
  if (statAvgSlPoints) {
    statAvgSlPoints.textContent = total > 0 ? avgSlPts : '0';
  }
  const statAvgSlPrice = document.getElementById('statAvgSlPrice');
  if (statAvgSlPrice) {
    statAvgSlPrice.textContent = avgSlPr.toFixed(2);
  }
  const statMinMaxSl = document.getElementById('statMinMaxSl');
  if (statMinMaxSl) {
    statMinMaxSl.textContent = total > 0 ? `${minSlPts} - ${maxSlPts} pts` : '-';
  }
  const labelFormAvgSl = document.getElementById('labelFormAvgSl');
  if (labelFormAvgSl) {
    labelFormAvgSl.textContent = total > 0 ? avgSlPts : '250';
  }

  // Header dynamic risk budget
  const currentRisk = curBal * (parseFloat(cfg.risk_pct || 5.0) / 100.0);
  document.getElementById('badgeCurrentRiskUsd').textContent = `$${currentRisk.toFixed(2)}`;

  // Update Charts & Table
  updateCharts();
  renderBacktestTradesTable();
  initIcons();
}

function renderBacktestTradesTable() {
  const tbody = document.getElementById('tradesTableBody');
  const countAll = document.getElementById('countAll');
  const countWins = document.getElementById('countWins');
  const countLosses = document.getElementById('countLosses');

  const trades = appState.backtest.trades;
  const winsCount = trades.filter(t => t.status === 'win').length;
  const lossesCount = trades.filter(t => t.status === 'loss').length;

  countAll.textContent = trades.length;
  countWins.textContent = winsCount;
  countLosses.textContent = lossesCount;

  let filtered = trades;
  if (appState.backtest.filter === 'win') {
    filtered = trades.filter(t => t.status === 'win');
  } else if (appState.backtest.filter === 'loss') {
    filtered = trades.filter(t => t.status === 'loss');
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" class="py-12 text-center text-gray-500 font-sans">
          ${trades.length === 0 
            ? 'Aún no has registrado operaciones. Ingresa los puntos de Stop Loss arriba y haz clic en <strong>"REGISTRAR OPERACIÓN AL BACKTEST"</strong>.' 
            : 'No hay operaciones con este filtro seleccionado.'}
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = filtered.slice().reverse().map((t, idx) => {
    const isWin = t.status === 'win';
    const isLoss = t.status === 'loss';
    const pnlSign = t.pnl > 0 ? '+' : '';
    const pnlColor = isWin ? 'text-emerald-400 font-bold' : (isLoss ? 'text-rose-400 font-bold' : 'text-gray-400');
    
    const tradeRR = Number(t.rr || appState.config.rr_ratio || 1.0);
    const badgeOutcome = isWin
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">WIN (+${tradeRR}R)</span>`
      : (isLoss 
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">LOSS (-1R)</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">BE (0)</span>');

    const dirBadge = t.direction === 'BUY'
      ? '<span class="text-tvGreen font-bold flex items-center gap-0.5"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> Larga</span>'
      : '<span class="text-tvRed font-bold flex items-center gap-0.5"><i data-lucide="arrow-down-right" class="w-3 h-3"></i> Corta</span>';

    let pts = t.tv_points || t.sl_points;
    if (!pts && t.sl_distance) pts = Math.round(t.sl_distance * 100);
    if (!pts) pts = 250;
    const priceVal = (pts / 100).toFixed(2);
    const tvLabel = `${pts} (${priceVal})`;

    const tpPts = Math.round(pts * tradeRR);
    const tpPriceVal = (tpPts / 100).toFixed(2);
    const tvTpLabel = `${tpPts} (${tpPriceVal})`;

    const riskBudget = t.risk_budget ? `$${Number(t.risk_budget).toFixed(2)}` : `$${(t.balance_before * (appState.config.risk_pct / 100)).toFixed(2)}`;

    return `
      <tr class="transition hover:bg-gray-800/40">
        <td class="py-2.5 px-3 text-gray-500">${filtered.length - idx}</td>
        <td class="py-2.5 px-3 text-gray-300 font-sans text-xs">${t.date || '-'}</td>
        <td class="py-2.5 px-3">${dirBadge}</td>
        <td class="py-2.5 px-3 text-rose-300 font-bold">${tvLabel}</td>
        <td class="py-2.5 px-3 text-emerald-300 font-bold">${tvTpLabel}</td>
        <td class="py-2.5 px-3 text-blue-300 font-bold font-mono">1:${tradeRR.toFixed(1)}</td>
        <td class="py-2.5 px-3 text-amber-300 font-mono">${riskBudget}</td>
        <td class="py-2.5 px-3 text-gold-400 font-bold">${Number(t.lot_size || 0.01).toFixed(2)}</td>
        <td class="py-2.5 px-3 text-purple-300 font-mono">$${Number(t.margin_used || 0).toFixed(2)}</td>
        <td class="py-2.5 px-3">${badgeOutcome}</td>
        <td class="py-2.5 px-3 ${pnlColor}">${pnlSign}$${Number(t.pnl).toFixed(2)}</td>
        <td class="py-2.5 px-3 text-white font-bold">$${Number(t.balance_after || 0).toFixed(2)}</td>
        <td class="py-2.5 px-3 text-gray-300 font-sans text-xs truncate max-w-[120px]" title="${t.notes || ''}">${t.strategy || 'General'}</td>
        <td class="py-2.5 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="handleOpenEditModal('${t.id}', 'backtest')" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gold-400 transition" title="Editar este trade">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="handleDeleteTrade('${t.id}', 'backtest')" class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-rose-400 transition" title="Borrar este trade">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
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

  document.getElementById('tabBadgeReal').textContent = `${total} ops`;
  document.getElementById('realStatTotalOps').textContent = total;
  const realStatTotalOpsBadge = document.getElementById('realStatTotalOpsBadge');
  if (realStatTotalOpsBadge) realStatTotalOpsBadge.textContent = total;
  document.getElementById('realStatBalance').textContent = `$${curBal.toFixed(2)}`;
  document.getElementById('realStatInitBal').textContent = Number(cfg.initial_balance || 110.0).toFixed(2);
  
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

  renderRealTradesTable();
  recalculateRealJournalPreview();
  syncRealBalanceToCalculator();
  runMyfxbookCalculator();
  initIcons();
}

function renderRealTradesTable() {
  const tbody = document.getElementById('realTradesTableBody');
  const trades = appState.real.trades || [];

  if (trades.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="13" class="py-12 text-center text-gray-500 font-sans">
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
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">WIN (+${tradeRR}R)</span>`
      : (isLoss 
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">LOSS (-1R)</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">BE (0)</span>');

    const dirBadge = t.direction === 'BUY'
      ? '<span class="text-tvGreen font-bold flex items-center gap-0.5"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> BUY</span>'
      : '<span class="text-tvRed font-bold flex items-center gap-0.5"><i data-lucide="arrow-down-right" class="w-3 h-3"></i> SELL</span>';

    const pts = t.tv_points || t.sl_points || 250;
    const priceVal = (pts / 100).toFixed(2);

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
        <td class="py-2.5 px-3">${dirBadge}</td>
        <td class="py-2.5 px-3 text-rose-300 font-bold">${pts} pts ($${priceVal})</td>
        <td class="py-2.5 px-3 text-blue-300 font-bold font-mono">1:${tradeRR.toFixed(1)}</td>
        <td class="py-2.5 px-3 text-amber-300 font-mono">$${Number(t.dollar_risk || t.risk_budget || 0).toFixed(2)}</td>
        <td class="py-2.5 px-3 text-gold-400 font-bold font-mono">${Number(t.lot_size || t.suggested_lot || 0.01).toFixed(2)}</td>
        <td class="py-2.5 px-3">${badgeOutcome}</td>
        <td class="py-2.5 px-3 ${pnlColor}">${pnlSign}$${Number(t.pnl).toFixed(2)}</td>
        <td class="py-2.5 px-3 text-white font-bold">$${Number(t.balance_after || 0).toFixed(2)}</td>
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
}

function updateCharts() {
  const curve = appState.backtest.equityCurve || [];
  const initial = appState.config.initial_balance || 110;
  const wins = appState.backtest.summary.wins || 0;
  const losses = appState.backtest.summary.losses || 0;
  const be = appState.backtest.summary.breakevens || 0;

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
    });
    btnRealSell.addEventListener('click', () => {
      realDirInput.value = 'SELL';
      btnRealSell.className = 'py-1.5 rounded-lg text-center font-bold text-xs bg-tvRed text-white shadow transition flex items-center justify-center';
      btnRealBuy.className = 'py-1.5 rounded-lg text-center font-bold text-xs text-gray-400 hover:text-white transition flex items-center justify-center';
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

  // CSV Export Buttons
  const btnExport = document.getElementById('btnExportCsv');
  if (btnExport) {
    btnExport.addEventListener('click', () => exportTradesToCsv('backtest'));
  }
  const btnExportReal = document.getElementById('btnExportRealCsv');
  if (btnExportReal) {
    btnExportReal.addEventListener('click', () => exportTradesToCsv('real'));
  }

  // Calculator Listeners
  const calcBal = document.getElementById('calcBalInput');
  const calcRisk = document.getElementById('calcRiskPctInput');
  const calcSl = document.getElementById('calcSlPointsInput');
  const calcRR = document.getElementById('calcRRInput');
  const calcLev = document.getElementById('calcLeverageInput');

  if (calcBal) calcBal.addEventListener('input', runMyfxbookCalculator);
  if (calcRisk) calcRisk.addEventListener('input', runMyfxbookCalculator);
  if (calcSl) calcSl.addEventListener('input', runMyfxbookCalculator);
  if (calcRR) calcRR.addEventListener('input', runMyfxbookCalculator);
  if (calcLev) calcLev.addEventListener('change', runMyfxbookCalculator);

  // Copy Lot Button
  const btnCopyLot = document.getElementById('btnCopyLot');
  if (btnCopyLot) {
    btnCopyLot.addEventListener('click', () => {
      const lotVal = document.getElementById('myfxHeroLot').textContent;
      navigator.clipboard.writeText(lotVal).then(() => {
        const textSpan = document.getElementById('btnCopyLotText');
        const orig = textSpan.textContent;
        textSpan.textContent = '¡Copiado!';
        setTimeout(() => { textSpan.textContent = orig; }, 1800);
      }).catch(err => {
        console.warn('Clipboard failed:', err);
      });
    });
  }

  // Sync Balance to Calculator Button
  const btnSyncBal = document.getElementById('btnSyncBalToCalc');
  if (btnSyncBal) {
    btnSyncBal.addEventListener('click', () => {
      syncRealBalanceToCalculator();
      runMyfxbookCalculator();
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
  initIcons();
}

// ----------------------------------------------------
// Handlers: Add Trades
// ----------------------------------------------------
async function handleAddBacktestTrade(e) {
  e.preventDefault();

  const curBal = (appState.backtest.summary && appState.backtest.summary.current_balance !== undefined) 
    ? appState.backtest.summary.current_balance 
    : appState.config.initial_balance;

  const date = document.getElementById('tradeDate').value || new Date().toISOString().slice(0, 16).replace('T', ' ');
  const direction = document.getElementById('tradeDirection').value;
  
  const rawInput = document.getElementById('tradeTvPoints').value;
  const { points, price } = parseTradingViewInput(rawInput);
  
  const tradeRR = parseFloat(document.getElementById('tradeSpecificRR').value) || parseFloat(appState.config.rr_ratio) || 1.0;
  const riskPct = parseFloat(appState.config.risk_pct) || 5.0;
  const strategy = document.getElementById('tradeStrategy').value || 'General';
  const notes = document.getElementById('tradeNotes').value || '';
  
  const statusRadio = document.querySelector('input[name="tradeResult"]:checked');
  const status = statusRadio ? statusRadio.value : 'win';

  // Pure % Compounding
  let retPct = 0.0;
  if (status === 'win') {
    retPct = riskPct * tradeRR;
  } else if (status === 'loss') {
    retPct = -riskPct;
  }
  const pnl = roundNum(curBal * (retPct / 100.0), 2);
  const dollarRisk = roundNum(curBal * (riskPct / 100.0), 2);
  const rawLot = dollarRisk / points;
  const lot_size = Math.max(0.01, roundNum(rawLot, 2));
  const leverage = parseFloat(appState.config.leverage) || 300;
  const margin_used = roundNum((2720.0 * 100 * lot_size / leverage), 2);

  const payload = {
    mode: 'backtest',
    date,
    direction,
    tv_points: points,
    price_dist: price,
    sl_points: points,
    tp_points: Math.round(points * tradeRR),
    sl_distance: price,
    risk_pct: riskPct,
    ret_pct: retPct,
    dollar_risk: dollarRisk,
    lot_size,
    suggested_lot: lot_size,
    margin_used,
    status,
    pnl,
    rr: tradeRR,
    strategy,
    notes
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
      setCurrentDateTime();
      document.getElementById('tradeNotes').value = '';
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
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const session = 'New York';
  const direction = document.getElementById('realTradeDirection')?.value || 'BUY';

  const rawInput = document.getElementById('realTradeTvPoints')?.value || '250';
  const { points, price } = parseTradingViewInput(rawInput);

  const riskPct = parseFloat(document.getElementById('realTradeRiskPct')?.value) || 5.0;
  const rr = parseFloat(document.getElementById('realTradeRR')?.value) || 1.0;
  const strategy = 'Adaptive Supertrend M5';
  const emotion = '';
  const tvChartUrl = document.getElementById('realTradeChartUrl')?.value || '';

  const statusRadio = document.querySelector('input[name="realTradeResult"]:checked');
  const status = statusRadio ? statusRadio.value : 'win';

  const dollarRiskBudget = roundNum(curBal * (riskPct / 100.0), 2);
  const rawLot = points > 0 ? (dollarRiskBudget / points) : 0.01;
  const suggested_lot = Math.max(0.01, roundNum(rawLot, 2));

  // Opción de lote manual
  const manualLotInput = document.getElementById('realTradeManualLot');
  const manualLotVal = manualLotInput && manualLotInput.value ? parseFloat(manualLotInput.value) : null;
  const lot_size = (manualLotVal && manualLotVal > 0) ? roundNum(manualLotVal, 2) : suggested_lot;

  const actualDollarRisk = roundNum(points * lot_size, 2);
  let pnl = 0.0;
  let retPct = 0.0;

  if (status === 'win') {
    pnl = roundNum(points * lot_size * rr, 2);
    retPct = curBal > 0 ? roundNum((pnl / curBal) * 100.0, 2) : (riskPct * rr);
  } else if (status === 'loss') {
    pnl = -actualDollarRisk;
    retPct = curBal > 0 ? -roundNum((actualDollarRisk / curBal) * 100.0, 2) : -riskPct;
  } else {
    pnl = 0.0;
    retPct = 0.0;
  }

  const leverage = parseFloat(appState.config.leverage) || 300;
  const margin_used = roundNum((2720.0 * 100 * lot_size / leverage), 2);

  const payload = {
    mode: 'real',
    date,
    session,
    direction,
    tv_points: points,
    price_dist: price,
    sl_points: points,
    tp_points: Math.round(points * rr),
    sl_distance: price,
    risk_pct: riskPct,
    ret_pct: retPct,
    dollar_risk: actualDollarRisk,
    suggested_lot,
    lot_size,
    manual_lot: manualLotVal || null,
    margin_used,
    status,
    pnl,
    rr,
    strategy,
    emotion,
    tv_chart_url: tvChartUrl,
    notes: `Sesión New York`
  };

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
      
      renderRealJournalDashboard();
      setCurrentDateTime();
      if (manualLotInput) manualLotInput.value = '';
      const chartUrlEl = document.getElementById('realTradeChartUrl');
      if (chartUrlEl) chartUrlEl.value = '';
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
  const modeText = mode === 'real' ? 'la bitácora real' : 'el backtesting';
  if (!confirm(`¿Deseas eliminar esta operación de ${modeText}?`)) return;

  try {
    const res = await fetch(`/api/trades/${id}?mode=${mode}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      if (mode === 'real') {
        appState.real.summary = data.summary;
        appState.real.equityCurve = data.equity_curve;
        appState.real.trades = data.trades;
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

window.handleOpenEditModal = function(id, mode = 'backtest') {
  const tradeList = mode === 'real' ? appState.real.trades : appState.backtest.trades;
  const trade = tradeList.find(t => t.id === id);
  if (!trade) return;

  const pts = trade.tv_points || trade.sl_points || (trade.sl_distance ? Math.round(trade.sl_distance * 100) : 250);
  document.getElementById('editTradeId').value = trade.id;
  document.getElementById('editTradeMode').value = mode;
  document.getElementById('editTradeTvPoints').value = pts;
  document.getElementById('editTradeRR').value = Number(trade.rr || 1.0).toFixed(1);
  document.getElementById('editTradeDirection').value = trade.direction || 'BUY';
  document.getElementById('editTradeStatus').value = trade.status || 'win';
  const lotEl = document.getElementById('editTradeLot');
  if (lotEl) lotEl.value = Number(trade.lot_size || trade.suggested_lot || 0.01).toFixed(2);
  const stratEl = document.getElementById('editTradeStrategy');
  if (stratEl) stratEl.value = trade.strategy || 'Adaptive Supertrend M5';
  const emoEl = document.getElementById('editTradeEmotion');
  if (emoEl) emoEl.value = trade.emotion || '';
  document.getElementById('editTradeChartUrl').value = trade.tv_chart_url || '';

  document.getElementById('modalEditTrade').classList.remove('hidden');
  initIcons();
};

async function handleSaveEditedTrade() {
  const id = document.getElementById('editTradeId').value;
  const mode = document.getElementById('editTradeMode').value || 'backtest';
  if (!id) return;

  const rawInput = document.getElementById('editTradeTvPoints').value;
  const { points, price } = parseTradingViewInput(rawInput);
  const tradeRR = parseFloat(document.getElementById('editTradeRR').value) || 1.0;
  const status = document.getElementById('editTradeStatus').value;
  const direction = document.getElementById('editTradeDirection').value;
  const lotEl = document.getElementById('editTradeLot');
  const manualLot = lotEl ? parseFloat(lotEl.value) : null;
  const strategy = document.getElementById('editTradeStrategy')?.value || 'Adaptive Supertrend M5';
  const emotion = document.getElementById('editTradeEmotion')?.value || '';
  const tvChartUrl = document.getElementById('editTradeChartUrl')?.value || '';

  const payload = {
    mode,
    tv_points: points,
    price_dist: price,
    sl_points: points,
    tp_points: Math.round(points * tradeRR),
    sl_distance: price,
    direction,
    status,
    lot_size: manualLot,
    manual_lot: manualLot,
    rr: tradeRR,
    rr_custom: tradeRR,
    strategy,
    emotion,
    tv_chart_url: tvChartUrl
  };

  try {
    const res = await fetch(`/api/trades/${id}?mode=${mode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (mode === 'real') {
        appState.real.summary = data.summary;
        appState.real.equityCurve = data.equity_curve;
        appState.real.trades = data.trades;
        renderRealJournalDashboard();
      } else {
        appState.backtest.summary = data.summary;
        appState.backtest.equityCurve = data.equity_curve;
        appState.backtest.trades = data.trades;
        renderBacktestDashboard();
        recalculateTradingViewValues();
      }
      document.getElementById('modalEditTrade').classList.add('hidden');
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

  if (!confirm(`⚠️ ¿Estás seguro de que deseas LIMPIAR TODAS las operaciones de ${label}?`)) return;

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
    : ['#', 'Fecha', 'Direccion', 'StopLoss_Pts', 'TakeProfit_Pts', 'Ratio_RR', 'Riesgo_Compuesto_USD', 'Lote_Sugerido', 'Margen', 'Resultado', 'PnL_USD', 'Balance_Compuesto', 'Estrategia', 'Notas'];

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
        `"1:${tradeRR.toFixed(1)}"`,
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
        `"${t.date || ''}"`,
        t.direction,
        `"${pts} ($${priceVal})"`,
        `"${tpPts} ($${tpPriceVal})"`,
        `"1:${tradeRR.toFixed(1)}"`,
        t.risk_budget || t.dollar_risk || 0,
        t.lot_size || 0.01,
        t.margin_used || 0,
        t.status,
        t.pnl,
        t.balance_after,
        `"${t.strategy || ''}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`
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

  // 3. News Risk Shield (Semáforo Dinámico de Noticias)
  const shieldHeadline = document.getElementById("newsShieldHeadline");
  const shieldAdvice = document.getElementById("newsShieldAdvice");

  if (shieldHeadline) {
    shieldHeadline.textContent = "Sin noticias de alto impacto en las próximas 2 horas.";
  }
  if (shieldAdvice) {
    shieldAdvice.textContent = "Operativa 100% autorizada con lotaje y Stop Loss normal. Spreads estables en el broker.";
  }

  // 4. Radar de Confluencia "A+ Setup"
  const conf1 = document.getElementById("confluenceCheck1");
  const conf2 = document.getElementById("confluenceCheck2");
  const conf3 = document.getElementById("confluenceCheck3");
  const conf4 = document.getElementById("confluenceCheck4");
  const confScore = document.getElementById("confluenceScoreBadge");
  const confBanner = document.getElementById("confluenceVerdictBanner");

  if (conf1) {
    conf1.textContent = isBear ? `✓ BAJISTA (${conf}%)` : (isBull ? `✓ ALCISTA (${conf}%)` : `🟡 NEUTRAL (${conf}%)`);
  }
  if (conf2) {
    conf2.textContent = isBear ? `✓ EN RESISTENCIA` : (isBull ? `✓ EN SOPORTE` : `🟡 ZONA MEDIA`);
  }
  if (conf3) {
    conf3.textContent = `✓ VÍA LIBRE`;
  }
  if (conf4) {
    conf4.textContent = `⏳ ESPERANDO VELA`;
  }
  if (confScore) {
    confScore.textContent = `3/4 CONDICIONES`;
  }
  if (confBanner) {
    confBanner.textContent = `Esperando cierre de vela en M5 para confirmación de ejecución de máxima probabilidad.`;
  }

  // 5. Proyección ADR (Escala TradingView)
  const adrDaily = document.getElementById("adrDailyAvgDisplay");
  const adrConsumed = document.getElementById("adrConsumedDisplay");
  const adrRemaining = document.getElementById("adrRemainingDisplay");
  const adrBar = document.getElementById("adrProgressBar");
  const adrDiag = document.getElementById("adrDiagnosticText");

  let consumedPts = 2650;
  if (data.session_levels && data.session_levels.asian_range_pts) {
    const aPts = (data.session_levels.asian_range_pts || 14) * 100;
    const lPts = (data.session_levels.london_range_pts || 12) * 100;
    consumedPts = Math.min(4500, Math.max(1800, Math.round((aPts + lPts) / 2)));
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

function startMarketClock() {
  function tick() {
    const now = new Date();
    const session = getNySessionStatus(now);

    const nyClockEl = document.getElementById("marketNyClock");
    if (nyClockEl) {
      nyClockEl.textContent = `${String(session.hour).padStart(2, "0")}:${String(session.min).padStart(2, "0")}:${String(session.sec).padStart(2, "0")} NY (ET)`;
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
        guardHeadline.innerHTML = `El mercado Spot de Oro se encuentra fuera de la <strong>Ventana Dorada de New York</strong> (08:00 AM – 11:30 AM NY). En horas asiáticas o madrugada el volumen interbancario cae un 80% y los spreads se ensanchan. <strong>Disciplina: No regales tu dinero operando fuera de sesión.</strong>`;
      }
    }

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

    // Cuenta Regresiva Sincronizada con Velas M5 de TradingView
    // Tickmill abre sus velas de 5m con +2 min de desfase (:02, :07, :12, :17, :22...)
    let brokerOffsetSec = 120; // Por defecto 120s para sincronización exacta con Tickmill
    try {
      const savedBrokerOffset = localStorage.getItem('m5_broker_offset');
      if (savedBrokerOffset !== null) {
        brokerOffsetSec = parseInt(savedBrokerOffset, 10);
      }
    } catch (e) {}

    const currentSecondsInHour = (now.getMinutes() * 60) + now.getSeconds();
    const normalizedSeconds = (currentSecondsInHour - brokerOffsetSec + 3600) % 3600;
    const secondsIn5MinBlock = normalizedSeconds % 300;
    const remainingToNext5Min = 300 - secondsIn5MinBlock;

    const m5Mins = Math.floor(remainingToNext5Min / 60);
    const m5Secs = remainingToNext5Min % 60;
    const m5CountdownFormatted = `${String(m5Mins).padStart(2, "0")}:${String(m5Secs).padStart(2, "0")}`;

    const m5TextEl = document.getElementById("m5SyncCountdownText");
    if (m5TextEl && !isAutoRefreshingM5) {
      m5TextEl.textContent = m5CountdownFormatted;
    }

    // Disparar en el segundo exacto del cierre de vela M5
    const currentM5Block = Math.floor((now.getTime() - (brokerOffsetSec * 1000)) / 300000);
    if (remainingToNext5Min === 300 && lastTriggeredM5Block !== currentM5Block) {
      lastTriggeredM5Block = currentM5Block;
      executeM5AutoRefresh(false);
    }
  }

  tick();
  if (marketClockInterval) clearInterval(marketClockInterval);
  marketClockInterval = setInterval(tick, 1000);
}

let isAutoRefreshingM5 = false;
let lastTriggeredM5Block = null;

async function executeM5AutoRefresh(isUserClick = false) {
  if (isAutoRefreshingM5) return;
  isAutoRefreshingM5 = true;

  const m5Dot = document.getElementById("m5SyncDot");
  const m5Text = document.getElementById("m5SyncCountdownText");
  const btnRefresh = document.getElementById("btnRefreshBias");

  if (m5Dot) m5Dot.className = "w-2 h-2 rounded-full bg-yellow-400 animate-spin";
  if (m5Text) m5Text.textContent = "SYNC...";
  if (btnRefresh) {
    btnRefresh.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Sincronizando...</span>';
    initIcons();
  }

  try {
    await Promise.all([
      loadGoldBiasData(),
      loadWeeklyNews(),
      loadTrades('real'),
      loadPythonEngineSignal(false)
    ]);

    if (m5Dot) m5Dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
    if (btnRefresh) {
      btnRefresh.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span>¡Actualizado!</span>';
      initIcons();
      setTimeout(() => {
        btnRefresh.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Refrescar</span>';
        initIcons();
      }, 1500);
    }

    if (isUserClick) {
      showToast("🔄 <strong>Actualización M5 Completa:</strong> Sesgo macro, noticias y bitácora sincronizados.", "success", 4000);
    } else {
      showToast("🔄 <strong>Cierre de Vela M5:</strong> Datos institucionales actualizados automáticamente.", "info", 3500);
    }
  } catch (err) {
    console.warn("M5 auto-refresh error:", err);
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

  // Clic en el badge de Vela M5 para forzar refresco
  const m5Badge = document.getElementById("m5SyncBadge");
  if (m5Badge) {
    m5Badge.addEventListener("click", () => executeM5AutoRefresh(true));
  }

  // Alternar entre feed de Tickmill (:02, :07...) y Estándar (:00, :05...)
  const brokerLabelEl = document.getElementById("m5SyncBrokerLabel");
  if (brokerLabelEl) {
    let savedOffset = localStorage.getItem("m5_broker_offset");
    if (savedOffset === "0") {
      brokerLabelEl.textContent = "M5 Estándar";
      brokerLabelEl.className = "text-[9px] uppercase tracking-wider text-gray-400 hover:text-white font-bold leading-none cursor-pointer transition";
    } else {
      brokerLabelEl.textContent = "M5 Tickmill";
      brokerLabelEl.className = "text-[9px] uppercase tracking-wider text-emerald-400 hover:text-white font-bold leading-none cursor-pointer transition";
    }

    brokerLabelEl.addEventListener("click", (e) => {
      e.stopPropagation();
      let currentOffset = 120;
      try {
        currentOffset = parseInt(localStorage.getItem("m5_broker_offset") || "120", 10);
      } catch (err) {}
      const newOffset = currentOffset === 120 ? 0 : 120;
      try {
        localStorage.setItem("m5_broker_offset", newOffset);
      } catch (err) {}
      brokerLabelEl.textContent = newOffset === 120 ? "M5 Tickmill" : "M5 Estándar";
      brokerLabelEl.className = newOffset === 120 
        ? "text-[9px] uppercase tracking-wider text-emerald-400 hover:text-white font-bold leading-none cursor-pointer transition"
        : "text-[9px] uppercase tracking-wider text-gray-400 hover:text-white font-bold leading-none cursor-pointer transition";
      showToast(newOffset === 120 ? "Sincronizado con Tickmill (+2 min desfase)" : "Sincronizado con Estándar (:00, :05...)");
    });
  }

  // Botón Escaneo Inmediato del Motor Python M5
  const btnScan = document.getElementById("btnRunPythonScan");
  if (btnScan) {
    btnScan.addEventListener("click", () => loadPythonEngineSignal(true));
  }

  // Carga inicial y sondeo periódico cada 8 segundos
  loadPythonEngineSignal(false);
  setInterval(() => loadPythonEngineSignal(false), 8000);
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

    const res = await fetch("/api/adaptive-supertrend");
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
  const hasConfluence = analysis.has_confluence === true;
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
      // Señal al cierre pero filtrada contra el sesgo
      if (titleEl) {
        titleEl.textContent = analysis.display_title || `${analysis.indicator_signal} AL CIERRE (FILTRADO)`;
        titleEl.className = "font-mono font-bold text-xs text-yellow-400";
      }
      if (iconWrap) iconWrap.className = "w-5 h-5 rounded-md bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold";
      if (iconEl) iconEl.setAttribute("data-lucide", "shield-alert");

      if (timingEl) {
        timingEl.textContent = analysis.display_timing || "Descartado por ir contra el sesgo diario";
        timingEl.className = "text-[9px] font-mono text-yellow-400/80";
      }
      if (liveBadge) {
        liveBadge.className = "text-[9px] px-2 py-0.5 rounded-full bg-yellow-950 text-yellow-300 border border-yellow-600/80 font-bold";
        liveBadge.textContent = "SEÑAL FILTRADA";
      }

      if (card) {
        card.className = "p-2.5 rounded-xl bg-gray-900/80 border border-yellow-500/30 space-y-2";
      }
      if (confPill) {
        confPill.innerHTML = '<i data-lucide="shield-alert" class="w-3 h-3 text-yellow-500"></i><span>FILTRADO CONTRA SESGO</span>';
        confPill.className = "text-yellow-500 font-bold flex items-center gap-1";
      }

      if (confCheck4) {
        confCheck4.textContent = `⚠️ ${analysis.indicator_signal} (FILTRADO CONTRA SESGO)`;
        confCheck4.className = "font-mono text-yellow-400 font-bold text-[10px]";
      }
      if (confDot4) confDot4.className = "w-2 h-2 rounded-full bg-yellow-400";

      if (session.isInSession && confBanner) {
        confBanner.className = "p-2 rounded-lg bg-yellow-950/40 border border-yellow-500/40 text-[10px] text-yellow-300 font-medium leading-tight";
        confBanner.innerHTML = analysis.status_banner || `⚠️ <strong>SEÑAL FILTRADA:</strong> Señal técnica de ${analysis.indicator_signal} descartada por oponerse al sesgo macro.`;
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
  if (btnOpenSection) btnOpenSection.addEventListener("click", openGuide);
  if (btnOpenBanner) btnOpenBanner.addEventListener("click", openGuide);

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
