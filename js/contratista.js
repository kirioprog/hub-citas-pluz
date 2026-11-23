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
  H.act.toRoute = (d) => { S.lab.crew = d.crew; S.lab.day = S.agendaDay; S.lab.scenario = 'hub'; S.lab.leg = null; S.page.contratista = 'rutas'; window.scrollTo(0, 0); };

  /* ---------- Rutas: optimización sobre grafos ---------- */
  const TIMES = []; for (let m = 420; m <= 570; m += 15) TIMES.push([String(m), st.hm(m)]);
  function labStops() {
    const L = S.lab;
    if (L.scenario === 'ampliado') return D.LAB.map(([label, node, slot], i) => ({ id: 'lab' + i, n: D.idx[node], win: D.slotWindow(slot), label, slot }));
    return st.crewStops(S.contractor, L.crew, L.day);
  }
  function rutas() {
    const L = S.lab, cfg = st.routeCfg[S.contractor], o = st.options(S.contractor);
    const stops = labStops();
    const t0 = performance.now();
    const opt = R.optimize(stops, o);
    const ms = performance.now() - t0;
    const base = R.baseline(stops, o);
    const legsAll = opt.legs.map((l) => ({ from: l.from, to: l.stop.n, depart: l.depart, travel: l.travel, km: l.km })).concat([{ from: opt.endLeg.from, to: opt.endLeg.to, depart: opt.endLeg.depart, travel: opt.endLeg.travel, km: opt.endLeg.km }]);
    const focus = L.leg !== null && L.leg < legsAll.length ? legsAll[L.leg] : null;
    const alts = focus ? R.alternatives(focus.from, focus.to, focus.depart, cfg.cond) : null;
    const mapTime = focus ? focus.depart : cfg.depart;
    const done = new Set(stops.filter((s) => s.a && ['Realizada', 'Cliente ausente'].includes(s.a.status)).map((s) => s.id));
    const places = Object.entries(D.PLACES).map(([k, p]) => [k, p.label + ' (' + p.zone + ')']);
    const save = (a, b, unit = '') => { const d = b - a; return Math.abs(d) < 0.5 ? '<span class="muted small">igual que sin optimizar</span>' : d > 0 ? `<span class="text-green small">${Math.round(d)}${unit} menos que sin optimizar</span>` : `<span class="text-amber small">${Math.round(-d)}${unit} más (gana en puntualidad)</span>`; };
    const nodeName = (n) => { const p = Object.values(D.PLACES).find((x) => D.idx[x.node] === n); return p ? p.label : null; };

    return head('Rutas', 'El motorizado sale del punto A, visita cada vivienda dentro de su franja y termina en el punto B. Se recalcula con el tráfico de cada hora.') + `
    <div class="card route-controls">
      ${field('Escenario', select('labScenario', [['hub', 'Citas del hub (cuadrilla y día)'], ['ampliado', 'Escenario ampliado: 12 viviendas ficticias']], L.scenario, { id: 'lab-sc', label: 'Escenario' }))}
      ${L.scenario === 'hub' ? field('Día', select('labDay', workdays().map((d) => [d, U.dayLabel(d)]), L.day, { id: 'lab-day', label: 'Día' })) + field('Cuadrilla', select('labCrew', D.CREWS.map((c) => [c, 'Cuadrilla ' + c]), L.crew, { id: 'lab-crew', label: 'Cuadrilla' })) : ''}
      ${field('Punto A (salida)', select('labStart', places, cfg.start, { id: 'lab-a', label: 'Punto A' }))}
      ${field('Punto B (llegada)', select('labEnd', places, cfg.end, { id: 'lab-b', label: 'Punto B' }))}
      ${field('Hora de salida', select('labDepart', TIMES, String(cfg.depart), { id: 'lab-dep', label: 'Hora de salida' }))}
      ${field('Tiempo por visita', select('labService', [['20', '20 min'], ['30', '30 min'], ['45', '45 min']], String(cfg.service), { id: 'lab-svc', label: 'Tiempo por visita' }))}
      <fieldset class="field cond-set"><legend class="field-label">Condiciones del tráfico</legend>
        <label class="check"><input type="checkbox" data-change="labCond" data-k="lluvia" ${cfg.cond.lluvia ? 'checked' : ''}><span>Lluvia (+20 % en todas las vías)</span></label>
        ${D.INCIDENTS.map((i) => `<label class="check"><input type="checkbox" data-change="labCond" data-k="${i.id}" ${cfg.cond[i.id] ? 'checked' : ''}><span>${i.label}</span></label>`).join('')}
      </fieldset>
    </div>
    ${!stops.length ? `<div class="card">${U.empty('Sin visitas para esta cuadrilla y día', 'Asigna citas en la Agenda o usa el escenario ampliado para ver la optimización con 12 viviendas.', 'route')}</div>` : `
    <div class="metric-grid">
      <div class="card metric"><span class="metric-label">Tiempo de manejo</span><span class="metric-num">${Math.round(opt.travel)} min</span>${save(opt.travel, base.travel, ' min')}</div>
      <div class="card metric"><span class="metric-label">Distancia</span><span class="metric-num">${opt.km.toFixed(1)} km</span>${save(opt.km, base.km, ' km')}</div>
      <div class="card metric"><span class="metric-label">Llegada al punto B</span><span class="metric-num">${st.hm(opt.finish)}</span><span class="muted small">sin optimizar: ${st.hm(base.finish)}</span></div>
      <div class="card metric"><span class="metric-label">Visitas fuera de franja</span><span class="metric-num">${opt.lateCount}</span><span class="muted small">sin optimizar: ${base.lateCount}</span></div>
    </div>
    <div class="route-layout">
      <section class="card map-card">
        <div class="map-head"><h2 class="card-title">${icon('map')}Mapa de la ruta</h2><span class="tag tag-gray">Mapa esquemático de ejemplo · tráfico a las ${st.hm(mapTime)}</span></div>
        <div class="map-box">${H.map.svg({ opts: o, result: opt, time: mapTime, cond: cfg.cond, focusLeg: L.leg, alts, altSel: L.alt, doneIds: done, title: 'Ruta optimizada de ' + opt.legs.length + ' visitas' })}</div>
        ${H.map.legend(!!alts)}
      </section>
      <section class="card itinerary">
        <h2 class="card-title">${icon('route')}Itinerario optimizado</h2>
        <p class="muted small">Toca un tramo para ver las rutas alternativas con tráfico.</p>
        <ol class="itin">
          <li class="itin-ab"><span class="itin-mark">A</span><div><strong>${D.PLACES[cfg.start].label}</strong><p class="muted small">Salida ${st.hm(cfg.depart)}</p></div></li>
          ${legsAll.map((lg, i) => {
            const isEnd = i === opt.legs.length, l = opt.legs[i];
            return `<li><button class="itin-leg ${L.leg === i ? 'is-on' : ''}" data-act="labLeg" data-i="${i}" aria-pressed="${L.leg === i}">${icon('nav')}<span>Tramo ${i + 1}: ${Math.round(lg.travel)} min · ${lg.km.toFixed(1)} km</span>${icon('chevron')}</button></li>
            ${isEnd ? `<li class="itin-ab"><span class="itin-mark">B</span><div><strong>${D.PLACES[cfg.end].label}</strong><p class="muted small">Llegada ${st.hm(opt.finish)}</p></div></li>` :
              `<li class="itin-stop ${done.has(l.stop.id) ? 'is-done' : ''}"><span class="itin-num">${i + 1}</span><div><strong>${esc(l.stop.label)}</strong> ${l.stop.a ? chip(l.stop.a.status) : ''}
                <p class="small">Franja ${l.stop.slot} · llega ${st.hm(l.arrive)}${l.wait > 0.5 ? ` · espera ${Math.round(l.wait)} min` : ''} · atención ${st.hm(l.start)}–${st.hm(l.finish)}</p>
                ${l.late > 0.5 ? `<p class="small text-red">${icon('alert')}Llega ${Math.round(l.late)} min tarde a su franja</p>` : ''}
                ${l.stop.a ? `<p class="muted small">${esc(l.stop.a.address)}, ${l.stop.a.zone}</p>` : ''}</div></li>`}`;
          }).join('')}
        </ol>
      </section>
    </div>
    ${focus ? `<section class="card alts">
      <div class="map-head"><h2 class="card-title">${icon('layers')}Rutas alternativas · Tramo ${L.leg + 1}</h2>${btn('Cerrar', 'labLeg', { data: { i: L.leg }, cls: 'btn-ghost btn-sm', icon: 'x' })}</div>
      <p class="muted small">Desde ${esc(nodeName(focus.from) || 'la parada anterior')} hacia ${esc(nodeName(focus.to) || (opt.legs[L.leg] ? opt.legs[L.leg].stop.label : ''))}, saliendo a las ${st.hm(focus.depart)}. Mismo destino, distintos caminos: se elige el más rápido con el tráfico estimado a esa hora.</p>
      <div class="alt-list">${alts.map((p, i) => `<button class="alt ${L.alt === i ? 'is-on' : ''}" data-act="labAlt" data-i="${i}" aria-pressed="${L.alt === i}">
        <span class="alt-swatch" style="background:${H.map.ALT[i % 3]}" aria-hidden="true"></span>
        <span class="alt-main"><strong>${i === 0 ? 'Recomendada' : 'Alternativa ' + i} · ${Math.round(p.minutes)} min</strong><span class="small">${p.km.toFixed(1)} km · vía ${esc(p.via.join(' y '))}</span></span>
        <span class="alt-side">${tag('Tráfico ' + p.level.label.toLowerCase(), p.level.key === 'fluido' ? 'green' : p.level.key === 'moderado' ? 'amber' : 'red')}${i ? `<span class="small muted">+${Math.round(p.minutes - alts[0].minutes)} min</span>` : ''}</span>
      </button>`).join('')}</div>
    </section>` : ''}`}
    <details class="card method">
      <summary>${icon('info')}Cómo se calcula la ruta</summary>
      <ul class="small">
        <li><strong>Grafo vial:</strong> ${D.nodes.length} intersecciones y ${D.edges.length} tramos con tipo de vía (avenida, principal o calle) y distancia.</li>
        <li><strong>Tráfico:</strong> el tiempo de cada tramo es su tiempo a flujo libre multiplicado por un factor que cambia con la hora (horas punta 7:00–9:00 y 17:30–19:30, y mediodía), el tipo de vía y eventos como lluvia, obras o ferias.</li>
        <li><strong>Camino más rápido entre dos puntos:</strong> Dijkstra dependiente del tiempo (cada tramo se evalúa a la hora en que se recorre).</li>
        <li><strong>Rutas alternativas:</strong> algoritmo de Yen (k caminos más cortos), descartando las que comparten más del 70 % de los tramos.</li>
        <li><strong>Orden de visitas de A a B:</strong> programación dinámica (Held–Karp) con ventanas horarias: primero minimiza minutos fuera de franja, luego la hora de llegada a B y el tiempo de manejo. Calculado en ${ms.toFixed(1)} ms para ${stops.length} visitas.</li>
        <li><strong>Reprogramaciones:</strong> antes de aceptar un horario se inserta la visita en la ruta y se verifica que nadie llegue tarde. En el día 4 solo se acepta si cae dentro del recorrido ya programado y el desvío no supera 25 min.</li>
        <li><strong>En producción:</strong> los tiempos por tramo se pueden obtener de un servicio con tráfico en tiempo real (por ejemplo, Google Routes API con matrices de rutas sensibles al tráfico) y el mapa real se dibujaría con Google Maps. Este prototipo no se conecta a ningún servicio externo.</li>
      </ul>
    </details>`;
  }
  const cfgSet = (k, v) => { st.routeCfg[S.contractor][k] = v; S.lab.leg = null; };
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
})();
