/* Hub de citas · Utilidades de interfaz e íconos SVG. */
(function () {
  const H = window.Hub, D = H.data;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const P = {
    bolt: 'M13 2 4 14h7l-1 8 10-12h-7l1-8z',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
    calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
    chat: 'M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z',
    team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.8',
    route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M8 17h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16',
    building: 'M4 22V5h11v17 M15 10h5v12 M2 22h20 M8 9h3 M8 13h3 M8 17h3',
    helmet: 'M3 18h18 M5 18v-3a7 7 0 0 1 14 0v3 M12 8V4 M9 9.5 8 6 M15 9.5 16 6',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 7v5l3 2',
    check: 'M5 12l4 4L19 6',
    shield: 'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z',
    switch: 'M3 7h16 M15 3l4 4-4 4 M21 17H5 M9 13l-4 4 4 4',
    pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    user: 'M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
    alert: 'M12 3l10 18H2z M12 10v4 M12 17.5v.01',
    x: 'M6 6l12 12 M18 6 6 18',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
    phone: 'M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M16 16l5 5',
    refresh: 'M20 4v6h-6 M20 10a8 8 0 1 0 1 5',
    info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 11v6 M12 7.5v.01',
    back: 'M19 12H5 M11 6l-6 6 6 6',
    chevron: 'M9 5l7 7-7 7',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
    send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4z',
    zap: 'M13 2 4 14h7l-1 8 10-12h-7l1-8z',
    nav: 'M3 11l18-8-8 18-2-8z',
    map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14',
    flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
    arrive: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z M9 10l2 2 4-4',
    edit: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
    traffic: 'M8 2h8v20H8z M12 6.5v.01 M12 12v.01 M12 17.5v.01',
    layers: 'M12 3 2 8l10 5 10-5z M2 13l10 5 10-5',
    chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
    moto: 'M5.5 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18.5 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M5.5 16h6l3-6h2.5 M14 6h3l1.5 10 M8 10h4',
    right: 'M5 20v-7a4 4 0 0 1 4-4h10 M15 5l4 4-4 4',
    left: 'M19 20v-7a4 4 0 0 0-4-4H5 M9 5 5 9l4 4',
    up: 'M12 20V4 M6 10l6-6 6 6',
    expand: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
    play: 'M7 4v16l13-8z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
  };
  const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[n] || P.info}"/></svg>`;

  const TONE = { 'Pendiente de contacto': 'gray', 'Franja ofrecida': 'amber', 'Confirmada': 'teal', 'Recordada': 'blue',
    'En camino': 'violet', 'Realizada': 'green', 'Reprogramada': 'orange', 'Cancelada': 'slate', 'Cliente ausente': 'red' };
  const chip = (s) => `<span class="chip chip-${TONE[s] || 'gray'}"><span class="chip-dot" aria-hidden="true"></span>${esc(s)}</span>`;
  const tag = (text, tone = 'gray') => `<span class="tag tag-${tone}">${esc(text)}</span>`;

  const fmt = (d, o) => new Intl.DateTimeFormat('es-PE', Object.assign({ timeZone: 'UTC' }, o)).format(new Date(d + 'T12:00:00Z'));
  const dateLong = (d) => d ? fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Sin fecha';
  const dateShort = (d) => d ? fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '') : 'Sin fecha';
  function dayLabel(d) {
    if (!d) return 'Sin fecha';
    const n = D.diffDays(D.today, d);
    if (n === 0) return 'Hoy · ' + dateShort(d);
    if (n === 1) return 'Mañana · ' + dateShort(d);
    if (n === -1) return 'Ayer · ' + dateShort(d);
    return cap(dateShort(d));
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const stamp = (iso) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(/\./g, '');
  const hm = (m) => H.store.hm(m);
  const initials = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('');

  function attrs(data = {}) { return Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join(''); }
  function btn(label, act, o = {}) {
    return `<button type="${o.type || 'button'}" class="btn ${o.cls || ''}" ${act ? `data-act="${act}"` : ''}${attrs(o.data)} ${o.disabled ? 'disabled' : ''} ${o.attrs || ''}>${o.icon ? icon(o.icon) : ''}<span>${label}</span></button>`;
  }
  function select(name, options, value, o = {}) {
    const opts = options.map((x) => {
      const [v, l] = Array.isArray(x) ? x : [x, x];
      return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('');
    return `<select id="${o.id || name}" class="input" data-change="${name}"${attrs(o.data)} ${o.disabled ? 'disabled' : ''} aria-label="${esc(o.label || name)}">${opts}</select>`;
  }
  function field(label, control, hint) {
    return `<label class="field"><span class="field-label">${label}</span>${control}${hint ? `<span class="field-hint">${hint}</span>` : ''}</label>`;
  }
  const banner = () => `<div class="demo-bar" role="note">${icon('info')}<strong>Datos de ejemplo</strong><span class="demo-sep">·</span><span>Prototipo de demostración sin datos reales<span class="hide-sm">. Los cambios viven solo en esta pestaña.</span></span></div>`;
  const brand = (sub = 'Pluz Energía') => `<div class="brand"><span class="brand-mark">${icon('bolt')}</span><span class="brand-text"><span class="brand-title">Hub de citas</span><span class="brand-sub">${sub}</span></span></div>`;
  const empty = (title, text, ic = 'calendar') => `<div class="empty">${icon(ic)}<p class="empty-title">${title}</p><p>${text}</p></div>`;
  function remainingText(a) {
    const r = H.store.remaining(a);
    if (H.store.isClosed(a) || a.status === 'Cancelada') return '<span class="muted">—</span>';
    const txt = r < 0 ? 'Vencido' : r === 0 ? 'Vence hoy' : r === 1 ? '1 día' : r + ' días';
    const risk = H.store.atRisk(a);
    return `<span class="remaining ${r <= 1 ? 'is-low' : ''}">${txt}</span>${risk ? ' ' + tag('En riesgo', 'red') : ''}`;
  }

  let toastTimer;
  function toast(msg, tone = 'ok') {
    const el = document.getElementById('toast');
    el.className = 'toast show toast-' + tone;
    el.innerHTML = icon(tone === 'error' ? 'alert' : tone === 'info' ? 'info' : 'check') + '<span>' + esc(msg) + '</span>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), tone === 'error' ? 6000 : 4000);
  }

  H.ui = { TONE, esc, icon, chip, tag, dateLong, dateShort, dayLabel, stamp, hm, initials, btn, select, field, banner, brand, empty, remainingText, toast, cap, attrs };
})();
