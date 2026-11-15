/* CircuitBench — oscilloscope / logic analyser panel */
(function (G) {
  'use strict';
  const CL = G.CL, fmt = CL.fmt;
  const N = 1600, VIS = 800;
  const COLORS = ['#e8a013', '#2f8fdd', '#d6453d', '#2fa866', '#a35ad6', '#18a8a8'];

  function nice(lo, hi) {
    if (!(hi > lo)) { const m = Math.abs(lo) || 1; lo -= m * 0.5; hi += m * 0.5; }
    const raw = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
    return { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step };
  }

  class Scope {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.traces = []; this.window = 0.02; this.mode = 'overlay'; this.trig = true;
      this.head = 0; this.count = 0; this.k = 0; this.stride = 1; this.dt = 1e-5; this.hover = -1;
      canvas.addEventListener('mousemove', ev => { this.hover = ev.offsetX; });
      canvas.addEventListener('mouseleave', () => { this.hover = -1; });
    }
    setTiming(dt) { this.dt = dt; this.stride = Math.max(1, Math.round(this.window / VIS / dt)); this.clear(); }
    setWindow(w) { this.window = w; this.setTiming(this.dt); }
    clear() { this.head = 0; this.count = 0; this.k = 0; for (const t of this.traces) { t.lo = Infinity; t.hi = -Infinity; } }
    setTraces(elements) {
      const old = new Map(this.traces.map(t => [t.elm, t]));
      this.traces = elements.filter(e => e.scopeOn && e.scopeOn()).map((e, i) => {
        const t = old.get(e) || { elm: e, min: new Float32Array(N).fill(NaN), max: new Float32Array(N).fill(NaN), lo: Infinity, hi: -Infinity };
        t.color = e.color = COLORS[i % COLORS.length]; return t;
      });
    }
    sample(sim) {
      const tr = this.traces;
      for (let i = 0; i < tr.length; i++) { const t = tr[i], v = t.elm.scopeValue(sim); if (v < t.lo) t.lo = v; if (v > t.hi) t.hi = v; }
      if (++this.k < this.stride) return;
      this.k = 0;
      for (let i = 0; i < tr.length; i++) { const t = tr[i]; t.min[this.head] = t.lo; t.max[this.head] = t.hi; t.lo = Infinity; t.hi = -Infinity; }
      this.head = (this.head + 1) % N; if (this.count < N) this.count++;
    }
    idx(c) { return (this.head - this.count + c + 2 * N) % N; }

    draw(th) {
      const cv = this.cv, ctx = this.ctx, dpr = G.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = th.scopeBg; ctx.fillRect(0, 0, W, H);
      ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'middle';
      const tr = this.traces;
      if (!tr.length) {
        ctx.fillStyle = th.dim; ctx.textAlign = 'center';
        ctx.fillText('Place a Scope probe on a wire (or tick "Show on scope" on a meter) to see waveforms here.', W / 2, H / 2);
        return;
      }
      const L = 56, R = 10, T = 8, Bm = 18, pw = W - L - R, ph = H - T - Bm;
      const nvis = Math.max(2, Math.min(VIS, Math.round(this.window / (this.stride * this.dt))));
      let start = this.count - nvis;
      if (this.trig && this.count > nvis + 1) {
        const t0 = tr[0]; let lo = Infinity, hi = -Infinity;
        for (let c = 0; c < this.count; c++) { const i = this.idx(c); if (t0.min[i] < lo) lo = t0.min[i]; if (t0.max[i] > hi) hi = t0.max[i]; }
        if (hi - lo > 1e-9) {
          const lvl = (lo + hi) / 2, val = c => { const i = this.idx(c); return (t0.min[i] + t0.max[i]) / 2; };
          for (let c = this.count - nvis; c >= 1; c--) if (val(c - 1) < lvl && val(c) >= lvl) { start = c; break; }
        }
      }
      const X = j => L + j / (nvis - 1) * pw;
      // vertical grid
      ctx.strokeStyle = th.scopeGrid; ctx.lineWidth = 1; ctx.beginPath();
      for (let d = 0; d <= 10; d++) { const x = Math.round(L + d / 10 * pw) + 0.5; ctx.moveTo(x, T); ctx.lineTo(x, T + ph); }
      ctx.stroke();
      const lanes = this.mode === 'stacked' ? tr.length : 1, lh = ph / lanes;
      const range = list => {
        let lo = Infinity, hi = -Infinity;
        for (const t of list) for (let j = 0; j < nvis; j++) {
          const c = start + j; if (c < 0) continue; const i = this.idx(c);
          if (t.min[i] < lo) lo = t.min[i]; if (t.max[i] > hi) hi = t.max[i];
        }
        if (lo === Infinity) { lo = 0; hi = 1; }
        return nice(lo, hi);
      };
      const hoverJ = this.hover >= L && this.hover <= L + pw ? Math.round((this.hover - L) / pw * (nvis - 1)) : -1;
      for (let ln = 0; ln < lanes; ln++) {
        const list = lanes === 1 ? tr : [tr[ln]], sc = range(list), y0 = T + ln * lh, pad = lanes === 1 ? 0 : 5;
        const Y = v => y0 + pad + (sc.hi - v) / (sc.hi - sc.lo) * (lh - 2 * pad);
        ctx.strokeStyle = th.scopeGrid; ctx.fillStyle = th.dim; ctx.textAlign = 'right'; ctx.beginPath();
        const ticks = lanes === 1 ? Math.round((sc.hi - sc.lo) / sc.step) : 1, unit = list[0].elm.scopeUnit || 'V';
        for (let k = 0; k <= ticks; k++) {
          const v = lanes === 1 ? sc.lo + k * sc.step : (k ? sc.hi : sc.lo), y = Math.round(Y(v)) + 0.5;
          ctx.moveTo(L, y); ctx.lineTo(L + pw, y);
          ctx.fillText(fmt(Math.abs(v) < sc.step * 1e-6 ? 0 : v, unit).replace(' ', ''), L - 5, Math.min(Math.max(y, y0 + 6), y0 + lh - 6));
        }
        ctx.stroke();
        list.forEach((t, li) => {
          ctx.strokeStyle = t.color; ctx.lineWidth = 1.5; ctx.beginPath(); let pen = false;
          for (let j = 0; j < nvis; j++) {
            const c = start + j; if (c < 0 || c >= this.count) continue;
            const i = this.idx(c), a = t.min[i], b = t.max[i];
            if (a !== a) { pen = false; continue; }
            const x = X(j);
            if (!pen) { ctx.moveTo(x, Y(a)); pen = true; } else ctx.lineTo(x, Y(a));
            if (b !== a) ctx.lineTo(x, Y(b));
          }
          ctx.stroke();
          // legend
          let c = hoverJ >= 0 ? start + hoverJ : this.count - 1; c = Math.max(0, Math.min(this.count - 1, c));
          const i = this.idx(c), val = this.count ? (t.min[i] + t.max[i]) / 2 : NaN;
          ctx.fillStyle = t.color; ctx.textAlign = 'left'; ctx.font = 'bold 11px system-ui, sans-serif';
          const lx = L + 8, ly = lanes === 1 ? T + 10 + li * 14 : y0 + 10;
          ctx.fillText(t.elm.scopeName() + '  ' + fmt(val, t.elm.scopeUnit || 'V'), lx, ly);
          ctx.font = '11px system-ui, sans-serif';
        });
        if (lanes > 1 && ln) { ctx.strokeStyle = th.scopeGrid; ctx.beginPath(); ctx.moveTo(L, Math.round(y0) + 0.5); ctx.lineTo(L + pw, Math.round(y0) + 0.5); ctx.stroke(); }
      }
      ctx.strokeStyle = th.dim; ctx.lineWidth = 1; ctx.strokeRect(L + 0.5, T + 0.5, pw, ph);
      if (hoverJ >= 0) { const x = Math.round(X(hoverJ)) + 0.5; ctx.strokeStyle = th.dim; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke(); }
      ctx.fillStyle = th.dim; ctx.textAlign = 'left';
      const span = nvis * this.stride * this.dt;
      ctx.fillText(fmt(span / 10, 's') + ' / div' + (hoverJ >= 0 ? '   cursor: ' + fmt(hoverJ / (nvis - 1) * span, 's') : ''), L, H - 8);
    }
  }
  CL.Scope = Scope;
})(typeof window !== 'undefined' ? window : globalThis);
