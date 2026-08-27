/* Plan Your Event — the four-step estimator.

   Progressive enhancement, deliberately: the page ships with all four steps
   visible and a working submit button. This script collapses it into a wizard
   and adds the live total. Turn the script off and you still get a form that
   sends us every answer — you just do not see a price first.

   Prices come off data-pp attributes the build wrote from estimator.json, so
   this file holds no numbers of its own and cannot drift from the packages. */
(function () {
  var form = document.getElementById('est-form');
  if (!form) return;

  var steps = [].slice.call(form.querySelectorAll('.est__step'));
  var dots  = [].slice.call(form.querySelectorAll('.est__dots li'));
  var nav   = document.getElementById('est-nav');
  var back  = document.getElementById('est-back');
  var next  = document.getElementById('est-next');
  var bar   = document.getElementById('est-bar');
  if (!steps.length || !nav) return;

  var SERVICE = 0.20;               // mirrors estimator.json servicePct
  var at = 0;

  /* ---------- money ---------- */
  function money(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function picked(name) {
    return form.querySelector('input[name="' + name + '"]:checked');
  }

  /* querySelector returns the first match in DOCUMENT order, not the order the
     selectors are written — and .epkg__body (name AND description) precedes
     .epkg__name, so a combined selector picked up the description too. Ask for
     the specific one first. */
  function labelOf(el) {
    if (!el) return null;
    var p = el.parentElement;
    var span = p.querySelector('.epkg__name') || p.querySelector('span');
    return span ? span.textContent.trim() : el.value;
  }

  /* Swag is quoted, not costed — these selections travel with the enquiry but
     never touch the arithmetic. */
  function swagChecked() {
    return [].slice.call(form.querySelectorAll('input[name="swag"]:checked'));
  }

  /* Duration is not decoration any more: it picks the food rate and multiplies
     the bar. Falls back to 2 hours so a total is never computed against nothing. */
  function hours() {
    var d = picked('duration');
    return d && d.dataset.hours ? Number(d.dataset.hours) : 2;
  }

  function compute() {
    var guests = parseInt(form.querySelector('#e-guests').value, 10);
    if (!isFinite(guests) || guests < 1) guests = 0;

    var hrs  = hours();
    var food = picked('food');
    var bev  = picked('beverage');

    /* No rate published for this duration — 4h+ has none — so there is nothing
       honest to compute. Say "on inquiry" rather than inventing a number. */
    var foodRate = food ? food.dataset['pp' + hrs] : undefined;
    var foodPP = (foodRate === undefined || foodRate === '') ? null : Number(foodRate);
    var bevPP  = (bev && bev.dataset.pph !== undefined && bev.dataset.pph !== '')
      ? Number(bev.dataset.pph) * hrs : null;
    /* A package priced on inquiry has no number, so there is no honest total to
       show. Say so rather than quietly pricing it at zero. */
    var quoted = (food && foodPP === null) || (bev && bevPP === null);
    var perGuest = (foodPP || 0) + (bevPP || 0);
    var subtotal = guests * perGuest;
    var service  = subtotal * SERVICE;

    return {
      guests: guests,
      hours: hrs,
      quoted: quoted,
      food: labelOf(food),
      beverage: labelOf(bev),
      swag: swagChecked().map(function (el) {
        var n = el.parentElement.querySelector('.eswag__name');
        return n ? n.textContent.trim() : el.value;
      }),
      subtotal: subtotal,
      service: service,
      total: subtotal + service
    };
  }

  /* ---------- painting ---------- */
  function setAll(attr, key, text) {
    [].forEach.call(document.querySelectorAll('[' + attr + '="' + key + '"]'), function (el) {
      el.textContent = text;
    });
  }

  /* A food card's headline rate depends on the duration, so it cannot be static.
     Without JavaScript it reads "from $45/pp"; with it, it says what this
     booking actually costs. */
  function paintFoodCards(hrs) {
    [].forEach.call(form.querySelectorAll('input[name="food"]'), function (el) {
      var cell = el.parentElement.querySelector('.epkg__price');
      if (!cell) return;
      var rate = el.dataset['pp' + hrs];
      cell.innerHTML = (rate === undefined || rate === '')
        ? 'On inquiry'
        : '$' + rate + '<small>/pp</small>';
    });
  }

  function paint() {
    var c = compute();
    paintFoodCards(c.hours);
    var type = picked('event-type');
    var dur  = picked('duration');
    var date = form.querySelector('#e-date').value;
    var flexible = form.querySelector('input[name="date-flexible"]').checked;

    setAll('data-sv', 'type', type ? labelOf(type) : '—');
    setAll('data-sv', 'guests', c.guests ? c.guests + (c.guests === 1 ? ' person' : ' people') : '—');
    setAll('data-sv', 'duration', dur ? labelOf(dur) : '—');
    setAll('data-sv', 'date', date ? date : (flexible ? 'Flexible' : '—'));

    var totalText = c.quoted ? 'On inquiry' : (c.total ? money(c.total) : '—');
    setAll('data-sv', 'total', totalText);

    setAll('data-rv', 'guests', c.guests ? String(c.guests) : '—');
    setAll('data-rv', 'duration', dur ? labelOf(dur) : '—');
    setAll('data-rv', 'packages', [c.food, c.beverage].filter(Boolean).join(' + ') || '—');
    setAll('data-rv', 'subtotal', c.quoted ? 'On inquiry' : money(c.subtotal));
    setAll('data-rv', 'service', c.quoted ? '—' : money(c.service));
    setAll('data-rv', 'total', totalText);

    /* carry the numbers into the submission, so the inbox shows what the
       customer saw rather than just their raw selections */
    document.getElementById('est-total-field').value = totalText;
    /* Named, not priced: the coordinator quotes it, but they should not have to
       ask what the customer ticked. */
    var swagNote = c.swag.length ? ' | swag requested: ' + c.swag.join(', ') : '';
    document.getElementById('est-breakdown-field').value = c.quoted
      ? 'Quoted package selected — no automatic total' + swagNote
      : c.guests + ' guests x ' + money(c.subtotal / (c.guests || 1)) +
        ' = ' + money(c.subtotal) + ' + service ' + money(c.service) + ' = ' + money(c.total) + swagNote;
  }

  /* ---------- steps ---------- */
  function show(i, moveFocus) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, n) { s.hidden = n !== at; });
    dots.forEach(function (d, n) {
      d.classList.toggle('is-now', n === at);
      d.classList.toggle('is-done', n < at);
    });
    bar.style.width = ((at + 1) / steps.length * 100) + '%';
    back.hidden = at === 0;
    next.hidden = at === steps.length - 1;
    if (moveFocus) {
      var h = steps[at].querySelector('.efield__h, .est__legend');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      var top = steps[at].getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    }
  }

  /* Only the last step has required fields, but check anyway so a browser
     never blocks submit on a control the customer cannot currently see. */
  function stepIsValid(i) {
    var bad = steps[i].querySelector(':invalid');
    if (!bad) return true;
    if (bad.reportValidity) bad.reportValidity();
    return false;
  }

  next.addEventListener('click', function () { if (stepIsValid(at)) show(at + 1, true); });
  back.addEventListener('click', function () { show(at - 1, true); });

  dots.forEach(function (d, n) {
    d.addEventListener('click', function () { if (n <= at || stepIsValid(at)) show(n, true); });
  });

  /* ---------- guest stepper ---------- */
  var guestInput = form.querySelector('#e-guests');
  var baseMin = Number(guestInput.min) || 1;

  /* An event type may need fewer people than the site-wide floor — a clinic
     runs with five where a buyout does not. Switching type moves the floor,
     and pushes the count up if the new type needs more than you had. */
  function applyMinimum() {
    var type = picked('event-type');
    var min = type && type.dataset.min ? Number(type.dataset.min) : baseMin;
    guestInput.min = min;
    if ((parseInt(guestInput.value, 10) || 0) < min) guestInput.value = min;
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'event-type') { applyMinimum(); paint(); }
  });

  [].forEach.call(form.querySelectorAll('[data-guest]'), function (btn) {
    btn.addEventListener('click', function () {
      var by = Number(btn.dataset.guest);
      var min = Number(guestInput.min) || 1, max = Number(guestInput.max) || 999;   // min moves with event type
      var v = (parseInt(guestInput.value, 10) || min) + by * (Number(guestInput.step) || 1);
      guestInput.value = Math.max(min, Math.min(max, v));
      paint();
    });
  });

  /* A quoted bar package cannot produce a total, so make that visible on the
     card itself rather than leaving the sidebar to explain it. */
  form.addEventListener('change', paint);
  form.addEventListener('input', paint);

  /* The swag panel belongs to its checkbox. Unticking clears the picks rather
     than hiding them still checked — a hidden tick would submit swag the
     customer can no longer see, and would keep pricing it. */
  var swagBox   = form.querySelector('input[data-expands="swag"]');
  var swagPanel = document.getElementById('e-swag-panel');
  function syncSwag(clear) {
    if (!swagBox || !swagPanel) return;
    swagPanel.hidden = !swagBox.checked;
    if (clear && !swagBox.checked) {
      swagChecked().forEach(function (el) { el.checked = false; });
    }
  }
  if (swagBox) {
    swagBox.addEventListener('change', function () { syncSwag(true); paint(); });
  }

  /* Hand over: hide everything but step one, reveal the controls. */
  nav.hidden = false;
  form.classList.add('is-wizard');
  applyMinimum();
  syncSwag(false);
  show(0, false);
  paint();
})();
