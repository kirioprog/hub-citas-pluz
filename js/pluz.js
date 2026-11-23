/* Hub de citas · Vista de Pluz (ejecutivo comercial o de atención). */
(function () {
  const H = window.Hub, D = H.data, U = H.ui, st = H.store, S = H.S, A = st.actions;
  const { esc, icon, chip, tag, btn, select, field } = U;
  const head = (...x) => H.views.head(...x);

  const OPEN_CONFIRMED = ['Confirmada', 'Recordada', 'En camino'];

  H.views.pluz = function () {
    const page = S.page.pluz;
    const alerts = alertGroups();
    const nAlerts = alerts.reduce((s, g) => s + g.items.length, 0);
    const items = [
      { key: 'resumen', label: 'Resumen', icon: 'grid' },
      { key: 'citas', label: 'Citas', icon: 'list' },
      { key: 'alertas', label: 'Alertas', icon: 'bell', badge: nAlerts || '' },
      { key: 'simulador', label: 'Simulador de cliente', icon: 'chat' },
      { key: 'rapido', label: 'Agendamiento rápido', icon: 'zap' }
    ];
    const body = { resumen, citas, alertas: () => alertas(alerts), simulador, rapido }[page]();
    return H.views.shell(items, page, body);
  };

  /* ---------- Resumen ---------- */
  function resumen() {
    const counts = D.STATUSES.map((s) => [s, st.appts.filter((a) => a.status === s).length]);
    const risk = st.appts.filter(st.atRisk);
    const todays = st.appts.filter((a) => a.date === D.today && a.status !== 'Cancelada').sort((x, y) => (x.slot > y.slot ? 1 : -1));
    return head('Resumen', `${st.appts.length} solicitudes registradas. Las cifras se calculan con las citas de ejemplo y cambian al instante.`,
      btn('Agendamiento rápido', 'go', { data: { page: 'rapido' }, cls: 'btn-primary', icon: 'zap' })) + `
    <section class="card risk-card ${risk.length ? 'is-risk' : ''}" aria-labelledby="risk-title">
      <span class="risk-icon">${icon('alert')}</span>
      <div class="risk-text">
        <h2 id="risk-title">Citas en riesgo de plazo (3 días)</h2>
        <p class="muted">Sin confirmar y con 1 día o menos para cumplir el plazo de visita.</p>
        ${risk.length ? `<div class="risk-list">${risk.map((a) => `<button class="link-btn" data-act="open" data-id="${a.id}">${esc(a.id)} · ${esc(a.name)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="risk-num" aria-label="${risk.length} citas en riesgo">${risk.length}</div>
    </section>
    <h2 class="section-title">Citas por estado</h2>
    <div class="stat-grid">
      ${counts.map(([s, n]) => `<button class="card stat" data-act="filterState" data-state="${esc(s)}" aria-label="${n} citas en estado ${esc(s)}. Ver en la tabla"><span class="stat-num">${n}</span>${chip(s)}</button>`).join('')}
    </div>
    <div class="two-col">
      <section class="card">
        <h2 class="card-title">${icon('calendar')}Visitas de hoy</h2>
        ${todays.length ? `<ul class="mini-list">${todays.map((a) => `<li><button class="mini-row" data-act="open" data-id="${a.id}"><span class="mini-time">${a.slot}</span><span class="mini-main"><strong>${esc(a.name)}</strong><span class="muted">${a.zone} · ${D.CONTRACTORS[a.contractor]}${a.crew ? ' · Cuadrilla ' + a.crew : ''}</span></span>${chip(a.status)}</button></li>`).join('')}</ul>` : U.empty('Sin visitas hoy', 'No hay visitas programadas para hoy.')}
      </section>
      <section class="card">
        <h2 class="card-title">${icon('refresh')}Actividad reciente</h2>
        <ul class="feed compact">${st.changes.slice(0, 6).map(feedItem).join('')}</ul>
      </section>
    </div>`;
  }
  const feedItem = (c) => { const a = st.find(c.id); return `<li class="feed-item"><span class="feed-dot k-${c.kind}" aria-hidden="true"></span><div><p><strong>${esc(a.name)}</strong> · ${esc(c.text)}</p><p class="muted small">${esc(c.actor)} · ${U.stamp(c.at)} · ${esc(c.id)}</p></div></li>`; };
  H.views.feedItem = feedItem;

  H.act.filterState = (d) => { S.filters = { estado: d.state, zona: '', contratista: '', dia: '', q: '' }; S.page.pluz = 'citas'; };

  /* ---------- Citas ---------- */
  function filtered() {
    const f = S.filters;
    return st.appts.filter((a) => (!f.estado || a.status === f.estado) && (!f.zona || a.zone === f.zona) &&
      (!f.contratista || a.contractor === f.contratista) && (!f.dia || (f.dia === 'sin' ? !a.date : a.date === f.dia)) &&
      (!f.q || a.id.toLowerCase().includes(f.q.toLowerCase().trim()) || a.id.replace('FT-2026-', '').includes(f.q.trim())));
  }
  function citas() {
    const f = S.filters;
    const days = [...new Set(st.appts.map((a) => a.date).filter(Boolean))].sort();
    const rows = filtered();
    const any = f.estado || f.zona || f.contratista || f.dia || f.q;
    return head('Citas', 'Haz clic en una fila para ver el detalle, el historial y las acciones.') + `
    <div class="card filters" role="search">
      ${field('Buscar N° de solicitud', `<span class="input-icon">${icon('search')}<input id="f-q" class="input" data-input="fq" value="${esc(f.q)}" placeholder="Ej.: 1044" inputmode="numeric"></span>`)}
      ${field('Estado', select('fEstado', [['', 'Todos']].concat(D.STATUSES), f.estado, { id: 'f-estado', label: 'Estado' }))}
      ${field('Zona', select('fZona', [['', 'Todas']].concat(D.ZONES), f.zona, { id: 'f-zona', label: 'Zona' }))}
      ${field('Contratista', select('fContratista', [['', 'Todos'], ['A', 'Contratista A'], ['B', 'Contratista B']], f.contratista, { id: 'f-con', label: 'Contratista' }))}
      ${field('Día', select('fDia', [['', 'Todos']].concat(days.map((d) => [d, U.dayLabel(d)]), [['sin', 'Sin fecha']]), f.dia, { id: 'f-dia', label: 'Día' }))}
      ${any ? `<div class="filters-clear">${btn('Limpiar filtros', 'clearFilters', { cls: 'btn-ghost', icon: 'x' })}</div>` : ''}
    </div>
    <p class="muted small" aria-live="polite">${rows.length} de ${st.appts.length} citas</p>
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th scope="col">N° solicitud</th><th scope="col">Cliente</th><th scope="col">Zona</th><th scope="col">Franja</th><th scope="col">Estado</th><th scope="col">Contratista</th><th scope="col">Días restantes del plazo</th></tr></thead>
        <tbody>
          ${rows.map((a) => `<tr class="row-link ${S.selected === a.id ? 'is-on' : ''}" data-act="open" data-id="${a.id}" tabindex="0" aria-label="Ver detalle de ${esc(a.name)}">
            <td class="mono">${esc(a.id)}</td><td><strong>${esc(a.name)}</strong></td><td>${a.zone}</td>
            <td>${a.date ? `<span class="nowrap">${U.dayLabel(a.date)}</span><br><span class="muted small">${a.slot}</span>` : '<span class="muted">Sin franja</span>'}</td>
            <td>${chip(a.status)}</td><td>${D.CONTRACTORS[a.contractor]}${a.crew ? `<br><span class="muted small">Cuadrilla ${a.crew}</span>` : ''}</td>
            <td>${U.remainingText(a)}</td></tr>`).join('') || `<tr><td colspan="7">${U.empty('Sin resultados', 'Prueba con otros filtros.', 'search')}</td></tr>`}
        </tbody>
      </table>
    </div>`;
  }
  H.change.fq = (v) => { S.filters.q = v; };
  H.change.fEstado = (v) => { S.filters.estado = v; };
  H.change.fZona = (v) => { S.filters.zona = v; };
  H.change.fContratista = (v) => { S.filters.contratista = v; };
  H.change.fDia = (v) => { S.filters.dia = v; };
  H.act.clearFilters = () => { S.filters = { estado: '', zona: '', contratista: '', dia: '', q: '' }; };
  H.act.open = (d) => { S.selected = d.id; setTimeout(() => { const el = document.getElementById('drawer-close'); if (el) el.focus(); }, 0); };
  H.act.closeDetail = () => { S.selected = null; };

  /* ---------- Detalle (panel lateral) ---------- */
  const MILESTONES = [['registrada', 'Solicitud registrada'], ['whatsapp', 'WhatsApp enviado'], ['confirmo', 'Cliente confirmó'], ['recordatorio', 'Recordatorio'], ['camino', 'Técnico en camino'], ['resultado', 'Resultado']];
  const KIND_ICON = { registrada: 'edit', whatsapp: 'chat', confirmo: 'check', recordatorio: 'bell', camino: 'nav', llego: 'arrive', resultado: 'flag', reprogramada: 'calendar', cancelada: 'x', asignacion: 'team', representante: 'user', direccion: 'pin' };
  function timeline(a) {
    const items = a.history.slice().sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
    const has = (k) => a.history.some((h) => h.kind === k || (k === 'confirmo' && h.kind === 'representante'));
    const pending = a.status === 'Cancelada' ? [] : MILESTONES.filter(([k]) => !has(k));
    return `<ol class="timeline">
      ${items.map((h) => `<li class="tl-item k-${h.kind}"><span class="tl-dot">${icon(KIND_ICON[h.kind] || 'info')}</span><div><p class="tl-text">${esc(h.text)}</p><p class="muted small">${esc(h.actor)} · ${U.stamp(h.at)}</p></div></li>`).join('')}
      ${pending.map(([, l]) => `<li class="tl-item is-pending"><span class="tl-dot">${icon('clock')}</span><div><p class="tl-text">${l}</p><p class="muted small">Pendiente</p></div></li>`).join('')}
    </ol>`;
  }
  H.views.timeline = timeline;

  H.views.detail = function () {
    const a = st.find(S.selected);
    if (!a) return '';
    const closed = st.isClosed(a) || a.status === 'Cancelada';
    const url = st.linkFor(a);
    const dl = (k, v) => `<div class="dl-row"><dt>${k}</dt><dd>${v}</dd></div>`;
    return `<div class="drawer-back" data-act="closeDetail"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div class="drawer-head">
        <div><p class="muted mono small">${esc(a.id)}</p><h2 id="drawer-title">${esc(a.name)}</h2>${chip(a.status)}</div>
        <button id="drawer-close" class="btn btn-icon" data-act="closeDetail" aria-label="Cerrar detalle">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <dl class="dl">
          ${dl('Teléfono', `<span class="mono">${esc(a.phone)}</span>`)}
          ${dl('Dirección', `${esc(a.address)}, ${a.zone} ${a.addressValid ? tag('Validada', 'green') : tag('Por validar', 'amber')}`)}
          ${dl('DNI', `<span class="mono">${esc(a.dni)}</span> ${tag('Solo visible para Pluz', 'blue')}`)}
          ${dl('Franja', a.date ? `${U.cap(U.dateLong(a.date))} · <strong>${a.slot}</strong>` : 'Sin franja asignada')}
          ${dl('Contratista y cuadrilla', `${D.CONTRACTORS[a.contractor]} · ${a.crew ? 'Cuadrilla ' + a.crew : 'Sin cuadrilla'}`)}
          ${dl('Plazo de visita', `${U.remainingText(a)} <span class="muted small">(vence ${U.dateShort(st.deadline(a))}; solicitud del ${U.dateShort(a.requested)})</span>`)}
          ${dl('Intentos de contacto', a.attempts)}
          ${a.representative ? dl('Representante', esc(a.representative)) : ''}
          ${a.comment ? dl('Comentario del técnico', esc(a.comment)) : ''}
        </dl>
        <section class="link-box">
          <p class="small"><strong>${icon('link')}Enlace único del cliente</strong> · sin registro, solo para esta solicitud</p>
          <code class="link-url">${esc(url)}</code>
          <div class="btn-row">${btn('Copiar', 'copyLink', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'copy' })}${btn('Abrir como cliente', 'openLink', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'link' })}</div>
        </section>
        <h3 class="sub-title">Historial</h3>
        ${timeline(a)}
      </div>
      <div class="drawer-foot">
        <div class="btn-row">
          ${btn('Reprogramar', 'askReschedule', { data: { id: a.id }, cls: 'btn-primary', icon: 'calendar', disabled: a.status === 'Cancelada' || a.status === 'Realizada' })}
          ${btn('Cancelar', 'askCancel', { data: { id: a.id }, cls: 'btn-danger-ghost', icon: 'x', disabled: closed })}
          ${btn('Reenviar WhatsApp', 'resend', { data: { id: a.id }, cls: 'btn-ghost', icon: 'send', disabled: closed })}
        </div>
        <div class="btn-row">
          ${['Confirmada', 'Reprogramada'].includes(a.status) ? btn('Enviar recordatorio', 'reminder', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'bell' }) : ''}
          ${!a.addressValid ? btn('Validar dirección', 'validateAddress', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'pin' }) : ''}
          ${btn('Ver en simulador', 'simOpen', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'chat' })}
        </div>
      </div>
    </aside>`;
  };

  H.act.askReschedule = (d) => { S.modal = { type: 'reprogramar', id: d.id, date: null, slot: null }; };
  H.act.askCancel = (d) => { S.modal = { type: 'cancelar', id: d.id }; };
  H.act.resend = (d) => { A.resend(d.id); U.toast('WhatsApp reenviado a ' + st.find(d.id).phone + ' (simulado).'); };
  H.act.reminder = (d) => { A.reminder(d.id); U.toast('Recordatorio enviado por WhatsApp (simulado).'); };
  H.act.validateAddress = (d) => { A.validateAddress(d.id); U.toast('Dirección validada.'); };
  H.act.simOpen = (d) => { S.simId = d.id; S.selected = null; S.page.pluz = 'simulador'; S.simRep = false; };

  /* Selector de días y franjas, compartido con el enlace del cliente. */
  H.views.slotPicker = function (a, selDate, selSlot, act, staff = true) {
    const av = st.availability(a, true);
    if (!av.length) return U.empty('Plazo vencido', 'Ya no quedan días dentro del plazo de visita.', 'clock');
    return av.map((d) => `
      <fieldset class="day-block">
        <legend><span class="day-n">Día ${d.n}</span> ${U.dayLabel(d.date)} ${d.dayFour ? tag('Día 4 · solo si cabe en la ruta', 'amber') : ''}</legend>
        <div class="slot-grid">
          ${d.slots.map((s) => {
            const on = selDate === d.date && selSlot === s.slot;
            const sub = s.current ? 'Horario actual' : s.ok ? (staff ? `Cuadrilla ${s.crew} · +${Math.round(s.detour)} min de ruta` : (s.dayFour ? 'Disponible · cabe en la ruta' : 'Disponible')) : (staff ? s.reason : 'No disponible');
            return `<button type="button" class="slot ${s.ok ? 'is-ok' : 'is-no'} ${on ? 'is-on' : ''}" data-act="${act}" data-date="${d.date}" data-slot="${s.slot}" aria-pressed="${on}" ${s.ok ? '' : 'disabled'}><span class="slot-time">${s.slot}</span><span class="slot-sub">${esc(sub)}</span></button>`;
          }).join('')}
        </div>
      </fieldset>`).join('');
  };

  H.modals.reprogramar = function () {
    const m = S.modal, a = st.find(m.id);
    return `<div class="modal-head"><div><h2 id="modal-title">Reprogramar visita</h2><p class="muted">${esc(a.name)} · ${esc(a.id)} · ${D.CONTRACTORS[a.contractor]}</p></div><button class="btn btn-icon" data-act="closeModal" aria-label="Cerrar">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="note">${icon('info')}<p>La visita debe ocurrir entre el <strong>día 1 y el día 3</strong> desde la solicitud (${U.dateShort(a.requested)}). El <strong>día 4</strong> es una excepción: solo se permite si el horario cae dentro de una ruta ya programada y no la afecta; si la afecta, no se reprograma y el técnico mantiene la visita.</p></div>
      ${H.views.slotPicker(a, m.date, m.slot, 'pickResSlot')}
    </div>
    <div class="modal-foot">${btn('Volver', 'closeModal', { cls: 'btn-ghost' })}${btn(m.slot ? 'Reprogramar al ' + U.dateShort(m.date) + ' · ' + m.slot : 'Elige una franja', 'doReschedule', { cls: 'btn-primary', disabled: !m.slot, icon: 'calendar' })}</div>`;
  };
  H.act.pickResSlot = (d) => { S.modal.date = d.date; S.modal.slot = d.slot; };
  H.act.doReschedule = () => { const m = S.modal; A.pluzReschedule(m.id, m.date, m.slot); S.modal = null; U.toast('Visita reprogramada. Se envió WhatsApp al cliente para confirmar.'); };

  H.modals.cancelar = function () {
    const a = st.find(S.modal.id);
    return `<div class="modal-head"><div><h2 id="modal-title">¿Cancelar la cita?</h2><p class="muted">${esc(a.name)} · ${esc(a.id)}</p></div><button class="btn btn-icon" data-act="closeModal" aria-label="Cerrar">${icon('x')}</button></div>
    <div class="modal-body"><p>Se avisará al cliente por WhatsApp y al contratista en su feed de cambios. Esta acción no se puede deshacer en la demostración.</p></div>
    <div class="modal-foot">${btn('Volver', 'closeModal', { cls: 'btn-ghost' })}${btn('Cancelar cita', 'doCancel', { cls: 'btn-danger', icon: 'x' })}</div>`;
  };
  H.act.doCancel = () => { A.pluzCancel(S.modal.id); S.modal = null; U.toast('Cita cancelada.'); };

  /* ---------- Alertas ---------- */
  function alertGroups() {
    const open = (a) => !st.isClosed(a) && a.status !== 'Cancelada';
    return [
      { key: 'plazo', title: 'Plazo de 1 día o menos sin confirmar', icon: 'clock', tone: 'red', items: st.appts.filter(st.atRisk), why: (a) => `${st.remaining(a) <= 0 ? 'Vence hoy' : 'Queda 1 día'} · ${a.status}` },
      { key: 'sinrespuesta', title: 'Clientes sin respuesta tras 2 intentos', icon: 'chat', tone: 'amber', items: st.appts.filter((a) => a.attempts >= 2 && ['Pendiente de contacto', 'Franja ofrecida'].includes(a.status)), why: (a) => `${a.attempts} intentos de contacto` },
      { key: 'direccion', title: 'Direcciones por validar', icon: 'pin', tone: 'blue', items: st.appts.filter((a) => !a.addressValid && open(a)), why: (a) => `${a.address}, ${a.zone}` },
      { key: 'ausente', title: 'Clientes ausentes: reprogramación al día 4 sujeta a la ruta', icon: 'alert', tone: 'gray', items: st.appts.filter((a) => a.status === 'Cliente ausente' && st.dayN(a, D.today) >= 3 && D.addDays(a.requested, 4) >= D.today), why: (a) => `Día 4: ${U.dateShort(D.addDays(a.requested, 4))}` }
    ];
  }
  function alertas(groups) {
    return head('Alertas', 'Casos que necesitan una acción de Pluz.') + groups.map((g) => `
      <section class="card alert-group">
        <h2 class="card-title">${icon(g.icon)}${g.title} <span class="count tag tag-${g.tone}">${g.items.length}</span></h2>
        ${g.items.length ? `<ul class="alert-list">${g.items.map((a) => `<li><div><strong>${esc(a.name)}</strong> <span class="muted mono small">${a.id}</span><p class="muted small">${esc(g.why(a))} · ${a.zone} · ${D.CONTRACTORS[a.contractor]}</p></div><div class="btn-row">
          ${g.key === 'direccion' ? btn('Validar', 'validateAddress', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'check' }) : ''}
          ${g.key === 'sinrespuesta' || g.key === 'plazo' ? btn('Reenviar WhatsApp', 'resend', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'send' }) : ''}
          ${g.key === 'ausente' ? btn('Ver opciones', 'askReschedule', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'calendar' }) : ''}
          ${btn('Detalle', 'open', { data: { id: a.id }, cls: 'btn-ghost btn-sm', icon: 'chevron' })}</div></li>`).join('')}</ul>` : '<p class="muted">Sin casos por ahora.</p>'}
      </section>`).join('');
  }

  /* ---------- Simulador de cliente (WhatsApp) ---------- */
  H.views.chat = function (a) {
    const open = !st.isClosed(a) && a.status !== 'Cancelada';
    const lastOpt = a.chat.map((m, i) => (m.options ? i : -1)).filter((i) => i >= 0).pop();
    return a.chat.map((m, i) => `
      <div class="msg ${m.from === 'cliente' ? 'msg-out' : 'msg-in'}">
        <p>${esc(m.text)}</p>
        ${m.link ? `<button class="msg-link" data-act="openLink" data-id="${a.id}">${icon('link')}<span>${esc(st.linkFor(a).replace(/^https?:\/\//, ''))}</span></button>` : ''}
        ${m.options && m.options.length ? `<div class="msg-options">${m.options.map((o) => `<button class="msg-opt" data-act="simPick" data-id="${a.id}" data-date="${o.date}" data-slot="${o.slot}" ${open && i === lastOpt ? '' : 'disabled'}>${U.dayLabel(o.date)} · ${o.slot}</button>`).join('')}</div>` : ''}
        <span class="msg-time">${U.stamp(m.at).split(', ').pop()}${m.from === 'cliente' ? ' ✓✓' : ''}</span>
      </div>`).join('');
  };

  function simulador() {
    const a = st.find(S.simId) || st.appts[0];
    const open = !st.isClosed(a) && a.status !== 'Cancelada';
    const canAnswer = open && !!a.date && a.status !== 'Pendiente de contacto';
    return head('Simulador de cliente', 'Solo para la demostración: responde como si fueras el cliente en WhatsApp. El estado cambia en todo el sistema.') + `
    <div class="sim">
      <section class="card sim-list" aria-label="Elegir cita">
        <h2 class="card-title">${icon('list')}Citas</h2>
        <ul>${st.appts.map((x) => `<li><button class="sim-item ${x.id === a.id ? 'is-on' : ''}" data-act="simSelect" data-id="${x.id}" aria-pressed="${x.id === a.id}"><span><strong>${esc(x.name)}</strong><span class="muted small mono">${x.id}</span></span>${chip(x.status)}</button></li>`).join('')}</ul>
      </section>
      <section class="phone" aria-label="Conversación de WhatsApp simulada con ${esc(a.name)}">
        <div class="phone-head"><span class="phone-avatar">${icon('bolt')}</span><div><strong>Pluz Energía</strong><span class="small">Cuenta de empresa · simulada</span></div></div>
        <div class="chat" data-autoscroll>
          <p class="chat-day">Conversación con ${esc(a.name)} · ${esc(a.phone)}</p>
          ${H.views.chat(a)}
          ${a.status === 'Pendiente de contacto' ? `<div class="chat-system">${icon('info')}<span>Aún no se ha contactado a este cliente.</span>${btn('Enviar primer WhatsApp', 'simStart', { data: { id: a.id }, cls: 'btn-primary btn-sm', icon: 'send' })}</div>` : ''}
        </div>
        <div class="chat-actions">
          ${S.simRep ? `<form class="rep-form" data-submit="simRepSend" data-id="${a.id}"><label class="field"><span class="field-label">Nombre y relación del representante</span><input id="rep-name" class="input" value="Rosa ${esc(a.name.split(' ')[1] || '')} (hermana)"></label><div class="btn-row">${btn('Cancelar', 'simRepCancel', { cls: 'btn-ghost btn-sm' })}${btn('Enviar', null, { type: 'submit', cls: 'btn-wa btn-sm', icon: 'send' })}</div></form>` : `
          <p class="small muted">Respuestas rápidas del cliente</p>
          <div class="quick-replies">
            ${btn('Confirmo', 'simConfirm', { data: { id: a.id }, cls: 'btn-wa', disabled: !canAnswer, icon: 'check' })}
            ${btn('Cambiar fecha u hora', 'simChange', { data: { id: a.id }, cls: 'btn-wa-ghost', disabled: !canAnswer, icon: 'calendar' })}
            ${btn('Me representará otra persona', 'simRep', { data: { id: a.id }, cls: 'btn-wa-ghost', disabled: !canAnswer, icon: 'user' })}
          </div>`}
        </div>
      </section>
      <section class="card sim-info">
        <h2 class="card-title">${icon('info')}Estado en el sistema</h2>
        <p>${chip(a.status)}</p>
        <p class="small">${a.date ? `${U.cap(U.dateLong(a.date))} · <strong>${a.slot}</strong>` : 'Sin franja'}<br>${D.CONTRACTORS[a.contractor]} · ${a.crew ? 'Cuadrilla ' + a.crew : 'sin cuadrilla'}</p>
        <div class="btn-col">
          ${btn('Abrir enlace único del cliente', 'openLink', { data: { id: a.id }, cls: 'btn-ghost', icon: 'link' })}
          ${btn('Ver detalle de la cita', 'open', { data: { id: a.id }, cls: 'btn-ghost', icon: 'list' })}
        </div>
        <details class="flow"><summary>Flujo de la conversación</summary>
          <ol class="small">
            <li>Saludo con número de solicitud, dirección y plazo de 3 días.</li>
            <li>Propuesta de fecha y franja con tres respuestas rápidas.</li>
            <li><strong>Confirmo</strong>: queda confirmada y se envía el enlace único.</li>
            <li><strong>Cambiar fecha u hora</strong>: se ofrecen los 3 horarios libres más cercanos que caben en las rutas, más el enlace.</li>
            <li><strong>Me representará otra persona</strong>: se pide nombre y relación; queda confirmada.</li>
            <li>Recordatorio el día de la visita, aviso «técnico en camino» con hora estimada y resultado.</li>
            <li>Si el cliente está ausente: opción de día 4 solo si cabe en una ruta ya programada.</li>
          </ol>
        </details>
      </section>
    </div>`;
  }
  H.act.simSelect = (d) => { S.simId = d.id; S.simRep = false; };
  H.act.simStart = (d) => { A.startContact(d.id); };
  H.act.simConfirm = (d) => { A.confirm(d.id); U.toast('El cliente confirmó. Pluz, el contratista y el técnico ya lo ven.'); };
  H.act.simChange = (d) => { A.askChange(d.id); };
  H.act.simPick = (d) => { A.clientPick(d.id, d.date, d.slot, 'WhatsApp'); U.toast('Nuevo horario registrado.'); };
  H.act.simRep = () => { S.simRep = true; setTimeout(() => { const el = document.getElementById('rep-name'); if (el) el.focus(); }, 0); };
  H.act.simRepCancel = () => { S.simRep = false; };
  H.act.simRepSend = (d) => { const v = document.getElementById('rep-name').value; A.representative(d.id, v); S.simRep = false; U.toast('Representante registrado.'); };

  /* ---------- Agendamiento rápido ---------- */
  function rapido() {
    const q = S.quick, f = q.form;
    if (q.created) {
      const a = st.find(q.created);
      return head('Agendamiento rápido', 'Solicitud creada.') + `
      <section class="card success">
        <span class="success-icon">${icon('check')}</span>
        <h2>${esc(a.id)} · ${esc(a.name)}</h2>
        <p>${chip(a.status)} ${U.cap(U.dateLong(a.date))} · <strong>${a.slot}</strong> · ${D.CONTRACTORS[a.contractor]}</p>
        <p class="muted">${a.status === 'Confirmada' ? 'La visita quedó confirmada. El cliente recibió el enlace único por WhatsApp.' : 'Se envió el WhatsApp con la franja propuesta y el enlace único para que el cliente confirme o elija otro horario sin registrarse.'}</p>
        <code class="link-url">${esc(st.linkFor(a))}</code>
        <div class="btn-row">${btn('Ver en simulador', 'simOpen', { data: { id: a.id }, cls: 'btn-primary', icon: 'chat' })}${btn('Abrir enlace del cliente', 'openLink', { data: { id: a.id }, cls: 'btn-ghost', icon: 'link' })}${btn('Nuevo agendamiento', 'quickReset', { cls: 'btn-ghost', icon: 'zap' })}</div>
      </section>`;
    }
    const book = D.ADDRESS_BOOK[f.zone];
    const err = q.errors;
    return head('Agendamiento rápido', 'Registra la solicitud y el sistema propone los horarios más cercanos que mejor encajan en las rutas de las cuadrillas.') + `
    <div class="quick">
      <form class="card quick-form" data-submit="quickSearch" novalidate>
        <h2 class="card-title">${icon('user')}Datos de la solicitud</h2>
        ${field('Nombre del cliente', `<input id="q-name" class="input ${err.name ? 'is-error' : ''}" data-input="qf" data-k="name" value="${esc(f.name)}" placeholder="Ej.: Andrea Quispe" autocomplete="off">`, err.name)}
        <div class="field-row">
          ${field('Teléfono', `<input id="q-phone" class="input ${err.phone ? 'is-error' : ''}" data-input="qf" data-k="phone" value="${esc(f.phone)}" placeholder="9XX XXX XXX" inputmode="tel">`, err.phone || 'Formato 9XX XXX XXX')}
          ${field('DNI', `<input id="q-dni" class="input ${err.dni ? 'is-error' : ''}" data-input="qf" data-k="dni" value="${esc(f.dni)}" placeholder="8 dígitos" inputmode="numeric" maxlength="8">`, err.dni || 'Solo visible para Pluz')}
        </div>
        <div class="field-row">
          ${field('Zona', select('qZone', D.ZONES, f.zone, { id: 'q-zone', label: 'Zona' }))}
          ${field('Dirección (ejemplo)', select('qAddr', book.map((x, i) => [String(i), x[0]]), f.address, { id: 'q-addr', label: 'Dirección' }))}
        </div>
        ${field('Contratista', select('qCon', [['', 'Automático (menor impacto en rutas)'], ['A', 'Contratista A'], ['B', 'Contratista B']], f.contractor, { id: 'q-con', label: 'Contratista' }))}
        <div class="btn-row">${btn('Buscar horarios', null, { type: 'submit', cls: 'btn-primary', icon: 'search' })}${btn('Rellenar ejemplo', 'quickFill', { cls: 'btn-ghost', icon: 'edit' })}</div>
      </form>
      <section class="card quick-results" aria-live="polite">
        <h2 class="card-title">${icon('zap')}Horarios sugeridos</h2>
        ${q.results === null ? '<p class="muted">Completa los datos y pulsa «Buscar horarios». Se evalúan los días 1 a 3 desde hoy, la capacidad de cada franja y el desvío que causaría en cada ruta.</p>' :
          q.results.length ? `<div class="opt-list" role="radiogroup" aria-label="Horarios sugeridos">${q.results.map((o, i) => `
            <button type="button" role="radio" aria-checked="${q.sel === i}" class="opt ${q.sel === i ? 'is-on' : ''}" data-act="quickSel" data-i="${i}">
              <span class="opt-main"><strong>${U.dayLabel(o.date)} · ${o.slot}</strong><span class="muted small">Día ${o.n} · ${D.CONTRACTORS[o.contractor]} · cuadrilla sugerida ${o.crew}</span></span>
              <span class="opt-side">${i === 0 ? tag('Recomendado', 'green') : ''}<span class="small">+${Math.round(o.detour)} min de ruta</span></span>
            </button>`).join('')}</div>
            <div class="btn-row">${btn('Ofrecer por WhatsApp', 'quickCreate', { data: { mode: 'ofrecer' }, cls: 'btn-wa', icon: 'send' })}${btn('Confirmar ahora (cliente en línea)', 'quickCreate', { data: { mode: 'confirmar' }, cls: 'btn-primary', icon: 'check' })}</div>` :
          U.empty('Sin horarios', 'No hay franjas libres dentro del plazo para esta dirección.')}
      </section>
    </div>`;
  }
  H.change.qf = (v, d) => { S.quick.form[d.k] = v; return false; };
  H.change.qZone = (v) => { S.quick.form.zone = v; S.quick.form.address = '0'; S.quick.results = null; };
  H.change.qAddr = (v) => { S.quick.form.address = v; S.quick.results = null; };
  H.change.qCon = (v) => { S.quick.form.contractor = v; S.quick.results = null; };
  H.act.quickFill = () => { Object.assign(S.quick.form, { name: 'Andrea Quispe', phone: '987 654 321', dni: '44556677' }); S.quick.errors = {}; };
  H.act.quickReset = () => { S.quick = { form: { name: '', phone: '', dni: '', zone: 'Ate', address: '0', contractor: '' }, results: null, sel: 0, created: null, errors: {} }; };
  H.act.quickSel = (d) => { S.quick.sel = +d.i; };
  H.act.quickSearch = () => {
    const f = S.quick.form, e = {};
    if (!f.name.trim()) e.name = 'Escribe el nombre del cliente.';
    if (!/^9\d{2} \d{3} \d{3}$/.test(f.phone.trim())) e.phone = 'Usa el formato 9XX XXX XXX.';
    if (!/^\d{8}$/.test(f.dni.trim())) e.dni = 'El DNI debe tener 8 dígitos.';
    S.quick.errors = e;
    if (Object.keys(e).length) { S.quick.results = null; U.toast('Revisa los datos marcados.', 'error'); return; }
    const [address, node] = D.ADDRESS_BOOK[f.zone][+f.address];
    S.quick.results = st.quickOptions({ node, zone: f.zone, address }, f.contractor || null);
    S.quick.sel = 0;
  };
  H.act.quickCreate = (d) => {
    const f = S.quick.form, o = S.quick.results[S.quick.sel];
    const [address, node] = D.ADDRESS_BOOK[f.zone][+f.address];
    const a = st.actions.createQuick({ ...f, address, node }, o, d.mode);
    S.quick.created = a.id;
    U.toast(d.mode === 'confirmar' ? 'Visita confirmada y enlace enviado.' : 'WhatsApp enviado con la franja propuesta.');
  };
})();
