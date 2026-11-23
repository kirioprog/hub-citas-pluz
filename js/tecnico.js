/* Hub de citas · Vista del técnico (móvil, 390 px). No muestra DNI ni documentos. */
(function () {
  const H = window.Hub, D = H.data, U = H.ui, st = H.store, S = H.S, A = st.actions, R = H.routing;
  const { esc, icon, chip, tag, btn, select } = U;
  const CAN_GO = ['Confirmada', 'Recordada', 'Reprogramada'];
  const DONE = ['Realizada', 'Cliente ausente'];

  H.views.tecnico = function () {
    const T = S.tech;
    const r = st.route(T.contractor, T.crew, D.today);
    const o = st.options(T.contractor);
    const open = T.open && r.legs.find((l) => l.stop.id === T.open);
    const pending = r.legs.filter((l) => !DONE.includes(l.stop.a.status)).length;
    const body = open ? detail(open, r, o) : T.tab === 'mapa' ? mapTab(r, o) : listTab(r);
    return `<div class="tech-page">${U.banner()}
      <div class="tech-frame">
        <header class="tech-head">
          <div class="tech-top">${U.brand('Espacio técnico')}${btn('Cambiar de rol', 'switchRole', { cls: 'btn-ghost btn-sm', icon: 'switch' })}</div>
          <h1>Ruta de hoy</h1>
          <p class="tech-date">${U.cap(U.dateLong(D.today))} · <strong>${r.legs.length} ${r.legs.length === 1 ? 'visita' : 'visitas'}</strong>${r.legs.length ? ` · ${pending} por atender` : ''}</p>
          <label class="tech-crew"><span class="small">Cuadrilla</span>${select('techCrew', ['A', 'B'].flatMap((c) => D.CREWS.map((n) => [c + '-' + n, D.CONTRACTORS[c] + ' · Cuadrilla ' + n])), T.contractor + '-' + T.crew, { id: 'tech-crew', label: 'Cuadrilla' })}</label>
          ${open ? '' : `<div class="seg" role="tablist" aria-label="Vista"><button role="tab" class="seg-btn ${T.tab === 'lista' ? 'is-on' : ''}" aria-selected="${T.tab === 'lista'}" data-act="techTab" data-tab="lista">${icon('list')}Lista</button><button role="tab" class="seg-btn ${T.tab === 'mapa' ? 'is-on' : ''}" aria-selected="${T.tab === 'mapa'}" data-act="techTab" data-tab="mapa">${icon('map')}Mapa</button></div>`}
        </header>
        <main id="main" class="tech-body" tabindex="-1">${body}</main>
      </div></div>`;
  };
  H.change.techCrew = (v) => { const [c, n] = v.split('-'); S.tech.contractor = c; S.tech.crew = n; S.tech.open = null; };
  H.act.techTab = (d) => { S.tech.tab = d.tab; };

  function listTab(r) {
    const cfg = st.routeCfg[S.tech.contractor];
    if (!r.legs.length) return U.empty('Sin visitas asignadas hoy', 'Cuando el contratista te asigne una cita, aparecerá aquí al instante.', 'route');
    return `<p class="muted small tech-note">${icon('route')}Orden de ruta optimizado con tráfico. Salida de ${D.PLACES[cfg.start].label} a las ${st.hm(cfg.depart)}; fin en ${D.PLACES[cfg.end].label} ≈ ${st.hm(r.finish)}.</p>
    <ol class="visit-list">${r.legs.map((l, i) => {
      const a = l.stop.a, done = DONE.includes(a.status);
      return `<li><button class="visit-card ${done ? 'is-done' : ''}" data-act="techOpen" data-id="${a.id}" aria-label="Visita ${i + 1}: ${esc(a.address)}, ${a.zone}, ${a.slot}, ${esc(a.status)}">
        <span class="visit-num">${i + 1}</span>
        <span class="visit-main">
          <span class="visit-slot">${icon('clock')}${a.slot}</span>
          <span class="visit-addr">${esc(a.address)}</span>
          <span class="muted small">${a.zone}${done ? '' : ` · llegada estimada ${st.hm(l.arrive)}`}</span>
          <span>${chip(a.status)}${a.arrived && a.status === 'En camino' ? ' ' + tag('En el predio', 'blue') : ''}</span>
        </span>${icon('chevron')}</button></li>`;
    }).join('')}</ol>`;
  }

  function mapTab(r, o) {
    if (!r.legs.length) return U.empty('Sin ruta para hoy', 'No tienes visitas asignadas.', 'map');
    const cfg = st.routeCfg[S.tech.contractor];
    const done = new Set(r.legs.filter((l) => DONE.includes(l.stop.a.status)).map((l) => l.stop.id));
    return `<div class="map-box tech-map">${H.map.svg({ opts: o, result: r, time: cfg.depart, cond: cfg.cond, doneIds: done, compact: true, title: 'Mapa de la ruta de hoy' })}</div>
      ${H.map.legend(false)}
      <p class="muted small">Mapa esquemático de ejemplo (no es un mapa real).</p>
      <ol class="eta-list">
        <li><span class="itin-mark">A</span>${D.PLACES[cfg.start].label} · salida ${st.hm(cfg.depart)}</li>
        ${r.legs.map((l, i) => `<li><span class="itin-num">${i + 1}</span><button class="link-btn" data-act="techOpen" data-id="${l.stop.id}">${esc(l.stop.a.address)}</button> · ${l.stop.slot} · llega ${st.hm(l.arrive)}</li>`).join('')}
        <li><span class="itin-mark">B</span>${D.PLACES[cfg.end].label} · ${st.hm(r.finish)}</li>
      </ol>`;
  }

  function detail(l, r, o) {
    const T = S.tech, a = l.stop.a, i = r.legs.indexOf(l);
    const cfg = st.routeCfg[T.contractor];
    const done = DONE.includes(a.status);
    const res = T.result[a.id] || '';
    let how = '';
    if (T.howto) {
      const alts = R.alternatives(l.from, l.stop.n, l.depart, cfg.cond);
      const fromName = Object.values(D.PLACES).find((p) => D.idx[p.node] === l.from);
      how = `<section class="howto" aria-label="Cómo llegar">
        <h2 class="sub-title">${icon('nav')}Cómo llegar <span class="tag tag-gray">Simulado</span></h2>
        <p class="small muted">Desde ${fromName ? esc(fromName.label) : 'la visita anterior'} · salida ${st.hm(l.depart)} · tráfico estimado a esa hora.</p>
        <div class="map-box tech-map">${H.map.svg({ opts: null, result: null, time: l.depart, cond: cfg.cond, alts, altSel: T.alt, compact: true, title: 'Rutas para llegar a ' + a.address })}</div>
        <div class="alt-list">${alts.map((p, k) => `<button class="alt ${T.alt === k ? 'is-on' : ''}" data-act="techAlt" data-i="${k}" aria-pressed="${T.alt === k}"><span class="alt-swatch" style="background:${H.map.ALT[k % 3]}" aria-hidden="true"></span><span class="alt-main"><strong>${k === 0 ? 'Más rápida' : 'Alternativa ' + k} · ${Math.round(p.minutes)} min</strong><span class="small">${p.km.toFixed(1)} km · vía ${esc(p.via.join(' y '))}</span></span><span class="alt-side">${tag(p.level.label, p.level.key === 'fluido' ? 'green' : p.level.key === 'moderado' ? 'amber' : 'red')}</span></button>`).join('')}</div>
      </section>`;
    }
    return `<button class="btn btn-ghost btn-sm back-btn" data-act="techBack">${icon('back')}<span>Volver a la ruta</span></button>
    <article class="visit-detail">
      <p class="muted small">Visita ${i + 1} de ${r.legs.length} · ${esc(a.id)}</p>
      <h2>${esc(a.address)}</h2>
      <p>${a.zone} · <strong>${a.slot}</strong></p>
      <p>${chip(a.status)}${a.arrived && a.status === 'En camino' ? ' ' + tag('En el predio', 'blue') : ''}</p>
      <dl class="dl dl-compact">
        <div class="dl-row"><dt>Cliente</dt><dd>${esc(a.name)}</dd></div>
        <div class="dl-row"><dt>Teléfono</dt><dd class="mono">${esc(a.phone)}</dd></div>
        ${a.representative ? `<div class="dl-row"><dt>Representante</dt><dd>${esc(a.representative)}</dd></div>` : ''}
        ${done ? '' : `<div class="dl-row"><dt>Llegada estimada</dt><dd>${st.hm(l.arrive)} (${Math.round(l.travel)} min de viaje)</dd></div>`}
      </dl>
      ${a.status === 'Franja ofrecida' ? `<p class="note small">${icon('info')}<span>El cliente aún no confirma esta franja.</span></p>` : ''}
      <div class="action-grid">
        ${btn('Llamar', 'techCall', { data: { id: a.id }, cls: 'btn-ghost', icon: 'phone' })}
        ${btn('WhatsApp', 'techWa', { data: { id: a.id }, cls: 'btn-ghost', icon: 'chat' })}
        ${btn('Cómo llegar', 'techHow', { cls: 'btn-ghost' + (T.howto ? ' is-on' : ''), icon: 'nav', attrs: `aria-expanded="${T.howto}"` })}
        ${btn('Voy en camino', 'techGo', { data: { id: a.id }, cls: 'btn-primary', icon: 'route', disabled: !CAN_GO.includes(a.status) })}
        ${btn('Llegué', 'techArrive', { data: { id: a.id }, cls: 'btn-primary span-2', icon: 'arrive', disabled: !(a.status === 'En camino' && !a.arrived) })}
      </div>
      ${how}
      <section class="result" aria-labelledby="res-title">
        <h2 id="res-title" class="sub-title">${icon('flag')}Resultado de la visita</h2>
        ${done ? `<p>${chip(a.status)} ${a.comment ? `<br><span class="small">Comentario: ${esc(a.comment)}</span>` : ''}</p><p class="muted small">Resultado guardado. Pluz y el contratista ya lo ven.</p>` : `
        <fieldset class="radio-cards" ${a.status === 'En camino' ? '' : 'disabled'}>
          <legend class="sr-only">Resultado</legend>
          ${[['presente', 'Cliente presente', 'user'], ['representante', 'Representante', 'team'], ['ausente', 'Cliente ausente', 'x']].map(([k, l2, ic]) => `<label class="radio-card ${res === k ? 'is-on' : ''}"><input type="radio" name="res-${a.id}" value="${k}" data-change="techRes" data-id="${a.id}" ${res === k ? 'checked' : ''}>${icon(ic)}<span>${l2}</span></label>`).join('')}
        </fieldset>
        <label class="field"><span class="field-label">Comentario (opcional)</span><textarea id="tech-comment" class="input" rows="3" data-input="techComment" data-id="${a.id}" ${a.status === 'En camino' ? '' : 'disabled'} placeholder="Ej.: medidor en el muro lateral">${esc(T.comment[a.id] || '')}</textarea></label>
        ${a.status === 'En camino' ? '' : '<p class="muted small">Marca «Voy en camino» para registrar el resultado.</p>'}
        ${btn('Guardar', 'techSave', { data: { id: a.id }, cls: 'btn-primary btn-block', icon: 'check', disabled: a.status !== 'En camino' || !res })}`}
      </section>
    </article>`;
  }
  H.act.techOpen = (d) => { S.tech.open = d.id; S.tech.howto = false; S.tech.alt = 0; window.scrollTo(0, 0); };
  H.act.techBack = () => { S.tech.open = null; S.tech.howto = false; };
  H.act.techCall = (d) => U.toast('Llamando a ' + st.find(d.id).phone + ' (simulado).', 'info');
  H.act.techWa = () => U.toast('Se abriría WhatsApp con el cliente (simulado).', 'info');
  H.act.techHow = () => { S.tech.howto = !S.tech.howto; S.tech.alt = 0; };
  H.act.techAlt = (d) => { S.tech.alt = +d.i; };
  H.act.techGo = (d) => { A.onTheWay(d.id); U.toast('Estado «En camino». El cliente recibió la hora estimada; Pluz y el contratista lo ven.'); };
  H.act.techArrive = (d) => { A.arrived(d.id); U.toast('Llegada registrada.'); };
  H.change.techRes = (v, d) => { S.tech.result[d.id] = v; };
  H.change.techComment = (v, d) => { S.tech.comment[d.id] = v; return false; };
  H.act.techSave = (d) => {
    A.saveResult(d.id, S.tech.result[d.id], (S.tech.comment[d.id] || '').trim());
    U.toast('Resultado guardado: ' + st.find(d.id).status + '.');
  };
})();
