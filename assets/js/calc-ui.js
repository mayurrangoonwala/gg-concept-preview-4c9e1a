/* Calculator page behaviour. The maths lives in calc-math.js (shared with tests/calc.test.mjs). */
(function () {
  'use strict';
  var C = window.GGCalc;
  if (!C) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var money0 = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  var money2 = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var plain0 = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isNaN(n) ? NaN : (/^\s*-/.test(String(v)) ? -n : n); }
  function compact(v) { if (v >= 1e6) return '$' + (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + 'M'; if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'k'; return '$' + Math.round(v); }
  function signed(v, f) { var s = f.format(Math.abs(v)); return (v > 0.005 ? '+' : v < -0.005 ? '-' : '') + s; }

  function setErr(input, msg) {
    var id = input.getAttribute('data-err-id'), box = id ? document.getElementById(id) : null;
    if (!box) { var d = input.getAttribute('aria-describedby'); box = d ? document.getElementById(d.split(' ')[0]) : null; }
    var f = input.closest('.field');
    if (msg) { input.setAttribute('aria-invalid', 'true'); if (f) f.classList.add('invalid'); if (box) { box.textContent = msg; box.hidden = false; } }
    else { input.removeAttribute('aria-invalid'); if (f) f.classList.remove('invalid'); if (box) { box.textContent = ''; box.hidden = true; } }
  }

  /* ---------------- tabs ---------------- */
  var tabs = $$('[role=tab]'), panels = { mortgage: $('#mortgage'), renewal: $('#renewal') };
  function selectTab(name, focus) {
    tabs.forEach(function (t) {
      var on = t.id === 'tab-' + name;
      t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== name; });
    try { history.replaceState(null, '', name === 'renewal' ? '#renewal' : '#mortgage'); } catch (e) {}
    if (name === 'mortgage') drawMortgage();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t.id.replace('tab-', ''), false); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length, j = null;
      if (k === 'ArrowRight') j = (i + 1) % n; else if (k === 'ArrowLeft') j = (i - 1 + n) % n; else if (k === 'Home') j = 0; else if (k === 'End') j = n - 1;
      if (j !== null) { e.preventDefault(); selectTab(tabs[j].id.replace('tab-', ''), true); }
    });
  });

  /* ---------------- mortgage ---------------- */
  var m = { price: $('#m-price'), down: $('#m-down'), pct: $('#m-pct'), rate: $('#m-rate'), years: $('#m-years'), freq: $('#m-freq') };
  var last = 'down';            // which down-payment box the visitor edited last
  var chartData = null, scrub = $('#m-scrub');

  function fmtInput(el, n, dp) { el.value = dp ? String(Math.round(n * 100) / 100) : plain0.format(Math.round(n)); }

  function syncDown(from) {
    var price = num(m.price.value);
    if (!(price > 0)) return;
    if (from === 'down') { last = 'down'; var d = num(m.down.value); if (!isNaN(d)) m.pct.value = String(Math.round(d / price * 10000) / 100); }
    else if (from === 'pct') { last = 'pct'; var p = num(m.pct.value); if (!isNaN(p)) m.down.value = plain0.format(Math.round(price * p / 100)); }
    else if (from === 'price') {
      if (last === 'pct') { var p2 = num(m.pct.value); if (!isNaN(p2)) m.down.value = plain0.format(Math.round(price * p2 / 100)); }
      else { var d2 = num(m.down.value); if (!isNaN(d2)) m.pct.value = String(Math.round(d2 / price * 10000) / 100); }
    }
  }

  function readMortgage() {
    var v = { price: num(m.price.value), down: num(m.down.value), ratePct: num(m.rate.value), years: num(m.years.value), freq: m.freq.value };
    var ok = true;
    function bad(input, msg) { setErr(input, msg); ok = false; }
    setErr(m.price, ''); setErr(m.down, ''); setErr(m.pct, ''); setErr(m.rate, ''); setErr(m.years, '');
    if (isNaN(v.price) || v.price < 10000 || v.price > 100000000) bad(m.price, 'Enter a home price between $10,000 and $100,000,000.');
    if (isNaN(v.down) || v.down < 0) bad(m.down, 'Enter a down payment of $0 or more.');
    else if (!isNaN(v.price) && v.down > v.price) bad(m.down, "The down payment can't be more than the home price.");
    if (isNaN(v.ratePct) || v.ratePct < 0 || v.ratePct > 25) bad(m.rate, 'Enter a rate between 0% and 25%.');
    if (isNaN(v.years) || v.years < 5 || v.years > 30 || Math.round(v.years) !== v.years) bad(m.years, 'Enter a whole number of years from 5 to 30.');
    return ok ? v : null;
  }

  var el = function (id) { return document.getElementById(id); };
  function drawMortgage() {
    var v = readMortgage();
    var f = C.FREQ[m.freq.value] || C.FREQ.monthly;
    el('m-freq-l').textContent = f.label + ' payment';
    if (!v) {
      ['m-pay', 'm-prin', 'm-int', 'm-tot', 'm-off'].forEach(function (id) { el(id).textContent = '—'; });
      el('m-warn').hidden = true; el('m-figures').value = ''; el('m-sub').textContent = 'Check the highlighted fields';
      chartData = null; renderChart(); return;
    }
    var r = C.mortgage(v);
    el('m-pay').textContent = money2.format(r.payment);
    el('m-sub').textContent = f.accel ? 'Half the monthly payment, paid every two weeks' : 'Principal and interest only';
    el('m-prin').textContent = money0.format(r.principal);
    el('m-int').textContent = money0.format(r.totalInterest);
    el('m-tot').textContent = money0.format(r.totalCost);
    var yrs = r.payoffYears, whole = Math.floor(yrs + 1e-9), months = Math.round((yrs - whole) * 12);
    if (months === 12) { whole++; months = 0; }
    el('m-off').textContent = whole + (whole === 1 ? ' year' : ' years') + (months ? ' ' + months + (months === 1 ? ' month' : ' months') : '');
    var tot = r.principal + r.totalInterest || 1;
    el('m-barp').style.width = (r.principal / tot * 100).toFixed(1) + '%'; el('m-bari').style.width = (r.totalInterest / tot * 100).toFixed(1) + '%';
    var pctDown = v.down / v.price * 100, warn = el('m-warn');
    if (pctDown < 20) { warn.hidden = false; warn.textContent = 'With less than 20% down, mortgage default insurance usually applies. The premium is not included in these figures. Ask a lender what applies to you.'; }
    else warn.hidden = true;
    el('m-figures').value = 'Mortgage calculator: price ' + money0.format(v.price) + '; down payment ' + money0.format(v.down) + ' (' + (Math.round(pctDown * 10) / 10) + '%); rate ' + v.ratePct + '%; amortization ' + v.years + ' years; ' + f.label.toLowerCase() + ' payment ' + money2.format(r.payment) + '; mortgage ' + money0.format(r.principal) + '; total interest ' + money0.format(r.totalInterest) + '; total cost ' + money0.format(r.totalCost) + '.';
    chartData = { r: r, years: Math.ceil(r.payoffYears - 1e-9) || 1, v: v };
    scrub.max = chartData.years;
    if (+scrub.value > chartData.years) scrub.value = chartData.years;
    renderChart();
  }

  function at(points, y) {
    if (y <= 0) return points[0];
    for (var i = 1; i < points.length; i++) {
      if (y <= points[i].year) {
        var a = points[i - 1], b = points[i], t = (y - a.year) / ((b.year - a.year) || 1);
        return { year: y, balance: a.balance + (b.balance - a.balance) * t, interest: a.interest + (b.interest - a.interest) * t };
      }
    }
    return points[points.length - 1];
  }
  function niceMax(v) { var p = Math.pow(10, Math.floor(Math.log10(v || 1))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text != null) e.textContent = text; return e; }

  function renderChart() {
    var svg = el('m-chart'), title = el('m-chart-t'), desc = el('m-chart-d'), out = el('m-scrub-o');
    Array.prototype.slice.call(svg.childNodes).forEach(function (n) { if (n !== title && n !== desc) svg.removeChild(n); });
    if (!chartData) { desc.textContent = 'No chart: check the numbers above.'; out.textContent = ''; scrub.disabled = true; return; }
    scrub.disabled = false;
    var r = chartData.r, X = chartData.years, W = 640;
    var cw = svg.getBoundingClientRect().width || 640, fs = Math.max(11, Math.min(22, 10.5 * W / cw));
    var H = cw < 520 ? 400 : 320, L = Math.round(fs * 3.6 + 12), R = 16, T = 14, B = Math.round(fs * 2.4), pw = W - L - R, ph = H - T - B;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var ymax = niceMax(Math.max(r.principal, r.totalInterest) * 1.02);
    var sx = function (y) { return L + (y / X) * pw; }, sy = function (v) { return T + ph - (v / ymax) * ph; };
    var g = svgEl('g'); svg.appendChild(g);
    for (var i = 0; i <= 4; i++) {
      var yv = ymax * i / 4, yy = sy(yv);
      g.appendChild(svgEl('line', { x1: L, x2: W - R, y1: yy, y2: yy, 'class': 'grid' }));
      g.appendChild(svgEl('text', { x: L - 8, y: yy + fs * 0.35, 'text-anchor': 'end', 'font-size': fs }, compact(yv)));
    }
    var step = X <= 10 ? 1 : X <= 20 ? 2 : 5; if (cw < 520 && X > 10) step = Math.max(step, 5);
    for (var y = 0; y <= X; y += step) g.appendChild(svgEl('text', { x: sx(y), y: H - 4 - fs * 0.3, 'text-anchor': 'middle', 'font-size': fs }, y === 0 ? 'Start' : 'Yr ' + y));
    var pts = r.points.map(function (p) { return p; });
    var bal = pts.map(function (p, k) { return (k ? 'L' : 'M') + sx(p.year).toFixed(1) + ' ' + sy(p.balance).toFixed(1); }).join('');
    g.appendChild(svgEl('path', { d: bal + 'L' + sx(pts[pts.length - 1].year).toFixed(1) + ' ' + sy(0).toFixed(1) + 'L' + sx(0) + ' ' + sy(0) + 'Z', 'class': 'bal', stroke: 'none' }));
    g.appendChild(svgEl('path', { d: bal, fill: 'none', stroke: '#0a0a0a', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    g.appendChild(svgEl('path', { d: pts.map(function (p, k) { return (k ? 'L' : 'M') + sx(p.year).toFixed(1) + ' ' + sy(p.interest).toFixed(1); }).join(''), 'class': 'int' }));
    var cur = svgEl('g'); svg.appendChild(cur);
    var yrNow = Math.min(+scrub.value, X), p = at(pts, yrNow);
    cur.appendChild(svgEl('line', { x1: sx(yrNow), x2: sx(yrNow), y1: T, y2: T + ph, 'class': 'cur' }));
    cur.appendChild(svgEl('circle', { cx: sx(yrNow), cy: sy(p.balance), r: 5, 'class': 'dot', stroke: '#0a0a0a' }));
    cur.appendChild(svgEl('circle', { cx: sx(yrNow), cy: sy(p.interest), r: 5, 'class': 'dot', stroke: '#8f6b1d' }));
    var txt = yrNow === 0 ? 'At the start: balance ' + money0.format(r.principal) + ', no interest paid yet.' : 'After year ' + yrNow + ': balance ' + money0.format(p.balance) + ', interest paid so far ' + money0.format(p.interest) + '.';
    out.innerHTML = ''; var b1 = document.createElement('b'); b1.textContent = yrNow === 0 ? 'Start' : 'Year ' + yrNow; out.appendChild(b1); out.appendChild(document.createTextNode(': balance ' + money0.format(p.balance) + ', interest paid so far ' + money0.format(p.interest)));
    scrub.setAttribute('aria-valuetext', txt);
    desc.textContent = 'Balance falls from ' + money0.format(r.principal) + ' to zero over about ' + (Math.round(r.payoffYears * 10) / 10) + ' years, while interest paid builds to ' + money0.format(r.totalInterest) + '. ' + txt;
  }

  /* ---------------- renewal ---------------- */
  var rr = { bal: $('#r-bal'), years: $('#r-years'), cur: $('#r-cur'), nw: $('#r-new'), freq: $('#r-freq') };
  function drawRenewal() {
    var v = { balance: num(rr.bal.value), years: num(rr.years.value), currentPct: num(rr.cur.value), newPct: num(rr.nw.value), freq: rr.freq.value }, ok = true;
    function bad(input, msg) { setErr(input, msg); ok = false; }
    [rr.bal, rr.years, rr.cur, rr.nw].forEach(function (i) { setErr(i, ''); });
    if (isNaN(v.balance) || v.balance < 1000 || v.balance > 100000000) bad(rr.bal, 'Enter a balance between $1,000 and $100,000,000.');
    if (isNaN(v.years) || v.years < 1 || v.years > 30 || Math.round(v.years) !== v.years) bad(rr.years, 'Enter a whole number of years from 1 to 30.');
    if (isNaN(v.currentPct) || v.currentPct < 0 || v.currentPct > 25) bad(rr.cur, 'Enter a rate between 0% and 25%.');
    if (isNaN(v.newPct) || v.newPct < 0 || v.newPct > 25) bad(rr.nw, 'Enter a rate between 0% and 25%.');
    var f = C.FREQ[rr.freq.value] || C.FREQ.monthly;
    el('r-freq-l').textContent = 'New ' + f.label.toLowerCase() + ' payment';
    if (!ok) { ['r-pay', 'r-now', 'r-diff', 'r-year', 'r-int'].forEach(function (id) { el(id).textContent = '—'; }); el('r-figures').value = ''; el('r-sub').textContent = 'Check the highlighted fields'; return; }
    var r = C.renewal(v);
    el('r-sub').textContent = f.accel ? 'Half the monthly payment, paid every two weeks' : 'At your new rate';
    el('r-pay').textContent = money2.format(r.newPayment);
    el('r-now').textContent = money2.format(r.currentPayment);
    var d = el('r-diff'); d.textContent = signed(r.difference, money2); d.className = r.difference > 0.005 ? 'pos' : r.difference < -0.005 ? 'neg' : '';
    var y = el('r-year'); y.textContent = signed(r.differencePerYear, money0); y.className = d.className;
    el('r-int').textContent = money0.format(r.totalInterestNew);
    el('r-figures').value = 'Renewal calculator: balance ' + money0.format(v.balance) + '; remaining amortization ' + v.years + ' years; current rate ' + v.currentPct + '%; new rate ' + v.newPct + '%; ' + f.label.toLowerCase() + ' payment goes from about ' + money2.format(r.currentPayment) + ' to ' + money2.format(r.newPayment) + ' (' + signed(r.difference, money2) + ' per payment).';
  }

  /* ---------------- wiring ---------------- */
  function onBlurFmt(input, dp) { input.addEventListener('blur', function () { var n = num(input.value); if (!isNaN(n)) { if (dp) input.value = String(Math.round(n * 100) / 100); else input.value = plain0.format(Math.round(n)); } }); }
  m.price.addEventListener('input', function () { syncDown('price'); drawMortgage(); });
  m.down.addEventListener('input', function () { syncDown('down'); drawMortgage(); });
  m.pct.addEventListener('input', function () { syncDown('pct'); drawMortgage(); });
  [m.rate, m.years, m.freq].forEach(function (i) { i.addEventListener('input', drawMortgage); i.addEventListener('change', drawMortgage); });
  onBlurFmt(m.price); onBlurFmt(m.down); onBlurFmt(m.pct, true);
  scrub.addEventListener('input', renderChart);
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(renderChart, 120); });
  [rr.bal, rr.years, rr.cur, rr.nw, rr.freq].forEach(function (i) { i.addEventListener('input', drawRenewal); i.addEventListener('change', drawRenewal); });
  onBlurFmt(rr.bal);
  // a simple resize-free chart: the SVG scales with its box

  selectTab(location.hash === '#renewal' ? 'renewal' : 'mortgage', false);
  window.addEventListener('hashchange', function () { selectTab(location.hash === '#renewal' ? 'renewal' : 'mortgage', false); });
  drawMortgage(); drawRenewal();
})();
