/* Membership pricing, day counts and the season-close rule, resolved in the
   visitor's own timezone.

   This runs in the browser rather than at build time because all three depend
   on today's date — a value baked in at build time is wrong the next morning.

   Progressive enhancement: the markup ships a correct static line, and this
   only rewrites it once it knows what today actually is. */
(function () {
  'use strict';
  var boxes = document.querySelectorAll('[data-season-end]');
  if (!boxes.length) return;

  var DAY = 86400000;
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function parseDate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  function money(amount, currency) {
    var whole = Math.round(amount);
    return currency + (Math.abs(amount - whole) < 0.005 ? String(whole) : amount.toFixed(2));
  }

  function closeCard(box, nextLabel, opensOn) {
    var line = box.querySelector('[data-season-line]');
    var opens = parseDate(opensOn);
    if (line) {
      line.textContent = opens
        ? 'Next season opens ' + MONTHS[opens.getMonth()] + ' ' + opens.getDate()
        : 'This season is closed';
    }
    var title = box.querySelector('strong');
    if (title && nextLabel) title.textContent = nextLabel + ' season';

    var plan = box.closest('.plan');
    var cta = plan && plan.querySelector('.plan__cta');
    if (cta) {
      cta.textContent = 'Season Closed';
      cta.removeAttribute('href');           // no longer a link
      cta.setAttribute('aria-disabled', 'true');
      cta.className += ' plan__cta--closed';
    }
  }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  Array.prototype.forEach.call(boxes, function (box) {
    var line = box.querySelector('[data-season-line]');
    if (!line) return;

    var start = parseDate(box.getAttribute('data-season-start'));
    var end = parseDate(box.getAttribute('data-season-end'));
    var total = parseFloat(box.getAttribute('data-total'));
    var currency = box.getAttribute('data-currency') || '$';
    var prorate = box.getAttribute('data-prorate') === 'true';
    var minDays = parseInt(box.getAttribute('data-min-days'), 10);
    var nextLabel = box.getAttribute('data-next-label');
    var nextOpens = box.getAttribute('data-next-opens');
    if (!end || !isFinite(total)) return;

    // before the season opens, the static line already describes the full season
    if (start && today < start) return;

    var remaining = Math.round((end - today) / DAY) + 1;   // inclusive of today

    // too little of the season left to sell a worthwhile membership
    if (remaining < (isFinite(minDays) ? minDays : 1)) {
      closeCard(box, nextLabel, nextOpens);
      return;
    }

    /* A flat-priced season has nothing to recalculate: the markup already says
       "$300 · September – November", which stays true on any day it is sold.
       Rewriting it to "$300 for 90 days starting today" would only advertise a
       shrinking number of days against an unchanged price. */
    if (!prorate || !start) return;

    var span = Math.round((end - start) / DAY) + 1;
    var price = span > 0 ? Math.round(total * remaining / span) : total;

    line.textContent = money(price, currency) + ' for ' + remaining +
      ' day' + (remaining === 1 ? '' : 's') + ' starting today';
  });
})();
