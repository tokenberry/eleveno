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
