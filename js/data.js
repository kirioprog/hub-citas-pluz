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
    ['1048', 'Mateo Vega', '989 012 608', 'Ate', 'Calle La Coruña 280', [-12.05939, -76.94268], 'Cliente ausente', 'B', '3', -3, 0, '08:00–10:00', 1, true, '42390857', 'T6vN2m'],
    /* Citas adicionales para ver las rutas de las 3 cuadrillas de cada contratista */
    ['1049', 'Rosa Huamán', '921 334 509', 'Santa Anita', 'Av. Ferrocarril 410', [-12.04046, -76.97768], 'Confirmada', 'A', '1', -1, 0, '10:00–12:00', 1, true, '47120385', 'R4hT8q'],
    ['1050', 'Jorge Quispe', '932 445 610', 'Ate', 'Calle Los Cipreses 233', [-12.02674, -76.93157], 'Recordada', 'A', '1', -2, 0, '14:00–16:00', 1, true, '43219876', 'J7qP2x'],
    ['1051', 'Patricia Ccori', '943 556 711', 'Santa Anita', 'Pasaje La Portaleza 18', [-12.03717, -76.97039], 'Confirmada', 'A', '1', -1, 0, '16:00–18:00', 1, true, '45987123', 'P2cC9k'],
    ['1052', 'Luis Chávez', '954 667 812', 'Santa Anita', 'Av. Los Cipreses 512', [-12.04995, -76.97773], 'Realizada', 'A', '2', -2, 0, '08:00–10:00', 1, true, '40123987', 'L8vZ3m'],
    ['1053', 'Milagros Rojas', '965 778 913', 'Santa Anita', 'Av. Roger Vidal 145', [-12.05597, -76.96806], 'En camino', 'A', '2', -1, 0, '10:00–12:00', 1, true, '46785231', 'M3rJ7w'],
    ['1054', 'Óscar Mamani', '976 889 014', 'Ate', 'Calle Berlín 87', [-12.03598, -76.92008], 'Confirmada', 'A', '2', -1, 0, '12:00–14:00', 1, true, '42876510', 'O6mN4p'],
    ['1055', 'Karina Paz', '987 990 115', 'Santa Anita', 'Av. Santa Ana 760', [-12.03903, -76.94764], 'Recordada', 'A', '2', -2, 0, '14:00–16:00', 1, true, '48230176', 'K9pZ5t'],
    ['1056', 'Héctor Salas', '918 101 216', 'Ate', 'Calle Marte 301', [-12.03098, -76.94248], 'Realizada', 'A', '3', -2, 0, '08:00–10:00', 1, true, '41567289', 'H2sL6y'],
    ['1057', 'Daniela Vargas', '929 212 317', 'Ate', 'Av. San Juan 1120', [-12.02471, -76.92473], 'Confirmada', 'A', '3', -1, 0, '10:00–12:00', 1, true, '47651230', 'D5vG8r'],
    ['1058', 'Ricardo Llanos', '939 323 418', 'Santa Anita', 'Av. Huarochirí 455', [-12.03001, -76.95784], 'Reprogramada', 'A', '3', -2, 0, '12:00–14:00', 1, true, '44098712', 'R1lK3s'],
    ['1059', 'Silvia Tello', '949 434 519', 'Ate', 'Calle El Campesino 66', [-12.04581, -76.92783], 'Confirmada', 'A', '3', -1, 0, '16:00–18:00', 1, true, '45612309', 'S8tW2n'],
    ['1060', 'Fernando Ríos', '959 545 620', 'La Molina', 'Jr. Brasilia 220', [-12.06918, -76.94032], 'Realizada', 'B', '1', -2, 0, '08:00–10:00', 1, true, '40987654', 'F4rQ7d'],
    ['1061', 'Gloria Soto', '969 656 721', 'La Molina', 'Calle Monte Azul 145', [-12.07674, -76.92670], 'Confirmada', 'B', '1', -1, 0, '10:00–12:00', 1, true, '46543210', 'G7sB1h'],
    ['1062', 'Manuel Ortiz', '979 767 822', 'La Molina', 'Jr. 14 de Setiembre 390', [-12.08681, -76.94166], 'Recordada', 'B', '1', -1, 0, '12:00–14:00', 1, true, '43345678', 'M6oX9c'],
    ['1063', 'Elena Cárdenas', '989 878 923', 'La Molina', 'Calle Pontevedra 175', [-12.08988, -76.93515], 'Confirmada', 'B', '1', -2, 0, '14:00–16:00', 1, true, '47890123', 'E3cF5j'],
    ['1064', 'Raúl Guerrero', '917 989 024', 'La Molina', 'Calle Victoria 58', [-12.09469, -76.92505], 'Realizada', 'B', '2', -2, 0, '08:00–10:00', 1, true, '42210987', 'R9gU4v'],
    ['1065', 'Teresa Núñez', '927 090 125', 'Ate', 'Calle Monte Pissis 240', [-12.06174, -76.93408], 'Confirmada', 'B', '2', -1, 0, '12:00–14:00', 1, true, '45678901', 'T2nY6b'],
    ['1066', 'Iván Cruz', '937 101 226', 'La Molina', 'Calle Rapallo 133', [-12.08605, -76.90507], 'Confirmada', 'B', '2', -1, 0, '14:00–16:00', 1, true, '41234567', 'I5cH3q'],
    ['1067', 'Nora Medina', '947 212 327', 'La Molina', 'Av. José León Barandiarán 615', [-12.07370, -76.91341], 'Confirmada', 'B', '3', -1, 0, '10:00–12:00', 1, true, '48765432', 'N8mD2z'],
    ['1068', 'Alberto Pinto', '957 323 428', 'La Molina', 'Calle Las Cataratas 92', [-12.09757, -76.94491], 'Recordada', 'B', '3', -2, 0, '12:00–14:00', 1, true, '40345678', 'A1pR7e'],
    ['1069', 'Lourdes Vega', '967 434 529', 'Ate', 'Calle Vulcano 310', [-12.06140, -76.95504], 'Confirmada', 'B', '3', -1, 0, '14:00–16:00', 1, true, '46109876', 'L4vS8u'],
    ['1070', 'Pedro Zamora', '977 545 630', 'La Molina', 'Calle Los Olivos 404', [-12.07981, -76.95500], 'Confirmada', 'B', '3', 0, 1, '10:00–12:00', 1, true, '43987650', 'P7zA1g'],
    ['1071', 'Carmen Ruiz', '987 656 731', 'La Molina', 'Jr. Michigan 118', [-12.08782, -76.92819], 'Confirmada', 'B', '3', -1, 1, '12:00–14:00', 1, true, '47012398', 'C6rM4f'],
    ['1072', 'Julio Paredes', '916 767 832', 'Santa Anita', 'Calle Ezequiel Otoya 77', [-12.04182, -76.98507], 'Confirmada', 'A', '1', -1, 1, '08:00–10:00', 1, true, '42567801', 'J3pT9a'],
    ['1073', 'Ana Torres', '926 878 933', 'Ate', 'Av. Esperanza 250', [-12.04149, -76.90535], 'Confirmada', 'A', '1', 0, 1, '10:00–12:00', 1, true, '45321098', 'A8tE5k'],
    ['1074', 'Víctor Huerta', '936 989 034', 'Ate', 'Av. San Juan Bautista 980', [-12.04708, -76.89706], 'Franja ofrecida', 'A', null, 0, 1, '14:00–16:00', 1, true, '44876012', 'V2hU6c']
  ];

  H.data = {
    today, addDays, dow, diffDays, nextWorkday, slotsFor, slotWindow, SLOTS, STATUSES, ZONES,
    CONTRACTORS, CREWS, CREW_SLOT_CAPACITY, nodes, edges, adj, CLASSES, INCIDENTS, PLACES,
    ADDRESS_BOOK, LAB, SEED, snap, decode, districts: Object.fromEntries(Object.entries(GEO.districts).map(([k, v]) => [k, decode(v)])), source: GEO.source
  };
})();
