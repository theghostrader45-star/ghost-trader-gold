//+------------------------------------------------------------------+
//|                                             GhostBridge_MT5.mq5  |
//|               Bridge between MetaTrader 5 and Ghost Trader Gold  |
//|                               https://ghost-trader-gold.onrender.com |
//+------------------------------------------------------------------+
#property copyright "Ghost Trader Gold Institutional"
#property link      "https://ghost-trader-gold.onrender.com"
#property version   "1.10"
#property description "Puente de transmisión en tiempo real de tick, velas M5/H1 y sincronización automática de operaciones hacia la Bitácora Real"
#property description "IMPORTANTE: En MT5 ve a Herramientas -> Opciones -> Asesores Expertos y activa 'Permitir WebRequest' agregando tu URL."

//--- Inputs
input group "=== CONFIGURACIÓN DE CONEXIÓN ==="
input string   InpServerUrl    = "https://ghost-trader-gold.onrender.com/api/mt5/feed"; // URL del Dashboard (o http://localhost:8000/api/mt5/feed)
input int      InpTimerSeconds = 3;                                                     // Frecuencia de envío (segundos)

input group "=== SÍMBOLOS A TRANSMITIR ==="
input string   InpSymbolGold   = "XAUUSD"; // Símbolo del Oro en tu broker (ej: XAUUSD, GOLD)
input string   InpSymbolEuro   = "EURUSD"; // Símbolo del Euro en tu broker (ej: EURUSD)
input int      InpBarsCountM5  = 60;       // Velas M5 a enviar
input int      InpBarsCountH1  = 30;       // Velas H1 a enviar
input int      InpHistoryDays  = 14;       // Días de historial a sincronizar con la Bitácora

//--- Variables Globales
datetime g_last_send = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🟢 [GhostBridge] Iniciando puente de datos y bitácora automática hacia: ", InpServerUrl);
   EventSetTimer(InpTimerSeconds);
   
   // Verificar que los símbolos estén en Market Watch
   SymbolSelect(InpSymbolGold, true);
   SymbolSelect(InpSymbolEuro, true);
   
   // Primer envío de prueba inmediato
   SendMarketDataToDashboard();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("🔴 [GhostBridge] Puente detenido. Razón: ", reason);
}

//+------------------------------------------------------------------+
//| Timer function (Ejecuta cada X segundos)                         |
//+------------------------------------------------------------------+
void OnTimer()
{
   SendMarketDataToDashboard();
}

//+------------------------------------------------------------------+
//| OnTick function                                                  |
//+------------------------------------------------------------------+
void OnTick()
{
   if(TimeCurrent() - g_last_send >= InpTimerSeconds)
   {
      SendMarketDataToDashboard();
   }
}

//+------------------------------------------------------------------+
//| Función auxiliar: Construye JSON de velas OHLC                   |
//+------------------------------------------------------------------+
string BuildCandlesJson(string symbol, ENUM_TIMEFRAMES tf, int count)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(symbol, tf, 0, count, rates);
   if(copied <= 0) return "[]";

   string json = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      string candle = StringFormat(
         "{\"time\":%d,\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%d}",
         (long)rates[i].time,
         rates[i].open,
         rates[i].high,
         rates[i].low,
         rates[i].close,
         (long)rates[i].tick_volume
      );
      json += candle;
      if(i > 0) json += ",";
   }
   json += "]";
   return json;
}

//+------------------------------------------------------------------+
//| Extraer Historial de Operaciones Cerradas para la Bitácora Real  |
//+------------------------------------------------------------------+
string BuildClosedDealsJson(int days_back)
{
   datetime from_time = TimeCurrent() - days_back * 86400;
   datetime to_time   = TimeCurrent() + 60;
   
   if(!HistorySelect(from_time, to_time))
      return "[]";
      
   int total_deals = HistoryDealsTotal();
   string json = "[";
   int count = 0;
   
   for(int i = 0; i < total_deals; i++)
   {
      ulong deal_ticket = HistoryDealGetTicket(i);
      if(deal_ticket == 0) continue;
      
      long entry = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
      // Solo operaciones cerradas (DEAL_ENTRY_OUT o DEAL_ENTRY_INOUT)
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) continue;
      
      string symbol   = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
      double volume   = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
      double exit_px  = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
      double profit   = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
      double comm     = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
      double swap     = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
      datetime close_t= (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
      long   pos_id   = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
      
      double entry_px  = exit_px;
      datetime open_t  = close_t;
      string direction = "BUY";
      
      if(HistorySelectByPosition(pos_id))
      {
         int p_deals = HistoryDealsTotal();
         for(int j = 0; j < p_deals; j++)
         {
            ulong in_ticket = HistoryDealGetTicket(j);
            if(HistoryDealGetInteger(in_ticket, DEAL_ENTRY) == DEAL_ENTRY_IN)
            {
               entry_px = HistoryDealGetDouble(in_ticket, DEAL_PRICE);
               open_t   = (datetime)HistoryDealGetInteger(in_ticket, DEAL_TIME);
               long dir = HistoryDealGetInteger(in_ticket, DEAL_TYPE);
               direction = (dir == DEAL_TYPE_BUY) ? "BUY" : "SELL";
               break;
            }
         }
      }
      
      if(count > 0) json += ",";
      
      string deal_item = StringFormat(
         "{\"ticket\":%d,\"pos_id\":%d,\"symbol\":\"%s\",\"direction\":\"%s\",\"open_time\":\"%s\",\"close_time\":\"%s\",\"open_price\":%.5f,\"close_price\":%.5f,\"volume\":%.2f,\"profit\":%.2f,\"commission\":%.2f,\"swap\":%.2f}",
         (long)deal_ticket,
         (long)pos_id,
         symbol,
         direction,
         TimeToString(open_t, TIME_DATE|TIME_MINUTES),
         TimeToString(close_t, TIME_DATE|TIME_MINUTES),
         entry_px,
         exit_px,
         volume,
         profit,
         comm,
         swap
      );
      
      json += deal_item;
      count++;
   }
   
   json += "]";
   return json;
}

//+------------------------------------------------------------------+
//| Función Principal: Recopila y Envía Datos al Dashboard           |
//+------------------------------------------------------------------+
void SendMarketDataToDashboard()
{
   g_last_send = TimeCurrent();
   
   // 1. Datos de Cuenta
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string company  = AccountInfoString(ACCOUNT_COMPANY);
   long   leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);

   // 2. Precios y Spreads XAUUSD
   double xau_bid = SymbolInfoDouble(InpSymbolGold, SYMBOL_BID);
   double xau_ask = SymbolInfoDouble(InpSymbolGold, SYMBOL_ASK);
   long   xau_spread = SymbolInfoInteger(InpSymbolGold, SYMBOL_SPREAD);
   string xau_m5_json = BuildCandlesJson(InpSymbolGold, PERIOD_M5, InpBarsCountM5);
   string xau_h1_json = BuildCandlesJson(InpSymbolGold, PERIOD_H1, InpBarsCountH1);

   // 3. Precios y Spreads EURUSD
   double eur_bid = SymbolInfoDouble(InpSymbolEuro, SYMBOL_BID);
   double eur_ask = SymbolInfoDouble(InpSymbolEuro, SYMBOL_ASK);
   long   eur_spread = SymbolInfoInteger(InpSymbolEuro, SYMBOL_SPREAD);
   string eur_m5_json = BuildCandlesJson(InpSymbolEuro, PERIOD_M5, InpBarsCountM5);

   // 4. Operaciones Cerradas para la Bitácora Automática
   string closed_deals_json = BuildClosedDealsJson(InpHistoryDays);

   // 5. Armar Payload JSON Completo
   string json_payload = "{\n";
   json_payload += StringFormat("  \"account\": {\"balance\": %.2f, \"equity\": %.2f, \"currency\": \"%s\", \"company\": \"%s\", \"leverage\": %d},\n",
                                balance, equity, currency, company, leverage);
   json_payload += StringFormat("  \"closed_deals\": %s,\n", closed_deals_json);
   json_payload += "  \"symbols\": {\n";
   
   // Sección XAUUSD
   json_payload += StringFormat("    \"XAUUSD\": {\"bid\": %.2f, \"ask\": %.2f, \"spread_pts\": %d, \"candles_m5\": %s, \"candles_h1\": %s},\n",
                                xau_bid, xau_ask, xau_spread, xau_m5_json, xau_h1_json);
                                
   // Sección EURUSD
   json_payload += StringFormat("    \"EURUSD\": {\"bid\": %.5f, \"ask\": %.5f, \"spread_pts\": %d, \"candles_m5\": %s}\n",
                                eur_bid, eur_ask, eur_spread, eur_m5_json);
                                
   json_payload += "  }\n}";

   // 6. Enviar por HTTP WebRequest
   char post_data[];
   char result[];
   string result_headers;
   StringToCharArray(json_payload, post_data, 0, StringLen(json_payload));
   
   string headers = "Content-Type: application/json\r\n";
   ResetLastError();
   
   int res = WebRequest("POST", InpServerUrl, headers, 3000, post_data, result, result_headers);
   
   if(res == 200)
   {
      static datetime last_log = 0;
      if(TimeCurrent() - last_log > 30)
      {
         Print("✅ [GhostBridge] Sincronizado exitosamente: Velas en vivo & Bitácora Real actualizadas");
         last_log = TimeCurrent();
      }
   }
   else if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
      {
         Print("⚠️ [GhostBridge ERROR 4014] URL no autorizada en MT5. Ve a Herramientas -> Opciones -> Asesores Expertos y agrega: ", InpServerUrl);
      }
      else
      {
         Print("❌ [GhostBridge ERROR] WebRequest falló con código de error: ", err);
      }
   }
   else
   {
      PrintFormat("⚠️ [GhostBridge] Servidor respondió con código HTTP: %d", res);
   }
}
//+------------------------------------------------------------------+
