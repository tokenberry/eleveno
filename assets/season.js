/* Membership pricing and day counts, resolved in the visitor's own timezone.

   This runs in the browser rather than at build time because both the day
   count and the prorated price depend on today's date — a value baked in at
   build time is wrong the following morning.

   Progressive enhancement: the markup ships a correct static line, and this
   only replaces it while the season is actually open. */
(function () {
  'use strict';
  var boxes = document.querySelectorAll('[data-season-end]');
  if (!boxes.length) return;

  var DAY = 86400000;

  function parseDate(s) {
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  function money(amount, currency) {
    return currency + (Math.round(amount * 100) / 100 === Math.round(amount)
      ? String(Math.round(amount))
      : amount.toFixed(2));
  }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  Array.prototype.forEach.call(boxes, function (el) {
    var line = el.querySelector('[data-season-line]');
    if (!line) return;

    var start = parseDate(el.getAttribute('data-season-start'));
    var end = parseDate(el.getAttribute('data-season-end'));
    var total = parseFloat(el.getAttribute('data-total'));
    var currency = el.getAttribute('data-currency') || '$';
    var prorate = el.getAttribute('data-prorate') === 'true';
    if (!end || !isFinite(total)) return;

    // before it opens, and after it closes, the static line is the honest one
    if (start && today < start) return;
    if (today > end) return;

    var remaining = Math.round((end - today) / DAY) + 1;      // inclusive of today
    if (remaining < 1) return;

    var price = total;
    if (prorate && start) {
      var span = Math.round((end - start) / DAY) + 1;
      if (span > 0) price = Math.round(total * remaining / span);
    }

    line.textContent = money(price, currency) + ' for ' + remaining +
      ' day' + (remaining === 1 ? '' : 's') + ' starting today';
  });
})();
