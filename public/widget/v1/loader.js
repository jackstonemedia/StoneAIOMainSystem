/**
 * Stone AIO Live Chat Widget Loader
 * Embed on any website: <script src="https://yourapp.com/widget/v1/loader.js" data-inbox-token="TOKEN"></script>
 */
(function (d, w) {
  'use strict';

  var script = d.currentScript || (function () {
    var scripts = d.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var token = script.getAttribute('data-inbox-token');
  if (!token) { console.warn('[StoneAIO Widget] Missing data-inbox-token attribute.'); return; }

  var APP_URL = script.src.replace('/widget/v1/loader.js', '');
  var IFRAME_ID = 'stone-aio-widget-iframe';
  var BTN_ID = 'stone-aio-widget-btn';
  var isOpen = false;

  // ── Styles ────────────────────────────────────────────────────────────────
  var style = d.createElement('style');
  style.innerHTML = [
    '#' + BTN_ID + ' {',
    '  position: fixed; bottom: 24px; right: 24px; z-index: 999998;',
    '  width: 56px; height: 56px; border-radius: 50%;',
    '  background: #4f46e5; border: none; cursor: pointer;',
    '  box-shadow: 0 4px 20px rgba(79,70,229,0.5);',
    '  display: flex; align-items: center; justify-content: center;',
    '  transition: transform 0.2s, box-shadow 0.2s;',
    '}',
    '#' + BTN_ID + ':hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(79,70,229,0.6); }',
    '#' + BTN_ID + ' svg { width: 26px; height: 26px; fill: white; }',
    '#' + BTN_ID + ' .badge {',
    '  position: absolute; top: -4px; right: -4px;',
    '  background: #ef4444; color: white; border-radius: 999px;',
    '  font-size: 11px; font-weight: 700; min-width: 18px; height: 18px;',
    '  display: none; align-items: center; justify-content: center; padding: 0 4px;',
    '  border: 2px solid white; font-family: system-ui;',
    '}',
    '#' + IFRAME_ID + ' {',
    '  position: fixed; bottom: 92px; right: 24px; z-index: 999999;',
    '  width: 380px; height: 600px; max-height: calc(100vh - 120px);',
    '  border: none; border-radius: 16px;',
    '  box-shadow: 0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1);',
    '  transition: opacity 0.25s, transform 0.25s;',
    '  transform-origin: bottom right;',
    '}',
    '#' + IFRAME_ID + '.hidden {',
    '  opacity: 0; pointer-events: none; transform: scale(0.92) translateY(8px);',
    '}',
    '@media (max-width: 480px) {',
    '  #' + IFRAME_ID + ' { width: 100vw; height: 100vh; bottom: 0; right: 0; border-radius: 0; max-height: 100vh; }',
    '  #' + BTN_ID + ' { bottom: 16px; right: 16px; }',
    '}',
  ].join('\n');
  d.head.appendChild(style);

  // ── Launcher button ───────────────────────────────────────────────────────
  var btn = d.createElement('button');
  btn.id = BTN_ID;
  btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML = [
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
    '  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>',
    '</svg>',
    '<span class="badge" id="stone-aio-badge"></span>'
  ].join('');
  d.body.appendChild(btn);

  // ── iframe ────────────────────────────────────────────────────────────────
  var iframe = d.createElement('iframe');
  iframe.id = IFRAME_ID;
  iframe.className = 'hidden';
  iframe.src = APP_URL + '/widget/v1/app.html?token=' + encodeURIComponent(token) + '&origin=' + encodeURIComponent(w.location.origin);
  iframe.allow = 'microphone; camera';
  d.body.appendChild(iframe);

  // ── Toggle ────────────────────────────────────────────────────────────────
  function openWidget() {
    isOpen = true;
    iframe.classList.remove('hidden');
    btn.setAttribute('aria-label', 'Close chat');
    btn.innerHTML = [
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
      '  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
      '</svg>',
    ].join('');
    iframe.contentWindow && iframe.contentWindow.postMessage({ type: 'widget:open' }, '*');
    // Clear badge
    var badge = d.getElementById('stone-aio-badge');
    if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
  }

  function closeWidget() {
    isOpen = false;
    iframe.classList.add('hidden');
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = [
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
      '  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>',
      '</svg>',
      '<span class="badge" id="stone-aio-badge"></span>'
    ].join('');
  }

  btn.addEventListener('click', function () { isOpen ? closeWidget() : openWidget(); });

  // ── postMessage bridge ────────────────────────────────────────────────────
  w.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    switch (e.data.type) {
      case 'widget:close': closeWidget(); break;
      case 'widget:unread': {
        var count = e.data.count || 0;
        var badge = d.getElementById('stone-aio-badge');
        if (badge && !isOpen) {
          badge.textContent = count;
          badge.style.display = count > 0 ? 'flex' : 'none';
        }
        break;
      }
      case 'widget:ready': {
        // Widget finished loading, optionally auto-open
        break;
      }
    }
  });

}(document, window));
