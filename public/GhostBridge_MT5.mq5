//+------------------------------------------------------------------+
//|                                             GhostBridge_MT5.mq5  |
//|               Bridge between MetaTrader 5 and Ghost Trader Gold  |
//|                               https://ghost-trader-gold.onrender.com |
//+------------------------------------------------------------------+
#property copyright "Pro Terminal MT5 Bridge"
#property link      "https://ghost-trader-gold.onrender.com"
#property version   "1.30"
#property description "Puente de transmision en tiempo real de tick, velas M5/H1 y sincronizacion automatica de operaciones hacia la Bitacora Real"
#property description "IMPORTANTE: En MT5 ve a Herramientas -> Opciones -> Asesores Expertos y activa 'Permitir WebRequest' agregando tu URL."

//--- Inputs
input group "=== CONFIGURACION DE CONEXION ==="
input string   InpServerUrl    = "https://ghost-trader-gold.onrender.com/api/mt5/feed"; // URL del Dashboard (o http://localhost:8000/api/mt5/feed)
input int      InpTimerSeconds = 3;                                                     // Frecuencia de envio (segundos)

input group "=== SIMBOLOS A TRANSMITIR ==="
input string   InpSymbolGold   = "XAUUSD"; // Simbolo del Oro en tu broker (ej: XAUUSD, GOLD)
input string   InpSymbolEuro   = "EURUSD"; // Simbolo del Euro en tu broker (ej: EURUSD)
input int      InpBarsCountM5  = 60;       // Velas M5 a enviar
input int      InpBarsCountH1  = 30;       // Velas H1 a enviar
input int      InpHistoryDays  = 365;      // Dias de historial a sincronizar con la Bitacora (365 = 1 ano)

//--- Structs para recopilar operaciones de forma segura
struct DealInRecord {
   long     pos_id;
   double   price;
   datetime time;
   string   direction;
};

struct DealOutRecord {
   ulong    ticket;
   long     pos_id;
   string   symbol;
   double   volume;
   double   price;
   double   profit;
   double   commission;
   double   swap;
   datetime time;
   long     type;
};

//--- Variables Globales
datetime g_last_send = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🟢 [GhostBridge v1.21] Iniciando puente de datos y bitacora automatica hacia: ", InpServerUrl);
   EventSetTimer(InpTimerSeconds);
   
   // Auto-detectar simbolo del grafico si es Euro
   string curr_sym = _Symbol;
   if(StringFind(curr_sym, "EUR") >= 0 || StringFind(curr_sym, "eur") >= 0)
   {
      InpSymbolEuro = curr_sym;
   }
   SymbolSelect(InpSymbolEuro, true);
   
   // Primer envio de prueba inmediato
   SendMarketDataToDashboard();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("🔴 [GhostBridge] Puente detenido. Razon: ", reason);
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
//| Funcion auxiliar: Construye JSON de velas OHLC                   |
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
//| Extraer Deposito Inicial de la Cuenta                            |
//+------------------------------------------------------------------+
double GetAccountInitialDeposit()
{
   if(!HistorySelect(0, TimeCurrent())) return 0.0;
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
//| Extraer Operaciones Cerradas de MT5 para la Bitacora Real        |
//+------------------------------------------------------------------+
string BuildClosedDealsJson(int days_back)
{
   datetime from_time = (days_back > 0) ? (TimeCurrent() - (datetime)days_back * 86400) : 0;
   datetime to_time   = TimeCurrent();
   
   if(!HistorySelect(from_time, to_time))
      return "[]";
      
   int total_deals = HistoryDealsTotal();
   if(total_deals <= 0) return "[]";
   
   DealInRecord in_deals[];
   DealOutRecord out_deals[];
   ArrayResize(in_deals, 0);
   ArrayResize(out_deals, 0);
   
   // Unico pase limpio por el historial seleccionado sin alterar el contexto
   for(int i = 0; i < total_deals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      
      long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;
      
      long entry  = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      long pos_id = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      
      if(entry == DEAL_ENTRY_IN)
      {
         int sz = ArraySize(in_deals);
         ArrayResize(in_deals, sz + 1);
         in_deals[sz].pos_id    = pos_id;
         in_deals[sz].price     = HistoryDealGetDouble(ticket, DEAL_PRICE);
         in_deals[sz].time      = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
         in_deals[sz].direction = (type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT || entry == DEAL_ENTRY_OUT_BY)
      {
         int sz = ArraySize(out_deals);
         ArrayResize(out_deals, sz + 1);
         out_deals[sz].ticket     = ticket;
         out_deals[sz].pos_id     = pos_id;
         out_deals[sz].type       = type;
         out_deals[sz].symbol     = HistoryDealGetString(ticket, DEAL_SYMBOL);
         out_deals[sz].volume     = HistoryDealGetDouble(ticket, DEAL_VOLUME);
         out_deals[sz].price      = HistoryDealGetDouble(ticket, DEAL_PRICE);
         out_deals[sz].profit     = HistoryDealGetDouble(ticket, DEAL_PROFIT);
         out_deals[sz].commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         out_deals[sz].swap       = HistoryDealGetDouble(ticket, DEAL_SWAP);
         out_deals[sz].time       = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      }
   }
   
   int out_count = ArraySize(out_deals);
   if(out_count == 0) return "[]";
   
   string json = "[";
   for(int i = 0; i < out_count; i++)
   {
      double   entry_px  = out_deals[i].price;
      datetime open_t    = out_deals[i].time;
      string   direction = (out_deals[i].type == DEAL_TYPE_BUY) ? "SELL" : "BUY";
      
      for(int j = 0; j < ArraySize(in_deals); j++)
      {
         if(in_deals[j].pos_id == out_deals[i].pos_id)
         {
            entry_px  = in_deals[j].price;
            open_t    = in_deals[j].time;
            direction = in_deals[j].direction;
            break;
         }
      }
      
      if(i > 0) json += ",";
      
      string deal_item = "{\"ticket\":" + IntegerToString((long)out_deals[i].ticket) +
                         ",\"pos_id\":" + IntegerToString((long)out_deals[i].pos_id) +
                         ",\"symbol\":\"" + out_deals[i].symbol + "\"" +
                         ",\"direction\":\"" + direction + "\"" +
                         ",\"open_time\":\"" + TimeToString(open_t, TIME_DATE|TIME_MINUTES) + "\"" +
                         ",\"close_time\":\"" + TimeToString(out_deals[i].time, TIME_DATE|TIME_MINUTES) + "\"" +
                         ",\"open_price\":" + DoubleToString(entry_px, 5) +
                         ",\"close_price\":" + DoubleToString(out_deals[i].price, 5) +
                         ",\"volume\":" + DoubleToString(out_deals[i].volume, 2) +
                         ",\"profit\":" + DoubleToString(out_deals[i].profit, 2) +
                         ",\"commission\":" + DoubleToString(out_deals[i].commission, 2) +
                         ",\"swap\":" + DoubleToString(out_deals[i].swap, 2) + "}";
                         
      json += deal_item;
   }
   json += "]";
   return json;
}

//+------------------------------------------------------------------+
//| Funcion Principal: Recopila y Envia Datos al Dashboard           |
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

   // 4. Operaciones Cerradas para la Bitacora Automatica (Smart Sync)
   static datetime last_deals_sync_time = 0;
   static int      last_known_deals_count = -1;
   string closed_deals_json = "[]";
   
   if(last_known_deals_count == -1 || (TimeCurrent() - last_deals_sync_time >= 20))
   {
      closed_deals_json = BuildClosedDealsJson(InpHistoryDays);
      last_deals_sync_time = TimeCurrent();
      last_known_deals_count = HistoryDealsTotal();
   }

   // 5. Armar Payload JSON Completo
   string json_payload = "{\n";
   json_payload += StringFormat("  \"account\": {\"balance\": %.2f, \"equity\": %.2f, \"currency\": \"%s\", \"company\": \"%s\", \"leverage\": %d, \"initial_deposit\": %.2f},\n",
                                balance, equity, currency, company, leverage, init_dep);
   json_payload += StringFormat("  \"closed_deals\": %s,\n", closed_deals_json);
   json_payload += "  \"symbols\": {\n";
   
   // Seccion XAUUSD
   json_payload += StringFormat("    \"XAUUSD\": {\"bid\": %.2f, \"ask\": %.2f, \"spread_pts\": %d, \"candles_m5\": %s, \"candles_h1\": %s},\n",
                                xau_bid, xau_ask, xau_spread, xau_m5_json, xau_h1_json);
                                
   // Seccion EURUSD
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
   
   int res = WebRequest("POST", InpServerUrl, headers, 6000, post_data, result, result_headers);
   
   if(res == 200)
   {
      static datetime last_log = 0;
      if(TimeCurrent() - last_log > 30)
      {
         PrintFormat("✅ [GhostBridge v1.21] Sincronizado exitosamente: Balance $%.2f | Bitacora actualizada", balance);
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
         Print("❌ [GhostBridge ERROR] WebRequest fallo con codigo de error: ", err);
      }
   }
   else
   {
      PrintFormat("⚠️ [GhostBridge] Servidor respondio con codigo HTTP: %d", res);
   }
}
//+------------------------------------------------------------------+
