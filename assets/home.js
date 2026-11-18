/* Home page enhancements. All optional: with no JavaScript the strip still
   scrolls and pauses on hover, and reduced-motion users still get a static
   swipeable rail. */

/* Anniversary countdown in the hero. The day count depends on today's date,
   so it is worked out here, in the visitor's own timezone, rather than baked
   in at build time. Counts calendar days, so the evening before reads
   "1 day to go" whatever the hour. On the day it reads "Tonight"; the morning
   after, the card removes itself. */
(function () {
  var card = document.querySelector('[data-countdown]');
  if (!card) return;
  var p = card.getAttribute('data-countdown').split('-');
  var party = new Date(+p[0], +p[1] - 1, +p[2]);
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var days = Math.round((party - today) / 86400000);
  if (isNaN(days)) return;
  if (days < 0) { card.parentNode.removeChild(card); return; }
  var big = card.querySelector('[data-countdown-big]');
  var unit = card.querySelector('[data-countdown-unit]');
  if (days === 0) { card.classList.add('is-today'); big.textContent = 'Tonight'; unit.textContent = "Let's celebrate"; return; }
  big.textContent = String(days);
  unit.textContent = days === 1 ? 'Day to go' : 'Days to go';
})();

(function () {
  var track = document.querySelector('.reviews__track');
  if (!track) return;

  /* 1. Tap to stop it. CSS pauses on hover and on keyboard focus, but a touch
        screen has neither, and a moving paragraph you cannot hold still is
        unreadable. */
  track.parentElement.addEventListener('click', function () {
    track.classList.toggle('is-paused');
  });

  /* 2. Fade out only the quotes that are actually cut off. Whether a quote fits
        depends on the card width, so this is re-checked when the page resizes. */
  var wraps = document.querySelectorAll('.review__textwrap');
  function markClipped() {
    Array.prototype.forEach.call(wraps, function (wrap) {
      wrap.classList.toggle('is-clipped', wrap.scrollHeight > wrap.clientHeight + 2);
    });
  }

  var pending = false;
  window.addEventListener('resize', function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; markClipped(); });
  });

  markClipped();

  /* Run again once the webfonts are in: the first pass measures fallback-font
     metrics, and a quote that fits Arial may not fit Archivo. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(markClipped);
})();
