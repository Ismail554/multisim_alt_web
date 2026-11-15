/* CircuitBench — simulation engine (modified nodal analysis, trapezoidal integration) */
(function (G) {
  'use strict';
  const CL = G.CL = G.CL || {};
  CL.U = 16; // pixels per grid unit
  const GMIN = 1e-12;

  class Sim {
    constructor() { this.dt = 1e-5; this.t = 0; this.setup([], 1); }

    setup(elements, nodeCount) {
      this.elements = elements; this.nodeCount = nodeCount;
      let vs = 0; this.nonlinear = false;
      for (const e of elements) { e.vsIdx = vs; vs += e.vsCount | 0; if (e.nonlinear) this.nonlinear = true; }
      const n = this.n = nodeCount - 1 + vs;
      this.A = new Float64Array(n * n); this.lu = new Float64Array(n * n);
      this.b = new Float64Array(n); this.x = new Float64Array(n); this.xn = new Float64Array(n);
      this.perm = new Int32Array(n); this.v = new Float64Array(nodeCount);
      this.luValid = false; this.rhsOnly = false; this.error = null; this.warn = null;
    }
    invalidate() { this.luValid = false; }
    reset() {
      this.t = 0; this.x.fill(0); this.v.fill(0); this.luValid = false; this.error = null; this.warn = null;
      for (const e of this.elements) e.reset();
    }

    /* --- stamping helpers; node 0 is ground --- */
    stampG(a, b, g) {
      if (this.rhsOnly) return;
      const A = this.A, n = this.n; a--; b--;
      if (a >= 0) A[a * n + a] += g;
      if (b >= 0) A[b * n + b] += g;
      if (a >= 0 && b >= 0) { A[a * n + b] -= g; A[b * n + a] -= g; }
    }
    /* current i flowing from node a to node b through the element */
    stampI(a, b, i) { a--; b--; if (a >= 0) this.b[a] -= i; if (b >= 0) this.b[b] += i; }
    /* current i injected into node a */
    stampRHS(a, i) { a--; if (a >= 0) this.b[a] += i; }
    /* voltage source k: v(p) - v(m) = volt */
    stampVS(p, m, k, volt) {
      const row = this.nodeCount - 1 + k, n = this.n;
      if (!this.rhsOnly) {
        const A = this.A; p--; m--;
        if (p >= 0) { A[p * n + row] += 1; A[row * n + p] += 1; }
        if (m >= 0) { A[m * n + row] -= 1; A[row * n + m] -= 1; }
      }
      this.b[row] += volt;
    }
    addA(r, c, v) { if (r >= 0 && c >= 0 && !this.rhsOnly) this.A[r * this.n + c] += v; }
    addB(r, v) { if (r >= 0) this.b[r] += v; }
    row(e, k) { return this.nodeCount - 1 + e.vsIdx + (k || 0); }

    factor() {
      const n = this.n, a = this.lu, p = this.perm; a.set(this.A);
      for (let k = 0; k < n; k++) {
        let max = Math.abs(a[k * n + k]), r = k;
        for (let i = k + 1; i < n; i++) { const v = Math.abs(a[i * n + k]); if (v > max) { max = v; r = i; } }
        if (!(max > 1e-18)) return false;
        p[k] = r;
        if (r !== k) for (let j = 0; j < n; j++) { const t = a[k * n + j]; a[k * n + j] = a[r * n + j]; a[r * n + j] = t; }
        const piv = a[k * n + k];
        for (let i = k + 1; i < n; i++) {
          const f = a[i * n + k] / piv; a[i * n + k] = f;
          if (f !== 0) for (let j = k + 1; j < n; j++) a[i * n + j] -= f * a[k * n + j];
        }
      }
      return true;
    }
    solve() {
      const n = this.n, a = this.lu, p = this.perm, x = this.xn; x.set(this.b);
      for (let k = 0; k < n; k++) { const r = p[k]; if (r !== k) { const t = x[k]; x[k] = x[r]; x[r] = t; } }
      for (let i = 1; i < n; i++) { let s = x[i]; for (let j = 0; j < i; j++) s -= a[i * n + j] * x[j]; x[i] = s; }
      for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= a[i * n + j] * x[j]; x[i] = s / a[i * n + i]; }
    }

    step() {
      const n = this.n, els = this.elements;
      this.tn = this.t + this.dt;
      for (let i = 0; i < els.length; i++) if (els[i].beginStep) els[i].beginStep(this);
      if (n > 0) {
        const maxIter = this.nonlinear ? 150 : 1;
        let ok = false;
        for (let it = 0; it < maxIter; it++) {
          this.converged = true;
          const reuse = !this.nonlinear && this.luValid;
          this.rhsOnly = reuse;
          if (!reuse) this.A.fill(0);
          this.b.fill(0);
          for (let i = 0; i < els.length; i++) els[i].stamp(this);
          if (!reuse) {
            for (let i = 0, m = this.nodeCount - 1; i < m; i++) this.A[i * n + i] += GMIN;
            if (!this.factor()) {
              this.error = 'Circuit cannot be solved (singular matrix). Check for voltage sources shorted together or in a loop.';
              return false;
            }
            this.luValid = true;
          }
          this.solve();
          const x = this.x, xn = this.xn;
          for (let i = 0; i < n; i++) {
            const v = xn[i];
            if (v !== v) { this.error = 'Simulation diverged (NaN). Try a smaller time step.'; return false; }
            if (Math.abs(v - x[i]) > 1e-6 + 1e-3 * Math.abs(v)) this.converged = false;
            x[i] = v;
          }
          for (let i = 1; i < this.nodeCount; i++) this.v[i] = x[i - 1];
          if (!this.nonlinear || (this.converged && it > 0)) { ok = true; break; }
        }
        this.warn = ok ? null : 'Convergence problem — results may be inaccurate. Try a smaller time step.';
      }
      this.t = this.tn;
      for (let i = 0; i < els.length; i++) if (els[i].accept) els[i].accept(this);
      return true;
    }
  }
  CL.Sim = Sim;

  /* --- number formatting with SI prefixes --- */
  function trim(x) {
    const a = Math.abs(x);
    const s = a >= 100 ? x.toFixed(1) : a >= 10 ? x.toFixed(2) : x.toFixed(3);
    return s.replace(/\.?0+$/, '');
  }
  const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  CL.fmt = function (v, unit) {
    unit = unit || '';
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a < 1e-13) return '0 ' + unit;
    for (const [m, s] of PRE) if (a >= m * 0.9995) return trim(v / m) + ' ' + s + unit;
    return trim(v / 1e-12) + ' p' + unit;
  };
  const SUF = { G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, n: 1e-9, p: 1e-12 };
  CL.parseSI = function (s) {
    if (typeof s === 'number') return s;
    const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([a-zA-Zµμ]*)/.exec(String(s));
    if (!m) return NaN;
    let v = parseFloat(m[1]); const suf = m[2];
    if (suf) { if (/^meg/i.test(suf)) v *= 1e6; else if (SUF[suf[0]] !== undefined) v *= SUF[suf[0]]; }
    return v;
  };

  if (typeof module !== 'undefined') module.exports = CL;
})(typeof window !== 'undefined' ? window : globalThis);
