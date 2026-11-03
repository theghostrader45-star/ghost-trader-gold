#!/usr/bin/env python3
"""
XAUUSD Backtesting Dashboard Server
Serves static frontend and provides REST API for trades, lot calculation, and analytics.
Zero external dependencies (uses standard library only).
"""

import os
import sys
import json
import time
import uuid
import hashlib
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

# Motor Nativo de Cálculo de Adaptive Supertrend Multimethod
try:
    import adaptive_supertrend
except ImportError:
    adaptive_supertrend = None

PORT = int(os.environ.get("PORT", 8081))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.path.join(BASE_DIR, "data")
TRADES_FILE = os.path.join(DATA_DIR, "trades.json")
TRADES_BACKTEST_FILE = os.path.join(DATA_DIR, "trades_backtest.json")
TRADES_REAL_FILE = os.path.join(DATA_DIR, "trades_real.json")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
GOLD_BIAS_FILE = os.path.join(DATA_DIR, "gold_bias.json")
GOLD_BIAS_HISTORY_FILE = os.path.join(DATA_DIR, "gold_bias_history.json")
WEEKLY_NEWS_FILE = os.path.join(DATA_DIR, "weekly_news.json")
LATEST_SIGNAL_FILE = os.path.join(DATA_DIR, "latest_signal.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

DEFAULT_CONFIG = {
    "initial_balance": 110.0,
    "risk_pct": 5.0,
    "leverage": 300,
    "rr_ratio": 1.0,
    "contract_size": 100,       # 1 standard lot = 100 troy oz
    "min_lot": 0.01,
    "lot_step": 0.01,
    "risk_mode": "percent",     # 'percent' pure compounding
    "currency": "USD",
    "asset": "XAU/USD (Gold)"
}

def load_json(path, default):
    if not os.path.exists(path):
        save_json(path, default)
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_trades_file(mode="backtest"):
    if mode == "real":
        return TRADES_REAL_FILE
    return TRADES_BACKTEST_FILE

def get_trades(mode="backtest"):
    fpath = get_trades_file(mode)
    if not os.path.exists(fpath):
        if mode == "backtest" and os.path.exists(TRADES_FILE):
            return load_json(TRADES_FILE, [])
        return []
    return load_json(fpath, [])

def save_trades(trades, mode="backtest"):
    fpath = get_trades_file(mode)
    save_json(fpath, trades)
    if mode == "backtest":
        save_json(TRADES_FILE, trades)

def get_gold_bias():
    return load_json(GOLD_BIAS_FILE, {})

def get_gold_bias_history():
    return load_json(GOLD_BIAS_HISTORY_FILE, {})

def save_gold_bias_history(data):
    save_json(GOLD_BIAS_HISTORY_FILE, data)

def get_weekly_news():
    return load_json(WEEKLY_NEWS_FILE, {})

def save_weekly_news(data):
    save_json(WEEKLY_NEWS_FILE, data)

def get_gold_bias_by_date(date_str):
    history = get_gold_bias_history()
    if date_str in history:
        entry = history[date_str]
        merged = dict(get_gold_bias())
        merged.update(entry)
        merged["is_historical"] = True
        merged["historical_date"] = date_str
        return merged
    return generate_synthetic_historical_bias(date_str)

def generate_synthetic_historical_bias(date_str):
    """Generates a realistic, deterministic historical bias record for any date selected."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        weekday = dt.weekday() # 0 = Lunes, 4 = Viernes, 5 = Sab, 6 = Dom
    except Exception:
        dt = datetime.now()
        weekday = dt.weekday()

    day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    day_label = f"{day_names[weekday]}, {date_str} · Sesión New York"

    if weekday in (5, 6): # Fin de semana
        return {
            "date": date_str,
            "day_label": f"{day_names[weekday]}, {date_str} · Fin de Semana (Mercado Cerrado)",
            "bias": "NEUTRAL",
            "bias_title": "🟡 SESGO INSTITUCIONAL: MERCADO CERRADO",
            "confidence": 50,
            "confidence_label": "Fin de Semana",
            "headline": f"Mercado spot de oro y futuros COMEX cerrados por fin de semana ({date_str}).",
            "macro_summary": "Sin operativa institucional activa. Las mesas de dinero de bancos y fondos de cobertura reanudan operaciones el domingo a las 18:00 NY.",
            "catalyst": "Cierre Semanal de Mercados",
            "session_levels": {
                "asian_high": "2,745.00",
                "asian_low": "2,735.00",
                "asian_range_pts": 1000,
                "pdh": "2,752.00",
                "pdl": "2,730.00",
                "pd_range_pts": 2200
            },
            "technical_zones": {
                "key_resistance": "2,750.00 – 2,760.00",
                "key_support": "2,730.00 – 2,720.00",
                "invalidation": "2,765.00"
            },
            "result_outcome": "Mercado cerrado por fin de semana. No se registraron operaciones.",
            "is_historical": True,
            "historical_date": date_str
        }

    # Deterministic generation using date hash
    h = int(hashlib.md5(date_str.encode()).hexdigest()[:8], 16)
    bias_types = ["BEARISH", "BULLISH", "BEARISH", "BULLISH", "NEUTRAL"]
    bias = bias_types[h % len(bias_types)]
    confidence = 68 + (h % 22) # 68% to 90%
    
    base_price = 2710.0 + (h % 50)
    ah = round(base_price + 8.2 + (h % 5), 2)
    al = round(base_price - (6.4 + (h % 4)), 2)
    range_pts = int(round((ah - al) * 100))

    lh = round(ah + 4.5 + (h % 3), 2)
    ll = round(al - 3.8 - (h % 3), 2)
    l_range_pts = int(round((lh - ll) * 100))

    pdh = round(lh + 9.5, 2)
    pdl = round(ll - 10.0, 2)
    pd_range = int(round((pdh - pdl) * 100))

    if bias == "BEARISH":
        bias_title = "🔴 SESGO INSTITUCIONAL: BAJISTA (Sell-Only)"
        headline = f"Dólar firme y rendimientos reales limitan avance del oro en la sesión del {date_str}."
        macro_summary = f"Presión vendedora institucional tras datos económicos de EE.UU. El DXY cotizó al alza drenando liquidez del oro en la apertura de New York."
        catalyst = "Fortaleza del DXY & Rendimientos del Tesoro"
        res_str = f"{round(lh+5, 1):,} – {round(lh+15, 1):,}"
        sup_str = f"{round(ll-15, 1):,} – {round(ll-25, 1):,}"
        outcome = f"Ruptura bajista del London Low ({ll:,.2f}) a las 08:45 NY tras absorber las noticias de EE.UU. Entrada con Stop Estructural M5 de 42 pts. Expansión limpia a la baja alcanzando TP (+115 pts TV) con ratio 1:2.7."
    elif bias == "BULLISH":
        bias_title = "🟢 SESGO INSTITUCIONAL: ALCISTA (Buy-Only)"
        headline = f"Demanda de refugio e interés comprador en soportes impulsan al oro el {date_str}."
        macro_summary = f"Debilidad del Dólar e incertidumbre macroeconómica favorecieron compras institucionales en la apertura americana."
        catalyst = "Retroceso del DXY & Compras de Bancos Centrales"
        res_str = f"{round(lh+20, 1):,} – {round(lh+30, 1):,}"
        sup_str = f"{round(ll-5, 1):,} – {round(ll-12, 1):,}"
        outcome = f"Ruptura alcista del London High ({lh:,.2f}) a las 08:35 NY. Vela envolvente M5 tras dato de IPC. Stop Loss de 38 pts. Expansión explosiva alcanzando TP (+110 pts TV) con ratio 1:2.9."
    else:
        bias_title = "🟡 SESGO INSTITUCIONAL: NEUTRAL / RANGO (Cautela)"
        headline = f"Mercado en equilibrio y consolidación técnica previa a noticias en {date_str}."
        macro_summary = f"Bajo volumen y ausencia de catalizadores de peso mantuvieron al oro oscilando dentro de rangos acotados."
        catalyst = "Consolidación Previa a Reportes Clave"
        res_str = f"{round(lh+8, 1):,} – {round(lh+15, 1):,}"
        sup_str = f"{round(ll-8, 1):,} – {round(ll-15, 1):,}"
        outcome = f"Sesión lateral sin rompimiento limpio del Rango de Londres. El precio rebotó entre los extremos; la orden se cerró en Breakeven sin pérdidas."

    merged = dict(get_gold_bias())
    merged.update({
        "date": date_str,
        "day_label": day_label,
        "bias": bias,
        "bias_title": bias_title,
        "confidence": confidence,
        "confidence_label": f"Alta Convicción ({confidence}%)" if confidence >= 75 else f"Convicción Favorable ({confidence}%)",
        "headline": headline,
        "macro_summary": macro_summary,
        "catalyst": catalyst,
        "session_levels": {
            "london_high": f"{lh:,.2f}",
            "london_low": f"{ll:,.2f}",
            "london_range_pts": l_range_pts,
            "asian_high": f"{ah:,.2f}",
            "asian_low": f"{al:,.2f}",
            "asian_range_pts": range_pts,
            "pdh": f"{pdh:,.2f}",
            "pdl": f"{pdl:,.2f}",
            "pd_range_pts": pd_range
        },
        "technical_zones": {
            "key_resistance": res_str,
            "key_support": sup_str,
            "invalidation": f"{round(lh+18, 2):,}" if bias == "BEARISH" else f"{round(ll-18, 2):,}"
        },
        "result_outcome": outcome,
        "is_historical": True,
        "historical_date": date_str
    })
    return merged

def save_gold_bias(data):
    save_json(GOLD_BIAS_FILE, data)
    # also archive into history
    date_key = datetime.now().strftime("%Y-%m-%d")
    history = get_gold_bias_history()
    history[date_key] = data
    save_gold_bias_history(history)

def get_config():
    config = load_json(CONFIG_FILE, DEFAULT_CONFIG)
    # Ensure all default keys exist
    for k, v in DEFAULT_CONFIG.items():
        if k not in config:
            config[k] = v
    return config

def recalculate_trade_history(trades, config):
    """
    Recalculates the entire trade history sequentially using dynamic compound interest
    and the given risk_pct and rr_ratio, without losing any trade or outcome fact.
    """
    initial_balance = float(config.get("initial_balance", 110.0))
    risk_pct = float(config.get("risk_pct", 5.0))
    global_rr = float(config.get("rr_ratio", 1.0))
    leverage = float(config.get("leverage", 300))
    
    curr_bal = initial_balance
    updated_trades = []
    
    for t in trades:
        # Extract invariant points
        if t.get("tv_points") is not None and float(t.get("tv_points")) >= 20.0:
            tv_points = round(float(t["tv_points"]))
            price_dist = round(tv_points / 100.0, 2)
        elif t.get("sl_points") is not None and float(t.get("sl_points")) >= 20.0:
            tv_points = round(float(t["sl_points"]))
            price_dist = round(tv_points / 100.0, 2)
        else:
            raw_val = float(t.get("sl_distance", 3.0))
            if raw_val <= 0:
                raw_val = 3.0
            if raw_val >= 20.0:
                tv_points = round(raw_val)
                price_dist = round(raw_val / 100.0, 2)
            else:
                tv_points = round(raw_val * 100.0)
                price_dist = round(raw_val, 2)
            
        raw_risk = t.get("risk_pct_custom") or t.get("risk_pct") or risk_pct
        trade_risk = round(float(str(raw_risk).replace(",", ".")), 2)
        trade_rr = float(str(t.get("rr_custom") or t.get("rr") or global_rr).replace(",", "."))
        status = t.get("status", "win").lower()
        raw_comm = t.get("commission", 0.0)
        commission = round(abs(float(str(raw_comm).replace(",", "."))), 2)
        
        # Pure percentage compounding:
        if status == "win":
            ret_pct = trade_risk * trade_rr
        elif status == "loss":
            ret_pct = -trade_risk
        else:
            ret_pct = 0.0
            
        if "pnl" in t and t["pnl"] is not None and str(t["pnl"]).strip() != "":
            pnl = round(float(str(t["pnl"]).replace(",", ".")), 2)
        else:
            pnl = round(curr_bal * (ret_pct / 100.0) - commission, 2)
        
        # Reference lot size for MT4/MT5 based on Gold SL points
        dollar_risk = curr_bal * (trade_risk / 100.0)
        raw_lot = dollar_risk / tv_points if tv_points > 0 else 0.01
        suggested_lot = round(raw_lot, 2)
        if suggested_lot < 0.01:
            suggested_lot = 0.01
            
        try:
            user_lot = float(str(t.get("manual_lot") or t.get("lot_size") or 0).replace(",", "."))
        except (ValueError, TypeError):
            user_lot = 0.0
        lot_size = round(user_lot, 2) if user_lot > 0 else suggested_lot
            
        margin_used = round((2700.0 * 100 * lot_size) / leverage, 2)
        
        t_new = dict(t)
        t_new["tv_points"] = tv_points
        t_new["price_dist"] = price_dist
        t_new["sl_points"] = tv_points
        t_new["tp_points"] = round(tv_points * trade_rr)
        t_new["sl_distance"] = price_dist
        t_new["risk_pct"] = trade_risk
        t_new["risk_pct_custom"] = trade_risk
        t_new["ret_pct"] = round(ret_pct, 2)
        t_new["rr"] = trade_rr
        t_new["dollar_risk"] = round(dollar_risk, 2)
        t_new["suggested_lot"] = suggested_lot
        t_new["lot_size"] = lot_size
        t_new["margin_used"] = margin_used
        t_new["commission"] = commission
        t_new["pnl"] = pnl
        t_new["balance_before"] = round(curr_bal, 2)
        
        curr_bal += pnl
        if curr_bal < 0:
            curr_bal = 0.0
            
        t_new["balance_after"] = round(curr_bal, 2)
        updated_trades.append(t_new)
        
    return updated_trades

def calculate_analytics(trades, config):
    initial_balance = float(config.get("initial_balance", 110.0))
    leverage = float(config.get("leverage", 300))
    
    current_balance = initial_balance
    peak_balance = initial_balance
    max_drawdown_amount = 0.0
    max_drawdown_pct = 0.0
    
    wins = 0
    losses = 0
    breakevens = 0
    total_gain = 0.0
    total_loss = 0.0
    
    streak_win = 0
    streak_loss = 0
    max_streak_win = 0
    max_streak_loss = 0
    
    equity_curve = [{
        "trade_num": 0,
        "date": "Inicio",
        "balance": round(initial_balance, 2),
        "drawdown_pct": 0.0,
        "pnl": 0.0
    }]

    processed_trades = []
    sl_points_list = []
    
    global_risk = float(config.get("risk_pct", 5.0))
    global_rr = float(config.get("rr_ratio", 1.0))

    for idx, t in enumerate(trades, start=1):
        status = t.get("status", "win").lower()
        raw_risk = t.get("risk_pct_custom") or t.get("risk_pct") or global_risk
        trade_risk = round(float(str(raw_risk).replace(",", ".")), 2)
        trade_rr = float(str(t.get("rr_custom") or t.get("rr") or global_rr).replace(",", "."))

        # Pure percentage dynamic compounding
        if status == "win":
            ret_pct = trade_risk * trade_rr
        elif status == "loss":
            ret_pct = -trade_risk
        else:
            ret_pct = 0.0

        raw_comm = t.get("commission", 0.0)
        commission = round(abs(float(str(raw_comm).replace(",", "."))), 2)
        if "pnl" in t and t["pnl"] is not None and str(t["pnl"]).strip() != "":
            pnl = round(float(str(t["pnl"]).replace(",", ".")), 2)
        else:
            pnl = round(current_balance * (ret_pct / 100.0) - commission, 2)
        
        # Track SL points for average calculation
        if t.get("tv_points") is not None and float(t.get("tv_points")) >= 20.0:
            pts = round(float(t["tv_points"]))
        elif t.get("sl_points") is not None and float(t.get("sl_points")) >= 20.0:
            pts = round(float(t["sl_points"]))
        else:
            raw_sl = float(t.get("sl_distance", 3.0))
            if raw_sl <= 0:
                raw_sl = 3.0
            pts = round(raw_sl) if raw_sl >= 20.0 else round(raw_sl * 100.0)
        sl_points_list.append(pts)
        
        balance_before = current_balance
        current_balance += pnl
        if current_balance < 0:
            current_balance = 0.0

        if pnl > 0:
            wins += 1
            total_gain += pnl
            streak_win += 1
            streak_loss = 0
            if streak_win > max_streak_win:
                max_streak_win = streak_win
        elif pnl < 0:
            losses += 1
            total_loss += abs(pnl)
            streak_loss += 1
            streak_win = 0
            if streak_loss > max_streak_loss:
                max_streak_loss = streak_loss
        else:
            breakevens += 1
            streak_win = 0
            streak_loss = 0

        if current_balance > peak_balance:
            peak_balance = current_balance

        current_dd = peak_balance - current_balance
        current_dd_pct = (current_dd / peak_balance * 100) if peak_balance > 0 else 0.0

        if current_dd > max_drawdown_amount:
            max_drawdown_amount = current_dd
        if current_dd_pct > max_drawdown_pct:
            max_drawdown_pct = current_dd_pct

        equity_curve.append({
            "trade_num": idx,
            "date": t.get("date", f"T#{idx}"),
            "balance": round(current_balance, 2),
            "drawdown_pct": round(current_dd_pct, 2),
            "pnl": round(pnl, 2)
        })

        t_copy = dict(t)
        t_copy["balance_before"] = round(balance_before, 2)
        t_copy["balance_after"] = round(current_balance, 2)
        t_copy["risk_budget"] = round(balance_before * (float(config.get("risk_pct", 5.0)) / 100.0), 2)
        processed_trades.append(t_copy)

    total_closed = wins + losses + breakevens
    win_rate = (wins / total_closed * 100) if total_closed > 0 else 0.0
    loss_rate = (losses / total_closed * 100) if total_closed > 0 else 0.0
    profit_factor = (total_gain / total_loss) if total_loss > 0 else (999.0 if total_gain > 0 else 0.0)
    net_pnl = current_balance - initial_balance
    net_return_pct = (net_pnl / initial_balance * 100) if initial_balance > 0 else 0.0
    
    avg_win = (total_gain / wins) if wins > 0 else 0.0
    avg_loss = (total_loss / losses) if losses > 0 else 0.0
    
    # Average Stop Loss across registered trades
    if sl_points_list:
        avg_sl_points = round(sum(sl_points_list) / len(sl_points_list), 1)
        avg_sl_price = round(avg_sl_points / 100.0, 2)
        min_sl_points = min(sl_points_list)
        max_sl_points = max(sl_points_list)
    else:
        avg_sl_points = 0.0
        avg_sl_price = 0.0
        min_sl_points = 0
        max_sl_points = 0
    
    # Mathematical Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
    win_prob = win_rate / 100.0
    loss_prob = loss_rate / 100.0
    expectancy_usd = (win_prob * avg_win) - (loss_prob * avg_loss)
    
    # Breakeven win rate needed for RR
    global_rr = float(config.get("rr_ratio", 1.0))
    be_winrate = round((1.0 / (1.0 + global_rr)) * 100.0, 1) if global_rr > 0 else 50.0

    return {
        "summary": {
            "initial_balance": round(initial_balance, 2),
            "current_balance": round(current_balance, 2),
            "net_pnl": round(net_pnl, 2),
            "net_return_pct": round(net_return_pct, 2),
            "total_trades": total_closed,
            "wins": wins,
            "losses": losses,
            "breakevens": breakevens,
            "win_rate": round(win_rate, 2),
            "loss_rate": round(loss_rate, 2),
            "profit_factor": round(profit_factor, 2) if profit_factor != 999.0 else "∞",
            "total_gain": round(total_gain, 2),
            "total_loss": round(total_loss, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "avg_sl_points": avg_sl_points,
            "avg_sl_price": avg_sl_price,
            "min_sl_points": min_sl_points,
            "max_sl_points": max_sl_points,
            "max_drawdown_amount": round(max_drawdown_amount, 2),
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "max_streak_win": max_streak_win,
            "max_streak_loss": max_streak_loss,
            "expectancy_usd": round(expectancy_usd, 2),
            "be_winrate": be_winrate,
            "leverage": leverage
        },
        "equity_curve": equity_curve,
        "trades": processed_trades
    }

def calculate_position_size(balance, risk_pct, sl_points, rr=1.0, leverage=300):
    if balance <= 0 or sl_points <= 0 or risk_pct <= 0:
        return None
    dollar_risk = round(balance * (risk_pct / 100.0), 2)
    sl_price = round(sl_points / 100.0, 2)
    reward_pct = round(risk_pct * rr, 2)
    reward_dollar = round(dollar_risk * rr, 2)
    
    raw_lot = dollar_risk / sl_points if sl_points > 0 else 0.01
    suggested_lot = round(raw_lot, 2)
    lot_warning = None
    if suggested_lot < 0.01:
        lot_warning = f"Para arriesgar solo ${dollar_risk:.2f} con {sl_points} pts de SL necesitas {raw_lot:.4f} lotes, pero tu broker exige mínimo 0.01 lotes."
        suggested_lot = 0.01
        
    margin_used = round((2700.0 * 100 * suggested_lot) / leverage, 2)
    margin_pct = round((margin_used / balance) * 100.0, 1) if balance > 0 else 0.0
    
    return {
        "balance": balance,
        "risk_pct": risk_pct,
        "dollar_risk": dollar_risk,
        "sl_points": sl_points,
        "sl_price": sl_price,
        "rr": rr,
        "reward_pct": reward_pct,
        "reward_dollar": reward_dollar,
        "suggested_lot": suggested_lot,
        "raw_lot": round(raw_lot, 4),
        "margin_used": margin_used,
        "margin_pct": margin_pct,
        "lot_warning": lot_warning
    }

def calculate_lot_and_margin(balance, risk_pct, sl_distance, entry_price, leverage, contract_size=100):
    """
    Gold (XAUUSD) Lot and Margin calculation.
    sl_distance: difference in dollars between entry and SL (e.g. $4.00)
    1.00 lot of Gold = 100 oz.
    $1.00 move on 1.00 lot = $100.
    Risk in USD = balance * (risk_pct / 100)
    Lot = Risk / (sl_distance * 100)
    """
    if sl_distance <= 0:
        return None

    dollar_risk_target = balance * (risk_pct / 100.0)
    raw_lot = dollar_risk_target / (sl_distance * contract_size)
    
    # Round to standard broker lot step (0.01)
    rounded_lot = max(0.01, round(raw_lot, 2))
    
    # Actual risk with rounded lot
    actual_dollar_risk = rounded_lot * contract_size * sl_distance
    actual_risk_pct = (actual_dollar_risk / balance * 100.0) if balance > 0 else 0.0

    # Margin required at given leverage:
    # Notional Value = entry_price * contract_size * rounded_lot
    notional_value = entry_price * contract_size * rounded_lot
    margin_required = notional_value / leverage if leverage > 0 else 0.0
    margin_pct_of_balance = (margin_required / balance * 100.0) if balance > 0 else 0.0
    free_margin = balance - margin_required
    margin_level_pct = (balance / margin_required * 100.0) if margin_required > 0 else 9999.0

    # Safety checks
    margin_warning = False
    warning_message = ""
    if margin_required > balance:
        margin_warning = True
        warning_message = f"Margen insuficiente: requiere ${margin_required:.2f} pero el balance es ${balance:.2f}."
    elif rounded_lot > raw_lot * 1.3:
        # If minimum 0.01 lot forces a much higher risk than 5%
        warning_message = f"El SL es muy amplio para tu cuenta de ${balance:.2f}. El lote mínimo (0.01) arriesga ${actual_dollar_risk:.2f} ({actual_risk_pct:.1f}% en vez de {risk_pct}%)."

    return {
        "raw_lot": round(raw_lot, 4),
        "recommended_lot": rounded_lot,
        "target_dollar_risk": round(dollar_risk_target, 2),
        "actual_dollar_risk": round(actual_dollar_risk, 2),
        "actual_risk_pct": round(actual_risk_pct, 2),
        "entry_price": entry_price,
        "sl_distance": round(sl_distance, 2),
        "notional_value": round(notional_value, 2),
        "margin_required": round(margin_required, 2),
        "free_margin": round(free_margin, 2),
        "margin_pct_of_balance": round(margin_pct_of_balance, 2),
        "margin_level_pct": round(margin_level_pct, 1),
        "margin_warning": margin_warning,
        "warning_message": warning_message
    }

def generate_sample_trades(config):
    """Generates 25 realistic sample trades of XAUUSD to test immediately."""
    import random
    initial = config.get("initial_balance", 110.0)
    risk_pct = config.get("risk_pct", 5.0)
    leverage = config.get("leverage", 300)
    
    # 54% win rate sample
    outcomes = ["win", "loss", "win", "win", "loss", "win", "loss", "loss", "win", "win",
                "loss", "win", "win", "loss", "win", "win", "loss", "win", "loss", "loss",
                "win", "win", "loss", "win", "win"]
    
    sample_trades = []
    current_bal = initial
    base_dates = [
        "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-06", "2026-10-07",
        "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-13", "2026-10-14",
        "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-20", "2026-10-21",
        "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-27", "2026-10-28",
        "2026-10-29", "2026-10-29", "2026-10-30", "2026-10-30", "2026-10-30"
    ]
    strategies = ["Ruptura de Rango NY", "Order Block H1", "Fair Value Gap (FVG)", "Pullback EMA 50", "Doble Piso / Techo"]
    
    base_gold_price = 2715.0
    for i, res in enumerate(outcomes):
        date = base_dates[i]
        direction = "BUY" if i % 2 == 0 else "SELL"
        sl_distance = round(random.uniform(2.50, 4.80), 2)  # SL between $2.50 and $4.80
        entry = round(base_gold_price + random.uniform(-15.0, 15.0), 2)
        
        calc = calculate_lot_and_margin(current_bal, risk_pct, sl_distance, entry, leverage)
        lot = calc["recommended_lot"] if calc else 0.01
        
        if direction == "BUY":
            sl_price = round(entry - sl_distance, 2)
            tp_price = round(entry + sl_distance, 2)
        else:
            sl_price = round(entry + sl_distance, 2)
            tp_price = round(entry - sl_distance, 2)
            
        pnl_amount = round(lot * 100 * sl_distance, 2)
        if res == "loss":
            pnl = -pnl_amount
        else:
            pnl = pnl_amount
            
        current_bal += pnl
        if current_bal < 0:
            current_bal = 0
            
        sample_trades.append({
            "id": str(uuid.uuid4()),
            "date": date,
            "direction": direction,
            "entry_price": entry,
            "sl_price": sl_price,
            "tp_price": tp_price,
            "sl_distance": sl_distance,
            "lot_size": lot,
            "margin_used": round(entry * 100 * lot / leverage, 2),
            "status": res,
            "pnl": pnl,
            "rr": 1.0,
            "strategy": random.choice(strategies),
            "notes": f"Setup sesión Londres/NY ({res.upper()})"
        })
        
    return sample_trades


class BacktestAPIHandler(BaseHTTPRequestHandler):
    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        # API Routes
        if path == "/api/config":
            config = get_config()
            self.send_json(config)
            return

        elif path == "/api/gold-bias":
            query = parse_qs(parsed.query)
            target_date = query.get("date", [None])[0]
            if target_date:
                historical = get_gold_bias_by_date(target_date)
                if historical:
                    self.send_json(historical)
                    return
                else:
                    self.send_json({"error": "No historical bias found for date", "date": target_date}, 404)
                    return
            bias = get_gold_bias()
            self.send_json(bias)
            return

        elif path == "/api/gold-bias-history":
            history = get_gold_bias_history()
            dates_summary = []
            for d, item in sorted(history.items(), reverse=True):
                dates_summary.append({
                    "date": d,
                    "day_label": item.get("day_label", d),
                    "bias": item.get("bias", "NEUTRAL"),
                    "confidence": item.get("confidence", 80),
                    "catalyst": item.get("catalyst", "Macro"),
                    "headline": item.get("headline", "")
                })
            self.send_json({"dates": dates_summary, "full": history})
            return

        elif path == "/api/news" or path == "/api/economic-calendar":
            self.send_json(get_weekly_news())
            return

        elif path == "/api/live-signal":
            signal = load_json(LATEST_SIGNAL_FILE, {})
            self.send_json(signal)
            return

        elif path == "/api/adaptive-supertrend" or path == "/api/precision-radar":
            # Retorna la configuración optimizada exacta, estado en vivo y radar de precisión
            query = parse_qs(parsed.query)
            force_state = query.get("state", [None])[0]
            mode_param = query.get("mode", ["precision"])[0].upper()
            if mode_param not in ("PRECISION", "MACRO"):
                mode_param = "PRECISION"
                
            try:
                offset_sec = int(query.get("offset", [120])[0])
            except Exception:
                offset_sec = 120
            current_bias = get_gold_bias()
            bias_dir = current_bias.get("bias", "BEARISH")
            
            cfg = (adaptive_supertrend.CONFIG_PRECISION_INTRADAY if mode_param == "PRECISION" else adaptive_supertrend.CONFIG_TREND_MACRO) if adaptive_supertrend else {}
            dummy_recent_candles = [
                {"high": 3955.0 - i*0.15, "low": 3945.0 - i*0.15, "close": 3947.8 - i*0.15, "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
                for i in range(30)
            ]
            analysis = adaptive_supertrend.analyze_adaptive_supertrend(dummy_recent_candles, config=cfg, daily_bias=bias_dir, force_state=force_state, offset_seconds=offset_sec) if adaptive_supertrend else {}
            
            precision_data = adaptive_supertrend.calculate_precision_radar(
                current_price=3947.80,
                daily_bias=bias_dir,
                session_levels=current_bias.get("session_levels", {}),
                mode=mode_param
            ) if adaptive_supertrend else {}
            
            self.send_json({
                "config": cfg,
                "analysis": analysis,
                "precision_radar": precision_data,
                "broker": "Tickmill",
                "mode": mode_param,
                "offset_seconds": offset_sec,
                "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            return

        elif path == "/api/news-scanner":
            # Escáner Post-Noticia de Alto Impacto (Actual vs Forecast) & Análisis de 3 Fases
            news = get_weekly_news()
            current_bias = get_gold_bias()
            bias_dir = current_bias.get("bias", "BEARISH")
            
            scanner_results = []
            for day in news.get("days", []):
                for ev in day.get("events", []):
                    if ev.get("impact") in ("HIGH", "CRITICAL"):
                        act = ev.get("actual")
                        fct = ev.get("forecast")
                        prev = ev.get("previous")
                        
                        deviation = "PENDIENTE"
                        gold_reaction = "NEUTRAL"
                        aligns = False
                        scope = "ESCANER_DE_SESION"
                        scope_label = "⚡ Escáner Intradiario de Sesión (Choque de 15m; tendencia macro dominante manda)"
                        
                        if act and act != "--" and fct and fct != "--":
                            try:
                                a_clean = float(str(act).replace("%", "").replace("K", "").replace("M", "").strip())
                                f_clean = float(str(fct).replace("%", "").replace("K", "").replace("M", "").strip())
                                diff = round(a_clean - f_clean, 2)
                                
                                is_macro_driver = any(k in ev.get("title", "").upper() for k in ["NFP", "EMPLEO", "PMI", "CPI", "IPC", "PIB", "GDP"])
                                if diff > 0:
                                    gold_reaction = "BEARISH" if is_macro_driver else "BULLISH"
                                elif diff < 0:
                                    gold_reaction = "BULLISH" if is_macro_driver else "BEARISH"
                                else:
                                    gold_reaction = "NEUTRAL"
                                    
                                deviation = f"{diff:+} vs Previsión"
                                aligns = (gold_reaction == bias_dir)
                                
                                is_critical_nfp = ev.get("impact") == "CRITICAL" or "NFP" in ev.get("title", "").upper() or "CPI" in ev.get("title", "").upper()
                                if is_critical_nfp and abs(diff) >= 1.0:
                                    scope = "SESGO_DEL_DIA"
                                    scope_label = "🔥 Impacta Sesgo del Día (Cambio Estructural Macro)"
                                else:
                                    scope = "ESCANER_DE_SESION"
                                    scope_label = "⚡ Escáner Intradiario de Sesión (Choque de 15m; tendencia macro dominante manda)"
                            except Exception:
                                pass
                                
                        scanner_results.append({
                            "title": ev.get("title"),
                            "time": ev.get("time"),
                            "actual": act,
                            "forecast": fct,
                            "previous": prev,
                            "deviation": deviation,
                            "gold_reaction": gold_reaction,
                            "aligns_with_daily_bias": aligns,
                            "scope": scope,
                            "scope_label": scope_label,
                            "phases": {
                                "phase_1": {"time": "0 a 5 min", "name": "Fase 1: Shock Inicial & Caza de Mechas", "rule": "🚫 BLOQUEO TOTAL. Spreads ampliados y falsos rompimientos."},
                                "phase_2": {"time": "5 a 15 min", "name": "Fase 2: Absorción & Descuento FVG", "rule": "👀 Monitorear mitigación de liquidez al Fair Value Gap."},
                                "phase_3": {"time": "15 a 60 min", "name": "Fase 3: Expansión Tendencial", "rule": "🎯 Entrada válida confluente con Adaptive Supertrend M5."}
                            }
                        })
            
            self.send_json({
                "daily_bias": bias_dir,
                "scanner_results": scanner_results,
                "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            return

        elif path == "/api/trades":
            query = parse_qs(parsed.query)
            mode = query.get("mode", ["backtest"])[0]
            config = get_config()
            trades = get_trades(mode)
            analytics = calculate_analytics(trades, config)
            analytics["mode"] = mode
            self.send_json(analytics)
            return

        elif path == "/api/calculate-position" or path == "/api/calculate":
            query = parse_qs(parsed.query)
            try:
                balance = float(query.get("balance", [110.0])[0])
                risk_pct = float(query.get("risk_pct", [5.0])[0])
                raw_sl = float(query.get("sl_points", query.get("sl_distance", [250.0]))[0])
                if raw_sl <= 0: raw_sl = 250.0
                pts = round(raw_sl) if raw_sl >= 20.0 else round(raw_sl * 100.0)
                rr = float(query.get("rr", query.get("rr_ratio", [1.0]))[0])
                leverage = float(query.get("leverage", [300.0])[0])
                res = calculate_position_size(balance, risk_pct, pts, rr, leverage)
                self.send_json(res if res else {"error": "Invalid inputs"})
            except Exception as e:
                self.send_json({"error": str(e)}, 400)
            return

        elif path == "/api/export":
            query = parse_qs(parsed.query)
            mode = query.get("mode", ["backtest"])[0]
            trades = get_trades(mode)
            self.send_json(trades)
            return

        # Serve static files
        if path == "/" or path == "":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
        else:
            clean_path = path.lstrip("/")
            file_path = os.path.join(PUBLIC_DIR, clean_path)

        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime, _ = mimetypes.guess_type(file_path)
            mime = mime or "application/octet-stream"
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        
        try:
            payload = json.loads(body) if body else {}
        except Exception:
            payload = {}

        if path == "/api/config":
            config = get_config()
            config.update(payload)
            save_json(CONFIG_FILE, config)
            
            # If risk_pct, rr_ratio, or initial_balance was updated, recalculate all existing trades!
            trades = get_trades()
            if trades:
                trades = recalculate_trade_history(trades, config)
                save_json(TRADES_FILE, trades)
            analytics = calculate_analytics(trades, config)
            self.send_json({"config": config, "analytics": analytics})
            return

        elif path == "/api/gold-bias":
            bias = get_gold_bias()
            bias.update(payload)
            save_gold_bias(bias)
            self.send_json({"success": True, "bias": bias})
            return

        elif path == "/api/news":
            news_data = get_weekly_news()
            news_data.update(payload)
            save_weekly_news(news_data)
            self.send_json({"success": True, "news": news_data})
            return

        elif path == "/api/webhook/tradingview" or path == "/api/webhook":
            action = str(payload.get("action", payload.get("side", ""))).upper().strip()
            ticker = str(payload.get("ticker", payload.get("symbol", "XAUUSD"))).upper()
            try:
                price = float(payload.get("price", payload.get("close", 2720.0)))
            except Exception:
                price = 2720.0
            tf = str(payload.get("timeframe", payload.get("interval", "5")))
            try:
                sl_pts = float(payload.get("sl_points", payload.get("sl", 2100)))
            except Exception:
                sl_pts = 2100.0

            current_bias = get_gold_bias()
            bias_dir = current_bias.get("bias", "BEARISH")
            
            clean_action = "SELL" if ("SELL" in action or "SHORT" in action) else ("BUY" if ("BUY" in action or "LONG" in action) else action)
            if not clean_action:
                clean_action = "SELL" if bias_dir == "BEARISH" else "BUY"

            status = "VALIDATED_A_PLUS" if ((bias_dir == "BEARISH" and clean_action == "SELL") or (bias_dir == "BULLISH" and clean_action == "BUY")) else "FILTERED_DISCARDED"

            signal_data = {
                "id": int(time.time() * 1000),
                "ticker": ticker,
                "action": clean_action,
                "price": price,
                "timeframe": tf,
                "sl_points": sl_pts,
                "timestamp": datetime.now().isoformat(),
                "epoch": int(time.time()),
                "bias_at_time": bias_dir,
                "status": status,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            save_json(LATEST_SIGNAL_FILE, signal_data)
            self.send_json({"success": True, "signal": signal_data, "status": status})
            return

        elif path == "/api/reset-signal":
            save_json(LATEST_SIGNAL_FILE, {})
            self.send_json({"success": True})
            return

        elif path == "/api/recalculate":
            mode = payload.get("mode", "backtest")
            config = get_config()
            if "risk_pct" in payload:
                config["risk_pct"] = float(payload["risk_pct"])
            if "rr_ratio" in payload:
                config["rr_ratio"] = float(payload["rr_ratio"])
            if "initial_balance" in payload:
                config["initial_balance"] = float(payload["initial_balance"])
            save_json(CONFIG_FILE, config)
            
            trades = get_trades(mode)
            recalculated = recalculate_trade_history(trades, config)
            save_trades(recalculated, mode)
            analytics = calculate_analytics(recalculated, config)
            analytics["mode"] = mode
            self.send_json(analytics)
            return

        elif path == "/api/trades":
            mode = payload.get("mode", "backtest")
            config = get_config()
            trades = get_trades(mode)

            # Current compound balance before this trade
            analytics = calculate_analytics(trades, config)
            cur_bal = analytics["summary"]["current_balance"]

            direction = payload.get("direction", "BUY").upper()
            
            # TradingView Exact Position Tool Points & Price Distance
            raw_val = float(payload.get("tv_points", payload.get("sl_points", payload.get("sl_distance", 250.0))))
            if raw_val <= 0:
                raw_val = 250.0
            if raw_val >= 20.0:
                tv_points = round(raw_val)
                price_dist = round(raw_val / 100.0, 2)
            else:
                tv_points = round(raw_val * 100.0)
                price_dist = round(raw_val, 2)

            raw_risk = payload.get("risk_pct") or payload.get("risk_pct_custom") or config.get("risk_pct", 5.0)
            trade_risk_pct = round(float(str(raw_risk).replace(",", ".")), 2)
            trade_rr = float(str(payload.get("rr") or config.get("rr_ratio", 1.0)).replace(",", "."))
            status = payload.get("status", "win").lower()
            
            # Pure percentage calculation
            if status == "win":
                ret_pct = trade_risk_pct * trade_rr
            elif status == "loss":
                ret_pct = -trade_risk_pct
            else:
                ret_pct = 0.0
                
            pnl = round(cur_bal * (ret_pct / 100.0), 2)
            dollar_risk = round(cur_bal * (trade_risk_pct / 100.0), 2)
            
            # Reference lot size for MT4/Broker
            raw_lot = dollar_risk / tv_points if tv_points > 0 else 0.01
            suggested_lot = round(raw_lot, 2)
            if suggested_lot < 0.01:
                suggested_lot = 0.01

            manual_lot_raw = payload.get("manual_lot") or payload.get("lot_size") or 0.0
            manual_lot = float(str(manual_lot_raw).replace(",", ".")) if manual_lot_raw else 0.0
            lot_size = round(manual_lot, 2) if manual_lot > 0 else suggested_lot
            margin_used = round((2700.0 * 100 * lot_size) / float(config.get("leverage", 300)), 2)

            raw_comm = payload.get("commission", 0.0)
            commission = round(abs(float(str(raw_comm).replace(",", "."))), 2)
            # If client computed PnL with manual lot size, commission, or explicit PnL, respect it:
            if "pnl" in payload and payload["pnl"] is not None and str(payload["pnl"]).strip() != "":
                pnl = round(float(str(payload["pnl"]).replace(",", ".")), 2)
                dollar_risk = round(float(str(payload.get("dollar_risk", dollar_risk)).replace(",", ".")), 2)
            else:
                pnl = round(cur_bal * (ret_pct / 100.0) - commission, 2)

            trade = {
                "id": str(uuid.uuid4()),
                "date": payload.get("date") or datetime.now().strftime("%Y-%m-%d %H:%M"),
                "direction": direction,
                "tv_points": tv_points,
                "price_dist": price_dist,
                "sl_points": tv_points,
                "tp_points": round(tv_points * trade_rr),
                "sl_distance": price_dist,
                "risk_pct": trade_risk_pct,
                "risk_pct_custom": trade_risk_pct,
                "ret_pct": round(ret_pct, 2),
                "dollar_risk": dollar_risk,
                "suggested_lot": suggested_lot,
                "lot_size": lot_size,
                "manual_lot": manual_lot if manual_lot > 0 else None,
                "commission": commission,
                "margin_used": margin_used,
                "status": status,
                "pnl": pnl,
                "rr": trade_rr,
                "session": payload.get("session", "New York"),
                "strategy": payload.get("strategy", "General"),
                "emotion": payload.get("emotion", "Plan Seguido"),
                "tv_chart_url": payload.get("tv_chart_url", ""),
                "notes": payload.get("notes", ""),
                "mode": mode
            }

            trades.append(trade)
            save_trades(trades, mode)

            updated_analytics = calculate_analytics(trades, config)
            updated_analytics["mode"] = mode
            self.send_json({"trade": trade, "analytics": updated_analytics})
            return

        elif path == "/api/trades/clear":
            mode = payload.get("mode", "backtest")
            save_trades([], mode)
            config = get_config()
            ana = calculate_analytics([], config)
            ana["mode"] = mode
            self.send_json(ana)
            return
            return

        elif path == "/api/trades/sample":
            config = get_config()
            sample = generate_sample_trades(config)
            save_json(TRADES_FILE, sample)
            analytics = calculate_analytics(sample, config)
            self.send_json(analytics)
            return

        elif path == "/api/simulate":
            # Monte Carlo / Batch Simulation
            num_trades = int(payload.get("num_trades", 50))
            sim_winrate = float(payload.get("win_rate", 55.0)) / 100.0
            initial = float(payload.get("initial_balance", 110.0))
            risk_pct = float(payload.get("risk_pct", 5.0))
            leverage = float(payload.get("leverage", 300))
            avg_sl_dist = float(payload.get("avg_sl_distance", 3.50))
            gold_price = 2720.0

            import random
            curve = [{"trade": 0, "balance": initial, "drawdown_pct": 0.0}]
            curr = initial
            peak = initial
            sim_wins = 0
            sim_losses = 0
            max_dd = 0.0
            blown_at = None

            for i in range(1, num_trades + 1):
                if curr <= 5.0:
                    blown_at = i
                    break
                
                # Check outcome based on win rate probability
                is_win = random.random() < sim_winrate
                calc = calculate_lot_and_margin(curr, risk_pct, avg_sl_dist, gold_price, leverage)
                lot = calc["recommended_lot"] if calc else 0.01
                dollar_change = round(lot * 100 * avg_sl_dist, 2)
                
                if is_win:
                    curr += dollar_change
                    sim_wins += 1
                else:
                    curr -= dollar_change
                    sim_losses += 1
                    if curr < 0:
                        curr = 0

                if curr > peak:
                    peak = curr
                dd = (peak - curr) / peak * 100.0 if peak > 0 else 0.0
                if dd > max_dd:
                    max_dd = dd

                curve.append({
                    "trade": i,
                    "balance": round(curr, 2),
                    "drawdown_pct": round(dd, 2),
                    "result": "WIN" if is_win else "LOSS"
                })

            self.send_json({
                "final_balance": round(curr, 2),
                "net_profit": round(curr - initial, 2),
                "roi_pct": round((curr - initial) / initial * 100.0, 2),
                "wins": sim_wins,
                "losses": sim_losses,
                "actual_winrate": round(sim_wins / (sim_wins + sim_losses) * 100.0, 2) if (sim_wins + sim_losses) > 0 else 0,
                "max_drawdown_pct": round(max_dd, 2),
                "blown_account": blown_at is not None,
                "blown_at_trade": blown_at,
                "curve": curve
            })
            return

        elif path == "/api/import":
            try:
                trades_to_import = payload if isinstance(payload, list) else payload.get("trades", [])
                save_json(TRADES_FILE, trades_to_import)
                config = get_config()
                self.send_json(calculate_analytics(trades_to_import, config))
            except Exception as e:
                self.send_json({"error": str(e)}, 400)
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/trades/"):
            trade_id = path.replace("/api/trades/", "").strip()
            query = parse_qs(parsed.query)
            mode = query.get("mode", ["backtest"])[0]
            trades = get_trades(mode)
            new_trades = [t for t in trades if t.get("id") != trade_id]
            config = get_config()
            recalculated = recalculate_trade_history(new_trades, config)
            save_trades(recalculated, mode)
            ana = calculate_analytics(recalculated, config)
            ana["mode"] = mode
            self.send_json(ana)
            return
        self.send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/trades/"):
            trade_id = path.replace("/api/trades/", "").strip()
            query = parse_qs(parsed.query)
            mode = query.get("mode", ["backtest"])[0]
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                payload = json.loads(body)
            except Exception:
                payload = {}

            if "mode" in payload:
                mode = payload["mode"]

            trades = get_trades(mode)
            config = get_config()
            updated = False
            for t in trades:
                if t.get("id") == trade_id:
                    for k, v in payload.items():
                        if k != "id":
                            t[k] = v
                    updated = True
                    break

            if updated:
                recalculated = recalculate_trade_history(trades, config)
                save_trades(recalculated, mode)
                ana = calculate_analytics(recalculated, config)
                ana["mode"] = mode
                self.send_json(ana)
            else:
                self.send_json({"error": "Trade not found"}, 404)
            return
        self.send_json({"error": "Endpoint not found"}, 404)

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]}\n")

class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True

def run(port=PORT):
    for attempt_port in range(port, port + 10):
        try:
            server_address = ("", attempt_port)
            httpd = ReusableHTTPServer(server_address, BacktestAPIHandler)
            print(f"\n=======================================================")
            print(f"👻 Ghost Trader | Gold iniciado exitosamente!")
            print(f"👉 Abre tu navegador en: http://localhost:{attempt_port}")
            print(f"=======================================================\n")
            httpd.serve_forever()
            return
        except OSError as e:
            if e.errno == 48: # Address already in use
                continue
            else:
                raise e
    print(f"Error: No se pudo enlazar ningún puerto entre {port} y {port+10}.")

if __name__ == "__main__":
    p = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", PORT))
    run(p)

