/* Hub de citas · Vista del contratista (planificador).
 * IMPORTANTE: aquí nunca se muestra DNI ni documentos del cliente.
 * Solo nombre, teléfono, dirección, franja y estado. */
(function () {
  const H = window.Hub, D = H.data, U = H.ui, st = H.store, S = H.S, A = st.actions, R = H.routing;
  const { esc, icon, chip, tag, btn, select, field } = U;
  const head = (...x) => H.views.head(...x);

  const workdays = () => { const out = []; let d = D.today; while (out.length < 6) { if (D.slotsFor(d).length) out.push(d); d = D.addDays(d, 1); } return out; };
  const mine = () => st.appts.filter((a) => a.contractor === S.contractor);
  const newCount = () => st.changes.filter((c) => c.contractor === S.contractor && c.seq > st.lastSeen[S.contractor]).length;
  const LOCKED = ['Cancelada', 'Realizada', 'Cliente ausente'];

  H.views.contratista = function () {
    const page = S.page.contratista;
    const items = [
      { key: 'agenda', label: 'Agenda', icon: 'calendar' },
      { key: 'cambios', label: 'Cambios', icon: 'refresh', badge: newCount() || '' },
      { key: 'cuadrillas', label: 'Cuadrillas', icon: 'team' },
      { key: 'rutas', label: 'Rutas', icon: 'route' }
    ];
    const topExtra = `<label class="top-select"><span class="sr-only">Empresa contratista</span>${select('conSel', [['A', 'Contratista A'], ['B', 'Contratista B']], S.contractor, { id: 'con-sel', label: 'Empresa contratista' })}</label>`;
    return H.views.shell(items, page, { agenda, cambios, cuadrillas, rutas }[page](), topExtra);
  };
  H.change.conSel = (v) => {
    if (S.page.contratista === 'cambios') st.lastSeen[S.contractor] = st.seq;
    S.contractor = v; S.lab.leg = null;
  };

  function dayTabs(act, current) {
    return `<div class="day-tabs" role="tablist" aria-label="Día">${workdays().map((d) => {
      const n = mine().filter((a) => a.date === d && a.status !== 'Pendiente de contacto').length;
      return `<button role="tab" class="day-tab ${current === d ? 'is-on' : ''}" aria-selected="${current === d}" data-act="${act}" data-date="${d}"><span>${U.dayLabel(d)}</span><span class="small muted">${D.dow(d) === 6 ? '08:00–14:00' : '08:00–18:00'} · ${n} citas</span></button>`;
    }).join('')}</div>`;
  }

  /* ---------- Agenda ---------- */
  function agenda() {
    const day = S.agendaDay;
    const list = mine().filter((a) => a.date === day && a.status !== 'Pendiente de contacto' && (!S.agendaZone || a.zone === S.agendaZone));
    const unassigned = list.filter((a) => !a.crew && !LOCKED.includes(a.status)).length;
    const slots = D.slotsFor(day);
    return head('Agenda', `${D.CONTRACTORS[S.contractor]} · lunes a viernes 8:00–18:00, sábado 8:00–14:00.`,
      btn('Exportar a Excel', 'exportExcel', { cls: 'btn-ghost', icon: 'download' })) +
      dayTabs('agendaDay', day) + `
    <div class="toolbar">
      ${field('Zona', select('agendaZone', [['', 'Todas las zonas']].concat(D.ZONES), S.agendaZone, { id: 'ag-zone', label: 'Zona' }))}
      <p class="muted small" aria-live="polite">${list.length} citas · ${unassigned ? `<strong class="text-amber">${unassigned} sin cuadrilla</strong>` : 'todas asignadas'}</p>
    </div>
    ${slots.map((slot) => {
      const inSlot = list.filter((a) => a.slot === slot);
      if (!inSlot.length) return `<section class="slot-group is-empty"><h2 class="slot-title">${icon('clock')}${slot}</h2><p class="muted small">Sin citas en esta franja.</p></section>`;
      return `<section class="slot-group"><h2 class="slot-title">${icon('clock')}${slot} <span class="muted small">${inSlot.length} citas</span></h2>
        ${D.ZONES.filter((z) => inSlot.some((a) => a.zone === z)).map((z) => `
          <h3 class="zone-title">${icon('pin')}${z}</h3>
          <div class="card table-wrap"><table class="table">
            <thead><tr><th scope="col">Franja</th><th scope="col">Zona</th><th scope="col">Dirección</th><th scope="col">Nombre</th><th scope="col">Teléfono</th><th scope="col">Estado</th><th scope="col">Cuadrilla</th></tr></thead>
            <tbody>${inSlot.filter((a) => a.zone === z).map((a) => `<tr>
              <td class="nowrap">${a.slot}</td><td>${a.zone}</td><td>${esc(a.address)}</td><td><strong>${esc(a.name)}</strong>${a.representative ? `<br><span class="muted small">Representante: ${esc(a.representative)}</span>` : ''}</td>
              <td class="mono nowrap">${esc(a.phone)}</td><td>${chip(a.status)}</td>
              <td>${select('assign', [['', 'Sin asignar'], ['1', 'Cuadrilla 1'], ['2', 'Cuadrilla 2'], ['3', 'Cuadrilla 3']], a.crew || '', { id: 'crew-' + a.id, data: { id: a.id }, label: 'Cuadrilla para ' + a.name, disabled: LOCKED.includes(a.status) })}</td>
            </tr>`).join('')}</tbody></table></div>`).join('')}
      </section>`;
    }).join('')}
    ${!slots.length ? U.empty('Domingo sin visitas', 'Elige otro día.') : ''}`;
  }
  H.act.agendaDay = (d) => { S.agendaDay = d.date; };
  H.change.agendaZone = (v) => { S.agendaZone = v; };
  H.change.assign = (v, d) => { A.assignCrew(d.id, v); U.toast(v ? 'Asignada a Cuadrilla ' + v + '. El técnico ya la ve en su ruta.' : 'Cuadrilla desasignada.'); };
  H.act.exportExcel = () => {
    const n = mine().filter((a) => a.date === S.agendaDay && a.status !== 'Pendiente de contacto').length;
    U.toast(`Exportación simulada: se generaría «agenda-${S.contractor}-${S.agendaDay}.xlsx» con ${n} filas (sin DNI).`, 'info');
  };

  /* ---------- Cambios ---------- */
  const KINDS = [['todos', 'Todos'], ['confirmacion', 'Confirmaciones'], ['reprogramacion', 'Reprogramaciones'], ['cancelacion', 'Cancelaciones'], ['campo', 'Campo'], ['asignacion', 'Asignaciones'], ['contacto', 'Contacto']];
  const KIND_LABEL = { confirmacion: 'Confirmación', reprogramacion: 'Reprogramación', cancelacion: 'Cancelación', campo: 'Campo', asignacion: 'Asignación', contacto: 'Contacto' };
  function cambios() {
    const seen = st.lastSeen[S.contractor];
    const list = st.changes.filter((c) => c.contractor === S.contractor && (S.feed === 'todos' || c.kind === S.feed));
    const fresh = newCount();
    return head('Cambios', 'Confirmaciones, reprogramaciones y cancelaciones recientes de tus citas.', fresh ? btn('Marcar como vistos', 'markSeen', { cls: 'btn-ghost', icon: 'check' }) : '') + `
    <div class="chips-row" role="group" aria-label="Filtrar cambios">${KINDS.map(([k, l]) => `<button class="filter-chip ${S.feed === k ? 'is-on' : ''}" data-act="feed" data-k="${k}" aria-pressed="${S.feed === k}">${l}</button>`).join('')}</div>
    <div class="card"><ul class="feed">${list.map((c) => {
      const a = st.find(c.id), isNew = c.seq > seen;
      return `<li class="feed-item ${isNew ? 'is-new' : ''}"><span class="feed-dot k-${c.kind}" aria-hidden="true"></span>
        <div class="feed-main"><p>${isNew ? tag('Nuevo', 'teal') + ' ' : ''}<span class="kind-label">${KIND_LABEL[c.kind]}</span> · <strong>${esc(a.name)}</strong></p>
        <p>${esc(c.text)}</p><p class="muted small">${esc(c.actor)} · ${U.stamp(c.at)} · ${esc(a.id)} · ${a.zone}${a.date ? ' · ' + U.dayLabel(a.date) + ' ' + a.slot : ''}</p></div>
        <div>${chip(a.status)}</div></li>`;
    }).join('') || `<li>${U.empty('Sin cambios', 'No hay movimientos con este filtro.', 'refresh')}</li>`}</ul></div>`;
  }
  H.act.feed = (d) => { S.feed = d.k; };
  H.act.markSeen = () => { st.lastSeen[S.contractor] = st.seq; };

  /* ---------- Cuadrillas ---------- */
  function cuadrillas() {
    const day = S.agendaDay, slots = D.slotsFor(day);
    const list = mine().filter((a) => a.date === day && !['Pendiente de contacto', 'Cancelada'].includes(a.status));
    return head('Cuadrillas', `Citas asignadas por cuadrilla y franja · ${D.CONTRACTORS[S.contractor]}. Capacidad: ${D.CREW_SLOT_CAPACITY} visitas por franja.`) + dayTabs('agendaDay', day) + `
    <div class="card table-wrap"><table class="table table-matrix">
      <thead><tr><th scope="col">Cuadrilla</th>${slots.map((s) => `<th scope="col">${s}</th>`).join('')}<th scope="col">Total</th></tr></thead>
      <tbody>
        ${D.CREWS.map((c) => { const mineC = list.filter((a) => a.crew === c); return `<tr><th scope="row">Cuadrilla ${c}</th>${slots.map((s) => { const n = mineC.filter((a) => a.slot === s).length; return `<td><span class="cell-count ${n >= D.CREW_SLOT_CAPACITY ? 'is-full' : n ? 'is-some' : ''}">${n}</span>${n >= D.CREW_SLOT_CAPACITY ? '<span class="sr-only"> (llena)</span>' : ''}</td>`; }).join('')}<td><strong>${mineC.length}</strong></td></tr>`; }).join('')}
        <tr class="row-muted"><th scope="row">Sin asignar</th>${slots.map((s) => `<td>${list.filter((a) => !a.crew && a.slot === s).length}</td>`).join('')}<td><strong>${list.filter((a) => !a.crew).length}</strong></td></tr>
      </tbody></table></div>
    <h2 class="section-title">Rutas del día</h2>
    <div class="crew-grid">${D.CREWS.map((c) => {
      const r = st.route(S.contractor, c, day);
      return `<section class="card crew-card"><h3 class="card-title">${icon('team')}Cuadrilla ${c}</h3>
        ${r.legs.length ? `<p><strong>${r.legs.length}</strong> visitas · ${Math.round(r.travel)} min de manejo · ${r.km.toFixed(1)} km</p><p class="muted small">Salida ${st.hm(st.routeCfg[S.contractor].depart)} · llegada a B ${st.hm(r.finish)}${r.lateCount ? ' · ' + r.lateCount + ' fuera de franja' : ''}</p>
        <ol class="crew-order">${r.legs.map((l) => `<li>${esc(l.stop.label)} <span class="muted small">${l.stop.slot}</span></li>`).join('')}</ol>` : '<p class="muted">Sin visitas asignadas.</p>'}
        ${btn('Ver ruta en el mapa', 'toRoute', { data: { crew: c }, cls: 'btn-ghost btn-sm', icon: 'map' })}</section>`;
    }).join('')}</div>`;
  }
  H.act.toRoute = (d) => { S.lab.crew = d.crew; if (S.page.contratista !== 'rutas') S.lab.day = S.agendaDay; S.lab.scenario = 'hub'; S.lab.view = 'una'; S.lab.leg = null; S.mapFull = null; S.page.contratista = 'rutas'; window.scrollTo(0, 0); };

  /* ---------- Rutas: optimización sobre la red vial real ---------- */
  const TIMES = []; for (let m = 420; m <= 600; m += 15) TIMES.push([String(m), st.hm(m)]);
  function labStops(crew) {
    const L = S.lab;
    if (L.scenario === 'ampliado') return D.LAB.map(([label, node, slot, address, zone], i) => ({ id: 'lab' + i, n: node, win: D.slotWindow(slot), label, slot, address: address + ', ' + zone }));
    return st.crewStops(S.contractor, crew || L.crew, L.day);
  }
  const placeName = (n) => { const p = Object.values(D.PLACES).find((x) => x.node === n); return p ? p.label : null; };
  const lvTag = (lv) => tag('Tráfico ' + lv.label.toLowerCase(), lv.key === 'fluido' ? 'green' : lv.key === 'moderado' ? 'amber' : 'red');

  function rutas() {
    const L = S.lab, cfg = st.routeCfg[S.contractor], o = st.options(S.contractor);
    const places = Object.entries(D.PLACES).map(([k, p]) => [k, p.label + ' · ' + p.address + ' (' + p.zone + ')']);
    const controls = `
    <div class="card route-controls">
      <div class="seg seg-inline" role="tablist" aria-label="Vista de rutas">
        <button role="tab" class="seg-btn ${L.view === 'una' ? 'is-on' : ''}" aria-selected="${L.view === 'una'}" data-act="labView" data-v="una">${icon('route')}Una cuadrilla</button>
        <button role="tab" class="seg-btn ${L.view === 'todas' ? 'is-on' : ''}" aria-selected="${L.view === 'todas'}" data-act="labView" data-v="todas">${icon('team')}Todas las cuadrillas</button>
      </div>
      ${L.view === 'una' ? field('Escenario', select('labScenario', [['hub', 'Citas del hub (cuadrilla y día)'], ['ampliado', 'Escenario ampliado: 12 viviendas']], L.scenario, { id: 'lab-sc', label: 'Escenario' })) : ''}
      ${L.view === 'todas' || L.scenario === 'hub' ? field('Día', select('labDay', workdays().map((d) => [d, U.dayLabel(d)]), L.day, { id: 'lab-day', label: 'Día' })) : ''}
      ${L.view === 'una' && L.scenario === 'hub' ? field('Cuadrilla', select('labCrew', D.CREWS.map((c) => [c, 'Cuadrilla ' + c]), L.crew, { id: 'lab-crew', label: 'Cuadrilla' })) : ''}
      ${field('Punto A (salida)', select('labStart', places, cfg.start, { id: 'lab-a', label: 'Punto A' }))}
      ${field('Punto B (llegada)', select('labEnd', places, cfg.end, { id: 'lab-b', label: 'Punto B' }))}
      ${field('Hora de salida', select('labDepart', TIMES, String(cfg.depart), { id: 'lab-dep', label: 'Hora de salida' }))}
      ${field('Tiempo por visita', select('labService', [['20', '20 min'], ['30', '30 min'], ['45', '45 min']], String(cfg.service), { id: 'lab-svc', label: 'Tiempo por visita' }))}
      <fieldset class="field cond-set"><legend class="field-label">Condiciones del tráfico (cambian la ruta al instante)</legend>
        <label class="check"><input type="checkbox" data-change="labCond" data-k="lluvia" ${cfg.cond.lluvia ? 'checked' : ''}><span>Lluvia (+20 % en todas las vías)</span></label>
        ${D.INCIDENTS.map((i) => `<label class="check"><input type="checkbox" data-change="labCond" data-k="${i.id}" ${cfg.cond[i.id] ? 'checked' : ''}><span>${i.label}</span></label>`).join('')}
      </fieldset>
    </div>`;
    const header = head('Rutas', 'Mapa real de Santa Anita, Ate y La Molina. El motorizado sale del punto A, visita cada vivienda dentro de su franja y termina en el punto B, por las calles reales y con el tráfico de cada hora.');
    return header + controls + (L.view === 'todas' ? allCrews(o, cfg) : oneCrew(o, cfg));
  }

  function mapCard(key, title, mapTime, body, opts = {}) {
    const full = S.mapFull === key;
    return `<section class="card map-card ${full ? 'is-full' : ''}">
      <div class="map-head">
        <h2 class="card-title">${icon('map')}${title}</h2>
        <div class="btn-row">
          <span class="tag tag-gray">Tráfico estimado a las ${st.hm(mapTime)}</span>
          ${opts.anim ? btn('Simular recorrido', 'mapAnim', { data: { key }, cls: 'btn-primary btn-sm', icon: 'play' }) : ''}
          ${btn(S.lab.traffic ? 'Ocultar tráfico' : 'Ver tráfico', 'labTraffic', { cls: 'btn-ghost btn-sm', icon: 'eye' })}
          ${btn(full ? 'Salir de pantalla completa' : 'Pantalla completa', 'mapFull', { data: { key }, cls: 'btn-ghost btn-sm', icon: full ? 'x' : 'expand' })}
        </div>
      </div>
      ${body}
      ${H.map.legend({ traffic: S.lab.traffic, alt: opts.alt, crews: opts.crews })}
    </section>`;
  }

  function evaluate(L) {
    const a = L.scenario === 'hub' && L.evalId ? st.find(L.evalId) : null;
    if (!a || !L.evalSlot) return { a };
    const n = st.dayN(a, L.day);
    if (a.date === L.day && a.slot === L.evalSlot && a.crew === L.crew) return { a, n, v: { ok: false, same: true, reason: 'Es su horario actual en esta ruta' } };
    const v = n < 1 ? { ok: false, reason: 'La solicitud se registra después de ese día' } : n > 4 ? { ok: false, reason: 'Fuera del plazo: sería el día ' + n + ' desde la solicitud (máximo día 3, o día 4 si cabe en la ruta)' } : st.fit(a, L.day, L.evalSlot, { contractor: S.contractor, crew: L.crew });
    return { a, n, v };
  }
  function evalCard(L, E, current, opt) {
    if (L.scenario !== 'hub') return '';
    const cands = mine().filter((a) => !['Cancelada', 'Realizada', 'En camino'].includes(a.status)).sort((x, y) => x.name.localeCompare(y.name))
      .map((a) => [a.id, `${a.name} · ${a.status} · ${a.date ? U.dayLabel(a.date) + ' ' + a.slot : 'sin fecha'}${a.crew ? ' · Cuadrilla ' + a.crew : ''}`]);
    let verdict = '';
    if (E.v) {
      const d4 = E.n === 4;
      verdict = E.v.ok
        ? `<div class="verdict is-ok">${icon('check')}<div><strong>Sí cabe en la ruta</strong> · día ${E.n} desde la solicitud${d4 ? ' (excepción del día 4: cae dentro del recorrido)' : ''}.<br>Desvío: <strong>+${Math.round(E.v.detour)} min</strong> de manejo · llegaría a las <strong>${st.hm(E.v.eta)}</strong>${E.v.start - E.v.eta > 1 ? ` y atendería desde las <strong>${st.hm(E.v.start)}</strong>` : ''} · nadie llega tarde. En el mapa la visita aparece con el pin azul.</div></div>
           <div class="btn-row">${btn('Aplicar reprogramación', 'evalApply', { cls: 'btn-primary', icon: 'calendar' })}${btn('Limpiar', 'evalClear', { cls: 'btn-ghost', icon: 'x' })}</div>`
        : `<div class="verdict ${E.v.same ? '' : 'is-no'}">${icon(E.v.same ? 'info' : 'alert')}<div><strong>${E.v.same ? 'Sin cambios' : 'No se reprograma'}</strong>: ${esc(E.v.reason.charAt(0).toLowerCase() + E.v.reason.slice(1))}.${d4 && !E.v.same ? ' El técnico mantiene la visita ya programada.' : ''}</div></div>
           <div class="btn-row">${btn('Limpiar', 'evalClear', { cls: 'btn-ghost', icon: 'x' })}</div>`;
    }
    return `<section class="card eval-card" aria-labelledby="eval-title">
      <h2 id="eval-title" class="card-title">${icon('calendar')}Evaluar reprogramación en esta ruta</h2>
      <p class="muted small">Elige una cita y una franja de <strong>${U.dayLabel(L.day)}</strong> para ver si cabe en la ruta de la <strong>Cuadrilla ${L.crew}</strong>. Regla: la visita va del día 1 al 3 desde la solicitud; el día 4 solo si cae dentro del recorrido ya programado, sin retrasar a nadie y con un desvío de 25 min como máximo.</p>
      <div class="eval-row">
        ${field('Cita', select('evalId', [['', 'Elige una cita…']].concat(cands), L.evalId || '', { id: 'ev-id', label: 'Cita a evaluar' }))}
        ${field('Nueva franja', select('evalSlot', [['', 'Elige una franja…']].concat(D.slotsFor(L.day)), L.evalSlot || '', { id: 'ev-slot', label: 'Nueva franja' }))}
      </div>
      ${verdict}
      ${E.v && E.v.ok ? `<p class="small muted">Ruta actual: ${Math.round(current.travel)} min · ${current.km.toFixed(1)} km · llega a B ${st.hm(current.finish)} → con la visita: ${Math.round(opt.travel)} min · ${opt.km.toFixed(1)} km · llega a B ${st.hm(opt.finish)}.</p>` : ''}
    </section>`;
  }

  function oneCrew(o, cfg) {
    const L = S.lab;
    const EV = evaluate(L);
    const currentStops = labStops();
    const stops = EV.v && EV.v.ok ? currentStops.filter((s) => s.id !== EV.a.id).concat([st.toStop(EV.a, L.evalSlot)]) : currentStops;
    const current = EV.v && EV.v.ok ? R.optimize(currentStops, o) : null;
    const t0 = performance.now();
    const opt = R.optimize(stops, o);
    const ms = performance.now() - t0;
    const base = R.baseline(stops, o);
    if (!stops.length) {
      return mapCard('lab', 'Mapa', cfg.depart, H.map.slot('lab', { height: '62vh', label: 'Mapa sin visitas', sig: 'empty', draw: (c) => { H.map.districts(c); if (S.lab.traffic) H.map.traffic(c, cfg.depart, cfg.cond); D.ZONES.forEach(() => 0); Object.values(D.districts).forEach((p) => p.forEach((x) => c.bounds.extend(x))); } }) +
        `<div class="map-empty">${U.empty('Sin visitas para esta cuadrilla y día', 'Asigna citas en la Agenda o elige «Escenario ampliado: 12 viviendas» para ver la optimización completa.', 'route')}</div>`) + evalCard(L, EV, null, null);
    }
    const legsAll = opt.legs.map((l) => ({ from: l.from, to: l.stop.n, depart: l.depart, travel: l.travel, km: l.km, name: l.stop.label }))
      .concat([{ from: opt.endLeg.from, to: opt.endLeg.to, depart: opt.endLeg.depart, travel: opt.endLeg.travel, km: opt.endLeg.km, name: placeName(opt.endLeg.to) || 'Punto B' }]);
    const focus = L.leg !== null && L.leg < legsAll.length ? legsAll[L.leg] : null;
    const alts = focus ? R.alternatives(focus.from, focus.to, focus.depart, cfg.cond) : null;
    if (alts && L.alt >= alts.length) L.alt = 0;
    const mapTime = focus ? focus.depart : cfg.depart;
    const done = new Set(stops.filter((s) => s.a && ['Realizada', 'Cliente ausente'].includes(s.a.status)).map((s) => s.id));
    const sig = [S.contractor, L.scenario, L.day, L.crew, cfg.start, cfg.end, L.leg, EV.v && EV.v.ok ? EV.a.id + L.evalSlot : ''].join('|');
    const save = (a, b, unit = '') => { const d = b - a; return Math.abs(d) < 0.5 ? '<span class="muted small">igual que sin optimizar</span>' : d > 0 ? `<span class="text-green small">${Math.round(d * 10) / 10}${unit} menos que sin optimizar</span>` : `<span class="text-amber small">${Math.round(-d * 10) / 10}${unit} más (gana en puntualidad)</span>`; };

    const mapHtml = H.map.slot('lab', {
      height: S.mapFull === 'lab' ? 'calc(100vh - 150px)' : '70vh', label: 'Mapa de la ruta optimizada', sig,
      draw: (c) => {
        H.map.districts(c);
        if (S.lab.traffic) H.map.traffic(c, mapTime, cfg.cond);
        H.map.route(c, o, opt, cfg.cond, { focusLeg: L.leg, doneIds: done, newId: EV.v && EV.v.ok ? EV.a.id : null, onLeg: (i) => H.run(() => { S.lab.leg = i; S.lab.alt = 0; }) });
        if (alts) H.map.alts(c, alts, L.alt, (i) => H.run(() => { S.lab.alt = i; }));
      }
    });

    const dirs = alts && alts[L.alt] ? R.directions(alts[L.alt].steps) : null;
    return `
    <div class="metric-grid">
      <div class="card metric"><span class="metric-label">Visitas en la ruta</span><span class="metric-num">${opt.legs.length}</span><span class="muted small">calculado en ${ms < 1 ? '<1' : Math.round(ms)} ms</span></div>
      <div class="card metric"><span class="metric-label">Tiempo de manejo</span><span class="metric-num">${Math.round(opt.travel)} min</span>${save(opt.travel, base.travel, ' min')}</div>
      <div class="card metric"><span class="metric-label">Distancia</span><span class="metric-num">${opt.km.toFixed(1)} km</span>${save(opt.km, base.km, ' km')}</div>
      <div class="card metric"><span class="metric-label">Llega al punto B</span><span class="metric-num">${st.hm(opt.finish)}</span><span class="muted small">sin optimizar: ${st.hm(base.finish)}</span></div>
      <div class="card metric"><span class="metric-label">Fuera de franja</span><span class="metric-num ${opt.lateCount ? 'text-red' : ''}">${opt.lateCount}</span><span class="muted small">sin optimizar: ${base.lateCount}</span></div>
    </div>
    ${mapCard('lab', 'Mapa de la ruta', mapTime, mapHtml, { anim: true, alt: !!alts })}
    <p class="muted small map-hint">${icon('info')}Toca una parada para ver sus datos, una línea para elegir ese tramo o «Simular recorrido» para ver al motorizado avanzar por las calles con la hora estimada.</p>
    ${evalCard(L, EV, current, opt)}
    <div class="route-layout">
      <section class="card itinerary">
        <h2 class="card-title">${icon('route')}Itinerario optimizado</h2>
        <p class="muted small">Toca un tramo para ver en el mapa las rutas alternativas y las indicaciones.</p>
        <ol class="itin">
          <li class="itin-ab"><span class="itin-mark">A</span><div><strong>${D.PLACES[cfg.start].label}</strong><p class="muted small">${D.PLACES[cfg.start].address}, ${D.PLACES[cfg.start].zone} · salida ${st.hm(cfg.depart)}</p></div></li>
          ${legsAll.map((lg, i) => {
            const isEnd = i === opt.legs.length, l = opt.legs[i];
            return `<li><button class="itin-leg ${L.leg === i ? 'is-on' : ''}" data-act="labLeg" data-i="${i}" aria-pressed="${L.leg === i}">${icon('nav')}<span>Tramo ${i + 1}: ${Math.round(lg.travel)} min · ${lg.km.toFixed(1)} km</span>${icon('chevron')}</button></li>
            ${isEnd ? `<li class="itin-ab"><span class="itin-mark itin-b">B</span><div><strong>${D.PLACES[cfg.end].label}</strong><p class="muted small">${D.PLACES[cfg.end].address}, ${D.PLACES[cfg.end].zone} · llegada ${st.hm(opt.finish)}</p></div></li>` :
              `<li class="itin-stop ${done.has(l.stop.id) ? 'is-done' : ''}"><span class="itin-num ${l.late > 0.5 ? 'is-late' : ''}">${i + 1}</span><div><strong>${esc(l.stop.label)}</strong> ${l.stop.a ? chip(l.stop.a.status) : ''}
                <p class="muted small">${l.stop.a ? esc(l.stop.a.address) + ', ' + l.stop.a.zone : esc(l.stop.address || '')}</p>
                <p class="small">Franja ${l.stop.slot} · llega <strong>${st.hm(l.arrive)}</strong>${l.wait > 0.5 ? ` · espera ${Math.round(l.wait)} min` : ''} · atención ${st.hm(l.start)}–${st.hm(l.finish)}</p>
                ${l.late > 0.5 ? `<p class="small text-red">${icon('alert')}Llega ${Math.round(l.late)} min tarde a su franja</p>` : ''}</div></li>`}`;
          }).join('')}
        </ol>
      </section>
      <section class="card alts">
        ${focus ? `<div class="map-head"><h2 class="card-title">${icon('layers')}Tramo ${L.leg + 1}: rutas para el mismo destino</h2>${btn('Cerrar', 'labLeg', { data: { i: L.leg }, cls: 'btn-ghost btn-sm', icon: 'x' })}</div>
          <p class="muted small">De ${esc(placeName(focus.from) || (opt.legs[L.leg - 1] ? opt.legs[L.leg - 1].stop.label : 'la parada anterior'))} a ${esc(focus.name)}, saliendo a las ${st.hm(focus.depart)}. Se comparan caminos distintos con el tráfico de esa hora y se elige el más rápido.</p>
          <div class="alt-list">${alts.map((p, i) => `<button class="alt ${L.alt === i ? 'is-on' : ''}" data-act="labAlt" data-i="${i}" aria-pressed="${L.alt === i}">
            <span class="alt-swatch" style="background:${H.map.altColor(i, L.alt)}" aria-hidden="true"></span>
            <span class="alt-main"><strong>${i === 0 ? 'Recomendada' : 'Alternativa ' + i} · ${Math.round(p.minutes)} min</strong><span class="small">${p.km.toFixed(1)} km · por ${esc(p.via.join(' y '))}</span></span>
            <span class="alt-side">${lvTag(p.level)}${i ? `<span class="small muted">+${Math.round(p.minutes - alts[0].minutes)} min</span>` : ''}</span></button>`).join('')}</div>
          ${dirs ? `<h3 class="sub-title">${icon('nav')}Indicaciones · ${L.alt === 0 ? 'recomendada' : 'alternativa ' + L.alt}</h3><ol class="dirs">${dirs.map((d) => `<li>${icon(d.icon)}<span>${esc(d.text)}</span>${d.m ? `<span class="muted small">${d.m >= 1000 ? (d.m / 1000).toFixed(1) + ' km' : Math.round(d.m / 10) * 10 + ' m'}</span>` : ''}</li>`).join('')}</ol>` : ''}`
        : `<h2 class="card-title">${icon('layers')}Rutas alternativas</h2>${U.empty('Elige un tramo', 'Toca un tramo del itinerario o una línea del mapa para comparar caminos y ver las indicaciones giro a giro.', 'nav')}`}
      </section>
    </div>
    ${method(ms, stops.length)}`;
  }

  function allCrews(o, cfg) {
    const L = S.lab;
    const routes = D.CREWS.map((c) => ({ crew: c, stops: labStops(c) })).map((x) => ({ ...x, r: R.optimize(x.stops, o) }));
    const sig = ['todas', S.contractor, L.day, cfg.start, cfg.end].join('|');
    const any = routes.some((x) => x.stops.length);
    const mapHtml = H.map.slot('lab-all', {
      height: S.mapFull === 'lab-all' ? 'calc(100vh - 150px)' : '70vh', label: 'Rutas de todas las cuadrillas', sig,
      draw: (c) => {
        H.map.districts(c);
        if (S.lab.traffic) H.map.traffic(c, cfg.depart, cfg.cond);
        routes.forEach((x, i) => { if (x.stops.length) H.map.route(c, o, x.r, cfg.cond, { color: H.map.CREW_COLORS[i], pinColor: H.map.CREW_COLORS[i], tips: false, onLeg: () => H.run(() => { S.lab.view = 'una'; S.lab.crew = x.crew; S.lab.scenario = 'hub'; S.lab.leg = null; }) }); });
        if (!any) Object.values(D.districts).forEach((p) => p.forEach((q) => c.bounds.extend(q)));
      }
    });
    return mapCard('lab-all', 'Rutas de todas las cuadrillas · ' + U.dayLabel(L.day), cfg.depart, mapHtml, { crews: D.CREWS.map((c) => 'Cuadrilla ' + c) }) +
      `<div class="crew-grid">${routes.map((x, i) => `<section class="card crew-card"><h3 class="card-title"><span class="crew-dot" style="background:${H.map.CREW_COLORS[i]}"></span>Cuadrilla ${x.crew}</h3>
        ${x.stops.length ? `<p><strong>${x.r.legs.length}</strong> visitas · ${Math.round(x.r.travel)} min · ${x.r.km.toFixed(1)} km</p><p class="muted small">Salida ${st.hm(cfg.depart)} · llega a B ${st.hm(x.r.finish)}</p><ol class="crew-order">${x.r.legs.map((l) => `<li>${esc(l.stop.label)} <span class="muted small">${l.stop.slot} · llega ${st.hm(l.arrive)}</span></li>`).join('')}</ol>` : '<p class="muted">Sin visitas asignadas.</p>'}
        ${btn('Ver esta ruta', 'toRoute', { data: { crew: x.crew }, cls: 'btn-ghost btn-sm', icon: 'map' })}</section>`).join('')}</div>`;
  }

  function method(ms, n) {
    return `<details class="card method">
      <summary>${icon('info')}Cómo funciona el sistema de rutas</summary>
      <ul class="small">
        <li><strong>Calles reales:</strong> ${D.nodes.length.toLocaleString('es-PE')} intersecciones y ${D.edges.length.toLocaleString('es-PE')} tramos de Santa Anita, Ate y La Molina tomados de OpenStreetMap, con nombre, tipo de vía y sentido de circulación (se respetan las calles de un solo sentido).</li>
        <li><strong>Tráfico:</strong> el tiempo de cada tramo es su tiempo a flujo libre multiplicado por un factor que cambia con la hora (horas punta 7:00–9:00 y 17:30–19:30, y mediodía), el tipo de vía (las avenidas se congestionan más que las calles) y eventos como lluvia, obras o accidentes.</li>
        <li><strong>Camino más rápido entre dos puntos:</strong> Dijkstra dependiente del tiempo; cada tramo se evalúa a la hora en que el motorizado pasa por él.</li>
        <li><strong>Rutas alternativas:</strong> tras encontrar la más rápida se encarecen sus tramos y se vuelve a buscar; se descartan las que repiten más del 72 % del recorrido.</li>
        <li><strong>Orden de visitas de A a B:</strong> programación dinámica (Held–Karp) con ventanas horarias. Primero minimiza la llegada fuera de franja, luego la hora de llegada a B y luego el tiempo de manejo${ms != null ? ` (${n} visitas, ${Math.round(ms)} ms)` : ''}.</li>
        <li><strong>Reprogramaciones:</strong> antes de aceptar un horario se inserta la visita en la ruta y se verifica que nadie llegue tarde. El día 4 solo se acepta si cae dentro del recorrido ya programado y el desvío no supera 25 min.</li>
        <li><strong>En producción:</strong> los tiempos podrían venir de un servicio con tráfico en tiempo real (por ejemplo, Google Routes API). Aquí el tráfico es un modelo simulado; el mapa base es de OpenStreetMap y CARTO.</li>
      </ul>
    </details>`;
  }

  const cfgSet = (k, v) => { st.routeCfg[S.contractor][k] = v; S.lab.leg = null; };
  H.act.labView = (d) => { S.lab.view = d.v; S.lab.leg = null; S.mapFull = null; };
  H.act.labTraffic = () => { S.lab.traffic = !S.lab.traffic; };
  H.change.labScenario = (v) => { S.lab.scenario = v; S.lab.leg = null; };
  H.change.labDay = (v) => { S.lab.day = v; S.lab.leg = null; };
  H.change.labCrew = (v) => { S.lab.crew = v; S.lab.leg = null; };
  H.change.labStart = (v) => cfgSet('start', v);
  H.change.labEnd = (v) => cfgSet('end', v);
  H.change.labDepart = (v) => cfgSet('depart', +v);
  H.change.labService = (v) => cfgSet('service', +v);
  H.change.labCond = (v, d) => { st.routeCfg[S.contractor].cond[d.k] = v; };
  H.act.labLeg = (d) => { const i = +d.i; S.lab.leg = S.lab.leg === i ? null : i; S.lab.alt = 0; };
  H.act.labAlt = (d) => { S.lab.alt = +d.i; };
  H.change.evalId = (v) => { S.lab.evalId = v || null; S.lab.leg = null; };
  H.change.evalSlot = (v) => { S.lab.evalSlot = v || null; S.lab.leg = null; };
  H.act.evalClear = () => { S.lab.evalId = null; S.lab.evalSlot = null; };
  H.act.evalApply = () => {
    const L = S.lab, a = st.find(L.evalId);
    A.reprogramToCrew(L.evalId, L.day, L.evalSlot, L.crew);
    U.toast(a.name + ' reprogramada a ' + U.dayLabel(L.day) + ' · ' + L.evalSlot + ' (Cuadrilla ' + L.crew + '). Se avisó al cliente por WhatsApp.');
    L.evalId = null; L.evalSlot = null;
  };
})();
