/* Close the mobile menu once the user has picked a link, or on Escape.
   The menu is a CSS checkbox toggle, so it opens and closes perfectly well
   without this file — all this saves is a second tap on the X. Scoped per
   header rather than by id so it also works in the bundled preview, where
   several pages share one document. */
(function () {
  var headers = document.querySelectorAll('.nav');
  Array.prototype.forEach.call(headers, function (header) {
    var toggle = header.querySelector('.nav__toggle');
    var links = header.querySelector('.nav__links');
    if (!toggle || !links) return;

    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) toggle.checked = false;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.checked) {
        toggle.checked = false;
        toggle.focus();
      }
    });
  });
})();

/* Turn smooth scrolling on only once the page has loaded. The stylesheet
   leaves it off so the browser's initial jump to a #fragment is instant and
   lands exactly on target; lazy images loading mid-animation used to drag it
   past. In-page anchor clicks after load still glide. */
(function () {
  'use strict';
  var on = function () { document.documentElement.classList.add('ready'); };
  if (document.readyState === 'complete') on();
  else window.addEventListener('load', on);
})();

/* Hide dated events once their last day has passed. The build already leaves
   out anything finished, but the site is only rebuilt when something is
   pushed — this keeps it current on the days in between. Each item carries its
   last day as data-ends="YYYY-MM-DD"; a promo band left with no cards goes too. */
(function () {
  var d = new Date();
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  Array.prototype.forEach.call(document.querySelectorAll('[data-ends]'), function (el) {
    if (el.getAttribute('data-ends') < today) el.hidden = true;
  });
  Array.prototype.forEach.call(document.querySelectorAll('.promo'), function (band) {
    if (band.querySelector('.promo__card') && !band.querySelector('.promo__card:not([hidden])')) band.hidden = true;
  });
})();
