"""
Adaptive Supertrend Multimethod (Creative Quant) - Motor de Cálculo en Python para XAU/USD (Oro 5m)
Configuración optimizada institucional para sesión New York.
"""

import math

CONFIG_OPTIMIZADA = {
    # 1. Configuración Base
    "base_atr_period": 14,          # Calibrado de 8 a 14 para absorber el ruido de velas de expansión
    "base_multiplier": 3.0,          # Calibrado de 2.2 a 3.0 para evitar giros falsos en rangos
    
    # 2. Selección Automática / Override
    "auto_selection_enabled": True,
    "selection_criteria": "Total Points",  # Prioriza acumulación neta de puntos
    "evaluation_interval_bars": 60,        # 60 velas M5 = 5 horas de sesión
    "min_trades_required": 6,
    "performance_lookback_days": 7,
    "manual_override_method": "Hybrid",
    
    # 3. Método Percentil
    "percentile_lookback": 100,      # 100 velas M5 = ~8 horas de sesión
    "percentile_sensitivity": 0.4,   # Reducido para no sobrerreaccionar a noticias
    
    # 4. Método Régimen
    "regime_ma_length": 50,          # Suavizado para marcar tendencia de la sesión
    "low_vol_multiplier": 2.0,       # Ceñido en baja volatilidad para cazar explosión
    "normal_vol_multiplier": 2.8,
    "high_vol_multiplier": 3.5,      # Espacio amplio para mechas de alta volatilidad
    
    # 5. Método Z-Score
    "z_score_lookback": 100,
    "z_score_sensitivity": 0.25,
    
    # 6. Periodo Dinámico
    "min_atr_period": 10,            # Mínimo 10 para evitar hipersensibilidad
    "max_atr_period": 20,            # Máximo 20 para consolidaciones
    "period_change_sensitivity": 40,
    
    # 7. Rate of Change (ROC)
    "roc_lookback": 14,              # 14 velas M5 = 70 minutos de impulso inicial
    "roc_sensitivity": 0.40,
    
    # 8. Multi-Timeframe (MTF)
    "higher_tf": "1h",
    "mtf_sensitivity": 0.5,
    
    # 9. Suavizado Híbrido
    "hybrid_smoothing_ema": 5,       # 5 velas EMA para eliminar parpadeo en Dojis
    
    # 10. Modo de Señal
    "signal_mode": "on_close",       # Rigurosamente al cierre de la vela de 5 minutos
    
    # 11. Filtros de Momentum
    "rsi_filter_enabled": True,
    "rsi_length": 14,                # Estándar libre de ruido
    "rsi_buy_threshold": 55,         # Compras solo si RSI > 55
    "rsi_sell_threshold": 45,        # Ventas solo si RSI < 45
    
    "macd_filter_enabled": True,
    "macd_fast": 8,
    "macd_slow": 21,
    "macd_signal": 5,
    
    # 12. Salidas & Targets (R:R)
    "trailing_sl_enabled": True,
    "tsl_atr_multiplier": 2.2,       # No ahogar la operación
    "target_method": "R:R",          # Alineado con la Calculadora del Dashboard
    "target_1_rr": 1.5,              # Parciales & Mover a Breakeven
    "target_2_rr": 3.0,              # Salida principal
    "target_3_rr": 5.0               # Expansión macro
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

def analyze_adaptive_supertrend(candles, config=None, daily_bias="BEARISH"):
    """
    Calcula el estado del Adaptive Supertrend Multimethod en velas M5 cerradas.
    Retorna el estado exacto, dirección, bandas de precio, stop loss y niveles de take profit.
    """
    cfg = dict(CONFIG_OPTIMIZADA)
    if config:
        cfg.update(config)
        
    if not candles or len(candles) < 20:
        return {
            "status": "WAITING_DATA",
            "message": "Esperando histórico de velas M5...",
            "direction": "NEUTRAL"
        }
        
    last_candle = candles[-1]
    close_price = last_candle["close"]
    high_price = last_candle["high"]
    low_price = last_candle["low"]
    
    atr_val = calculate_atr(candles, cfg["base_atr_period"])
    rsi_val = calculate_rsi(candles, cfg["rsi_length"])
    macd_data = calculate_macd(candles, cfg["macd_fast"], cfg["macd_slow"], cfg["macd_signal"])
    
    # Multiplicador adaptativo según el régimen de volatilidad
    # Compara ATR actual con la media de ATR
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
    
    # Determinar dirección preliminar por acción del precio respecto al pivot
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
        sl_points = max(round(abs(close_price - sl_price) * 100, 1), 200.0) # En puntos de oro
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
        
    # Confluencia con el Sesgo Diario Macro
    daily_bias_upper = str(daily_bias).upper()
    has_confluence = (
        (daily_bias_upper == "BULLISH" and indicator_signal == "BUY") or
        (daily_bias_upper == "BEARISH" and indicator_signal == "SELL")
    )
    
    is_filtered_against_bias = (
        (daily_bias_upper == "BULLISH" and indicator_signal == "SELL") or
        (daily_bias_upper == "BEARISH" and indicator_signal == "BUY")
    )

    return {
        "status": "ACTIVE",
        "ticker": "XAUUSD",
        "timeframe": "5m",
        "feed": "Tickmill",
        "current_price": round(close_price, 2),
        "indicator_signal": indicator_signal,
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
