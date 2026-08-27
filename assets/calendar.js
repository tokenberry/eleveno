/* Calendar filtering.

   Progressive enhancement, like the estimator: the page ships with every
   category panel visible and the chip row hidden, so with JavaScript off you
   get the whole programme in one scroll and nothing is unreachable. This
   reveals the chips and shows one category at a time.

   Every row stays in the document either way — filtering only toggles a class
   on the panels, so search engines and Find-in-page still see all of it. */
(function () {
  var bar    = document.getElementById('calfilter');
  var groups = document.getElementById('calgroups');
  if (!bar || !groups) return;

  var chips  = [].slice.call(bar.querySelectorAll('.calchip'));
  var panels = [].slice.call(groups.querySelectorAll('.calgroup'));
  if (!chips.length || !panels.length) return;

  function show(cat) {
    panels.forEach(function (p) {
      p.hidden = !(cat === 'all' || p.dataset.cat === cat);
    });
    chips.forEach(function (c) {
      var on = c.dataset.cat === cat;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  chips.forEach(function (c) {
    c.setAttribute('aria-pressed', c.classList.contains('is-on') ? 'true' : 'false');
    c.addEventListener('click', function () { show(c.dataset.cat); });
  });

  /* Hand over: reveal the chips, then open the first category rather than
     "All" — the point of the chips is that the full list is long. */
  bar.hidden = false;
  show(panels[0].dataset.cat);
})();
