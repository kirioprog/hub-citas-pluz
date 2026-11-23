/* Hub de citas · Estado compartido en memoria y reglas de negocio.
 * Pluz, el contratista, el técnico y el cliente leen y escriben el mismo estado:
 * cualquier cambio se refleja al instante en las demás vistas. */
(function () {
  const H = window.Hub, D = H.data, R = H.routing;

  const ROUTE_STATUSES = ['Franja ofrecida', 'Confirmada', 'Recordada', 'Reprogramada', 'En camino', 'Realizada', 'Cliente ausente'];
  const CLOSED = ['Realizada', 'Cancelada', 'Cliente ausente'];
  const UNCONFIRMED = ['Pendiente de contacto', 'Franja ofrecida'];

  const st = (H.store = {
    appts: [], changes: [], seq: 0, lastSeen: { A: 0, B: 0 }, listeners: [],
    routeCfg: {
      A: { start: 'baseA', end: 'sedeAte', depart: 465, service: 30, cond: { lluvia: false, obra: false, feria: false } },
      B: { start: 'baseB', end: 'baseB', depart: 465, service: 30, cond: { lluvia: false, obra: false, feria: false } }
    }
  });

  const hm = (m) => { const r = Math.round(m); return String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0'); };
  const lima = (date, time) => date + 'T' + time + ':00-05:00';
  const fmtDay = (d) => new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  function dayText(d) {
    const n = D.diffDays(D.today, d);
    if (n === 0) return 'hoy ' + fmtDay(d);
    if (n === 1) return 'mañana ' + fmtDay(d);
    return 'el ' + fmtDay(d);
  }
  const first = (name) => name.split(' ')[0];
  const fd = (d) => new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')).replace(/\./g, '');
  const linkFor = (a) => location.origin + location.pathname + '#/c/' + a.token;
  st.linkFor = linkFor;
  st.hm = hm;
  st.dayText = dayText;

  /* ---------- Plantillas del flujo de WhatsApp ---------- */
  const MSG = {
    saludo: (a) => `Hola ${first(a.name)}, te saluda Pluz Energía. Registramos tu solicitud ${a.id} de factibilidad técnica para ${a.address}, ${a.zone}. Un técnico debe visitar el predio para evaluar la conexión. La visita debe realizarse dentro de los 3 días siguientes a tu solicitud.`,
    oferta: (a) => `Te proponemos la visita para ${dayText(a.date)}, entre las ${a.slot.replace('–', ' y las ')}. ¿Te queda bien?`,
    confirmado: (a) => `Listo, tu visita quedó confirmada para ${dayText(a.date)} de ${a.slot}. El día de la visita te enviaremos un recordatorio. Si necesitas cambiarla, usa tu enlace personal (no necesitas registrarte):`,
    opciones: () => 'Estos son los horarios disponibles más cercanos. También puedes elegir otro desde tu enlace personal:',
    representante: () => 'Indícanos el nombre de la persona que te representará y su relación contigo (por ejemplo, familiar o inquilino).',
    representanteOk: (a) => `Registramos a ${a.representative} como tu representante. Debe estar en el predio ${dayText(a.date)} de ${a.slot} y mostrar su documento de identidad al técnico.`,
    reprogramado: (a) => `Tu visita quedó reprogramada para ${dayText(a.date)} de ${a.slot}. Gracias por avisarnos.`,
    reprogramadoPluz: (a) => `Necesitamos reprogramar tu visita. Nueva propuesta: ${dayText(a.date)} de ${a.slot}. ¿Te queda bien?`,
    recordatorio: (a) => `Recordatorio: ${dayText(a.date)} te visita el técnico de Pluz entre las ${a.slot.replace('–', ' y las ')}. Por favor, asegúrate de que haya alguien mayor de edad en el predio.`,
    reenvio: (a) => `Hola ${first(a.name)}, aún no recibimos tu respuesta sobre la visita técnica de la solicitud ${a.id}. Puedes responder aquí o elegir tu horario desde este enlace:`,
    enCamino: (a, eta) => `El técnico de Pluz va en camino a ${a.address}. Llegada estimada: ${eta}.`,
    llego: () => 'El técnico llegó a tu predio.',
    realizada: () => 'La visita técnica se realizó. Gracias por atendernos. Te informaremos el resultado de la factibilidad por este medio.',
    ausente: (a) => `El técnico visitó tu predio y no encontró a nadie. Si aún estás dentro del plazo, puedes elegir un nuevo horario desde tu enlace. Fuera del plazo de 3 días, solo podremos atenderte si el horario encaja en una ruta ya programada.`,
    cancelada: () => 'Tu visita fue cancelada. Si necesitas una nueva visita, responde a este mensaje.'
  };
  st.MSG = MSG;

  /* ---------- Utilidades ---------- */
  const find = (id) => st.appts.find((a) => a.id === id);
  st.find = find;
  st.byToken = (t) => st.appts.find((a) => a.token === t);
  st.isClosed = (a) => CLOSED.includes(a.status);
  st.deadline = (a) => D.addDays(a.requested, 3);
  st.remaining = (a) => D.diffDays(D.today, st.deadline(a));
  st.atRisk = (a) => !CLOSED.includes(a.status) && a.status !== 'Cancelada' && UNCONFIRMED.includes(a.status) && st.remaining(a) <= 1;
  st.dayN = (a, date) => D.diffDays(a.requested, date);

  function chat(a, from, text, extra = {}) {
    a.chat.push(Object.assign({ from, text, at: new Date().toISOString() }, extra));
  }
  function log(a, kind, text, actor, change) {
    const at = new Date().toISOString();
    a.history.push({ kind, text, actor, at });
    if (change) {
      st.seq++;
      st.changes.unshift({ seq: st.seq, id: a.id, contractor: a.contractor, kind: change, text, actor, at });
    }
  }
  function emit() { st.listeners.forEach((f) => f()); }

  /* ---------- Rutas por cuadrilla ---------- */
  function placeIdx(key) { return D.PLACES[key].node; }
  st.options = (contractor, override) => {
    const c = Object.assign({}, st.routeCfg[contractor], override || {});
    return { start: placeIdx(c.start), end: placeIdx(c.end), depart: c.depart, service: c.service, cond: c.cond };
  };
  const toStop = (a, slot = a.slot) => ({ id: a.id, n: a.node, win: D.slotWindow(slot), label: a.name, a, slot });
  st.toStop = toStop;
  st.crewStops = (contractor, crew, date, exclude) => st.appts
    .filter((a) => a.contractor === contractor && a.crew === crew && a.date === date && ROUTE_STATUSES.includes(a.status) && a.id !== exclude)
    .map((a) => toStop(a));
  st.route = (contractor, crew, date) => R.optimize(st.crewStops(contractor, crew, date), st.options(contractor));

  /* ¿Cabe la cita en esa fecha y franja?
   * Días 1 a 3: debe haber cupo en la franja y la cuadrilla debe llegar a tiempo sin retrasar
   * otras visitas. Día 4 (excepción): además debe existir una ruta ya programada ese día,
   * la franja debe caer dentro del recorrido y el desvío no puede superar 25 minutos. */
  const MAX_DETOUR_DAY4 = 25;
  st.fit = function (a, date, slot, opts = {}) {
    const contractor = opts.contractor || a.contractor;
    const fixedCrew = opts.crew || a.crew;
    const crews = fixedCrew ? [fixedCrew] : D.CREWS;
    const dayFour = st.dayN(a, date) === 4;
    const o = st.options(contractor);
    const win = D.slotWindow(slot);
    let best = null; const reasons = [];
    for (const crew of crews) {
      const stops = st.crewStops(contractor, crew, date, a.id);
      if (stops.filter((s) => s.slot === slot).length >= D.CREW_SLOT_CAPACITY) { reasons.push('Franja llena'); continue; }
      if (dayFour && !stops.length) { reasons.push('Sin ruta programada ese día'); continue; }
      const base = R.optimize(stops, o);
      const withNew = R.optimize(stops.concat([toStop(a, slot)]), o);
      const mine = withNew.legs.find((l) => l.stop.id === a.id);
      if (mine.late > 0) { reasons.push('El técnico llegaría fuera de la franja'); continue; }
      if (withNew.late > base.late + 0.01) { reasons.push('Retrasaría otras visitas de la ruta'); continue; }
      const detour = Math.max(0, withNew.travel - base.travel);
      if (dayFour) {
        const spanStart = Math.min(...base.legs.map((l) => l.stop.win[0]));
        const spanEnd = Math.max(...base.legs.map((l) => l.finish));
        if (!(win[0] < spanEnd && win[1] > spanStart)) { reasons.push('Afecta la ruta: fuera del recorrido programado'); continue; }
        if (detour > MAX_DETOUR_DAY4) { reasons.push('Afecta la ruta: desvío de ' + Math.round(detour) + ' min'); continue; }
      }
      const cand = { ok: true, crew, contractor, detour, eta: mine.arrive, start: mine.start, dayFour, assigned: !!fixedCrew };
      if (!best || cand.detour < best.detour) best = cand;
    }
    return best || { ok: false, reason: reasons[0] || 'No disponible', dayFour };
  };

  /* Días permitidos: del día 1 al 3 desde la solicitud, y el día 4 solo si cabe en una ruta. */
  st.allowedDates = function (a, includeFour = true) {
    const out = [];
    for (let n = 1; n <= (includeFour ? 4 : 3); n++) {
      const d = D.addDays(a.requested, n);
      if (d < D.today || !D.slotsFor(d).length) continue;
      out.push({ date: d, n, dayFour: n === 4 });
    }
    return out;
  };
  st.availability = function (a, includeFour = true) {
    return st.allowedDates(a, includeFour).map((d) => ({
      ...d,
      slots: D.slotsFor(d.date).map((slot) => {
        const current = a.date === d.date && a.slot === slot && !CLOSED.includes(a.status);
        return Object.assign({ slot, current }, current ? { ok: false, reason: 'Horario actual' } : st.fit(a, d.date, slot));
      })
    }));
  };
  st.firstAvailable = function (a, includeFour = false) {
    for (const d of st.availability(a, includeFour)) for (const s of d.slots) if (s.ok) return { date: d.date, slot: s.slot, fit: s };
    return null;
  };
  st.nearestOptions = function (a, k = 3) {
    const out = [];
    for (const d of st.availability(a, false)) for (const s of d.slots) if (s.ok && out.length < k) out.push({ date: d.date, slot: s.slot });
    return out;
  };

  /* ---------- Acciones ---------- */
  const A = (st.actions = {});

  A.startContact = function (id) {
    const a = find(id);
    if (!a.date) {
      const f = st.firstAvailable(a, false);
      if (!f) throw new Error('No hay horarios disponibles dentro del plazo.');
      a.date = f.date; a.slot = f.slot;
    }
    a.attempts++;
    a.status = 'Franja ofrecida'; a.needsConfirm = true;
    chat(a, 'pluz', MSG.saludo(a));
    chat(a, 'pluz', MSG.oferta(a), { quick: true });
    log(a, 'whatsapp', 'WhatsApp enviado · franja ofrecida: ' + fd(a.date) + ' · ' + a.slot, 'Pluz', 'contacto');
    emit();
  };

  A.confirm = function (id, via = 'WhatsApp') {
    const a = find(id);
    if (st.isClosed(a) || a.status === 'Cancelada') throw new Error('La cita ya está cerrada.');
    if (!a.date) throw new Error('Aún no hay una franja propuesta.');
    if (via === 'WhatsApp') chat(a, 'cliente', 'Confirmo');
    if (['Confirmada', 'Recordada', 'En camino'].includes(a.status)) {
      chat(a, 'pluz', 'Tu visita ya estaba confirmada para ' + dayText(a.date) + ' de ' + a.slot + '.');
      emit(); return;
    }
    a.status = 'Confirmada'; a.needsConfirm = false;
    chat(a, 'pluz', MSG.confirmado(a), { link: true });
    log(a, 'confirmo', 'Cliente confirmó la visita · ' + fd(a.date) + ' · ' + a.slot + ' (vía ' + via + ')', 'Cliente', 'confirmacion');
    emit();
  };

  A.askChange = function (id) {
    const a = find(id);
    chat(a, 'cliente', 'Cambiar fecha u hora');
    const opts = st.nearestOptions(a, 3);
    chat(a, 'pluz', opts.length ? MSG.opciones() : 'Por ahora no hay horarios libres dentro del plazo. Revisa tu enlace personal:', { options: opts, link: true });
    emit();
  };

  A.clientPick = function (id, date, slot, via = 'link único') {
    const a = find(id);
    if (a.status === 'Cancelada' || a.status === 'Realizada') throw new Error('La cita ya está cerrada.');
    const f = st.fit(a, date, slot);
    if (!f.ok) {
      if (f.dayFour) throw new Error('No es posible reprogramar al día 4: ' + f.reason.toLowerCase() + '. Se mantiene la visita programada.');
      throw new Error('Ese horario no está disponible: ' + f.reason.toLowerCase() + '.');
    }
    const wasNew = UNCONFIRMED.includes(a.status);
    const prev = a.date ? fd(a.date) + ' · ' + a.slot : 'sin fecha';
    a.date = date; a.slot = slot; a.arrived = false; a.needsConfirm = false;
    if (via === 'WhatsApp') chat(a, 'cliente', 'Elijo ' + dayText(date) + ', ' + slot);
    if (wasNew) {
      a.status = 'Confirmada';
      chat(a, 'pluz', MSG.confirmado(a), { link: true });
      log(a, 'confirmo', 'Cliente eligió y confirmó ' + fd(date) + ' · ' + slot + ' (vía ' + via + ')', 'Cliente', 'confirmacion');
    } else {
      a.status = 'Reprogramada';
      chat(a, 'pluz', MSG.reprogramado(a), { link: true });
      log(a, 'reprogramada', 'Cliente reprogramó: ' + prev + ' → ' + fd(date) + ' · ' + slot + (f.dayFour ? ' (día 4, cabe en la ruta)' : '') + ' (vía ' + via + ')', 'Cliente', 'reprogramacion');
    }
    emit();
  };

  A.representative = function (id, name, via = 'WhatsApp') {
    const a = find(id);
    if (!name || !name.trim()) throw new Error('Escribe el nombre del representante.');
    a.representative = name.trim();
    if (via === 'WhatsApp') { chat(a, 'cliente', 'Me representará otra persona'); chat(a, 'pluz', MSG.representante()); chat(a, 'cliente', a.representative); }
    const wasNew = UNCONFIRMED.includes(a.status);
    if (wasNew) a.status = 'Confirmada';
    a.needsConfirm = false;
    chat(a, 'pluz', MSG.representanteOk(a), { link: true });
    log(a, 'representante', 'Cliente registró representante: ' + a.representative + (wasNew ? ' · visita confirmada' : ''), 'Cliente', 'confirmacion');
    emit();
  };

  A.clientCancel = function (id) {
    const a = find(id);
    a.status = 'Cancelada';
    chat(a, 'pluz', MSG.cancelada());
    log(a, 'cancelada', 'Cliente canceló la visita', 'Cliente', 'cancelacion');
    emit();
  };

  A.pluzReschedule = function (id, date, slot) {
    const a = find(id);
    const f = st.fit(a, date, slot);
    if (!f.ok) throw new Error(f.dayFour ? 'No se reprograma al día 4: ' + f.reason.toLowerCase() + '. El técnico mantiene la visita programada.' : 'Horario no disponible: ' + f.reason.toLowerCase() + '.');
    const prev = a.date ? fd(a.date) + ' · ' + a.slot : 'sin fecha';
    a.date = date; a.slot = slot; a.status = 'Reprogramada'; a.arrived = false; a.needsConfirm = true;
    chat(a, 'pluz', MSG.reprogramadoPluz(a), { quick: true });
    log(a, 'reprogramada', 'Pluz reprogramó: ' + prev + ' → ' + fd(date) + ' · ' + slot + (f.dayFour ? ' (día 4, cabe en la ruta)' : ''), 'Pluz', 'reprogramacion');
    emit();
  };

  /* El contratista reprograma una cita dentro de la ruta de una cuadrilla (con validación de ruta). */
  A.reprogramToCrew = function (id, date, slot, crew) {
    const a = find(id);
    const n = st.dayN(a, date);
    if (n < 1 || n > 4) throw new Error('Fuera del plazo: sería el día ' + n + ' desde la solicitud.');
    const f = st.fit(a, date, slot, { crew });
    if (!f.ok) throw new Error('No se reprograma: ' + f.reason.toLowerCase() + '.');
    const prev = a.date ? fd(a.date) + ' · ' + a.slot + (a.crew ? ' · Cuadrilla ' + a.crew : '') : 'sin fecha';
    a.crew = crew; a.date = date; a.slot = slot; a.status = 'Reprogramada'; a.arrived = false; a.needsConfirm = true;
    chat(a, 'pluz', MSG.reprogramadoPluz(a), { quick: true });
    log(a, 'reprogramada', 'Contratista reprogramó: ' + prev + ' → ' + fd(date) + ' · ' + slot + ' · Cuadrilla ' + crew + (f.dayFour ? ' (día 4, cabe en la ruta)' : '') + ' · +' + Math.round(f.detour) + ' min de ruta', D.CONTRACTORS[a.contractor], 'reprogramacion');
    emit();
  };

  A.pluzCancel = function (id) {
    const a = find(id);
    a.status = 'Cancelada';
    chat(a, 'pluz', MSG.cancelada());
    log(a, 'cancelada', 'Pluz canceló la cita', 'Pluz', 'cancelacion');
    emit();
  };

  A.resend = function (id) {
    const a = find(id);
    if (a.status === 'Pendiente de contacto') return A.startContact(id);
    a.attempts++;
    chat(a, 'pluz', MSG.reenvio(a), { link: true, quick: !['Confirmada', 'Recordada', 'En camino'].includes(a.status) });
    log(a, 'whatsapp', 'WhatsApp reenviado (intento ' + a.attempts + ')', 'Pluz', null);
    emit();
  };

  A.reminder = function (id) {
    const a = find(id);
    if (!['Confirmada', 'Reprogramada'].includes(a.status)) throw new Error('Solo se recuerdan citas confirmadas o reprogramadas.');
    a.status = 'Recordada';
    chat(a, 'pluz', MSG.recordatorio(a));
    log(a, 'recordatorio', 'Recordatorio de visita enviado', 'Pluz', null);
    emit();
  };

  A.validateAddress = function (id) {
    const a = find(id);
    a.addressValid = true;
    log(a, 'direccion', 'Dirección validada por Pluz', 'Pluz', null);
    emit();
  };

  A.assignCrew = function (id, crew) {
    const a = find(id);
    if (crew && a.date && a.slot) {
      const taken = st.crewStops(a.contractor, crew, a.date, a.id).filter((s) => s.slot === a.slot).length;
      if (taken >= D.CREW_SLOT_CAPACITY) throw new Error('La Cuadrilla ' + crew + ' ya tiene ' + taken + ' visitas en ' + a.slot + '.');
    }
    a.crew = crew || null;
    log(a, 'asignacion', crew ? 'Asignada a Cuadrilla ' + crew + ' (' + D.CONTRACTORS[a.contractor] + ')' : 'Cuadrilla desasignada', D.CONTRACTORS[a.contractor], 'asignacion');
    emit();
  };

  A.onTheWay = function (id) {
    const a = find(id);
    const r = st.route(a.contractor, a.crew, a.date);
    const lg = r.legs.find((l) => l.stop.id === a.id);
    const eta = lg ? hm(lg.arrive) : '—';
    a.status = 'En camino'; a.eta = eta;
    chat(a, 'pluz', MSG.enCamino(a, eta));
    log(a, 'camino', 'Técnico en camino · llegada estimada ' + eta, 'Técnico · Cuadrilla ' + a.crew, 'campo');
    emit();
  };

  A.arrived = function (id) {
    const a = find(id);
    a.arrived = true;
    chat(a, 'pluz', MSG.llego());
    log(a, 'llego', 'Técnico llegó al predio', 'Técnico · Cuadrilla ' + a.crew, 'campo');
    emit();
  };

  A.saveResult = function (id, outcome, comment) {
    const a = find(id);
    if (!outcome) throw new Error('Elige el resultado de la visita.');
    const label = { presente: 'cliente presente', representante: 'atendió un representante', ausente: 'cliente ausente' }[outcome];
    a.status = outcome === 'ausente' ? 'Cliente ausente' : 'Realizada';
    a.result = outcome; a.comment = comment || '';
    chat(a, 'pluz', outcome === 'ausente' ? MSG.ausente(a) : MSG.realizada(a), outcome === 'ausente' ? { link: true } : {});
    log(a, 'resultado', 'Resultado: ' + label + (comment ? ' · "' + comment + '"' : ''), 'Técnico · Cuadrilla ' + a.crew, 'campo');
    emit();
  };

  A.createQuick = function (f, opt, mode) {
    const n = 1041 + st.appts.length;
    const token = Math.random().toString(36).slice(2, 8);
    const a = {
      id: 'FT-2026-' + n, name: f.name.trim(), phone: f.phone.trim(), zone: f.zone, address: f.address, node: f.node, pt: f.pt,
      status: 'Pendiente de contacto', contractor: opt.contractor, crew: null, requested: D.today, date: opt.date, slot: opt.slot,
      attempts: 0, addressValid: true, dni: f.dni.trim(), token, history: [], chat: [], representative: null, comment: '', arrived: false, quick: true
    };
    st.appts.push(a);
    log(a, 'registrada', 'Solicitud registrada (agendamiento rápido)', 'Pluz', null);
    a.attempts = 1;
    chat(a, 'pluz', MSG.saludo(a));
    if (mode === 'confirmar') {
      a.status = 'Confirmada';
      log(a, 'whatsapp', 'WhatsApp enviado con el enlace personal', 'Pluz', null);
      log(a, 'confirmo', 'Cliente confirmó en línea · ' + fd(a.date) + ' · ' + a.slot + ' (agendamiento rápido)', 'Cliente', 'confirmacion');
      chat(a, 'pluz', MSG.confirmado(a), { link: true });
    } else {
      a.status = 'Franja ofrecida'; a.needsConfirm = true;
      chat(a, 'pluz', MSG.oferta(a), { quick: true });
      log(a, 'whatsapp', 'WhatsApp enviado · franja ofrecida: ' + fd(a.date) + ' · ' + a.slot, 'Pluz', 'contacto');
    }
    emit();
    return a;
  };

  /* Opciones de agendamiento rápido: recorre contratistas, días y franjas y ordena
   * por fecha más próxima y menor impacto en las rutas. */
  st.quickOptions = function (f, contractor) {
    const tmp = { id: '__nuevo__', node: f.node, requested: D.today, contractor: contractor || 'A', crew: null, date: null, slot: null, status: 'Pendiente de contacto' };
    const out = [];
    for (const c of contractor ? [contractor] : Object.keys(D.CONTRACTORS)) {
      tmp.contractor = c;
      for (const d of st.allowedDates(tmp, false)) for (const slot of D.slotsFor(d.date)) {
        const fit = st.fit(tmp, d.date, slot, { contractor: c });
        if (fit.ok) out.push({ contractor: c, date: d.date, slot, crew: fit.crew, detour: fit.detour, n: d.n });
      }
    }
    out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.detour - y.detour));
    const perDay = {};
    return out.filter((o) => (perDay[o.date] = (perDay[o.date] || 0) + 1) <= 2).slice(0, 6);
  };

  /* ---------- Carga de los datos de ejemplo ---------- */
  function seed() {
    D.SEED.forEach((r) => {
      const [n, name, phone, zone, address, pt, status, contractor, crew, reqOff, dateOff, slot, attempts, addressValid, dni, token] = r;
      const requested = D.addDays(D.today, reqOff);
      const date = dateOff === null ? null : dateOff === 0 ? D.today : D.nextWorkday(D.today, dateOff);
      const slots = date ? D.slotsFor(date) : [];
      const a = {
        id: 'FT-2026-' + n, name, phone, zone, address, pt, node: D.snap(pt[0], pt[1]), status, contractor, crew, requested, date,
        slot: date ? (slots.includes(slot) ? slot : slots[0]) : null, attempts, addressValid, dni, token,
        history: [], chat: [], representative: null, comment: '', arrived: false, needsConfirm: status === 'Franja ofrecida'
      };
      const h = (kind, text, actor, d, t) => a.history.push({ kind, text, actor, at: lima(d, t) });
      h('registrada', 'Solicitud registrada', 'Pluz', requested, '08:40');
      if (status !== 'Pendiente de contacto') {
        h('whatsapp', 'WhatsApp enviado · franja ofrecida', 'Pluz', requested, '09:15');
        a.chat.push({ from: 'pluz', text: MSG.saludo(a), at: lima(requested, '09:15') });
        a.chat.push({ from: 'pluz', text: MSG.oferta(a), at: lima(requested, '09:15'), quick: status === 'Franja ofrecida' });
      } else {
        h('whatsapp', 'Intento de contacto 1 · sin respuesta', 'Pluz', requested, '09:20');
        h('whatsapp', 'Intento de contacto 2 · sin respuesta', 'Pluz', D.addDays(requested, 1), '10:05');
      }
      if (['Confirmada', 'Recordada', 'En camino', 'Realizada', 'Cliente ausente', 'Reprogramada'].includes(status)) {
        h('confirmo', 'Cliente confirmó la visita (vía WhatsApp)', 'Cliente', requested, '10:30');
        a.chat.push({ from: 'cliente', text: 'Confirmo', at: lima(requested, '10:30') });
        a.chat.push({ from: 'pluz', text: MSG.confirmado(a), at: lima(requested, '10:31'), link: true });
      }
      if (status === 'Reprogramada') {
        h('reprogramada', 'Cliente reprogramó al ' + fd(a.date) + ' · ' + a.slot + ' (vía link único)', 'Cliente', D.today, '07:10');
        a.chat.push({ from: 'pluz', text: MSG.reprogramado(a), at: lima(D.today, '07:10'), link: true });
      }
      if (status === 'Cancelada') {
        h('cancelada', 'Cliente canceló la visita (vía WhatsApp)', 'Cliente', requested, '11:00');
        a.chat.push({ from: 'cliente', text: 'Ya no necesito la visita, gracias.', at: lima(requested, '11:00') });
        a.chat.push({ from: 'pluz', text: MSG.cancelada(), at: lima(requested, '11:01') });
      }
      if (crew) h('asignacion', 'Asignada a Cuadrilla ' + crew + ' (' + D.CONTRACTORS[contractor] + ')', D.CONTRACTORS[contractor], requested, '16:00');
      if (status === 'Recordada') {
        h('recordatorio', 'Recordatorio de visita enviado', 'Pluz', a.date, '07:00');
        a.chat.push({ from: 'pluz', text: MSG.recordatorio(a), at: lima(a.date, '07:00') });
      }
      if (['En camino', 'Realizada', 'Cliente ausente'].includes(status)) {
        h('recordatorio', 'Recordatorio de visita enviado', 'Pluz', a.date, '07:00');
        a.chat.push({ from: 'pluz', text: MSG.recordatorio(a), at: lima(a.date, '07:00') });
        const t0 = status === 'En camino' ? '09:52' : '07:55';
        h('camino', 'Técnico en camino', 'Técnico · Cuadrilla ' + crew, a.date, t0);
        a.chat.push({ from: 'pluz', text: MSG.enCamino(a, status === 'En camino' ? '10:15' : '08:20'), at: lima(a.date, t0) });
      }
      if (status === 'Realizada') {
        a.arrived = true; a.result = 'presente';
        h('llego', 'Técnico llegó al predio', 'Técnico · Cuadrilla ' + crew, a.date, '08:18');
        h('resultado', 'Resultado: cliente presente', 'Técnico · Cuadrilla ' + crew, a.date, '08:50');
        a.chat.push({ from: 'pluz', text: MSG.realizada(a), at: lima(a.date, '08:50') });
      }
      if (status === 'Cliente ausente') {
        a.arrived = true; a.result = 'ausente';
        h('llego', 'Técnico llegó al predio', 'Técnico · Cuadrilla ' + crew, a.date, '08:24');
        h('resultado', 'Resultado: cliente ausente · "Se tocó la puerta y se llamó dos veces"', 'Técnico · Cuadrilla ' + crew, a.date, '08:40');
        a.chat.push({ from: 'pluz', text: MSG.ausente(a), at: lima(a.date, '08:40'), link: true });
      }
      st.appts.push(a);
    });
    // Cambios recientes ya vistos por el contratista (sin marca "Nuevo").
    const seedChanges = [
      ['FT-2026-1043', 'campo', 'Técnico en camino · llegada estimada 10:15', 'Técnico · Cuadrilla 2'],
      ['FT-2026-1048', 'campo', 'Resultado: cliente ausente', 'Técnico · Cuadrilla 3'],
      ['FT-2026-1046', 'reprogramacion', 'Cliente reprogramó su visita (vía link único)', 'Cliente'],
      ['FT-2026-1042', 'confirmacion', 'Cliente confirmó la visita (vía WhatsApp)', 'Cliente'],
      ['FT-2026-1047', 'cancelacion', 'Cliente canceló la visita (vía WhatsApp)', 'Cliente']
    ];
    seedChanges.reverse().forEach(([id, kind, text, actor]) => {
      const a = find(id);
      const h = [...a.history].reverse().find((x) => x.text.startsWith(text.split(' (')[0].split(' ·')[0])) || a.history[a.history.length - 1];
      st.seq++;
      st.changes.unshift({ seq: st.seq, id, contractor: a.contractor, kind, text, actor, at: h.at });
    });
    st.changes.sort((x, y) => (x.at < y.at ? 1 : -1));
    st.lastSeen = { A: st.seq, B: st.seq };
  }
  seed();
})();
