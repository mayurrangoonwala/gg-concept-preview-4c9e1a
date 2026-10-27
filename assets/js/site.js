/* Gill and Gill, JK Gill. Shared behaviour for every page.
   Plain script (no modules) so the site also works when opened straight from disk.
   Sections: forms config, helpers, scroll, loader, reveal, header, clock, menu, modal,
   forms, listings filters, count-up. */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.add('booted');

  /* =====================================================================
     FORMS CONFIG. Every form on the site goes through submitForm() below.
     NOTHING is sent anywhere while demo is true or endpoint is empty.
     To go live: set demo to false, set endpoint, test, and read README.md
     (CASL consent, privacy page, and where JK wants the leads to land).
     ===================================================================== */
  var FORMS = {
    demo: true,                // true = nothing leaves the browser; the success state still shows, labelled as a demo
    endpoint: '',              // TODO WIRE ENDPOINT: form service URL or the brokerage CRM / lead webhook
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    honeypot: 'website',       // field name of the hidden trap input; bots fill it, people do not
    notifyTo: 'jkgill@gillandgill.ca' // documentation only: where JK wants leads. Real routing happens at the endpoint
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = html.classList.contains('rm') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---------- scroll (Lenis from CDN, graceful fallback to native) ---------- */
  var lenis = null, locks = 0;
  function stopScroll() { locks++; html.classList.add('lock'); if (lenis) lenis.stop(); }
  function startScroll() { locks = Math.max(0, locks - 1); if (locks === 0) { html.classList.remove('lock'); if (lenis) lenis.start(); } }
  if (!reduce) {
    try {
      import('https://unpkg.com/lenis@1.3.23/dist/lenis.mjs').then(function (m) {
        var L = m.default; if (!L) return;
        lenis = new L({ smoothWheel: true });
        html.classList.add('lenis', 'lenis-smooth');
        (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
        lenis.on('scroll', function () { onScroll(); });
        if (locks > 0) lenis.stop();
      }).catch(function () {});
    } catch (e) { /* older browsers: native scrolling */ }
  }
  function scrollToEl(el) {
    var top = el.getBoundingClientRect().top + window.pageYOffset - 90;
    if (lenis) lenis.scrollTo(top); else window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return;
    var id = a.getAttribute('href').slice(1); if (!id) return;
    var el = document.getElementById(id); if (!el) return;
    e.preventDefault(); scrollToEl(el);
    try { history.replaceState(null, '', '#' + id); } catch (er) {}
  });

  /* adaptive grid: root size grows past 1920px wide (CSS handles smaller screens) */
  function grid() {
    var FB = 16, bw = 1920, w = window.innerWidth;
    if (w <= bw) { html.style.removeProperty('font-size'); return; }
    var red = ((bw - w) / bw) * 100, size = FB - (FB * (red * 0.6666)) / 100;
    html.style.fontSize = size + 'px';
  }
  grid(); window.addEventListener('resize', grid);

  /* ---------- reveal on scroll ---------- */
  var ready = false, pending = [];
  var words = $('[data-words]');
  if (words) {
    var wi = 0;
    (function walk(n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var f = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) f.appendChild(document.createTextNode(' '));
            else { var s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', wi++); s.textContent = t; f.appendChild(s); }
          });
          c.parentNode.replaceChild(f, c);
        } else walk(c);
      });
    })(words);
    words.setAttribute('data-r', 'fade');
  }
  var io = null;
  if (reduce || !('IntersectionObserver' in window)) {
    $$('[data-r]').forEach(function (el) { el.classList.add('in'); });
  } else {
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target.hasAttribute('data-gate') && !ready) pending.push(e.target); else e.target.classList.add('in');
      });
    }, { threshold: 0.12 });
    $$('[data-r]').forEach(function (el) { io.observe(el); });
  }
  function release() { ready = true; pending.splice(0).forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- loader: plays once per browser session ---------- */
  var loader = $('#loader');
  if (loader && !html.classList.contains('seen') && !reduce) {
    var fillEl = $('#fill'), cnt = $('#cnt'), T0 = performance.now(), FILL = 650;
    stopScroll();
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    (function tick(now) {
      var t = Math.min((now - T0) / FILL, 1), p = Math.round(ease(t) * 100);
      fillEl.style.width = p + '%'; cnt.textContent = String(p).padStart(3, '0');
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(function () {
        loader.classList.add('out'); store('gg-loader', '1');
        setTimeout(function () { loader.remove(); startScroll(); release(); }, 560);
      }, 60);
    })(T0);
  } else {
    if (loader) loader.remove();
    store('gg-loader', '1'); release();
  }

  /* ---------- header: solid once scrolled, tucks away on scroll down ---------- */
  var header = $('.site-header'), lastY = window.pageYOffset;
  function onScroll() {
    var y = window.pageYOffset;
    if (header) {
      header.classList.toggle('stuck', y > 40);
      var navOpen = $('#nav') && $('#nav').classList.contains('open');
      header.classList.toggle('hide', !navOpen && y > 240 && y > lastY + 4);
      if (y < lastY - 4 || y < 240) header.classList.remove('hide');
    }
    lastY = y;
    countTick();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Toronto clock ---------- */
  function clock() {
    var ct = $('#ct'), cd = $('#cd'), nt = $('#nt');
    if (!ct && !nt) return;
    try {
      var d = new Date(), tz = { timeZone: 'America/Toronto' };
      var p = new Intl.DateTimeFormat('en-CA', Object.assign({ hour: 'numeric', minute: '2-digit', hour12: true }, tz)).formatToParts(d);
      var g = function (k) { return (p.find(function (x) { return x.type === k; }) || {}).value || ''; };
      var time = g('hour') + ':' + g('minute') + g('dayPeriod').replace(/\./g, '').replace(/\s/g, '').toLowerCase();
      var dp = new Intl.DateTimeFormat('en-GB', Object.assign({ day: 'numeric', month: 'long', year: 'numeric' }, tz)).formatToParts(d);
      var h = function (k) { return dp.find(function (x) { return x.type === k; }).value; };
      if (ct) ct.textContent = time;
      if (cd) cd.textContent = h('day') + ' ' + h('month') + ', ' + h('year');
      if (nt) nt.textContent = time;
    } catch (e) {}
  }
  clock(); setInterval(clock, 15000);

  /* ---------- focus trap + inert helpers for overlays ---------- */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
  function setInert(on) {
    $$('.site-header, main, footer, .mbar').forEach(function (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  }
  function trap(container, e) {
    if (e.key !== 'Tab') return;
    var f = $$(FOCUSABLE, container).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- menu overlay ---------- */
  var nav = $('#nav'), navOpener = null;
  function openNav() {
    if (!nav) return;
    navOpener = document.activeElement;
    nav.classList.add('open'); setInert(true); stopScroll();
    setTimeout(function () { var c = $('#closeNav'); if (c) c.focus(); }, 30);
  }
  function closeNav() {
    if (!nav || !nav.classList.contains('open')) return;
    nav.classList.remove('open'); setInert(false); startScroll();
    if (navOpener && navOpener.focus) navOpener.focus();
  }
  if ($('#openNav')) $('#openNav').addEventListener('click', openNav);
  if ($('#closeNav')) $('#closeNav').addEventListener('click', closeNav);
  if (nav) nav.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#' || href.split('#')[0] === location.pathname.split('/').pop()) closeNav();
  });

  /* ---------- request modal ---------- */
  var modal = $('#modal'), modalOpener = null;
  var MODES = {
    sell: ['Sell your home', "What's your home worth?", 'Home address and timing', 'Home address, and when you might list.', 'Home value'],
    buy: ['Buy a home', 'Find the right home.', 'Budget, area and timing', 'Budget, area and when you want to move.', 'Buying'],
    general: ['Get in touch', 'Tell JK what you need.', 'Message', 'Buying, selling, or just a question? Add your area and timeline.', 'General']
  };
  function openModal(mode, prefill) {
    if (!modal) return;
    var x = MODES[mode] || MODES.general;
    modalOpener = document.activeElement;
    resetForm($('#rf'));
    $('#meb').textContent = x[0]; $('#mt').textContent = x[1]; $('#rq-ml').textContent = x[2];
    $('#rq-msg').placeholder = x[3]; $('#rq-topic').value = x[4];
    if (prefill) $('#rq-msg').value = prefill;
    modal.classList.add('open'); setInert(true); stopScroll();
    setTimeout(function () { var i = $('#rq-name'); if (i) i.focus(); }, 60);
  }
  function closeModal() {
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open'); setInert(false); startScroll();
    setTimeout(function () { resetForm($('#rf')); }, 320);
    if (modalOpener && modalOpener.focus) modalOpener.focus();
  }
  if (modal) {
    $('#closeM').addEventListener('click', closeModal);
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener('keydown', function (e) { trap(modal, e); });
  }
  if (nav) nav.addEventListener('keydown', function (e) { trap(nav, e); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (modal && modal.classList.contains('open')) closeModal();
    else if (nav && nav.classList.contains('open')) closeNav();
  });
  document.addEventListener('click', function (e) {
    var m = e.target.closest && e.target.closest('[data-modal]');
    if (!m) return;
    e.preventDefault();
    if (nav && nav.classList.contains('open')) { nav.classList.remove('open'); setInert(false); startScroll(); }
    openModal(m.getAttribute('data-modal'), m.getAttribute('data-prefill'));
  });

  /* ---------- forms: one validation + submit handler for the whole site ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function fieldOf(c) { return c.closest('.field') || c.closest('.consent'); }
  function setErr(c, msg) {
    var f = fieldOf(c); if (!f) return;
    var err = $('.err', f);
    if (!err) { err = document.createElement(f.classList.contains('consent') ? 'span' : 'p'); err.className = 'err'; err.id = (c.id || c.name) + '-err'; f.appendChild(err); }
    if (msg) {
      err.textContent = msg; err.hidden = false; f.classList.add('invalid');
      c.setAttribute('aria-invalid', 'true'); c.setAttribute('aria-describedby', err.id);
    } else {
      err.textContent = ''; err.hidden = true; f.classList.remove('invalid');
      c.removeAttribute('aria-invalid'); c.removeAttribute('aria-describedby');
    }
  }
  function check(c) {
    var v = (c.type === 'checkbox') ? c.checked : c.value.trim();
    var msg = '';
    if (c.required && (c.type === 'checkbox' ? !v : !v)) msg = c.getAttribute('data-err') || 'This field is required.';
    else if (v && c.type === 'email' && !EMAIL.test(v)) msg = 'Please enter a valid email address, like name@example.com.';
    else if (v && c.getAttribute('data-type') === 'contact') {
      var digits = String(v).replace(/\D/g, '');
      if (!EMAIL.test(v) && digits.length < 7) msg = 'Please enter a valid phone number or email address.';
    } else if (v && c.getAttribute('data-type') === 'number' && !(parseFloat(String(v).replace(/[^0-9.]/g, '')) > 0)) msg = c.getAttribute('data-err') || 'Please enter a number.';
    setErr(c, msg);
    return !msg;
  }
  function validate(form) {
    var first = null;
    $$('input,select,textarea', form).forEach(function (c) {
      if (c.type === 'hidden' || c.closest('.hp')) return;
      if (!check(c) && !first) first = c;
    });
    return first;
  }
  function resetForm(form) {
    if (!form) return;
    var ok = form.parentNode.querySelector('.form-ok'); if (ok) ok.remove();
    form.hidden = false; form.reset();
    $$('input,select,textarea', form).forEach(function (c) { setErr(c, ''); });
    var st = $('.form-status', form); if (st) { st.hidden = true; st.textContent = ''; }
    var b = $('button[type=submit]', form); if (b) { b.disabled = false; var l = $('.lab', b); if (l && b.dataset.label) l.textContent = b.dataset.label; }
    if (form.closest('#modal')) modal.classList.remove('sent');
  }
  function payloadOf(form) {
    var o = { form: form.getAttribute('data-form') || 'form', page: location.pathname.split('/').pop() || 'index.html', submittedAt: new Date().toISOString() };
    $$('input,select,textarea', form).forEach(function (c) {
      if (!c.name || c.name === FORMS.honeypot) return;
      if (c.type === 'checkbox') o[c.name] = c.checked; else o[c.name] = c.value.trim();
    });
    return o;
  }
  function deliver(payload) {
    return new Promise(function (resolve, reject) {
      // Demo mode, or no endpoint yet: nothing is sent.
      if (FORMS.demo || !FORMS.endpoint) { setTimeout(resolve, 650); return; }
      // TODO WIRE ENDPOINT: this branch only runs once FORMS.demo is false and FORMS.endpoint is set.
      fetch(FORMS.endpoint, { method: FORMS.method, headers: FORMS.headers, body: JSON.stringify(payload) })
        .then(function (r) { if (r.ok) resolve(); else reject(new Error('HTTP ' + r.status)); }, reject);
    });
  }
  function showOk(form) {
    var ok = document.createElement('div');
    ok.className = 'form-ok'; ok.setAttribute('role', 'status'); ok.tabIndex = -1;
    var bg = document.createElement('div'); bg.className = 'bg';
    var img = document.createElement('img'); img.src = 'assets/img/fav-src.png'; img.alt = ''; img.width = 32; img.height = 32; bg.appendChild(img);
    var h = document.createElement('h3'); h.textContent = form.getAttribute('data-ok-title') || 'Thanks, that went through';
    var p = document.createElement('p'); p.textContent = form.getAttribute('data-ok-text') || 'JK will be in touch.';
    ok.appendChild(bg); ok.appendChild(h); ok.appendChild(p);
    if (FORMS.demo || !FORMS.endpoint) {
      var d = document.createElement('span'); d.className = 'demo-flag'; d.textContent = 'Demo build: nothing was sent'; ok.appendChild(d);
    }
    var again = document.createElement('button'); again.type = 'button'; again.className = 'pill outline noarrow';
    again.innerHTML = '<span>Start over</span>';
    again.addEventListener('click', function () { resetForm(form); var f = $('input,select,textarea', form); if (f) f.focus(); });
    ok.appendChild(again);
    form.hidden = true; form.parentNode.insertBefore(ok, form.nextSibling);
    if (form.closest('#modal')) modal.classList.add('sent');
    ok.focus();
  }
  function submitForm(form) {
    var st = $('.form-status', form);
    var bad = validate(form);
    if (bad) { if (st) { st.textContent = 'Please fix the highlighted fields.'; st.hidden = false; } bad.focus(); return; }
    if (st) { st.hidden = true; }
    var btn = $('button[type=submit]', form), lab = btn && $('.lab', btn);
    if (btn) { btn.disabled = true; if (lab) { btn.dataset.label = lab.textContent; lab.textContent = 'Sending...'; } }
    var hp = $('[name="' + FORMS.honeypot + '"]', form);
    if (hp && hp.value) { setTimeout(function () { showOk(form); }, 400); return; } // bot: look successful, send nothing
    deliver(payloadOf(form)).then(function () { showOk(form); }, function () {
      if (btn) { btn.disabled = false; if (lab) lab.textContent = btn.dataset.label || 'Send'; }
      if (st) { st.textContent = 'Sorry, that did not send. Please call or text JK on (416) 768 9596.'; st.hidden = false; }
    });
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.matches || !f.matches('form[data-form]')) return;
    e.preventDefault(); submitForm(f);
  });
  document.addEventListener('blur', function (e) {
    var c = e.target;
    if (c && c.closest && c.closest('form[data-form]') && /^(INPUT|SELECT|TEXTAREA)$/.test(c.tagName) && c.type !== 'checkbox' && c.value) check(c);
  }, true);
  document.addEventListener('input', function (e) {
    var c = e.target;
    if (c && c.closest && c.closest('.field.invalid') && c.closest('form[data-form]')) check(c);
  });
  document.addEventListener('change', function (e) {
    var c = e.target;
    if (c && c.type === 'checkbox' && c.closest('.consent.invalid')) check(c);
  });

  /* ---------- listings: filter bar updates the summary only (no data is fabricated) ---------- */
  var ff = $('#listing-filters');
  if (ff) {
    var sum = $('#filter-summary');
    var update = function () {
      var bits = ['area', 'price', 'beds', 'type'].map(function (n) {
        var s = ff.elements[n]; return s && s.value ? s.options[s.selectedIndex].text : null;
      }).filter(Boolean);
      sum.innerHTML = bits.length ? 'Filters set: <b></b>. These apply to live listings once the feed is connected.' : 'No filters set. Choose any of the options above to see how the search will work.';
      if (bits.length) $('b', sum).textContent = bits.join(' · ');
    };
    ff.addEventListener('change', update);
    ff.addEventListener('submit', function (e) { e.preventDefault(); update(); sum.focus(); });
    ff.addEventListener('reset', function () { setTimeout(update, 0); });
    update();
  }

  /* ---------- count-up numbers ---------- */
  var counts = $$('[data-count]');
  function countTick() {
    if (!counts.length) return;
    var vh = window.innerHeight;
    counts.forEach(function (el) {
      if (reduce) { el.textContent = el.getAttribute('data-count'); return; }
      var r = el.getBoundingClientRect(), end = vh / 2 - r.height / 2;
      var p = Math.max(0, Math.min(1, (vh - r.top) / (vh - end)));
      el.textContent = Math.round(p * +el.getAttribute('data-count'));
    });
  }
  countTick();
})();
