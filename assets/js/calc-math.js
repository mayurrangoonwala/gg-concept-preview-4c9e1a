/* Mortgage maths. One pure module shared by the calculator page and tests/calc.test.mjs.
   Canadian fixed-rate convention: interest compounds semi-annually, so the effective
   periodic rate is i = (1 + r/2)^(2/n) - 1, and payment = P * i / (1 - (1 + i)^-N). */
(function (root) {
  'use strict';

  var FREQ = {
    'monthly':          { n: 12, label: 'Monthly',                 accel: false },
    'semi-monthly':     { n: 24, label: 'Semi-monthly',            accel: false },
    'bi-weekly':        { n: 26, label: 'Bi-weekly',               accel: false },
    'accelerated':      { n: 26, label: 'Accelerated bi-weekly',   accel: true  },
    'weekly':           { n: 52, label: 'Weekly',                  accel: false }
  };

  /** Effective rate per payment period. annualPct is e.g. 5 for 5%. */
  function periodicRate(annualPct, n) {
    var r = annualPct / 100;
    return Math.pow(1 + r / 2, 2 / n) - 1;
  }

  /** Level payment for principal P over N payments at periodic rate i. */
  function paymentFor(P, i, N) {
    if (N <= 0) return 0;
    if (i === 0) return P / N;
    return P * i / (1 - Math.pow(1 + i, -N));
  }

  /** Balance year by year (and cumulative interest), by simulating each payment. */
  function schedule(P, i, pay, n, maxYears) {
    var bal = P, paid = 0, interest = 0, periods = 0;
    var points = [{ year: 0, balance: P, interest: 0, paid: 0 }];
    var limit = Math.ceil(maxYears * n) + n * 2;
    while (bal > 0.005 && periods < limit) {
      var int = bal * i;
      var principal = pay - int;
      var thisPay = pay;
      if (principal >= bal) { principal = bal; thisPay = bal + int; }
      bal -= principal; interest += int; paid += thisPay; periods++;
      if (periods % n === 0 || bal <= 0.005) {
        points.push({ year: periods / n, balance: Math.max(bal, 0), interest: interest, paid: paid });
      }
    }
    return { periods: periods, interest: interest, paid: paid, points: points };
  }

  /**
   * Full mortgage calculation.
   * input: { price, down, ratePct, years, freq }
   */
  function mortgage(input) {
    var f = FREQ[input.freq] || FREQ.monthly;
    var principal = Math.max(input.price - input.down, 0);
    var years = input.years;
    var monthlyI = periodicRate(input.ratePct, 12);
    var i = periodicRate(input.ratePct, f.n);
    var N = Math.round(years * f.n);
    var monthlyPay = paymentFor(principal, monthlyI, years * 12);
    var pay = f.accel ? monthlyPay / 2 : paymentFor(principal, i, N);
    var s = principal > 0 ? schedule(principal, i, pay, f.n, years) : { periods: 0, interest: 0, paid: 0, points: [{ year: 0, balance: 0, interest: 0, paid: 0 }] };
    return {
      principal: principal,
      payment: pay,
      periodsPerYear: f.n,
      periods: s.periods,
      payoffYears: s.periods / f.n,
      totalInterest: s.interest,
      totalCost: principal + s.interest,
      points: s.points
    };
  }

  /**
   * Renewal estimate. The "current" payment is what the same balance and remaining
   * amortization would cost at the current rate; the new payment uses the new rate.
   * input: { balance, years, currentPct, newPct, freq }
   */
  function renewal(input) {
    var f = FREQ[input.freq] || FREQ.monthly;
    var N = Math.round(input.years * f.n);
    var iNow = periodicRate(input.currentPct, f.n);
    var iNew = periodicRate(input.newPct, f.n);
    var monthlyNow = paymentFor(input.balance, periodicRate(input.currentPct, 12), input.years * 12);
    var monthlyNew = paymentFor(input.balance, periodicRate(input.newPct, 12), input.years * 12);
    var nowPay = f.accel ? monthlyNow / 2 : paymentFor(input.balance, iNow, N);
    var newPay = f.accel ? monthlyNew / 2 : paymentFor(input.balance, iNew, N);
    var s = input.balance > 0 ? schedule(input.balance, iNew, newPay, f.n, input.years) : { interest: 0, periods: 0 };
    return {
      currentPayment: nowPay,
      newPayment: newPay,
      difference: newPay - nowPay,
      differencePerYear: (newPay - nowPay) * f.n,
      periodsPerYear: f.n,
      totalInterestNew: s.interest
    };
  }

  var api = { FREQ: FREQ, periodicRate: periodicRate, paymentFor: paymentFor, schedule: schedule, mortgage: mortgage, renewal: renewal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GGCalc = api;
})(typeof window !== 'undefined' ? window : this);
