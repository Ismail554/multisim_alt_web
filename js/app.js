/* CircuitBench — application wiring (toolbar, palette, properties, files) */
(function () {
  'use strict';
  const CL = window.CL, $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  const app = { sim: new CL.Sim(), running: true, dirty: true, speed: 50 };
  const ed = app.ed = new CL.Editor($('cv'), app);
  const scope = app.scope = new CL.Scope($('scope'));
  const sim = app.sim;
  window.app = app;

  /* ---------- simulation ---------- */
  function analyze() {
    const nl = CL.buildNetlist(ed.elements, ed.wires);
    ed.junctions = nl.junctions; sim.setup(ed.elements, nl.nodeCount); scope.setTraces(ed.elements); app.dirty = false;
  }
  app.docChanged = function () { app.dirty = true; clearTimeout(app.saveTimer); app.saveTimer = setTimeout(() => store.set('circuitbench.doc', getDoc()), 500); };
  app.toggleRun = function () { app.running = !app.running; $('run').textContent = app.running ? 'Pause' : 'Run'; };
  app.modeChanged = function () {
    $('wire').classList.toggle('on', ed.mode === 'wire');
    for (const b of document.querySelectorAll('.part.on')) b.classList.remove('on');
    if (ed.mode === 'place' && ed.placeItem.btn) ed.placeItem.btn.classList.add('on');
    $('hint').textContent = ed.mode === 'place' ? 'Click on the canvas to place · R to rotate · Esc to cancel'
      : ed.mode === 'wire' ? 'Wire tool: drag between any two points · Esc to finish'
        : 'Drag from a pin to draw a wire · click a part to select · scroll to pan, Ctrl+scroll to zoom';
  };
  function resetSim() { if (app.dirty) analyze(); sim.reset(); scope.clear(); }

  function getDoc() {
    return CL.serialize(ed.elements, ed.wires, { dt: sim.dt, speed: app.speed,
      scope: { window: scope.window, mode: scope.mode, trig: scope.trig }, customICs: Object.values(CL.customDefs) });
  }
  function loadDoc(doc) {
    ed.load(doc);
    sim.dt = doc.dt > 0 ? doc.dt : 1e-5; app.speed = typeof doc.speed === 'number' ? doc.speed : 50;
    const s = doc.scope || {};
    scope.window = s.window > 0 ? s.window : 0.02; scope.mode = s.mode === 'stacked' ? 'stacked' : 'overlay'; scope.trig = !!s.trig;
    scope.setTiming(sim.dt);
    analyze(); sim.reset(); scope.clear(); ed.fit();
    syncControls(); buildPalette(); renderProps(); app.docChanged();
  }
  function syncControls() {
    $('dt').value = CL.fmt(sim.dt, 's'); $('speed').value = app.speed;
    $('smode').value = scope.mode; $('strig').checked = scope.trig;
    const sw = $('swin'); let best = 0;
    [...sw.options].forEach((o, i) => { if (Math.abs(Math.log(+o.value / scope.window)) < Math.abs(Math.log(+sw.options[best].value / scope.window))) best = i; });
    sw.selectedIndex = best;
  }

  /* ---------- palette ---------- */
  const CATS = ['Sources', 'Passive', 'Semiconductors', 'Instruments', 'Logic', 'Flip-flops', '74xx ICs', 'Custom ICs'];
  function paletteItems() {
    const it = (cat, label, t, p, rot) => ({ cat, label, t, p, rot });
    const list = [
      it('Sources', 'DC voltage source', 'vdc', null, 1), it('Sources', 'Function generator', 'vac', null, 1), it('Sources', 'DC current source', 'idc', null, 1),
      it('Sources', 'Voltage rail (+V)', 'rail'), it('Sources', 'Ground', 'gnd'),
      it('Passive', 'Resistor', 'r'), it('Passive', 'Capacitor', 'c'), it('Passive', 'Inductor', 'l'), it('Passive', 'Potentiometer', 'pot'), it('Passive', 'Switch', 'sw'),
      it('Semiconductors', 'Diode', 'd'), it('Semiconductors', 'LED', 'led'), it('Semiconductors', 'Zener diode', 'zener'),
      it('Semiconductors', 'NPN transistor', 'npn'), it('Semiconductors', 'PNP transistor', 'pnp'),
      it('Semiconductors', 'N-channel MOSFET', 'nmos'), it('Semiconductors', 'P-channel MOSFET', 'pmos'),
      it('Semiconductors', 'Op-amp', 'opamp'), it('Semiconductors', '555 timer', '555'),
      it('Instruments', 'Scope probe', 'probe'), it('Instruments', 'Voltmeter', 'vm'), it('Instruments', 'Ammeter', 'am'),
      it('Logic', 'Logic input (0/1)', 'in'), it('Logic', 'Clock', 'clk'), it('Logic', 'Logic indicator', 'out'),
      it('Logic', 'AND gate', 'gate', { fn: 'and' }), it('Logic', 'OR gate', 'gate', { fn: 'or' }), it('Logic', 'NOT gate', 'not'),
      it('Logic', 'NAND gate', 'gate', { fn: 'nand' }), it('Logic', 'NOR gate', 'gate', { fn: 'nor' }),
      it('Logic', 'XOR gate', 'gate', { fn: 'xor' }), it('Logic', 'XNOR gate', 'gate', { fn: 'xnor' }), it('Logic', 'Buffer', 'buf'),
      it('Logic', '7-segment display', 'seg7'), it('Logic', 'Hex display', 'hex')
    ];
    for (const id of Object.keys(CL.chips)) {
      const s = CL.chips[id];
      if (s.custom) list.push(it('Custom ICs', id, 'ic', { chip: id }));
      else if (s.sym) list.push(it('Flip-flops', s.desc.replace(/ \(.*/, ''), 'ic', { chip: id }));
      else { const x = it('74xx ICs', id + ' · ' + s.desc, 'ic', { chip: id }); x.tip = id + CL.chipFamilies(id) + ' — ' + s.desc; list.push(x); }
    }
    return list;
  }
  function icon(item) {
    const c = document.createElement('canvas'), dpr = window.devicePixelRatio || 1, th = CL.theme;
    c.width = 40 * dpr; c.height = 28 * dpr; c.style.width = '40px'; c.style.height = '28px';
    const ctx = c.getContext('2d'), e = CL.create(item.t, item.p), b = e.bbox(), s = Math.min(36 / (b[2] - b[0]), 24 / (b[3] - b[1]), 0.9);
    ctx.scale(dpr, dpr); ctx.translate(20, 14); ctx.scale(s, s); ctx.translate(-(b[0] + b[2]) / 2, -(b[1] + b[3]) / 2);
    ctx.strokeStyle = th.fg; ctx.fillStyle = th.text; ctx.lineWidth = Math.max(1.6, 1.2 / s); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.font = '11px system-ui, sans-serif';
    CL.noLabels = true;
    try { e.draw(ctx, { th, sim: null, live: false, sel: false }); } finally { CL.noLabels = false; }
    return c;
  }
  function buildPalette() {
    const box = $('parts'), q = $('search').value.trim().toLowerCase(), items = paletteItems(), alias = q ? CL.partAlias(q) : null;
    box.textContent = '';
    for (const cat of CATS) {
      const list = items.filter(i => i.cat === cat && (!q || i.label.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || (alias && i.label.toLowerCase().startsWith(alias))));
      if (!list.length) continue;
      box.append(el('div', 'cat', cat));
      for (const item of list) {
        const b = el('button', 'part'); b.type = 'button'; b.title = item.tip || item.label;
        b.append(icon(item), el('span', '', item.label)); item.btn = b;
        b.addEventListener('click', () => ed.setMode('place', item));
        box.append(b);
      }
    }
    if (!box.children.length) box.append(el('div', 'cat', 'No parts match'));
  }

  /* ---------- properties ---------- */
  let propElm = null;
  function commit(e, k, v, quiet) { if (!quiet) ed.snapshot(); e.p[k] = v; e.onProp(); sim.invalidate(); app.docChanged(); }
  function renderProps() {
    const box = $('props'); box.textContent = ''; propElm = null;
    const sel = [...ed.sel], e = sel.length === 1 && sel[0].pins ? sel[0] : null;
    if (!e) {
      box.append(el('h3', '', sel.length ? sel.length + ' items selected' : 'Properties'));
      box.append(el('p', '', sel.length ? 'Drag to move, R to rotate, Del to delete.' : 'Select a part to edit its values and see live readings.'));
      if (!sel.length) box.append(el('p', '', 'New here? Try a circuit from the Examples menu, or open Help.'));
      return;
    }
    propElm = e; box.append(el('h3', '', e.title));
    for (const d of e.constructor.props || []) {
      if (d.type === 'hidden') continue;
      if (d.type === 'bool') {
        const lab = el('label', 'check'), inp = el('input'); inp.type = 'checkbox'; inp.checked = !!e.p[d.k];
        inp.addEventListener('change', () => commit(e, d.k, inp.checked)); lab.append(inp, d.label); box.append(lab); continue;
      }
      const lab = el('label', 'field', d.label); let inp;
      if (d.type === 'select') {
        inp = el('select'); for (const o of d.options) { const op = el('option', '', String(o)); op.value = o; inp.append(op); }
        inp.value = e.p[d.k]; inp.addEventListener('change', () => commit(e, d.k, typeof d.def === 'number' ? +inp.value : inp.value));
      } else if (d.type === 'range') {
        inp = el('input'); inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.01; inp.value = e.p[d.k];
        inp.addEventListener('input', () => commit(e, d.k, +inp.value, true));
      } else if (d.type === 'text') {
        inp = el('input'); inp.type = 'text'; inp.value = e.p[d.k]; inp.maxLength = 24;
        inp.addEventListener('change', () => commit(e, d.k, inp.value));
      } else {
        inp = el('input'); inp.type = 'text'; inp.spellcheck = false; inp.value = CL.fmt(e.p[d.k], d.unit).trim();
        inp.addEventListener('change', () => {
          const v = CL.parseSI(inp.value);
          if (!isFinite(v) || (d.min !== undefined && v < d.min)) { inp.classList.add('bad'); return; }
          inp.classList.remove('bad'); commit(e, d.k, v); inp.value = CL.fmt(v, d.unit).trim();
        });
      }
      lab.append(inp); box.append(lab);
    }
    const ro = el('div'); ro.id = 'readout'; box.append(ro);
  }
  app.selChanged = renderProps;
  function updateReadout() {
    const ro = $('readout'); if (!ro || !propElm) return;
    ro.textContent = sim.t > 0 && !app.dirty && propElm.nodes.length ? propElm.info(sim).join('\n') : '';
  }

  /* ---------- toolbar ---------- */
  $('run').addEventListener('click', app.toggleRun);
  $('reset').addEventListener('click', resetSim);
  $('dt').addEventListener('change', () => {
    const v = CL.parseSI($('dt').value);
    if (!(v > 0)) { $('dt').classList.add('bad'); return; }
    $('dt').classList.remove('bad'); sim.dt = v; sim.invalidate(); scope.setTiming(v); $('dt').value = CL.fmt(v, 's'); app.docChanged();
  });
  $('speed').addEventListener('input', () => { app.speed = +$('speed').value; });
  $('new').addEventListener('click', () => {
    if (ed.elements.length && !confirm('Clear the current circuit?')) return;
    loadDoc({ elements: [], wires: [], dt: 1e-5, speed: 50 });
  });
  $('save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(getDoc(), null, 1)], { type: 'application/json' }));
    a.download = 'circuit.cbench.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  let fileTarget = 'doc';
  $('open').addEventListener('click', () => { fileTarget = 'doc'; $('file').click(); });
  $('file').addEventListener('change', () => {
    const f = $('file').files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (fileTarget === 'doc') loadDoc(data); else importICs(data);
      } catch (err) { alert('Could not open that file: ' + err.message); }
      $('file').value = '';
    };
    rd.readAsText(f);
  });
  const exSel = $('examples');
  CL.examples.forEach((x, i) => { const o = el('option', '', x.name); o.value = i; exSel.append(o); });
  exSel.addEventListener('change', () => { if (exSel.value !== '') loadDoc(CL.examples[+exSel.value].build()); exSel.value = ''; exSel.blur(); });
  $('wire').addEventListener('click', () => ed.setMode(ed.mode === 'wire' ? 'select' : 'wire'));
  $('rot').addEventListener('click', () => ed.rotateSel());
  $('del').addEventListener('click', () => ed.deleteSel());
  $('undo').addEventListener('click', () => ed.undo());
  $('redo').addEventListener('click', () => ed.redo());
  $('zin').addEventListener('click', () => ed.zoomBy(1.25));
  $('zout').addEventListener('click', () => ed.zoomBy(0.8));
  $('zfit').addEventListener('click', () => ed.fit());
  $('search').addEventListener('input', buildPalette);
  $('help').addEventListener('click', () => $('helpDlg').showModal());
  $('helpClose').addEventListener('click', () => $('helpDlg').close());

  /* ---------- scope controls ---------- */
  for (const w of [1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]) { const o = el('option', '', CL.fmt(w, 's')); o.value = w; $('swin').append(o); }
  $('swin').addEventListener('change', () => { scope.setWindow(+$('swin').value); app.docChanged(); });
  $('smode').addEventListener('change', () => { scope.mode = $('smode').value; app.docChanged(); });
  $('strig').addEventListener('change', () => { scope.trig = $('strig').checked; app.docChanged(); });
  $('shide').addEventListener('click', () => { const h = $('scopeWrap').classList.toggle('hidden'); $('shide').textContent = h ? 'Show' : 'Hide'; });

  /* ---------- custom ICs ---------- */
  function refreshChips() {
    for (const e of ed.elements) if (e.type === 'ic') { e.init(); e.reset(); }
    store.set('circuitbench.ics', Object.values(CL.customDefs)); buildPalette(); renderICList(); app.docChanged();
  }
  function renderICList() {
    const box = $('icList'); box.textContent = '';
    for (const d of Object.values(CL.customDefs)) {
      const row = el('div', 'item');
      row.append(el('strong', '', d.name), el('code', '', d.outputs.map(o => o.name + ' = ' + o.expr).join('; ')));
      const ld = el('button', '', 'Edit'), rm = el('button', '', 'Remove');
      ld.addEventListener('click', () => {
        $('icName').value = d.name; $('icIn').value = d.inputs.join(', ');
        $('icOut').value = d.outputs.map(o => o.name + ' = ' + o.expr).join('\n');
      });
      rm.addEventListener('click', () => {
        if (ed.elements.some(e => e.type === 'ic' && e.p.chip === d.name)) { $('icErr').textContent = 'Remove the ' + d.name + ' chips from the circuit first.'; return; }
        CL.removeCustomIC(d.name); refreshChips();
      });
      row.append(ld, rm); box.append(row);
    }
  }
  function importICs(data) {
    const list = Array.isArray(data) ? data : data && Array.isArray(data.customICs) ? data.customICs : [data];
    let n = 0, last = '';
    for (const d of list) { try { CL.addCustomIC(d); n++; } catch (err) { last = err.message; } }
    $('icErr').textContent = n ? '' : 'No valid chips found in that file. ' + last;
    refreshChips();
  }
  $('ic').addEventListener('click', () => { $('icErr').textContent = ''; renderICList(); $('icDlg').showModal(); });
  $('icClose').addEventListener('click', () => $('icDlg').close());
  $('icAdd').addEventListener('click', () => {
    try {
      const outputs = $('icOut').value.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
        const k = s.indexOf('='); if (k < 1) throw new Error('Each output line needs the form NAME = expression');
        return { name: s.slice(0, k).trim(), expr: s.slice(k + 1).trim() };
      });
      const d = CL.addCustomIC({ name: $('icName').value.trim(), inputs: $('icIn').value.split(',').map(s => s.trim()).filter(Boolean), outputs });
      $('icErr').textContent = ''; refreshChips();
      $('icDlg').close(); ed.setMode('place', { t: 'ic', p: { chip: d.name } });
    } catch (err) { $('icErr').textContent = err.message; }
  });
  $('icImport').addEventListener('click', () => { fileTarget = 'ic'; $('file').click(); });
  $('icExport').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.values(CL.customDefs), null, 1)], { type: 'application/json' }));
    a.download = 'custom-ics.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- theme ---------- */
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() { CL.theme = mq.matches ? CL.themes.dark : CL.themes.light; buildPalette(); }
  mq.addEventListener('change', applyTheme);

  /* ---------- main loop ---------- */
  let frameNo = 0;
  function frame() {
    if (app.dirty) analyze();
    if (app.running && !sim.error) {
      const steps = Math.round(Math.pow(10, app.speed / 100 * 3)), t0 = performance.now();
      for (let i = 0; i < steps; i++) {
        if (!sim.step()) break;
        scope.sample(sim);
        if ((i & 7) === 7 && performance.now() - t0 > 22) break;
      }
    }
    ed.draw(); scope.draw(CL.theme);
    if (frameNo++ % 8 === 0) {
      const st = $('simtime'), msg = sim.error || sim.warn;
      st.textContent = msg || 't = ' + CL.fmt(sim.t, 's'); st.className = msg ? 'err' : '';
      updateReadout();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- start ---------- */
  for (const d of store.get('circuitbench.ics') || []) { try { CL.addCustomIC(d); } catch (err) { /* skip invalid */ } }
  CL.theme = mq.matches ? CL.themes.dark : CL.themes.light;
  app.modeChanged();
  let started = false;
  const saved = store.get('circuitbench.doc');
  if (saved && Array.isArray(saved.elements) && saved.elements.length) { try { loadDoc(saved); started = true; } catch (err) { /* fall back to example */ } }
  if (!started) loadDoc(CL.examples[0].build());
  requestAnimationFrame(frame);
})();
