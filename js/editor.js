/* CircuitBench — schematic editor (canvas) */
(function (G) {
  'use strict';
  const CL = G.CL, U = CL.U;

  CL.themes = {
    light: { bg: '#fbfbf8', grid: '#cfcfc8', fg: '#22262b', text: '#22262b', dim: '#868c95', wire: '#4a5260', sel: '#0b6bcb', pin: '#b3261e',
      chip: '#f0eee6', lit: '#e0342c', segOff: '#e2dfd6', pos: [26, 158, 62], neg: [214, 60, 50], zero: [120, 126, 136],
      scopeBg: '#ffffff', scopeGrid: '#e4e4df' },
    dark: { bg: '#15171a', grid: '#343941', fg: '#d9dce1', text: '#d9dce1', dim: '#7d8590', wire: '#8e97a3', sel: '#5aa9ff', pin: '#ff7b72',
      chip: '#24282e', lit: '#ff4d42', segOff: '#30353c', pos: [63, 200, 100], neg: [255, 99, 88], zero: [125, 133, 144],
      scopeBg: '#101214', scopeGrid: '#262a30' }
  };
  CL.theme = CL.themes.light;

  class Editor {
    constructor(canvas, app) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.app = app;
      this.elements = []; this.wires = []; this.junctions = []; this.sel = new Set();
      this.view = { ox: 60, oy: 50, z: 1 }; this.mode = 'select'; this.ghost = null; this.drag = null;
      this.undoStack = []; this.redoStack = []; this.clip = null; this.hoverPin = null; this.mouse = [0, 0]; this.vmax = 5;
      this.bind();
    }

    /* ---------- document ---------- */
    snapshot() { this.undoStack.push(JSON.stringify(CL.serialize(this.elements, this.wires))); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack.length = 0; }
    restore(json) { const d = CL.deserialize(JSON.parse(json)); this.elements = d.elements; this.wires = d.wires; this.sel.clear(); this.app.docChanged(); this.app.selChanged(); }
    undo() { if (!this.undoStack.length) return; this.redoStack.push(JSON.stringify(CL.serialize(this.elements, this.wires))); this.restore(this.undoStack.pop()); }
    redo() { if (!this.redoStack.length) return; this.undoStack.push(JSON.stringify(CL.serialize(this.elements, this.wires))); this.restore(this.redoStack.pop()); }
    load(doc) { const d = CL.deserialize(doc); this.elements = d.elements; this.wires = d.wires; this.sel.clear(); this.undoStack.length = 0; this.redoStack.length = 0; this.setMode('select'); }

    setMode(m, item) {
      this.mode = m; this.ghost = null; this.drag = null;
      if (m === 'place') { this.placeItem = item; this.ghost = CL.create(item.t, item.p); this.ghost.rot = item.rot || 0; this.ghost.x = this.mouse[0]; this.ghost.y = this.mouse[1]; }
      this.cv.style.cursor = m === 'select' ? 'default' : 'crosshair';
      this.app.modeChanged();
    }
    deleteSel() {
      if (!this.sel.size) return; this.snapshot();
      this.elements = this.elements.filter(e => !this.sel.has(e)); this.wires = this.wires.filter(w => !this.sel.has(w));
      this.sel.clear(); this.app.docChanged(); this.app.selChanged();
    }
    rotateSel() {
      if (this.ghost) { this.ghost.rot = (this.ghost.rot + 1) & 3; return; }
      const els = [...this.sel].filter(o => o.pins); if (!els.length) return;
      this.snapshot(); for (const e of els) e.rot = (e.rot + 1) & 3; this.app.docChanged();
    }
    selectAll() { this.sel = new Set([...this.elements, ...this.wires]); this.app.selChanged(); }
    copy() {
      const els = [...this.sel].filter(o => o.pins), ws = [...this.sel].filter(o => !o.pins);
      if (els.length || ws.length) this.clip = JSON.stringify(CL.serialize(els, ws));
    }
    paste() {
      if (!this.clip) return; this.snapshot();
      const d = CL.deserialize(JSON.parse(this.clip)); this.sel.clear();
      for (const e of d.elements) { e.x += 2; e.y += 2; this.elements.push(e); this.sel.add(e); }
      for (const w of d.wires) { w.x1 += 2; w.y1 += 2; w.x2 += 2; w.y2 += 2; this.wires.push(w); this.sel.add(w); }
      this.clip = JSON.stringify(CL.serialize(d.elements, d.wires));
      this.app.docChanged(); this.app.selChanged();
    }

    /* ---------- geometry ---------- */
    toWorld(ev) { const r = this.cv.getBoundingClientRect(); return [(ev.clientX - r.left - this.view.ox) / this.view.z, (ev.clientY - r.top - this.view.oy) / this.view.z]; }
    elementAt(wx, wy) { for (let i = this.elements.length - 1; i >= 0; i--) if (this.elements[i].hit(wx, wy, 3)) return this.elements[i]; return null; }
    wireAt(wx, wy) {
      const tol = 5 / this.view.z;
      for (let i = this.wires.length - 1; i >= 0; i--) {
        const w = this.wires[i], x1 = w.x1 * U, y1 = w.y1 * U, dx = w.x2 * U - x1, dy = w.y2 * U - y1, l2 = dx * dx + dy * dy;
        let t = l2 ? ((wx - x1) * dx + (wy - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
        if (Math.hypot(wx - x1 - t * dx, wy - y1 - t * dy) < tol) return w;
      }
      return null;
    }
    pinAt(wx, wy) {
      const tol = 8 / this.view.z; let best = null, bd = tol;
      const test = (gx, gy) => { const d = Math.hypot(wx - gx * U, wy - gy * U); if (d < bd) { bd = d; best = [gx, gy]; } };
      for (const e of this.elements) for (const p of e.absPins()) test(p[0], p[1]);
      for (const w of this.wires) { test(w.x1, w.y1); test(w.x2, w.y2); }
      return best;
    }
    zoomAt(px, py, f) {
      const v = this.view, z = Math.max(0.25, Math.min(4, v.z * f));
      v.ox = px - (px - v.ox) * z / v.z; v.oy = py - (py - v.oy) * z / v.z; v.z = z;
    }
    zoomBy(f) { this.zoomAt(this.cv.clientWidth / 2, this.cv.clientHeight / 2, f); }
    fit() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const e of this.elements) { const b = e.absBox(); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
      for (const w of this.wires) { x0 = Math.min(x0, w.x1 * U, w.x2 * U); y0 = Math.min(y0, w.y1 * U, w.y2 * U); x1 = Math.max(x1, w.x1 * U, w.x2 * U); y1 = Math.max(y1, w.y1 * U, w.y2 * U); }
      const W = this.cv.clientWidth, H = this.cv.clientHeight;
      if (x0 === Infinity || !W || !H) { this.view = { ox: 60, oy: 50, z: 1 }; return; }
      const z = Math.max(0.25, Math.min(1.6, (W - 80) / (x1 - x0 || 1), (H - 80) / (y1 - y0 || 1)));
      this.view = { z, ox: (W - (x0 + x1) * z) / 2, oy: (H - (y0 + y1) * z) / 2 };
    }

    /* ---------- input ---------- */
    bind() {
      const cv = this.cv;
      cv.addEventListener('contextmenu', ev => ev.preventDefault());
      cv.addEventListener('pointerdown', ev => this.down(ev));
      cv.addEventListener('pointermove', ev => this.move(ev));
      cv.addEventListener('pointerup', ev => this.up(ev));
      cv.addEventListener('pointercancel', () => { this.drag = null; });
      cv.addEventListener('wheel', ev => {
        ev.preventDefault();
        const r = cv.getBoundingClientRect();
        if (ev.ctrlKey || ev.metaKey) this.zoomAt(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * 0.01));
        else { this.view.ox -= ev.deltaX; this.view.oy -= ev.deltaY; }
      }, { passive: false });
      G.addEventListener('keydown', ev => this.key(ev));
    }
    key(ev) {
      const t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') || document.querySelector('dialog[open]')) return;
      const k = ev.key.toLowerCase(), mod = ev.ctrlKey || ev.metaKey;
      let used = true;
      if (mod && k === 'z') ev.shiftKey ? this.redo() : this.undo();
      else if (mod && k === 'y') this.redo();
      else if (mod && k === 'c') this.copy();
      else if (mod && k === 'v') this.paste();
      else if (mod && k === 'a') this.selectAll();
      else if (mod) used = false;
      else if (k === 'delete' || k === 'backspace') this.deleteSel();
      else if (k === 'r') this.rotateSel();
      else if (k === 'w') this.setMode(this.mode === 'wire' ? 'select' : 'wire');
      else if (k === 'escape') { if (this.mode !== 'select' || this.drag) this.setMode('select'); else { this.sel.clear(); this.app.selChanged(); } }
      else if (k === ' ') this.app.toggleRun();
      else used = false;
      if (used) ev.preventDefault();
    }
    down(ev) {
      const [wx, wy] = this.toWorld(ev), gx = Math.round(wx / U), gy = Math.round(wy / U);
      try { this.cv.setPointerCapture(ev.pointerId); } catch (err) { /* pointer already released */ }
      if (ev.button === 1 || ev.button === 2) {
        if (ev.button === 2 && this.mode !== 'select') { this.setMode('select'); return; }
        this.drag = { type: 'pan', sx: ev.clientX, sy: ev.clientY, ox: this.view.ox, oy: this.view.oy }; return;
      }
      if (ev.button !== 0) return;
      if (this.mode === 'place') {
        this.snapshot(); const e = this.ghost; e.x = gx; e.y = gy; this.elements.push(e);
        this.setMode('select'); this.sel.clear(); this.sel.add(e); this.app.docChanged(); this.app.selChanged(); return;
      }
      const pin = this.pinAt(wx, wy);
      if (this.mode === 'wire' || pin) { const s = pin || [gx, gy]; this.drag = { type: 'wire', x1: s[0], y1: s[1], x2: s[0], y2: s[1] }; return; }
      const hit = this.elementAt(wx, wy) || this.wireAt(wx, wy);
      if (hit) {
        if (ev.shiftKey) { if (this.sel.has(hit)) this.sel.delete(hit); else this.sel.add(hit); }
        else if (!this.sel.has(hit)) { this.sel.clear(); this.sel.add(hit); }
        this.drag = { type: 'move', lx: gx, ly: gy, moved: false, target: hit, shift: ev.shiftKey };
      } else {
        if (!ev.shiftKey) this.sel.clear();
        this.drag = { type: 'band', x0: wx, y0: wy, x1: wx, y1: wy };
      }
      this.app.selChanged();
    }
    move(ev) {
      const [wx, wy] = this.toWorld(ev), gx = Math.round(wx / U), gy = Math.round(wy / U), d = this.drag;
      this.mouse = [gx, gy];
      if (this.ghost) { this.ghost.x = gx; this.ghost.y = gy; }
      if (!d) {
        this.hoverPin = this.mode !== 'place' ? this.pinAt(wx, wy) : null;
        if (this.mode === 'select') this.cv.style.cursor = this.hoverPin ? 'crosshair' : (this.elementAt(wx, wy) || this.wireAt(wx, wy)) ? 'move' : 'default';
        return;
      }
      if (d.type === 'pan') { this.view.ox = d.ox + ev.clientX - d.sx; this.view.oy = d.oy + ev.clientY - d.sy; }
      else if (d.type === 'wire') { const p = this.pinAt(wx, wy) || [gx, gy]; d.x2 = p[0]; d.y2 = p[1]; this.hoverPin = this.pinAt(wx, wy); }
      else if (d.type === 'band') { d.x1 = wx; d.y1 = wy; }
      else if (d.type === 'move') {
        const dx = gx - d.lx, dy = gy - d.ly; if (!dx && !dy) return;
        if (!d.moved) { this.snapshot(); d.moved = true; }
        for (const o of this.sel) { if (o.pins) { o.x += dx; o.y += dy; } else { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; } }
        d.lx = gx; d.ly = gy; this.app.docChanged();
      }
    }
    up(ev) {
      const d = this.drag; this.drag = null; if (!d) return;
      if (d.type === 'wire') {
        const segs = [];
        if (d.x1 === d.x2 || d.y1 === d.y2) segs.push([d.x1, d.y1, d.x2, d.y2]);
        else { segs.push([d.x1, d.y1, d.x2, d.y1]); segs.push([d.x2, d.y1, d.x2, d.y2]); }
        const real = segs.filter(s => s[0] !== s[2] || s[1] !== s[3]);
        if (real.length) { this.snapshot(); for (const s of real) this.wires.push({ x1: s[0], y1: s[1], x2: s[2], y2: s[3], node: 0 }); this.app.docChanged(); }
      } else if (d.type === 'band') {
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
        if (x1 - x0 > 3 || y1 - y0 > 3) {
          for (const e of this.elements) { const b = e.absBox(); if (b[0] < x1 && b[2] > x0 && b[1] < y1 && b[3] > y0) this.sel.add(e); }
          for (const w of this.wires) if (Math.min(w.x1, w.x2) * U >= x0 && Math.max(w.x1, w.x2) * U <= x1 && Math.min(w.y1, w.y2) * U >= y0 && Math.max(w.y1, w.y2) * U <= y1) this.sel.add(w);
        }
        this.app.selChanged();
      } else if (d.type === 'move' && !d.moved && !d.shift && d.target.toggle) {
        d.target.toggle(); this.app.docChanged(); this.app.selChanged();
      }
    }

    /* ---------- drawing ---------- */
    vcolor(v) {
      const th = CL.theme, s = Math.max(-1, Math.min(1, v / this.vmax)), a = th.zero, b = s >= 0 ? th.pos : th.neg, k = Math.abs(s);
      return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')';
    }
    drawElm(ctx, e, st) {
      const th = st.th;
      ctx.save(); ctx.translate(e.x * U, e.y * U); if (e.rot) ctx.rotate(e.rot * Math.PI / 2);
      ctx.strokeStyle = st.sel ? th.sel : th.fg; ctx.fillStyle = th.text; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.font = '11px system-ui, sans-serif';
      e.draw(ctx, st); ctx.restore();
    }
    draw() {
      const cv = this.cv, ctx = this.ctx, th = CL.theme, dpr = G.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight, v = this.view;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
      ctx.translate(v.ox, v.oy); ctx.scale(v.z, v.z);
      const sim = this.app.sim, live = sim.t > 0 && !this.app.dirty;
      if (v.z >= 0.55) {
        ctx.fillStyle = th.grid;
        const gx0 = Math.floor(-v.ox / v.z / U), gx1 = Math.ceil((W - v.ox) / v.z / U), gy0 = Math.floor(-v.oy / v.z / U), gy1 = Math.ceil((H - v.oy) / v.z / U);
        for (let x = gx0; x <= gx1; x++) for (let y = gy0; y <= gy1; y++) ctx.fillRect(x * U - 0.75, y * U - 0.75, 1.5, 1.5);
      }
      if (live) { let m = 1; for (let i = 1; i < sim.nodeCount; i++) { const a = Math.abs(sim.v[i]); if (a > m && a < 1e6) m = a; } this.vmax += (m - this.vmax) * 0.1; }
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const w of this.wires) {
        ctx.strokeStyle = this.sel.has(w) ? th.sel : live ? this.vcolor(sim.v[w.node] || 0) : th.wire;
        ctx.beginPath(); ctx.moveTo(w.x1 * U, w.y1 * U); ctx.lineTo(w.x2 * U, w.y2 * U); ctx.stroke();
      }
      ctx.fillStyle = th.wire;
      for (const j of this.junctions) { ctx.beginPath(); ctx.arc(j.x * U, j.y * U, 3, 0, 2 * Math.PI); ctx.fill(); }
      const st = { th, sim, live, sel: false };
      for (const e of this.elements) { st.sel = this.sel.has(e); this.drawElm(ctx, e, st); }
      // unconnected pins
      ctx.strokeStyle = th.pin; ctx.lineWidth = 1.2;
      for (const e of this.elements) {
        if (!e._abs || e._abs.length !== e.conn.length) continue;
        for (let i = 0; i < e._abs.length; i++) if (!e.conn[i]) { ctx.beginPath(); ctx.arc(e._abs[i][0] * U, e._abs[i][1] * U, 2.5, 0, 2 * Math.PI); ctx.stroke(); }
      }
      // selection boxes
      ctx.strokeStyle = th.sel; ctx.lineWidth = 1 / v.z; ctx.setLineDash([4 / v.z, 3 / v.z]);
      for (const e of this.sel) if (e.pins) { const b = e.absBox(); ctx.strokeRect(b[0] - 3, b[1] - 3, b[2] - b[0] + 6, b[3] - b[1] + 6); }
      const d = this.drag;
      if (d && d.type === 'band') ctx.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      ctx.setLineDash([]);
      if (d && d.type === 'wire') {
        ctx.strokeStyle = th.sel; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x1 * U, d.y1 * U); ctx.lineTo(d.x2 * U, d.y1 * U); ctx.lineTo(d.x2 * U, d.y2 * U); ctx.stroke();
      }
      if (this.hoverPin) { ctx.strokeStyle = th.sel; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.hoverPin[0] * U, this.hoverPin[1] * U, 6, 0, 2 * Math.PI); ctx.stroke(); }
      if (this.ghost) { ctx.globalAlpha = 0.6; st.sel = true; st.live = false; this.drawElm(ctx, this.ghost, st); ctx.globalAlpha = 1; }
    }
  }
  CL.Editor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
