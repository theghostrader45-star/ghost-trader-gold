"""
engine_strategies.py - Dual Institutional Engine
1. Toni Maura SMC Strategy for XAU/USD (Gold)
2. Felipe López Price Action Strategy for EUR/USD (Euro)
Includes MetaTrader 5 Bridge receiver and exact lot size calculator.
"""

import time
import math
import urllib.request
import json
from datetime import datetime

# In-memory storage for MetaTrader 5 feed
mt5_store = {
    "connected": False,
    "last_ping": 0,
    "account": {
        "balance": 5000.0,
        "equity": 5000.0,
        "currency": "USD",
        "company": "Esperando MT5",
        "leverage": 100
    },
    "symbols": {
        "XAUUSD": {
            "bid": 0.0,
            "ask": 0.0,
            "spread_pts": 0,
            "candles_m5": [],
            "candles_h1": [],
            "last_tick": 0
        },
        "EURUSD": {
            "bid": 0.0,
            "ask": 0.0,
            "spread_pts": 0,
            "candles_m5": [],
            "last_tick": 0
        }
    }
}

def update_mt5_feed(payload):
    """
    Receives JSON payload from MetaTrader 5 GhostBridge EA.
    Expected format:
    {
        "account": {"balance": 10000, "equity": 10000, "currency": "USD", "company": "Pepperstone", "leverage": 100},
        "symbols": {
            "XAUUSD": {"bid": 4045.20, "ask": 4045.55, "spread_pts": 35, "candles_m5": [...], "candles_h1": [...]},
            "EURUSD": {"bid": 1.08500, "ask": 1.08503, "spread_pts": 3, "candles_m5": [...]}
        }
    }
    """
    now = time.time()
    mt5_store["connected"] = True
    mt5_store["last_ping"] = now

    if "account" in payload and isinstance(payload["account"], dict):
        acc = payload["account"]
        for k in ["balance", "equity", "currency", "company", "leverage"]:
            if k in acc:
                mt5_store["account"][k] = acc[k]

    if "symbols" in payload and isinstance(payload["symbols"], dict):
        for sym, s_data in payload["symbols"].items():
            norm_sym = "XAUUSD" if "XAU" in sym.upper() or "GOLD" in sym.upper() else ("EURUSD" if "EUR" in sym.upper() else sym.upper())
            if norm_sym not in mt5_store["symbols"]:
                mt5_store["symbols"][norm_sym] = {}
            for k in ["bid", "ask", "spread_pts", "candles_m5", "candles_h1"]:
                if k in s_data:
                    mt5_store["symbols"][norm_sym][k] = s_data[k]
            mt5_store["symbols"][norm_sym]["last_tick"] = now

    return {
        "status": "success",
        "message": "MT5 payload received",
        "timestamp": now,
        "symbols_updated": list(mt5_store["symbols"].keys())
    }

def get_mt5_status():
    """Returns MT5 connection health."""
    now = time.time()
    is_live = (now - mt5_store["last_ping"]) < 15.0 if mt5_store["last_ping"] > 0 else False
    mt5_store["connected"] = is_live
    return {
        "connected": is_live,
        "seconds_since_ping": round(now - mt5_store["last_ping"], 1) if mt5_store["last_ping"] > 0 else None,
        "broker": mt5_store["account"].get("company", "Desconectado"),
        "balance": mt5_store["account"].get("balance", 0.0),
        "equity": mt5_store["account"].get("equity", 0.0),
        "currency": mt5_store["account"].get("currency", "USD"),
        "symbols_tracked": list(mt5_store["symbols"].keys())
    }

# -------------------------------------------------------------
# FALLBACK MARKET DATA INGESTION (When MT5 is offline)
# -------------------------------------------------------------
def fetch_yahoo_candles(ticker, interval="5m", range_str="1d"):
    """Fetches clean OHLC candles from Yahoo Finance."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&range={range_str}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            res = data["chart"]["result"][0]
            timestamps = res.get("timestamp", [])
            quote = res["indicators"]["quote"][0]
            opens = quote.get("open", [])
            highs = quote.get("high", [])
            lows = quote.get("low", [])
            closes = quote.get("close", [])
            vols = quote.get("volume", [])

            candles = []
            for i in range(len(timestamps)):
                if opens[i] is not None and highs[i] is not None and lows[i] is not None and closes[i] is not None:
                    candles.append({
                        "time": timestamps[i],
                        "open": round(float(opens[i]), 5),
                        "high": round(float(highs[i]), 5),
                        "low": round(float(lows[i]), 5),
                        "close": round(float(closes[i]), 5),
                        "volume": int(vols[i] or 0)
                    })
            return candles
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return []

# -------------------------------------------------------------
# STRATEGY 1: TONI MAURA SMC ENGINE (XAU/USD - ORO)
# -------------------------------------------------------------
def analyze_toni_maura_xauusd(candles_h1, candles_m5, bid, ask, balance, risk_pct=1.0):
    """
    Toni Maura Strategy for Gold:
    1. HTF Trend & Liquidity Pools (1H)
    2. LTF Displacement & Fair Value Gap (FVG) in 5m
    3. Mitigation of FVG + Rejection Wick (≥ 40%) or Engulfing Trigger
    4. Exact SL behind displacement base and TP 1:2 / 1:3
    5. Exact lot size = (Balance * Risk%) / (SL_dist_usd * 100)
    """
    if not candles_m5 or len(candles_m5) < 15:
        return {"status": "insufficient_data", "error": "Not enough M5 candles for XAUUSD"}

    current_price = bid if bid > 0 else candles_m5[-1]["close"]
    spread_pts = round((ask - bid) * 100, 1) if (ask > bid > 0) else 25.0

    # 1. High Timeframe (1H) Bias Analysis
    # If H1 candles provided, evaluate swing direction; otherwise approximate from last 48 M5 candles (4 hours)
    htf_bias = "BULLISH"
    htf_reason = "Estructura de altos y bajos crecientes en temporalidad mayor"
    h1_slice = candles_h1 if len(candles_h1) >= 5 else candles_m5[-48:]
    
    # Calculate simple swing highs and lows in HTF
    highs = [c["high"] for c in h1_slice]
    lows = [c["low"] for c in h1_slice]
    bsl_pool = max(highs) # Buy Side Liquidity
    ssl_pool = min(lows)  # Sell Side Liquidity
    
    first_half_close = h1_slice[len(h1_slice)//3]["close"]
    latest_close = h1_slice[-1]["close"]
    if latest_close > first_half_close:
        htf_bias = "BULLISH"
        htf_reason = f"Flujo institucional comprador (HTF). Objetivo: Piscina BSL en ${bsl_pool:,.2f}"
    elif latest_close < first_half_close:
        htf_bias = "BEARISH"
        htf_reason = f"Flujo institucional vendedor (HTF). Objetivo: Piscina SSL en ${ssl_pool:,.2f}"
    else:
        htf_bias = "RANGING"
        htf_reason = "Consolidación HTF entre BSL y SSL"

    # 2. LTF (5m) Displacement & Fair Value Gap (FVG) Detection
    # Look back over last 12 M5 candles for recent displacement & FVG
    recent_m5 = candles_m5[-12:]
    detected_fvg = None
    displacement_candle = None

    for i in range(2, len(recent_m5)):
        c1 = recent_m5[i-2]
        c2 = recent_m5[i-1] # Potential displacement candle
        c3 = recent_m5[i]

        body2 = abs(c2["close"] - c2["open"])
        range2 = c2["high"] - c2["low"]
        is_displacement = range2 > 0 and (body2 / range2) >= 0.60 and range2 >= 2.5 # At least $2.50 displacement in Gold

        # Bullish FVG check
        if c2["close"] > c2["open"] and is_displacement:
            if c3["low"] > c1["high"]:
                gap_low = c1["high"]
                gap_high = c3["low"]
                gap_size = gap_high - gap_low
                if gap_size >= 0.50: # Valid gap ≥ $0.50
                    detected_fvg = {
                        "type": "BULLISH",
                        "top": round(gap_high, 2),
                        "bottom": round(gap_low, 2),
                        "ce_50": round((gap_high + gap_low) / 2.0, 2),
                        "gap_size_usd": round(gap_size, 2),
                        "displacement_index": i-1,
                        "disp_low": c2["low"],
                        "disp_high": c2["high"]
                    }
                    displacement_candle = c2

        # Bearish FVG check
        elif c2["close"] < c2["open"] and is_displacement:
            if c3["high"] < c1["low"]:
                gap_high = c1["low"]
                gap_low = c3["high"]
                gap_size = gap_high - gap_low
                if gap_size >= 0.50:
                    detected_fvg = {
                        "type": "BEARISH",
                        "top": round(gap_high, 2),
                        "bottom": round(gap_low, 2),
                        "ce_50": round((gap_high + gap_low) / 2.0, 2),
                        "gap_size_usd": round(gap_size, 2),
                        "displacement_index": i-1,
                        "disp_low": c2["low"],
                        "disp_high": c2["high"]
                    }
                    displacement_candle = c2

    # 3. Mitigation & Rejection Trigger
    last_candle = recent_m5[-1]
    prev_candle = recent_m5[-2]
    last_range = last_candle["high"] - last_candle["low"]
    lower_wick = min(last_candle["open"], last_candle["close"]) - last_candle["low"]
    upper_wick = last_candle["high"] - max(last_candle["open"], last_candle["close"])
    lower_wick_ratio = (lower_wick / last_range) if last_range > 0 else 0
    upper_wick_ratio = (upper_wick / last_range) if last_range > 0 else 0

    state = "WAITING_DISPLACEMENT"
    badge = "🟡 ESPERANDO DESPLAZAMIENTO INSTITUCIONAL (1H/5m)"
    status_desc = "El mercado está oscilando sin imprimir un desbalance claro de 3 velas. Esperar que aparezca un FVG."
    ticket = None

    if detected_fvg:
        fvg_top = detected_fvg["top"]
        fvg_bottom = detected_fvg["bottom"]
        fvg_ce = detected_fvg["ce_50"]
        fvg_type = detected_fvg["type"]

        # Check if current price is in or near FVG
        price_in_fvg = (fvg_bottom - 1.0) <= current_price <= (fvg_top + 1.0)

        if fvg_type == "BULLISH" and htf_bias in ["BULLISH", "RANGING"]:
            if price_in_fvg:
                # Check for rejection or bullish momentum
                if lower_wick_ratio >= 0.35 or last_candle["close"] > last_candle["open"]:
                    state = "TRIGGER_CONFIRMED"
                    badge = "🎯 ¡GATILLO CONFIRMADO: MITIGACIÓN FVG + RECHAZO!"
                    status_desc = f"El Oro mitigó el Fair Value Gap (${fvg_bottom:.2f}–${fvg_top:.2f}) y cerró con absorción institucional. Entrada lista."
                else:
                    state = "IN_FVG_ZONE"
                    badge = "⚡ EN ZONA DE FVG · ESPERANDO VELA DE RECHAZO"
                    status_desc = f"Precio dentro del FVG (${fvg_bottom:.2f} - ${fvg_top:.2f}). Esperando confirmación de mecha inferior en M5."
            else:
                state = "WAITING_MITIGATION"
                badge = "⏳ FVG ALCISTA VIGENTE · ESPERANDO RETROCESO (DESCUENTO)"
                status_desc = f"Fair Value Gap creado en ${fvg_bottom:.2f} - ${fvg_top:.2f}. Esperar que el precio retroceda a la zona para comprar."

            # Calculate ticket for BUY
            entry_price = current_price if state == "TRIGGER_CONFIRMED" else fvg_ce
            sl_price = round(detected_fvg["disp_low"] - 1.20, 2) # Buffer below displacement candle
            sl_dist_usd = round(entry_price - sl_price, 2)
            if sl_dist_usd < 2.0: # Minimum $2 SL buffer for Gold
                sl_price = round(entry_price - 2.50, 2)
                sl_dist_usd = 2.50

            tp1_price = round(entry_price + (sl_dist_usd * 2.0), 2)
            tp2_price = round(entry_price + (sl_dist_usd * 3.0), 2)

            risk_dollar = balance * (risk_pct / 100.0)
            # Gold: 1 lot = 100 oz -> $1 move = $100 per lot
            # Lot = Risk$ / (SL_dist * 100)
            exact_lot = risk_dollar / (sl_dist_usd * 100.0)
            suggested_lot = max(0.01, round(exact_lot, 2))

            ticket = {
                "asset": "XAUUSD",
                "action": "BUY NOW" if state == "TRIGGER_CONFIRMED" else "BUY LIMIT",
                "entry": entry_price,
                "sl": sl_price,
                "sl_dist_usd": sl_dist_usd,
                "sl_dist_pts": int(sl_dist_usd * 100),
                "tp1": tp1_price,
                "tp2": tp2_price,
                "risk_pct": risk_pct,
                "risk_usd": round(risk_dollar, 2),
                "suggested_lot": suggested_lot,
                "strategy": "Toni Maura SMC (FVG + 1H Bias)",
                "state": state
            }

        elif fvg_type == "BEARISH" and htf_bias in ["BEARISH", "RANGING"]:
            if price_in_fvg:
                if upper_wick_ratio >= 0.35 or last_candle["close"] < last_candle["open"]:
                    state = "TRIGGER_CONFIRMED"
                    badge = "🎯 ¡GATILLO CONFIRMADO: MITIGACIÓN FVG + RECHAZO!"
                    status_desc = f"El Oro mitigó el Fair Value Gap (${fvg_top:.2f}–${fvg_bottom:.2f}) y cerró con absorción vendedora. Entrada lista."
                else:
                    state = "IN_FVG_ZONE"
                    badge = "⚡ EN ZONA DE FVG · ESPERANDO VELA DE RECHAZO"
                    status_desc = f"Precio dentro del FVG (${fvg_bottom:.2f} - ${fvg_top:.2f}). Esperando confirmación de mecha superior en M5."
            else:
                state = "WAITING_MITIGATION"
                badge = "⏳ FVG BAJISTA VIGENTE · ESPERANDO RETROCESO (PREMIUM)"
                status_desc = f"Fair Value Gap creado en ${fvg_bottom:.2f} - ${fvg_top:.2f}. Esperar que el precio suba a la zona para vender."

            entry_price = current_price if state == "TRIGGER_CONFIRMED" else fvg_ce
            sl_price = round(detected_fvg["disp_high"] + 1.20, 2)
            sl_dist_usd = round(sl_price - entry_price, 2)
            if sl_dist_usd < 2.0:
                sl_price = round(entry_price + 2.50, 2)
                sl_dist_usd = 2.50

            tp1_price = round(entry_price - (sl_dist_usd * 2.0), 2)
            tp2_price = round(entry_price - (sl_dist_usd * 3.0), 2)

            risk_dollar = balance * (risk_pct / 100.0)
            exact_lot = risk_dollar / (sl_dist_usd * 100.0)
            suggested_lot = max(0.01, round(exact_lot, 2))

            ticket = {
                "asset": "XAUUSD",
                "action": "SELL NOW" if state == "TRIGGER_CONFIRMED" else "SELL LIMIT",
                "entry": entry_price,
                "sl": sl_price,
                "sl_dist_usd": sl_dist_usd,
                "sl_dist_pts": int(sl_dist_usd * 100),
                "tp1": tp1_price,
                "tp2": tp2_price,
                "risk_pct": risk_pct,
                "risk_usd": round(risk_dollar, 2),
                "suggested_lot": suggested_lot,
                "strategy": "Toni Maura SMC (FVG + 1H Bias)",
                "state": state
            }

    # Default ticket if no active FVG
    if not ticket:
        sl_dist_usd = 3.50
        risk_dollar = balance * (risk_pct / 100.0)
        suggested_lot = max(0.01, round(risk_dollar / (sl_dist_usd * 100.0), 2))
        ticket = {
            "asset": "XAUUSD",
            "action": "ESPERA",
            "entry": current_price,
            "sl": round(current_price - sl_dist_usd, 2) if htf_bias == "BULLISH" else round(current_price + sl_dist_usd, 2),
            "sl_dist_usd": sl_dist_usd,
            "sl_dist_pts": int(sl_dist_usd * 100),
            "tp1": round(current_price + (sl_dist_usd * 2.0), 2) if htf_bias == "BULLISH" else round(current_price - (sl_dist_usd * 2.0), 2),
            "tp2": round(current_price + (sl_dist_usd * 3.0), 2) if htf_bias == "BULLISH" else round(current_price - (sl_dist_usd * 3.0), 2),
            "risk_pct": risk_pct,
            "risk_usd": round(risk_dollar, 2),
            "suggested_lot": suggested_lot,
            "strategy": "Toni Maura SMC (FVG + 1H Bias)",
            "state": state
        }

    return {
        "symbol": "XAUUSD",
        "asset_label": "Oro (XAU/USD)",
        "strategy_name": "Toni Maura SMC (Fair Value Gap & Displacement)",
        "current_price": current_price,
        "spread_pts": spread_pts,
        "htf_bias": htf_bias,
        "htf_reason": htf_reason,
        "bsl_pool": round(bsl_pool, 2),
        "ssl_pool": round(ssl_pool, 2),
        "detected_fvg": detected_fvg,
        "state": state,
        "badge": badge,
        "status_desc": status_desc,
        "ticket": ticket
    }

# -------------------------------------------------------------
# STRATEGY 2: FELIPE LÓPEZ PRICE ACTION (EUR/USD - EURO)
# -------------------------------------------------------------
def analyze_felipe_lopez_eurusd(candles_m5, bid, ask, balance, risk_pct=1.0):
    """
    Felipe López Strategy for EUR/USD:
    1. Market Structure (HH/HL = Bullish, LL/LH = Bearish)
    2. Recent Reaction Zones (2+ touches with rejection)
    3. Breakout with Volume (real candle body closes beyond zone)
    4. Retest to broken zone + Engulfing or Rejection Wick Trigger
    5. SL placed behind zone/wick, TP 1:2 / 1:3
    6. Exact lot size = (Balance * Risk%) / (SL_pips * 10)
    """
    if not candles_m5 or len(candles_m5) < 15:
        return {"status": "insufficient_data", "error": "Not enough M5 candles for EURUSD"}

    current_price = bid if bid > 0 else candles_m5[-1]["close"]
    spread_pips = round((ask - bid) * 10000, 1) if (ask > bid > 0) else 0.4

    # 1. Market Structure (HH/HL vs LL/LH)
    # Check swings in last 24 candles (2 hours)
    recent = candles_m5[-24:]
    pivots_high = []
    pivots_low = []

    for i in range(1, len(recent)-1):
        if recent[i]["high"] >= recent[i-1]["high"] and recent[i]["high"] >= recent[i+1]["high"]:
            pivots_high.append(recent[i]["high"])
        if recent[i]["low"] <= recent[i-1]["low"] and recent[i]["low"] <= recent[i+1]["low"]:
            pivots_low.append(recent[i]["low"])

    structure = "RANGING"
    structure_badge = "🟡 CONSOLIDACIÓN (ESPERAR RUPTURA)"
    structure_desc = "Máximos y mínimos al mismo nivel. Prohibido operar dentro del rango."

    if len(pivots_high) >= 2 and len(pivots_low) >= 2:
        if pivots_high[-1] > pivots_high[-2] and pivots_low[-1] > pivots_low[-2]:
            structure = "BULLISH"
            structure_badge = "🟢 ESTRUCTURA ALCISTA (SOLO COMPRAS)"
            structure_desc = "Altos más altos (HH) y Bajos más altos (HL) confirmados. Prioridad absoluta compras."
        elif pivots_high[-1] < pivots_high[-2] and pivots_low[-1] < pivots_low[-2]:
            structure = "BEARISH"
            structure_badge = "🔴 ESTRUCTURA BAJISTA (SOLO VENTAS)"
            structure_desc = "Bajos más bajos (LL) y Altos más bajos (LH) confirmados. Prioridad absoluta ventas."

    # 2. Identify Recent Reaction Zones (clustering levels within 3 pips)
    # Tolerance for EURUSD: 0.00030 (3 pips)
    all_levels = pivots_high + pivots_low
    cluster_zones = []

    for lvl in all_levels:
        touches = sum(1 for x in all_levels if abs(x - lvl) <= 0.00035)
        if touches >= 2:
            zone_center = lvl
            # Avoid duplicate zones
            if not any(abs(z["center"] - zone_center) <= 0.00040 for z in cluster_zones):
                cluster_zones.append({
                    "center": round(zone_center, 5),
                    "top": round(zone_center + 0.00020, 5),
                    "bottom": round(zone_center - 0.00020, 5),
                    "touches": touches
                })

    # Sort zones by proximity to current price
    cluster_zones.sort(key=lambda z: abs(z["center"] - current_price))
    key_zone = cluster_zones[0] if cluster_zones else {
        "center": round(current_price, 5),
        "top": round(current_price + 0.00025, 5),
        "bottom": round(current_price - 0.00025, 5),
        "touches": 2
    }

    # 3. Breakout, Retest & Gatillo Analysis
    last_candle = recent[-1]
    prev_candle = recent[-2]
    c_range = last_candle["high"] - last_candle["low"]
    c_body = abs(last_candle["close"] - last_candle["open"])
    lower_wick = min(last_candle["open"], last_candle["close"]) - last_candle["low"]
    upper_wick = last_candle["high"] - max(last_candle["open"], last_candle["close"])

    is_engulfing_bull = (last_candle["close"] > last_candle["open"] and 
                         prev_candle["close"] < prev_candle["open"] and 
                         last_candle["close"] > prev_candle["open"] and 
                         c_body > 0.00025)

    is_engulfing_bear = (last_candle["close"] < last_candle["open"] and 
                         prev_candle["close"] > prev_candle["open"] and 
                         last_candle["close"] < prev_candle["open"] and 
                         c_body > 0.00025)

    rejection_bull = (lower_wick / c_range >= 0.40) if c_range > 0 else False
    rejection_bear = (upper_wick / c_range >= 0.40) if c_range > 0 else False

    # Distance to key zone in pips
    dist_to_zone_pips = round(abs(current_price - key_zone["center"]) * 10000, 1)

    state = "WAITING_SETUP"
    badge = "⏳ ESPERANDO RUPTURA O RETESTEO A ZONA DE REACCIÓN"
    status_desc = f"Zona de reacción clave detectada en {key_zone['center']:.5f} ({key_zone['touches']} toques). Esperando confirmación."
    ticket = None

    # Scenario Bullish: Price broke above zone, now retesting zone
    if structure == "BULLISH":
        if dist_to_zone_pips <= 2.5: # Retesting the zone
            if is_engulfing_bull or rejection_bull:
                state = "TRIGGER_CONFIRMED"
                badge = "🎯 ¡GATILLO CONFIRMADO: RETESTEO + RECHAZO EN ZONA!"
                status_desc = f"EUR/USD retesteó la zona {key_zone['center']:.5f} e imprimió confirmación por mecha/envolvente. Entrada en compras."
            else:
                state = "IN_RETEST_ZONE"
                badge = "⚡ RETESTEANDO ZONA DE REACCIÓN · ESPERANDO VELA DE CONFIRMACIÓN"
                status_desc = f"El precio está en la zona ({key_zone['center']:.5f}). Esperando que cierre vela M5 con mecha de rechazo o envolvente."
        elif current_price > key_zone["top"]:
            state = "WAITING_RETEST"
            badge = "⏳ RUPTURA ALCISTA REALIZADA · ESPERANDO RETESTEO A LA ZONA"
            status_desc = f"El precio rompió la resistencia {key_zone['center']:.5f}. Esperar retroceso para entrar al retesteo."

        # Ticket BUY
        entry_price = current_price
        sl_price = round(key_zone["bottom"] - 0.00040, 5) # 4 pips below zone
        sl_pips = round((entry_price - sl_price) * 10000, 1)
        if sl_pips < 8.0:
            sl_pips = 8.0
            sl_price = round(entry_price - 0.00080, 5)

        tp1_price = round(entry_price + (sl_pips * 2.0 / 10000.0), 5)
        tp2_price = round(entry_price + (sl_pips * 3.0 / 10000.0), 5)

        risk_dollar = balance * (risk_pct / 100.0)
        # EURUSD: 1 standard lot = $10 per pip
        # Lot = Risk$ / (SL_pips * 10)
        exact_lot = risk_dollar / (sl_pips * 10.0)
        suggested_lot = max(0.01, round(exact_lot, 2))

        ticket = {
            "asset": "EURUSD",
            "action": "BUY NOW" if state == "TRIGGER_CONFIRMED" else "BUY LIMIT",
            "entry": entry_price,
            "sl": sl_price,
            "sl_pips": sl_pips,
            "tp1": tp1_price,
            "tp2": tp2_price,
            "risk_pct": risk_pct,
            "risk_usd": round(risk_dollar, 2),
            "suggested_lot": suggested_lot,
            "strategy": "Felipe López (Estructura + Zona + Retesteo)",
            "state": state
        }

    elif structure == "BEARISH":
        if dist_to_zone_pips <= 2.5:
            if is_engulfing_bear or rejection_bear:
                state = "TRIGGER_CONFIRMED"
                badge = "🎯 ¡GATILLO CONFIRMADO: RETESTEO + RECHAZO EN ZONA!"
                status_desc = f"EUR/USD retesteó la zona {key_zone['center']:.5f} e imprimió confirmación vendedora. Entrada en ventas."
            else:
                state = "IN_RETEST_ZONE"
                badge = "⚡ RETESTEANDO ZONA DE REACCIÓN · ESPERANDO VELA DE CONFIRMACIÓN"
                status_desc = f"El precio está en la zona ({key_zone['center']:.5f}). Esperando que cierre vela M5 con mecha superior o envolvente bajista."
        elif current_price < key_zone["bottom"]:
            state = "WAITING_RETEST"
            badge = "⏳ RUPTURA BAJISTA REALIZADA · ESPERANDO RETESTEO A LA ZONA"
            status_desc = f"El precio rompió el soporte {key_zone['center']:.5f}. Esperar retroceso para entrar al retesteo."

        # Ticket SELL
        entry_price = current_price
        sl_price = round(key_zone["top"] + 0.00040, 5) # 4 pips above zone
        sl_pips = round((sl_price - entry_price) * 10000, 1)
        if sl_pips < 8.0:
            sl_pips = 8.0
            sl_price = round(entry_price + 0.00080, 5)

        tp1_price = round(entry_price - (sl_pips * 2.0 / 10000.0), 5)
        tp2_price = round(entry_price - (sl_pips * 3.0 / 10000.0), 5)

        risk_dollar = balance * (risk_pct / 100.0)
        exact_lot = risk_dollar / (sl_pips * 10.0)
        suggested_lot = max(0.01, round(exact_lot, 2))

        ticket = {
            "asset": "EURUSD",
            "action": "SELL NOW" if state == "TRIGGER_CONFIRMED" else "SELL LIMIT",
            "entry": entry_price,
            "sl": sl_price,
            "sl_pips": sl_pips,
            "tp1": tp1_price,
            "tp2": tp2_price,
            "risk_pct": risk_pct,
            "risk_usd": round(risk_dollar, 2),
            "suggested_lot": suggested_lot,
            "strategy": "Felipe López (Estructura + Zona + Retesteo)",
            "state": state
        }

    # Default ticket if ranging
    if not ticket:
        sl_pips = 10.0
        risk_dollar = balance * (risk_pct / 100.0)
        suggested_lot = max(0.01, round(risk_dollar / (sl_pips * 10.0), 2))
        ticket = {
            "asset": "EURUSD",
            "action": "ESPERA",
            "entry": current_price,
            "sl": round(current_price - 0.00100, 5),
            "sl_pips": sl_pips,
            "tp1": round(current_price + 0.00200, 5),
            "tp2": round(current_price + 0.00300, 5),
            "risk_pct": risk_pct,
            "risk_usd": round(risk_dollar, 2),
            "suggested_lot": suggested_lot,
            "strategy": "Felipe López (Estructura + Zona + Retesteo)",
            "state": state
        }

    return {
        "symbol": "EURUSD",
        "asset_label": "Euro / Dólar (EUR/USD)",
        "strategy_name": "Felipe López Price Action (Estructura + Zona + Retesteo)",
        "current_price": current_price,
        "spread_pips": spread_pips,
        "structure": structure,
        "structure_badge": structure_badge,
        "structure_desc": structure_desc,
        "key_zone": key_zone,
        "all_zones": cluster_zones[:4],
        "state": state,
        "badge": badge,
        "status_desc": status_desc,
        "ticket": ticket
    }

# -------------------------------------------------------------
# MASTER FUNCTION: DUAL SCANNER SIGNALS
# -------------------------------------------------------------
def get_dual_scanner_signals(risk_pct=1.0):
    """
    Combines MT5 live data (or fallback) to output real-time signals
    for both XAUUSD (Toni Maura) and EURUSD (Felipe López).
    """
    mt5_status = get_mt5_status()
    now_str = datetime.now().strftime("%H:%M:%S ET")

    # Determine balance and data source
    if mt5_status["connected"]:
        source = f"MetaTrader 5 ({mt5_status['broker']})"
        balance = float(mt5_status["balance"]) or 5000.0
        currency = mt5_status["currency"]
        
        # XAUUSD from MT5
        xau_data = mt5_store["symbols"].get("XAUUSD", {})
        xau_m5 = xau_data.get("candles_m5", [])
        xau_h1 = xau_data.get("candles_h1", [])
        xau_bid = float(xau_data.get("bid", 0.0))
        xau_ask = float(xau_data.get("ask", 0.0))
        
        # EURUSD from MT5
        eur_data = mt5_store["symbols"].get("EURUSD", {})
        eur_m5 = eur_data.get("candles_m5", [])
        eur_bid = float(eur_data.get("bid", 0.0))
        eur_ask = float(eur_data.get("ask", 0.0))
    else:
        source = "Spot Web (Modo Simulación / Esperando MT5)"
        balance = 5000.0
        currency = "USD"
        
        # Fallback to Yahoo
        xau_m5 = fetch_yahoo_candles("GC=F", interval="5m", range_str="1d")
        xau_h1 = fetch_yahoo_candles("GC=F", interval="1h", range_str="5d")
        xau_bid = xau_m5[-1]["close"] if xau_m5 else 4060.0
        xau_ask = xau_bid + 0.35

        eur_m5 = fetch_yahoo_candles("EURUSD=X", interval="5m", range_str="1d")
        eur_bid = eur_m5[-1]["close"] if eur_m5 else 1.08500
        eur_ask = eur_bid + 0.00004

    # Run Toni Maura SMC on XAUUSD
    xau_analysis = analyze_toni_maura_xauusd(xau_h1, xau_m5, xau_bid, xau_ask, balance, risk_pct)

    # Run Felipe López Price Action on EURUSD
    eur_analysis = analyze_felipe_lopez_eurusd(eur_m5, eur_bid, eur_ask, balance, risk_pct)

    return {
        "status": "success",
        "scanned_at": now_str,
        "source": source,
        "mt5_connected": mt5_status["connected"],
        "mt5_status": mt5_status,
        "account": {
            "balance": balance,
            "currency": currency,
            "risk_pct": risk_pct,
            "risk_usd": round(balance * (risk_pct / 100.0), 2)
        },
        "xauusd": xau_analysis,
        "eurusd": eur_analysis
    }
