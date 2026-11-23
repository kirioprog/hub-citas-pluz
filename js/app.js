/* Hub de citas · Núcleo de la aplicación: estado de interfaz, render, eventos, inicio de sesión y estructura. */
(function () {
  const H = window.Hub, D = H.data, U = H.ui, st = H.store;
  const { esc, icon, btn } = U;

  const S = (H.S = {
    role: null, loginRole: null,
    page: { pluz: 'resumen', contratista: 'agenda' },
    contractor: 'A',
    tech: { contractor: 'A', crew: '1', open: null, tab: 'lista', howto: false, alt: 0, result: {}, comment: {} },
    selected: null,
    filters: { estado: '', zona: '', contratista: '', dia: '', q: '' },
    simId: 'FT-2026-1041', simRep: false,
    agendaDay: D.today, agendaZone: '', feed: 'todos',
    lab: { day: D.today, crew: '1', scenario: 'hub', leg: null, alt: 0, view: 'una', traffic: true },
    modal: null,
    client: null, clientFrom: null, clientUi: { date: null, slot: null, rep: false },
    quick: { form: { name: '', phone: '', dni: '', zone: 'Ate', address: '0', contractor: '' }, results: null, sel: 0, created: null, errors: {} },
    nav: false, mapFull: null, pluzMapDay: D.today
  });
  H.act = {}; H.change = {}; H.views = {}; H.modals = {};

  const ROLES = {
    pluz: { name: 'Pluz', desc: 'Seguimiento de todas las solicitudes y citas', icon: 'building', user: 'ejecutivo.comercial@pluz.demo', space: 'Espacio Pluz', who: 'Ejecutivo comercial' },
    contratista: { name: 'Contratista', desc: 'Agenda por zona y asignación de cuadrillas', icon: 'team', user: 'planificacion@contratista-a.demo', space: 'Espacio contratista', who: 'Planificador' },
    tecnico: { name: 'Técnico', desc: 'Tu ruta del día', icon: 'helmet', user: 'tecnico.a1@cuadrilla.demo', space: 'Espacio técnico', who: 'Técnico de campo' }
  };
  H.ROLES = ROLES;

  /* ---------- Render ---------- */
  function render() {
    const app = document.getElementById('app');
    const ae = document.activeElement;
    const fid = ae && ae.id ? ae.id : null;
    let sel = null;
    try { if (ae && typeof ae.selectionStart === 'number') sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { /* sin selección */ }
    const scrolls = {};
    document.querySelectorAll('[data-keep-scroll]').forEach((el) => { scrolls[el.dataset.keepScroll] = el.scrollTop; });

    let html;
    if (S.client) html = H.views.cliente();
    else if (!S.role) html = login();
    else if (S.role === 'pluz') html = H.views.pluz();
    else if (S.role === 'contratista') html = H.views.contratista();
    else html = H.views.tecnico();
    app.innerHTML = html;

    let over = '';
    if (S.role === 'pluz' && S.selected && !S.client) over += H.views.detail();
    if (S.modal) over += `<div class="modal-back" data-act="closeModal"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${H.modals[S.modal.type]()}</div>`;
    document.getElementById('overlay').innerHTML = over;
    document.body.classList.toggle('has-overlay', !!over);

    document.querySelectorAll('[data-keep-scroll]').forEach((el) => { if (scrolls[el.dataset.keepScroll] != null) el.scrollTop = scrolls[el.dataset.keepScroll]; });
    document.querySelectorAll('[data-autoscroll]').forEach((el) => { el.scrollTop = el.scrollHeight; });
    if (H.map && H.map.mountAll) H.map.mountAll();
    if (fid) {
      const el = document.getElementById(fid);
      if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* no aplica */ } }
    }
  }
  H.render = render;
  st.listeners.push(() => { if (!H._running) render(); });

  function run(fn) {
    H._running = true;
    let out;
    try { out = fn(); } catch (err) { U.toast(err.message, 'error'); }
    H._running = false;
    if (out !== false) render();
  }
  H.run = run;

  /* ---------- Eventos delegados ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const f = H.act[el.dataset.act];
    if (!f) return;
    e.preventDefault();
    run(() => f(el.dataset, el, e));
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el || !H.change[el.dataset.change]) return;
    run(() => H.change[el.dataset.change](el.type === 'checkbox' ? el.checked : el.value, el.dataset, el));
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (!el || !H.change[el.dataset.input]) return;
    run(() => H.change[el.dataset.input](el.value, el.dataset, el));
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-submit]');
    if (!f) return;
    e.preventDefault();
    run(() => H.act[f.dataset.submit](f.dataset, f, e));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.mapFull) { run(() => { S.mapFull = null; }); return; }
      if (S.modal) run(() => { S.modal = null; });
      else if (S.selected && S.role === 'pluz') run(() => { S.selected = null; });
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act]:not(button):not(a):not(input):not(select)')) {
      e.preventDefault();
      e.target.click();
    }
  });
  window.addEventListener('hashchange', () => run(route));

  /* Enlace único del cliente: #/c/<token> */
  function route() {
    const m = location.hash.match(/^#\/c\/([A-Za-z0-9]+)/);
    if (m) {
      const a = st.byToken(m[1]);
      S.client = a ? a.token : 'invalido';
      S.clientUi = { date: null, slot: null, rep: false };
    } else if (S.client) {
      S.client = null;
    }
  }
  H.route = route;

  /* ---------- Acciones generales ---------- */
  H.act.pickRole = (d) => { S.loginRole = d.role; };
  H.act.login = () => {
    S.role = S.loginRole;
    if (S.role === 'contratista') S.contractor = 'A';
    S.nav = false;
    setTimeout(() => { const m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); }, 0);
  };
  H.act.switchRole = () => {
    if (S.role === 'contratista' && S.page.contratista === 'cambios') st.lastSeen[S.contractor] = st.seq;
    S.role = null; S.loginRole = null; S.selected = null; S.modal = null; S.nav = false;
    if (S.client) { S.client = null; history.replaceState(null, '', location.pathname + location.search); }
  };
  H.act.closeModal = () => { S.modal = null; };
  H.act.mapFull = (d) => { S.mapFull = S.mapFull === d.key ? null : d.key; };
  H.act.mapAnim = (d) => { H.map.animate(d.key); return false; };
  H.act.toggleNav = () => { S.nav = !S.nav; };
  H.act.go = (d) => {
    if (S.role === 'contratista' && S.page.contratista === 'cambios' && d.page !== 'cambios') st.lastSeen[S.contractor] = st.seq;
    S.page[S.role] = d.page; S.nav = false; S.selected = null;
    window.scrollTo(0, 0);
  };
  H.act.copyLink = (d) => {
    const a = st.find(d.id), url = st.linkFor(a);
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    U.toast('Enlace copiado: ' + url, 'info');
  };
  H.act.openLink = (d) => {
    const a = st.find(d.id);
    S.clientFrom = S.role; S.client = a.token; S.clientUi = { date: null, slot: null, rep: false };
    S.modal = null;
    history.replaceState(null, '', '#/c/' + a.token);
    window.scrollTo(0, 0);
  };

  /* ---------- Inicio de sesión ---------- */
  function login() {
    const r = S.loginRole && ROLES[S.loginRole];
    return `${U.banner()}
    <main class="login" id="main" tabindex="-1">
      <div class="login-card">
        ${U.brand()}
        <h1 class="login-title">Ingresa a tu espacio</h1>
        <p class="muted">Elige tu rol para continuar.</p>
        <div class="role-grid" role="group" aria-label="Rol">
          ${Object.entries(ROLES).map(([k, x]) => `
            <button type="button" class="role-card ${S.loginRole === k ? 'is-on' : ''}" data-act="pickRole" data-role="${k}" aria-pressed="${S.loginRole === k}">
              <span class="role-icon">${icon(x.icon)}</span>
              <span class="role-name">${x.name}</span>
              <span class="role-desc">${x.desc}</span>
              ${S.loginRole === k ? `<span class="role-check">${icon('check')}</span>` : ''}
            </button>`).join('')}
        </div>
        ${r ? `
        <form class="login-form" data-submit="login" aria-label="Ingresar como ${r.name}">
          ${U.field('Usuario', `<input id="login-user" class="input" value="${esc(r.user)}" autocomplete="username">`)}
          ${U.field('Contraseña', `<input id="login-pass" class="input" type="password" value="demo-2026" autocomplete="current-password">`, 'Credenciales ficticias precargadas.')}
          ${btn('Ingresar', null, { type: 'submit', cls: 'btn-primary btn-block', icon: 'chevron' })}
        </form>` : ''}
        <p class="demo-note">${icon('info')}Selector de rol solo para la demostración</p>
        <p class="version-note">Versión 2026.11.23-4 · mapa estilo Google con rutas sobre calles reales</p>
        <details class="login-help">
          <summary>¿Qué se puede demostrar?</summary>
          <ol>
            <li>Pluz &gt; Simulador de cliente: Carlos Mendoza confirma su franja.</li>
            <li>Contratista &gt; Cambios: la confirmación aparece como «Nuevo».</li>
            <li>Contratista &gt; Agenda: asigna Cuadrilla 1 a Carlos.</li>
            <li>Técnico (A · Cuadrilla 1): la visita aparece en la ruta optimizada; marca «Voy en camino» y el resultado.</li>
            <li>Pluz &gt; Citas: el estado y la línea de tiempo lo reflejan todo.</li>
          </ol>
        </details>
      </div>
    </main>`;
  }

  /* ---------- Estructura de escritorio (Pluz y Contratista) ---------- */
  H.views.shell = function (items, current, content, topExtra = '') {
    const r = ROLES[S.role];
    return `${U.banner()}
    <header class="topbar">
      <button class="btn btn-icon nav-toggle" data-act="toggleNav" aria-label="Abrir menú" aria-expanded="${S.nav}">${icon('menu')}</button>
      ${U.brand()}
      <span class="space-label">${r.space}</span>
      <div class="topbar-right">
        ${topExtra}
        <span class="who"><span class="avatar" aria-hidden="true">${U.initials(r.who)}</span><span class="who-text">${r.who}</span></span>
        ${btn('Cambiar de rol', 'switchRole', { cls: 'btn-ghost', icon: 'switch' })}
      </div>
    </header>
    <div class="layout">
      <nav class="sidebar ${S.nav ? 'is-open' : ''}" aria-label="Menú principal">
        ${items.map((it) => `<button class="nav-item ${current === it.key ? 'is-on' : ''}" data-act="go" data-page="${it.key}" ${current === it.key ? 'aria-current="page"' : ''}>${icon(it.icon)}<span>${it.label}</span>${it.badge ? `<span class="nav-badge">${it.badge}</span>` : ''}</button>`).join('')}
      </nav>
      <main class="content" id="main" tabindex="-1">${content}</main>
    </div>`;
  };
  H.views.head = (title, sub, actions = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
})();
