/* Hub de citas · Mapas interactivos (Leaflet + red vial real de OpenStreetMap).
 * Cada mapa se crea una sola vez y se reubica en cada render, así conserva el zoom y los mosaicos.
 * Dibuja: límites de distritos, tráfico por tramo, ruta optimizada con flechas de sentido, paradas
 * numeradas con hora estimada, puntos A y B, rutas alternativas y la animación del motorizado. */
(function () {
  const H = window.Hub, D = H.data, R = H.routing, U = H.ui;
  const L = window.L;
  const N = D.nodes, E = D.edges;
  const LV = { fluido: '#2E8B57', moderado: '#D98E04', denso: '#C62828' };
  const ALT = ['#0F766E', '#6D4FC2', '#C2410C'];
  const CREW_COLORS = ['#0F766E', '#6D4FC2', '#C2410C'];
  const ZONE_LABEL = { 'Santa Anita': [-12.0545, -76.9855], 'Ate': [-12.0195, -76.9555], 'La Molina': [-12.0975, -76.9235] };
  const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ATTR = 'Mapa y calles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>';

  const entries = {}, pending = {};
  const ll = (i) => [N[i].lat, N[i].lng];
  const hm = (m) => H.store.hm(m);
  const esc = U.esc;

  /* ---------- Montaje ---------- */
  function slot(key, spec) {
    pending[key] = spec;
    return `<div class="lmap" data-lmap="${key}" style="height:${spec.height || '520px'}" role="region" aria-label="${esc(spec.label || 'Mapa')}"></div>`;
  }
  function mountAll() {
    if (!L) return;
    document.querySelectorAll('[data-lmap]').forEach((ph) => {
      const key = ph.dataset.lmap, spec = pending[key];
      if (!spec) return;
      let en = entries[key];
      if (!en) {
        const div = document.createElement('div');
        div.className = 'lmap-inner';
        ph.appendChild(div);
        const map = L.map(div, { preferCanvas: true, scrollWheelZoom: spec.wheel !== false, zoomSnap: 0.5 }).setView([-12.058, -76.945], 13);
        const tiles = L.tileLayer(TILE, { maxZoom: 19, attribution: ATTR }).addTo(map);
        // Sin conexión a los mosaicos: se dibuja la red vial propia como mapa base.
        tiles.once('tileerror', () => {
          const r = L.canvas({ padding: 0.3 }), base = L.layerGroup();
          E.forEach((e) => L.polyline(edgeCoords(e), { renderer: r, color: e.cls <= 2 ? '#B9BDB5' : '#D6D8D2', weight: e.cls <= 1 ? 4 : e.cls <= 2 ? 3 : 1.5, interactive: false }).addTo(base));
          base.addTo(map); base.eachLayer((l) => l.bringToBack && l.bringToBack());
          div.classList.add('no-tiles');
        });
        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
        en = entries[key] = { div, map, layer: L.layerGroup().addTo(map), sig: null };
      } else {
        ph.appendChild(en.div);
      }
      en.map.invalidateSize(false);
      en.layer.clearLayers();
      const ctx = { map: en.map, layer: en.layer, bounds: L.latLngBounds([]), en };
      en.timeline = null;
      spec.draw(ctx);
      if (spec.sig !== en.sig) {
        en.sig = spec.sig;
        stopAnim(en);
        if (ctx.bounds.isValid()) en.map.fitBounds(ctx.bounds, { padding: [36, 36], maxZoom: spec.maxZoom || 16 });
      } else if (en.anim && en.timeline) {
        en.anim.tl = en.timeline;
      }
    });
    for (const k in pending) delete pending[k];
  }

  /* ---------- Capas ---------- */
  function districts(ctx) {
    for (const [name, pts] of Object.entries(D.districts)) {
      L.polygon(pts, { color: '#0F766E', weight: 2, opacity: 0.55, dashArray: '6 6', fillColor: '#0F766E', fillOpacity: 0.035, interactive: false }).addTo(ctx.layer);
      L.marker(ZONE_LABEL[name], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'zone-tag', html: `<span>${name}</span>`, iconSize: null }) }).addTo(ctx.layer);
    }
  }
  function edgeCoords(e) { return [ll(e.a)].concat(e.geom, [ll(e.b)]); }
  function traffic(ctx, t, cond) {
    const r = L.canvas({ padding: 0.3 });
    E.forEach((e) => {
      if (e.cls > 2) return;
      const lv = R.edgeLevel(e, t, cond).key;
      L.polyline(edgeCoords(e), { renderer: r, color: LV[lv], weight: e.cls === 0 ? 4 : e.cls === 1 ? 3.5 : 2.5, opacity: 0.55, interactive: false }).addTo(ctx.layer);
    });
  }

  const dist = (p, q) => { const k = Math.cos((p[0] * Math.PI) / 180); return Math.hypot((q[0] - p[0]) * 111.32, (q[1] - p[1]) * 111.32 * k); };
  const bearing = (p, q) => (Math.atan2((q[1] - p[1]) * Math.cos((p[0] * Math.PI) / 180), q[0] - p[0]) * 180) / Math.PI;
  function arrows(ctx, coords, color, every = 0.45) {
    let acc = every / 2;
    for (let i = 1; i < coords.length; i++) {
      const d = dist(coords[i - 1], coords[i]);
      while (acc <= d) {
        const f = acc / d, p = [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f];
        const b = bearing(coords[i - 1], coords[i]);
        L.marker(p, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'arrow-ic', iconSize: [14, 14], html: `<svg viewBox="0 0 14 14" style="transform:rotate(${b}deg)"><path d="M7 1 12 12 7 9 2 12z" fill="${color}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>` }) }).addTo(ctx.layer);
        acc += every;
      }
      acc -= d;
    }
  }
  function line(ctx, coords, color, o = {}) {
    if (coords.length < 2) return;
    L.polyline(coords, { color: '#fff', weight: (o.weight || 6) + 4, opacity: o.opacity ?? 1, interactive: false, lineJoin: 'round' }).addTo(ctx.layer);
    const pl = L.polyline(coords, { color, weight: o.weight || 6, opacity: o.opacity ?? 1, dashArray: o.dash || null, lineJoin: 'round' }).addTo(ctx.layer);
    if (o.tip) pl.bindTooltip(o.tip, { sticky: true });
    if (o.onClick) pl.on('click', o.onClick);
    if (o.fit !== false) coords.forEach((c) => ctx.bounds.extend(c));
    if (o.arrows) arrows(ctx, coords, color);
    return pl;
  }
  function pin(ctx, latlng, html, cls, o = {}) {
    const m = L.marker(latlng, { icon: L.divIcon({ className: 'pin-wrap', html: `<div class="pin ${cls}">${html}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: o.z || 0, keyboard: !!o.popup, title: o.title || '' }).addTo(ctx.layer);
    if (o.popup) m.bindPopup(o.popup, { maxWidth: 260 });
    if (o.tip) m.bindTooltip(o.tip, { permanent: true, direction: 'right', offset: [16, 0], className: 'pin-tip' });
    ctx.bounds.extend(latlng);
    return m;
  }

  /* Ruta optimizada completa */
  function route(ctx, o, res, cond, x = {}) {
    const color = x.color || '#0F766E';
    const legs = res.legs.map((l) => ({ from: l.from, to: l.stop.n, t: l.depart, a: l.depart, b: l.arrive, label: 'Hacia ' + l.stop.label }))
      .concat([{ from: res.endLeg.from, to: res.endLeg.to, t: res.endLeg.depart, a: res.endLeg.depart, b: res.endLeg.arrive, label: 'Regreso al punto B' }]);
    const tl = { t0: o.depart, t1: res.finish, segs: [], stays: [] };
    legs.forEach((lg, i) => {
      const coords = R.pathCoords(lg.from, lg.to, lg.t, cond);
      const focus = x.focusLeg == null || x.focusLeg === i;
      line(ctx, coords, color, { weight: focus && x.focusLeg != null ? 9 : 7, opacity: focus ? 1 : 0.35, arrows: focus, tip: `Tramo ${i + 1} · ${Math.round(lg.b - lg.a)} min`, onClick: x.onLeg ? () => x.onLeg(i) : null, fit: x.focusLeg == null || focus });
      tl.segs.push({ a: lg.a, b: lg.b, coords, label: lg.label });
    });
    res.legs.forEach((l, i) => {
      const done = x.doneIds && x.doneIds.has(l.stop.id);
      const a = l.stop.a;
      const pop = `<div class="pop"><p class="pop-k">Parada ${i + 1}${a ? ' · ' + esc(a.id) : ''}</p><p class="pop-t">${esc(l.stop.label)}</p>${a ? `<p>${esc(a.address)}, ${a.zone}</p>` : l.stop.address ? `<p>${esc(l.stop.address)}</p>` : ''}<p>Franja <b>${l.stop.slot}</b></p><p>Llega ${hm(l.arrive)}${l.wait > 0.5 ? ` · espera ${Math.round(l.wait)} min` : ''}</p><p>Atención ${hm(l.start)}–${hm(l.finish)}</p>${l.late > 0.5 ? `<p class="pop-late">Llega ${Math.round(l.late)} min tarde</p>` : ''}${a ? `<p>${esc(a.status)}</p>` : ''}</div>`;
      pin(ctx, ll(l.stop.n), `<span>${i + 1}</span>`, `pin-stop ${done ? 'is-done' : ''} ${l.late > 0.5 ? 'is-late' : ''}`, { popup: pop, tip: x.tips === false ? null : `${hm(l.arrive)}`, z: 500, title: l.stop.label });
      tl.stays.push({ a: l.arrive, b: l.finish, pt: ll(l.stop.n), label: (l.wait > 0.5 ? 'Esperando la franja · ' : 'Atendiendo · ') + l.stop.label });
    });
    const place = (n) => Object.values(D.PLACES).find((p) => p.node === n);
    const pa = place(o.start), pb = place(o.end);
    pin(ctx, ll(o.start), 'A', 'pin-ab', { popup: `<div class="pop"><p class="pop-k">Punto A · salida ${hm(o.depart)}</p><p class="pop-t">${esc(pa ? pa.label : 'Salida')}</p>${pa ? `<p>${esc(pa.address)}, ${pa.zone}</p>` : ''}</div>`, tip: x.tips === false ? null : (pa ? pa.label : 'Salida'), z: 600 });
    pin(ctx, ll(o.end), 'B', 'pin-ab pin-b', { popup: `<div class="pop"><p class="pop-k">Punto B · llegada ${hm(res.finish)}</p><p class="pop-t">${esc(pb ? pb.label : 'Llegada')}</p>${pb ? `<p>${esc(pb.address)}, ${pb.zone}</p>` : ''}</div>`, tip: x.tips === false || o.end === o.start ? null : (pb ? pb.label : 'Llegada'), z: 600 });
    if (!ctx.en.timeline) ctx.en.timeline = tl;
    return tl;
  }

  /* Rutas alternativas entre dos puntos */
  function alts(ctx, list, sel, onSel) {
    list.forEach((p, i) => { if (i !== sel) line(ctx, p.coords, ALT[i % 3], { weight: 5, opacity: 0.85, dash: '9 8', tip: `${i === 0 ? 'Recomendada' : 'Alternativa ' + i} · ${Math.round(p.minutes)} min`, onClick: onSel ? () => onSel(i) : null }); });
    const p = list[sel];
    if (p) line(ctx, p.coords, ALT[sel % 3], { weight: 8, arrows: true, tip: `${sel === 0 ? 'Recomendada' : 'Alternativa ' + sel} · ${Math.round(p.minutes)} min` });
  }

  /* ---------- Animación del motorizado ---------- */
  const lenOf = (c) => { const cum = [0]; for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + dist(c[i - 1], c[i])); return cum; };
  function posAt(seg, f) {
    if (!seg.cum) seg.cum = lenOf(seg.coords);
    const tot = seg.cum[seg.cum.length - 1], d = tot * f;
    let i = 1; while (i < seg.cum.length - 1 && seg.cum[i] < d) i++;
    const a = seg.coords[i - 1], b = seg.coords[i], s = seg.cum[i] - seg.cum[i - 1] || 1, g = (d - seg.cum[i - 1]) / s;
    return [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g];
  }
  function stopAnim(en) {
    if (!en.anim) return;
    cancelAnimationFrame(en.anim.raf);
    en.anim.marker.remove(); en.anim.box.remove();
    en.anim = null;
  }
  function animate(key, seconds = 28) {
    const en = entries[key];
    if (!en || !en.timeline) return;
    stopAnim(en);
    const tl = en.timeline;
    const marker = L.marker(tl.segs[0].coords[0], { icon: L.divIcon({ className: 'moto-wrap', iconSize: [40, 40], iconAnchor: [20, 20], html: `<div class="moto">${U.icon('moto')}</div>` }), zIndexOffset: 2000, interactive: false }).addTo(en.map);
    const Box = L.Control.extend({ onAdd() { const d = L.DomUtil.create('div', 'anim-box'); d.setAttribute('aria-live', 'polite'); return d; } });
    const box = new Box({ position: 'topright' }).addTo(en.map);
    const start = performance.now();
    en.anim = { marker, box, raf: 0, tl };
    const step = (now) => {
      const T = en.anim.tl, p = Math.min(1, (now - start) / (seconds * 1000));
      const t = T.t0 + (T.t1 - T.t0) * p;
      let pos = null, label = '';
      for (const s of T.segs) if (t >= s.a && t <= s.b) { pos = posAt(s, s.b > s.a ? (t - s.a) / (s.b - s.a) : 1); label = s.label; break; }
      if (!pos) for (const s of T.stays) if (t >= s.a && t <= s.b) { pos = s.pt; label = s.label; break; }
      if (pos) marker.setLatLng(pos);
      box.getContainer().innerHTML = `<strong>${hm(t)}</strong><span>${esc(p >= 1 ? 'Ruta completada' : label)}</span>`;
      if (p < 1) en.anim.raf = requestAnimationFrame(step);
    };
    en.anim.raf = requestAnimationFrame(step);
  }
  function invalidate() { Object.values(entries).forEach((en) => { if (en.div.isConnected) en.map.invalidateSize(); }); }

  function legend(o = {}) {
    return `<div class="map-legend" aria-label="Leyenda del mapa">
      ${o.traffic !== false ? `<span><i class="lg-line" style="background:${LV.fluido}"></i>Tráfico fluido</span><span><i class="lg-line" style="background:${LV.moderado}"></i>Moderado</span><span><i class="lg-line" style="background:${LV.denso}"></i>Denso</span>` : ''}
      ${o.crews ? o.crews.map((c, i) => `<span><i class="lg-line lg-thick" style="background:${CREW_COLORS[i]}"></i>${c}</span>`).join('') : '<span><i class="lg-line lg-thick" style="background:#0F766E"></i>Ruta optimizada (con flechas de sentido)</span>'}
      ${o.alt ? '<span><i class="lg-line lg-alt"></i>Ruta alternativa</span>' : ''}
      <span><i class="lg-pin">1</i>Parada y hora de llegada</span><span><i class="lg-box">A</i>Salida</span><span><i class="lg-box lg-b">B</i>Llegada</span>
      <span><i class="lg-zone"></i>Límite de distrito</span>
    </div>`;
  }

  H.map = { slot, mountAll, districts, traffic, route, alts, line, pin, animate, invalidate, legend, ALT, CREW_COLORS, ll, ready: !!L };
})();
