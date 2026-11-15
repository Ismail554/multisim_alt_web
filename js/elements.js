/* CircuitBench — analog components and instruments */
(function (G) {
  'use strict';
  const CL = G.CL, U = CL.U, Elm = CL.Elm, fmt = CL.fmt, reg = CL.reg;
  const VT = 0.025865;
  const ex = x => Math.exp(x > 80 ? 80 : x);

  function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); if (fill) ctx.fill(); ctx.stroke(); }
  function arrow(ctx, x1, y1, x2, y2, s) {
    const a = Math.atan2(y2 - y1, x2 - x1); s = s || 6;
    ctx.save(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
    ctx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  CL.draw = { line, circle, arrow };

  /* SPICE-style junction voltage limiting */
  function pnj(vnew, vold, vt, vcrit) {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
      if (vold > 0) { const arg = 1 + (vnew - vold) / vt; vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit; }
      else vnew = vt * Math.log(vnew / vt);
    }
    return vnew;
  }
  const vcritOf = (vt, is) => vt * Math.log(vt / (Math.SQRT2 * is));

  class TwoTerm extends Elm {
    vd(sim) { return sim.v[this.nodes[0]] - sim.v[this.nodes[1]]; }
  }

  /* ---------------- passive ---------------- */
  class Resistor extends TwoTerm {
    static type = 'r'; static title = 'Resistor';
    static props = [{ k: 'r', label: 'Resistance', unit: 'Ω', def: 1000, min: 1e-6 }];
    stamp(sim) { sim.stampG(this.nodes[0], this.nodes[1], 1 / this.p.r); }
    draw(ctx) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 0);
      for (let i = 0; i < 6; i++) ctx.lineTo(16 + (i + 0.5) * 32 / 6, i % 2 ? 6 : -6);
      ctx.lineTo(48, 0); ctx.lineTo(64, 0); ctx.stroke();
      this.label(ctx, fmt(this.p.r, 'Ω'), 32, -15);
    }
    info(sim) { const v = this.vd(sim), i = v / this.p.r; return ['V = ' + fmt(v, 'V'), 'I = ' + fmt(i, 'A'), 'P = ' + fmt(v * i, 'W')]; }
  }
  reg(Resistor);

  class Capacitor extends TwoTerm {
    static type = 'c'; static title = 'Capacitor';
    static props = [{ k: 'c', label: 'Capacitance', unit: 'F', def: 1e-6, min: 1e-15 }];
    reset() { this.vp = 0; this.ip = 0; this.g = 0; this.ieq = 0; }
    beginStep(sim) { this.g = 2 * this.p.c / sim.dt; this.ieq = -this.g * this.vp - this.ip; }
    stamp(sim) { sim.stampG(this.nodes[0], this.nodes[1], this.g); sim.stampI(this.nodes[0], this.nodes[1], this.ieq); }
    accept(sim) { const v = this.vd(sim); this.ip = this.g * v + this.ieq; this.vp = v; }
    draw(ctx) {
      line(ctx, 0, 0, 28, 0); line(ctx, 36, 0, 64, 0);
      ctx.save(); ctx.lineWidth = 2.4; line(ctx, 28, -10, 28, 10); line(ctx, 36, -10, 36, 10); ctx.restore();
      this.label(ctx, fmt(this.p.c, 'F'), 32, -18);
    }
    info() { return ['V = ' + fmt(this.vp, 'V'), 'I = ' + fmt(this.ip, 'A')]; }
  }
  reg(Capacitor);

  class Inductor extends TwoTerm {
    static type = 'l'; static title = 'Inductor';
    static props = [{ k: 'l', label: 'Inductance', unit: 'H', def: 1e-3, min: 1e-12 }];
    reset() { this.vp = 0; this.ip = 0; this.g = 0; this.ieq = 0; }
    beginStep(sim) { this.g = sim.dt / (2 * this.p.l); this.ieq = this.ip + this.g * this.vp; }
    stamp(sim) { sim.stampG(this.nodes[0], this.nodes[1], this.g); sim.stampI(this.nodes[0], this.nodes[1], this.ieq); }
    accept(sim) { const v = this.vd(sim); this.ip = this.g * v + this.ieq; this.vp = v; }
    draw(ctx) {
      line(ctx, 0, 0, 16, 0); line(ctx, 48, 0, 64, 0);
      ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.arc(20 + i * 8, 0, 4, Math.PI, 0); ctx.stroke();
      this.label(ctx, fmt(this.p.l, 'H'), 32, -14);
    }
    info() { return ['V = ' + fmt(this.vp, 'V'), 'I = ' + fmt(this.ip, 'A')]; }
  }
  reg(Inductor);

  class Switch extends TwoTerm {
    static type = 'sw'; static title = 'Switch';
    static props = [{ k: 'closed', label: 'Closed', type: 'bool', def: false }];
    stamp(sim) { if (this.p.closed) sim.stampG(this.nodes[0], this.nodes[1], 100); }
    toggle() { this.p.closed = !this.p.closed; }
    draw(ctx) {
      line(ctx, 0, 0, 16, 0); line(ctx, 48, 0, 64, 0);
      if (this.p.closed) line(ctx, 16, 0, 48, 0); else line(ctx, 16, 0, 45, -13);
      ctx.save(); ctx.fillStyle = ctx.strokeStyle; circle(ctx, 16, 0, 2, true); circle(ctx, 48, 0, 2, true); ctx.restore();
    }
    bbox() { return [0, -16, 64, 8]; }
    info(sim) { return [this.p.closed ? 'Closed' : 'Open', 'V = ' + fmt(this.vd(sim), 'V')]; }
  }
  reg(Switch);

  class Pot extends Elm {
    static type = 'pot'; static title = 'Potentiometer';
    static props = [{ k: 'r', label: 'Resistance', unit: 'Ω', def: 10000, min: 1e-3 },
      { k: 'pos', label: 'Wiper position', type: 'range', def: 0.5 }];
    pins() { return Pot.PINS; }
    bbox() { return [0, -10, 64, 34]; }
    stamp(sim) {
      const k = Math.min(0.999, Math.max(0.001, this.p.pos)), r = this.p.r;
      sim.stampG(this.nodes[0], this.nodes[2], 1 / (r * k)); sim.stampG(this.nodes[2], this.nodes[1], 1 / (r * (1 - k)));
    }
    draw(ctx) {
      Resistor.prototype.draw.call({ p: this.p, label() {} }, ctx);
      line(ctx, 32, 32, 32, 12); arrow(ctx, 32, 20, 32, 9, 6);
      this.label(ctx, fmt(this.p.r, 'Ω') + ' ' + Math.round(this.p.pos * 100) + '%', 32, -15);
    }
    info(sim) { return ['Wiper = ' + fmt(sim.v[this.nodes[2]], 'V')]; }
  }
  Pot.PINS = [[0, 0], [4, 0], [2, 2]];
  reg(Pot);

  /* ---------------- sources ---------------- */
  class VSource extends TwoTerm {
    static type = 'vdc'; static title = 'DC voltage source';
    static props = [{ k: 'v', label: 'Voltage', unit: 'V', def: 5 }];
    init() { this.vsCount = 1; }
    value() { return this.p.v; }
    stamp(sim) { sim.stampVS(this.nodes[0], this.nodes[1], this.vsIdx, this.value(sim.tn)); }
    draw(ctx) {
      line(ctx, 0, 0, 28, 0); line(ctx, 36, 0, 64, 0);
      line(ctx, 28, -12, 28, 12); ctx.save(); ctx.lineWidth = 3.2; line(ctx, 36, -6, 36, 6); ctx.restore();
      this.ctext(ctx, '+', 19, -9);
      this.label(ctx, fmt(this.p.v, 'V'), 32, -20);
    }
    bbox() { return [0, -14, 64, 14]; }
    info(sim) { return ['V = ' + fmt(this.vd(sim), 'V'), 'I = ' + fmt(-sim.x[sim.row(this)], 'A')]; }
  }
  reg(VSource);

  class ACSource extends VSource {
    static type = 'vac'; static title = 'Function generator';
    static props = [{ k: 'wave', label: 'Waveform', type: 'select', options: ['sine', 'square', 'triangle', 'sawtooth'], def: 'sine' },
      { k: 'a', label: 'Amplitude (peak)', unit: 'V', def: 5 }, { k: 'f', label: 'Frequency', unit: 'Hz', def: 100, min: 0 },
      { k: 'off', label: 'DC offset', unit: 'V', def: 0 }, { k: 'ph', label: 'Phase (deg)', unit: '', def: 0 }];
    value(t) {
      const p = this.p, ph = t * p.f + p.ph / 360, fr = ph - Math.floor(ph); let w;
      switch (p.wave) {
        case 'square': w = fr < 0.5 ? 1 : -1; break;
        case 'triangle': w = fr < 0.25 ? 4 * fr : fr < 0.75 ? 2 - 4 * fr : 4 * fr - 4; break;
        case 'sawtooth': w = 2 * fr - 1; break;
        default: w = Math.sin(2 * Math.PI * ph);
      }
      return p.off + p.a * w;
    }
    draw(ctx) {
      line(ctx, 0, 0, 18, 0); line(ctx, 46, 0, 64, 0); circle(ctx, 32, 0, 14);
      ctx.beginPath();
      if (this.p.wave === 'square') { ctx.moveTo(32, -8); ctx.lineTo(27, -8); ctx.lineTo(27, 0); ctx.lineTo(37, 0); ctx.lineTo(37, 8); ctx.lineTo(32, 8); }
      else if (this.p.wave === 'sine') { ctx.moveTo(32, -8); ctx.bezierCurveTo(22, -5, 28, -1, 32, 0); ctx.bezierCurveTo(36, 1, 42, 5, 32, 8); }
      else { ctx.moveTo(32, -8); ctx.lineTo(27, -4); ctx.lineTo(37, 4); ctx.lineTo(32, 8); }
      ctx.stroke();
      this.ctext(ctx, '+', 10, -9);
      this.label(ctx, fmt(this.p.a, 'V') + ' ' + fmt(this.p.f, 'Hz'), 32, -22);
    }
    bbox() { return [0, -16, 64, 16]; }
  }
  reg(ACSource);

  class ISource extends TwoTerm {
    static type = 'idc'; static title = 'DC current source';
    static props = [{ k: 'i', label: 'Current', unit: 'A', def: 0.001 }];
    stamp(sim) { sim.stampI(this.nodes[1], this.nodes[0], this.p.i); }
    draw(ctx) {
      line(ctx, 0, 0, 18, 0); line(ctx, 46, 0, 64, 0); circle(ctx, 32, 0, 14);
      line(ctx, 41, 0, 27, 0); arrow(ctx, 41, 0, 23, 0, 7);
      this.label(ctx, fmt(this.p.i, 'A'), 32, -22);
    }
    bbox() { return [0, -16, 64, 16]; }
    info(sim) { return ['V = ' + fmt(this.vd(sim), 'V')]; }
  }
  reg(ISource);

  class Rail extends Elm {
    static type = 'rail'; static title = 'Voltage rail';
    static props = [{ k: 'v', label: 'Voltage', unit: 'V', def: 5 }];
    init() { this.vsCount = 1; }
    pins() { return Rail.PINS; }
    bbox() { return [-14, -28, 14, 2]; }
    stamp(sim) { sim.stampVS(this.nodes[0], 0, this.vsIdx, this.p.v); }
    draw(ctx) {
      line(ctx, 0, 0, 0, -11); line(ctx, -8, -11, 8, -11);
      this.ctext(ctx, (this.p.v > 0 ? '+' : '') + fmt(this.p.v, 'V').replace(' ', ''), 0, -20);
    }
    info(sim) { return ['I = ' + fmt(-sim.x[sim.row(this)], 'A')]; }
  }
  Rail.PINS = [[0, 0]];
  reg(Rail);

  class Ground extends Elm {
    static type = 'gnd'; static title = 'Ground';
    init() { this.isGround = true; }
    pins() { return Rail.PINS; }
    bbox() { return [-11, -2, 11, 18]; }
    draw(ctx) { line(ctx, 0, 0, 0, 8); line(ctx, -10, 8, 10, 8); line(ctx, -6, 12, 6, 12); line(ctx, -2, 16, 2, 16); }
  }
  reg(Ground);

  /* ---------------- semiconductors ---------------- */
  class Diode extends TwoTerm {
    static type = 'd'; static title = 'Diode';
    init() { this.nonlinear = true; this.model(); }
    onProp() { this.model(); }
    model() { this.setModel(1e-14, VT, 0); }
    setModel(is, nvt, vz) {
      this.is = is; this.nvt = nvt; this.vcrit = vcritOf(nvt, is);
      this.zoff = vz > 0 ? vz - VT * Math.log(5e-3 / is) : 0; this.vzcrit = vcritOf(VT, is);
    }
    reset() { this.lastV = 0; this.i = 0; this._i = 0; this._g = 0; }
    calc(v) {
      const is = this.is, e = ex(v / this.nvt);
      this._i = is * (e - 1); this._g = is / this.nvt * e;
      if (v < 0 && this.zoff) { const z = ex((-v - this.zoff) / VT); this._i -= is * z; this._g += is / VT * z; }
    }
    stamp(sim) {
      const a = this.nodes[0], b = this.nodes[1], v0 = sim.v[a] - sim.v[b]; let v = v0;
      if (v >= 0 || !this.zoff) v = pnj(v, this.lastV, this.nvt, this.vcrit);
      else v = -(pnj(-v - this.zoff, -this.lastV - this.zoff, VT, this.vzcrit) + this.zoff);
      if (Math.abs(v - v0) > 1e-9) sim.converged = false;
      this.lastV = v; this.calc(v);
      sim.stampG(a, b, this._g + 1e-12); sim.stampI(a, b, this._i - this._g * v);
    }
    accept(sim) { this.calc(this.vd(sim)); this.i = this._i; }
    drawBody(ctx) {
      line(ctx, 0, 0, 24, 0); line(ctx, 40, 0, 64, 0);
      ctx.beginPath(); ctx.moveTo(24, -8); ctx.lineTo(24, 8); ctx.lineTo(40, 0); ctx.closePath(); ctx.stroke();
      line(ctx, 40, -8, 40, 8);
    }
    draw(ctx) { this.drawBody(ctx); }
    info(sim) { return ['V = ' + fmt(this.vd(sim), 'V'), 'I = ' + fmt(this.i, 'A')]; }
  }
  reg(Diode);

  const LEDC = { red: '#ff3b30', green: '#1fc24a', blue: '#2f7bff', yellow: '#f2b600', white: '#f4f4f4' };
  class LED extends Diode {
    static type = 'led'; static title = 'LED';
    static props = [{ k: 'color', label: 'Colour', type: 'select', options: Object.keys(LEDC), def: 'red' }];
    model() { this.setModel(1e-18, 2 * VT, 0); }
    draw(ctx, st) {
      const b = st.live ? Math.max(0, Math.min(1, this.i / 0.012)) : 0;
      if (b > 0.02) {
        ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * b; ctx.fillStyle = LEDC[this.p.color] || LEDC.red;
        ctx.beginPath(); ctx.arc(32, 0, 13, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
      }
      this.drawBody(ctx);
      line(ctx, 34, -11, 39, -17); arrow(ctx, 34, -11, 40, -18, 4); line(ctx, 41, -9, 46, -15); arrow(ctx, 41, -9, 47, -16, 4);
    }
    bbox() { return [0, -20, 64, 12]; }
  }
  reg(LED);

  class Zener extends Diode {
    static type = 'zener'; static title = 'Zener diode';
    static props = [{ k: 'vz', label: 'Zener voltage', unit: 'V', def: 5.1, min: 0.5 }];
    model() { this.setModel(1e-14, VT, this.p.vz); }
    draw(ctx) {
      this.drawBody(ctx); line(ctx, 40, -8, 36, -11); line(ctx, 40, 8, 44, 11);
      this.label(ctx, fmt(this.p.vz, 'V'), 32, -18);
    }
  }
  reg(Zener);

  /* BJT (Ebers-Moll). nodes: [B, C, E] */
  class NPN extends Elm {
    static type = 'npn'; static title = 'NPN transistor';
    static props = [{ k: 'beta', label: 'Gain (β)', unit: '', def: 100, min: 1 }];
    init() { this.nonlinear = true; this.pol = 1; this.vcrit = vcritOf(VT, 1e-14); }
    pins() { return this.pol > 0 ? NPN.PN : NPN.PP; }
    bbox() { return [0, -4, 40, 36]; }
    reset() { this.lbe = 0; this.lbc = 0; this.ic = 0; this.ib = 0; }
    stamp(sim) {
      const B = this.nodes[0], C = this.nodes[1], E = this.nodes[2], pol = this.pol, v = sim.v;
      const vbe0 = pol * (v[B] - v[E]), vbc0 = pol * (v[B] - v[C]);
      const vbe = pnj(vbe0, this.lbe, VT, this.vcrit), vbc = pnj(vbc0, this.lbc, VT, this.vcrit);
      if (Math.abs(vbe - vbe0) > 1e-9 || Math.abs(vbc - vbc0) > 1e-9) sim.converged = false;
      this.lbe = vbe; this.lbc = vbc;
      const is = 1e-14, bf = this.p.beta, br = 1, gm = 1e-12;
      const ef = ex(vbe / VT), er = ex(vbc / VT), If = is * (ef - 1), Ir = is * (er - 1), gf = is / VT * ef, gr = is / VT * er;
      const ic = If - Ir * (1 + 1 / br) - gm * vbc, ib = If / bf + Ir / br + gm * (vbe + vbc);
      const a = gf, b = -gr * (1 + 1 / br) - gm, a2 = gf / bf + gm, b2 = gr / br + gm;
      const qc = pol * (ic - a * vbe - b * vbc), qb = pol * (ib - a2 * vbe - b2 * vbc);
      const rB = B - 1, rC = C - 1, rE = E - 1;
      sim.addA(rC, rB, a + b); sim.addA(rC, rE, -a); sim.addA(rC, rC, -b); sim.addB(rC, -qc);
      sim.addA(rB, rB, a2 + b2); sim.addA(rB, rE, -a2); sim.addA(rB, rC, -b2); sim.addB(rB, -qb);
      sim.addA(rE, rB, -(a + a2 + b + b2)); sim.addA(rE, rE, a + a2); sim.addA(rE, rC, b + b2); sim.addB(rE, qc + qb);
      this._ic = pol * ic; this._ib = pol * ib;
    }
    accept() { this.ic = this._ic; this.ib = this._ib; }
    draw(ctx) {
      const n = this.pol > 0, ye = n ? 1 : -1; // emitter is at the bottom for NPN, top for PNP
      line(ctx, 0, 16, 18, 16); ctx.save(); ctx.lineWidth = 3; line(ctx, 18, 5, 18, 27); ctx.restore();
      line(ctx, 18, 16 - 5 * ye, 32, 16 - 12 * ye); line(ctx, 32, 16 - 12 * ye, 32, 16 - 16 * ye);
      line(ctx, 18, 16 + 5 * ye, 32, 16 + 12 * ye); line(ctx, 32, 16 + 12 * ye, 32, 16 + 16 * ye);
      if (n) arrow(ctx, 18, 21, 31, 27.5, 7); else arrow(ctx, 32, 4, 20, 10, 7);
      circle(ctx, 23, 16, 17);
    }
    info(sim) {
      const v = sim.v, n = this.nodes;
      return ['Vbe = ' + fmt(v[n[0]] - v[n[2]], 'V'), 'Vce = ' + fmt(v[n[1]] - v[n[2]], 'V'), 'Ic = ' + fmt(this.ic, 'A'), 'Ib = ' + fmt(this.ib, 'A')];
    }
  }
  NPN.PN = [[0, 1], [2, 0], [2, 2]]; NPN.PP = [[0, 1], [2, 2], [2, 0]];
  reg(NPN);
  class PNP extends NPN {
    static type = 'pnp'; static title = 'PNP transistor';
    init() { super.init(); this.pol = -1; }
  }
  reg(PNP);

  /* MOSFET (square-law). nodes: [G, D, S] */
  class NMOS extends Elm {
    static type = 'nmos'; static title = 'N-channel MOSFET';
    static props = [{ k: 'vt', label: 'Threshold', unit: 'V', def: 1.5, min: 0 }, { k: 'k', label: 'Transconductance', unit: 'A/V²', def: 0.02, min: 1e-9 }];
    init() { this.nonlinear = true; this.pol = 1; }
    pins() { return this.pol > 0 ? NPN.PN : NPN.PP; }
    bbox() { return [0, -4, 36, 36]; }
    reset() { this.lgs = 0; this.id = 0; }
    stamp(sim) {
      const g = this.nodes[0], v = sim.v, pol = this.pol; let d = this.nodes[1], s = this.nodes[2];
      if (pol * (v[d] - v[s]) < 0) { const t = d; d = s; s = t; }
      const vgs0 = pol * (v[g] - v[s]), vds = pol * (v[d] - v[s]); let vgs = vgs0;
      if (vgs > this.lgs + 0.5) vgs = this.lgs + 0.5; else if (vgs < this.lgs - 0.5) vgs = this.lgs - 0.5;
      if (vgs !== vgs0) sim.converged = false;
      this.lgs = vgs;
      const beta = this.p.k, vov = vgs - this.p.vt; let ids = 0, gm = 0, gds = 0;
      if (vov > 0) {
        if (vds < vov) { ids = beta * (vov * vds - vds * vds / 2); gm = beta * vds; gds = beta * (vov - vds); }
        else { ids = beta / 2 * vov * vov; gm = beta * vov; }
      }
      const q = pol * (ids - gm * vgs - gds * vds), rD = d - 1, rS = s - 1, rG = g - 1;
      sim.addA(rD, rG, gm); sim.addA(rD, rS, -gm - gds); sim.addA(rD, rD, gds); sim.addB(rD, -q);
      sim.addA(rS, rG, -gm); sim.addA(rS, rS, gm + gds); sim.addA(rS, rD, -gds); sim.addB(rS, q);
      sim.stampG(d, s, 1e-9);
      this._id = ids;
    }
    accept() { this.id = this._id; }
    draw(ctx) {
      const n = this.pol > 0, ys = n ? 24 : 8, yd = n ? 8 : 24; // source bottom for N, top for P
      line(ctx, 0, 16, 13, 16); line(ctx, 13, 7, 13, 25);
      ctx.save(); ctx.lineWidth = 3; line(ctx, 18, 4, 18, 28); ctx.restore();
      line(ctx, 18, yd, 32, yd); line(ctx, 32, yd, 32, n ? 0 : 32);
      line(ctx, 18, ys, 32, ys); line(ctx, 32, ys, 32, n ? 32 : 0);
      if (n) arrow(ctx, 18, ys, 29, ys, 6); else arrow(ctx, 32, ys, 21, ys, 6);
    }
    info(sim) {
      const v = sim.v, n = this.nodes;
      return ['Vgs = ' + fmt(v[n[0]] - v[n[2]], 'V'), 'Vds = ' + fmt(v[n[1]] - v[n[2]], 'V'), 'Id = ' + fmt(this.id, 'A')];
    }
  }
  reg(NMOS);
  class PMOS extends NMOS {
    static type = 'pmos'; static title = 'P-channel MOSFET';
    init() { super.init(); this.pol = -1; }
  }
  reg(PMOS);

  /* Op-amp with output saturation. nodes: [in-, in+, out] */
  class OpAmp extends Elm {
    static type = 'opamp'; static title = 'Op-amp';
    static props = [{ k: 'max', label: 'Max output', unit: 'V', def: 15 }, { k: 'min', label: 'Min output', unit: 'V', def: -15 },
      { k: 'gain', label: 'Open-loop gain', unit: '', def: 100000, min: 1 }];
    init() { this.nonlinear = true; this.vsCount = 1; }
    pins() { return OpAmp.PINS; }
    bbox() { return [0, -14, 64, 46]; }
    reset() { this.lastVd = 0; }
    stamp(sim) {
      const inn = this.nodes[0], inp = this.nodes[1], out = this.nodes[2], gain = this.p.gain, mx = this.p.max, mn = this.p.min;
      const vd = sim.v[inp] - sim.v[inn];
      if (Math.abs(this.lastVd - vd) > 0.1) sim.converged = false;
      let dx, x = 0;
      if (vd >= mx / gain && (this.lastVd >= 0 || Math.random() < 0.25)) { dx = 1e-4; x = mx - dx * mx / gain; }
      else if (vd <= mn / gain && (this.lastVd <= 0 || Math.random() < 0.25)) { dx = 1e-4; x = mn - dx * mn / gain; }
      else dx = gain;
      const r = sim.row(this);
      sim.addA(out - 1, r, 1); sim.addA(r, inn - 1, dx); sim.addA(r, inp - 1, -dx); sim.addA(r, out - 1, 1); sim.addB(r, x);
      this.lastVd = vd;
    }
    draw(ctx) {
      line(ctx, 0, 0, 12, 0); line(ctx, 0, 32, 12, 32); line(ctx, 54, 16, 64, 16);
      ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(12, 44); ctx.lineTo(54, 16); ctx.closePath(); ctx.stroke();
      ctx.save(); ctx.font = '13px system-ui, sans-serif'; this.ctext(ctx, '−', 20, 0); this.ctext(ctx, '+', 20, 32); ctx.restore();
    }
    info(sim) { const v = sim.v, n = this.nodes; return ['V+ = ' + fmt(v[n[1]], 'V'), 'V− = ' + fmt(v[n[0]], 'V'), 'Vout = ' + fmt(v[n[2]], 'V')]; }
  }
  OpAmp.PINS = [[0, 0], [0, 2], [4, 1]];
  reg(OpAmp);

  /* ---------------- instruments ---------------- */
  class Voltmeter extends TwoTerm {
    static type = 'vm'; static title = 'Voltmeter';
    static props = [{ k: 'name', label: 'Label', type: 'text', def: 'V1' }, { k: 'scope', label: 'Show on scope', type: 'bool', def: false }];
    stamp(sim) { sim.stampG(this.nodes[0], this.nodes[1], 1e-7); }
    scopeOn() { return this.p.scope; }
    scopeValue(sim) { return this.vd(sim); }
    scopeName() { return this.p.name; }
    get scopeUnit() { return 'V'; }
    draw(ctx, st) {
      line(ctx, 0, 0, 20, 0); line(ctx, 44, 0, 64, 0); circle(ctx, 32, 0, 12);
      ctx.save(); ctx.font = 'bold 12px system-ui, sans-serif'; this.ctext(ctx, 'V', 32, 0); ctx.restore();
      this.ctext(ctx, '+', 12, -8);
      this.label(ctx, st.live ? fmt(this.vd(st.sim), 'V') : this.p.name, 32, -20);
    }
    bbox() { return [0, -14, 64, 14]; }
    info(sim) { return ['V = ' + fmt(this.vd(sim), 'V')]; }
  }
  reg(Voltmeter);

  class Ammeter extends TwoTerm {
    static type = 'am'; static title = 'Ammeter';
    static props = [{ k: 'name', label: 'Label', type: 'text', def: 'A1' }, { k: 'scope', label: 'Show on scope', type: 'bool', def: false }];
    init() { this.vsCount = 1; }
    stamp(sim) { sim.stampVS(this.nodes[0], this.nodes[1], this.vsIdx, 0); }
    cur(sim) { return sim.x[sim.row(this)] || 0; }
    scopeOn() { return this.p.scope; }
    scopeValue(sim) { return this.cur(sim); }
    scopeName() { return this.p.name; }
    get scopeUnit() { return 'A'; }
    draw(ctx, st) {
      line(ctx, 0, 0, 20, 0); line(ctx, 44, 0, 64, 0); circle(ctx, 32, 0, 12);
      ctx.save(); ctx.font = 'bold 12px system-ui, sans-serif'; this.ctext(ctx, 'A', 32, 0); ctx.restore();
      arrow(ctx, 6, -7, 16, -7, 5);
      this.label(ctx, st.live ? fmt(this.cur(st.sim), 'A') : this.p.name, 32, -20);
    }
    bbox() { return [0, -14, 64, 14]; }
    info(sim) { return ['I = ' + fmt(this.cur(sim), 'A')]; }
  }
  reg(Ammeter);

  class Probe extends Elm {
    static type = 'probe'; static title = 'Scope probe';
    static props = [{ k: 'name', label: 'Label', type: 'text', def: 'Probe' }];
    pins() { return Rail.PINS; }
    bbox() { return [-18, -30, 18, 3]; }
    scopeOn() { return true; }
    scopeValue(sim) { return sim.v[this.nodes[0]]; }
    scopeName() { return this.p.name; }
    get scopeUnit() { return 'V'; }
    draw(ctx, st) {
      const c = this.color || st.th.sel;
      ctx.save(); ctx.strokeStyle = st.sel ? st.th.sel : c; ctx.fillStyle = c;
      line(ctx, 0, 0, 0, -11); circle(ctx, 0, 0, 2.5, true); circle(ctx, 0, -14, 3.5, true); ctx.restore();
      ctx.save(); ctx.fillStyle = c; ctx.font = 'bold 10px system-ui, sans-serif';
      this.ctext(ctx, st.live ? this.p.name + ' ' + fmt(st.sim.v[this.nodes[0]], 'V') : this.p.name, 0, -24); ctx.restore();
    }
    info(sim) { return ['V = ' + fmt(sim.v[this.nodes[0]], 'V')]; }
  }
  reg(Probe);
})(typeof window !== 'undefined' ? window : globalThis);
