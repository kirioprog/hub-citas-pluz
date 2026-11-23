/* Hub de citas · Motor de rutas sobre la red vial real (grafo dirigido de OpenStreetMap).
 *
 * 1. Tráfico: el tiempo de cada tramo es su tiempo a flujo libre (longitud / velocidad según el
 *    tipo de vía) multiplicado por un factor de congestión que depende de la hora del día (horas
 *    punta de mañana, mediodía y tarde), del tipo de vía y de eventos (lluvia, obras, accidentes).
 * 2. Camino más rápido entre dos puntos: Dijkstra dependiente del tiempo con montículo binario
 *    (cada tramo se evalúa a la hora en que el motorizado llega a él) y respetando sentidos únicos.
 * 3. Rutas alternativas al mismo destino: método de penalización (cada ruta encontrada encarece
 *    sus tramos y se vuelve a buscar), descartando las que se solapan demasiado.
 * 4. Orden óptimo de visitas desde A hasta B: programación dinámica tipo Held–Karp con ventanas
 *    horarias (franjas) y etiquetas Pareto. Exacta para una ruta diaria (hasta ~13 visitas).
 * 5. Indicaciones giro a giro a partir de la geometría y los nombres de las calles.
 */
(function () {
  const H = window.Hub, D = H.data;
  const N = D.nodes, E = D.edges, ADJ = D.adj, CL = D.CLASSES;
  const R = (H.routing = {});

  const gauss = (t, mu, s) => Math.exp(-((t - mu) ** 2) / (2 * s * s));
  const PEAK = new Float64Array(24 * 60 + 1);
  for (let m = 0; m <= 1440; m++) { const t = m / 60; PEAK[m] = gauss(t, 8, 0.9) + 0.9 * gauss(t, 18.5, 1.1) + 0.35 * gauss(t, 13.2, 0.8); }
  const peak = (t) => PEAK[Math.max(0, Math.min(1440, Math.round(t)))];
  const condKey = (c = {}) => D.INCIDENTS.map((i) => (c[i.id] ? i.id[0] : '')).join('') + (c.lluvia ? 'L' : '');

  function trafficFactor(e, t, cond = {}) {
    let f = (1 + CL[e.cls].sens * peak(t)) * e.v;
    if (cond.lluvia) f *= 1.2;
    for (const id of e.inc) if (cond[id]) f *= D.INCIDENTS.find((x) => x.id === id).factor;
    return f;
  }
  const freeMin = (e) => (e.m / 1000 / CL[e.cls].speed) * 60;
  const edgeMin = (e, t, cond) => freeMin(e) * trafficFactor(e, t, cond);
  function level(ratio) {
    if (ratio < 1.35) return { key: 'fluido', label: 'Fluido' };
    if (ratio < 1.9) return { key: 'moderado', label: 'Moderado' };
    return { key: 'denso', label: 'Denso' };
  }

  /* ---- Montículo binario mínimo ---- */
  function Heap(n) { this.k = new Float64Array(n * 4 + 16); this.v = new Int32Array(n * 4 + 16); this.n = 0; }
  Heap.prototype.push = function (key, val) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2); k.set(this.k); this.k = k; const v = new Int32Array(this.v.length * 2); v.set(this.v); this.v = v; }
    let i = this.n++; const K = this.k, V = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = key; V[i] = val;
  };
  Heap.prototype.pop = function () {
    const K = this.k, V = this.v, top = V[0], topK = K[0];
    const n = --this.n, key = K[n], val = V[n];
    let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= key) break; K[i] = K[c]; V[i] = V[c]; i = c; }
    K[i] = key; V[i] = val;
    this.topK = topK;
    return top;
  };

  /* ---- Dijkstra dependiente del tiempo (con caché por hora de salida) ---- */
  const cache = new Map();
  function dijkstraTD(src, t0, cond) {
    const key = src + '|' + t0 + '|' + condKey(cond);
    const hit = cache.get(key);
    if (hit) return hit;
    const n = N.length;
    const arr = new Float64Array(n).fill(Infinity), m = new Float64Array(n);
    const pn = new Int32Array(n).fill(-1), pe = new Int32Array(n).fill(-1), prev = new Uint8Array(n), done = new Uint8Array(n);
    const h = new Heap(n);
    arr[src] = t0; h.push(t0, src);
    while (h.n) {
      const u = h.pop();
      if (done[u]) continue;
      done[u] = 1;
      const tu = arr[u];
      for (const a of ADJ[u]) {
        const e = E[a.e], t = tu + edgeMin(e, tu, cond);
        if (t < arr[a.to]) { arr[a.to] = t; m[a.to] = m[u] + e.m; pn[a.to] = u; pe[a.to] = a.e; prev[a.to] = a.rev ? 1 : 0; h.push(t, a.to); }
      }
    }
    const res = { arr, m, pn, pe, prev, t0 };
    if (cache.size > 500) cache.clear();
    cache.set(key, res);
    return res;
  }
  const bucket = (t) => Math.floor(t / 30) * 30; // tráfico por bloques de 30 minutos

  function leg(a, b, t, cond) {
    if (a === b) return { min: 0, km: 0 };
    const t0 = bucket(t), r = dijkstraTD(a, t0, cond);
    return { min: r.arr[b] - t0, km: r.m[b] / 1000 };
  }
  /* Tramos (con sentido) del camino más rápido */
  function pathSteps(a, b, t, cond) {
    if (a === b) return [];
    const r = dijkstraTD(a, bucket(t), cond), out = [];
    for (let c = b; c !== a && r.pn[c] >= 0; c = r.pn[c]) out.push({ e: r.pe[c], rev: !!r.prev[c] });
    return out.reverse();
  }
  function stepCoords(s) {
    const e = E[s.e];
    const pts = [[N[e.a].lat, N[e.a].lng]].concat(e.geom, [[N[e.b].lat, N[e.b].lng]]);
    return s.rev ? pts.reverse() : pts;
  }
  function coordsOf(steps, from) {
    const out = from != null ? [[N[from].lat, N[from].lng]] : [];
    for (const s of steps) { const p = stepCoords(s); out.push(...(out.length ? p.slice(1) : p)); }
    return out;
  }
  const pathCoords = (a, b, t, cond) => coordsOf(pathSteps(a, b, t, cond), a);

  /* ---- Simulación de una ruta en un orden dado ---- */
  function simulate(stops, order, o) {
    let t = o.depart, cur = o.start, travel = 0, km = 0, late = 0, lateCount = 0, wait = 0;
    const legs = [];
    for (const i of order) {
      const s = stops[i], l = leg(cur, s.n, t, o.cond);
      const arrive = t + l.min, start = Math.max(arrive, s.win[0]);
      const lt = Math.max(0, arrive - s.win[1]);
      legs.push({ stop: s, from: cur, depart: t, travel: l.min, km: l.km, arrive, start, wait: start - arrive, late: lt, finish: start + o.service });
      travel += l.min; km += l.km; wait += start - arrive; late += lt; if (lt > 0) lateCount++;
      t = start + o.service; cur = s.n;
    }
    const last = leg(cur, o.end, t, o.cond);
    travel += last.min; km += last.km;
    const endLeg = { from: cur, to: o.end, depart: t, travel: last.min, km: last.km, arrive: t + last.min };
    return { legs, endLeg, travel, km, wait, late, lateCount, finish: t + last.min, order: order.slice() };
  }

  /* ---- Orden óptimo: programación dinámica con etiquetas Pareto ---- */
  const memo = new Map();
  function optimize(stops, o) {
    const key = stops.map((s) => s.id + '@' + s.n + ':' + s.win[0]).join('|') + '#' + [o.start, o.end, o.depart, o.service, condKey(o.cond)].join(',');
    const hit = memo.get(key);
    if (hit) return hit;
    const res = optimizeRaw(stops, o);
    if (memo.size > 400) memo.clear();
    memo.set(key, res);
    return res;
  }
  function optimizeRaw(stops, o) {
    const n = stops.length;
    if (n === 0) return simulate(stops, [], o);
    if (n > 13) return heuristic(stops, o);
    const full = (1 << n) - 1;
    const labels = new Array((1 << n) * n);
    const put = (mask, j, lab) => {
      const k = mask * n + j;
      const list = labels[k] || (labels[k] = []);
      for (const x of list) if (x.late <= lab.late && x.t <= lab.t && x.travel <= lab.travel) return;
      labels[k] = list.filter((x) => !(lab.late <= x.late && lab.t <= x.t && lab.travel <= x.travel));
      labels[k].push(lab);
    };
    const extend = (from, t, j) => {
      const s = stops[j], l = leg(from, s.n, t, o.cond);
      const arrive = t + l.min, start = Math.max(arrive, s.win[0]);
      return { late: Math.max(0, arrive - s.win[1]), t: start + o.service, travel: l.min };
    };
    for (let j = 0; j < n; j++) {
      const x = extend(o.start, o.depart, j);
      put(1 << j, j, { late: x.late, t: x.t, travel: x.travel, j, prev: null });
    }
    for (let mask = 1; mask <= full; mask++) {
      for (let i = 0; i < n; i++) {
        const list = labels[mask * n + i];
        if (!list) continue;
        for (const lab of list) {
          for (let j = 0; j < n; j++) {
            if (mask & (1 << j)) continue;
            const x = extend(stops[i].n, lab.t, j);
            put(mask | (1 << j), j, { late: lab.late + x.late, t: x.t, travel: lab.travel + x.travel, j, prev: lab });
          }
        }
      }
    }
    let best = null, bs = null;
    for (let i = 0; i < n; i++) {
      for (const lab of labels[full * n + i] || []) {
        const l = leg(stops[i].n, o.end, lab.t, o.cond);
        const sc = [lab.late, lab.t + l.min, lab.travel + l.min];
        if (!bs || sc[0] < bs[0] - 1e-9 || (Math.abs(sc[0] - bs[0]) < 1e-9 && (sc[1] < bs[1] - 1e-9 || (Math.abs(sc[1] - bs[1]) < 1e-9 && sc[2] < bs[2])))) { best = lab; bs = sc; }
      }
    }
    const order = [];
    for (let l = best; l; l = l.prev) order.push(l.j);
    order.reverse();
    return simulate(stops, order, o);
  }
  function heuristic(stops, o) {
    let order = stops.map((_, i) => i).sort((a, b) => stops[a].win[0] - stops[b].win[0]);
    const cost = (ord) => { const s = simulate(stops, ord, o); return s.late * 1000 + s.finish; };
    let best = cost(order), improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < order.length - 1; i++) for (let k = i + 1; k < order.length; k++) {
        const cand = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
        const c = cost(cand);
        if (c < best) { best = c; order = cand; improved = true; }
      }
    }
    return simulate(stops, order, o);
  }
  /* Orden de referencia sin optimizar: por inicio de franja y luego de oeste a este. */
  function baseline(stops, o) {
    const order = stops.map((_, i) => i).sort((a, b) => stops[a].win[0] - stops[b].win[0] || N[stops[a].n].lng - N[stops[b].n].lng);
    return simulate(stops, order, o);
  }

  /* ---- Rutas alternativas: método de penalización ---- */
  function dijStatic(src, dst, W) {
    const n = N.length, dist = new Float64Array(n).fill(Infinity), pn = new Int32Array(n).fill(-1), pe = new Int32Array(n).fill(-1), pr = new Uint8Array(n), done = new Uint8Array(n);
    const h = new Heap(n);
    dist[src] = 0; h.push(0, src);
    while (h.n) {
      const u = h.pop();
      if (done[u]) continue;
      done[u] = 1;
      if (u === dst) break;
      for (const a of ADJ[u]) {
        const d = dist[u] + W[a.e];
        if (d < dist[a.to]) { dist[a.to] = d; pn[a.to] = u; pe[a.to] = a.e; pr[a.to] = a.rev ? 1 : 0; h.push(d, a.to); }
      }
    }
    if (!isFinite(dist[dst])) return null;
    const steps = [];
    for (let c = dst; c !== src; c = pn[c]) steps.push({ e: pe[c], rev: !!pr[c] });
    return steps.reverse();
  }
  function describe(steps, from, t, cond) {
    let tt = t, free = 0, km = 0;
    const names = {};
    for (const s of steps) {
      const e = E[s.e];
      tt += edgeMin(e, tt, cond); free += freeMin(e); km += e.m / 1000;
      if (e.name) names[e.name] = (names[e.name] || 0) + e.m;
    }
    const via = Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => short(x[0]));
    const minutes = tt - t;
    return { steps, minutes, km, free, via, level: level(free ? minutes / free : 1), coords: coordsOf(steps, from) };
  }
  function alternatives(a, b, t, cond, max = 3) {
    if (a === b) return [];
    const W = new Float64Array(E.length);
    E.forEach((e, i) => { W[i] = edgeMin(e, t, cond); });
    const picked = [], sigs = new Set();
    for (let k = 0; k < 7 && picked.length < max; k++) {
      const steps = dijStatic(a, b, W);
      if (!steps) break;
      const sig = steps.map((s) => s.e).join(',');
      const set = new Set(steps.map((s) => s.e));
      const distinct = picked.every((p) => {
        let shared = 0, tot = 0;
        for (const s of p.steps) { tot += E[s.e].m; if (set.has(s.e)) shared += E[s.e].m; }
        return shared / tot < 0.72;
      });
      if (!sigs.has(sig) && distinct) { picked.push(describe(steps, a, t, cond)); sigs.add(sig); }
      for (const s of steps) W[s.e] *= 1.6;
    }
    return picked.sort((x, y) => x.minutes - y.minutes);
  }

  /* ---- Indicaciones giro a giro ---- */
  const short = (n) => n.replace(/^Avenida /, 'Av. ').replace(/^Jirón /, 'Jr. ').replace(/^Prolongación /, 'Prol. ');
  function bearing(p, q) {
    const y = (q[1] - p[1]) * Math.cos((p[0] * Math.PI) / 180), x = q[0] - p[0];
    return (Math.atan2(y, x) * 180) / Math.PI;
  }
  const CARD = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  function directions(steps) {
    const groups = [];
    for (const s of steps) {
      const e = E[s.e], pts = stepCoords(s), name = e.name || '';
      const g = groups[groups.length - 1];
      if (g && g.name === name) { g.m += e.m; g.pts.push(...pts.slice(1)); }
      else groups.push({ name, m: e.m, pts });
    }
    // Absorbe tramos muy cortos (cruces, empalmes) y vuelve a unir calles repetidas.
    for (let i = 1; i < groups.length - 1; i++) {
      if (groups[i].m < 60) { groups[i - 1].m += groups[i].m; groups[i - 1].pts.push(...groups[i].pts.slice(1)); groups.splice(i, 1); i--; }
    }
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].name === groups[i - 1].name) { groups[i - 1].m += groups[i].m; groups[i - 1].pts.push(...groups[i].pts.slice(1)); groups.splice(i, 1); i--; }
    }
    const out = [];
    groups.forEach((g, i) => {
      const label = g.name ? short(g.name) : 'una calle sin nombre';
      if (i === 0) {
        const b = (bearing(g.pts[0], g.pts[Math.min(3, g.pts.length - 1)]) + 360) % 360;
        out.push({ icon: 'nav', text: `Sal por ${label} hacia el ${CARD[Math.round(b / 45) % 8]}`, m: g.m });
        return;
      }
      const prev = groups[i - 1];
      const bin = bearing(prev.pts[Math.max(0, prev.pts.length - 2)], prev.pts[prev.pts.length - 1]);
      const bout = bearing(g.pts[0], g.pts[Math.min(1, g.pts.length - 1)]);
      let d = bout - bin; while (d > 180) d -= 360; while (d < -180) d += 360;
      let verb;
      if (Math.abs(d) < 25) verb = 'Continúa por';
      else if (Math.abs(d) > 155) verb = 'Da la vuelta en';
      else if (d > 0) verb = d > 60 ? 'Gira a la derecha en' : 'Mantente a la derecha en';
      else verb = d < -60 ? 'Gira a la izquierda en' : 'Mantente a la izquierda en';
      out.push({ icon: d > 25 ? 'right' : d < -25 ? 'left' : 'up', text: `${verb} ${label}`, m: g.m });
    });
    out.push({ icon: 'flag', text: 'Llegas a tu destino', m: 0 });
    return out;
  }

  R.trafficFactor = trafficFactor;
  R.edgeLevel = (e, t, cond) => level(trafficFactor(e, t, cond));
  R.leg = leg;
  R.pathSteps = pathSteps;
  R.pathCoords = pathCoords;
  R.simulate = simulate;
  R.optimize = optimize;
  R.baseline = baseline;
  R.alternatives = alternatives;
  R.directions = directions;
  R.short = short;
  R.peak = peak;
})();
