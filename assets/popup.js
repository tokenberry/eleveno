/* The promotional modal. Everything that decides behaviour arrives on the
   dialog's data- attributes, so the delay and the dismissal window stay
   editable in site.json rather than here. The markup ships closed, so a
   browser without showModal simply never sees it. */
(function () {
  'use strict';
  var d = document.querySelector('dialog.popup');
  if (!d || typeof d.showModal !== 'function') return;

  var key = 'eleveno:popup:' + d.getAttribute('data-popup-id');
  var days = parseInt(d.getAttribute('data-popup-days'), 10) || 7;
  var delay = parseInt(d.getAttribute('data-popup-delay'), 10) || 1200;

  /* Private browsing throws on both reads and writes. A storage failure is no
     reason to withhold the popup, so a failed read means "not dismissed" and a
     failed write is simply dropped: worst case someone sees it again next
     visit, which is better than never seeing it at all. */
  function dismissedUntil() {
    try { return parseInt(window.localStorage.getItem(key), 10) || 0; }
    catch (e) { return 0; }
  }
  function remember() {
    try { window.localStorage.setItem(key, String(Date.now() + days * 864e5)); }
    catch (e) {}
  }

  if (dismissedUntil() > Date.now()) return;

  d.addEventListener('close', remember);
  // a click on the backdrop reports the dialog itself as the target, never a child
  d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  // following the call to action is an answer too, so it should not come back
  var cta = d.querySelector('.popup__cta');
  if (cta) cta.addEventListener('click', remember);

  window.setTimeout(function () { d.showModal(); }, delay);
})();
