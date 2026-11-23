/* Hub de citas · Datos de ejemplo (ficticios).
 * Todo vive en memoria: recargar la página reinicia la demostración. Sin localStorage. */
(function () {
  const H = (window.Hub = window.Hub || {});

  /* ---------- Fechas ---------- */
  const limaToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  function addDays(date, n) {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const dow = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
  const diffDays = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  function nextWorkday(date, n) {
    let d = date, c = 0;
    while (c < n) { d = addDays(d, 1); if (dow(d) !== 0) c++; }
    return d;
  }

  /* Lunes a viernes 08:00–18:00, sábado 08:00–14:00, domingo sin visitas. */
  const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00'];
  function slotsFor(date) {
    const w = dow(date);
    if (w === 0) return [];
    if (w === 6) return SLOTS.slice(0, 3);
    return SLOTS.slice();
  }
  function slotWindow(slot) {
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const [a, b] = slot.split('–');
    return [toMin(a), toMin(b)];
  }

  // Día de la demostración: hoy en Lima (si es domingo, el lunes siguiente).
  let today = limaToday;
  if (dow(today) === 0) today = addDays(today, 1);

  const STATUSES = ['Pendiente de contacto', 'Franja ofrecida', 'Confirmada', 'Recordada', 'En camino',
    'Realizada', 'Reprogramada', 'Cancelada', 'Cliente ausente'];
  const ZONES = ['Santa Anita', 'Ate', 'La Molina'];
  const CONTRACTORS = { A: 'Contratista A', B: 'Contratista B' };
  const CREWS = ['1', '2', '3'];
  const CREW_SLOT_CAPACITY = 2; // visitas por cuadrilla y franja

  /* ---------- Red vial real (OpenStreetMap) ----------
   * js/geo-data.js contiene las intersecciones y tramos reales de Santa Anita, Ate y La Molina
   * (generado con tools/build_graph.py). Aquí se decodifica a un grafo dirigido. */
  const GEO = window.HubGeo;
  const B0 = GEO.base;
  const ZONE_NAMES = ['Santa Anita', 'Ate', 'La Molina'];
  const nodes = [];
  for (let i = 0; i < GEO.nodes.length / 2; i++) {
    nodes.push({ lat: B0[0] + GEO.nodes[2 * i] / 1e5, lng: B0[1] + GEO.nodes[2 * i + 1] / 1e5, zone: ZONE_NAMES[GEO.zones[i]] || null });
  }
  const decode = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push([B0[0] + arr[i] / 1e5, B0[1] + arr[i + 1] / 1e5]); return out; };
  /* Tipos de vía (clase OSM) */
  const CLASSES = [
    { label: 'Vía expresa', speed: 50, sens: 1.6 },
    { label: 'Avenida principal', speed: 40, sens: 1.5 },
    { label: 'Avenida secundaria', speed: 33, sens: 1.1 },
    { label: 'Vía local', speed: 28, sens: 0.7 },
    { label: 'Calle residencial', speed: 20, sens: 0.3 }
  ];
  /* Eventos que alteran el tráfico (se activan en la vista de rutas). */
  const INCIDENTS = [
    { id: 'obra', label: 'Obra en Av. Javier Prado Este', factor: 2.6, match: /Javier Prado/ },
    { id: 'feria', label: 'Congestión en Av. Nicolás Ayllón (Carretera Central)', factor: 2.0, match: /Nicolás de Ayllón/ },
    { id: 'accidente', label: 'Accidente en Av. La Molina', factor: 3.0, match: /^Avenida La Molina$/ }
  ];
  const edges = GEO.edges.map((e, i) => {
    const name = GEO.names[e[3]];
    return { a: e[0], b: e[1], cls: e[2], name, m: e[4], oneway: e[5], geom: decode(e[6]),
      v: 0.9 + ((i * 37) % 25) / 100, inc: INCIDENTS.filter((x) => x.match.test(name)).map((x) => x.id) };
  });
  const adj = nodes.map(() => []);
  edges.forEach((e, i) => {
    adj[e.a].push({ to: e.b, e: i, rev: false });
    if (!e.oneway) adj[e.b].push({ to: e.a, e: i, rev: true });
  });
  /* Ubica una coordenada en la intersección más cercana de la red. */
  function snap(lat, lng) {
    let best = 0, bd = Infinity;
    const k = Math.cos(lat * Math.PI / 180);
    for (let i = 0; i < nodes.length; i++) {
      if (!adj[i].length) continue;
      const d = (nodes[i].lat - lat) ** 2 + ((nodes[i].lng - lng) * k) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  const PLACES = {
    baseA: { label: 'Base Contratista A', address: 'Av. Los Ruiseñores', zone: 'Santa Anita', pt: [-12.04690, -76.96845] },
    baseB: { label: 'Base Contratista B', address: 'Av. Los Fresnos', zone: 'La Molina', pt: [-12.08929, -76.94809] },
    sedeAte: { label: 'Sede Pluz Ate', address: 'Av. Nicolás Ayllón', zone: 'Ate', pt: [-12.02385, -76.91351] },
    almacen: { label: 'Almacén Santa Anita', address: 'Av. Nicolás Ayllón', zone: 'Santa Anita', pt: [-12.05824, -76.97304] }
  };
  Object.values(PLACES).forEach((p) => { p.node = snap(p.pt[0], p.pt[1]); });

  /* Direcciones de ejemplo (calles reales, numeración ficticia) para el agendamiento rápido. */
  const ADDRESS_BOOK = {
    'Santa Anita': [['Calle María Parado de Bellido 310', -12.04023, -76.98411], ['Calle Estrada Marthney 77', -12.04919, -76.95159], ['Jr. Huyana 905', -12.03988, -76.96453], ['Av. Ferrocarril 52', -12.03446, -76.96684]],
    'Ate': [['Calle San Luis 640', -12.02354, -76.94147], ['Calle Conquistadores 215', -12.03824, -76.89998], ['Calle Monteverde 98', -12.04736, -76.91702], ['Calle Guadalajara 433', -12.05808, -76.93988]],
    'La Molina': [['Jr. Costa Azul 120', -12.07139, -76.95032], ['Calle Los Rosales 560', -12.09628, -76.93947], ['Calle La Ramada 88', -12.07808, -76.90519], ['Jr. Michigan 301', -12.08782, -76.92819]]
  };
  Object.values(ADDRESS_BOOK).forEach((list) => list.forEach((x) => x.push(snap(x[1], x[2]))));

  /* Escenario ampliado solo para el laboratorio de rutas (12 viviendas ficticias en calles reales). */
  // Franjas repartidas para que la jornada sea factible y el orden no sea obvio.
  const LAB_SLOTS = ['08:00–10:00', '10:00–12:00', '08:00–10:00', '10:00–12:00', '12:00–14:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '14:00–16:00', '16:00–18:00', '16:00–18:00', '14:00–16:00'];
  const LAB = [];
  let li = 0;
  ['Santa Anita', 'Ate', 'La Molina'].forEach((z) => ADDRESS_BOOK[z].forEach((x) => {
    LAB.push(['Vivienda ' + String(li + 1).padStart(2, '0'), x[3], LAB_SLOTS[li], x[0], z]);
    li++;
  }));

  /* ---------- 8 citas de ejemplo ----------
   * [n°, nombre, teléfono, zona, dirección, estado, contratista, cuadrilla,
   *  [lat, lng], días desde la solicitud (negativo = pasado), día de visita (offset), franja,
   *  intentos de contacto, dirección validada, DNI ficticio, token del link único] */
  const SEED = [
    ['1041', 'Carlos Mendoza', '912 345 601', 'Santa Anita', 'Pasaje Húsares de Junín 245', [-12.04313, -76.97499], 'Franja ofrecida', 'A', null, -1, 0, '10:00–12:00', 1, false, '45128731', 'c8Kx2Q'],
    ['1042', 'Lucía Ramírez', '923 456 602', 'Ate', 'Calle Víctor Raúl Haya de la Torre 118', [-12.02990, -76.92504], 'Confirmada', 'A', '1', -1, 0, '12:00–14:00', 1, true, '47019264', 'L4mZp9'],
    ['1043', 'Valeria Torres', '934 567 603', 'La Molina', 'Calle 5 · Urb. Santa Patricia 362', [-12.08017, -76.93453], 'En camino', 'B', '2', -2, 0, '10:00–12:00', 1, true, '40877315', 'V7tR3w'],
    ['1044', 'Diego Salazar', '945 678 604', 'Santa Anita', 'Calle Melos 507', [-12.05209, -76.96263], 'Pendiente de contacto', 'A', null, -2, null, null, 2, true, '43560982', 'D2sQ8n'],
    ['1045', 'Mariana Flores', '956 789 605', 'Ate', 'Av. Marcella 82', [-12.04504, -76.93061], 'Realizada', 'A', '1', -2, 0, '08:00–10:00', 1, true, '46231570', 'M9fP4k'],
    ['1046', 'Gabriel Paredes', '967 890 606', 'La Molina', 'Jr. La Chalana 194', [-12.08586, -76.91517], 'Reprogramada', 'B', '3', -1, 1, '08:00–10:00', 1, true, '41982046', 'G5pW1x'],
    ['1047', 'Camila Rojas', '978 901 607', 'Santa Anita', 'Calle 1 · Coop. Universal 46', [-12.03611, -76.95593], 'Cancelada', 'B', null, -1, 0, '14:00–16:00', 1, true, '48705613', 'C3rJ6v'],
    ['1048', 'Mateo Vega', '989 012 608', 'Ate', 'Calle La Coruña 280', [-12.05939, -76.94268], 'Cliente ausente', 'B', '3', -3, 0, '08:00–10:00', 1, true, '42390857', 'T6vN2m']
  ];

  H.data = {
    today, addDays, dow, diffDays, nextWorkday, slotsFor, slotWindow, SLOTS, STATUSES, ZONES,
    CONTRACTORS, CREWS, CREW_SLOT_CAPACITY, nodes, edges, adj, CLASSES, INCIDENTS, PLACES,
    ADDRESS_BOOK, LAB, SEED, snap, decode, districts: Object.fromEntries(Object.entries(GEO.districts).map(([k, v]) => [k, decode(v)])), source: GEO.source
  };
})();
