/* Hub de citas · Motor de rutas sobre grafos.
 *
 * 1. Tráfico: cada tramo tiene un tiempo a flujo libre (km / velocidad por tipo de vía)
 *    multiplicado por un factor de congestión que depende de la hora del día (horas punta
 *    de mañana, mediodía y tarde), del tipo de vía y de eventos (lluvia, obras, ferias).
 * 2. Camino más rápido entre dos puntos: Dijkstra dependiente del tiempo (el costo de cada
 *    tramo se evalúa a la hora en que el motorizado llega a él).
 * 3. Rutas alternativas para un mismo destino: algoritmo de Yen (k caminos más cortos),
 *    filtrando las que se solapan demasiado.
 * 4. Orden óptimo de visitas desde A hasta B: programación dinámica tipo Held–Karp con
 *    ventanas horarias (franjas), conservando etiquetas Pareto (retraso, hora). Es exacta
 *    para el tamaño de una ruta diaria (hasta ~13 visitas).
 */
(function () {
  const H = window.Hub, D = H.data;
  const N = D.nodes, E = D.edges, ADJ = D.adj;
  const R = (H.routing = {});

  const SENS = { avenida: 1.5, principal: 0.9, calle: 0.35 };
  const gauss = (t, mu, s) => Math.exp(-((t - mu) ** 2) / (2 * s * s));
  function peak(tMin) {
    const t = tMin / 60;
    return gauss(t, 8, 0.9) + 0.9 * gauss(t, 18.5, 1.1) + 0.35 * gauss(t, 13.2, 0.8);
  }
  const condKey = (c = {}) => (c.lluvia ? 'L' : '') + (c.obra ? 'O' : '') + (c.feria ? 'F' : '');

  function trafficFactor(e, tMin, cond = {}) {
    let f = (1 + SENS[e.type] * peak(tMin)) * e.v;
    if (cond.lluvia) f *= 1.2;
    for (const inc of D.INCIDENTS) if (cond[inc.id] && inc.edges.includes(e.id)) f *= inc.factor;
    return f;
  }
  const freeMin = (e) => (e.km / D.SPEED[e.type]) * 60;
  const edgeMin = (e, t, cond) => freeMin(e) * trafficFactor(e, t, cond);

  function level(ratio) {
    if (ratio < 1.3) return { key: 'fluido', label: 'Fluido' };
    if (ratio < 1.8) return { key: 'moderado', label: 'Moderado' };
    return { key: 'denso', label: 'Denso' };
  }

  /* ---- Dijkstra dependiente del tiempo, desde un nodo y una hora de salida ---- */
  const cache = new Map();
  function dijkstraTD(src, t0, cond) {
    const key = src + '|' + t0 + '|' + condKey(cond);
    const hit = cache.get(key);
    if (hit) return hit;
    const n = N.length;
    const arr = new Float64Array(n).fill(Infinity), km = new Float64Array(n);
    const pn = new Int32Array(n).fill(-1), pe = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    arr[src] = t0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && arr[i] < best) { best = arr[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      for (const { to, e } of ADJ[u]) {
        const t = arr[u] + edgeMin(E[e], arr[u], cond);
        if (t < arr[to]) { arr[to] = t; km[to] = km[u] + E[e].km; pn[to] = u; pe[to] = e; }
      }
    }
    const res = { arr, km, pn, pe, t0 };
    cache.set(key, res);
    return res;
  }
  const bucket = (t) => Math.floor(t / 15) * 15; // tráfico por bloques de 15 minutos

  function leg(a, b, t, cond) {
    if (a === b) return { min: 0, km: 0 };
    const t0 = bucket(t), r = dijkstraTD(a, t0, cond);
    return { min: r.arr[b] - t0, km: r.km[b] };
  }
  function pathNodes(a, b, t, cond) {
    if (a === b) return [a];
    const r = dijkstraTD(a, bucket(t), cond), out = [b];
    let cur = b;
    while (cur !== a && r.pn[cur] >= 0) { cur = r.pn[cur]; out.push(cur); }
    return out.reverse();
  }

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
  function optimize(stops, o) {
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
    let best = null, bestScore = null;
    for (let i = 0; i < n; i++) {
      for (const lab of labels[full * n + i] || []) {
        const l = leg(stops[i].n, o.end, lab.t, o.cond);
        const score = [lab.late, lab.t + l.min, lab.travel + l.min];
        if (!bestScore || score[0] < bestScore[0] - 1e-9 ||
            (Math.abs(score[0] - bestScore[0]) < 1e-9 && (score[1] < bestScore[1] - 1e-9 ||
            (Math.abs(score[1] - bestScore[1]) < 1e-9 && score[2] < bestScore[2])))) { best = lab; bestScore = score; }
      }
    }
    const order = [];
    for (let l = best; l; l = l.prev) order.push(l.j);
    order.reverse();
    return simulate(stops, order, o);
  }

  /* Respaldo para rutas muy largas: vecino más cercano por franja + mejora 2-opt. */
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
    const order = stops.map((_, i) => i).sort((a, b) => stops[a].win[0] - stops[b].win[0] || N[stops[a].n].x - N[stops[b].n].x);
    return simulate(stops, order, o);
  }

  /* ---- Rutas alternativas (Yen) con pesos del tráfico a la hora de salida ---- */
  function dijStatic(src, dst, W, banE, banN) {
    const n = N.length, dist = new Float64Array(n).fill(Infinity), pn = new Int32Array(n).fill(-1), pe = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    dist[src] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === dst) break;
      done[u] = 1;
      for (const { to, e } of ADJ[u]) {
        if (banE.has(e) || banN.has(to)) continue;
        const d = dist[u] + W[e];
        if (d < dist[to]) { dist[to] = d; pn[to] = u; pe[to] = e; }
      }
    }
    if (!isFinite(dist[dst])) return null;
    const nodes = [dst], es = [];
    for (let c = dst; c !== src; c = pn[c]) { es.push(pe[c]); nodes.push(pn[c]); }
    return { nodes: nodes.reverse(), edges: es.reverse(), cost: dist[dst] };
  }
  function yen(src, dst, W, K) {
    const first = dijStatic(src, dst, W, new Set(), new Set());
    if (!first) return [];
    const A = [first], B = [];
    const sig = (p) => p.edges.join(',');
    for (let k = 1; k < K; k++) {
      const prev = A[k - 1];
      for (let i = 0; i < prev.nodes.length - 1; i++) {
        const spur = prev.nodes[i], rootN = prev.nodes.slice(0, i + 1), rootE = prev.edges.slice(0, i);
        const banE = new Set(), banN = new Set(rootN.slice(0, -1));
        for (const p of A) if (p.nodes.length > i && p.nodes.slice(0, i + 1).join(',') === rootN.join(',')) banE.add(p.edges[i]);
        const sp = dijStatic(spur, dst, W, banE, banN);
        if (!sp) continue;
        const cand = { nodes: rootN.concat(sp.nodes.slice(1)), edges: rootE.concat(sp.edges) };
        cand.cost = cand.edges.reduce((s, e) => s + W[e], 0);
        if (!A.concat(B).some((p) => sig(p) === sig(cand))) B.push(cand);
      }
      if (!B.length) break;
      B.sort((a, b) => a.cost - b.cost);
      A.push(B.shift());
    }
    return A;
  }
  function describe(p, t, cond) {
    let tt = t, free = 0, km = 0;
    const names = {};
    for (const ei of p.edges) {
      const e = E[ei];
      tt += edgeMin(e, tt, cond); free += freeMin(e); km += e.km;
      names[e.name] = (names[e.name] || 0) + e.km;
    }
    const via = Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
    const minutes = tt - t;
    return { nodes: p.nodes, edges: p.edges, minutes, km, free, via, level: level(free ? minutes / free : 1) };
  }
  function alternatives(a, b, t, cond, max = 3) {
    if (a === b) return [];
    const W = E.map((e) => edgeMin(e, t, cond));
    const cands = yen(a, b, W, 8).map((p) => describe(p, t, cond));
    const picked = [];
    for (const c of cands.sort((x, y) => x.minutes - y.minutes)) {
      const ok = picked.every((p) => {
        const s = new Set(p.edges);
        const shared = c.edges.filter((e) => s.has(e)).length;
        return shared / Math.min(c.edges.length, p.edges.length) < 0.7;
      });
      if (ok) picked.push(c);
      if (picked.length >= max) break;
    }
    return picked;
  }

  R.trafficFactor = trafficFactor;
  R.edgeLevel = (e, t, cond) => level(trafficFactor(e, t, cond));
  R.leg = leg;
  R.pathNodes = pathNodes;
  R.simulate = simulate;
  R.optimize = optimize;
  R.baseline = baseline;
  R.alternatives = alternatives;
  R.peak = peak;
})();
