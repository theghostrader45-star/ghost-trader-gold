# 👻 Ghost Trader | Gold
> **Terminal Institucional de Scalping XAU/USD, Macro Sesión & Bitácora Real**

Ghost Trader | Gold es una plataforma de trading institucional diseñada para operar oro (**XAU/USD**) en temporalidades de 5 minutos, convalidando cada entrada técnica con el flujo de capital macroeconómico, los rendimientos reales de EE.UU. y el calendario económico en la sesión de New York.

---

## ⚡ Características Principales

1. **Brújula Macro & Radar de Confluencia (Setup A+):**
   - Dirección institucional del día: **BULLISH** (Solo compras) o **BEARISH** (Solo ventas).
   - Semáforo horario de la Ventana Dorada de New York (08:00 AM – 11:30 AM NY).
   - Escudo de riesgo con regla de bloqueo ±15 minutos para noticias de alto impacto (NFP, CPI, FOMC, ISM).
   - Gatillo M5 con validación en tiempo real y sonido institucional.

2. **Calendario Económico Semanal de Noticias (XAU/USD):**
   - Filtro directo de eventos de alto impacto para proteger el capital ante picos de volatilidad y manipulación.

3. **Matriz Macro Institucional de 6 Fuentes:**
   - Índice Dólar (DXY), Rendimientos Reales TIPS 10A, CME FedWatch, Curva de Tipos (2Y vs 10Y), Posicionamiento COT COMEX y Compras de Bancos Centrales.

4. **Bitácora Real & Rendimiento en Vivo:**
   - Registro de trades en vivo con Stop Loss en puntos de TradingView.
   - Cálculo automático de PnL en dólares y porcentaje, Win Rate y curvas de rendimiento.

5. **Calculadora Myfxbook:**
   - Dimensionamiento exacto de lotaje según porcentaje de riesgo y balance de la cuenta.

---

## 🚀 Ejecución en Local

```bash
python3 server.py 8081
```
Abre en tu navegador: `http://localhost:8081`

---

## ☁️ Despliegue en la Nube 100% Gratis (Render.com)

1. Sube este proyecto a tu repositorio de **GitHub** (público o privado).
2. Entra a [Render.com](https://render.com) y crea una cuenta gratuita.
3. Haz clic en **New +** y selecciona **Web Service**.
4. Conecta tu repositorio de GitHub `ghost-trader-gold`.
5. Configuración automática:
   - **Name:** `ghost-trader-gold`
   - **Environment:** `Python 3`
   - **Build Command:** *(dejar vacío)*
   - **Start Command:** `python3 server.py $PORT`
   - **Instance Type:** `Free`
6. Haz clic en **Create Web Service**. ¡En 1 minuto tendrás tu enlace HTTPS público permanente listo!
