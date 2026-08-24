/* Membership day counts, resolved in the visitor's own timezone.
   This has to run in the browser rather than at build time: a number baked in
   at build time would be wrong the following day.

   Progressive enhancement — the markup ships a correct static line, and this
   only replaces it while the season is actually open. */
(function () {
  'use strict';
  var boxes = document.querySelectorAll('[data-season-end]');
  if (!boxes.length) return;

  function parseDate(s) {
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? null : d;
  }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var DAY = 86400000;

  Array.prototype.forEach.call(boxes, function (el) {
    var line = el.querySelector('[data-season-line]');
    if (!line) return;
    var end = parseDate(el.getAttribute('data-season-end'));
    var start = parseDate(el.getAttribute('data-season-start'));
    var price = el.getAttribute('data-price') || '';
    if (!end) return;

    // before the season opens, the static line already describes the full season
    if (start && today < start) return;
    // once it has closed, leave the static line rather than counting down past zero
    if (today > end) return;

    var days = Math.round((end - today) / DAY) + 1;   // inclusive of today
    if (days < 1) return;
    line.textContent = price + ' for ' + days + ' day' + (days === 1 ? '' : 's') + ' starting today';
  });
})();
