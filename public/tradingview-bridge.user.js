// ==UserScript==
// @name         TradingView Heikin Ashi -> Ghost Dashboard Webhook Bridge (Free Version)
// @namespace    https://ghost-dashboard.local
// @version      1.0.0
// @description  Monitorea alertas e indicadores Heikin Ashi en la versión gratuita de TradingView y los reenvía en tiempo real al Dashboard.
// @author       Ghost Trader Pro
// @match        https://*.tradingview.com/chart/*
// @match        https://tradingview.com/chart/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Configuración predeterminada del Webhook
  const DEFAULT_WEBHOOK_URL = 'http://localhost:8000/api/webhook/tradingview';
  let webhookUrl = GM_getValue('ghost_dashboard_webhook_url', DEFAULT_WEBHOOK_URL);

  let lastSentSignalKey = '';
  let lastSentTime = 0;

  // -------------------------------------------------------------
  // Función de envío HTTP hacia el Dashboard
  // -------------------------------------------------------------
  function sendSignalToDashboard(signalData) {
    const now = Date.now();
    const signalKey = `${signalData.action}_${signalData.ticker}_${Math.floor(now / 5000)}`;

    // Anti-rebote: Evitar envíos duplicados en menos de 5 segundos
    if (signalKey === lastSentSignalKey && (now - lastSentTime) < 5000) {
      console.log('[Ghost Bridge] Señal duplicada ignorada (anti-rebote):', signalKey);
      return;
    }

    lastSentSignalKey = signalKey;
    lastSentTime = now;

    console.log('[Ghost Bridge] Enviando señal al Dashboard:', signalData, 'URL:', webhookUrl);
    updateBridgeStatus('Enviando...', 'amber');

    GM_xmlhttpRequest({
      method: 'POST',
      url: webhookUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(signalData),
      onload: function (response) {
        console.log('[Ghost Bridge] Respuesta del Dashboard:', response.status, response.responseText);
        if (response.status >= 200 && response.status < 300) {
          updateBridgeStatus(`✓ Señal ${signalData.action} Enviada`, 'emerald');
          showToast(`🚀 [Ghost Bridge] Señal ${signalData.action} transmitida al Dashboard`, 'success');
        } else {
          updateBridgeStatus(`⚠️ Error ${response.status}`, 'rose');
          showToast(`⚠️ [Ghost Bridge] Error de respuesta: ${response.status}`, 'error');
        }
      },
      onerror: function (err) {
        console.error('[Ghost Bridge] Error de conexión:', err);
        updateBridgeStatus('Error Conexión', 'rose');
        showToast('❌ [Ghost Bridge] No se pudo conectar al Dashboard. Revisa la URL.', 'error');
      }
    });
  }

  // -------------------------------------------------------------
  // Observador de Alertas Pop-up de TradingView (Versión Gratuita)
  // -------------------------------------------------------------
  function setupAlertPopupObserver() {
    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          // Detectar ventanas emergentes de alerta y toasts de TradingView
          const text = (node.textContent || '').trim();
          if (!text) continue;

          const isAlertModal = node.matches && (
            node.matches('[data-name="alerts-notification-manager"]') ||
            node.matches('[class*="alert-dialog"]') ||
            node.matches('[class*="toast-"]') ||
            node.matches('[class*="notification-"]') ||
            node.querySelector('[class*="alert"]')
          );

          if (isAlertModal || (text.includes('Alert') || text.includes('Alerta'))) {
            parseAndForwardAlertText(text);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[Ghost Bridge] Observador de alertas de TradingView activado.');
  }

  // -------------------------------------------------------------
  // Parseo del texto de la alerta
  // -------------------------------------------------------------
  function parseAndForwardAlertText(rawText) {
    let action = '';
    const upper = rawText.toUpperCase();

    if (upper.includes('BUY') || upper.includes('COMPRA') || upper.includes('LONG')) {
      action = 'BUY';
    } else if (upper.includes('SELL') || upper.includes('VENTA') || upper.includes('SHORT')) {
      action = 'SELL';
    }

    if (!action) return;

    // Intentar extraer JSON si el mensaje contenía formato JSON
    let ticker = 'AUDJPY';
    let price = 102.50;

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.action) action = parsed.action.toUpperCase();
        if (parsed.ticker || parsed.symbol) ticker = parsed.ticker || parsed.symbol;
        if (parsed.price || parsed.close) price = parseFloat(parsed.price || parsed.close);
      }
    } catch (e) {}

    // Intentar leer ticker del gráfico actual de TradingView
    try {
      const symbolButton = document.querySelector('#header-toolbar-symbol-search');
      if (symbolButton && symbolButton.textContent) {
        ticker = symbolButton.textContent.trim().replace(/[^A-Za-z0-9]/g, '');
      }
    } catch (e) {}

    const payload = {
      action: action,
      ticker: ticker,
      price: price,
      timeframe: '5m',
      source: 'TradingView Free Alert (Heikin Ashi)',
      timestamp: new Date().toISOString()
    };

    sendSignalToDashboard(payload);
  }

  // -------------------------------------------------------------
  // Widget Flotante de Control en TradingView
  // -------------------------------------------------------------
  let statusBadge = null;

  function createFloatingBridgeWidget() {
    if (document.getElementById('ghost-tradingview-bridge-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'ghost-tradingview-bridge-widget';
    widget.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9999999;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(59, 130, 246, 0.4);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      color: #f1f5f9;
      user-select: none;
    `;

    widget.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span id="ghost-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
        <strong style="color: #93c5fd; letter-spacing: 0.5px;">Ghost Bridge</strong>
        <span id="ghost-status-text" style="color: #94a3b8; font-size: 10px;">(Conectado)</span>
      </div>
      <div style="display: flex; gap: 4px; margin-left: 6px;">
        <button id="ghost-btn-test-buy" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.5); color: #34d399; font-weight: bold; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 10px;">Probar BUY</button>
        <button id="ghost-btn-test-sell" style="background: rgba(244, 63, 94, 0.2); border: 1px solid rgba(244, 63, 94, 0.5); color: #fb7185; font-weight: bold; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 10px;">Probar SELL</button>
        <button id="ghost-btn-config" style="background: rgba(100, 116, 139, 0.2); border: 1px solid rgba(100, 116, 139, 0.4); color: #cbd5e1; border-radius: 6px; padding: 3px 6px; cursor: pointer; font-size: 10px;" title="Configurar URL del Dashboard">⚙️</button>
      </div>
    `;

    document.body.appendChild(widget);

    statusBadge = document.getElementById('ghost-status-text');

    // Botones de prueba rápida
    document.getElementById('ghost-btn-test-buy').addEventListener('click', function () {
      sendSignalToDashboard({
        action: 'BUY',
        ticker: 'AUDJPY',
        price: 102.50,
        timeframe: '5m',
        source: 'Prueba Manual desde TradingView'
      });
    });

    document.getElementById('ghost-btn-test-sell').addEventListener('click', function () {
      sendSignalToDashboard({
        action: 'SELL',
        ticker: 'AUDJPY',
        price: 102.50,
        timeframe: '5m',
        source: 'Prueba Manual desde TradingView'
      });
    });

    document.getElementById('ghost-btn-config').addEventListener('click', function () {
      const input = prompt(
        'Introduce la URL del Webhook de tu Dashboard:\n\n' +
        '• Si estás en local: http://localhost:8000/api/webhook/tradingview\n' +
        '• Si estás en Render: https://TU-APP.onrender.com/api/webhook/tradingview',
        webhookUrl
      );
      if (input && input.trim()) {
        webhookUrl = input.trim();
        GM_setValue('ghost_dashboard_webhook_url', webhookUrl);
        showToast('✓ URL del Webhook guardada exitosamente', 'success');
      }
    });
  }

  function updateBridgeStatus(text, color) {
    const textEl = document.getElementById('ghost-status-text');
    const dotEl = document.getElementById('ghost-status-dot');
    if (textEl) textEl.textContent = text;
    if (dotEl) {
      if (color === 'emerald') dotEl.style.background = '#10b981';
      else if (color === 'rose') dotEl.style.background = '#f43f5e';
      else if (color === 'amber') dotEl.style.background = '#f59e0b';
    }
  }

  function showToast(msg, type) {
    const t = document.createElement('div');
    t.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 99999999;
      background: ${type === 'success' ? '#064e3b' : '#881337'};
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      border: 1px solid ${type === 'success' ? '#10b981' : '#f43f5e'};
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // Inicializar al cargar la página del gráfico
  window.addEventListener('load', function () {
    setTimeout(() => {
      createFloatingBridgeWidget();
      setupAlertPopupObserver();
    }, 2000);
  });

  // Reintento de inicialización por si el DOM tardó en montar
  setTimeout(() => {
    createFloatingBridgeWidget();
    setupAlertPopupObserver();
  }, 4000);

})();
