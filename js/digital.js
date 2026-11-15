/* CircuitBench — logic gates, displays, IC library (74xx, 555) and custom ICs */
(function (G) {
  'use strict';
  const CL = G.CL, U = CL.U, Elm = CL.Elm, fmt = CL.fmt, reg = CL.reg;
  const { line, circle } = CL.draw;
  const VH = 5, VTH = 2.5, GOUT = 1 / 50;
  const ONE = [[0, 0]];

  /* Outputs are 5 V / 0 V sources behind 50 Ω. Inputs are read after each time step,
     so every logic element has one time step of propagation delay. */
  class LogicElm extends Elm {
    setIO(ins, outs) { this.ins = ins; this.outs = outs; this.outv = outs.map(() => false); this.pend = outs.map(() => false); }
    reset() { if (this.outv) { this.outv.fill(false); this.pend.fill(false); } }
    rd(sim, idx, dflt) { return this.conn[idx] ? sim.v[this.nodes[idx]] > VTH : !!dflt; }
    stamp(sim) {
      const o = this.outs;
      for (let k = 0; k < o.length; k++) { const n = this.nodes[o[k]]; sim.stampG(n, 0, GOUT); if (this.outv[k]) sim.stampRHS(n, VH * GOUT); }
    }
    /* jitter: occasionally delay a change by one extra step so cross-coupled gates settle instead of oscillating */
    setOut(k, val, jitter) {
      val = !!val;
      if (val === this.outv[k]) { this.pend[k] = false; return; }
      if (jitter && !this.pend[k] && Math.random() < 0.25) { this.pend[k] = true; return; }
      this.pend[k] = false; this.outv[k] = val;
    }
    hi(st, idx) { return st.live && st.sim.v[this.nodes[idx]] > VTH; }
  }

  class Gate extends LogicElm {
    static type = 'gate'; static title = 'Logic gate';
    static props = [{ k: 'fn', label: 'Function', type: 'select', options: ['and', 'or', 'nand', 'nor', 'xor', 'xnor'], def: 'and' },
      { k: 'n', label: 'Inputs', type: 'select', options: [2, 3], def: 2 }];
    init() { this.build(); }
    onProp() { this.build(); }
    build() {
      const n = +this.p.n === 3 ? 3 : 2; this.p.n = n;
      this.pinList = n === 3 ? [[0, 0], [0, 1], [0, 2], [4, 1]] : [[0, 0], [0, 2], [4, 1]];
      this.setIO(n === 3 ? [0, 1, 2] : [0, 1], [n]);
    }
    get title() { return this.p.fn.toUpperCase() + ' gate'; }
    pins() { return this.pinList; }
    bbox() { return [0, -8, 64, 40]; }
    accept(sim) {
      const n = this.ins.length; let c = 0, y;
      for (let i = 0; i < n; i++) if (this.rd(sim, i)) c++;
      switch (this.p.fn) {
        case 'and': y = c === n; break; case 'nand': y = c !== n; break;
        case 'or': y = c > 0; break; case 'nor': y = c === 0; break;
        case 'xor': y = (c & 1) === 1; break; default: y = (c & 1) === 0;
      }
      this.setOut(0, y, true);
    }
    draw(ctx, st) {
      const fn = this.p.fn, inv = fn === 'nand' || fn === 'nor' || fn === 'xnor';
      const orish = fn !== 'and' && fn !== 'nand', x = fn === 'xor' || fn === 'xnor';
      ctx.beginPath();
      for (let i = 0; i < this.ins.length; i++) { const y = this.pinList[i][1] * U; ctx.moveTo(0, y); ctx.lineTo(orish ? 18 : 14, y); }
      ctx.moveTo(inv ? 60 : 54, 16); ctx.lineTo(64, 16); ctx.stroke();
      ctx.fillStyle = st.th.chip; ctx.beginPath();
      if (orish) { ctx.moveTo(12, -6); ctx.quadraticCurveTo(38, -6, 54, 16); ctx.quadraticCurveTo(38, 38, 12, 38); ctx.quadraticCurveTo(22, 16, 12, -6); }
      else { ctx.moveTo(14, -6); ctx.lineTo(32, -6); ctx.arc(32, 16, 22, -Math.PI / 2, Math.PI / 2); ctx.lineTo(14, 38); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      if (x) { ctx.beginPath(); ctx.moveTo(7, -6); ctx.quadraticCurveTo(17, 16, 7, 38); ctx.stroke(); }
      if (inv) circle(ctx, 57, 16, 3, true);
    }
    info() { return ['Output = ' + (this.outv[0] ? '1' : '0')]; }
  }
  reg(Gate);

  class Not extends LogicElm {
    static type = 'not'; static title = 'NOT gate';
    init() { this.setIO([0], [1]); this.inv = true; }
    pins() { return Not.PINS; }
    bbox() { return [0, -12, 48, 12]; }
    accept(sim) { this.setOut(0, this.rd(sim, 0) !== this.inv, true); }
    draw(ctx, st) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 0); ctx.moveTo(this.inv ? 38 : 32, 0); ctx.lineTo(48, 0); ctx.stroke();
      ctx.fillStyle = st.th.chip; ctx.beginPath(); ctx.moveTo(12, -10); ctx.lineTo(12, 10); ctx.lineTo(32, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (this.inv) circle(ctx, 35, 0, 3, true);
    }
    info() { return ['Output = ' + (this.outv[0] ? '1' : '0')]; }
  }
  Not.PINS = [[0, 0], [3, 0]];
  reg(Not);
  class Buf extends Not {
    static type = 'buf'; static title = 'Buffer';
    init() { super.init(); this.inv = false; }
  }
  reg(Buf);

  class LogicIn extends LogicElm {
    static type = 'in'; static title = 'Logic input';
    static props = [{ k: 'on', label: 'High (1)', type: 'bool', def: false }];
    init() { this.setIO([], [0]); }
    pins() { return LogicIn.PINS; }
    bbox() { return [0, -11, 32, 11]; }
    toggle() { this.p.on = !this.p.on; }
    beginStep() { this.outv[0] = !!this.p.on; }
    draw(ctx, st) {
      const on = !!this.p.on; line(ctx, 22, 0, 32, 0);
      ctx.fillStyle = on ? st.th.lit : st.th.chip; ctx.beginPath(); ctx.rect(0, -10, 22, 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? '#fff' : st.th.text; ctx.font = 'bold 12px system-ui, sans-serif'; this.ctext(ctx, on ? '1' : '0', 11, 0.5);
    }
    info() { return ['Click to toggle']; }
  }
  LogicIn.PINS = [[2, 0]];
  reg(LogicIn);

  class Clock extends LogicElm {
    static type = 'clk'; static title = 'Clock';
    static props = [{ k: 'f', label: 'Frequency', unit: 'Hz', def: 1, min: 0 }];
    init() { this.setIO([], [0]); }
    pins() { return LogicIn.PINS; }
    bbox() { return [0, -11, 32, 11]; }
    beginStep(sim) { const ph = sim.tn * this.p.f; this.outv[0] = ph - Math.floor(ph) < 0.5; }
    draw(ctx, st) {
      const on = st.live && this.outv[0]; line(ctx, 22, 0, 32, 0);
      ctx.fillStyle = on ? st.th.lit : st.th.chip; ctx.beginPath(); ctx.rect(0, -10, 22, 20); ctx.fill(); ctx.stroke();
      ctx.save(); if (on) ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(4, -4); ctx.lineTo(11, -4); ctx.lineTo(11, 4); ctx.lineTo(18, 4); ctx.lineTo(18, -4); ctx.stroke(); ctx.restore();
      this.label(ctx, fmt(this.p.f, 'Hz'), 11, -18);
    }
  }
  reg(Clock);

  class LogicOut extends LogicElm {
    static type = 'out'; static title = 'Logic indicator';
    static props = [{ k: 'name', label: 'Label', type: 'text', def: '' }];
    init() { this.setIO([0], []); }
    pins() { return ONE; }
    bbox() { return [0, -11, 31, 11]; }
    draw(ctx, st) {
      const on = this.hi(st, 0); line(ctx, 0, 0, 10, 0);
      ctx.fillStyle = on ? st.th.lit : st.th.chip; circle(ctx, 20, 0, 10, true);
      ctx.fillStyle = on ? '#fff' : st.th.text; ctx.font = 'bold 11px system-ui, sans-serif'; this.ctext(ctx, on ? '1' : '0', 20, 0.5);
      if (this.p.name) { ctx.fillStyle = st.th.text; ctx.font = '11px system-ui, sans-serif'; this.label(ctx, this.p.name, 20, -18); }
    }
    info(sim) { return ['Level = ' + (this.rd(sim, 0) ? '1' : '0'), 'V = ' + fmt(sim.v[this.nodes[0]], 'V')]; }
  }
  reg(LogicOut);

  /* --- seven-segment rendering --- */
  function drawDigit(ctx, cx, cy, h, on, onCol, offCol) {
    const w = h / 2, x0 = cx - w / 2, x1 = cx + w / 2, yT = cy - h / 2, yB = cy + h / 2, g = h / 14;
    const S = [[x0 + g, yT, x1 - g, yT], [x1, yT + g, x1, cy - g], [x1, cy + g, x1, yB - g], [x0 + g, yB, x1 - g, yB],
      [x0, cy + g, x0, yB - g], [x0, yT + g, x0, cy - g], [x0 + g, cy, x1 - g, cy]];
    ctx.save(); ctx.lineWidth = h / 9; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = on[i] ? onCol : offCol; line(ctx, S[i][0], S[i][1], S[i][2], S[i][3]); }
    ctx.restore();
  }
  const HEXSEG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg', 'abcefg', 'cdefg', 'adef', 'bcdeg', 'adefg', 'aefg'];
  const segMask = s => 'abcdefg'.split('').map(c => s.indexOf(c) >= 0);

  class SevenSeg extends LogicElm {
    static type = 'seg7'; static title = '7-segment display';
    static props = [{ k: 'low', label: 'Active low (common anode)', type: 'bool', def: false }];
    init() { this.setIO([0, 1, 2, 3, 4, 5, 6], []); this.seg = [0, 0, 0, 0, 0, 0, 0]; }
    reset() { if (this.seg) this.seg.fill(0); }
    pins() { return SevenSeg.PINS; }
    bbox() { return [0, -12, 76, 108]; }
    accept(sim) { for (let i = 0; i < 7; i++) this.seg[i] = this.conn[i] && (sim.v[this.nodes[i]] > VTH) !== !!this.p.low; }
    draw(ctx, st) {
      ctx.beginPath(); for (let i = 0; i < 7; i++) { ctx.moveTo(0, i * U); ctx.lineTo(10, i * U); } ctx.stroke();
      ctx.fillStyle = st.th.chip; ctx.beginPath(); ctx.rect(10, -10, 64, 116); ctx.fill(); ctx.stroke();
      ctx.fillStyle = st.th.text; ctx.font = '9px system-ui, sans-serif';
      if (!CL.noLabels) for (let i = 0; i < 7; i++) this.ctext(ctx, 'abcdefg'[i], 16, i * U);
      drawDigit(ctx, 48, 48, 64, st.live ? this.seg : [], st.th.lit, st.th.segOff);
    }
  }
  SevenSeg.PINS = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]];
  reg(SevenSeg);

  class HexDisp extends LogicElm {
    static type = 'hex'; static title = 'Hex display';
    init() { this.setIO([0, 1, 2, 3], []); this.val = 0; }
    reset() { this.val = 0; }
    pins() { return HexDisp.PINS; }
    bbox() { return [0, -12, 60, 60]; }
    accept(sim) { let v = 0; for (let i = 0; i < 4; i++) if (this.rd(sim, i)) v |= 1 << i; this.val = v; }
    draw(ctx, st) {
      ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(0, i * U); ctx.lineTo(10, i * U); } ctx.stroke();
      ctx.fillStyle = st.th.chip; ctx.beginPath(); ctx.rect(10, -10, 48, 68); ctx.fill(); ctx.stroke();
      ctx.fillStyle = st.th.text; ctx.font = '9px system-ui, sans-serif';
      if (!CL.noLabels) for (let i = 0; i < 4; i++) this.ctext(ctx, '1248'[i], 16, i * U);
      drawDigit(ctx, 39, 24, 44, st.live ? segMask(HEXSEG[this.val]) : [], st.th.lit, st.th.segOff);
    }
    info() { return ['Value = ' + this.val + ' (0x' + this.val.toString(16).toUpperCase() + ')']; }
  }
  HexDisp.PINS = [[0, 0], [0, 1], [0, 2], [0, 3]];
  reg(HexDisp);

  /* ---------------- chip framework ---------------- */
  function dipLayout(names) {
    const n = names.length, h = n / 2, pins = [];
    for (let i = 0; i < n; i++) pins.push(i < h ? { name: names[i], x: 0, y: i, num: i + 1 } : { name: names[i], x: 6, y: n - 1 - i, num: i + 1 });
    return { w: 6, rows: h, pins, dip: true };
  }
  function symLayout(left, right, w) {
    const pins = [];
    left.forEach((nm, i) => { if (nm) pins.push({ name: nm, x: 0, y: i }); });
    right.forEach((nm, i) => { if (nm) pins.push({ name: nm, x: w, y: i }); });
    return { w, rows: Math.max(left.length, right.length, 1), pins, dip: false };
  }
  function layoutOf(spec) {
    if (!spec._layout) {
      if (spec.pins) spec._layout = dipLayout(spec.pins);
      else {
        const longest = (spec.left || []).concat(spec.right || []).reduce((m, s) => Math.max(m, s ? s.length : 0), 0);
        spec._layout = symLayout(spec.left || [], spec.right || [], spec.w || Math.max(4, Math.min(8, 3 + Math.ceil(longest * 0.8))));
      }
    }
    return spec._layout;
  }
  function ptext(ctx, e, s, x, y, align) {
    let over = false; if (s[0] === '~') { over = true; s = s.slice(1); }
    ctx.save(); ctx.translate(x, y);
    if (e.rot === 2) { ctx.rotate(Math.PI); align = align === 'left' ? 'right' : align === 'right' ? 'left' : align; }
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 0);
    if (over) {
      const w = ctx.measureText(s).width, xa = align === 'left' ? 0 : align === 'right' ? -w : -w / 2;
      ctx.lineWidth = 0.8; ctx.strokeStyle = ctx.fillStyle; ctx.beginPath(); ctx.moveTo(xa, -6); ctx.lineTo(xa + w, -6); ctx.stroke();
    }
    ctx.restore();
  }
  function drawChip(ctx, e, L, title, st) {
    const th = st.th, W = L.w * U, x0 = 10, x1 = W - 10, y0 = -10, y1 = (L.rows - 1) * U + 10;
    ctx.beginPath();
    for (const p of L.pins) { const y = p.y * U; if (p.x === 0) { ctx.moveTo(0, y); ctx.lineTo(x0, y); } else { ctx.moveTo(W, y); ctx.lineTo(x1, y); } }
    ctx.stroke();
    ctx.fillStyle = th.chip; ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.fill(); ctx.stroke();
    if (L.dip) { ctx.beginPath(); ctx.arc(W / 2, y0, 5, 0, Math.PI); ctx.stroke(); }
    if (CL.noLabels) return;
    for (let i = 0; i < L.pins.length; i++) {
      const p = L.pins[i], y = p.y * U, left = p.x === 0;
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillStyle = st.live && e.conn[i] && st.sim.v[e.nodes[i]] > VTH ? th.lit : th.text;
      ptext(ctx, e, p.name, left ? x0 + 3 : x1 - 3, y, left ? 'left' : 'right');
      if (L.dip) { ctx.font = '7px system-ui, sans-serif'; ctx.fillStyle = th.dim; ptext(ctx, e, String(p.num), left ? 4 : W - 4, y - 5, 'center'); }
    }
    ctx.fillStyle = th.text; ctx.font = 'bold 10px system-ui, sans-serif';
    e.ctext(ctx, title, W / 2, y0 - 8);
  }

  CL.chips = {};
  CL.customDefs = {};
  const POWER = { VCC: 1, GND: 1, NC: 1 };
  const UNKNOWN = { title: '?', left: [], right: [], out: [], eval() {} };

  /* Family and package variants share one model: 74LS00N, SN74HC00, 74HCT00 ... -> 7400 */
  const FAMILY = /^(?:sn|dm|mc|hd)?74(?:ls|hct|hc|als|as|ahct|ahc|act|ac|lvc|f|s|l|h|c)(\d{0,5})[a-z]*$/i;
  CL.chipId = function (name) {
    name = String(name).trim();
    if (CL.chips[name]) return name;
    const m = FAMILY.exec(name);
    if (m && CL.chips['74' + m[1]]) return '74' + m[1];
    if (/^(?:ne|lm|se|sa|tlc|lmc|icm)?7?555[a-z]*$/i.test(name)) return '555';
    return name;
  };
  /* what a typed search term should also match, e.g. "74ls0" -> "740" */
  CL.partAlias = function (q) {
    const m = FAMILY.exec(q.trim());
    if (m) return '74' + m[1];
    return /^(?:ne|lm|se|sa|tlc|lmc|icm)7?555[a-z]*$/i.test(q.trim()) ? '555' : null;
  };
  CL.chipFamilies = function (id) { const m = /^74(\d+)$/.exec(id); return m ? ' (74LS' + m[1] + ', 74HC' + m[1] + ')' : ''; };

  class Chip extends LogicElm {
    static type = 'ic'; static title = 'IC';
    static props = [{ k: 'chip', label: 'Chip', type: 'hidden', def: '7400' }];
    init() {
      this.p.chip = CL.chipId(this.p.chip);
      const spec = this.spec = CL.chips[this.p.chip] || UNKNOWN, L = this.L = layoutOf(spec);
      const outSet = new Set(spec.out || spec.right || []), ins = [], outs = [];
      this.inNames = []; this.outNames = []; this.floatLvl = [];
      L.pins.forEach((p, i) => {
        if (POWER[p.name]) return;
        if (outSet.has(p.name)) { outs.push(i); this.outNames.push(p.name); }
        else {
          ins.push(i); this.inNames.push(p.name);
          this.floatLvl.push(spec.float && p.name in spec.float ? !!spec.float[p.name] : p.name[0] === '~');
        }
      });
      this.setIO(ins, outs); this.pinList = L.pins.map(p => [p.x, p.y]);
      this.iv = {}; this.ov = {}; this.s = {};
    }
    get title() { return (this.spec.custom ? 'Custom IC ' : '') + this.p.chip + CL.chipFamilies(this.p.chip) + (this.spec.desc ? ' — ' + this.spec.desc : ''); }
    reset() { super.reset(); this.s = {}; this.ov = {}; }
    pins() { return this.pinList; }
    bbox() { return [0, -24, this.L.w * U, (this.L.rows - 1) * U + 12]; }
    accept(sim) {
      const ins = this.ins, iv = this.iv, ov = this.ov, jit = !!this.spec.comb;
      for (let k = 0; k < ins.length; k++) iv[this.inNames[k]] = this.rd(sim, ins[k], this.floatLvl[k]);
      this.spec.eval(iv, this.s, ov);
      for (let k = 0; k < this.outs.length; k++) this.setOut(k, ov[this.outNames[k]], jit);
    }
    draw(ctx, st) { drawChip(ctx, this, this.L, this.p.chip, st); }
    info() { return this.outNames.map((n, k) => n.replace('~', '¬') + ' = ' + (this.outv[k] ? '1' : '0')); }
  }
  reg(Chip);

  /* ---------------- built-in chips ---------------- */
  const def = (id, desc, spec) => { spec.desc = desc; CL.chips[id] = spec; };
  const QUADPINS = ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'];
  const QUADOUT = ['1Y', '2Y', '3Y', '4Y'];
  const quad = fn => (i, s, o) => { for (const k of '1234') o[k + 'Y'] = fn(i[k + 'A'], i[k + 'B']); };
  const bits = (i, names) => names.reduce((v, n, k) => v | (i[n] ? 1 << k : 0), 0);

  def('7400', 'Quad 2-input NAND', { pins: QUADPINS, out: QUADOUT, comb: true, eval: quad((a, b) => !(a && b)) });
  def('7402', 'Quad 2-input NOR', { pins: ['1Y', '1A', '1B', '2Y', '2A', '2B', 'GND', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC'], out: QUADOUT, comb: true, eval: quad((a, b) => !(a || b)) });
  def('7404', 'Hex inverter', { pins: ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'], out: ['1Y', '2Y', '3Y', '4Y', '5Y', '6Y'], comb: true,
    eval(i, s, o) { for (const k of '123456') o[k + 'Y'] = !i[k + 'A']; } });
  def('7408', 'Quad 2-input AND', { pins: QUADPINS, out: QUADOUT, comb: true, eval: quad((a, b) => a && b) });
  def('7410', 'Triple 3-input NAND', { pins: ['1A', '1B', '2A', '2B', '2C', '2Y', 'GND', '3Y', '3A', '3B', '3C', '1Y', '1C', 'VCC'], out: ['1Y', '2Y', '3Y'], comb: true,
    eval(i, s, o) { for (const k of '123') o[k + 'Y'] = !(i[k + 'A'] && i[k + 'B'] && i[k + 'C']); } });
  def('7420', 'Dual 4-input NAND', { pins: ['1A', '1B', 'NC', '1C', '1D', '1Y', 'GND', '2Y', '2A', '2B', 'NC', '2C', '2D', 'VCC'], out: ['1Y', '2Y'], comb: true,
    eval(i, s, o) { for (const k of '12') o[k + 'Y'] = !(i[k + 'A'] && i[k + 'B'] && i[k + 'C'] && i[k + 'D']); } });
  def('7432', 'Quad 2-input OR', { pins: QUADPINS, out: QUADOUT, comb: true, eval: quad((a, b) => a || b) });
  def('7486', 'Quad 2-input XOR', { pins: QUADPINS, out: QUADOUT, comb: true, eval: quad((a, b) => a !== b) });

  def('7474', 'Dual D flip-flop (rising edge)', {
    pins: ['~1CLR', '1D', '1CLK', '~1PRE', '1Q', '~1Q', 'GND', '~2Q', '2Q', '~2PRE', '2CLK', '2D', '~2CLR', 'VCC'], out: ['1Q', '~1Q', '2Q', '~2Q'],
    eval(i, s, o) {
      for (const k of '12') {
        const pre = !i['~' + k + 'PRE'], clr = !i['~' + k + 'CLR'], clk = i[k + 'CLK']; let q = !!s['q' + k];
        if (pre) q = true; else if (clr) q = false; else if (clk && s['c' + k] === false) q = i[k + 'D'];
        s['c' + k] = clk; s['q' + k] = q; o[k + 'Q'] = q || pre; o['~' + k + 'Q'] = !q || (pre && clr);
      }
    }
  });
  def('7476', 'Dual JK flip-flop (falling edge)', {
    pins: ['1CLK', '~1PRE', '~1CLR', '1J', 'VCC', '2CLK', '~2PRE', '~2CLR', '2J', '~2Q', '2Q', '2K', 'GND', '~1Q', '1Q', '1K'], out: ['1Q', '~1Q', '2Q', '~2Q'],
    eval(i, s, o) {
      for (const k of '12') {
        const pre = !i['~' + k + 'PRE'], clr = !i['~' + k + 'CLR'], clk = i[k + 'CLK'], j = i[k + 'J'], kk = i[k + 'K']; let q = !!s['q' + k];
        if (pre) q = true; else if (clr) q = false; else if (!clk && s['c' + k]) q = j && kk ? !q : j ? true : kk ? false : q;
        s['c' + k] = clk; s['q' + k] = q; o[k + 'Q'] = q || pre; o['~' + k + 'Q'] = !q || (pre && clr);
      }
    }
  });
  def('7483', '4-bit binary adder', {
    pins: ['A4', 'S3', 'A3', 'B3', 'VCC', 'S2', 'B2', 'A2', 'S1', 'A1', 'B1', 'GND', 'C0', 'C4', 'S4', 'B4'], out: ['S1', 'S2', 'S3', 'S4', 'C4'], comb: true,
    eval(i, s, o) {
      const sum = bits(i, ['A1', 'A2', 'A3', 'A4']) + bits(i, ['B1', 'B2', 'B3', 'B4']) + (i.C0 ? 1 : 0);
      o.S1 = sum & 1; o.S2 = sum & 2; o.S3 = sum & 4; o.S4 = sum & 8; o.C4 = sum & 16;
    }
  });
  def('7485', '4-bit magnitude comparator', {
    pins: ['B3', 'IA<B', 'IA=B', 'IA>B', 'A>B', 'A=B', 'A<B', 'GND', 'B0', 'A0', 'B1', 'A1', 'A2', 'B2', 'A3', 'VCC'], out: ['A>B', 'A=B', 'A<B'], comb: true,
    float: { 'IA=B': 1 },
    eval(i, s, o) {
      const a = bits(i, ['A0', 'A1', 'A2', 'A3']), b = bits(i, ['B0', 'B1', 'B2', 'B3']), g = i['IA>B'], l = i['IA<B'], e = i['IA=B'];
      if (a > b) { o['A>B'] = 1; o['A<B'] = 0; o['A=B'] = 0; }
      else if (a < b) { o['A>B'] = 0; o['A<B'] = 1; o['A=B'] = 0; }
      else if (e) { o['A>B'] = 0; o['A<B'] = 0; o['A=B'] = 1; }
      else { o['A=B'] = 0; o['A>B'] = g === l ? !g : g; o['A<B'] = g === l ? !g : l; }
    }
  });
  const ripple = mod => function (i, s, o) {
    let qa = !!s.qa, n = s.n | 0;
    const r0 = i['R0(1)'] && i['R0(2)'], r9 = mod === 5 && i['R9(1)'] && i['R9(2)'];
    if (r9) { qa = true; n = 4; } else if (r0) { qa = false; n = 0; }
    else { if (!i.CKA && s.ca) qa = !qa; if (!i.CKB && s.cb) n = (n + 1) % mod; }
    s.ca = i.CKA; s.cb = i.CKB; s.qa = qa; s.n = n;
    o.QA = qa; o.QB = n & 1; o.QC = n & 2; o.QD = n & 4;
  };
  def('7490', 'Decade counter (falling edge)', { pins: ['CKB', 'R0(1)', 'R0(2)', 'NC', 'VCC', 'R9(1)', 'R9(2)', 'QC', 'QB', 'GND', 'QD', 'QA', 'NC', 'CKA'], out: ['QA', 'QB', 'QC', 'QD'], eval: ripple(5) });
  def('7493', '4-bit binary counter (falling edge)', { pins: ['CKB', 'R0(1)', 'R0(2)', 'NC', 'VCC', 'NC', 'NC', 'QC', 'QB', 'GND', 'QD', 'QA', 'NC', 'CKA'], out: ['QA', 'QB', 'QC', 'QD'], eval: ripple(8) });
  def('74138', '3-to-8 line decoder', {
    pins: ['A', 'B', 'C', '~G2A', '~G2B', 'G1', '~Y7', 'GND', '~Y6', '~Y5', '~Y4', '~Y3', '~Y2', '~Y1', '~Y0', 'VCC'],
    out: ['~Y0', '~Y1', '~Y2', '~Y3', '~Y4', '~Y5', '~Y6', '~Y7'], comb: true, float: { '~G2A': 0, '~G2B': 0, G1: 1 },
    eval(i, s, o) { const en = i.G1 && !i['~G2A'] && !i['~G2B'], sel = bits(i, ['A', 'B', 'C']); for (let k = 0; k < 8; k++) o['~Y' + k] = !(en && sel === k); }
  });
  def('74151', '8-to-1 multiplexer', {
    pins: ['D3', 'D2', 'D1', 'D0', 'Y', '~W', '~G', 'GND', 'C', 'B', 'A', 'D7', 'D6', 'D5', 'D4', 'VCC'], out: ['Y', '~W'], comb: true, float: { '~G': 0 },
    eval(i, s, o) { const y = !i['~G'] && i['D' + bits(i, ['A', 'B', 'C'])]; o.Y = y; o['~W'] = !y; }
  });
  def('74161', '4-bit synchronous counter', {
    pins: ['~CLR', 'CLK', 'A', 'B', 'C', 'D', 'ENP', 'GND', '~LOAD', 'ENT', 'QD', 'QC', 'QB', 'QA', 'RCO', 'VCC'], out: ['QA', 'QB', 'QC', 'QD', 'RCO'], float: { ENP: 1, ENT: 1 },
    eval(i, s, o) {
      let n = s.n | 0;
      if (!i['~CLR']) n = 0;
      else if (i.CLK && s.c === false) { if (!i['~LOAD']) n = bits(i, ['A', 'B', 'C', 'D']); else if (i.ENP && i.ENT) n = (n + 1) & 15; }
      s.c = i.CLK; s.n = n; o.QA = n & 1; o.QB = n & 2; o.QC = n & 4; o.QD = n & 8; o.RCO = n === 15 && i.ENT;
    }
  });
  def('74164', '8-bit shift register (serial in, parallel out)', {
    pins: ['A', 'B', 'QA', 'QB', 'QC', 'QD', 'GND', 'CLK', '~CLR', 'QE', 'QF', 'QG', 'QH', 'VCC'], out: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'], float: { A: 1, B: 1 },
    eval(i, s, o) {
      let n = s.n | 0;
      if (!i['~CLR']) n = 0; else if (i.CLK && s.c === false) n = ((n << 1) | (i.A && i.B ? 1 : 0)) & 255;
      s.c = i.CLK; s.n = n; 'ABCDEFGH'.split('').forEach((c, k) => { o['Q' + c] = n & (1 << k); });
    }
  });
  const BCDSEG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'cdefg', 'abc', 'abcdefg', 'abcfg', 'deg', 'cdg', 'bfg', 'adfg', 'defg', ''];
  const bcd = activeLow => function (i, s, o) {
    const n = bits(i, ['A', 'B', 'C', 'D']); let seg = BCDSEG[n];
    if (!i['~LT']) seg = 'abcdefg';
    if (!i['~BI/RBO'] || (!i['~RBI'] && n === 0 && i['~LT'])) seg = '';
    for (const c of 'abcdefg') o[c] = (seg.indexOf(c) >= 0) !== activeLow;
  };
  const BCDPINS = ['B', 'C', '~LT', '~BI/RBO', '~RBI', 'D', 'A', 'GND', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VCC'], SEGS = 'abcdefg'.split('');
  def('7447', 'BCD to 7-segment decoder (active-low outputs)', { pins: BCDPINS, out: SEGS, comb: true, eval: bcd(true) });
  def('7448', 'BCD to 7-segment decoder (active-high outputs)', { pins: BCDPINS, out: SEGS, comb: true, eval: bcd(false) });

  def('DFF', 'D flip-flop (rising edge)', { sym: true, left: ['D', null, 'CLK'], right: ['Q', null, '~Q'], w: 4, out: ['Q', '~Q'],
    eval(i, s, o) { if (i.CLK && s.c === false) s.q = i.D; s.c = i.CLK; o.Q = s.q; o['~Q'] = !s.q; } });
  def('JKFF', 'JK flip-flop (rising edge)', { sym: true, left: ['J', 'CLK', 'K'], right: ['Q', null, '~Q'], w: 4, out: ['Q', '~Q'],
    eval(i, s, o) { if (i.CLK && s.c === false) s.q = i.J && i.K ? !s.q : i.J ? true : i.K ? false : !!s.q; s.c = i.CLK; o.Q = s.q; o['~Q'] = !s.q; } });
  def('TFF', 'T flip-flop (rising edge)', { sym: true, left: ['T', null, 'CLK'], right: ['Q', null, '~Q'], w: 4, out: ['Q', '~Q'],
    eval(i, s, o) { if (i.CLK && s.c === false && i.T) s.q = !s.q; s.c = i.CLK; o.Q = s.q; o['~Q'] = !s.q; } });

  /* ---------------- 555 timer ---------------- */
  const L555 = dipLayout(['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC']);
  class Timer555 extends Elm {
    static type = '555'; static title = '555 timer';
    pins() { return Timer555.PINS; }
    bbox() { return [0, -24, 96, 60]; }
    reset() { this.out = false; this.vcc = 0; }
    stamp(sim) {
      const n = this.nodes, g = n[0];
      sim.stampG(n[7], n[4], 1 / 5000); sim.stampG(n[4], g, 1 / 10000);
      sim.stampG(n[2], g, 0.1);
      if (this.out) sim.stampI(g, n[2], Math.max(0, this.vcc - 1.3) * 0.1); else sim.stampG(n[6], g, 0.1);
    }
    accept(sim) {
      const v = sim.v, n = this.nodes, vg = v[n[0]], ctrl = v[n[4]] - vg; this.vcc = v[n[7]] - vg;
      let o = this.out;
      if (this.conn[3] && v[n[3]] - vg < 0.7) o = false;
      else if (v[n[1]] - vg < ctrl / 2) o = true;
      else if (v[n[5]] - vg > ctrl) o = false;
      if (this.vcc < 1) o = false;
      if (o !== this.out) { this.out = o; sim.invalidate(); }
    }
    draw(ctx, st) { drawChip(ctx, this, L555, '555', { th: st.th, live: false }); }
    info(sim) { return ['Output = ' + (this.out ? 'high' : 'low'), 'Vcc = ' + fmt(this.vcc, 'V')]; }
  }
  Timer555.PINS = L555.pins.map(p => [p.x, p.y]);
  reg(Timer555);

  /* ---------------- custom ICs (boolean expressions) ---------------- */
  function compileExpr(src, inputs) {
    const toks = []; const re = /\s*([A-Za-z_][A-Za-z0-9_]*|[01]|[!~&*|+^()'])/y; let pos = 0, m;
    while (pos < src.length) {
      if (/^\s*$/.test(src.slice(pos))) break;
      re.lastIndex = pos; m = re.exec(src);
      if (!m) throw new Error('Unexpected character "' + src.slice(pos).trim()[0] + '" in "' + src + '"');
      toks.push(m[1]); pos = re.lastIndex;
    }
    let k = 0;
    const peek = () => toks[k], eat = () => toks[k++];
    function primary() {
      const t = eat();
      if (t === undefined) throw new Error('Expression "' + src + '" ends unexpectedly');
      if (t === '(') { const e = or(); if (eat() !== ')') throw new Error('Missing ")" in "' + src + '"'); return e; }
      if (t === '0') return () => false;
      if (t === '1') return () => true;
      if (/^[A-Za-z_]/.test(t)) { if (inputs.indexOf(t) < 0) throw new Error('"' + t + '" is not an input pin'); return i => !!i[t]; }
      throw new Error('Unexpected "' + t + '" in "' + src + '"');
    }
    function not() {
      if (peek() === '!' || peek() === '~') { eat(); const e = not(); return i => !e(i); }
      let e = primary();
      while (peek() === "'") { eat(); const f = e; e = i => !f(i); }
      return e;
    }
    function and() { let e = not(); while (peek() === '&' || peek() === '*') { eat(); const a = e, b = not(); e = i => a(i) && b(i); } return e; }
    function xor() { let e = and(); while (peek() === '^') { eat(); const a = e, b = and(); e = i => a(i) !== b(i); } return e; }
    function or() { let e = xor(); while (peek() === '|' || peek() === '+') { eat(); const a = e, b = xor(); e = i => a(i) || b(i); } return e; }
    const e = or();
    if (k < toks.length) throw new Error('Unexpected "' + toks[k] + '" in "' + src + '"');
    return e;
  }
  CL.compileExpr = compileExpr;

  /* def = { name, inputs: ['A','B'], outputs: [{ name: 'Y', expr: 'A & B' }] } */
  CL.addCustomIC = function (d) {
    const ok = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!d || typeof d.name !== 'string' || !/^[A-Za-z0-9_\-]{1,16}$/.test(d.name)) throw new Error('Name must be 1–16 letters, digits, "-" or "_"');
    if (CL.chips[d.name] && !CL.chips[d.name].custom) throw new Error('"' + d.name + '" is a built-in chip name');
    if (!Array.isArray(d.inputs) || !d.inputs.length) throw new Error('Add at least one input pin');
    if (!Array.isArray(d.outputs) || !d.outputs.length) throw new Error('Add at least one output');
    const seen = new Set();
    for (const n of d.inputs.concat(d.outputs.map(o => o.name))) {
      if (!ok.test(n)) throw new Error('Invalid pin name "' + n + '"');
      if (seen.has(n)) throw new Error('Duplicate pin name "' + n + '"');
      seen.add(n);
    }
    const fns = d.outputs.map(o => compileExpr(String(o.expr), d.inputs));
    const clean = { name: d.name, inputs: d.inputs.slice(), outputs: d.outputs.map(o => ({ name: o.name, expr: String(o.expr) })) };
    CL.customDefs[d.name] = clean;
    CL.chips[d.name] = {
      custom: true, comb: true, desc: 'custom logic', left: clean.inputs, right: clean.outputs.map(o => o.name),
      eval(i, s, o) { for (let k = 0; k < fns.length; k++) o[clean.outputs[k].name] = fns[k](i); }
    };
    return clean;
  };
  CL.removeCustomIC = function (name) { if (CL.chips[name] && CL.chips[name].custom) { delete CL.chips[name]; delete CL.customDefs[name]; } };
})(typeof window !== 'undefined' ? window : globalThis);
