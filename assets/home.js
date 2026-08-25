/* Home page enhancements. All optional: with no JavaScript the strip still
   scrolls and pauses on hover, reduced-motion users still get a static
   swipeable rail, and the map falls back to an address panel. */

/* Click-to-load map. A blocked Google embed fires load and throws on
   contentWindow exactly like a working one, so there is no way to tell them
   apart and no point trying: the address panel is what renders by default and
   the iframe is only built when someone asks to see the map. The panel's link
   points at Google Maps, so with no JavaScript it still gets people there. */
(function () {
  var map = document.querySelector('.visit__map');
  if (!map) return;
  var src = map.getAttribute('data-map-src');
  var opener = map.querySelector('.visit__mapopen');
  if (!src || !opener) return;

  opener.addEventListener('click', function (e) {
    e.preventDefault();
    if (map.classList.contains('is-loaded')) return;
    var frame = document.createElement('iframe');
    frame.src = src;
    frame.title = map.getAttribute('data-map-title') || 'Map';
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    frame.setAttribute('allowfullscreen', '');
    map.appendChild(frame);
    map.classList.add('is-loaded');
  });
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
