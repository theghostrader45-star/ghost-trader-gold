//+------------------------------------------------------------------+
//|                                             GoldBreakout_MT5.mq5 |
//|                               Institutional Gold Breakout Engine |
//|                  Replicación Fiel del Sistema Breakout Original  |
//|                    (Cajas Azul Eléctrico + Filtro Tendencial)    |
//+------------------------------------------------------------------+
#property copyright   "Gold Breakout EA MT5 - Institutional Framework"
#property link        "https://www.royalprince.org/royalbreakout.html"
#property version     "2.00"
#property description "Expert Advisor de Ruptura de Sesiones (Asia & Londres)"
#property description "Cajas Azul Eléctrico, Línea Tendencial Verde/Roja, OCO y R:R 1:2 / 1:3+"

//--- Includes Oficiales de MQL5
#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\OrderInfo.mqh>
#include <Trade\AccountInfo.mqh>

//--- Enums de Configuración
enum ENUM_DIRECTION_MODE
  {
   DIR_BOTH       = 0, // Operar Ambos Lados (Buy & Sell Stop)
   DIR_BUY_ONLY   = 1, // Solo Compras (Buy-Only)
   DIR_SELL_ONLY  = 2  // Solo Ventas (Sell-Only)
  };

enum ENUM_SL_MODE
  {
   SL_OPPOSITE_RANGE = 0, // Extremo Opuesto del Rango
   SL_MIDPOINT_50    = 1, // Punto Medio 50% del Rango (Recomendado)
   SL_FIXED_POINTS   = 2  // Puntos Fijos Personalizados
  };

enum ENUM_TP_MODE
  {
   TP_RR_RATIO       = 0, // Ratio Riesgo:Beneficio (ej. 1:2.0 o 1:3.0)
   TP_RANGE_MULT     = 1, // Multiplicador del Rango de la Sesión
   TP_FIXED_POINTS   = 2  // Puntos Fijos Personalizados
  };

enum ENUM_LOT_MODE
  {
   LOT_FIXED         = 0, // Lote Fijo (ej. 0.01)
   LOT_RISK_PERCENT  = 1, // Porcentaje de Riesgo sobre Balance
   LOT_RISK_CASH_USD = 2  // Monto Fijo en Dólares ($ USD por Trade)
  };

//====================================================================
// INPUT PARAMETERS (CONFIGURACIÓN INSTITUCIONAL DEL ROBOT)
//====================================================================

//--- 1. CONFIGURACIÓN GENERAL & SEGURIDAD
input group "=== 1. CONFIGURACIÓN GENERAL & SEGURIDAD ==="
input ulong                InpMagicNumber          = 778899;              // Magic Number (Identificador Único)
input string               InpTradeComment         = "Gold Breakout EA";  // Comentario de Órdenes
input int                  InpSlippage             = 30;                  // Deslizamiento Máximo (Slippage en Puntos)
input int                  InpMaxSpreadPoints      = 60;                  // Spread Máximo Permitido (Puntos)
input ENUM_DIRECTION_MODE  InpDirectionMode        = DIR_BOTH;            // Dirección Base Permitida
input bool                 InpOCO                  = true;                // One-Cancels-Other (Al activarse una, cancelar la otra)
input int                  InpOrderBufferPoints    = 50;                  // Buffer de Entrada por fuera del Rango (Puntos en H1)

//--- 2. SESIÓN 1: RANGO ASIÁTICO (Ruptura en Londres)
input group "=== 2. SESIÓN 1: RANGO ASIÁTICO (Breakout Londres) ==="
input bool                 InpEnableAsia           = true;                // Activar Rango Asiático
input string               InpAsiaRangeStart       = "02:00";             // Inicio del Rango Asia (Hora Servidor Broker)
input string               InpAsiaRangeEnd         = "09:00";             // Fin del Rango Asia (7 velas H1)
input string               InpAsiaOrderPlacement   = "09:02";             // Hora de Colocar Órdenes (Apertura Frankfurt/Londres)
input string               InpAsiaOrderExpiration  = "14:00";             // Hora de Cancelar Órdenes si no se activaron
input int                  InpAsiaMinRangePoints   = 350;                 // Rango Mínimo Válido (Filtro Anti-Rango Muerto)
input int                  InpAsiaMaxRangePoints   = 2500;                // Rango Máximo Válido (Filtro Anti-Sobreextensión)

//--- 3. SESIÓN 2: RANGO DE LONDRES (Ruptura en New York)
input group "=== 3. SESIÓN 2: RANGO DE LONDRES (Breakout New York) ==="
input bool                 InpEnableLondon         = true;                // Activar Rango de Londres
input string               InpLondonRangeStart     = "10:00";             // Inicio del Rango Londres (Hora Servidor Broker)
input string               InpLondonRangeEnd       = "14:00";             // Fin del Rango Londres (4 velas H1)
input string               InpLondonOrderPlacement = "14:30";             // Hora de Colocar Órdenes (Apertura New York)
input string               InpLondonOrderExpiration= "19:00";             // Hora de Cancelar Órdenes si no se activaron
input int                  InpLondonMinRangePoints = 500;                 // Rango Mínimo Válido Londres
input int                  InpLondonMaxRangePoints = 3500;                // Rango Máximo Válido Londres

//--- 4. GESTIÓN DE CAPITAL & LOTAJE
input group "=== 4. GESTIÓN DE CAPITAL & LOTAJE ==="
input ENUM_LOT_MODE        InpLotMode              = LOT_FIXED;           // Modo de Dimensionamiento del Lote
input double               InpFixedLot             = 0.01;                // Lote Fijo (0.01 recomendado para cuentas < $250)
input double               InpRiskPercent          = 10.0;                // Riesgo % sobre Balance (Fase 1: 10% / Fase 2: 5%)
input double               InpRiskCashUSD          = 10.0;                // Riesgo Fijo en Dinero ($ USD por trade)

//--- 5. STOP LOSS & TAKE PROFIT
input group "=== 5. SALIDAS: STOP LOSS & TAKE PROFIT ==="
input ENUM_SL_MODE         InpSLMode               = SL_MIDPOINT_50;      // Modo de Stop Loss (50% Midpoint o Extremo)
input int                  InpCustomSLPoints       = 1000;                // SL Fijo en Puntos (si se usa modo personalizado)
input ENUM_TP_MODE         InpTPMode               = TP_RR_RATIO;         // Modo de Take Profit
input double               InpRR_Ratio             = 2.0;                 // Ratio R:R (1:2.0 Mínimo / 1:3.0 Óptimo)
input double               InpRangeMultiplier      = 1.5;                 // Multiplicador de Rango (si se usa TP Range)
input int                  InpCustomTPPoints       = 2000;                // TP Fijo en Puntos (si se usa modo personalizado)

//--- 6. DEFENSA DE CAPITAL: BREAK-EVEN & TRAILING STOP
input group "=== 6. DEFENSA DE CAPITAL (BREAK-EVEN & TRAILING) ==="
input bool                 InpEnableBreakEven      = true;                // Activar Mover a Breakeven Automático
input int                  InpBETriggerPoints      = 350;                 // Ganancia en Puntos para Mover a Breakeven ($3.50)
input int                  InpBELockPoints         = 15;                  // Puntos de Ganancia Bloqueados (para comisiones)
input bool                 InpEnableTrailing       = false;               // Activar Trailing Stop Dinámico
input int                  InpTrailingStartPoints  = 500;                 // Puntos de Ganancia para Iniciar Trailing
input int                  InpTrailingDistance     = 250;                 // Distancia del Trailing Stop (Puntos)
input int                  InpTrailingStep         = 50;                  // Paso de Trailing Stop (Puntos)

//--- 7. FILTRO DE TENDENCIA (LÍNEA VERDE / ROJA DEL SISTEMA ORIGINAL)
input group "=== 7. FILTRO DE TENDENCIA INSTITUCIONAL ==="
input bool                 InpUseTrendFilter       = true;                // Filtrar Rupturas: Solo BUY si Verde / Solo SELL si Roja
input bool                 InpShowTrendLine        = true;                // Dibujar Línea de Tendencia en Pantalla (Verde/Roja)
input int                  InpTrendMAPeriod        = 21;                  // Período de Media Tendencial (21 en H1)
input ENUM_MA_METHOD       InpTrendMAMethod        = MODE_EMA;            // Método de Media Tendencial (EMA)

//--- 8. ESTÉTICA VISUAL & HUD PROFESIONAL (ESTILO ORIGINAL)
input group "=== 8. VISUALIZACIÓN EN PANTALLA (ESTILO ORIGINAL) ==="
input bool                 InpShowVisualBoxes      = true;                // Dibujar Cajas de Rangos en el Gráfico
input color                InpColorAsiaBox         = C'0,122,255';        // Color Caja Asia (Azul Eléctrico / Dodger Blue)
input color                InpColorLondonBox       = C'0,95,215';         // Color Caja Londres (Azul Real Intenso)
input bool                 InpShowHUD              = true;                // Mostrar Ficha Táctica en Pantalla
input int                  InpHUDX                 = 20;                  // Posición X del Panel (Píxeles)
input int                  InpHUDY                 = 30;                  // Posición Y del Panel (Píxeles)

//====================================================================
// VARIABLES GLOBALES DE ESTADO DEL EXPERT ADVISOR
//====================================================================
CTrade         m_trade;
CPositionInfo  m_position;
COrderInfo     m_order;
CAccountInfo   m_account;

int            g_ma_handle = INVALID_HANDLE;

// Estructura de Control para cada Sesión
struct SSessionState
  {
   bool     orders_placed_today;
   datetime last_date_traded;
   double   range_high;
   double   range_low;
   double   range_points;
   ulong    buy_ticket;
   ulong    sell_ticket;
   string   box_name;
  };

SSessionState g_asia;
SSessionState g_london;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   // Configuración de la clase CTrade
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpSlippage);
   m_trade.SetTypeFillingBySymbol(_Symbol);

   // Inicializar estados
   ZeroMemory(g_asia);
   ZeroMemory(g_london);
   g_asia.box_name   = "GB_AsiaBox_";
   g_london.box_name = "GB_LondonBox_";

   // Inicializar Indicador de Tendencia (EMA)
   g_ma_handle = iMA(_Symbol, PERIOD_CURRENT, InpTrendMAPeriod, 0, InpTrendMAMethod, PRICE_CLOSE);
   if(g_ma_handle == INVALID_HANDLE)
      Print("⚠️ Advertencia: No se pudo crear el handle de la EMA tendencial.");

   Print("=========================================================");
   Print("🥇 Gold Breakout EA MT5 Inicializado Exitosamente!");
   Print("Símbolo: ", _Symbol, " | MagicNumber: ", InpMagicNumber);
   Print("Filtro de Tendencia (Verde/Roja): ", InpUseTrendFilter ? "ACTIVADO" : "DESACTIVADO");
   Print("Sesión Asia: [", InpAsiaRangeStart, " - ", InpAsiaRangeEnd, "] -> Coloca: ", InpAsiaOrderPlacement);
   Print("Sesión Londres: [", InpLondonRangeStart, " - ", InpLondonRangeEnd, "] -> Coloca: ", InpLondonOrderPlacement);
   Print("=========================================================");

   // Limpiar comentarios antiguos y crear HUD
   Comment("");
   if(InpShowHUD)
      CreateHUDCard();

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   // Eliminar todos los objetos visuales creados por el EA
   ObjectsDeleteAll(0, "GB_");
   Comment("");

   if(g_ma_handle != INVALID_HANDLE)
      IndicatorRelease(g_ma_handle);
  }

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);

   // 1. Manejo y defensa de posiciones abiertas (Break-Even y Trailing Stop)
   ManageOpenPositions();

   // 2. Control de One-Cancels-Other (OCO): si una orden se activó, cancelar la otra
   if(InpOCO)
     {
      CheckAndHandleOCO(g_asia);
      CheckAndHandleOCO(g_london);
     }

   // 3. Procesar Sesión de Asia
   if(InpEnableAsia)
      ProcessSession(g_asia, InpAsiaRangeStart, InpAsiaRangeEnd, InpAsiaOrderPlacement, 
                     InpAsiaOrderExpiration, InpAsiaMinRangePoints, InpAsiaMaxRangePoints, 
                     InpColorAsiaBox, "Asia", dt);

   // 4. Procesar Sesión de Londres
   if(InpEnableLondon)
      ProcessSession(g_london, InpLondonRangeStart, InpLondonRangeEnd, InpLondonOrderPlacement, 
                     InpLondonOrderExpiration, InpLondonMinRangePoints, InpLondonMaxRangePoints, 
                     InpColorLondonBox, "Londres", dt);

   // 5. Actualizar Línea de Tendencia Estilo Original (Verde/Roja)
   if(InpShowTrendLine)
      UpdateTrendLineVisual();

   // 6. Actualizar HUD Profesional en Gráfico
   if(InpShowHUD)
      UpdateHUD(dt);
  }

//+------------------------------------------------------------------+
//| Evalúa si la tendencia actual es Alcista (Verde) o Bajista (Roja)|
//+------------------------------------------------------------------+
bool IsTrendBullish()
  {
   if(g_ma_handle == INVALID_HANDLE) return(true);

   double ma_val[2];
   ArraySetAsSeries(ma_val, true);
   if(CopyBuffer(g_ma_handle, 0, 0, 2, ma_val) < 2)
      return(true);

   return(ma_val[0] >= ma_val[1]);
  }

//+------------------------------------------------------------------+
//| Procesa la lógica de escaneo, filtro y colocación de órdenes     |
//+------------------------------------------------------------------+
void ProcessSession(SSessionState &sess, string start_time, string end_time, string place_time, 
                    string expire_time, int min_pts, int max_pts, color box_col, string session_label, const MqlDateTime &dt)
  {
   datetime now = TimeCurrent();
   datetime today_midnight = StringToTime(TimeToString(now, TIME_DATE) + " 00:00:00");
   
   datetime t_start   = today_midnight + TimeStringToSeconds(start_time);
   datetime t_end     = today_midnight + TimeStringToSeconds(end_time);
   datetime t_place   = today_midnight + TimeStringToSeconds(place_time);
   datetime t_expire  = today_midnight + TimeStringToSeconds(expire_time);

   // Reset diario para la sesión
   if(sess.last_date_traded != today_midnight)
     {
      sess.orders_placed_today = false;
      sess.buy_ticket          = 0;
      sess.sell_ticket         = 0;
      sess.range_high          = 0.0;
      sess.range_low           = 0.0;
      sess.range_points        = 0.0;
      sess.last_date_traded    = today_midnight;
     }

   // FASE A: Durante la sesión, dibujar y actualizar la caja del rango en vivo
   if(now >= t_start && now < t_place)
     {
      double cur_high, cur_low;
      if(GetRangeExtremes(t_start, now, cur_high, cur_low))
        {
         sess.range_high   = cur_high;
         sess.range_low    = cur_low;
         sess.range_points = (sess.range_high - sess.range_low) / _Point;
         if(InpShowVisualBoxes)
            DrawSessionBox(sess.box_name + TimeToString(today_midnight, TIME_DATE), t_start, sess.range_high, now, sess.range_low, box_col);
        }
     }

   // FASE B: Momento de colocación de órdenes (t_place)
   if(now >= t_place && now < t_expire && !sess.orders_placed_today)
     {
      // 1. Escanear el rango completo cerrado entre t_start y t_end
      if(!GetRangeExtremes(t_start, t_end, sess.range_high, sess.range_low))
        {
         Print("❌ Error obteniendo extremos del rango de ", session_label);
         return;
        }

      sess.range_points = (sess.range_high - sess.range_low) / _Point;

      // 2. Filtros de Calidad de Rango (Min y Max points)
      if(sess.range_points < min_pts)
        {
         Print("⚠️ Rango ", session_label, " rechazado por ser muy estrecho (", DoubleToString(sess.range_points, 1), " pts < ", min_pts, " pts)");
         sess.orders_placed_today = true;
         return;
        }

      if(sess.range_points > max_pts)
        {
         Print("⚠️ Rango ", session_label, " rechazado por sobreextensión (", DoubleToString(sess.range_points, 1), " pts > ", max_pts, " pts)");
         sess.orders_placed_today = true;
         return;
        }

      // 3. Filtro de Spread
      int cur_spread = (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
      if(cur_spread > InpMaxSpreadPoints)
        {
         Print("⚠️ Spread actual demasiado alto (", cur_spread, " > ", InpMaxSpreadPoints, "). Esperando...");
         return;
        }

      // 4. Extender la caja visual hasta el final de la ventana
      if(InpShowVisualBoxes)
         DrawSessionBox(sess.box_name + TimeToString(today_midnight, TIME_DATE), t_start, sess.range_high, t_end, sess.range_low, box_col);

      // 5. Determinar Dirección Permitida con Filtro Tendencial
      ENUM_DIRECTION_MODE effective_dir = InpDirectionMode;
      if(InpUseTrendFilter)
        {
         bool bullish = IsTrendBullish();
         effective_dir = bullish ? DIR_BUY_ONLY : DIR_SELL_ONLY;
         Print("🎯 Filtro Tendencial: Sesión ", session_label, " configurada en: ", bullish ? "SOLO COMPRAS (Línea Verde)" : "SOLO VENTAS (Línea Roja)");
        }

      // 6. Calcular Precios de Entrada, SL y TP
      double buffer = InpOrderBufferPoints * _Point;
      double buy_entry  = NormalizeDouble(sess.range_high + buffer, _Digits);
      double sell_entry = NormalizeDouble(sess.range_low - buffer, _Digits);

      double midpoint = NormalizeDouble((sess.range_high + sess.range_low) / 2.0, _Digits);

      // Cálculo de Stop Loss
      double buy_sl = 0.0, sell_sl = 0.0;
      if(InpSLMode == SL_OPPOSITE_RANGE)
        {
         buy_sl  = NormalizeDouble(sess.range_low - buffer, _Digits);
         sell_sl = NormalizeDouble(sess.range_high + buffer, _Digits);
        }
      else if(InpSLMode == SL_MIDPOINT_50)
        {
         buy_sl  = midpoint;
         sell_sl = midpoint;
        }
      else // SL_FIXED_POINTS
        {
         buy_sl  = NormalizeDouble(buy_entry - (InpCustomSLPoints * _Point), _Digits);
         sell_sl = NormalizeDouble(sell_entry + (InpCustomSLPoints * _Point), _Digits);
        }

      // Cálculo de Take Profit
      double buy_tp = 0.0, sell_tp = 0.0;
      if(InpTPMode == TP_RR_RATIO)
        {
         double buy_risk  = buy_entry - buy_sl;
         double sell_risk = sell_sl - sell_entry;
         buy_tp  = NormalizeDouble(buy_entry + (buy_risk * InpRR_Ratio), _Digits);
         sell_tp = NormalizeDouble(sell_entry - (sell_risk * InpRR_Ratio), _Digits);
        }
      else if(InpTPMode == TP_RANGE_MULT)
        {
         double range_dist = sess.range_high - sess.range_low;
         buy_tp  = NormalizeDouble(buy_entry + (range_dist * InpRangeMultiplier), _Digits);
         sell_tp = NormalizeDouble(sell_entry - (range_dist * InpRangeMultiplier), _Digits);
        }
      else // TP_FIXED_POINTS
        {
         buy_tp  = NormalizeDouble(buy_entry + (InpCustomTPPoints * _Point), _Digits);
         sell_tp = NormalizeDouble(sell_entry - (InpCustomTPPoints * _Point), _Digits);
        }

      // 7. Calcular Lotaje Exacto
      double buy_lots  = CalculateLotSize(buy_entry, buy_sl);
      double sell_lots = CalculateLotSize(sell_entry, sell_sl);

      // 8. Colocar Órdenes Pendientes según Dirección Permitida
      if(effective_dir == DIR_BOTH || effective_dir == DIR_BUY_ONLY)
        {
         if(m_trade.BuyStop(buy_lots, buy_entry, _Symbol, buy_sl, buy_tp, ORDER_TIME_SPECIFIED, t_expire, InpTradeComment + " [BUY]"))
           {
            sess.buy_ticket = m_trade.ResultOrder();
            Print("✅ BUY STOP colocado exitosamente: #", sess.buy_ticket, " @ ", buy_entry, " SL: ", buy_sl, " TP: ", buy_tp, " Lotes: ", buy_lots);
           }
         else
            Print("❌ Error colocando BUY STOP: ", m_trade.ResultRetcodeDescription());
        }

      if(effective_dir == DIR_BOTH || effective_dir == DIR_SELL_ONLY)
        {
         if(m_trade.SellStop(sell_lots, sell_entry, _Symbol, sell_sl, sell_tp, ORDER_TIME_SPECIFIED, t_expire, InpTradeComment + " [SELL]"))
           {
            sess.sell_ticket = m_trade.ResultOrder();
            Print("✅ SELL STOP colocado exitosamente: #", sess.sell_ticket, " @ ", sell_entry, " SL: ", sell_sl, " TP: ", sell_tp, " Lotes: ", sell_lots);
           }
         else
            Print("❌ Error colocando SELL STOP: ", m_trade.ResultRetcodeDescription());
        }

      sess.orders_placed_today = true;
     }

   // FASE C: Expiración y Borrado de órdenes si llegó t_expire
   if(now >= t_expire)
     {
      CancelPendingOrder(sess.buy_ticket);
      CancelPendingOrder(sess.sell_ticket);
     }
  }

//+------------------------------------------------------------------+
//| Obtiene los extremos High y Low de un rango temporal             |
//+------------------------------------------------------------------+
bool GetRangeExtremes(datetime t_start, datetime t_end, double &out_high, double &out_low)
  {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M1, t_start, t_end, rates);
   if(copied <= 0)
      return(false);

   out_high = rates[0].high;
   out_low  = rates[0].low;

   for(int i = 1; i < copied; i++)
     {
      if(rates[i].high > out_high) out_high = rates[i].high;
      if(rates[i].low  < out_low)  out_low  = rates[i].low;
     }

   return(true);
  }

//+------------------------------------------------------------------+
//| Calcula el tamaño del lote según el modo de riesgo seleccionado  |
//+------------------------------------------------------------------+
double CalculateLotSize(double entry, double sl)
  {
   double min_lot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double max_lot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lot_step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(InpLotMode == LOT_FIXED)
      return(MathMin(MathMax(InpFixedLot, min_lot), max_lot));

   double sl_distance_pts = MathAbs(entry - sl) / _Point;
   if(sl_distance_pts <= 0)
      return(min_lot);

   double tick_value = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tick_size  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tick_value <= 0 || tick_size <= 0)
      return(min_lot);

   double point_value_1lot = (tick_value / tick_size) * _Point;

   double risk_usd = 0.0;
   if(InpLotMode == LOT_RISK_PERCENT)
     {
      double balance = AccountInfoDouble(ACCOUNT_BALANCE);
      risk_usd = balance * (InpRiskPercent / 100.0);
     }
   else if(InpLotMode == LOT_RISK_CASH_USD)
     {
      risk_usd = InpRiskCashUSD;
     }

   double calculated_lot = risk_usd / (sl_distance_pts * point_value_1lot);

   // Redondear al paso de lote permitido
   calculated_lot = MathFloor(calculated_lot / lot_step) * lot_step;
   calculated_lot = MathMin(MathMax(calculated_lot, min_lot), max_lot);

   return(calculated_lot);
  }

//+------------------------------------------------------------------+
//| Monitorea Break-Even y Trailing Stop en posiciones abiertas      |
//+------------------------------------------------------------------+
void ManageOpenPositions()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(m_position.SelectByIndex(i))
        {
         if(m_position.Symbol() == _Symbol && m_position.Magic() == InpMagicNumber)
           {
            double open_price = m_position.PriceOpen();
            double cur_sl     = m_position.StopLoss();
            double cur_tp     = m_position.TakeProfit();
            double cur_price  = m_position.PriceCurrent();
            ulong  ticket     = m_position.Ticket();

            // 1. GESTIÓN DE BREAK-EVEN
            if(InpEnableBreakEven)
              {
               if(m_position.PositionType() == POSITION_TYPE_BUY)
                 {
                  double profit_pts = (cur_price - open_price) / _Point;
                  double be_price   = NormalizeDouble(open_price + (InpBELockPoints * _Point), _Digits);
                  if(profit_pts >= InpBETriggerPoints && (cur_sl < open_price || cur_sl == 0.0))
                    {
                     if(m_trade.PositionModify(ticket, be_price, cur_tp))
                        Print("🛡️ Break-Even Activado en BUY #", ticket, " SL movido a: ", be_price);
                    }
                 }
               else if(m_position.PositionType() == POSITION_TYPE_SELL)
                 {
                  double profit_pts = (open_price - cur_price) / _Point;
                  double be_price   = NormalizeDouble(open_price - (InpBELockPoints * _Point), _Digits);
                  if(profit_pts >= InpBETriggerPoints && (cur_sl > open_price || cur_sl == 0.0))
                    {
                     if(m_trade.PositionModify(ticket, be_price, cur_tp))
                        Print("🛡️ Break-Even Activado en SELL #", ticket, " SL movido a: ", be_price);
                    }
                 }
              }

            // 2. GESTIÓN DE TRAILING STOP
            if(InpEnableTrailing)
              {
               if(m_position.PositionType() == POSITION_TYPE_BUY)
                 {
                  double profit_pts = (cur_price - open_price) / _Point;
                  if(profit_pts >= InpTrailingStartPoints)
                    {
                     double new_sl = NormalizeDouble(cur_price - (InpTrailingDistance * _Point), _Digits);
                     if(new_sl > cur_sl + (InpTrailingStep * _Point))
                       {
                        if(m_trade.PositionModify(ticket, new_sl, cur_tp))
                           Print("📈 Trailing Stop Ajustado en BUY #", ticket, " a: ", new_sl);
                       }
                    }
                 }
               else if(m_position.PositionType() == POSITION_TYPE_SELL)
                 {
                  double profit_pts = (open_price - cur_price) / _Point;
                  if(profit_pts >= InpTrailingStartPoints)
                    {
                     double new_sl = NormalizeDouble(cur_price + (InpTrailingDistance * _Point), _Digits);
                     if(cur_sl == 0.0 || new_sl < cur_sl - (InpTrailingStep * _Point))
                       {
                        if(m_trade.PositionModify(ticket, new_sl, cur_tp))
                           Print("📈 Trailing Stop Ajustado en SELL #", ticket, " a: ", new_sl);
                       }
                    }
                 }
              }
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| One-Cancels-Other (OCO): Cancela la orden pendiente contraria    |
//+------------------------------------------------------------------+
void CheckAndHandleOCO(SSessionState &sess)
  {
   if(sess.buy_ticket == 0 && sess.sell_ticket == 0) return;

   bool buy_filled = false, sell_filled = false;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(m_position.SelectByIndex(i))
        {
         if(m_position.Symbol() == _Symbol && m_position.Magic() == InpMagicNumber)
           {
            if(m_position.PositionType() == POSITION_TYPE_BUY)  buy_filled = true;
            if(m_position.PositionType() == POSITION_TYPE_SELL) sell_filled = true;
           }
        }
     }

   if(buy_filled && sess.sell_ticket > 0)
     {
      CancelPendingOrder(sess.sell_ticket);
      sess.sell_ticket = 0;
      Print("⚡ OCO: BUY activado. SELL STOP cancelado.");
     }

   if(sell_filled && sess.buy_ticket > 0)
     {
      CancelPendingOrder(sess.buy_ticket);
      sess.buy_ticket = 0;
      Print("⚡ OCO: SELL activado. BUY STOP cancelado.");
     }
  }

//+------------------------------------------------------------------+
//| Cancela una orden pendiente por su ticket                        |
//+------------------------------------------------------------------+
void CancelPendingOrder(ulong ticket)
  {
   if(ticket <= 0) return;
   if(m_order.Select(ticket))
     {
      ENUM_ORDER_STATE state = m_order.State();
      if(state == ORDER_STATE_PLACED)
        {
         m_trade.OrderDelete(ticket);
         Print("🗑️ Orden pendiente #", ticket, " cancelada.");
        }
     }
  }

//+------------------------------------------------------------------+
//| Dibuja una caja rectangular con estilo Azul Eléctrico (Original) |
//+------------------------------------------------------------------+
void DrawSessionBox(string name, datetime t1, double p1, datetime t2, double p2, color col)
  {
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, p1, t2, p2);
      ObjectSetInteger(0, name, OBJPROP_COLOR, col);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_FILL, true);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
     }
   else
     {
      ObjectSetInteger(0, name, OBJPROP_TIME, 0, t1);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 0, p1);
      ObjectSetInteger(0, name, OBJPROP_TIME, 1, t2);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 1, p2);
      ObjectSetInteger(0, name, OBJPROP_COLOR, col);
     }
  }

//+------------------------------------------------------------------+
//| Dibuja la Línea de Tendencia Dinámica Verde / Roja del Original  |
//+------------------------------------------------------------------+
void UpdateTrendLineVisual()
  {
   if(g_ma_handle == INVALID_HANDLE) return;

   int bars_to_draw = 70;
   double ma_val[];
   datetime time_val[];
   ArraySetAsSeries(ma_val, true);
   ArraySetAsSeries(time_val, true);

   if(CopyBuffer(g_ma_handle, 0, 0, bars_to_draw + 1, ma_val) <= bars_to_draw) return;
   if(CopyTime(_Symbol, PERIOD_CURRENT, 0, bars_to_draw + 1, time_val) <= bars_to_draw) return;

   for(int i = 0; i < bars_to_draw; i++)
     {
      string seg_name = "GB_TrendLine_" + IntegerToString(i);
      datetime t1 = time_val[i + 1];
      double   p1 = ma_val[i + 1];
      datetime t2 = time_val[i];
      double   p2 = ma_val[i];

      // Verde si sube, Roja si baja
      color col = (p2 >= p1) ? clrLimeGreen : clrCrimson;

      if(ObjectFind(0, seg_name) < 0)
        {
         ObjectCreate(0, seg_name, OBJ_TREND, 0, t1, p1, t2, p2);
         ObjectSetInteger(0, seg_name, OBJPROP_COLOR, col);
         ObjectSetInteger(0, seg_name, OBJPROP_WIDTH, 3);
         ObjectSetInteger(0, seg_name, OBJPROP_STYLE, STYLE_SOLID);
         ObjectSetInteger(0, seg_name, OBJPROP_RAY_RIGHT, false);
         ObjectSetInteger(0, seg_name, OBJPROP_BACK, false);
         ObjectSetInteger(0, seg_name, OBJPROP_SELECTABLE, false);
        }
      else
        {
         ObjectSetInteger(0, seg_name, OBJPROP_TIME, 0, t1);
         ObjectSetDouble(0, seg_name, OBJPROP_PRICE, 0, p1);
         ObjectSetInteger(0, seg_name, OBJPROP_TIME, 1, t2);
         ObjectSetDouble(0, seg_name, OBJPROP_PRICE, 1, p2);
         ObjectSetInteger(0, seg_name, OBJPROP_COLOR, col);
        }
     }
  }

//+------------------------------------------------------------------+
//| Convierte string "HH:MM" a segundos desde medianoche             |
//+------------------------------------------------------------------+
int TimeStringToSeconds(string time_str)
  {
   string parts[];
   int count = StringSplit(time_str, ':', parts);
   if(count >= 2)
     {
      int h = (int)StringToInteger(parts[0]);
      int m = (int)StringToInteger(parts[1]);
      return(h * 3600 + m * 60);
     }
   return(0);
  }

//+------------------------------------------------------------------+
//| Crea la Tarjeta de Control Profesional (HUD) sin superposiciones |
//+------------------------------------------------------------------+
void CreateHUDCard()
  {
   string panel = "GB_HUD_Panel";
   if(ObjectFind(0, panel) < 0)
     {
      ObjectCreate(0, panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, panel, OBJPROP_XDISTANCE, InpHUDX);
      ObjectSetInteger(0, panel, OBJPROP_YDISTANCE, InpHUDY);
      ObjectSetInteger(0, panel, OBJPROP_XSIZE, 290);
      ObjectSetInteger(0, panel, OBJPROP_YSIZE, 155);
      ObjectSetInteger(0, panel, OBJPROP_BGCOLOR, C'10,16,28');
      ObjectSetInteger(0, panel, OBJPROP_BORDER_COLOR, C'212,175,55'); // Borde Dorado
      ObjectSetInteger(0, panel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, panel, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, panel, OBJPROP_BACK, false);
      ObjectSetInteger(0, panel, OBJPROP_SELECTABLE, false);
     }
  }

//+------------------------------------------------------------------+
//| Función auxiliar para crear y actualizar etiquetas de texto      |
//+------------------------------------------------------------------+
void SetHUDLabel(string name, int x, int y, string text, color col, int font_size=8, bool bold=false)
  {
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
      ObjectSetString(0, name, OBJPROP_FONT, bold ? "Arial Bold" : "Arial");
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, font_size);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_BACK, false);
     }
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, col);
  }

//+------------------------------------------------------------------+
//| Actualiza la Ficha Táctica en Tiempo Real con texto nítido       |
//+------------------------------------------------------------------+
void UpdateHUD(const MqlDateTime &dt)
  {
   int base_x = InpHUDX + 12;
   int base_y = InpHUDY + 10;

   // 1. Título y Subtítulo
   SetHUDLabel("GB_L_Title", base_x, base_y, "🥇 GOLD BREAKOUT EA · MT5", C'255,215,0', 9, true);
   SetHUDLabel("GB_L_Sub", base_x, base_y + 18, "Session Breakout & Trend Engine", C'140,160,185', 7);

   // 2. Reloj del Servidor & Spread
   int cur_spread = (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   string s_clock = StringFormat("🕒 Servidor: %02d:%02d:%02d | Spread: %d pts", dt.hour, dt.min, dt.sec, cur_spread);
   SetHUDLabel("GB_L_Clock", base_x, base_y + 36, s_clock, clrWhite, 8);

   // 3. Estado de la Tendencia (Línea Verde / Roja)
   bool is_bull = IsTrendBullish();
   string s_trend = is_bull ? "📈 Tendencia H1: [ALCISTA] (Solo Compras)" : "📉 Tendencia H1: [BAJISTA] (Solo Ventas)";
   color  c_trend = is_bull ? clrLimeGreen : clrCrimson;
   SetHUDLabel("GB_L_Trend", base_x, base_y + 54, s_trend, c_trend, 8, true);

   // 4. Estado de Sesión Asia
   string s_asia = StringFormat("🌏 Asia (%s-%s): %s (%.0f pts)", 
      InpAsiaRangeStart, InpAsiaRangeEnd,
      g_asia.orders_placed_today ? "Ordenes Puestas" : "Monitoreando", g_asia.range_points);
   SetHUDLabel("GB_L_Asia", base_x, base_y + 72, s_asia, C'50,170,255', 8);

   // 5. Estado de Sesión Londres
   string s_london = StringFormat("🏛️ Londres (%s-%s): %s (%.0f pts)", 
      InpLondonRangeStart, InpLondonRangeEnd,
      g_london.orders_placed_today ? "Ordenes Puestas" : "Monitoreando", g_london.range_points);
   SetHUDLabel("GB_L_London", base_x, base_y + 90, s_london, C'235,185,60', 8);

   // 6. Capital, Lotaje y OCO
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   string s_acc = StringFormat("💰 Balance: $%.2f | Lote: %.2f | OCO: %s",
      balance, InpFixedLot, InpOCO ? "ON" : "OFF");
   SetHUDLabel("GB_L_Acc", base_x, base_y + 110, s_acc, clrCyan, 8);
  }
//+------------------------------------------------------------------+
