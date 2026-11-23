/* Home page enhancements. All optional: with no JavaScript the strip still
   scrolls and pauses on hover, and reduced-motion users still get a static
   swipeable rail. */

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

/* Hero countdown. The build writes the numbers as they stood at deploy time;
   this keeps them true to the second, and once the moment arrives replaces the
   tiles with the "happening now" line until its last day takes it down. */
(function () {
  var boxes = document.querySelectorAll('[data-countdown]');
  if (!boxes.length) return;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function tick() {
    var now = Date.now(), live = 0;
    Array.prototype.forEach.call(boxes, function (box) {
      if (box.getAttribute('data-done')) return;
      var left = Math.floor((new Date(box.getAttribute('data-countdown')).getTime() - now) / 1000);
      if (isNaN(left)) return;
      if (left <= 0) {
        box.setAttribute('data-done', '1');
        var p = document.createElement('p');
        p.className = 'countdown__now';
        p.textContent = box.getAttribute('data-live-text') || 'Happening now!';
        box.replaceWith(p);
        return;
      }
      live++;
      var v = { d: Math.floor(left / 86400), h: Math.floor(left % 86400 / 3600),
                m: Math.floor(left % 3600 / 60), s: left % 60 };
      Object.keys(v).forEach(function (k) {
        var el = box.querySelector('[data-cd="' + k + '"]');
        if (el) el.textContent = pad(v[k]);
      });
    });
    if (live) setTimeout(tick, 1000 - (Date.now() % 1000));
  }
  tick();
})();
