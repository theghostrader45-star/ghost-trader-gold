//+------------------------------------------------------------------+
//|                                   SessionManipulation_EURUSD.mq5 |
//|                 Estrategia Institucional de Manipulación de Sesiones |
//|                (Tokio, Londres & Nueva York - Metodología M5)     |
//|               Basado en la Estrategia Documentada de Mati Maderna |
//+------------------------------------------------------------------+
#property copyright   "Pro Terminal Institutional Trading"
#property link        "https://ghost-trader-gold.onrender.com"
#property version     "1.00"
#property description "EA Automático de Manipulación de Sesiones en EUR/USD (M5)"
#property description "Detecta barrido de liquidez de Asia/Londres, FVG e Imbalance en 50% Fibo"
#property description "Gestión de Riesgo y R:R 100% manual con detección automática de horario del broker"

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\OrderInfo.mqh>
#include <Trade\AccountInfo.mqh>

//--- Enums de Configuración
enum ENUM_LOT_MODE
{
   LOT_RISK_PERCENT = 0, // % de Riesgo sobre Balance (Manual)
   LOT_FIXED        = 1, // Lotaje Fijo Manual (ej: 0.02)
   LOT_RISK_USD     = 2  // Monto Fijo en Dólares ($ USD por Trade)
};

//====================================================================
// PARÁMETROS DE ENTRADA (INPUTS)
//====================================================================

//--- 1. GESTIÓN DE RIESGO (100% MANUAL)
input group "=== 1. GESTIÓN DE RIESGO MANUAL ==="
input ENUM_LOT_MODE InpLotMode           = LOT_RISK_PERCENT; // Modo de Lotaje
input double        InpRiskPercent       = 1.0;              // Riesgo % por Operación (ej: 0.5, 1.0, 2.0, 3.0)
input double        InpFixedLot          = 0.01;             // Lotaje Fijo (si se usa modo Lote Fijo)
input double        InpRiskUSD           = 2.0;              // Riesgo Fijo en USD (si se usa modo USD)
input double        InpRiskRewardRatio   = 2.0;              // Ratio Riesgo:Beneficio (R:R Manual, ej: 2.0 = 1:2)
input double        InpSlBufferPips      = 1.0;              // Buffer de Stop Loss tras la mecha (Pips)
input double        InpMinSlPips         = 5.0;              // Stop Loss Mínimo de Seguridad (Pips)
input bool          InpEnableBreakEven   = true;             // Mover a Breakeven al alcanzar 1:1 R:R
input double        InpBeLockPips        = 0.5;              // Pips protegidos en Breakeven (comisiones)

//--- 2. HORARIO & DETECCIÓN AUTOMÁTICA DEL BROKER
input group "=== 2. HORARIO AUTOMÁTICO DEL BROKER ==="
input bool          InpAutoGmtOffset     = true;             // Auto-detectar desfase GMT del Broker (Recomendado)
input int           InpManualGmtOffset   = 2;                // Desfase GMT Manual si Auto = false (ej: +2 o +3)
input int           InpMaxSessionHours   = 3;                // Ventana Máxima de Entrada (3 horas post-apertura)

// Horarios de Sesiones en Tiempo Universal GMT / UTC
input int           InpAsiaStartHourGMT  = 0;                // Inicio Tokio/Asia GMT (00:00 GMT)
input int           InpAsiaEndHourGMT    = 7;                // Fin Tokio/Asia GMT (07:00 GMT / Pre-Londres)
input int           InpLondonStartGMT    = 7;                // Apertura Londres GMT (07:00 GMT)
input int           InpNYStartGMT        = 13;               // Apertura Nueva York GMT (13:00 GMT / 08:00 NY)

//--- 3. FILTRO RSI POTENCIADOR (OPCIONAL)
input group "=== 3. FILTRO RSI POTENCIADOR ==="
input bool          InpUseRsiBooster     = false;            // Duplicar riesgo si la manipulación coincide con RSI extremo
input double        InpBoosterRiskPct    = 2.0;              // % de Riesgo Potenciado con RSI
input int           InpRsiPeriod         = 14;               // Período RSI
input double        InpRsiOverbought     = 70.0;             // Nivel Sobrecompra
input double        InpRsiOversold       = 30.0;             // Nivel Sobreventa

//--- 4. FILTROS DE SEGURIDAD & EJECUCIÓN
input group "=== 4. SEGURIDAD & EJECUCIÓN ==="
input ulong         InpMagicNumber       = 992211;           // Magic Number Único
input string        InpTradeComment      = "Session PA EA";  // Comentario de Orden
input double        InpMaxSpreadPips     = 1.5;              // Spread Máximo Permitido (Pips)
input int           InpMaxTradesPerDay   = 2;                // Máximo de Operaciones por Día (1 Londres + 1 NY)
input bool          InpTradeLondon       = true;             // Operar Sesión de Londres
input bool          InpTradeNY           = true;             // Operar Sesión de Nueva York

//--- 5. ESTÉTICA VISUAL & TELEMETRÍA PRO TERMINAL
input group "=== 5. VISUALIZACIÓN & PRO TERMINAL ==="
input bool          InpShowVisualBoxes   = true;             // Dibujar Rangos de Asia y Manipulación en Pantalla
input color         InpColorAsiaBox      = C'15,50,110';     // Color Rango Asia
input color         InpColorSweep        = clrGold;          // Color Marcador de Manipulación
input bool          InpShowHUD           = true;             // Mostrar Panel Táctico en Pantalla
input bool          InpEnableBridge      = true;             // Enviar Telemetría en Vivo al Dashboard Web
input string        InpServerUrl         = "https://ghost-trader-gold.onrender.com/api/mt5/feed";

//====================================================================
// ESTRUCTURAS & VARIABLES GLOBALES
//====================================================================
CTrade         m_trade;
CPositionInfo  m_position;
CAccountInfo   m_account;

enum ENUM_SETUP_STATE
{
   STATE_IDLE               = 0, // Esperando sesión
   STATE_MONITORING_SWEEP   = 1, // Buscando toma de liquidez
   STATE_SWEEP_CONFIRMED    = 2, // Manipulación detectada, esperando FVG e impulso
   STATE_WAITING_RETEST     = 3, // FVG y 50% Fibo listos, esperando testeo
   STATE_IN_TRADE           = 4  // Operación activa
};

struct SessionData
{
   datetime day_start;
   double   asia_high;
   double   asia_low;
   bool     asia_closed;
   
   double   london_high;
   double   london_low;
   bool     london_closed;
   
   // Setup actual
   ENUM_SETUP_STATE state;
   string   direction;       // "BUY" o "SELL"
   string   session_name;    // "LONDRES" o "NEW_YORK"
   double   sweep_price;     // Nivel extremo de la manipulación (para SL)
   double   fibo_50_level;   // Nivel 50% Fibonacci
   double   fvg_top;         // Límite superior FVG
   double   fvg_bottom;      // Límite inferior FVG
   double   target_entry;    // Precio proyectado de entrada
   datetime setup_time;      // Hora de detección
   bool     rsi_confirmed;   // Coincidió con RSI extremo
   int      trades_today;    // Operaciones metidas hoy
   int      london_trades;   // Operaciones en Londres
   int      ny_trades;       // Operaciones en NY
};

SessionData g_session;
int         g_rsi_handle     = INVALID_HANDLE;
datetime    g_last_telemetry = 0;
datetime    g_last_bar_time  = 0;
int         g_broker_gmt_offset = 0;

//+------------------------------------------------------------------+
//| Auto-detección del desfase horario del Broker respecto a GMT      |
//+------------------------------------------------------------------+
int DetectBrokerGmtOffset()
{
   if(!InpAutoGmtOffset) return InpManualGmtOffset;
   
   datetime srv = TimeCurrent();
   datetime gmt = TimeGMT();
   if(gmt <= 0) return InpManualGmtOffset;
   
   int diff_sec = (int)(srv - gmt);
   int offset_hours = (int)MathRound((double)diff_sec / 3600.0);
   return offset_hours;
}

// Convierte hora GMT a hora servidor del broker
int GmtToBrokerHour(int gmt_hour)
{
   int srv_hour = gmt_hour + g_broker_gmt_offset;
   if(srv_hour >= 24) srv_hour -= 24;
   if(srv_hour < 0)   srv_hour += 24;
   return srv_hour;
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Verificar símbolo
   if(StringFind(_Symbol, "EUR") < 0 && StringFind(_Symbol, "eur") < 0)
   {
      Print("⚠️ [ADVERTENCIA] Este EA está optimizado para EUR/USD. Símbolo actual: ", _Symbol);
   }

   // Configuración de CTrade
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetMarginMode();
   m_trade.SetTypeFillingBySymbol(_Symbol);
   m_trade.SetDeviationInPoints(20);

   // Inicializar indicador RSI
   g_rsi_handle = iRSI(_Symbol, PERIOD_M5, InpRsiPeriod, PRICE_CLOSE);
   if(g_rsi_handle == INVALID_HANDLE)
   {
      Print("❌ Error al crear indicador RSI: ", GetLastError());
   }

   // Calcular offset GMT inicial
   g_broker_gmt_offset = DetectBrokerGmtOffset();
   PrintFormat("🟢 [PriceAction Session EA] Iniciado. Broker GMT Offset: %+d horas.", g_broker_gmt_offset);
   PrintFormat("   Londres abre a las %02d:00 Broker (07:00 GMT). Nueva York a las %02d:00 Broker (13:00 GMT).",
               GmtToBrokerHour(InpLondonStartGMT), GmtToBrokerHour(InpNYStartGMT));

   // Inicializar datos de sesión
   ResetDailySession();

   // Timer cada 2 segundos para monitoreo y telemetría fluida
   EventSetTimer(2);

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_rsi_handle != INVALID_HANDLE) IndicatorRelease(g_rsi_handle);
   Comment("");
   ObjectsDeleteAll(0, "PASess_");
   ChartRedraw(0);
   Print("🔴 [PriceAction Session EA] Detenido.");
}

//+------------------------------------------------------------------+
//| Reiniciar contadores para el nuevo día                           |
//+------------------------------------------------------------------+
void ResetDailySession()
{
   MqlDateTime dt;
   TimeCurrent(dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   datetime today_midnight = StructToTime(dt);

   if(g_session.day_start != today_midnight)
   {
      g_session.day_start     = today_midnight;
      g_session.asia_high     = 0.0;
      g_session.asia_low      = 999999.0;
      g_session.asia_closed   = false;
      g_session.london_high   = 0.0;
      g_session.london_low    = 999999.0;
      g_session.london_closed = false;
      g_session.state         = STATE_IDLE;
      g_session.direction     = "";
      g_session.trades_today  = 0;
      g_session.london_trades = 0;
      g_session.ny_trades     = 0;
      g_broker_gmt_offset     = DetectBrokerGmtOffset(); // Recalcular diariamente
   }
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   ResetDailySession();
   ManageTrailingAndBE();
   if(InpShowHUD) UpdateHUD();
   if(InpEnableBridge) SendTelemetryToDashboard();
}

//+------------------------------------------------------------------+
//| OnTick function                                                  |
//+------------------------------------------------------------------+
void OnTick()
{
   // Actualizar trailing stop & breakeven tick a tick
   ManageTrailingAndBE();

   // Solo evaluar nuevas aperturas al cierre de cada vela M5
   datetime current_bar_time = iTime(_Symbol, PERIOD_M5, 0);
   if(current_bar_time == g_last_bar_time) return;
   g_last_bar_time = current_bar_time;

   // 1. Monitoreo y captura del rango asiático (Tokio)
   UpdateSessionRanges();

   // 2. Evaluar condiciones de la estrategia de manipulación
   EvaluateStrategyExecution();

   if(InpShowHUD) UpdateHUD();
}

//+------------------------------------------------------------------+
//| Identifica los rangos de Tokio y Londres                         |
//+------------------------------------------------------------------+
void UpdateSessionRanges()
{
   MqlDateTime dt;
   TimeCurrent(dt);
   
   // Calcular hora actual en GMT
   datetime current_gmt = TimeGMT();
   MqlDateTime dt_gmt;
   TimeToStruct(current_gmt, dt_gmt);
   int hour_gmt = dt_gmt.hour;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, PERIOD_M5, 1, 2, rates) < 2) return;

   // Rango de Asia / Tokio (00:00 a 07:00 GMT)
   if(hour_gmt >= InpAsiaStartHourGMT && hour_gmt < InpAsiaEndHourGMT)
   {
      if(rates[0].high > g_session.asia_high) g_session.asia_high = rates[0].high;
      if(rates[0].low < g_session.asia_low)   g_session.asia_low  = rates[0].low;
      DrawAsiaRangeBox();
   }
   else if(hour_gmt >= InpAsiaEndHourGMT)
   {
      g_session.asia_closed = (g_session.asia_high > 0.0 && g_session.asia_low < 999999.0);
   }

   // Rango de Londres (acumular durante Londres para referencia de NY)
   if(hour_gmt >= InpLondonStartGMT && hour_gmt < InpNYStartGMT)
   {
      if(rates[0].high > g_session.london_high) g_session.london_high = rates[0].high;
      if(rates[0].low < g_session.london_low)   g_session.london_low  = rates[0].low;
   }
   else if(hour_gmt >= InpNYStartGMT)
   {
      g_session.london_closed = (g_session.london_high > 0.0 && g_session.london_low < 999999.0);
   }
}

//+------------------------------------------------------------------+
//| Evalúa la lógica de Manipulación + FVG + 50% Fibo                |
//+------------------------------------------------------------------+
void EvaluateStrategyExecution()
{
   // Si ya tenemos posición abierta con este MagicNumber, estamos en trade
   if(HasOpenPosition())
   {
      g_session.state = STATE_IN_TRADE;
      return;
   }

   // Si ya se alcanzó el límite diario de operaciones
   if(g_session.trades_today >= InpMaxTradesPerDay)
   {
      g_session.state = STATE_IDLE;
      return;
   }

   // Identificar hora GMT actual
   datetime current_gmt = TimeGMT();
   MqlDateTime dt_gmt;
   TimeToStruct(current_gmt, dt_gmt);
   int hour_gmt = dt_gmt.hour;

   // Determinar si estamos en ventana operativa de 3 horas
   bool in_london_window = InpTradeLondon && (hour_gmt >= InpLondonStartGMT && hour_gmt < (InpLondonStartGMT + InpMaxSessionHours));
   bool in_ny_window     = InpTradeNY     && (hour_gmt >= InpNYStartGMT     && hour_gmt < (InpNYStartGMT + InpMaxSessionHours));

   if(!in_london_window && !in_ny_window)
   {
      if(g_session.state != STATE_IDLE) g_session.state = STATE_IDLE;
      return;
   }

   // Verificar límite por sesión individual
   if(in_london_window && g_session.london_trades >= 1) return;
   if(in_ny_window && g_session.ny_trades >= 1) return;

   // Nivel de referencia para la toma de liquidez
   double ref_high = 0.0;
   double ref_low  = 0.0;
   string current_session = "";

   if(in_london_window && g_session.asia_closed)
   {
      ref_high = g_session.asia_high;
      ref_low  = g_session.asia_low;
      current_session = "LONDRES";
   }
   else if(in_ny_window && g_session.london_closed)
   {
      ref_high = g_session.london_high;
      ref_low  = g_session.london_low;
      current_session = "NEW_YORK";
   }
   else if(in_ny_window && g_session.asia_closed)
   {
      ref_high = g_session.asia_high;
      ref_low  = g_session.asia_low;
      current_session = "NEW_YORK";
   }

   if(ref_high <= 0.0 || ref_low >= 999999.0) return;

   // Obtener últimas 5 velas M5 cerradas
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, PERIOD_M5, 1, 6, rates) < 6) return;

   // -------------------------------------------------------------
   // FASE 1: DETECCIÓN DE LA MANIPULACIÓN (SWEEP / TOMA DE LIQUIDEZ)
   // -------------------------------------------------------------
   if(g_session.state == STATE_IDLE || g_session.state == STATE_MONITORING_SWEEP)
   {
      // Caso 1: BARRIDO ALCISTA (Toma liquidez de máximos -> Buscar VENTA)
      if(rates[1].high > ref_high && rates[0].close < ref_high)
      {
         g_session.state         = STATE_SWEEP_CONFIRMED;
         g_session.direction     = "SELL";
         g_session.session_name  = current_session;
         g_session.sweep_price   = MathMax(rates[1].high, rates[0].high);
         g_session.setup_time    = TimeCurrent();
         g_session.rsi_confirmed = CheckRsiExtreme("SELL");

         DrawSweepMarker(g_session.sweep_price, "SELL", ref_high);
         PrintFormat("🎯 [%s] ¡MANIPULACIÓN BAJISTA CONFIRMADA! Barrido sobre %.5f. Pico en %.5f.",
                     current_session, ref_high, g_session.sweep_price);
      }
      // Caso 2: BARRIDO BAJISTA (Toma liquidez de mínimos -> Buscar COMPRA)
      else if(rates[1].low < ref_low && rates[0].close > ref_low)
      {
         g_session.state         = STATE_SWEEP_CONFIRMED;
         g_session.direction     = "BUY";
         g_session.session_name  = current_session;
         g_session.sweep_price   = MathMin(rates[1].low, rates[0].low);
         g_session.setup_time    = TimeCurrent();
         g_session.rsi_confirmed = CheckRsiExtreme("BUY");

         DrawSweepMarker(g_session.sweep_price, "BUY", ref_low);
         PrintFormat("🎯 [%s] ¡MANIPULACIÓN ALCISTA CONFIRMADA! Barrido bajo %.5f. Mínimo en %.5f.",
                     current_session, ref_low, g_session.sweep_price);
      }
   }

   // -------------------------------------------------------------
   // FASE 2 & 3: DESPLAZAMIENTO, FVG E IDENTIFICACIÓN DEL 50% FIBONACCI
   // -------------------------------------------------------------
   if(g_session.state == STATE_SWEEP_CONFIRMED)
   {
      if(g_session.direction == "BUY")
      {
         // Buscar FVG Alcista: Vela 2 Low > Vela 0 High (en orden de serie rates[0], rates[1], rates[2])
         // En terminología: gap entre el High de la vela anterior y el Low de la vela posterior
         for(int i = 0; i <= 2; i++)
         {
            if(rates[i].low > rates[i+2].high)
            {
               double fvg_bot = rates[i+2].high;
               double fvg_top = rates[i].low;
               double fvg_size_pips = (fvg_top - fvg_bot) / (10 * _Point);
               
               if(fvg_size_pips >= 0.8) // Imbalance notable
               {
                  // Calcular Fibonacci 50% desde el mínimo de la manipulación hasta el máximo del impulso
                  double swing_high = MathMax(rates[0].high, rates[i].high);
                  double fibo_50 = g_session.sweep_price + 0.5 * (swing_high - g_session.sweep_price);
                  
                  // REGLA CLAVE DEL VIDEO: El FVG debe estar en la zona de descuento (al 50% o más de descuento)
                  if(fvg_bot <= fibo_50)
                  {
                     g_session.fvg_top       = fvg_top;
                     g_session.fvg_bottom    = fvg_bot;
                     g_session.fibo_50_level = fibo_50;
                     g_session.target_entry  = MathMin(fvg_top, fibo_50);
                     g_session.state         = STATE_WAITING_RETEST;
                     
                     DrawFiboAndFvg(g_session.sweep_price, swing_high, fibo_50, fvg_top, fvg_bot, "BUY");
                     PrintFormat("✅ FVG Alcista Detectado en zona 50%% Fibo: %.5f - %.5f. Esperando retroceso.", fvg_bot, fvg_top);
                     break;
                  }
               }
            }
         }
      }
      else if(g_session.direction == "SELL")
      {
         // Buscar FVG Bajista: Vela 0 Low < Vela 2 High
         for(int i = 0; i <= 2; i++)
         {
            if(rates[i].high < rates[i+2].low)
            {
               double fvg_top = rates[i+2].low;
               double fvg_bot = rates[i].high;
               double fvg_size_pips = (fvg_top - fvg_bot) / (10 * _Point);
               
               if(fvg_size_pips >= 0.8)
               {
                  // Calcular Fibonacci 50% desde el máximo de la manipulación hasta el mínimo del impulso
                  double swing_low = MathMin(rates[0].low, rates[i].low);
                  double fibo_50 = g_session.sweep_price - 0.5 * (g_session.sweep_price - swing_low);
                  
                  // REGLA CLAVE DEL VIDEO: El FVG debe estar en zona premium (al 50% o más)
                  if(fvg_top >= fibo_50)
                  {
                     g_session.fvg_top       = fvg_top;
                     g_session.fvg_bottom    = fvg_bot;
                     g_session.fibo_50_level = fibo_50;
                     g_session.target_entry  = MathMax(fvg_bot, fibo_50);
                     g_session.state         = STATE_WAITING_RETEST;
                     
                     DrawFiboAndFvg(g_session.sweep_price, swing_low, fibo_50, fvg_top, fvg_bot, "SELL");
                     PrintFormat("✅ FVG Bajista Detectado en zona 50%% Fibo: %.5f - %.5f. Esperando retroceso.", fvg_bot, fvg_top);
                     break;
                  }
               }
            }
         }
      }
   }

   // -------------------------------------------------------------
   // FASE 4: ENTRADA EN EL TESTEO DEL FVG / 50% FIBONACCI
   // -------------------------------------------------------------
   if(g_session.state == STATE_WAITING_RETEST)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double spread_pips = (ask - bid) / (10 * _Point);

      if(spread_pips > InpMaxSpreadPips) return; // Filtro de spread

      if(g_session.direction == "BUY")
      {
         // Entrada en compra al testear la zona del FVG / 50%
         if(bid <= g_session.fvg_top && bid >= (g_session.fvg_bottom - 0.00030))
         {
            ExecuteOrder("BUY", ask);
         }
      }
      else if(g_session.direction == "SELL")
      {
         // Entrada en venta al testear la zona del FVG / 50%
         if(ask >= g_session.fvg_bottom && ask <= (g_session.fvg_top + 0.00030))
         {
            ExecuteOrder("SELL", bid);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Ejecución de la orden en el mercado con SL y TP según RR Manual   |
//+------------------------------------------------------------------+
void ExecuteOrder(string dir, double current_price)
{
   double sl_price = 0.0;
   double tp_price = 0.0;
   double sl_distance_price = 0.0;

   double buffer_val = InpSlBufferPips * 0.00010;
   double min_sl_val = InpMinSlPips * 0.00010;

   if(dir == "BUY")
   {
      sl_price = g_session.sweep_price - buffer_val;
      sl_distance_price = current_price - sl_price;
      if(sl_distance_price < min_sl_val)
      {
         sl_distance_price = min_sl_val;
         sl_price = current_price - min_sl_val;
      }
      tp_price = current_price + (sl_distance_price * InpRiskRewardRatio);
   }
   else
   {
      sl_price = g_session.sweep_price + buffer_val;
      sl_distance_price = sl_price - current_price;
      if(sl_distance_price < min_sl_val)
      {
         sl_distance_price = min_sl_val;
         sl_price = current_price + min_sl_val;
      }
      tp_price = current_price - (sl_distance_price * InpRiskRewardRatio);
   }

   // Calcular lotaje exacto según gestión manual
   double sl_points = sl_distance_price / _Point;
   double lot = CalculateLotSize(sl_points);

   sl_price = NormalizeDouble(sl_price, _Digits);
   tp_price = NormalizeDouble(tp_price, _Digits);

   bool success = false;
   if(dir == "BUY")
   {
      success = m_trade.Buy(lot, _Symbol, current_price, sl_price, tp_price, InpTradeComment);
   }
   else
   {
      success = m_trade.Sell(lot, _Symbol, current_price, sl_price, tp_price, InpTradeComment);
   }

   if(success)
   {
      PrintFormat("🚀 [%s] ORDEN EJECUTADA: %s %.2f lotes @ %.5f | SL: %.5f | TP: %.5f (R:R 1:%.1f)",
                  g_session.session_name, dir, lot, current_price, sl_price, tp_price, InpRiskRewardRatio);
      
      g_session.state = STATE_IN_TRADE;
      g_session.trades_today++;
      if(g_session.session_name == "LONDRES") g_session.london_trades++;
      if(g_session.session_name == "NEW_YORK") g_session.ny_trades++;
   }
   else
   {
      Print("❌ Error al ejecutar orden: ", m_trade.ResultRetcodeDescription());
   }
}

//+------------------------------------------------------------------+
//| Dimensionamiento exacto del lote basado en riesgo manual         |
//+------------------------------------------------------------------+
double CalculateLotSize(double sl_points)
{
   if(InpLotMode == LOT_FIXED)
   {
      return InpFixedLot;
   }

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance <= 0) balance = 100.0;

   // Determinar % de riesgo efectivo
   double risk_pct = InpRiskPercent;
   if(InpUseRsiBooster && g_session.rsi_confirmed)
   {
      risk_pct = InpBoosterRiskPct;
   }

   double risk_usd = 0.0;
   if(InpLotMode == LOT_RISK_PERCENT)
   {
      risk_usd = balance * (risk_pct / 100.0);
   }
   else if(InpLotMode == LOT_RISK_USD)
   {
      risk_usd = InpRiskUSD;
   }

   double tick_val = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tick_sz  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double point_val = (tick_sz > 0) ? (tick_val * (_Point / tick_sz)) : 1.0;

   double exact_lot = risk_usd / (sl_points * point_val);

   double lot_step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double lot_min  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double lot_max  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   double normalized_lot = MathFloor(exact_lot / lot_step) * lot_step;
   normalized_lot = MathMax(lot_min, MathMin(lot_max, normalized_lot));

   return normalized_lot;
}

//+------------------------------------------------------------------+
//| Comprueba si el RSI estaba en sobrecompra/sobreventa             |
//+------------------------------------------------------------------+
bool CheckRsiExtreme(string dir)
{
   if(g_rsi_handle == INVALID_HANDLE) return false;
   double rsi_vals[];
   ArraySetAsSeries(rsi_vals, true);
   if(CopyBuffer(g_rsi_handle, 0, 1, 3, rsi_vals) < 3) return false;

   if(dir == "BUY" && rsi_vals[0] <= InpRsiOversold) return true;
   if(dir == "SELL" && rsi_vals[0] >= InpRsiOverbought) return true;
   return false;
}

//+------------------------------------------------------------------+
//| Trailing Stop y Breakeven a 1:1 R:R                              |
//+------------------------------------------------------------------+
void ManageTrailingAndBE()
{
   if(!InpEnableBreakEven) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(m_position.SelectByIndex(i))
      {
         if(m_position.Symbol() == _Symbol && m_position.Magic() == InpMagicNumber)
         {
            double open_px = m_position.PriceOpen();
            double cur_px  = m_position.PriceCurrent();
            double cur_sl  = m_position.StopLoss();
            double cur_tp  = m_position.TakeProfit();
            
            // Distancia del Stop Loss original
            double sl_dist = MathAbs(open_px - cur_sl);
            if(sl_dist <= 0.00010) continue;

            if(m_position.PositionType() == POSITION_TYPE_BUY)
            {
               // Si avanzó al menos 1:1 respecto a su SL
               if((cur_px - open_px) >= sl_dist)
               {
                  double be_sl = NormalizeDouble(open_px + (InpBeLockPips * 0.00010), _Digits);
                  if(cur_sl < open_px) // Aún no está en BE
                  {
                     m_trade.PositionModify(m_position.Ticket(), be_sl, cur_tp);
                     PrintFormat("🛡️ [Breakeven] Posición COMPRA #%d asegurada en BE (1:1 alcanzado).", m_position.Ticket());
                  }
               }
            }
            else if(m_position.PositionType() == POSITION_TYPE_SELL)
            {
               if((open_px - cur_px) >= sl_dist)
               {
                  double be_sl = NormalizeDouble(open_px - (InpBeLockPips * 0.00010), _Digits);
                  if(cur_sl > open_px || cur_sl == 0.0)
                  {
                     m_trade.PositionModify(m_position.Ticket(), be_sl, cur_tp);
                     PrintFormat("🛡️ [Breakeven] Posición VENTA #%d asegurada en BE (1:1 alcanzado).", m_position.Ticket());
                  }
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Verifica si ya existe posición abierta con este Magic Number     |
//+------------------------------------------------------------------+
bool HasOpenPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(m_position.SelectByIndex(i))
      {
         if(m_position.Symbol() == _Symbol && m_position.Magic() == InpMagicNumber)
         {
            return true;
         }
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Dibuja el rango de Asia en pantalla                              |
//+------------------------------------------------------------------+
void DrawAsiaRangeBox()
{
   if(!InpShowVisualBoxes) return;
   string name_h = "PASess_AsiaHigh";
   string name_l = "PASess_AsiaLow";

   ObjectCreate(0, name_h, OBJ_HLINE, 0, 0, g_session.asia_high);
   ObjectSetInteger(0, name_h, OBJPROP_COLOR, clrDodgerBlue);
   ObjectSetInteger(0, name_h, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetString(0, name_h, OBJPROP_TEXT, " Asia High (Tokio)");

   ObjectCreate(0, name_l, OBJ_HLINE, 0, 0, g_session.asia_low);
   ObjectSetInteger(0, name_l, OBJPROP_COLOR, clrDodgerBlue);
   ObjectSetInteger(0, name_l, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetString(0, name_l, OBJPROP_TEXT, " Asia Low (Tokio)");
}

//+------------------------------------------------------------------+
//| Dibuja el marcador de la toma de liquidez / manipulación         |
//+------------------------------------------------------------------+
void DrawSweepMarker(double price, string dir, double ref_level)
{
   if(!InpShowVisualBoxes) return;
   string name = "PASess_Sweep_" + TimeToString(TimeCurrent());
   datetime now_t = TimeCurrent();

   ObjectCreate(0, name, OBJ_ARROW, 0, now_t, price);
   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, (dir == "BUY") ? 233 : 234);
   ObjectSetInteger(0, name, OBJPROP_COLOR, InpColorSweep);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
}

//+------------------------------------------------------------------+
//| Dibuja el 50% de Fibonacci y la zona FVG                         |
//+------------------------------------------------------------------+
void DrawFiboAndFvg(double p1, double p2, double f50, double fvg_t, double fvg_b, string dir)
{
   if(!InpShowVisualBoxes) return;
   string name_f50 = "PASess_Fibo50";
   string name_fvg = "PASess_FVG";
   datetime now_t = TimeCurrent();

   ObjectDelete(0, name_f50);
   ObjectCreate(0, name_f50, OBJ_HLINE, 0, 0, f50);
   ObjectSetInteger(0, name_f50, OBJPROP_COLOR, clrGold);
   ObjectSetInteger(0, name_f50, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetString(0, name_f50, OBJPROP_TEXT, " Descuento 50% Fibo");

   ObjectDelete(0, name_fvg);
   ObjectCreate(0, name_fvg, OBJ_RECTANGLE, 0, now_t - 7200, fvg_t, now_t + 7200, fvg_b);
   ObjectSetInteger(0, name_fvg, OBJPROP_COLOR, (dir == "BUY") ? clrDarkGreen : clrDarkRed);
   ObjectSetInteger(0, name_fvg, OBJPROP_BGCOLOR, (dir == "BUY") ? clrMediumSeaGreen : clrCrimson);
   ObjectSetInteger(0, name_fvg, OBJPROP_BACK, true);
}

//+------------------------------------------------------------------+
//| HUD Táctico en Pantalla                                          |
//+------------------------------------------------------------------+
void UpdateHUD()
{
   datetime current_gmt = TimeGMT();
   MqlDateTime dt_gmt;
   TimeToStruct(current_gmt, dt_gmt);
   int hour_gmt = dt_gmt.hour;

   string active_session = "Fuera de Ventana";
   if(hour_gmt >= InpAsiaStartHourGMT && hour_gmt < InpAsiaEndHourGMT) active_session = "Tokio (Creando Rango)";
   else if(hour_gmt >= InpLondonStartGMT && hour_gmt < (InpLondonStartGMT + InpMaxSessionHours)) active_session = "🟢 Londres (Ventana Operativa)";
   else if(hour_gmt >= InpNYStartGMT && hour_gmt < (InpNYStartGMT + InpMaxSessionHours)) active_session = "🟢 Nueva York (Ventana Operativa)";

   string state_str = "Buscando Manipulación...";
   if(g_session.state == STATE_SWEEP_CONFIRMED) state_str = "🎯 ¡BARRIDO CONFIRMADO! Buscando FVG en 50% Fibo";
   else if(g_session.state == STATE_WAITING_RETEST) state_str = "⏳ Setup Listo. Esperando Testeo al FVG (" + g_session.direction + ")";
   else if(g_session.state == STATE_IN_TRADE) state_str = "⚡ OPERACIÓN ACTIVA EN MERCADO";

   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double risk_dollars = (InpLotMode == LOT_RISK_PERCENT) ? (bal * (InpRiskPercent / 100.0)) : InpRiskUSD;

   string hud = "====================================================\n";
   hud += "  PRO TERMINAL · EA MANIPULACIÓN DE SESIONES (EUR/USD)\n";
   hud += "====================================================\n";
   hud += StringFormat("  Broker: %s | Desfase Auto: GMT%+d\n", AccountInfoString(ACCOUNT_COMPANY), g_broker_gmt_offset);
   hud += StringFormat("  Hora GMT: %02d:%02d | Sesión: %s\n", hour_gmt, dt_gmt.min, active_session);
   hud += "----------------------------------------------------\n";
   hud += StringFormat("  Rango Asia: Alto: %.5f | Bajo: %.5f (%.1f pips)\n",
                       g_session.asia_high, g_session.asia_low, (g_session.asia_high - g_session.asia_low)/0.00010);
   hud += StringFormat("  Estado Estrategia: %s\n", state_str);
   hud += "----------------------------------------------------\n";
   hud += StringFormat("  Riesgo Manual: %.1f%% ($%.2f USD) | Ratio R:R: 1:%.1f\n",
                       InpRiskPercent, risk_dollars, InpRiskRewardRatio);
   hud += StringFormat("  Trades Hoy: %d / %d (Londres: %d, NY: %d)\n",
                       g_session.trades_today, InpMaxTradesPerDay, g_session.london_trades, g_session.ny_trades);
   hud += "====================================================";

   Comment(hud);
}

//+------------------------------------------------------------------+
//| Puente de Telemetría hacia el Dashboard Pro Terminal             |
//+------------------------------------------------------------------+
void SendTelemetryToDashboard()
{
   if(TimeCurrent() - g_last_telemetry < 2) return;
   g_last_telemetry = TimeCurrent();

   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string company  = AccountInfoString(ACCOUNT_COMPANY);
   long   leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);

   double eur_bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double eur_ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   long   eur_spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);

   // Velas M5 para alimentar el gráfico del servidor
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M5, 0, 50, rates);
   string m5_json = "[]";
   if(copied > 0)
   {
      m5_json = "[";
      for(int i = copied - 1; i >= 0; i--)
      {
         m5_json += StringFormat("{\"time\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}",
                                 (long)rates[i].time, rates[i].open, rates[i].high, rates[i].low, rates[i].close, (long)rates[i].tick_volume);
         if(i > 0) m5_json += ",";
      }
      m5_json += "]";
   }

   string payload = "{\n";
   payload += StringFormat("  \"account\": {\"balance\": %.2f, \"equity\": %.2f, \"currency\": \"%s\", \"company\": \"%s\", \"leverage\": %d},\n",
                           balance, equity, currency, company, leverage);
   payload += "  \"symbols\": {\n";
   payload += StringFormat("    \"EURUSD\": {\"bid\": %.5f, \"ask\": %.5f, \"spread_pts\": %d, \"candles_m5\": %s}\n",
                           eur_bid, eur_ask, eur_spread, m5_json);
   payload += "  }\n}";

   char post_data[];
   char result[];
   string result_headers;
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   string headers = "Content-Type: application/json\r\n";

   ResetLastError();
   WebRequest("POST", InpServerUrl, headers, 4000, post_data, result, result_headers);
}
//+------------------------------------------------------------------+
