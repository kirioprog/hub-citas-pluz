/* Hub de citas · Enlace único del cliente (#/c/<token>).
 * Interfaz mínima, sin registro: el enlace identifica la solicitud. No muestra DNI. */
(function () {
  const H = window.Hub, D = H.data, U = H.ui, st = H.store, S = H.S, A = st.actions;
  const { esc, icon, chip, btn } = U;

  H.views.cliente = function () {
    const a = st.byToken(S.client);
    const back = S.clientFrom
      ? btn('Volver a la demostración', 'cliBack', { cls: 'btn-ghost btn-sm', icon: 'back' })
      : btn('Ir al hub (demo)', 'switchRole', { cls: 'btn-ghost btn-sm', icon: 'switch' });
    const shell = (inner) => `${U.banner()}<div class="client-page"><header class="client-top">${U.brand('Pluz Energía')}${back}</header><main id="main" class="client-main" tabindex="-1">${inner}</main>
      <footer class="client-foot small muted">${icon('shield')}No necesitas registrarte. Este enlace es personal y solo sirve para tu solicitud; no lo compartas.</footer></div>`;
    if (!a) return shell(`<section class="client-card">${U.empty('Enlace no válido', 'Revisa el enlace que recibiste por WhatsApp.', 'link')}</section>`);

    const C = S.clientUi;
    const needsConfirm = !!a.needsConfirm && !!a.date;
    const confirmed = !needsConfirm && ['Confirmada', 'Recordada', 'Reprogramada'].includes(a.status);
    let inner = `<section class="client-card">
      <p class="muted small">Solicitud ${esc(a.id)} · Factibilidad técnica</p>
      <h1>Hola, ${esc(a.name.split(' ')[0])}</h1>
      <p>${esc(a.address)}, ${a.zone}</p>
      <div class="mini-map">${H.map.slot('client', { height: '200px', label: 'Ubicación registrada de tu predio', sig: 'c|' + a.id, wheel: false, maxZoom: 16,
        draw: (c) => { H.map.pin(c, H.map.ll(a.node), icon('pin'), 'pin-place', { tip: 'Tu predio', z: 400 }); } })}</div>
      <p class="muted small">Ubicación registrada de tu predio. Si no es correcta, avísanos por WhatsApp.</p>
      <div class="visit-box">
        <span class="visit-box-icon">${icon('calendar')}</span>
        <div><p class="small muted">Tu visita</p>
          <p class="visit-box-main">${a.date ? `${U.cap(U.dateLong(a.date))}<br><strong>${a.slot}</strong>` : 'Aún sin horario'}</p>
          ${chip(a.status)}${a.eta && a.status === 'En camino' ? `<p class="small">Llegada estimada del técnico: <strong>${a.eta}</strong></p>` : ''}
          ${a.representative ? `<p class="small">Te representará: ${esc(a.representative)}</p>` : ''}
        </div>
      </div>`;

    if (a.status === 'Realizada') inner += `<p class="client-msg ok">${icon('check')}La visita técnica se realizó. Te informaremos el resultado por WhatsApp.</p>`;
    else if (a.status === 'Cancelada') inner += `<p class="client-msg">${icon('info')}Esta visita fue cancelada. Si necesitas una nueva, escríbenos por WhatsApp.</p>`;
    else if (a.status === 'En camino') inner += `<p class="client-msg ok">${icon('nav')}El técnico ya va en camino. Ya no es posible cambiar el horario.</p>`;
    else {
      if (a.status === 'Cliente ausente') inner += `<p class="client-msg warn">${icon('alert')}El técnico te visitó y no encontró a nadie. Elige un nuevo horario. Si el plazo de 3 días ya pasó, solo verás horarios que encajan en una ruta ya programada.</p>`;
      if (needsConfirm && a.date) inner += `<div class="btn-col">${btn('Confirmo este horario', 'cliConfirm', { data: { id: a.id }, cls: 'btn-primary btn-lg btn-block', icon: 'check' })}</div>`;
      if (confirmed) inner += `<p class="client-msg ok">${icon('check')}Tu visita está confirmada. Te enviaremos un recordatorio por WhatsApp.</p>`;
      inner += `</section>
      <section class="client-card">
        <h2>${a.status === 'Cliente ausente' || !a.date ? 'Elige tu horario' : '¿Necesitas otro horario?'}</h2>
        <p class="muted small">Solo mostramos horarios en los que el técnico puede llegar a tiempo. La visita debe ser dentro de los 3 días desde tu solicitud (${U.dateShort(a.requested)}).</p>
        ${btn('Elegir el primer horario disponible', 'cliFirst', { data: { id: a.id }, cls: 'btn-ghost btn-block', icon: 'zap' })}
        <div class="client-slots">${H.views.slotPicker(a, C.date, C.slot, 'cliPick', false)}</div>
        ${C.slot ? `<div class="sticky-cta">${btn('Confirmar ' + U.dayLabel(C.date) + ' · ' + C.slot, 'cliDo', { data: { id: a.id }, cls: 'btn-primary btn-lg btn-block', icon: 'check' })}</div>` : ''}
      </section>
      <section class="client-card">
        <h2>¿No estarás en casa?</h2>
        ${C.rep ? `<form data-submit="cliRep" data-id="${a.id}" class="rep-form">
            <label class="field"><span class="field-label">Nombre y relación de quien te representará</span><input id="cli-rep" class="input" placeholder="Ej.: Rosa Mendoza (hermana)" autocomplete="off"></label>
            <p class="small muted">Debe ser mayor de edad y mostrar su documento de identidad al técnico.</p>
            <div class="btn-row">${btn('Cancelar', 'cliRepToggle', { cls: 'btn-ghost' })}${btn('Registrar representante', null, { type: 'submit', cls: 'btn-primary', icon: 'user' })}</div>
          </form>` : btn('Me representará otra persona', 'cliRepToggle', { cls: 'btn-ghost btn-block', icon: 'user' })}
        <button class="link-btn danger small" data-act="cliCancelAsk" data-id="${a.id}">Ya no necesito la visita</button>`;
    }
    inner += '</section>';
    return shell(inner);
  };

  H.act.cliBack = () => {
    S.client = null; S.clientFrom = null;
    history.replaceState(null, '', location.pathname + location.search);
  };
  H.act.cliConfirm = (d) => { A.confirm(d.id, 'link único'); U.toast('¡Listo! Tu visita está confirmada.'); };
  H.act.cliPick = (d) => { S.clientUi.date = d.date; S.clientUi.slot = d.slot; };
  H.act.cliFirst = (d) => {
    const a = st.find(d.id), f = st.firstAvailable(a, true);
    if (!f) throw new Error('No hay horarios disponibles en este momento.');
    S.clientUi.date = f.date; S.clientUi.slot = f.slot;
  };
  H.act.cliDo = (d) => {
    A.clientPick(d.id, S.clientUi.date, S.clientUi.slot, 'link único');
    S.clientUi = { date: null, slot: null, rep: false };
    U.toast('¡Listo! Guardamos tu nuevo horario.');
    window.scrollTo(0, 0);
  };
  H.act.cliRepToggle = () => { S.clientUi.rep = !S.clientUi.rep; setTimeout(() => { const el = document.getElementById('cli-rep'); if (el) el.focus(); }, 0); };
  H.act.cliRep = (d) => { A.representative(d.id, document.getElementById('cli-rep').value, 'link único'); S.clientUi.rep = false; U.toast('Representante registrado.'); };
  H.act.cliCancelAsk = (d) => { S.modal = { type: 'cliCancel', id: d.id }; };
  H.modals.cliCancel = function () {
    return `<div class="modal-head"><div><h2 id="modal-title">¿Cancelar tu visita?</h2></div><button class="btn btn-icon" data-act="closeModal" aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-body"><p>Si cancelas, el técnico no irá a tu predio. Podrás pedir una nueva visita por WhatsApp.</p></div>
      <div class="modal-foot">${btn('Volver', 'closeModal', { cls: 'btn-ghost' })}${btn('Sí, cancelar visita', 'cliCancel', { data: { id: S.modal.id }, cls: 'btn-danger', icon: 'x' })}</div>`;
  };
  H.act.cliCancel = (d) => { A.clientCancel(d.id); S.modal = null; U.toast('Visita cancelada.'); };
})();
