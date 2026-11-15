/* CircuitBench — element base class, registry, netlist builder, save/load */
(function (G) {
  'use strict';
  const CL = G.CL, U = CL.U;
  CL.classes = {};
  CL.reg = function (cls) { CL.classes[cls.type] = cls; return cls; };
  CL.noLabels = false;
  const TWO = [[0, 0], [4, 0]];

  class Elm {
    constructor(p) {
      this.x = 0; this.y = 0; this.rot = 0; this.nodes = []; this.conn = [];
      this.vsCount = 0; this.vsIdx = 0; this.nonlinear = false; this.p = {};
      for (const d of this.constructor.props || []) this.p[d.k] = d.def;
      if (p) for (const k in p) this.p[k] = p[k];
      this.init(); this.reset();
    }
    get type() { return this.constructor.type; }
    get title() { return this.constructor.title || this.type; }
    init() {}
    reset() {}
    stamp() {}
    onProp() {}
    info() { return []; }
    pins() { return TWO; }
    bbox() { return [0, -12, 64, 12]; }
    rotPt(x, y) {
      switch (this.rot) { case 1: return [-y, x]; case 2: return [-x, -y]; case 3: return [y, -x]; default: return [x, y]; }
    }
    toAbs(p) { const r = this.rotPt(p[0], p[1]); return [this.x + r[0], this.y + r[1]]; }
    absPins() { return this.pins().map(p => this.toAbs(p)); }
    toLocal(wx, wy) {
      const dx = wx - this.x * U, dy = wy - this.y * U;
      switch (this.rot) { case 1: return [dy, -dx]; case 2: return [-dx, -dy]; case 3: return [-dy, dx]; default: return [dx, dy]; }
    }
    hit(wx, wy, m) {
      const l = this.toLocal(wx, wy), b = this.bbox();
      return l[0] >= b[0] - m && l[0] <= b[2] + m && l[1] >= b[1] - m && l[1] <= b[3] + m;
    }
    absBox() {
      const b = this.bbox(), ox = this.x * U, oy = this.y * U;
      const a = this.rotPt(b[0], b[1]), c = this.rotPt(b[2], b[3]);
      return [ox + Math.min(a[0], c[0]), oy + Math.min(a[1], c[1]), ox + Math.max(a[0], c[0]), oy + Math.max(a[1], c[1])];
    }
    /* upright side label for a point above (ly<0) or below the body */
    label(ctx, str, lx, ly) {
      if (CL.noLabels) return;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(-this.rot * Math.PI / 2);
      const up = ly < 0;
      ctx.textAlign = this.rot === 1 ? (up ? 'left' : 'right') : this.rot === 3 ? (up ? 'right' : 'left') : 'center';
      ctx.textBaseline = 'middle'; ctx.fillText(str, 0, 0); ctx.restore();
    }
    /* upright centred text */
    ctext(ctx, str, lx, ly) {
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(-this.rot * Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, 0, 0); ctx.restore();
    }
    toJSON() { return { t: this.type, x: this.x, y: this.y, r: this.rot, p: Object.assign({}, this.p) }; }
  }
  CL.Elm = Elm;

  CL.create = function (type, p) { const c = CL.classes[type]; return c ? new c(p) : null; };
  CL.fromJSON = function (o) {
    const e = CL.create(o.t, o.p); if (!e) return null;
    e.x = o.x | 0; e.y = o.y | 0; e.rot = (o.r | 0) & 3; return e;
  };
  CL.serialize = function (elements, wires, extra) {
    return Object.assign({ app: 'circuitbench', version: 1 }, extra || {}, {
      elements: elements.map(e => e.toJSON()),
      wires: wires.map(w => [w.x1, w.y1, w.x2, w.y2])
    });
  };
  CL.deserialize = function (doc) {
    if (!doc || !Array.isArray(doc.elements)) throw new Error('Not a CircuitBench file');
    for (const def of doc.customICs || []) { try { CL.addCustomIC(def); } catch (err) { /* keep loading */ } }
    return {
      elements: doc.elements.map(CL.fromJSON).filter(Boolean),
      wires: (doc.wires || []).filter(w => Array.isArray(w) && w.length === 4)
        .map(w => ({ x1: w[0] | 0, y1: w[1] | 0, x2: w[2] | 0, y2: w[3] | 0, node: 0 }))
    };
  };

  /* Assign node numbers. Wires join points; an endpoint or pin lying on a wire also joins it. */
  CL.buildNetlist = function (elements, wires) {
    const parent = new Map();
    const add = k => { if (!parent.has(k)) parent.set(k, k); };
    const find = k => {
      let r = k; while (parent.get(r) !== r) r = parent.get(r);
      while (parent.get(k) !== r) { const nx = parent.get(k); parent.set(k, r); k = nx; }
      return r;
    };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
    const key = (x, y) => x + ',' + y;
    const pts = new Map(); // key -> {x,y,ends}
    const pt = (x, y) => { const k = key(x, y); add(k); let p = pts.get(k); if (!p) { p = { x, y, k, ends: 0 }; pts.set(k, p); } p.ends++; return p; };

    for (const e of elements) { e._abs = e.absPins(); for (const a of e._abs) pt(a[0], a[1]); }
    for (const w of wires) { const a = pt(w.x1, w.y1), b = pt(w.x2, w.y2); union(a.k, b.k); }
    for (const w of wires) {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len2 = dx * dx + dy * dy, wk = key(w.x1, w.y1);
      for (const p of pts.values()) {
        const px = p.x - w.x1, py = p.y - w.y1;
        if (dx * py - dy * px !== 0) continue;
        const d = px * dx + py * dy;
        if (d > 0 && d < len2) { union(p.k, wk); p.ends += 2; }
      }
    }
    const pinCount = new Map(), grounds = new Set();
    for (const e of elements) for (const a of e._abs) {
      const r = find(key(a[0], a[1])); pinCount.set(r, (pinCount.get(r) || 0) + 1);
      if (e.isGround) grounds.add(r);
    }
    const num = new Map(); let count = 1;
    const nodeOf = k => {
      const r = find(k); if (grounds.has(r)) return 0;
      let n = num.get(r); if (n === undefined) { n = count++; num.set(r, n); } return n;
    };
    for (const e of elements) {
      e.nodes = e._abs.map(a => nodeOf(key(a[0], a[1])));
      e.conn = e._abs.map(a => pinCount.get(find(key(a[0], a[1]))) >= 2);
    }
    for (const w of wires) w.node = nodeOf(key(w.x1, w.y1));
    const junctions = [];
    for (const p of pts.values()) if (p.ends >= 3) junctions.push(p);
    return { nodeCount: count, junctions };
  };
})(typeof window !== 'undefined' ? window : globalThis);
