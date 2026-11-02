"""
Adaptive Supertrend Multimethod (Creative Quant) - Motor de Cálculo en Python para XAU/USD (Oro 5m)
Configuración optimizada institucional para sesión New York.
"""

import math
import time
from datetime import datetime

CONFIG_OPTIMIZADA = {
    # 1. Configuración de Auto-Selección (Auto-Selection)
    "auto_selection_enabled": True,
    "selection_criteria": "Total Points",  # Prioriza acumulación neta de puntos
    "evaluation_interval_bars": 70,        # 70 velas M5 (~6 horas de sesión activa)
    "min_trades_required": 7,              # 7 operaciones mínimas para evaluar método
    "performance_lookback_days": 6,        # 6 días de histórico semanal
    "manual_override_method": "Multi-Timeframe",  # Override fijado en MTF
    
    # 2. Configuración Base (Basic Settings)
    "base_atr_period": 13,                 # ATR Period exacto: 13
    "base_multiplier": 2.9,                # Multiplicador exacto: 2.9
    
    # 3. Método Percentil (Percentile Method)
    "percentile_lookback": 110,            # 110 velas M5
    "percentile_sensitivity": 0.4,         # Sensibilidad: 0.4
    
    # 4. Método Régimen de Volatilidad (Regime Method)
    "regime_ma_length": 45,                # Media móvil de régimen: 45
    "low_vol_multiplier": 2.0,             # Multiplicador en baja volatilidad: 2.0
    "normal_vol_multiplier": 2.7,          # Multiplicador en normal volatilidad: 2.7
    "high_vol_multiplier": 3.3,            # Multiplicador en alta volatilidad: 3.3
    
    # 5. Método Z-Score (Z-Score Method)
    "z_score_lookback": 100,               # Z-Score Lookback: 100
    "z_score_sensitivity": 0.25,           # Z-Score Sensibilidad: 0.25
    
    # 6. Periodo Dinámico (Dynamic Period Method)
    "min_atr_period": 9,                   # Min ATR Period: 9
    "max_atr_period": 19,                  # Max ATR Period: 19
    "period_change_sensitivity": 40,       # Period Change Sensitivity: 40
    
    # 7. Rate of Change (ROC Method)
    "roc_lookback": 14,                    # ROC Lookback: 14 velas
    "roc_sensitivity": 0.4,                # ROC Sensibilidad: 0.4
    
    # 8. Multi-Timeframe (MTF Method)
    "higher_tf": "1h",                     # Higher Timeframe: 1 hora
    "mtf_sensitivity": 0.5,                # MTF Sensibilidad: 0.5
    
    # 9. Suavizado Híbrido (Hybrid Settings)
    "hybrid_smoothing_ema": 5,             # EMA 5 velas
    
    # 10. Modo de Señal (Signal Settings)
    "signal_mode": "on_close",             # On Candle Close (Al cierre de vela)
    
    # 11. Salidas, Trailing Stop y Targets (Trailing SL & Target)
    "trailing_sl_enabled": False,          # Enable Trailing Stop Loss: Desmarcado
    "trailing_sl_method": "ATR",
    "tsl_atr_multiplier": 2.2,             # TSL ATR Multiplier: 2.2
    "tsl_pct": 1.0,                        # TSL %: 1%
    "tsl_fixed_points": 250,               # TSL Fixed Points: 250
    "show_trailing_sl_line": True,         # Línea guía naranja activa
    "alert_when_hits_tsl": True,
    
    "enable_targets": True,                # Targets habilitados
    "target_method": "RR Ratio",           # Ratio R:R
    "target_1_rr": 1.5,                    # Target 1 R:R: 1.5
    "target_2_rr": 3.0,                    # Target 2 R:R: 3.0
    "target_3_rr": 5.0,                    # Target 3 R:R: 5.0
    "target_1_fixed_points": 50,
    "target_2_fixed_points": 100,
    "target_3_fixed_points": 150,
    "show_target_lines": True,             # Líneas cian activas en gráfico
    "alert_when_hits_target": True,        # Alerta al tocar target activa
    
    # 12. Visualización (Display Settings)
    "show_info_table": False,              # Tabla flotante desactivada para gráfico limpio
    "show_all_methods_comparison": False,  # Comparativa múltiple desactivada
    "table_position": "Bottom Right",
    "table_text_size": "Tiny",
    
    # 13. Filtros de Momentum (Momentum Filters)
    "rsi_filter_enabled": True,            # Filtro RSI habilitado
    "rsi_length": 14,                      # RSI Periodo: 14
    "rsi_buy_threshold": 55,               # Compras solo si RSI > 55
    "rsi_sell_threshold": 45,              # Ventas solo si RSI < 45
    
    "macd_filter_enabled": True,           # Filtro MACD habilitado
    "macd_fast": 8,                        # MACD Fast: 8
    "macd_slow": 21,                       # MACD Slow: 21
    "macd_signal": 5                       # MACD Signal: 5
}

def calculate_tr(high, low, close_prev):
    return max(high - low, abs(high - close_prev), abs(low - close_prev))

def calculate_atr(candles, period=14):
    """Calcula el Average True Range (Wilder's Smoothing)."""
    if len(candles) < period + 1:
        return 0.0
    
    tr_list = []
    for i in range(1, len(candles)):
        h = candles[i]["high"]
        l = candles[i]["low"]
        cp = candles[i-1]["close"]
        tr_list.append(calculate_tr(h, l, cp))
        
    if len(tr_list) < period:
        return 0.0
        
    atr = sum(tr_list[:period]) / period
    for i in range(period, len(tr_list)):
        atr = (atr * (period - 1) + tr_list[i]) / period
    return atr

def calculate_rsi(candles, period=14):
    """Calcula el Relative Strength Index estándar."""
    if len(candles) < period + 1:
        return 50.0
    
    gains = []
    losses = []
    for i in range(1, len(candles)):
        diff = candles[i]["close"] - candles[i-1]["close"]
        if diff >= 0:
            gains.append(diff)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(diff))
            
    if len(gains) < period:
        return 50.0
        
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))

def calculate_ema(values, period):
    if not values or len(values) < period:
        return values[-1] if values else 0.0
    k = 2.0 / (period + 1.0)
    ema = sum(values[:period]) / period
    for v in values[period:]:
        ema = (v * k) + (ema * (1.0 - k))
    return ema

def calculate_macd(candles, fast=8, slow=21, signal=5):
    """Calcula MACD Fast, Slow, Línea de Señal e Histograma."""
    closes = [c["close"] for c in candles]
    if len(closes) < slow + signal:
        return {"macd": 0.0, "signal": 0.0, "hist": 0.0, "bullish": False, "bearish": False}
    
    # Calcular serie de MACD
    macd_series = []
    for i in range(slow, len(closes) + 1):
        sub_closes = closes[:i]
        ema_fast = calculate_ema(sub_closes, fast)
        ema_slow = calculate_ema(sub_closes, slow)
        macd_series.append(ema_fast - ema_slow)
        
    if len(macd_series) < signal:
        macd_val = macd_series[-1]
        return {"macd": macd_val, "signal": macd_val, "hist": 0.0, "bullish": macd_val > 0, "bearish": macd_val < 0}
        
    sig_val = calculate_ema(macd_series, signal)
    macd_val = macd_series[-1]
    hist = macd_val - sig_val
    
    return {
        "macd": round(macd_val, 3),
        "signal": round(sig_val, 3),
        "hist": round(hist, 3),
        "bullish": hist > 0 and macd_val > 0,
        "bearish": hist < 0 and macd_val < 0
    }

def get_tickmill_candle_timing(offset_seconds=120):
    dt = datetime.now()
    sec_in_hour = dt.minute * 60 + dt.second
    norm_sec = (sec_in_hour - offset_seconds + 3600) % 3600
    sec_in_5m = norm_sec % 300
    rem_sec = 300 - sec_in_5m
    
    # Dentro de los primeros 45 segundos del bloque de 5m -> Vela recién cerrada (ventana de confirmación)
    is_just_closed = sec_in_5m <= 45
    # Desde el segundo 46 hasta 299 -> Vela en pleno desarrollo (formación)
    is_in_development = sec_in_5m > 45
    
    min_rem = rem_sec // 60
    sec_rem = rem_sec % 60
    rem_str = f"{min_rem:02d}:{sec_rem:02d}"
    
    return {
        "seconds_in_5m": sec_in_5m,
        "remaining_seconds": rem_sec,
        "remaining_formatted": rem_str,
        "is_just_closed": is_just_closed,
        "is_in_development": is_in_development
    }

def analyze_adaptive_supertrend(candles, config=None, daily_bias="BEARISH", force_state=None, offset_seconds=120):
    """
    Calcula el estado del Adaptive Supertrend Multimethod en velas M5 de Tickmill.
    Distingue rigurosamente entre:
      1. "EN_DESARROLLO": Vela abierta en formación. NO se confirma, solo indica 'Compra/Venta en desarrollo, esperar'.
      2. "CONFIRMADA_AL_CIERRE": Vela M5 cerrada en :02, :07, :12... Gatillo 4/4 activo.
      3. "ALREADY_TRIGGERED": Señal anterior ya se dio y el precio está en recorrido. Esperar siguiente setup.
    """
    cfg = dict(CONFIG_OPTIMIZADA)
    if config:
        cfg.update(config)
        
    timing = get_tickmill_candle_timing(offset_seconds)
    
    if not candles or len(candles) < 20:
        return {
            "status": "WAITING_DATA",
            "message": "Esperando histórico de velas M5...",
            "direction": "NEUTRAL",
            "candle_state": "WAITING"
        }
        
    last_candle = candles[-1]
    close_price = last_candle["close"]
    high_price = last_candle["high"]
    low_price = last_candle["low"]
    
    atr_val = calculate_atr(candles, cfg["base_atr_period"])
    rsi_val = calculate_rsi(candles, cfg["rsi_length"])
    macd_data = calculate_macd(candles, cfg["macd_fast"], cfg["macd_slow"], cfg["macd_signal"])
    
    # Multiplicador adaptativo según el régimen de volatilidad
    atrs_recent = [calculate_atr(candles[:i], cfg["base_atr_period"]) for i in range(len(candles) - 15, len(candles))]
    avg_atr = sum(atrs_recent) / max(len(atrs_recent), 1)
    
    vol_ratio = (atr_val / avg_atr) if avg_atr > 0 else 1.0
    if vol_ratio > 1.3:
        effective_multiplier = cfg["high_vol_multiplier"]
        regime = "HIGH_VOLATILITY"
    elif vol_ratio < 0.8:
        effective_multiplier = cfg["low_vol_multiplier"]
        regime = "LOW_VOLATILITY"
    else:
        effective_multiplier = cfg["normal_vol_multiplier"]
        regime = "NORMAL_VOLATILITY"
        
    band_distance = atr_val * effective_multiplier
    hl2 = (high_price + low_price) / 2.0
    upper_band = hl2 + band_distance
    lower_band = hl2 - band_distance
    
    # Filtros de Momentum:
    rsi_allows_buy = rsi_val >= cfg["rsi_buy_threshold"]
    rsi_allows_sell = rsi_val <= cfg["rsi_sell_threshold"]
    
    # Dirección sugerida por el indicador adaptativo
    if close_price > hl2 and rsi_allows_buy and macd_data["hist"] >= 0:
        indicator_signal = "BUY"
        sl_price = lower_band
        sl_points = max(round(abs(close_price - sl_price) * 100, 1), 200.0)
        tp1_price = close_price + (sl_points / 100.0 * cfg["target_1_rr"])
        tp2_price = close_price + (sl_points / 100.0 * cfg["target_2_rr"])
        tp3_price = close_price + (sl_points / 100.0 * cfg["target_3_rr"])
    elif close_price < hl2 and rsi_allows_sell and macd_data["hist"] <= 0:
        indicator_signal = "SELL"
        sl_price = upper_band
        sl_points = max(round(abs(sl_price - close_price) * 100, 1), 250.0)
        tp1_price = close_price - (sl_points / 100.0 * cfg["target_1_rr"])
        tp2_price = close_price - (sl_points / 100.0 * cfg["target_2_rr"])
        tp3_price = close_price - (sl_points / 100.0 * cfg["target_3_rr"])
    else:
        indicator_signal = "NEUTRAL"
        sl_price = hl2
        sl_points = 250.0
        tp1_price = close_price
        tp2_price = close_price
        tp3_price = close_price
        
    # Evaluar dirección de la vela anterior (para distinguir señal nueva de señal ya ejecutada)
    prev_signal = "NEUTRAL"
    if len(candles) >= 22:
        prev_sub = candles[:-1]
        p_last = prev_sub[-1]
        p_close = p_last["close"]
        p_hl2 = (p_last["high"] + p_last["low"]) / 2.0
        p_rsi = calculate_rsi(prev_sub, cfg["rsi_length"])
        p_macd = calculate_macd(prev_sub, cfg["macd_fast"], cfg["macd_slow"], cfg["macd_signal"])
        if p_close > p_hl2 and p_rsi >= cfg["rsi_buy_threshold"] and p_macd["hist"] >= 0:
            prev_signal = "BUY"
        elif p_close < p_hl2 and p_rsi <= cfg["rsi_sell_threshold"] and p_macd["hist"] <= 0:
            prev_signal = "SELL"

    is_signal_flip = (indicator_signal != "NEUTRAL" and indicator_signal != prev_signal)
    is_signal_ongoing = (indicator_signal != "NEUTRAL" and indicator_signal == prev_signal)

    # Determinar el estado de ciclo de vela
    if force_state:
        candle_state = force_state
    elif timing["is_in_development"]:
        # Durante la formación de la vela:
        # Si la señal ya venía activa de velas anteriores -> ALREADY_TRIGGERED (esperar siguiente setup)
        # Si está oscilando o cambiando -> EN_DESARROLLO (esperar cierre oficial)
        if is_signal_ongoing:
            candle_state = "ALREADY_TRIGGERED"
        else:
            candle_state = "EN_DESARROLLO"
    else:
        # Ventana inmediata tras cierre de vela M5 (:02 Tickmill, primeros 45 segundos)
        if is_signal_flip:
            candle_state = "CONFIRMADA_AL_CIERRE"
        elif is_signal_ongoing:
            candle_state = "ALREADY_TRIGGERED"
        else:
            candle_state = "EN_DESARROLLO"
        
    is_confirmed = (candle_state == "CONFIRMADA_AL_CIERRE")
    
    # Confluencia con el Sesgo Diario Macro (SOLO SE VALIDA SI ESTÁ CONFIRMADA AL CIERRE)
    daily_bias_upper = str(daily_bias).upper()
    has_confluence = is_confirmed and (
        (daily_bias_upper == "BULLISH" and indicator_signal == "BUY") or
        (daily_bias_upper == "BEARISH" and indicator_signal == "SELL")
    )
    
    is_filtered_against_bias = (
        (daily_bias_upper == "BULLISH" and indicator_signal == "SELL") or
        (daily_bias_upper == "BEARISH" and indicator_signal == "BUY")
    )

    # Títulos y mensajes según el estado exacto solicitado
    if candle_state == "EN_DESARROLLO":
        if indicator_signal == "BUY":
            display_title = "COMPRA EN DESARROLLO (Esperar)"
            display_timing = f"Vela en formación ({timing['remaining_formatted']} restantes)"
            status_banner = f"⏳ <strong>COMPRA EN DESARROLLO:</strong> Vela M5 abierta y oscilando. NO CONFIRMAR NI DISPARAR ENTRADA. Esperar al cierre exacto ({timing['remaining_formatted']}) en Tickmill."
        elif indicator_signal == "SELL":
            display_title = "VENTA EN DESARROLLO (Esperar)"
            display_timing = f"Vela en formación ({timing['remaining_formatted']} restantes)"
            status_banner = f"⏳ <strong>VENTA EN DESARROLLO:</strong> Vela M5 abierta y oscilando. NO CONFIRMAR NI DISPARAR ENTRADA. Esperar al cierre exacto ({timing['remaining_formatted']}) en Tickmill."
        else:
            display_title = "CONSOLIDACIÓN EN DESARROLLO (Esperar)"
            display_timing = f"Vela en formación ({timing['remaining_formatted']} restantes)"
            status_banner = f"⏳ <strong>VELA EN FORMACIÓN:</strong> Esperando cierre M5 ({timing['remaining_formatted']}) para evaluar confluencia."
    elif candle_state == "ALREADY_TRIGGERED":
        display_title = "SEÑAL ANTERIOR YA EJECUTADA · ESPERAR PRÓXIMO SETUP"
        display_timing = "Trade en curso · Prohibido perseguir el precio"
        status_banner = "🛡️ <strong>DISCIPLINA INSTITUCIONAL:</strong> La señal anterior ya se activó y el trade está en desarrollo. No perseguir el mercado; esperar pacientemente al siguiente setup."
    else: # CONFIRMADA_AL_CIERRE
        if has_confluence:
            display_title = f"{'COMPRA' if indicator_signal == 'BUY' else 'VENTA'} CONFIRMADA AL CIERRE ({indicator_signal} M5)"
            display_timing = "✓ Cierre Confirmado · Ventana de Entrada Activa"
            status_banner = f"🔥 <strong>¡GATILLO CONFIRMADO AL CIERRE DE VELA!</strong> Señal de {indicator_signal} M5 @ ${round(close_price, 2)} validada con confluencia 4/4 A+. Dispara en tu broker y anota el trade."
        else:
            display_title = f"{indicator_signal} AL CIERRE (FILTRADO CONTRA SESGO)"
            display_timing = "Descartado por ir contra el sesgo diario"
            status_banner = f"⚠️ <strong>SEÑAL FILTRADA:</strong> Señal técnica de {indicator_signal} descartada por oponerse al sesgo macro {daily_bias_upper}."

    return {
        "status": "ACTIVE",
        "ticker": "XAUUSD",
        "timeframe": "5m",
        "feed": "Tickmill",
        "current_price": round(close_price, 2),
        "indicator_signal": indicator_signal,
        "candle_state": candle_state,              # "EN_DESARROLLO" / "CONFIRMADA_AL_CIERRE" / "ALREADY_TRIGGERED"
        "is_confirmed": is_confirmed,
        "display_title": display_title,
        "display_timing": display_timing,
        "status_banner": status_banner,
        "timing": timing,
        "daily_bias": daily_bias_upper,
        "has_confluence": has_confluence,
        "is_filtered_against_bias": is_filtered_against_bias,
        "regime": regime,
        "atr": round(atr_val, 2),
        "multiplier_used": effective_multiplier,
        "rsi": round(rsi_val, 1),
        "macd_hist": macd_data["hist"],
        "sl_price": round(sl_price, 2),
        "sl_points": round(sl_points, 1),
        "target_1_price": round(tp1_price, 2),
        "target_2_price": round(tp2_price, 2),
        "target_3_price": round(tp3_price, 2),
        "target_1_rr": cfg["target_1_rr"],
        "target_2_rr": cfg["target_2_rr"],
        "target_3_rr": cfg["target_3_rr"],
        "timestamp": last_candle.get("time", "")
    }

if __name__ == "__main__":
    # Test básico del motor
    dummy_candles = [
        {"high": 3915.0 - i*0.2, "low": 3908.0 - i*0.2, "close": 3910.0 - i*0.2, "time": f"2026-11-02 02:{i:02d}:00"}
        for i in range(30)
    ]
    res = analyze_adaptive_supertrend(dummy_candles, daily_bias="BEARISH")
    print("Adaptive Supertrend Engine Test Result:")
    for k, v in res.items():
        print(f"  {k}: {v}")
