/* CircuitBench — example circuits (grid coordinates) */
(function (G) {
  'use strict';
  const CL = G.CL;

  function B() {
    const els = [], ws = [];
    return {
      add(t, x, y, r, p) { els.push({ t, x, y, r: r || 0, p: p || {} }); },
      w(...pts) { for (let i = 0; i + 3 < pts.length; i += 2) ws.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3]]); },
      doc(extra) { return Object.assign({ app: 'circuitbench', version: 1, elements: els, wires: ws }, extra); }
    };
  }

  CL.examples = [
    { name: 'RC circuit (charge / discharge)', build() {
      const b = B();
      b.add('vac', 4, 4, 1, { wave: 'square', a: 2.5, off: 2.5, f: 100 });
      b.add('r', 6, 4, 0, { r: 1000 }); b.add('c', 12, 4, 1, { c: 1e-6 }); b.add('gnd', 4, 8);
      b.add('probe', 5, 4, 0, { name: 'Vin' }); b.add('probe', 12, 4, 0, { name: 'Vc' });
      b.w(4, 4, 6, 4); b.w(10, 4, 12, 4); b.w(4, 8, 12, 8);
      return b.doc({ dt: 2e-5, speed: 43, scope: { window: 0.02, mode: 'overlay', trig: true } });
    } },
    { name: 'Half-wave rectifier with filter', build() {
      const b = B();
      b.add('vac', 4, 4, 1, { wave: 'sine', a: 10, f: 50 });
      b.add('d', 6, 4, 0); b.add('c', 12, 4, 1, { c: 1e-4 }); b.add('r', 16, 4, 1, { r: 1000 }); b.add('gnd', 4, 8);
      b.add('probe', 5, 4, 0, { name: 'Vin' }); b.add('probe', 16, 4, 0, { name: 'Vout' });
      b.w(4, 4, 6, 4); b.w(10, 4, 12, 4, 16, 4); b.w(4, 8, 12, 8, 16, 8);
      return b.doc({ dt: 5e-5, speed: 53, scope: { window: 0.1, mode: 'overlay', trig: true } });
    } },
    { name: 'Common-emitter amplifier (BJT)', build() {
      const b = B();
      b.add('rail', 11, 2, 0, { v: 12 });
      b.add('r', 8, 2, 1, { r: 47000 }); b.add('r', 8, 7, 1, { r: 10000 });
      b.add('r', 14, 2, 1, { r: 4700 }); b.add('npn', 12, 6, 0, { beta: 100 }); b.add('r', 14, 8, 1, { r: 1000 });
      b.add('vac', 2, 7, 1, { wave: 'sine', a: 0.1, f: 1000 }); b.add('c', 3, 7, 0, { c: 1e-5 });
      b.add('gnd', 14, 12); b.add('probe', 2, 7, 0, { name: 'Vin' }); b.add('probe', 16, 6, 0, { name: 'Vout' });
      b.w(8, 2, 14, 2); b.w(8, 6, 8, 7); b.w(8, 7, 12, 7); b.w(2, 7, 3, 7); b.w(7, 7, 8, 7);
      b.w(8, 11, 8, 12); b.w(2, 11, 2, 12, 8, 12, 14, 12); b.w(14, 6, 16, 6);
      return b.doc({ dt: 2e-5, speed: 77, scope: { window: 0.005, mode: 'stacked', trig: true } });
    } },
    { name: 'Inverting op-amp (gain −10)', build() {
      const b = B();
      b.add('vac', 4, 4, 1, { wave: 'sine', a: 0.5, f: 1000 });
      b.add('r', 6, 4, 0, { r: 1000 }); b.add('r', 11, 1, 0, { r: 10000 }); b.add('opamp', 12, 4, 0);
      b.add('gnd', 4, 8); b.add('probe', 5, 4, 0, { name: 'Vin' }); b.add('probe', 19, 5, 0, { name: 'Vout' });
      b.w(4, 4, 6, 4); b.w(10, 4, 12, 4); b.w(10, 4, 10, 1, 11, 1); b.w(15, 1, 17, 1, 17, 5); b.w(16, 5, 17, 5, 19, 5);
      b.w(12, 6, 12, 8); b.w(4, 8, 12, 8);
      return b.doc({ dt: 1e-5, speed: 60, scope: { window: 0.005, mode: 'overlay', trig: true } });
    } },
    { name: '555 timer — LED flasher', build() {
      const b = B();
      b.add('555', 10, 4); b.add('rail', 19, 2, 0, { v: 5 });
      b.add('r', 20, 2, 1, { r: 1000 }); b.add('r', 20, 6, 1, { r: 47000 }); b.add('c', 20, 10, 1, { c: 1e-5 }); b.add('gnd', 20, 14);
      b.add('gnd', 6, 4); b.add('r', 4, 6, 1, { r: 330 }); b.add('led', 4, 10, 1, { color: 'red' }); b.add('gnd', 4, 14);
      b.add('probe', 5, 6, 0, { name: 'Out' }); b.add('probe', 20, 10, 1, { name: 'Vc' });
      b.w(16, 4, 18, 4, 18, 2, 20, 2); b.w(16, 5, 19, 5, 19, 6, 20, 6); b.w(16, 6, 17, 6, 17, 10, 20, 10);
      b.w(10, 5, 8, 5, 8, 9, 17, 9); b.w(10, 4, 6, 4); b.w(10, 6, 4, 6);
      return b.doc({ dt: 1e-4, speed: 74, scope: { window: 2, mode: 'stacked', trig: false } });
    } },
    { name: 'SR latch (NOR gates)', build() {
      const b = B();
      b.add('in', 4, 2, 0, { on: false }); b.add('in', 4, 10, 0, { on: true });
      b.add('gate', 10, 2, 0, { fn: 'nor' }); b.add('gate', 10, 8, 0, { fn: 'nor' });
      b.add('out', 20, 3, 0, { name: 'Q' }); b.add('out', 20, 9, 0, { name: 'Q̄' });
      b.w(6, 2, 10, 2); b.w(6, 10, 10, 10);
      b.w(14, 3, 16, 3, 20, 3); b.w(16, 3, 16, 5, 8, 5, 8, 8, 10, 8);
      b.w(14, 9, 16, 9, 20, 9); b.w(16, 9, 16, 7, 9, 7, 9, 4, 10, 4);
      return b.doc({ dt: 1e-3, speed: 41, scope: { window: 5, mode: 'stacked', trig: false } });
    } },
    { name: 'Full adder (gates)', build() {
      const b = B();
      b.add('in', 2, 2, 0, { on: true }); b.add('in', 2, 6, 0, { on: true }); b.add('in', 2, 14, 0, { on: false });
      b.add('gate', 8, 3, 0, { fn: 'xor' }); b.add('gate', 16, 5, 0, { fn: 'xor' });
      b.add('gate', 8, 9, 0, { fn: 'and' }); b.add('gate', 16, 11, 0, { fn: 'and' }); b.add('gate', 24, 10, 0, { fn: 'or' });
      b.add('out', 24, 6, 0, { name: 'Sum' }); b.add('out', 32, 11, 0, { name: 'Carry' });
      b.w(4, 2, 6, 2, 6, 3, 8, 3); b.w(6, 3, 6, 9, 8, 9);
      b.w(4, 6, 5, 6, 5, 5, 8, 5); b.w(5, 6, 5, 11, 8, 11);
      b.w(12, 4, 14, 4, 14, 5, 16, 5); b.w(14, 5, 14, 11, 16, 11);
      b.w(4, 14, 15, 14, 15, 13, 16, 13); b.w(15, 13, 15, 7, 16, 7);
      b.w(20, 6, 24, 6); b.w(12, 10, 24, 10); b.w(20, 12, 24, 12); b.w(28, 11, 32, 11);
      return b.doc({ dt: 1e-3, speed: 41, scope: { window: 5, mode: 'stacked', trig: false } });
    } },
    { name: '7400 NAND test (from Multisim Design2)', build() {
      const b = B();
      b.add('in', 4, 2, 0, { on: false }); b.add('in', 4, 12, 0, { on: false });   // U2, U3
      b.add('ic', 14, 4, 0, { chip: '7400' }); b.add('rail', 26, 4, 0, { v: 5 }); b.add('gnd', 11, 14);
      b.add('out', 28, 7, 0, { name: 'X1' });
      b.w(6, 2, 12, 2, 12, 4, 14, 4); b.w(7, 2, 7, 7, 14, 7);                         // U2 -> 1A, 2A
      b.w(6, 12, 10, 12, 10, 5, 14, 5); b.w(10, 8, 14, 8); b.w(10, 12, 23, 12, 23, 9, 20, 9); // U3 -> 1B, 2B, 3A
      b.w(14, 6, 13, 6, 13, 1, 22, 1, 22, 6, 20, 6);                                  // 1Y -> 4A
      b.w(14, 9, 12, 9, 12, 11, 21, 11, 21, 8, 20, 8);                                // 2Y -> 3B
      b.w(20, 10, 24, 10, 24, 5, 20, 5);                                              // 3Y -> 4B
      b.w(20, 7, 28, 7); b.w(20, 4, 26, 4); b.w(14, 10, 11, 10, 11, 14);              // 4Y -> X1, VCC, GND
      return b.doc({ dt: 1e-3, speed: 41, scope: { window: 5, mode: 'stacked', trig: false } });
    } },
    { name: 'Decade counter (7490 + 7448 + display)', build() {
      const b = B();
      b.add('clk', 4, 1, 0, { f: 2 }); b.add('ic', 10, 4, 0, { chip: '7490' }); b.add('ic', 26, 4, 0, { chip: '7448' });
      b.add('seg7', 42, 4, 0, { low: false }); b.add('probe', 12, 1, 0, { name: 'Clk' });
      b.w(6, 1, 17, 1, 17, 4, 16, 4);                       // clock -> CKA
      b.w(16, 6, 19, 6, 19, 2, 8, 2, 8, 4, 10, 4);          // QA -> CKB
      b.w(19, 6, 21, 6, 21, 10, 26, 10);                    // QA -> A
      b.w(16, 9, 20, 9, 20, 4, 26, 4);                      // QB -> B
      b.w(16, 10, 18, 10, 18, 12, 24, 12, 24, 5, 26, 5);    // QC -> C
      b.w(16, 7, 22, 7, 22, 9, 26, 9);                      // QD -> D
      const seg = (sy, x, dy) => b.w(32, sy, x, sy, x, dy, 42, dy);
      seg(7, 33, 4); seg(8, 38, 5); seg(9, 36, 6); seg(10, 34, 7); seg(11, 39, 8); seg(5, 37, 9); seg(6, 35, 10);
      return b.doc({ dt: 1e-3, speed: 41, scope: { window: 5, mode: 'stacked', trig: false } });
    } }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
