(function() {
  'use strict';

  var scripts = document.querySelectorAll('script[data-calendfree-company]');

  scripts.forEach(function(script) {
    var company = script.getAttribute('data-calendfree-company');
    var eventType = script.getAttribute('data-calendfree-event-type');
    var mode = script.getAttribute('data-calendfree-mode') || 'popup';
    var baseUrl = script.getAttribute('data-calendfree-url') || script.src.replace('/embed.js', '');
    var bookingUrl = baseUrl + '/' + company + (eventType ? '/' + eventType : '');

    if (mode === 'inline') {
      var iframe = document.createElement('iframe');
      iframe.src = bookingUrl;
      iframe.style.width = '100%';
      iframe.style.minHeight = '600px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.setAttribute('loading', 'lazy');
      script.parentNode.insertBefore(iframe, script.nextSibling);
    } else {
      // Popup mode: create a button
      var btn = document.createElement('button');
      btn.textContent = script.getAttribute('data-calendfree-text') || 'Termin buchen';
      btn.style.cssText = 'background:#2563EB;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:sans-serif;';

      btn.addEventListener('click', function() {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:12px;width:90%;max-width:640px;height:80vh;position:relative;overflow:hidden;';

        var close = document.createElement('button');
        close.textContent = '\u00D7';
        close.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:none;font-size:24px;cursor:pointer;color:#666;z-index:1;';
        close.addEventListener('click', function() { overlay.remove(); });

        var iframe = document.createElement('iframe');
        iframe.src = bookingUrl;
        iframe.style.cssText = 'width:100%;height:100%;border:none;';

        modal.appendChild(close);
        modal.appendChild(iframe);
        overlay.appendChild(modal);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
      });

      script.parentNode.insertBefore(btn, script.nextSibling);
    }
  });
})();
