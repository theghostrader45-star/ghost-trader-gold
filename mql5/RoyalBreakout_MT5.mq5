//+------------------------------------------------------------------+
//|                                            RoyalBreakout_MT5.mq5 |
//|                             Institutional Session Breakout Engine|
//|               Replicación del Sistema RoyalBreakout (Asia & Ldn) |
//|                                       https://www.royalprince.org|
//+------------------------------------------------------------------+
#property copyright   "RoyalBreakout EA MT5 - Institutional Framework"
#property link        "https://www.royalprince.org/royalbreakout.html"
#property version     "1.00"
#property description "Expert Advisor de Ruptura de Sesiones (Asia & Londres)"
#property description "Rangos matemáticos, buffers inteligentes, OCO, Break-Even y R:R 1:2 / 1:3+"

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
   SL_MIDPOINT_50    = 1, // Punto Medio 50% del Rango
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
   LOT_RISK_PERCENT  = 1, // Porcentaje de Riesgo sobre Balance (ej. 5% o 10%)
   LOT_RISK_CASH_USD = 2  // Monto Fijo en Dólares ($ USD por Trade)
  };

//====================================================================
// INPUT PARAMETERS (CONFIGURACIÓN DEL ROBOT)
//====================================================================

//--- 1. CONFIGURACIÓN GENERAL & FILTRO DE SPREAD
input group "=== 1. CONFIGURACIÓN GENERAL & SEGURIDAD ==="
input ulong                InpMagicNumber          = 778899;              // Magic Number (Identificador Único)
input string               InpTradeComment         = "RoyalBreakout EA";  // Comentario de Órdenes
input int                  InpSlippage             = 30;                  // Deslizamiento Máximo (Slippage en Puntos)
input int                  InpMaxSpreadPoints      = 60;                  // Spread Máximo Permitido (Puntos)
input ENUM_DIRECTION_MODE  InpDirectionMode        = DIR_BOTH;            // Dirección Permitida
input bool                 InpOCO                  = true;                // One-Cancels-Other (Al activarse una, cancelar la otra)
input int                  InpOrderBufferPoints    = 30;                  // Buffer de Entrada por fuera del Rango (Puntos)

//--- 2. SESIÓN 1: RANGO ASIÁTICO (Ruptura en Londres)
input group "=== 2. SESIÓN 1: RANGO ASIÁTICO (Breakout Londres) ==="
input bool                 InpEnableAsia           = true;                // Activar Rango Asiático
input string               InpAsiaRangeStart       = "00:00";             // Inicio del Rango Asia (Hora Servidor Broker)
input string               InpAsiaRangeEnd         = "07:00";             // Fin del Rango Asia
input string               InpAsiaOrderPlacement   = "07:05";             // Hora de Colocar Órdenes Pendientes
input string               InpAsiaOrderExpiration  = "12:00";             // Hora de Cancelar Órdenes si no se activaron
input int                  InpAsiaMinRangePoints   = 150;                 // Rango Mínimo Válido (Filtro Anti-Rango Muerto)
input int                  InpAsiaMaxRangePoints   = 2500;                // Rango Máximo Válido (Filtro Anti-Sobreextensión)

//--- 3. SESIÓN 2: RANGO DE LONDRES (Ruptura en New York)
input group "=== 3. SESIÓN 2: RANGO DE LONDRES (Breakout New York) ==="
input bool                 InpEnableLondon         = true;                // Activar Rango de Londres
input string               InpLondonRangeStart     = "08:00";             // Inicio del Rango Londres (Hora Servidor Broker)
input string               InpLondonRangeEnd       = "12:30";             // Fin del Rango Londres
input string               InpLondonOrderPlacement = "13:00";             // Hora de Colocar Órdenes Pendientes (Apertura NY)
input string               InpLondonOrderExpiration= "17:30";             // Hora de Cancelar Órdenes si no se activaron
input int                  InpLondonMinRangePoints = 250;                 // Rango Mínimo Válido Londres
input int                  InpLondonMaxRangePoints = 3500;                // Rango Máximo Válido Londres

//--- 4. GESTIÓN DE RIESGO & MONEDA (MONEY MANAGEMENT)
input group "=== 4. GESTIÓN DE CAPITAL & LOTAJE ==="
input ENUM_LOT_MODE        InpLotMode              = LOT_FIXED;           // Modo de Dimensionamiento del Lote
input double               InpFixedLot             = 0.01;                // Lote Fijo (0.01 recomendado para cuentas < $250)
input double               InpRiskPercent          = 10.0;                // Riesgo % sobre Balance (Fase 1: 10% / Fase 2: 5%)
input double               InpRiskCashUSD          = 10.0;                // Riesgo Fijo en Dinero ($ USD por trade)

//--- 5. STOP LOSS & TAKE PROFIT (RATIOS INSTITUCIONALES)
input group "=== 5. SALIDAS: STOP LOSS & TAKE PROFIT ==="
input ENUM_SL_MODE         InpSLMode               = SL_MIDPOINT_50;      // Modo de Stop Loss (50% Midpoint o Extremo)
input int                  InpCustomSLPoints       = 1000;                // SL Fijo en Puntos (si se usa modo personalizado)
input ENUM_TP_MODE         InpTPMode               = TP_RR_RATIO;         // Modo de Take Profit
input double               InpRR_Ratio             = 2.0;                 // Ratio R:R (1:2.0 Mínimo / 1:3.0 Óptimo)
input double               InpRangeMultiplier      = 1.5;                 // Multiplicador de Rango (si se usa TP Range)
input int                  InpCustomTPPoints       = 2000;                // TP Fijo en Puntos (si se usa modo personalizado)

//--- 6. GESTIÓN EN VIVO: BREAK-EVEN & TRAILING STOP
input group "=== 6. DEFENSA DE CAPITAL (BREAK-EVEN & TRAILING) ==="
input bool                 InpEnableBreakEven      = true;                // Activar Mover a Breakeven Automático
input int                  InpBETriggerPoints      = 300;                 // Ganancia en Puntos para Mover a Breakeven
input int                  InpBELockPoints         = 10;                  // Puntos de Ganancia Bloqueados (para comisiones)
input bool                 InpEnableTrailing       = false;               // Activar Trailing Stop Dinámico
input int                  InpTrailingStartPoints  = 500;                 // Puntos de Ganancia para Iniciar Trailing
input int                  InpTrailingDistance     = 250;                 // Distancia del Trailing Stop (Puntos)
input int                  InpTrailingStep         = 50;                  // Paso de Trailing Stop (Puntos)

//--- 7. ESTÉTICA VISUAL & HUD EN GRÁFICO
input group "=== 7. VISUALIZACIÓN EN PANTALLA ==="
input bool                 InpShowVisualBoxes      = true;                // Dibujar Cajas de Rangos en el Gráfico
input color                InpColorAsiaBox         = C'25,40,75';         // Color Caja Rango Asiático (Azul Marino)
input color                InpColorLondonBox       = C'65,45,15';         // Color Caja Rango Londres (Dorado/Ámbar)
input bool                 InpShowHUD              = true;                // Mostrar Ficha Táctica en Pantalla
input color                InpHUDTextColor         = clrWhite;            // Color Texto de Ficha

//====================================================================
// VARIABLES GLOBALES DE ESTADO DEL EXPERT ADVISOR
//====================================================================
CTrade         m_trade;
CPositionInfo  m_position;
COrderInfo     m_order;
CAccountInfo   m_account;

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
   g_asia.box_name   = "RB_AsiaBox_";
   g_london.box_name = "RB_LondonBox_";

   Print("=========================================================");
   Print("🚀 RoyalBreakout EA MT5 Inicializado Exitosamente!");
   Print("Símbolo: ", _Symbol, " | MagicNumber: ", InpMagicNumber);
   Print("Sesión Asia: ", InpEnableAsia ? "ACTIVADA" : "DESACTIVADA");
   Print("Sesión Londres: ", InpEnableLondon ? "ACTIVADA" : "DESACTIVADA");
   Print("=========================================================");

   if(InpShowHUD)
      CreateHUDObjects();

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   // Eliminar objetos visuales creados por el EA
   ObjectsDeleteAll(0, "RB_");
   Comment("");
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

   // 5. Actualizar HUD en Gráfico
   if(InpShowHUD)
      UpdateHUD(dt);
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

   // FASE A: Durante la sesión, dibujar y actualizar la caja del rango
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
         sess.orders_placed_today = true; // Marcar para no repetir
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

      // 5. Calcular Precios de Entrada, SL y TP
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

      // 6. Calcular Lotaje Exacto
      double buy_lots  = CalculateLotSize(buy_entry, buy_sl);
      double sell_lots = CalculateLotSize(sell_entry, sell_sl);

      // 7. Colocar Órdenes Pendientes según InpDirectionMode
      if(InpDirectionMode == DIR_BOTH || InpDirectionMode == DIR_BUY_ONLY)
        {
         if(m_trade.BuyStop(buy_lots, buy_entry, _Symbol, buy_sl, buy_tp, ORDER_TIME_SPECIFIED, t_expire, InpTradeComment + " [BUY]"))
           {
            sess.buy_ticket = m_trade.ResultOrder();
            Print("✅ BUY STOP colocado exitosamente: #", sess.buy_ticket, " @ ", buy_entry, " SL: ", buy_sl, " TP: ", buy_tp, " Lotes: ", buy_lots);
           }
         else
            Print("❌ Error colocando BUY STOP: ", m_trade.ResultRetcodeDescription());
        }

      if(InpDirectionMode == DIR_BOTH || InpDirectionMode == DIR_SELL_ONLY)
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
//| Calcula el tamaño del lote según el modo de riesgo seleccionado |
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
//| One-Cancels-Other (OCO): Cancela la orden pendiente contraria   |
//+------------------------------------------------------------------+
void CheckAndHandleOCO(SSessionState &sess)
  {
   if(sess.buy_ticket == 0 && sess.sell_ticket == 0) return;

   bool buy_filled = false, sell_filled = false;

   // Revisar si BUY se convirtió en posición activa
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

   // Si Buy se activó, cancelar el Sell Stop pendiente
   if(buy_filled && sess.sell_ticket > 0)
     {
      CancelPendingOrder(sess.sell_ticket);
      sess.sell_ticket = 0;
      Print("⚡ OCO: BUY activado. SELL STOP cancelado.");
     }

   // Si Sell se activó, cancelar el Buy Stop pendiente
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
      ENUM_ORDER_STATE state = m_order.OrderState();
      if(state == ORDER_STATE_PLACED)
        {
         m_trade.OrderDelete(ticket);
         Print("🗑️ Orden pendiente #", ticket, " cancelada.");
        }
     }
  }

//+------------------------------------------------------------------+
//| Dibuja una caja rectangular sombreada para el rango de la sesión |
//+------------------------------------------------------------------+
void DrawSessionBox(string name, datetime t1, double p1, datetime t2, double p2, color col)
  {
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, p1, t2, p2);
      ObjectSetInteger(0, name, OBJPROP_COLOR, col);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_FILL, true);
     }
   else
     {
      ObjectSetInteger(0, name, OBJPROP_TIME, 0, t1);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 0, p1);
      ObjectSetInteger(0, name, OBJPROP_TIME, 1, t2);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 1, p2);
     }
  }

//+------------------------------------------------------------------+
//| Convierte string "HH:MM" a segundos desde la medianoche          |
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
//| Crea la Ficha Táctica (HUD) en el gráfico                       |
//+------------------------------------------------------------------+
void CreateHUDObjects()
  {
   string name = "RB_HUD_Panel";
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 20);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 30);
      ObjectSetInteger(0, name, OBJPROP_XSIZE, 300);
      ObjectSetInteger(0, name, OBJPROP_YSIZE, 140);
      ObjectSetInteger(0, name, OBJPROP_BGCOLOR, C'10,15,25');
      ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, C'212,175,55'); // Gold
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
     }
  }

//+------------------------------------------------------------------+
//| Actualiza la información del HUD en tiempo real                  |
//+------------------------------------------------------------------+
void UpdateHUD(const MqlDateTime &dt)
  {
   string text = StringFormat(
      "👑 ROYAL BREAKOUT EA · MT5\n" +
      "----------------------------------------\n" +
      "Hora Broker: %02d:%02d:%02d | Spread: %d pts\n" +
      "Rango Asia: %s (%.0f pts)\n" +
      "Rango Londres: %s (%.0f pts)\n" +
      "Balance: $%.2f | Riesgo: %.1f%%\n" +
      "Lote Sugerido: %.2f | OCO: %s",
      dt.hour, dt.min, dt.sec, (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD),
      g_asia.orders_placed_today ? "Ordenes Puestas" : "Monitoreando", g_asia.range_points,
      g_london.orders_placed_today ? "Ordenes Puestas" : "Monitoreando", g_london.range_points,
      AccountInfoDouble(ACCOUNT_BALANCE), InpRiskPercent,
      CalculateLotSize(SymbolInfoDouble(_Symbol, SYMBOL_BID), SymbolInfoDouble(_Symbol, SYMBOL_BID) - 1000 * _Point),
      InpOCO ? "Activo" : "Inactivo"
   );

   Comment(text);
  }
//+------------------------------------------------------------------+
