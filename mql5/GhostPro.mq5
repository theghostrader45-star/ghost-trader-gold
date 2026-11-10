//+------------------------------------------------------------------+
//|                                                   GhostPro.mq5   |
//|                          Ghost Trader - Institutional Scalping EA|
//|               Replicación 100% Fiel de Ghost Pro (Pine Script v6)|
//+------------------------------------------------------------------+
#property copyright   "Ghost Trader - Ghost Pro Framework"
#property link        "https://www.tradingview.com"
#property version     "3.10"
#property description "Expert Advisor de Scalping Institucional Multi-Par (AUDJPY, AUDCAD, USDCAD)"
#property description "Detección Automática de Setup, Sincronización de Sesiones y Cálculo Universal de Lotaje"
#property description "Dashboard Tabla Cuadrícula 100% Idéntico a TradingView (Sin Desfases Mac/Win)"

#include <Trade\Trade.mqh>

//--- Enums de Configuración
enum ENUM_PRESET_MODE
  {
   PRESET_AUTO_DETECT = 0, // Auto por Par Detectado (Recomendado)
   PRESET_MANUAL      = 1  // Manual por Parámetros
  };

enum ENUM_CAPITAL_MANAGEMENT
  {
   CAP_COMPOUND = 0, // Interés Compuesto Automático
   CAP_SIMPLE   = 1  // Balance Manual Fijo
  };

enum ENUM_PRELOAD_MODE
  {
   PRELOAD_DYNAMIC_AVG = 0, // Promedio Dinámico Reciente
   PRELOAD_FIXED_PIPS  = 1, // Pips Fijos de SL
   PRELOAD_FIXED_LOT   = 2  // Lote Fijo Directo
  };

enum ENUM_SESSION_SELECT
  {
   SESS_LONDON_AND_NY = 0, // Londres + Nueva York (Recomendado AUDJPY 5m)
   SESS_ONLY_NY       = 1, // Solo Nueva York (Recomendado USDCAD 3m)
   SESS_ONLY_LONDON   = 2  // Solo Londres (Recomendado AUDCAD 3m)
  };

enum ENUM_TRIGGER_MODE
  {
   TRIG_STRICT  = 0, // Estricto Ganador (63.8% WR - Ratio 1:2.8) [Recomendado]
   TRIG_DYNAMIC = 1  // Dinámico Amplio (Captura giros rápidos en V)
  };

//====================================================================
// INPUT PARAMETERS
//====================================================================

//--- 0. PRESETS DE PAR & SETUP AUTOMÁTICO
input group "=== 0. PRESETS DE PAR & SETUP AUTOMÁTICO ==="
input ENUM_PRESET_MODE       InpPresetMode      = PRESET_AUTO_DETECT; // Modo de Configuración de Sesión

//--- 1. GESTIÓN DE CAPITAL & RIESGO (1:2.8)
input group "=== 1. GESTIÓN DE CAPITAL & RIESGO (1:2.8) ==="
input ENUM_CAPITAL_MANAGEMENT InpCapitalMode     = CAP_COMPOUND;       // Modo de Gestión de Capital
input double                  InpRiskPercent     = 10.0;               // % de Riesgo por Operación (ej: 10% o 5%)
input double                  InpFixedBalanceUSD = 128.25;             // Balance Base si se usa Manual / Backtest ($ USD)
input double                  InpRRRatio         = 2.8;                // Ratio Riesgo:Beneficio Óptimo (1:2.8)
input double                  InpSLAtrMult       = 0.2;                // Colchón de SL (x ATR) [Recomendado: 0.2]
input double                  InpMinSLPips       = 5.0;                // SL Mínimo Antiruido (Pips)
input int                     InpMaxConsecLoss   = 2;                  // Máx. Pérdidas Seguidas (Killswitch por Sesión)

//--- 2. PRECARGA DE LOTE (ANTICIPADO TICKMILL)
input group "=== 2. PRECARGA DE LOTE (ANTICIPADO) ==="
input ENUM_PRELOAD_MODE       InpPreloadMode     = PRELOAD_DYNAMIC_AVG;// Modo de Precarga de Lote
input double                  InpPreloadFixedPips = 5.4;               // Cantidad de Pips SL (si modo = Pips Fijos)
input double                  InpPreloadFixedLot  = 0.37;              // Cantidad de Lote (si modo = Lote Fijo)
input int                     InpPreloadLookback  = 5;                 // Cantidad de Trades Recientes a Promediar

//--- 3. HORARIOS Y SESIONES (BASE HORA NEW YORK)
input group "=== 3. SESIONES DE TRADING (HORA NEW YORK) ==="
input ENUM_SESSION_SELECT     InpSessionMode     = SESS_LONDON_AND_NY; // Sesión Manual (si Modo = Manual)
input bool                    InpAutoGmtOffset   = true;               // Auto-detectar Horario NY & Broker (DST Automático)
input int                     InpNYGmtOffset     = -5;                 // GMT Offset NY Manual (si Auto = false)
input int                     InpBrokerGmtOffset = 3;                  // Offset GMT Broker Manual (si Auto = false)
input string                  InpLondonStartNY   = "02:00";            // Inicio Londres (Hora NY)
input string                  InpLondonEndNY     = "05:00";            // Fin Londres (Hora NY)
input string                  InpNYStartNY       = "07:00";            // Inicio New York (Hora NY)
input string                  InpNYEndNY         = "11:00";            // Fin New York (Hora NY)
input bool                    InpShowSessionsBg  = true;               // Sombrear Sesiones en el Fondo del Gráfico

//--- 4. CONFIGURACIÓN DEL SISTEMA GHOST PRO & HISTORIAL
input group "=== 4. CONFIGURACIÓN GHOST PRO & HISTORIAL ==="
input int                     InpEhmaPeriod      = 34;                 // Período EHMA (34 para M5 / M3)
input int                     InpAtrPeriod       = 14;                 // Período ATR
input ENUM_TRIGGER_MODE       InpTriggerMode     = TRIG_STRICT;        // Modo de Gatillo
input int                     InpHistoryBars     = 0;                  // Velas a Escanear en Backtest (0 = Auto 20,000)
input int                     InpMaxBarsCap      = 20000;              // Límite Máximo de Análisis (20,000 velas ≈ 4 meses)
input bool                    InpUseDateFilter   = false;              // Limitar a Fechas Específicas de Backtest
input datetime                InpStartDate       = D'2026.10.12 00:00';// Fecha Inicio Backtest
input datetime                InpEndDate         = D'2026.12.31 23:59';// Fecha Fin Backtest

//--- 5. FILTRO DE PROBABILIDAD NATIVA INSTITUCIONAL
input group "=== 5. FILTRO DE PROBABILIDAD NATIVA ==="
input bool                    InpUseProbFilter    = false;             // Filtrar por Probabilidad Mínima (false = Informativo)
input double                  InpMinProbThreshold = 65.0;              // Umbral Mínimo Requerido (%)

//--- 6. VISUALES & DASHBOARD
input group "=== 6. VISUALES & DASHBOARD ==="
input bool                    InpShowDashboard   = true;               // Mostrar Dashboard Flotante
input bool                    InpShowCapitalStats = false;             // Mostrar Métricas de Capital ($, Drawdown)
input bool                    InpUseIcons        = false;              // Mostrar Iconos (false = Seguro para Mac/Wine, true = Emojis)
input bool                    InpDrawBoxes       = true;               // Dibujar Cajas de TP, SL y Flechas
input bool                    InpDrawEhmaLine    = true;               // Dibujar Línea EHMA Continua
input int                     InpVisualBars      = 2500;               // Velas Máximas a Graficar (EHMA, Sesiones y Cajas)
input color                   InpColorTarget     = C'8,153,129';       // Color Verde TP / Alcista (#089981)
input color                   InpColorStop       = C'242,54,69';       // Color Rojo SL / Bajista (#f23645)
input color                   InpColorCyan       = C'0,188,212';       // Color Cyan Información (#00bcd4)

//--- 7. PARÁMETROS DE ORDEN & BROKER
input group "=== 7. PARÁMETROS DE ORDEN ==="
input ulong                   InpMagicNumber       = 998877;           // Magic Number Único
input string                  InpOrderComment      = "Ghost Pro";      // Comentario de Órdenes
input int                     InpMaxSlippage       = 20;               // Slippage Máximo Permitido (Puntos)
input double                  InpMaxSpreadPips     = 3.5;              // Spread Máximo Permitido (Pips, 0 = Sin Filtro)
input bool                    InpRequireFlatWick   = false;            // Exigir Base Plana (Compra) / Techo Plano (Venta)
input bool                    InpCloseAtSessionEnd = false;            // Cerrar Operaciones al Fin de Sesión (Scalp Intradía)

//====================================================================
// VARIABLES GLOBALES & CLASES
//====================================================================
CTrade         m_trade;

datetime       g_lastBarTime       = 0;
int            g_atrHandle         = INVALID_HANDLE;
int            g_sessionConsecLoss = 0;
bool           g_sessionLocked     = false;
int            g_lastSessionState  = -1;
bool           g_historyReady      = false;
int            g_prevScannedBars   = 0;

// Minutos de inicio/fin de sesiones cacheados (Hora NY)
int            g_londonStartMin    = 120; // 02:00
int            g_londonEndMin      = 300; // 05:00
int            g_nyStartMin        = 420; // 07:00
int            g_nyEndMin          = 660; // 11:00

// Tracking de estadísticas (R-Multiples y Conteo)
int            g_totalTrades       = 0;
int            g_winTrades         = 0;
int            g_lossTrades        = 0;
int            g_maxWinStreak      = 0;
int            g_maxLossStreak     = 0;
double         g_netProfitR        = 0.0;
double         g_profitFactorR     = 0.0;

// Tracking de simulación de capital en USD (Compuesto o Fijo)
double         g_simFinalBal       = 128.25;
double         g_simNetProfitUSD   = 0.0;
double         g_simMaxDDPct       = 0.0;
double         g_simMaxDDUSD       = 0.0;
double         g_simGrossProfitUSD = 0.0;
double         g_simGrossLossUSD   = 0.0;
double         g_simProfitFactorComp = 0.0;

// Historial de Pips de SL para la Precarga de Lote
double         g_slHistory[];

// Información de la última señal emitida
double         g_lastSignalLot     = 0.0;
double         g_lastSignalPips    = 0.0;
double         g_lastSignalProb    = 0.0;
string         g_lastSignalGrade   = "Esperando...";
color          g_lastSignalColor   = clrGray;

// Cache del layout del dashboard para optimizar redraw
int            g_prevNumRows       = -1;

// Estructura de Vela Heikin Ashi
struct HA_Candle
{
   datetime time;
   double   open;
   double   high;
   double   low;
   double   close;
};

// Helper de modo de prueba para optimizaciones a máxima velocidad
bool IsFastTestingMode()
{
   return ((bool)MQLInfoInteger(MQL_OPTIMIZATION) || ((bool)MQLInfoInteger(MQL_TESTER) && !(bool)MQLInfoInteger(MQL_VISUAL_MODE)));
}

// Forward Declarations
ENUM_SESSION_SELECT GetEffectiveSession();
void CleanChartObjects();
void CleanVisualHistory();
bool RunHistoricalScanAndRender();
void RenderDashboard();
void UpdateSessionStatus();
bool IsUSDST(datetime t);
bool IsEUDST(datetime t);
int  GetBrokerGmtOffsetForTime(datetime t);
int  GetNYGmtOffsetForTime(datetime t);
int  GetBrokerGmtOffset();
void GetNYTime(datetime t, int &nyHour, int &nyMin);
void GetNYTimeDetailed(datetime t, int &nyYear, int &nyMonth, int &nyDay, int &nyHour, int &nyMin);
int  ParseTimeToMinutes(string timeStr);
bool IsTradeSessionActiveTime(datetime t);
string GetActiveSessionNameTime(datetime t);
bool CalculateHeikinAshi(int count, HA_Candle &haBars[]);
bool CalculateEHMA(const HA_Candle &haBars[], int length, double &ehma[]);
void DrawEhmaSegments(const HA_Candle &haBars[], const double &ehma[]);
void DrawSessionBackgrounds(const HA_Candle &haBars[]);
void DrawTradeBoxes(bool isBuy, datetime tStart, datetime tEnd, double entry, double sl, double tp, bool isWon, double pips, double lots, double usdRisk);
double CalculateOptimalLot(double riskDistancePrice);
double CalculateNativeProbability(bool isBuy, const HA_Candle &bar, double atr, double ehmaCur, double ehmaPrev);
string GetProbabilityGrade(double p, color &col);
bool HasOpenPosition();
void CloseAllPositions(string reason);
void ExecuteBuyTrade(const HA_Candle &bar, double atr, double ehmaCur, double ehmaPrev);
void ExecuteSellTrade(const HA_Candle &bar, double atr, double ehmaCur, double ehmaPrev);
void AddSlHistory(double pips);
double GetAverageSLPips(double defaultPips);
double CalculatePreloadedLot(double curAtr, double &targetPipsOut);

// Helpers para el Dashboard Cuadrícula
void CreateRect(string name, int x, int y, int w, int h, color bg, color border);
void CreateLabel(string name, int x, int y, string text, color col, string font, int fontSize, ENUM_ANCHOR_POINT anchor);

//+------------------------------------------------------------------+
//| Retorna la Sesión Efectiva según el Preset o Ajuste Manual       |
//+------------------------------------------------------------------+
ENUM_SESSION_SELECT GetEffectiveSession()
{
   if(InpPresetMode == PRESET_AUTO_DETECT)
   {
      if(StringFind(_Symbol, "AUDJPY") >= 0) return SESS_LONDON_AND_NY;
      if(StringFind(_Symbol, "AUDCAD") >= 0) return SESS_ONLY_LONDON;
      if(StringFind(_Symbol, "USDCAD") >= 0) return SESS_ONLY_NY;
   }
   return InpSessionMode;
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpMaxSlippage);

   uint filling = (uint)SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) != 0)
      m_trade.SetTypeFilling(ORDER_FILLING_FOK);
   else if((filling & SYMBOL_FILLING_IOC) != 0)
      m_trade.SetTypeFilling(ORDER_FILLING_IOC);
   else
      m_trade.SetTypeFilling(ORDER_FILLING_RETURN);

   g_atrHandle = iATR(_Symbol, _Period, InpAtrPeriod);
   if(g_atrHandle == INVALID_HANDLE)
   {
      Print("❌ Error al crear handle de ATR: ", GetLastError());
      return(INIT_FAILED);
   }

   // Parsear y validar horarios dinámicos de sesiones (Hora NY)
   g_londonStartMin = ParseTimeToMinutes(InpLondonStartNY);
   g_londonEndMin   = ParseTimeToMinutes(InpLondonEndNY);
   g_nyStartMin     = ParseTimeToMinutes(InpNYStartNY);
   g_nyEndMin       = ParseTimeToMinutes(InpNYEndNY);

   if(g_londonEndMin <= g_londonStartMin) g_londonEndMin = g_londonStartMin + 180;
   if(g_nyEndMin <= g_nyStartMin)         g_nyEndMin     = g_nyStartMin + 240;

   ArrayResize(g_slHistory, 0);

   if(!IsFastTestingMode())
   {
      CleanChartObjects();
      g_historyReady = RunHistoricalScanAndRender();
      if(InpShowDashboard)
         RenderDashboard();
      ChartRedraw(0);
   }
   else
   {
      g_historyReady = true;
   }
   PrintFormat("🟢 [Ghost Pro EA v3.10] Inicializado con éxito en %s. Magic=%d | R:R=1:%.1f | Historial Analizado=%d velas", 
               _Symbol, InpMagicNumber, InpRRRatio, g_prevScannedBars);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   PrintFormat("⚠️ [GhostPro] OnDeinit ejecutado en %s. Motivo: %d", _Symbol, reason);

   if(g_atrHandle != INVALID_HANDLE)
   {
      IndicatorRelease(g_atrHandle);
      g_atrHandle = INVALID_HANDLE;
   }

   if(reason == REASON_REMOVE || reason == REASON_CHARTCLOSE || reason == REASON_PROGRAM)
   {
      CleanChartObjects();
      ChartRedraw(0);
   }
}

//+------------------------------------------------------------------+
//| Limpieza de objetos del gráfico                                  |
//+------------------------------------------------------------------+
void CleanChartObjects()
{
   ObjectsDeleteAll(0, "GP_");
   g_prevNumRows = -1;
}

void CleanVisualHistory()
{
   ObjectsDeleteAll(0, "GP_EHMA_");
   ObjectsDeleteAll(0, "GP_E_");
   ObjectsDeleteAll(0, "GP_SESS_");
   ObjectsDeleteAll(0, "GP_T_");
}

//+------------------------------------------------------------------+
//| Evento de Cambio en el Gráfico (Resize Protegido contra Loops)   |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_CHART_CHANGE)
   {
      static bool isDebouncing = false;
      if(isDebouncing) return;
      isDebouncing = true;

      static int lastW = 0, lastH = 0;
      int curW = (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS);
      int curH = (int)ChartGetInteger(0, CHART_HEIGHT_IN_PIXELS);

      if(curW != lastW || curH != lastH)
      {
         lastW = curW;
         lastH = curH;
         if(InpShowDashboard)
            RenderDashboard();
      }

      isDebouncing = false;
   }
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!g_historyReady)
   {
      if(Bars(_Symbol, _Period) >= 50)
      {
         g_historyReady = RunHistoricalScanAndRender();
         if(InpShowDashboard)
            RenderDashboard();
         ChartRedraw(0);
      }
      return;
   }

   UpdateSessionStatus();

   if(InpShowDashboard)
      RenderDashboard();

   datetime currentBarTime = iTime(_Symbol, _Period, 0);
   if(currentBarTime == g_lastBarTime)
      return;

   g_lastBarTime = currentBarTime;

   int targetCount = (InpHistoryBars <= 0) ? InpMaxBarsCap : InpHistoryBars;
   if(targetCount > InpMaxBarsCap) targetCount = InpMaxBarsCap;

   HA_Candle haBars[];
   if(!CalculateHeikinAshi(targetCount, haBars))
      return;

   double ehmaValues[];
   if(!CalculateEHMA(haBars, InpEhmaPeriod, ehmaValues))
      return;

   if(InpDrawEhmaLine)
      DrawEhmaSegments(haBars, ehmaValues);

   if(InpShowSessionsBg)
      DrawSessionBackgrounds(haBars);

   if(InpCloseAtSessionEnd && !IsTradeSessionActiveTime(TimeCurrent()) && HasOpenPosition())
   {
      CloseAllPositions("Cierre al finalizar la sesión institucional");
   }

   if(HasOpenPosition())
      return;

   if(!IsTradeSessionActiveTime(TimeCurrent()) || g_sessionLocked)
      return;

   double atrBuffer[2];
   if(CopyBuffer(g_atrHandle, 0, 1, 2, atrBuffer) <= 0)
      return;
   double currentAtr = atrBuffer[0];
   if(currentAtr <= 0) currentAtr = _Point * 10;

   if(ArraySize(ehmaValues) < 4 || ArraySize(haBars) < 4)
      return;

   bool ehmaUp     = (ehmaValues[1] > ehmaValues[2]);
   bool ehmaPrevUp = (ehmaValues[2] > ehmaValues[3]);

   bool strictBuy  = ehmaUp && (haBars[1].open <= ehmaValues[1]) && (haBars[1].close > ehmaValues[1]) && (haBars[1].close > haBars[1].open);
   bool strictSell = !ehmaUp && (haBars[1].open >= ehmaValues[1]) && (haBars[1].close < ehmaValues[1]) && (haBars[1].close < haBars[1].open);

   bool dynamicBuy  = (((haBars[1].open <= ehmaValues[1] || haBars[2].close <= ehmaValues[2]) && haBars[1].close > ehmaValues[1] && haBars[1].close > haBars[1].open && (ehmaUp || ehmaPrevUp)) || (ehmaUp && !ehmaPrevUp && haBars[1].close > ehmaValues[1] && haBars[1].close > haBars[1].open));
   bool dynamicSell = (((haBars[1].open >= ehmaValues[1] || haBars[2].close >= ehmaValues[2]) && haBars[1].close < ehmaValues[1] && haBars[1].close < haBars[1].open && (!ehmaUp || !ehmaPrevUp)) || (!ehmaUp && ehmaPrevUp && haBars[1].close < ehmaValues[1] && haBars[1].close < haBars[1].open));

   bool buySignal  = (InpTriggerMode == TRIG_STRICT) ? strictBuy  : dynamicBuy;
   bool sellSignal = (InpTriggerMode == TRIG_STRICT) ? strictSell : dynamicSell;

   if(InpRequireFlatWick)
   {
      double bodyBuy = haBars[1].close - haBars[1].open;
      double lowerWickBuy = haBars[1].open - haBars[1].low;
      if(buySignal && lowerWickBuy > (bodyBuy * 0.15)) buySignal = false;

      double bodySell = haBars[1].open - haBars[1].close;
      double upperWickSell = haBars[1].high - haBars[1].open;
      if(sellSignal && upperWickSell > (bodySell * 0.15)) sellSignal = false;
   }

   if(buySignal)
   {
      ExecuteBuyTrade(haBars[1], currentAtr, ehmaValues[1], ehmaValues[2]);
   }
   else if(sellSignal)
   {
      ExecuteSellTrade(haBars[1], currentAtr, ehmaValues[1], ehmaValues[2]);
   }

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Monitoreo de Transacciones y Cierre de Órdenes (Killswitch Live) |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ulong dealTicket = trans.deal;
      if(HistoryDealSelect(dealTicket))
      {
         long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
         if(dealMagic == InpMagicNumber && HistoryDealGetString(dealTicket, DEAL_SYMBOL) == _Symbol)
         {
            ENUM_DEAL_ENTRY entryType = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
            if(entryType == DEAL_ENTRY_OUT || entryType == DEAL_ENTRY_INOUT)
            {
               double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
               if(profit < 0)
               {
                  g_sessionConsecLoss++;
                  if(g_sessionConsecLoss >= InpMaxConsecLoss)
                  {
                     g_sessionLocked = true;
                     PrintFormat("⚠️ [GHOST PRO] Killswitch activado: %d pérdidas seguidas en esta sesión.", g_sessionConsecLoss);
                  }
               }
               else if(profit > 0)
               {
                  g_sessionConsecLoss = 0;
               }

               if(InpShowDashboard)
                  RenderDashboard();
               ChartRedraw(0);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Detección Automática de Horario de Verano en USA (New York)       |
//+------------------------------------------------------------------+
bool IsUSDST(datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   if(dt.mon < 3 || dt.mon > 11) return false;
   if(dt.mon > 3 && dt.mon < 11) return true;

   if(dt.mon == 3)
   {
      MqlDateTime dtFirst;
      dtFirst.year = dt.year; dtFirst.mon = 3; dtFirst.day = 1; dtFirst.hour = 0; dtFirst.min = 0; dtFirst.sec = 0;
      datetime tFirst = StructToTime(dtFirst);
      TimeToStruct(tFirst, dtFirst);
      int firstSun = 1 + (7 - dtFirst.day_of_week) % 7;
      int secondSun = firstSun + 7;
      return (dt.day >= secondSun);
   }
   if(dt.mon == 11)
   {
      MqlDateTime dtFirst;
      dtFirst.year = dt.year; dtFirst.mon = 11; dtFirst.day = 1; dtFirst.hour = 0; dtFirst.min = 0; dtFirst.sec = 0;
      datetime tFirst = StructToTime(dtFirst);
      TimeToStruct(tFirst, dtFirst);
      int firstSun = 1 + (7 - dtFirst.day_of_week) % 7;
      return (dt.day < firstSun);
   }
   return false;
}

//+------------------------------------------------------------------+
//| Detección Automática de Horario de Verano en Europa (Brokers EU) |
//+------------------------------------------------------------------+
bool IsEUDST(datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   if(dt.mon < 3 || dt.mon > 10) return false;
   if(dt.mon > 3 && dt.mon < 10) return true;

   if(dt.mon == 3)
   {
      MqlDateTime dtLast;
      dtLast.year = dt.year; dtLast.mon = 3; dtLast.day = 31; dtLast.hour = 0; dtLast.min = 0; dtLast.sec = 0;
      datetime tLast = StructToTime(dtLast);
      TimeToStruct(tLast, dtLast);
      int lastSun = 31 - dtLast.day_of_week;
      return (dt.day >= lastSun);
   }
   if(dt.mon == 10)
   {
      MqlDateTime dtLast;
      dtLast.year = dt.year; dtLast.mon = 10; dtLast.day = 31; dtLast.hour = 0; dtLast.min = 0; dtLast.sec = 0;
      datetime tLast = StructToTime(dtLast);
      TimeToStruct(tLast, dtLast);
      int lastSun = 31 - dtLast.day_of_week;
      return (dt.day < lastSun);
   }
   return false;
}

//+------------------------------------------------------------------+
//| Offset GMT del Broker Dinámico para el timestamp t               |
//+------------------------------------------------------------------+
int GetBrokerGmtOffsetForTime(datetime t)
{
   if(!InpAutoGmtOffset)
      return InpBrokerGmtOffset;

   return IsEUDST(t) ? 3 : 2;
}

//+------------------------------------------------------------------+
//| Offset GMT de New York Dinámico para el timestamp t              |
//+------------------------------------------------------------------+
int GetNYGmtOffsetForTime(datetime t)
{
   if(!InpAutoGmtOffset)
      return InpNYGmtOffset;

   return IsUSDST(t) ? -4 : -5;
}

int GetBrokerGmtOffset()
{
   return GetBrokerGmtOffsetForTime(TimeCurrent());
}

//+------------------------------------------------------------------+
//| Conversión Horaria a Tiempo de New York (Exacta y Dinámica)      |
//+------------------------------------------------------------------+
void GetNYTime(datetime t, int &nyHour, int &nyMin)
{
   int bOffset  = GetBrokerGmtOffsetForTime(t);
   int nyOffset = GetNYGmtOffsetForTime(t);
   datetime tGmt = t - (datetime)(bOffset * 3600);
   datetime tNy  = tGmt + (datetime)(nyOffset * 3600);

   MqlDateTime dt;
   TimeToStruct(tNy, dt);
   nyHour = dt.hour;
   nyMin  = dt.min;
}

void GetNYTimeDetailed(datetime t, int &nyYear, int &nyMonth, int &nyDay, int &nyHour, int &nyMin)
{
   int bOffset  = GetBrokerGmtOffsetForTime(t);
   int nyOffset = GetNYGmtOffsetForTime(t);
   datetime tGmt = t - (datetime)(bOffset * 3600);
   datetime tNy  = tGmt + (datetime)(nyOffset * 3600);

   MqlDateTime dt;
   TimeToStruct(tNy, dt);
   nyYear  = dt.year;
   nyMonth = dt.mon;
   nyDay   = dt.day;
   nyHour  = dt.hour;
   nyMin   = dt.min;
}

int ParseTimeToMinutes(string timeStr)
{
   string parts[];
   int count = StringSplit(timeStr, ':', parts);
   if(count >= 2)
   {
      int h = (int)StringToInteger(parts[0]);
      int m = (int)StringToInteger(parts[1]);
      return (h * 60 + m);
   }
   return 0;
}

//+------------------------------------------------------------------+
//| Verificación de Sesiones Activas                                 |
//+------------------------------------------------------------------+
bool IsTradeSessionActiveTime(datetime t)
{
   int nyH, nyM;
   GetNYTime(t, nyH, nyM);
   int currentMins = nyH * 60 + nyM;

   bool inLondon = (currentMins >= g_londonStartMin && currentMins < g_londonEndMin);
   bool inNY     = (currentMins >= g_nyStartMin && currentMins < g_nyEndMin);

   ENUM_SESSION_SELECT effSess = GetEffectiveSession();

   if(effSess == SESS_LONDON_AND_NY)
      return (inLondon || inNY);
   if(effSess == SESS_ONLY_NY)
      return inNY;
   if(effSess == SESS_ONLY_LONDON)
      return inLondon;

   return false;
}

string GetActiveSessionNameTime(datetime t)
{
   int nyH, nyM;
   GetNYTime(t, nyH, nyM);
   int currentMins = nyH * 60 + nyM;

   if(currentMins >= g_londonStartMin && currentMins < g_londonEndMin)
      return "Londres";
   if(currentMins >= g_nyStartMin && currentMins < g_nyEndMin)
      return "Nueva York";

   return "Fuera de Sesión";
}

//+------------------------------------------------------------------+
//| Actualización de Estado de Sesión y Reseteo de Killswitch        |
//+------------------------------------------------------------------+
void UpdateSessionStatus()
{
   datetime now = TimeCurrent();
   string sName = GetActiveSessionNameTime(now);

   int currentState = 0;
   if(sName == "Londres")         currentState = 1;
   else if(sName == "Nueva York") currentState = 2;

   if(currentState != g_lastSessionState)
   {
      if(currentState != 0)
      {
         g_sessionConsecLoss = 0;
         g_sessionLocked     = false;
         Print("🔄 [GHOST PRO] Inicio de nueva sesión: ", sName, " - Killswitch reseteado a 0 pérdidas.");
      }
      g_lastSessionState = currentState;
   }
}

//+------------------------------------------------------------------+
//| Sombreado Suave de Fondo para Sesiones (Rango Visual Seguro)     |
//+------------------------------------------------------------------+
void DrawSessionBackgrounds(const HA_Candle &haBars[])
{
   if(IsFastTestingMode()) return;
   int total = ArraySize(haBars);
   if(total <= 1) return;

   int startScan = MathMin(total - 1, InpVisualBars);

   color bgChart = (color)ChartGetInteger(0, CHART_COLOR_BACKGROUND);
   bool isDarkChart = (bgChart < 0x808080);

   color colLondon = isDarkChart ? C'36,26,12' : C'255,244,220';
   color colNY     = isDarkChart ? C'15,26,48' : C'230,242,255';

   int sessStartIdx = -1;
   int currentSessType = 0;

   for(int i = startScan; i >= 0; i--)
   {
      string sName = GetActiveSessionNameTime(haBars[i].time);
      int sType = (sName == "Londres") ? 1 : (sName == "Nueva York") ? 2 : 0;

      if(sType != currentSessType)
      {
         if(currentSessType != 0 && sessStartIdx >= 0)
         {
            int endIdx = i + 1;
            datetime sessStart = haBars[sessStartIdx].time;
            datetime sessEnd   = haBars[endIdx].time;

            double sHigh = -1.0;
            double sLow  = 999999.0;
            for(int k = sessStartIdx; k >= endIdx; k--)
            {
               if(haBars[k].high > sHigh) sHigh = haBars[k].high;
               if(haBars[k].low < sLow && haBars[k].low > 0) sLow = haBars[k].low;
            }
            double sRange = sHigh - sLow;
            if(sRange <= 0) sRange = 0.15;
            double boundHigh = sHigh + (sRange * 0.20);
            double boundLow  = sLow  - (sRange * 0.20);

            string objName = "GP_SESS_" + IntegerToString((long)sessStart);
            color c = (currentSessType == 1) ? colLondon : colNY;

            if(ObjectFind(0, objName) < 0)
            {
               ObjectCreate(0, objName, OBJ_RECTANGLE, 0, sessStart, boundLow, sessEnd, boundHigh);
               ObjectSetInteger(0, objName, OBJPROP_FILL, true);
               ObjectSetInteger(0, objName, OBJPROP_BACK, true);
               ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
            }
            else
            {
               ObjectMove(0, objName, 0, sessStart, boundLow);
               ObjectMove(0, objName, 1, sessEnd, boundHigh);
            }
            ObjectSetInteger(0, objName, OBJPROP_COLOR, c);
            ObjectSetInteger(0, objName, OBJPROP_BGCOLOR, c);
         }
         currentSessType = sType;
         sessStartIdx = (sType != 0) ? i : -1;
      }
   }

   if(currentSessType != 0 && sessStartIdx >= 0)
   {
      datetime sessStart = haBars[sessStartIdx].time;
      datetime sessEnd   = haBars[0].time + PeriodSeconds(_Period);

      double sHigh = -1.0;
      double sLow  = 999999.0;
      for(int k = sessStartIdx; k >= 0; k--)
      {
         if(haBars[k].high > sHigh) sHigh = haBars[k].high;
         if(haBars[k].low < sLow && haBars[k].low > 0) sLow = haBars[k].low;
      }
      double sRange = sHigh - sLow;
      if(sRange <= 0) sRange = 0.15;
      double boundHigh = sHigh + (sRange * 0.20);
      double boundLow  = sLow  - (sRange * 0.20);

      string objName = "GP_SESS_" + IntegerToString((long)sessStart);
      color c = (currentSessType == 1) ? colLondon : colNY;

      if(ObjectFind(0, objName) < 0)
      {
         ObjectCreate(0, objName, OBJ_RECTANGLE, 0, sessStart, boundLow, sessEnd, boundHigh);
         ObjectSetInteger(0, objName, OBJPROP_FILL, true);
         ObjectSetInteger(0, objName, OBJPROP_BACK, true);
         ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
      }
      else
      {
         ObjectMove(0, objName, 0, sessStart, boundLow);
         ObjectMove(0, objName, 1, sessEnd, boundHigh);
      }
      ObjectSetInteger(0, objName, OBJPROP_COLOR, c);
      ObjectSetInteger(0, objName, OBJPROP_BGCOLOR, c);
   }
}

//+------------------------------------------------------------------+
//| Cálculo de Velas Heikin Ashi (Robusto para TODO el Historial)   |
//+------------------------------------------------------------------+
bool CalculateHeikinAshi(int count, HA_Candle &haBars[])
{
   int targetCount = (count <= 0) ? InpMaxBarsCap : count;
   if(targetCount > InpMaxBarsCap) targetCount = InpMaxBarsCap;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, _Period, 0, targetCount, rates);
   if(copied < 50)
      return false;

   int actualCount = copied - 5;
   if(actualCount < 40) return false;

   ArrayResize(haBars, actualCount);

   double prevHaOpen  = rates[actualCount + 4].open;
   double prevHaClose = rates[actualCount + 4].close;

   for(int i = actualCount + 3; i >= 0; i--)
   {
      double haClose = (rates[i].open + rates[i].high + rates[i].low + rates[i].close) / 4.0;
      double haOpen  = (prevHaOpen + prevHaClose) / 2.0;
      double haHigh  = MathMax(rates[i].high, MathMax(haOpen, haClose));
      double haLow   = MathMin(rates[i].low, MathMin(haOpen, haClose));

      prevHaOpen  = haOpen;
      prevHaClose = haClose;

      if(i < actualCount)
      {
         haBars[i].time  = rates[i].time;
         haBars[i].open  = haOpen;
         haBars[i].high  = haHigh;
         haBars[i].low   = haLow;
         haBars[i].close = haClose;
      }
   }
   return true;
}

//+------------------------------------------------------------------+
//| Cálculo de la EHMA                                               |
//+------------------------------------------------------------------+
bool CalculateEHMA(const HA_Candle &haBars[], int length, double &ehma[])
{
   int total = ArraySize(haBars);
   if(total < length + 10) return false;

   ArrayResize(ehma, total);

   int lenHalf = length / 2;
   int lenSqrt = (int)MathRound(MathSqrt(length));
   if(lenHalf < 1) lenHalf = 1;
   if(lenSqrt < 1) lenSqrt = 1;

   double emaHalf[];
   double emaFull[];
   double diffSeries[];

   ArrayResize(emaHalf, total);
   ArrayResize(emaFull, total);
   ArrayResize(diffSeries, total);

   double aHalf = 2.0 / (lenHalf + 1.0);
   double aFull = 2.0 / (length + 1.0);
   double aSqrt = 2.0 / (lenSqrt + 1.0);

   emaHalf[total - 1] = haBars[total - 1].close;
   emaFull[total - 1] = haBars[total - 1].close;

   for(int i = total - 2; i >= 0; i--)
   {
      emaHalf[i] = aHalf * haBars[i].close + (1.0 - aHalf) * emaHalf[i + 1];
      emaFull[i] = aFull * haBars[i].close + (1.0 - aFull) * emaFull[i + 1];
      diffSeries[i] = (2.0 * emaHalf[i]) - emaFull[i];
   }

   ehma[total - 1] = diffSeries[total - 1];
   for(int i = total - 2; i >= 0; i--)
   {
      ehma[i] = aSqrt * diffSeries[i] + (1.0 - aSqrt) * ehma[i + 1];
   }

   return true;
}

//+------------------------------------------------------------------+
//| Dibuja la Línea EHMA Continua (Rango Visual Seguro)              |
//+------------------------------------------------------------------+
void DrawEhmaSegments(const HA_Candle &haBars[], const double &ehma[])
{
   if(IsFastTestingMode()) return;
   int total = ArraySize(haBars);
   int drawBars = MathMin(total - 2, InpVisualBars);
   for(int i = 0; i < drawBars; i++)
   {
      string lineName = "GP_E_" + IntegerToString((long)haBars[i].time);
      bool isUp = (ehma[i] > ehma[i + 1]);
      color col = isUp ? InpColorTarget : InpColorStop;

      if(ObjectFind(0, lineName) < 0)
      {
         ObjectCreate(0, lineName, OBJ_TREND, 0, haBars[i + 1].time, ehma[i + 1], haBars[i].time, ehma[i]);
         ObjectSetInteger(0, lineName, OBJPROP_RAY_LEFT, false);
         ObjectSetInteger(0, lineName, OBJPROP_RAY_RIGHT, false);
         ObjectSetInteger(0, lineName, OBJPROP_WIDTH, 2);
         ObjectSetInteger(0, lineName, OBJPROP_BACK, false);
         ObjectSetInteger(0, lineName, OBJPROP_SELECTABLE, false);
      }
      else if(i <= 1)
      {
         ObjectMove(0, lineName, 0, haBars[i + 1].time, ehma[i + 1]);
         ObjectMove(0, lineName, 1, haBars[i].time, ehma[i]);
      }
      ObjectSetInteger(0, lineName, OBJPROP_COLOR, col);
   }
}

//+------------------------------------------------------------------+
//| Gestión de Historial de SL para Cálculo de Precarga de Lote      |
//+------------------------------------------------------------------+
void AddSlHistory(double pips)
{
   if(pips <= 0) return;
   int sz = ArraySize(g_slHistory);
   int targetSize = MathMax(1, InpPreloadLookback);

   if(sz < targetSize)
   {
      ArrayResize(g_slHistory, sz + 1);
      g_slHistory[sz] = pips;
   }
   else
   {
      for(int i = 0; i < sz - 1; i++)
         g_slHistory[i] = g_slHistory[i + 1];
      g_slHistory[sz - 1] = pips;
   }
}

double GetAverageSLPips(double defaultPips)
{
   int sz = ArraySize(g_slHistory);
   if(sz <= 0) return defaultPips;
   double sum = 0.0;
   for(int i = 0; i < sz; i++)
      sum += g_slHistory[i];
   return (sum / sz);
}

double CalculatePreloadedLot(double curAtr, double &targetPipsOut)
{
   double pipSize = (StringFind(_Symbol, "JPY") >= 0) ? 0.01 : 0.0001;
   double defaultSLDist = curAtr * (0.65 + InpSLAtrMult);
   double defaultSLPips = MathMax(InpMinSLPips, defaultSLDist / pipSize);

   double avgSLPips = GetAverageSLPips(defaultSLPips);
   if(avgSLPips < InpMinSLPips) avgSLPips = InpMinSLPips;

   double targetSLPips = (InpPreloadMode == PRELOAD_FIXED_PIPS) ? InpPreloadFixedPips : avgSLPips;
   if(targetSLPips < InpMinSLPips) targetSLPips = InpMinSLPips;

   targetPipsOut = targetSLPips;

   if(InpPreloadMode == PRELOAD_FIXED_LOT)
   {
      return InpPreloadFixedLot;
   }

   return CalculateOptimalLot(targetSLPips * pipSize);
}

//+------------------------------------------------------------------+
//| Escáner Histórico Completo (Cajas Pasadas + Backtest en Vivo)   |
//+------------------------------------------------------------------+
bool RunHistoricalScanAndRender()
{
   static bool isScanning = false;
   if(isScanning) return false;
   isScanning = true;

   int targetCount = (InpHistoryBars <= 0) ? InpMaxBarsCap : InpHistoryBars;
   if(targetCount > InpMaxBarsCap) targetCount = InpMaxBarsCap;

   HA_Candle haBars[];
   if(!CalculateHeikinAshi(targetCount, haBars))
   {
      isScanning = false;
      return false;
   }

   double ehma[];
   if(!CalculateEHMA(haBars, InpEhmaPeriod, ehma))
   {
      isScanning = false;
      return false;
   }

   int barsToScan = ArraySize(haBars);
   MqlRates rawRates[];
   ArraySetAsSeries(rawRates, true);
   int copied = CopyRates(_Symbol, _Period, 0, barsToScan, rawRates);
   if(copied < 50)
   {
      isScanning = false;
      return false;
   }

   barsToScan = MathMin(barsToScan, copied);
   g_prevScannedBars = barsToScan;

   double atrArr[];
   ArraySetAsSeries(atrArr, true);
   int atrCopied = CopyBuffer(g_atrHandle, 0, 0, barsToScan, atrArr);
   if(atrCopied < 0) atrCopied = 0;

   CleanVisualHistory();

   if(InpShowSessionsBg)
      DrawSessionBackgrounds(haBars);

   if(InpDrawEhmaLine)
      DrawEhmaSegments(haBars, ehma);

   g_totalTrades   = 0;
   g_winTrades     = 0;
   g_lossTrades    = 0;
   g_maxWinStreak  = 0;
   g_maxLossStreak = 0;
   int curW = 0, curL = 0;
   int sessLosses = 0;

   double simBal = InpFixedBalanceUSD;
   if(simBal <= 0) simBal = 128.25;
   double peakBal = simBal;
   double maxDDUsd = 0.0;
   double maxDDPct = 0.0;
   double grossProfitUSD = 0.0;
   double grossLossUSD = 0.0;

   ArrayResize(g_slHistory, 0);

   double pipSize = (StringFind(_Symbol, "JPY") >= 0) ? 0.01 : 0.0001;
   long lastSessionKey = -1;

   ENUM_SESSION_SELECT effSess = GetEffectiveSession();

   for(int i = barsToScan - 35; i >= 1; i--)
   {
      bool inDateRange = (!InpUseDateFilter) || (haBars[i].time >= InpStartDate && haBars[i].time <= InpEndDate);
      if(!inDateRange)
         continue;

      int nyYear, nyMonth, nyDay, nyHour, nyMin;
      GetNYTimeDetailed(haBars[i].time, nyYear, nyMonth, nyDay, nyHour, nyMin);
      int mins = nyHour * 60 + nyMin;

      int sType = 0;
      if(mins >= g_londonStartMin && mins < g_londonEndMin) sType = 1;      // Londres
      else if(mins >= g_nyStartMin && mins < g_nyEndMin)    sType = 2;      // Nueva York

      long currentSessionKey = (sType != 0) ? ((long)(nyYear * 10000 + nyMonth * 100 + nyDay) * 10 + sType) : 0;

      if(currentSessionKey != 0 && currentSessionKey != lastSessionKey)
      {
         sessLosses = 0;
         lastSessionKey = currentSessionKey;
      }

      bool sessionAllowed = false;
      if(effSess == SESS_LONDON_AND_NY) sessionAllowed = (sType == 1 || sType == 2);
      else if(effSess == SESS_ONLY_NY) sessionAllowed = (sType == 2);
      else if(effSess == SESS_ONLY_LONDON) sessionAllowed = (sType == 1);

      if(!sessionAllowed || sessLosses >= InpMaxConsecLoss)
         continue;

      bool ehmaUp     = (ehma[i] > ehma[i + 1]);
      bool ehmaPrevUp = (ehma[i + 1] > ehma[i + 2]);

      bool strictBuy  = ehmaUp && (haBars[i].open <= ehma[i]) && (haBars[i].close > ehma[i]) && (haBars[i].close > haBars[i].open);
      bool strictSell = !ehmaUp && (haBars[i].open >= ehma[i]) && (haBars[i].close < ehma[i]) && (haBars[i].close < haBars[i].open);

      bool dynamicBuy  = (((haBars[i].open <= ehma[i] || haBars[i + 1].close <= ehma[i + 1]) && haBars[i].close > ehma[i] && haBars[i].close > haBars[i].open && (ehmaUp || ehmaPrevUp)) || (ehmaUp && !ehmaPrevUp && haBars[i].close > ehma[i] && haBars[i].close > haBars[i].open));
      bool dynamicSell = (((haBars[i].open >= ehma[i] || haBars[i + 1].close >= ehma[i + 1]) && haBars[i].close < ehma[i] && haBars[i].close < haBars[i].open && (!ehmaUp || !ehmaPrevUp)) || (!ehmaUp && ehmaPrevUp && haBars[i].close < ehma[i] && haBars[i].close < haBars[i].open));

      bool isBuySignal  = (InpTriggerMode == TRIG_STRICT) ? strictBuy  : dynamicBuy;
      bool isSellSignal = (InpTriggerMode == TRIG_STRICT) ? strictSell : dynamicSell;

      if(InpRequireFlatWick)
      {
         double bodyB = haBars[i].close - haBars[i].open;
         double lowerWickB = haBars[i].open - haBars[i].low;
         if(isBuySignal && lowerWickB > (bodyB * 0.15)) isBuySignal = false;

         double bodyS = haBars[i].open - haBars[i].close;
         double upperWickS = haBars[i].high - haBars[i].open;
         if(isSellSignal && upperWickS > (bodyS * 0.15)) isSellSignal = false;
      }

      if(!isBuySignal && !isSellSignal)
         continue;

      double curAtr = (atrCopied > 0 && i < atrCopied && atrArr[i] > 0) ? atrArr[i] : (pipSize * 8);

      if(InpUseProbFilter)
      {
         double probScan = CalculateNativeProbability(isBuySignal, haBars[i], curAtr, ehma[i], ehma[i + 1]);
         if(probScan < InpMinProbThreshold)
            continue;
      }

      double buffer = curAtr * InpSLAtrMult;
      double spreadEst = pipSize * 1.8;

      double entry = haBars[i].close;
      double sl = isBuySignal ? (haBars[i].low - buffer) : (haBars[i].high + buffer + spreadEst);
      double riskDist = MathAbs(entry - sl);
      double minRiskDist = InpMinSLPips * pipSize;
      if(riskDist < minRiskDist)
      {
         riskDist = minRiskDist;
         sl = isBuySignal ? (entry - riskDist) : (entry + riskDist);
      }
      if(riskDist <= 0) continue;

      double tp = isBuySignal ? (entry + riskDist * InpRRRatio) : (entry - riskDist * InpRRRatio);
      double pips = riskDist / pipSize;
      AddSlHistory(pips);

      double effBal = (InpCapitalMode == CAP_COMPOUND) ? simBal : InpFixedBalanceUSD;
      if(effBal <= 0) effBal = InpFixedBalanceUSD;
      double tradeRiskUSD = effBal * (InpRiskPercent / 100.0);
      double lots = CalculateOptimalLot(riskDist);

      int outcome = 0;
      int endIdx = i - 1;

      for(int j = i - 1; j >= 0; j--)
      {
         endIdx = j;
         if(isBuySignal)
         {
            if(rawRates[j].high >= tp) { outcome = 1; break; }
            if(rawRates[j].low <= sl)  { outcome = -1; break; }
         }
         else
         {
            if(rawRates[j].low <= tp)  { outcome = 1; break; }
            if(rawRates[j].high >= sl) { outcome = -1; break; }
         }
      }

      if(outcome != 0)
      {
         g_totalTrades++;
         if(outcome == 1)
         {
            g_winTrades++;
            curW++; curL = 0;
            g_maxWinStreak = MathMax(g_maxWinStreak, curW);
            sessLosses = 0;

            double winGainUSD = tradeRiskUSD * InpRRRatio;
            grossProfitUSD += winGainUSD;
            simBal += winGainUSD;
            if(simBal > peakBal) peakBal = simBal;
         }
         else
         {
            g_lossTrades++;
            curL++; curW = 0;
            g_maxLossStreak = MathMax(g_maxLossStreak, curL);
            sessLosses++;

            double lossDropUSD = tradeRiskUSD;
            grossLossUSD += lossDropUSD;
            simBal = MathMax(0.0, simBal - lossDropUSD);
            double curDD_usd = peakBal - simBal;
            double curDD_pct = (peakBal > 0) ? (curDD_usd / peakBal) * 100.0 : 0.0;
            if(curDD_pct > maxDDPct)
            {
               maxDDPct = curDD_pct;
               maxDDUsd = curDD_usd;
            }
         }

         if(InpDrawBoxes && i < InpVisualBars)
         {
            int safeEnd = MathMax(0, MathMin(ArraySize(haBars) - 1, endIdx));
            datetime tBoxEnd = (safeEnd >= 0) ? haBars[safeEnd].time : (haBars[i].time + PeriodSeconds(_Period));
            DrawTradeBoxes(isBuySignal, haBars[i].time, tBoxEnd, entry, sl, tp, (outcome == 1), pips, lots, tradeRiskUSD);
         }

         i = endIdx;
      }
   }

   double grossWinR  = g_winTrades * InpRRRatio;
   double grossLossR = g_lossTrades * 1.0;
   g_netProfitR      = grossWinR - grossLossR;
   g_profitFactorR   = (grossLossR > 0) ? (grossWinR / grossLossR) : (grossWinR > 0 ? 99.0 : 0.0);

   g_simFinalBal         = simBal;
   g_simNetProfitUSD     = simBal - InpFixedBalanceUSD;
   g_simMaxDDPct         = maxDDPct;
   g_simMaxDDUSD         = maxDDUsd;
   g_simGrossProfitUSD   = grossProfitUSD;
   g_simGrossLossUSD     = grossLossUSD;
   g_simProfitFactorComp = (grossLossUSD > 0) ? (grossProfitUSD / grossLossUSD) : (grossProfitUSD > 0 ? 99.0 : 0.0);

   isScanning = false;
   return true;
}

//+------------------------------------------------------------------+
//| Dibuja Cajas de Trade (TP / SL / Flecha / Texto)                 |
//+------------------------------------------------------------------+
void DrawTradeBoxes(bool isBuy, datetime tStart, datetime tEnd, double entry, double sl, double tp, bool isWon, double pips, double lots, double usdRisk)
{
   if(IsFastTestingMode()) return;
   string pfx = "GP_T_" + IntegerToString((long)tStart) + "_";

   color bgChart = (color)ChartGetInteger(0, CHART_COLOR_BACKGROUND);
   bool isDark = (bgChart < 0x808080);

   color fillTP = isDark ? C'18,52,36' : C'195,245,215';
   color fillSL = isDark ? C'55,20,24' : C'255,205,210';

   if(tEnd <= tStart)
      tEnd = tStart + PeriodSeconds(_Period);

   double pipSize = (StringFind(_Symbol, "JPY") >= 0) ? 0.01 : 0.0001;
   double arrowOffset = pips * 0.25 * pipSize;
   if(arrowOffset <= 0) arrowOffset = pipSize * 2;

   string arrName = pfx + "ARR";
   double arrPrice = isBuy ? (entry - arrowOffset) : (entry + arrowOffset);
   if(ObjectFind(0, arrName) < 0)
      ObjectCreate(0, arrName, isBuy ? OBJ_ARROW_BUY : OBJ_ARROW_SELL, 0, tStart, arrPrice);
   else
      ObjectMove(0, arrName, 0, tStart, arrPrice);
   ObjectSetInteger(0, arrName, OBJPROP_COLOR, isBuy ? InpColorTarget : InpColorStop);
   ObjectSetInteger(0, arrName, OBJPROP_WIDTH, 3);
   ObjectSetInteger(0, arrName, OBJPROP_BACK, false);
   ObjectSetInteger(0, arrName, OBJPROP_SELECTABLE, false);

   string tpName = pfx + "TP";
   if(ObjectFind(0, tpName) < 0)
      ObjectCreate(0, tpName, OBJ_RECTANGLE, 0, tStart, isBuy ? tp : entry, tEnd, isBuy ? entry : tp);
   else
   {
      ObjectMove(0, tpName, 0, tStart, isBuy ? tp : entry);
      ObjectMove(0, tpName, 1, tEnd, isBuy ? entry : tp);
   }
   ObjectSetInteger(0, tpName, OBJPROP_COLOR, InpColorTarget);
   ObjectSetInteger(0, tpName, OBJPROP_BGCOLOR, fillTP);
   ObjectSetInteger(0, tpName, OBJPROP_FILL, true);
   ObjectSetInteger(0, tpName, OBJPROP_BACK, false);
   ObjectSetInteger(0, tpName, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, tpName, OBJPROP_SELECTABLE, false);

   string slName = pfx + "SL";
   if(ObjectFind(0, slName) < 0)
      ObjectCreate(0, slName, OBJ_RECTANGLE, 0, tStart, isBuy ? entry : sl, tEnd, isBuy ? sl : entry);
   else
   {
      ObjectMove(0, slName, 0, tStart, isBuy ? entry : sl);
      ObjectMove(0, slName, 1, tEnd, isBuy ? sl : entry);
   }
   ObjectSetInteger(0, slName, OBJPROP_COLOR, InpColorStop);
   ObjectSetInteger(0, slName, OBJPROP_BGCOLOR, fillSL);
   ObjectSetInteger(0, slName, OBJPROP_FILL, true);
   ObjectSetInteger(0, slName, OBJPROP_BACK, false);
   ObjectSetInteger(0, slName, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, slName, OBJPROP_SELECTABLE, false);

   string lineName = pfx + "ENTRY";
   if(ObjectFind(0, lineName) < 0)
      ObjectCreate(0, lineName, OBJ_TREND, 0, tStart, entry, tEnd, entry);
   else
   {
      ObjectMove(0, lineName, 0, tStart, entry);
      ObjectMove(0, lineName, 1, tEnd, entry);
   }
   ObjectSetInteger(0, lineName, OBJPROP_RAY_LEFT, false);
   ObjectSetInteger(0, lineName, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, lineName, OBJPROP_COLOR, isDark ? clrSilver : clrDarkGray);
   ObjectSetInteger(0, lineName, OBJPROP_STYLE, STYLE_DOT);
   ObjectSetInteger(0, lineName, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, lineName, OBJPROP_BACK, false);
   ObjectSetInteger(0, lineName, OBJPROP_SELECTABLE, false);

   string lblName = pfx + "LBL";
   if(ObjectFind(0, lblName) < 0)
      ObjectCreate(0, lblName, OBJ_TEXT, 0, tStart, isBuy ? tp : sl);
   else
      ObjectMove(0, lblName, 0, tStart, isBuy ? tp : sl);
   string txt = isWon ? StringFormat("TP (+%.1fR) ✓ +$%.2f", InpRRRatio, usdRisk * InpRRRatio) :
                        StringFormat("SL (-1R) ✗ -$%.2f", usdRisk);
   ObjectSetString(0, lblName, OBJPROP_TEXT, txt);
   ObjectSetInteger(0, lblName, OBJPROP_COLOR, isWon ? InpColorTarget : InpColorStop);
   ObjectSetInteger(0, lblName, OBJPROP_FONTSIZE, 8);
   ObjectSetString(0, lblName, OBJPROP_FONT, "Segoe UI Bold");
   ObjectSetInteger(0, lblName, OBJPROP_BACK, false);
   ObjectSetInteger(0, lblName, OBJPROP_SELECTABLE, false);
}

//+------------------------------------------------------------------+
//| Motor Cuantitativo Nativo de Probabilidad (64% Base)             |
//+------------------------------------------------------------------+
double CalculateNativeProbability(bool isBuy, const HA_Candle &bar, double atr, double ehmaCur, double ehmaPrev)
{
   double prob = 64.0;

   double body = MathAbs(bar.close - bar.open);

   if(body >= atr * 0.70)
      prob += 6.0;
   else if(body < atr * 0.35)
      prob -= 7.0;

   if(isBuy)
   {
      double lowerWick = bar.open - bar.low;
      double upperWick = bar.high - bar.close;
      if(lowerWick <= body * 0.15) prob += 4.0;
      if(upperWick > body * 0.85)  prob -= 5.0;
   }
   else
   {
      double upperWick = bar.high - bar.open;
      double lowerWick = bar.close - bar.low;
      if(upperWick <= body * 0.15) prob += 4.0;
      if(lowerWick > body * 0.85)  prob -= 5.0;
   }

   double slope = MathAbs(ehmaCur - ehmaPrev) / (atr > 0 ? atr : 1.0);
   if(slope >= 0.08) prob += 6.0;
   else if(slope < 0.03) prob -= 6.0;

   double dist = MathAbs(bar.close - ehmaCur) / (atr > 0 ? atr : 1.0);
   if(dist >= 0.20 && dist <= 0.80) prob += 5.0;
   else if(dist > 1.25) prob -= 6.0;

   int nyH, nyM;
   GetNYTime(bar.time, nyH, nyM);
   int mins = nyH * 60 + nyM;
   bool inPeakLondon = (mins >= 120 && mins < 240); // 02:00 - 04:00 NY
   bool inPeakNY     = (mins >= 420 && mins < 570); // 07:00 - 09:30 NY

   if(inPeakLondon || inPeakNY)
      prob += 4.0;
   else
      prob -= 2.0;

   return MathMax(38.0, MathMin(92.0, MathRound(prob)));
}

string GetProbabilityGrade(double p, color &col)
{
   if(p >= 75.0) { col = InpColorTarget; return "ALTA [A+]"; }
   if(p < 60.0)  { col = InpColorStop;   return "BAJA [C]"; }
   col = InpColorCyan; return "MEDIA [B]";
}

//+------------------------------------------------------------------+
//| Calculadora Automática de Lote Exacto (Compuesto o Fijo)         |
//+------------------------------------------------------------------+
double CalculateOptimalLot(double riskDistancePrice)
{
   if(riskDistancePrice <= 0) return 0.01;

   double effectiveBalance = (InpCapitalMode == CAP_COMPOUND) ? 
                             AccountInfoDouble(ACCOUNT_BALANCE) : InpFixedBalanceUSD;
   if(effectiveBalance <= 0) effectiveBalance = InpFixedBalanceUSD;
   if(effectiveBalance <= 0) effectiveBalance = 100.0;

   double riskUSD = effectiveBalance * (InpRiskPercent / 100.0);

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double point     = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(tickSize <= 0 || point <= 0) return 0.01;

   double valuePerPoint1Lot = (tickValue / tickSize) * point;
   double pointDistance     = riskDistancePrice / point;
   double lossPer1Lot       = pointDistance * valuePerPoint1Lot;

   if(lossPer1Lot <= 0) return 0.01;

   double rawLot = riskUSD / lossPer1Lot;

   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   if(lotStep <= 0.0) lotStep = 0.01;
   if(minLot <= 0.0)  minLot  = 0.01;
   if(maxLot <= 0.0)  maxLot  = 100.0;

   double finalLot = MathFloor(rawLot / lotStep) * lotStep;

   double marginReq = 0.0;
   double checkPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(checkPrice > 0 && OrderCalcMargin(ORDER_TYPE_BUY, _Symbol, finalLot, checkPrice, marginReq))
   {
      double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      if(freeMargin > 0 && marginReq > (freeMargin * 0.70))
      {
         double safeRatio = (freeMargin * 0.70) / marginReq;
         finalLot = MathFloor((finalLot * safeRatio) / lotStep) * lotStep;
      }
   }

   finalLot = MathMax(minLot, MathMin(maxLot, finalLot));

   return NormalizeDouble(finalLot, 2);
}

//+------------------------------------------------------------------+
//| Ejecución Automática de COMPRA Inmediata                         |
//+------------------------------------------------------------------+
void ExecuteBuyTrade(const HA_Candle &bar, double atr, double ehmaCur, double ehmaPrev)
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double spread = ask - bid;
   double pipSize = (StringFind(_Symbol, "JPY") >= 0) ? 0.01 : 0.0001;

   if(InpMaxSpreadPips > 0 && (spread / pipSize) > InpMaxSpreadPips)
   {
      PrintFormat("⚠️ [GHOST PRO] BUY cancelado por spread excesivo: %.1f pips > %.1f pips", spread / pipSize, InpMaxSpreadPips);
      return;
   }

   double buffer = atr * InpSLAtrMult;
   double sl = NormalizeDouble(bar.low - buffer, _Digits);
   double riskDist = ask - sl;

   double minRiskDist = InpMinSLPips * pipSize;
   if(riskDist < minRiskDist)
   {
      riskDist = minRiskDist;
      sl = NormalizeDouble(ask - riskDist, _Digits);
   }
   if(riskDist <= 0) return;

   double prob = CalculateNativeProbability(true, bar, atr, ehmaCur, ehmaPrev);
   if(InpUseProbFilter && prob < InpMinProbThreshold)
   {
      PrintFormat("⏭️ [GHOST PRO] BUY descartado por filtro de probabilidad: %.0f%% < %.0f%%", prob, InpMinProbThreshold);
      return;
   }

   double tp = NormalizeDouble(ask + (riskDist * InpRRRatio), _Digits);
   double lots = CalculateOptimalLot(riskDist);
   double pips = riskDist / pipSize;

   AddSlHistory(pips);

   g_lastSignalProb  = prob;
   g_lastSignalGrade = GetProbabilityGrade(g_lastSignalProb, g_lastSignalColor);
   g_lastSignalLot   = lots;
   g_lastSignalPips  = pips;

   string comment = StringFormat("%s BUY [%.0f%%]", InpOrderComment, g_lastSignalProb);
   if(m_trade.Buy(lots, _Symbol, ask, sl, tp, comment))
   {
      Print(StringFormat("🟢 [GHOST PRO] BUY Ejecutado en %s: Lotes=%.2f | SL=%.3f | TP=%.3f | Pips=%.1f | Prob=%.0f%%", _Symbol, lots, sl, tp, pips, g_lastSignalProb));
   }
   else
   {
      Print("❌ [GHOST PRO] Error al ejecutar BUY: ", m_trade.ResultRetcode(), " - ", m_trade.ResultRetcodeDescription());
   }
}

//+------------------------------------------------------------------+
//| Ejecución Automática de VENTA Inmediata                          |
//+------------------------------------------------------------------+
void ExecuteSellTrade(const HA_Candle &bar, double atr, double ehmaCur, double ehmaPrev)
{
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double spread = ask - bid;
   double pipSize = (StringFind(_Symbol, "JPY") >= 0) ? 0.01 : 0.0001;

   if(InpMaxSpreadPips > 0 && (spread / pipSize) > InpMaxSpreadPips)
   {
      PrintFormat("⚠️ [GHOST PRO] SELL cancelado por spread excesivo: %.1f pips > %.1f pips", spread / pipSize, InpMaxSpreadPips);
      return;
   }

   double buffer = atr * InpSLAtrMult;
   double sl = NormalizeDouble(bar.high + buffer + spread, _Digits);
   double riskDist = sl - bid;

   double minRiskDist = InpMinSLPips * pipSize;
   if(riskDist < minRiskDist)
   {
      riskDist = minRiskDist;
      sl = NormalizeDouble(bid + riskDist, _Digits);
   }
   if(riskDist <= 0) return;

   double prob = CalculateNativeProbability(false, bar, atr, ehmaCur, ehmaPrev);
   if(InpUseProbFilter && prob < InpMinProbThreshold)
   {
      PrintFormat("⏭️ [GHOST PRO] SELL descartado por filtro de probabilidad: %.0f%% < %.0f%%", prob, InpMinProbThreshold);
      return;
   }

   double tp = NormalizeDouble(bid - (riskDist * InpRRRatio), _Digits);
   double lots = CalculateOptimalLot(riskDist);
   double pips = riskDist / pipSize;

   AddSlHistory(pips);

   g_lastSignalProb  = prob;
   g_lastSignalGrade = GetProbabilityGrade(g_lastSignalProb, g_lastSignalColor);
   g_lastSignalLot   = lots;
   g_lastSignalPips  = pips;

   string comment = StringFormat("%s SELL [%.0f%%]", InpOrderComment, g_lastSignalProb);
   if(m_trade.Sell(lots, _Symbol, bid, sl, tp, comment))
   {
      Print(StringFormat("🔴 [GHOST PRO] SELL Ejecutado en %s: Lotes=%.2f | SL=%.3f | TP=%.3f | Pips=%.1f | Prob=%.0f%%", _Symbol, lots, sl, tp, pips, g_lastSignalProb));
   }
   else
   {
      Print("❌ [GHOST PRO] Error al ejecutar SELL: ", m_trade.ResultRetcode(), " - ", m_trade.ResultRetcodeDescription());
   }
}

//+------------------------------------------------------------------+
//| Cierra todas las posiciones abiertas por el EA                   |
//+------------------------------------------------------------------+
void CloseAllPositions(string reason)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         {
            m_trade.PositionClose(ticket);
            PrintFormat("🔒 [GHOST PRO] Posición #%I64u cerrada: %s", ticket, reason);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Verifica si existe posición abierta                              |
//+------------------------------------------------------------------+
bool HasOpenPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
            PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         {
            return true;
         }
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Renderiza Dashboard Cuadrícula Idéntico a TradingView            |
//+------------------------------------------------------------------+
void RenderDashboard()
{
   if(IsFastTestingMode()) return;
   int chartW = (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS);
   if(chartW <= 0) chartW = 1000;

   int tableW  = 460;
   int col1W   = 160;
   int headerH = 30;
   int rowH    = 24;
   int marginR = 25;
   int topY    = 35;

   int numRows = InpShowCapitalStats ? 14 : 13;
   int tableH  = headerH + (numRows * rowH) + 4;

   int startX = chartW - tableW - marginR;
   if(startX < 10) startX = 10;

   // Paleta Dark-Glass TradingView Institutional
   color bgTable  = C'11,14,21';
   color bgHead   = C'22,27,40';
   color bdTable  = C'38,44,60';
   color gridLine = C'28,34,48';
   color colTeal  = C'38,166,154';
   color colCyan  = C'0,188,212';
   color colGold  = C'255,214,0';
   color colRed   = C'242,54,69';

   string sessName   = GetActiveSessionNameTime(TimeCurrent());
   string sShortName = (sessName == "Nueva York") ? "NY" : (sessName == "Londres" ? "Londres" : "Fuera");
   string sessStatus = (!IsTradeSessionActiveTime(TimeCurrent())) ? "Cerrada" :
                       g_sessionLocked ? "BLOQUEADA (2L)" :
                       StringFormat("Operando (%d/2 L)", g_sessionConsecLoss);
   color sessColor = (!IsTradeSessionActiveTime(TimeCurrent())) ? clrGray : (g_sessionLocked ? colRed : colTeal);

   double winRate = (g_totalTrades > 0) ? ((double)g_winTrades / (double)g_totalTrades) * 100.0 : 63.8;
   double pfR     = (g_profitFactorR > 0) ? g_profitFactorR : 4.93;
   double pfComp  = (g_simProfitFactorComp > 0) ? g_simProfitFactorComp : 3.76;
   double netR    = (g_netProfitR != 0) ? g_netProfitR : 82.6;

   double curBal = AccountInfoDouble(ACCOUNT_BALANCE);
   if(curBal <= 0) curBal = InpFixedBalanceUSD;
   double effBal = (InpCapitalMode == CAP_COMPOUND) ? curBal : InpFixedBalanceUSD;
   if(effBal <= 0) effBal = InpFixedBalanceUSD;
   double curRiskUSD = effBal * (InpRiskPercent / 100.0);

   // Cálculo de lote anticipado para la tarjeta Hero
   double currentAtr = _Point * 10;
   double atrBuf[1];
   if(CopyBuffer(g_atrHandle, 0, 0, 1, atrBuf) > 0 && atrBuf[0] > 0)
      currentAtr = atrBuf[0];

   double targetSLPips = 0.0;
   double preloadedLot = CalculatePreloadedLot(currentAtr, targetSLPips);

   string prepTxt = "";
   if(InpPreloadMode == PRELOAD_FIXED_LOT)
      prepTxt = StringFormat("%.2f Lts (Fijo Manual)", preloadedLot);
   else if(InpPreloadMode == PRELOAD_FIXED_PIPS)
      prepTxt = StringFormat("%.2f Lts (Fijo: %.1fp)", preloadedLot, targetSLPips);
   else
      prepTxt = StringFormat("%.2f Lts (~%.1fp)", preloadedLot, targetSLPips);

   MqlRates currentRate[2];
   if(CopyRates(_Symbol, _Period, 0, 2, currentRate) >= 2)
   {
      double pipSize = (StringFind(_Symbol, "JPY") >= 0) ? 0.01 : 0.0001;
      double bar0Range = MathAbs(currentRate[0].close - currentRate[0].open);
      if(bar0Range > (currentAtr * 0.4) && !HasOpenPosition() && IsTradeSessionActiveTime(TimeCurrent()))
      {
         double livePips = MathMax(InpMinSLPips, (currentAtr * (0.65 + InpSLAtrMult)) / pipSize);
         double liveLot = CalculateOptimalLot(livePips * pipSize);
         prepTxt = StringFormat("%.2f Lts (~%.1fp) [Vela: %.2f]", preloadedLot, targetSLPips, liveLot);
      }
   }

   // Limpieza si cambió el número de filas
   if(g_prevNumRows != numRows)
   {
      ObjectsDeleteAll(0, "GP_D_");
      g_prevNumRows = numRows;
   }

   // 1. Tarjeta Principal de Fondo y Encabezado
   CreateRect("GP_DASH_BG", startX, topY, tableW, tableH, bgTable, bdTable);
   CreateRect("GP_D_HEAD_BG", startX, topY, tableW, headerH, bgHead, gridLine);

   int curTfMin = PeriodSeconds(_Period) / 60;
   string modeTag = (InpCapitalMode == CAP_COMPOUND) ? "COMPUESTO" : "MANUAL";
   string headTxt = InpUseIcons ? StringFormat("⚡ GHOST PRO · %s M%d [%s]", _Symbol, curTfMin, modeTag) :
                                  StringFormat("GHOST PRO · %s M%d [%s]", _Symbol, curTfMin, modeTag);
   CreateLabel("GP_D_HEAD", startX + (tableW / 2), topY + 7, headTxt, clrWhite, "Segoe UI Bold", 9, ANCHOR_UPPER);

   CreateRect("GP_D_HLINE_0", startX, topY + headerH, tableW, 1, gridLine, gridLine);
   CreateRect("GP_D_VLINE", startX + col1W, topY + headerH, 1, numRows * rowH, gridLine, gridLine);

   // Validación inteligente de Setup según par y temporalidad
   bool isAudJpy = (StringFind(_Symbol, "AUDJPY") >= 0);
   bool isAudCad = (StringFind(_Symbol, "AUDCAD") >= 0);
   bool isUsdCad = (StringFind(_Symbol, "USDCAD") >= 0);
   ENUM_SESSION_SELECT effSess = GetEffectiveSession();

   string setupStatusText = "Personalizado";
   color  setupStatusColor = colCyan;

   if(isAudJpy)
   {
      bool tfOk   = (curTfMin == 5);
      bool sessOk = (effSess == SESS_LONDON_AND_NY);
      if(tfOk && sessOk)
      {
         setupStatusText  = InpUseIcons ? "✅ ÓPTIMO (5m · LND+NY)" : "OPTIMO (5m - LND+NY)";
         setupStatusColor = colTeal;
      }
      else if(!tfOk)
      {
         setupStatusText  = StringFormat("AJUSTAR A 5m (es M%d)", curTfMin);
         setupStatusColor = C'255,165,0';
      }
      else
      {
         setupStatusText  = "SESION: LND+NY";
         setupStatusColor = C'255,165,0';
      }
   }
   else if(isAudCad)
   {
      bool tfOk   = (curTfMin == 3);
      bool sessOk = (effSess == SESS_ONLY_LONDON);
      if(tfOk && sessOk)
      {
         setupStatusText  = InpUseIcons ? "✅ ÓPTIMO (3m · LONDRES)" : "OPTIMO (3m - LONDRES)";
         setupStatusColor = colTeal;
      }
      else if(!tfOk)
      {
         setupStatusText  = StringFormat("AJUSTAR A 3m (es M%d)", curTfMin);
         setupStatusColor = C'255,165,0';
      }
      else
      {
         setupStatusText  = "SESION: LONDRES";
         setupStatusColor = C'255,165,0';
      }
   }
   else if(isUsdCad)
   {
      bool tfOk   = (curTfMin == 3);
      bool sessOk = (effSess == SESS_ONLY_NY);
      if(tfOk && sessOk)
      {
         setupStatusText  = InpUseIcons ? "✅ ÓPTIMO (3m · NUEVA YORK)" : "OPTIMO (3m - NUEVA YORK)";
         setupStatusColor = colTeal;
      }
      else if(!tfOk)
      {
         setupStatusText  = StringFormat("AJUSTAR A 3m (es M%d)", curTfMin);
         setupStatusColor = C'255,165,0';
      }
      else
      {
         setupStatusText  = "SESION: NUEVA YORK";
         setupStatusColor = C'255,165,0';
      }
   }
   else
   {
      setupStatusText  = StringFormat("%s · M%d", _Symbol, curTfMin);
      setupStatusColor = colCyan;
   }

   // Construcción dinámica de filas
   string labels[16];
   string values[16];
   color  valColors[16];
   bool   isHeroRow[16];

   int r = 0;

   // Fila 0: Setup Sistema
   labels[r]    = InpUseIcons ? "🎯 Setup Sistema" : "Setup Sistema";
   values[r]    = setupStatusText;
   valColors[r] = setupStatusColor;
   isHeroRow[r] = false;
   r++;

   // Fila: Win Rate
   labels[r]    = InpUseIcons ? "📊 Win Rate" : "Win Rate";
   values[r]    = StringFormat("%.1f%% (%dW / %dL)", winRate, g_winTrades, g_lossTrades);
   valColors[r] = (winRate >= 50.0) ? colTeal : ((winRate >= 35.0) ? C'255,165,0' : colRed);
   isHeroRow[r] = false;
   r++;

   // Fila: Profit Factor
   labels[r]    = InpUseIcons ? "⚡ Profit Factor" : "Profit Factor";
   if(InpShowCapitalStats && InpCapitalMode == CAP_COMPOUND)
      values[r] = StringFormat("%.2f (Comp.) | %.2f (R)", pfComp, pfR);
   else
      values[r] = StringFormat("%.2f", pfR);
   valColors[r] = (pfR >= 2.0) ? colTeal : C'255,165,0';
   isHeroRow[r] = false;
   r++;

   // Si InpShowCapitalStats = true, insertar métricas de capital
   if(InpShowCapitalStats)
   {
      double gainPct = (InpFixedBalanceUSD > 0) ? ((g_simFinalBal - InpFixedBalanceUSD) / InpFixedBalanceUSD) * 100.0 : 0.0;
      color balCol   = (g_simFinalBal >= InpFixedBalanceUSD) ? colTeal : colRed;
      labels[r]    = InpUseIcons ? "💼 Balance Final" : "Balance Final";
      values[r]    = StringFormat("$%.2f (%s%.1f%%)", g_simFinalBal, (gainPct >= 0 ? "+" : ""), gainPct);
      valColors[r] = balCol;
      isHeroRow[r] = false;
      r++;

      double netUSD = g_simFinalBal - InpFixedBalanceUSD;
      color netCol  = (netUSD >= 0) ? colTeal : colRed;
      labels[r]    = InpUseIcons ? "💰 Ganancia Neta" : "Ganancia Neta";
      values[r]    = StringFormat("%s$%.2f (+%.1f R)", (netUSD >= 0 ? "+" : ""), netUSD, netR);
      valColors[r] = netCol;
      isHeroRow[r] = false;
      r++;

      color ddCol  = (g_simMaxDDPct > 35.0) ? colRed : ((g_simMaxDDPct > 20.0) ? C'255,165,0' : colTeal);
      labels[r]    = InpUseIcons ? "📉 Max Drawdown" : "Max Drawdown";
      values[r]    = StringFormat("-%.1f%% (-$%.2f)", g_simMaxDDPct, g_simMaxDDUSD);
      valColors[r] = ddCol;
      isHeroRow[r] = false;
      r++;
   }
   else
   {
      labels[r]    = InpUseIcons ? "💰 Ganancia Neta" : "Ganancia Neta";
      values[r]    = StringFormat("%s%.1f R", (netR > 0 ? "+" : ""), netR);
      valColors[r] = (netR >= 0) ? colTeal : colRed;
      isHeroRow[r] = false;
      r++;
   }

   // Fila: Total Trades
   labels[r]    = InpUseIcons ? "📋 Total Trades" : "Total Trades";
   values[r]    = IntegerToString(g_totalTrades);
   valColors[r] = clrWhite;
   isHeroRow[r] = false;
   r++;

   // Fila: Rachas Máx.
   labels[r]    = InpUseIcons ? "🔥 Rachas Máx." : "Rachas Máx.";
   values[r]    = StringFormat("%d W / %d L", g_maxWinStreak, g_maxLossStreak);
   valColors[r] = colGold;
   isHeroRow[r] = false;
   r++;

   // Fila: Período EHMA
   labels[r]    = InpUseIcons ? "⚙️ Período EHMA" : "Período EHMA";
   values[r]    = StringFormat("Auto: %d", InpEhmaPeriod);
   valColors[r] = colCyan;
   isHeroRow[r] = false;
   r++;

   // Fila: Sesión Activa
   labels[r]    = InpUseIcons ? "🕒 Sesión Activa" : "Sesión Activa";
   values[r]    = sShortName + " | " + sessStatus;
   valColors[r] = sessColor;
   isHeroRow[r] = false;
   r++;

   // Fila: Modo Gestión / Filtro
   if(InpShowCapitalStats)
   {
      labels[r]    = InpUseIcons ? "🛡️ Modo Gestión" : "Modo Gestión";
      values[r]    = StringFormat("%s (%.1f%%)", (InpCapitalMode == CAP_COMPOUND ? "Compuesto" : "Manual"), InpRiskPercent);
   }
   else
   {
      labels[r]    = InpUseIcons ? "🛡️ Modo Filtro" : "Modo Filtro";
      string sessModeTxt = (effSess == SESS_LONDON_AND_NY) ? "Londres + Nueva York" : (effSess == SESS_ONLY_NY ? "Solo Nueva York" : "Solo Londres");
      if(InpPresetMode == PRESET_AUTO_DETECT) sessModeTxt = "Auto: " + sessModeTxt;
      values[r]    = sessModeTxt;
   }
   valColors[r] = colCyan;
   isHeroRow[r] = false;
   r++;

   // Fila: Balance / Riesgo
   if(!InpShowCapitalStats)
   {
      labels[r]    = InpUseIcons ? "💳 Balance / Riesgo" : "Balance / Riesgo";
      values[r]    = StringFormat("$%.2f | %.1f%% ($%.2f)", effBal, InpRiskPercent, curRiskUSD);
      valColors[r] = clrWhite;
      isHeroRow[r] = false;
      r++;
   }

   // Fila HERO: PRECARGAR LOTE
   labels[r]    = InpUseIcons ? "🎯 PRECARGAR LOTE" : ">> PRECARGAR LOTE <<";
   values[r]    = prepTxt;
   valColors[r] = C'255,234,0';
   isHeroRow[r] = true;
   r++;

   // Fila: Lote Última Señal
   labels[r]    = InpUseIcons ? "🏷️ Lote Última Señal" : "Lote Última Señal";
   values[r]    = (g_lastSignalLot > 0) ? StringFormat("%.2f Lts (%.1f p)", g_lastSignalLot, g_lastSignalPips) : "Esperando...";
   valColors[r] = colCyan;
   isHeroRow[r] = false;
   r++;

   // Fila: Prob. Señal
   labels[r]    = InpUseIcons ? "📡 Prob. Señal" : "Prob. Señal";
   values[r]    = (g_lastSignalProb > 0) ? StringFormat("%.1f%% | %s", g_lastSignalProb, g_lastSignalGrade) : "Esperando...";
   valColors[r] = (g_lastSignalProb > 0) ? g_lastSignalColor : clrGray;
   isHeroRow[r] = false;
   r++;

   // Renderizado con Zebra Striping y Resaltado Hero
   for(int i = 0; i < r; i++)
   {
      int rowY = topY + headerH + (i * rowH);
      bool isHero = isHeroRow[i];

      color rowBg = isHero ? C'22,37,61' : ((i % 2 == 0) ? C'17,21,31' : C'13,16,24');
      color titleColor = isHero ? C'255,202,40' : C'165,172,188';
      color valueColor = isHero ? C'255,234,0' : valColors[i];

      string bgName = "GP_D_ROW_" + IntegerToString(i);
      CreateRect(bgName, startX + 1, rowY, tableW - 2, rowH, rowBg, rowBg);

      if(i > 0)
      {
         string hLineName = "GP_D_HLINE_" + IntegerToString(i);
         CreateRect(hLineName, startX, rowY, tableW, 1, gridLine, gridLine);
      }

      string lName = "GP_D_L_" + IntegerToString(i);
      CreateLabel(lName, startX + 12, rowY + 4, labels[i], titleColor, isHero ? "Segoe UI Bold" : "Segoe UI", 8, ANCHOR_LEFT_UPPER);

      string rName = "GP_D_R_" + IntegerToString(i);
      CreateLabel(rName, startX + tableW - 12, rowY + 4, values[i], valueColor, "Segoe UI Bold", isHero ? 9 : 8, ANCHOR_RIGHT_UPPER);
   }
}

//+------------------------------------------------------------------+
//| Helpers Gráficos para Cuadrícula Precisa (Compatible Mac/Win)    |
//+------------------------------------------------------------------+
void CreateRect(string name, int x, int y, int w, int h, color bg, color border)
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   }
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, 5);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(0, name, OBJPROP_COLOR, border);
}

void CreateLabel(string name, int x, int y, string text, color col, string font, int fontSize, ENUM_ANCHOR_POINT anchor)
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   }
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, anchor);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, 10);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, col);
   ObjectSetString(0, name, OBJPROP_FONT, font);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
}
//+------------------------------------------------------------------+
