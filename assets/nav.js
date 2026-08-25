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
