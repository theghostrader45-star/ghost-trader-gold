//+------------------------------------------------------------------+
//|                                             GhostBridge_MT5.mq5  |
//|               Bridge between MetaTrader 5 and Ghost Trader Gold  |
//|                               https://ghost-trader-gold.onrender.com |
//+------------------------------------------------------------------+
#property copyright "Ghost Trader Gold Institutional"
#property link      "https://ghost-trader-gold.onrender.com"
#property version   "1.00"
#property description "Puente de transmisión en tiempo real de tick y velas M5/H1 hacia el Dashboard"
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

//--- Variables Globales
datetime g_last_send = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🟢 [GhostBridge] Iniciando puente de datos hacia: ", InpServerUrl);
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
   // Si han pasado más de InpTimerSeconds desde el último envío, mandar en nuevo tick
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

   // 4. Armar Payload JSON Completo
   string json_payload = "{\n";
   json_payload += StringFormat("  \"account\": {\"balance\": %.2f, \"equity\": %.2f, \"currency\": \"%s\", \"company\": \"%s\", \"leverage\": %d},\n",
                                balance, equity, currency, company, leverage);
   json_payload += "  \"symbols\": {\n";
   
   // Sección XAUUSD
   json_payload += StringFormat("    \"XAUUSD\": {\"bid\": %.2f, \"ask\": %.2f, \"spread_pts\": %d, \"candles_m5\": %s, \"candles_h1\": %s},\n",
                                xau_bid, xau_ask, xau_spread, xau_m5_json, xau_h1_json);
                                
   // Sección EURUSD
   json_payload += StringFormat("    \"EURUSD\": {\"bid\": %.5f, \"ask\": %.5f, \"spread_pts\": %d, \"candles_m5\": %s}\n",
                                eur_bid, eur_ask, eur_spread, eur_m5_json);
                                
   json_payload += "  }\n}";

   // 5. Enviar por HTTP WebRequest
   char post_data[];
   char result[];
   string result_headers;
   StringToCharArray(json_payload, post_data, 0, StringLen(json_payload));
   
   string headers = "Content-Type: application/json\r\n";
   ResetLastError();
   
   int res = WebRequest("POST", InpServerUrl, headers, 3000, post_data, result, result_headers);
   
   if(res == 200)
   {
      // Éxito silencioso (mostrar solo cada 30 segundos para no saturar log)
      static datetime last_log = 0;
      if(TimeCurrent() - last_log > 30)
      {
         Print("✅ [GhostBridge] Sincronizado exitosamente con el Dashboard (200 OK)");
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
