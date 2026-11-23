/* Hub de citas · Mapa esquemático en SVG (no es un mapa real).
 * Dibuja la red vial del grafo coloreada por tráfico, la ruta optimizada,
 * las paradas numeradas, el punto de partida A, el punto final B y las rutas alternativas. */
(function () {
  const H = window.Hub, D = H.data, R = H.routing, U = H.ui;
  const N = D.nodes;
  const LV = { fluido: '#3f8f5b', moderado: '#c27c12', denso: '#c0392b' };
  const ALT = ['#0F766E', '#6d4fc2', '#b4531b'];

  const pts = (ids) => ids.map((i) => N[i].x + ',' + N[i].y).join(' ');

  function svg(o) {
    const { opts, result, time = 480, cond = {}, focusLeg = null, alts = null, altSel = 0, compact = false, doneIds = new Set(), title = 'Mapa de ruta' } = o;
    let s = `<svg class="map-svg" viewBox="0 0 980 620" role="img" aria-label="${U.esc(title)}"><title>${U.esc(title)}</title>`;
    // Distritos
    s += `<rect x="0" y="0" width="420" height="620" class="zone-sa"/><rect x="420" y="0" width="560" height="370" class="zone-ate"/><rect x="420" y="370" width="560" height="250" class="zone-lm"/>`;
    s += `<text x="24" y="604" class="zone-label">SANTA ANITA</text><text x="956" y="30" text-anchor="end" class="zone-label">ATE</text><text x="956" y="604" text-anchor="end" class="zone-label">LA MOLINA</text>`;
    // Red vial coloreada por tráfico a la hora indicada
    for (const e of D.edges) {
      const a = N[e.a], b = N[e.b], lv = R.edgeLevel(e, time, cond).key;
      const w = e.type === 'avenida' ? 7 : e.type === 'principal' ? 5 : 3.5;
      s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="road" stroke-width="${w + 3}"/>`;
      s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${LV[lv]}" stroke-width="${w}" stroke-linecap="round" opacity=".55"><title>${U.esc(e.name)} · tráfico ${lv}</title></line>`;
    }
    if (!compact) {
      const labels = [['Carretera Central', 0, 2], ['Av. Javier Prado Este', 2, 4], ['Av. La Molina', null, 4], ['Vía de Evitamiento', null, 2], ['Av. Raúl Ferrero', 4, 4]];
      for (const [name, r, c] of labels) {
        if (r === null) { const n1 = N[D.idx['n1' + c]], n2 = N[D.idx['n2' + c]]; s += `<text x="${n1.x + 9}" y="${(n1.y + n2.y) / 2 + 30}" class="road-label" transform="rotate(90 ${n1.x + 9} ${(n1.y + n2.y) / 2 + 30})">${name}</text>`; }
        else { const n1 = N[D.idx['n' + r + c]]; s += `<text x="${n1.x + 12}" y="${n1.y - 9}" class="road-label">${name}</text>`; }
      }
    }
    for (const n of N) s += `<circle cx="${n.x}" cy="${n.y}" r="2.6" class="node"/>`;

    // Rutas alternativas del tramo seleccionado
    if (alts && alts.length) {
      alts.forEach((p, i) => {
        if (i === altSel) return;
        s += `<polyline points="${pts(p.nodes)}" fill="none" stroke="${ALT[i % 3]}" stroke-width="6" stroke-dasharray="10 9" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
      });
      const p = alts[altSel];
      if (p) s += `<polyline points="${pts(p.nodes)}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts(p.nodes)}" fill="none" stroke="${ALT[altSel % 3]}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (!result) {
        const a = N[alts[0].nodes[0]], b = N[alts[0].nodes[alts[0].nodes.length - 1]];
        s += `<g class="mk-ab"><rect x="${a.x - 15}" y="${a.y - 15}" width="30" height="30" rx="7"/><text x="${a.x}" y="${a.y + 5}" text-anchor="middle">●</text></g>`;
        s += `<g class="mk-stop is-focus"><circle cx="${b.x}" cy="${b.y}" r="15"/><text x="${b.x}" y="${b.y + 5}" text-anchor="middle">★</text></g>`;
      }
    }

    // Ruta optimizada
    if (result && opts) {
      const legs = result.legs.map((l) => ({ from: l.from, to: l.stop.n, t: l.depart })).concat([{ from: result.endLeg.from, to: result.endLeg.to, t: result.endLeg.depart }]);
      legs.forEach((l, i) => {
        const p = R.pathNodes(l.from, l.to, l.t, cond);
        if (p.length < 2) return;
        const dim = (focusLeg !== null && focusLeg !== i) || (alts && alts.length);
        s += `<polyline points="${pts(p)}" fill="none" stroke="#fff" stroke-width="${dim ? 7 : 11}" stroke-linecap="round" stroke-linejoin="round" opacity="${dim ? .6 : 1}"/>`;
        s += `<polyline points="${pts(p)}" fill="none" stroke="#0F766E" stroke-width="${dim ? 3 : 6}" stroke-linecap="round" stroke-linejoin="round" opacity="${dim ? .45 : 1}" ${i === result.legs.length ? 'stroke-dasharray="2 9"' : ''}/>`;
      });
      const seen = {};
      const off = (n) => { seen[n] = (seen[n] || 0) + 1; return (seen[n] - 1) * 16; };
      const mark = (n, label, cls) => { const d = off(n), x = N[n].x + d, y = N[n].y - d; return `<g class="${cls}"><rect x="${x - 15}" y="${y - 15}" width="30" height="30" rx="7"/><text x="${x}" y="${y + 5}" text-anchor="middle">${label}</text></g>`; };
      s += mark(opts.start, 'A', 'mk-ab');
      result.legs.forEach((l, i) => {
        const n = l.stop.n, d = off(n), x = N[n].x + d, y = N[n].y - d;
        const done = doneIds.has(l.stop.id);
        s += `<g class="mk-stop ${done ? 'is-done' : ''} ${focusLeg === i ? 'is-focus' : ''}"><circle cx="${x}" cy="${y}" r="15"/><text x="${x}" y="${y + 5}" text-anchor="middle">${i + 1}</text><title>${i + 1}. ${U.esc(l.stop.label)} · ${l.stop.slot || ''}</title></g>`;
      });
      s += mark(opts.end, 'B', 'mk-ab');
    }
    s += '</svg>';
    return s;
  }

  function legend(withAlt) {
    return `<div class="map-legend" aria-label="Leyenda del mapa">
      <span><i class="lg-line" style="background:${LV.fluido}"></i>Tráfico fluido</span>
      <span><i class="lg-line" style="background:${LV.moderado}"></i>Moderado</span>
      <span><i class="lg-line" style="background:${LV.denso}"></i>Denso</span>
      <span><i class="lg-line lg-route"></i>Ruta optimizada</span>
      ${withAlt ? '<span><i class="lg-line lg-alt"></i>Alternativa</span>' : ''}
      <span><i class="lg-box">A</i>Partida</span><span><i class="lg-box">B</i>Llegada</span>
    </div>`;
  }

  H.map = { svg, legend, ALT };
})();
