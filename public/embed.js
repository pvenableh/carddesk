/*!
 * CardDesk embed loader.
 *
 * Inline (card sits in the page flow):
 *   <div class="carddesk-embed" data-card-id="USER_ID"></div>
 *   <script async src="https://carddesk.earnest.guru/embed.js"></script>
 *
 * Popup (a button that opens the card + booking in a modal):
 *   <div class="carddesk-embed" data-card-id="USER_ID" data-mode="popup" data-label="Book a Call"></div>
 *   <script async src="https://carddesk.earnest.guru/embed.js"></script>
 *
 * Optional attributes: data-theme (carddesk|glass|editorial|tech).
 */
(function () {
  'use strict'

  // Resolve the CardDesk origin from this script's own URL so the snippet works
  // across environments without hard-coding the domain.
  var ORIGIN = 'https://carddesk.earnest.guru'
  try {
    var self = document.currentScript
    if (self && self.src) ORIGIN = new URL(self.src).origin
  } catch (e) { /* keep default */ }

  function frameSrc(el) {
    var id = el.getAttribute('data-card-id')
    var params = []
    var theme = el.getAttribute('data-theme')
    if (theme) params.push('theme=' + encodeURIComponent(theme))
    return ORIGIN + '/embed/' + encodeURIComponent(id) + (params.length ? ('?' + params.join('&')) : '')
  }

  function buildFrame(el, extraStyle) {
    var iframe = document.createElement('iframe')
    iframe.src = frameSrc(el)
    iframe.title = 'Digital business card'
    iframe.loading = 'lazy'
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('data-carddesk-frame', el.getAttribute('data-card-id'))
    iframe.style.cssText = 'border:0;width:100%;display:block;' + (extraStyle || '')
    return iframe
  }

  // ── Inline mode ──
  function mountInline(el) {
    var iframe = buildFrame(el, 'max-width:420px;height:560px;margin:0 auto;')
    el.appendChild(iframe)
  }

  // ── Popup mode ──
  var styleInjected = false
  function injectStyles() {
    if (styleInjected) return
    styleInjected = true
    var s = document.createElement('style')
    s.textContent =
      '.carddesk-pop-btn{display:inline-flex;align-items:center;gap:7px;cursor:pointer;font:700 14px/1 system-ui,sans-serif;' +
      'padding:12px 22px;border:0;border-radius:999px;background:#0b0d14;color:#fff;transition:transform .12s ease,opacity .2s ease}' +
      '.carddesk-pop-btn:hover{transform:translateY(-1px);opacity:.92}' +
      '.carddesk-pop-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'padding:20px;background:rgba(6,8,16,.62);opacity:0;transition:opacity .2s ease}' +
      '.carddesk-pop-ov.on{opacity:1}' +
      '.carddesk-pop-modal{position:relative;width:100%;max-width:420px;height:min(640px,90vh);background:#080b12;' +
      'border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);transform:translateY(8px) scale(.99);transition:transform .2s ease}' +
      '.carddesk-pop-ov.on .carddesk-pop-modal{transform:none}' +
      '.carddesk-pop-modal iframe{width:100%;height:100%;border:0;display:block}' +
      '.carddesk-pop-x{position:absolute;top:10px;right:10px;z-index:2;width:30px;height:30px;border:0;border-radius:50%;cursor:pointer;' +
      'background:rgba(0,0,0,.45);color:#fff;font:700 16px/1 system-ui;backdrop-filter:blur(6px)}'
    document.head.appendChild(s)
  }

  function openPopup(el) {
    injectStyles()
    var ov = document.createElement('div')
    ov.className = 'carddesk-pop-ov'
    var modal = document.createElement('div')
    modal.className = 'carddesk-pop-modal'
    var close = document.createElement('button')
    close.className = 'carddesk-pop-x'
    close.setAttribute('aria-label', 'Close')
    close.innerHTML = '&times;'
    var iframe = buildFrame(el, 'height:100%')
    modal.appendChild(close)
    modal.appendChild(iframe)
    ov.appendChild(modal)
    document.body.appendChild(ov)
    requestAnimationFrame(function () { ov.classList.add('on') })

    function dismiss() {
      ov.classList.remove('on')
      document.removeEventListener('keydown', onKey)
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov) }, 220)
    }
    function onKey(e) { if (e.key === 'Escape') dismiss() }
    close.addEventListener('click', dismiss)
    ov.addEventListener('click', function (e) { if (e.target === ov) dismiss() })
    document.addEventListener('keydown', onKey)
  }

  function mountPopup(el) {
    injectStyles()
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'carddesk-pop-btn'
    btn.textContent = el.getAttribute('data-label') || 'Book a Call'
    btn.addEventListener('click', function () { openPopup(el) })
    el.appendChild(btn)
  }

  function mount(el) {
    if (el.getAttribute('data-carddesk-mounted')) return
    if (!el.getAttribute('data-card-id')) return
    el.setAttribute('data-carddesk-mounted', '1')
    if (el.getAttribute('data-mode') === 'popup') mountPopup(el)
    else mountInline(el)
  }

  function mountAll() {
    var nodes = document.querySelectorAll('.carddesk-embed[data-card-id]')
    for (var i = 0; i < nodes.length; i++) mount(nodes[i])
  }

  // Auto-resize inline frames: the embed page posts its content height.
  window.addEventListener('message', function (e) {
    var d = e.data
    if (!d || d.source !== 'carddesk' || d.type !== 'embed:height') return
    var frames = document.querySelectorAll('iframe[data-carddesk-frame]')
    for (var i = 0; i < frames.length; i++) {
      // Only resize inline frames (those NOT inside a popup modal, which is fixed-height).
      if (frames[i].contentWindow === e.source && !frames[i].closest('.carddesk-pop-modal')) {
        frames[i].style.height = Math.max(200, d.height) + 'px'
      }
    }
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll)
  } else {
    mountAll()
  }

  // Re-scan for embeds added after initial load (SPA hosts).
  if (window.MutationObserver) {
    new MutationObserver(mountAll).observe(document.documentElement, { childList: true, subtree: true })
  }
})()
