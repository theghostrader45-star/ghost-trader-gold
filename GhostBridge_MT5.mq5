//+------------------------------------------------------------------+
//|                                             GhostBridge_MT5.mq5  |
//|               Bridge between MetaTrader 5 and Ghost Trader Gold  |
//|                               https://ghost-trader-gold.onrender.com |
//+------------------------------------------------------------------+
#property copyright "Ghost Trader Gold Institutional"
#property link      "https://ghost-trader-gold.onrender.com"
#property version   "1.20"
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
input int      InpHistoryDays  = 365;      // Días de historial a sincronizar con la Bitácora (365 = 1 año)

//--- Variables Globales
datetime g_last_send = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🟢 [GhostBridge v1.20] Iniciando puente de datos y bitácora automática hacia: ", InpServerUrl);
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
//| Extraer Depósito Inicial de la Cuenta                            |
//+------------------------------------------------------------------+
double GetAccountInitialDeposit()
{
   if(!HistorySelect(0, TimeCurrent() + 86400)) return 0.0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong t = HistoryDealGetTicket(i);
      if(t > 0 && HistoryDealGetInteger(t, DEAL_TYPE) == DEAL_TYPE_BALANCE)
      {
         double p = HistoryDealGetDouble(t, DEAL_PROFIT);
         if(p > 0) return p;
      }
   }
   return 0.0;
}

//+------------------------------------------------------------------+
//| Extraer Historial de Operaciones Cerradas para la Bitácora Real  |
//+------------------------------------------------------------------+
string BuildClosedDealsJson(int days_back)
{
   datetime from_time = (days_back > 0) ? (TimeCurrent() - (datetime)days_back * 86400) : 0;
   datetime to_time   = TimeCurrent() + 86400;
   
   if(!HistorySelect(from_time, to_time))
      return "[]";
      
   int total_deals = HistoryDealsTotal();
   if(total_deals <= 0) return "[]";
   
   // 1. Recopilar tickets de salida en un array para evitar que HistorySelectByPosition
   // altere el contexto global de HistoryDealsTotal
   ulong out_tickets[];
   ArrayResize(out_tickets, 0);
   
   for(int i = 0; i < total_deals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT || entry == DEAL_ENTRY_OUT_BY)
      {
         int sz = ArraySize(out_tickets);
         ArrayResize(out_tickets, sz + 1);
         out_tickets[sz] = ticket;
      }
   }
   
   int out_count = ArraySize(out_tickets);
   if(out_count == 0) return "[]";
   
   string json = "[";
   int valid_count = 0;
   
   for(int i = 0; i < out_count; i++)
   {
      ulong deal_ticket = out_tickets[i];
      if(!HistoryDealSelect(deal_ticket)) continue;
      
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
      
      // Consultar la posición para obtener el precio de entrada y hora original
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
      
      if(valid_count > 0) json += ",";
      
      string deal_item = "{\"ticket\":" + IntegerToString((long)deal_ticket) +
                         ",\"pos_id\":" + IntegerToString((long)pos_id) +
                         ",\"symbol\":\"" + symbol + "\"" +
                         ",\"direction\":\"" + direction + "\"" +
                         ",\"open_time\":\"" + TimeToString(open_t, TIME_DATE|TIME_MINUTES) + "\"" +
                         ",\"close_time\":\"" + TimeToString(close_t, TIME_DATE|TIME_MINUTES) + "\"" +
                         ",\"open_price\":" + DoubleToString(entry_px, 5) +
                         ",\"close_price\":" + DoubleToString(exit_px, 5) +
                         ",\"volume\":" + DoubleToString(volume, 2) +
                         ",\"profit\":" + DoubleToString(profit, 2) +
                         ",\"commission\":" + DoubleToString(comm, 2) +
                         ",\"swap\":" + DoubleToString(swap, 2) + "}";
                         
      json += deal_item;
      valid_count++;
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
   double init_dep = GetAccountInitialDeposit();

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
   json_payload += StringFormat("  \"account\": {\"balance\": %.2f, \"equity\": %.2f, \"currency\": \"%s\", \"company\": \"%s\", \"leverage\": %d, \"initial_deposit\": %.2f},\n",
                                balance, equity, currency, company, leverage, init_dep);
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
         Print("✅ [GhostBridge v1.20] Sincronizado exitosamente: Velas en vivo & Bitácora Real actualizadas");
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
