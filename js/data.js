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

  /* ---------- Grafo vial esquemático ----------
   * Intersecciones (nodos) y tramos (aristas) de una red ficticia que cubre
   * Santa Anita (oeste), Ate (noreste) y La Molina (sureste). */
  const COLS = [70, 210, 350, 490, 630, 770, 910];
  const ROWS = [70, 190, 310, 430, 550];
  const JIT = [[0, 0], [7, -9], [-6, 7], [9, 4], [-7, -6], [5, 10], [-9, 3]];
  const KM_PER_PX = 0.011;

  const nodes = [];
  const idx = {};
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < COLS.length; c++) {
      const id = 'n' + r + c;
      const zone = c <= 2 ? 'Santa Anita' : r <= 2 ? 'Ate' : 'La Molina';
      idx[id] = nodes.length;
      nodes.push({ id, r, c, zone, x: COLS[c] + JIT[(r + c) % 7][0], y: ROWS[r] + JIT[(r * 3 + c) % 7][1] });
    }
  }

  const H_ROADS = [
    ['Carretera Central', 'avenida'],
    ['Av. Nicolás Ayllón', 'principal'],
    ['Av. Javier Prado Este', 'avenida'],
    ['Av. La Fontana', 'principal'],
    ['Av. Raúl Ferrero', 'principal']
  ];
  const H_ROADS_WEST = { 3: ['Calle Los Geranios', 'calle'], 4: ['Calle Las Dalias', 'calle'] };
  const V_ROADS = [
    ['Av. Huarochirí', 'principal'],
    ['Calle Los Ruiseñores', 'calle'],
    ['Vía de Evitamiento', 'avenida'],
    ['Calle Las Begonias', 'calle'],
    ['Av. La Molina', 'avenida'],
    ['Calle Los Fresnos', 'calle'],
    ['Av. Los Constructores', 'principal']
  ];
  const SKIP = new Set(['n05|n15', 'n41|n42', 'n32|n42']);

  const edges = [];
  const adj = nodes.map(() => []);
  function addEdge(a, b, name, type) {
    if (SKIP.has(a + '|' + b)) return;
    const A = nodes[idx[a]], B = nodes[idx[b]];
    const px = Math.hypot(A.x - B.x, A.y - B.y);
    const i = edges.length;
    // Variabilidad fija por tramo (semáforos, paraderos, pistas angostas).
    const v = 0.92 + ((i * 37) % 23) / 100;
    edges.push({ id: a + '-' + b, a: idx[a], b: idx[b], name, type, km: +(px * KM_PER_PX).toFixed(2), v });
    adj[idx[a]].push({ to: idx[b], e: i });
    adj[idx[b]].push({ to: idx[a], e: i });
  }
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < COLS.length - 1; c++) {
      const road = c < 2 && H_ROADS_WEST[r] ? H_ROADS_WEST[r] : H_ROADS[r];
      addEdge('n' + r + c, 'n' + r + (c + 1), road[0], road[1]);
    }
  }
  for (let c = 0; c < COLS.length; c++) {
    for (let r = 0; r < ROWS.length - 1; r++) addEdge('n' + r + c, 'n' + (r + 1) + c, V_ROADS[c][0], V_ROADS[c][1]);
  }
  [['n11', 'n22'], ['n22', 'n33'], ['n33', 'n44']].forEach(([a, b]) => addEdge(a, b, 'Av. Separadora Industrial', 'avenida'));

  const SPEED = { avenida: 42, principal: 30, calle: 20 }; // km/h a flujo libre

  /* Eventos que alteran el tráfico (se activan en la vista de rutas). */
  const INCIDENTS = [
    { id: 'obra', label: 'Obra en Av. Javier Prado Este (tramo Ate)', factor: 2.6,
      edges: ['n23-n24', 'n24-n25', 'n25-n26'] },
    { id: 'feria', label: 'Feria en Carretera Central', factor: 1.9,
      edges: ['n01-n02', 'n02-n03', 'n03-n04'] }
  ];

  const PLACES = {
    baseA: { label: 'Base Contratista A', node: 'n11', zone: 'Santa Anita' },
    baseB: { label: 'Base Contratista B', node: 'n44', zone: 'La Molina' },
    sedeAte: { label: 'Sede Pluz Ate', node: 'n04', zone: 'Ate' },
    almacen: { label: 'Almacén Santa Anita', node: 'n40', zone: 'Santa Anita' }
  };

  /* Direcciones de ejemplo para el agendamiento rápido. */
  const ADDRESS_BOOK = {
    'Santa Anita': [['Jr. Los Jazmines 310', 'n10'], ['Calle Las Gardenias 77', 'n20'], ['Av. Cascanueces 905', 'n31'], ['Jr. Los Tulipanes 52', 'n42']],
    'Ate': [['Av. Los Laureles 640', 'n05'], ['Jr. Las Retamas 215', 'n14'], ['Calle Los Robles 98', 'n26'], ['Av. Las Acacias 433', 'n16']],
    'La Molina': [['Calle Los Cipreses 120', 'n34'], ['Av. Los Álamos 560', 'n43'], ['Jr. Las Hiedras 88', 'n45'], ['Calle Las Lilas 301', 'n36']]
  };

  /* Escenario ampliado solo para el laboratorio de rutas (12 viviendas ficticias). */
  const LAB = [
    ['Vivienda 01', 'n10', '08:00–10:00'], ['Vivienda 02', 'n31', '08:00–10:00'], ['Vivienda 03', 'n22', '10:00–12:00'],
    ['Vivienda 04', 'n14', '08:00–10:00'], ['Vivienda 05', 'n26', '10:00–12:00'], ['Vivienda 06', 'n05', '12:00–14:00'],
    ['Vivienda 07', 'n34', '12:00–14:00'], ['Vivienda 08', 'n43', '14:00–16:00'], ['Vivienda 09', 'n45', '10:00–12:00'],
    ['Vivienda 10', 'n20', '14:00–16:00'], ['Vivienda 11', 'n36', '16:00–18:00'], ['Vivienda 12', 'n42', '16:00–18:00']
  ];

  /* ---------- 8 citas de ejemplo ----------
   * [n°, nombre, teléfono, zona, dirección, nodo, estado, contratista, cuadrilla,
   *  días desde la solicitud (negativo = pasado), día de visita (offset), franja,
   *  intentos de contacto, dirección validada, DNI ficticio, token del link único] */
  const SEED = [
    ['1041', 'Carlos Mendoza', '912 345 601', 'Santa Anita', 'Av. Los Eucaliptos 245', 'n21', 'Franja ofrecida', 'A', null, -1, 0, '10:00–12:00', 1, false, '45128731', 'c8Kx2Q'],
    ['1042', 'Lucía Ramírez', '923 456 602', 'Ate', 'Jr. Las Orquídeas 118', 'n15', 'Confirmada', 'A', '1', -1, 0, '12:00–14:00', 1, true, '47019264', 'L4mZp9'],
    ['1043', 'Valeria Torres', '934 567 603', 'La Molina', 'Calle Los Olivos 362', 'n35', 'En camino', 'B', '2', -2, 0, '10:00–12:00', 1, true, '40877315', 'V7tR3w'],
    ['1044', 'Diego Salazar', '945 678 604', 'Santa Anita', 'Av. Los Nogales 507', 'n30', 'Pendiente de contacto', 'A', null, -2, null, null, 2, true, '43560982', 'D2sQ8n'],
    ['1045', 'Mariana Flores', '956 789 605', 'Ate', 'Calle Las Palmeras 82', 'n13', 'Realizada', 'A', '1', -2, 0, '08:00–10:00', 1, true, '46231570', 'M9fP4k'],
    ['1046', 'Gabriel Paredes', '967 890 606', 'La Molina', 'Jr. Los Cedros 194', 'n46', 'Reprogramada', 'B', '3', -1, 1, '08:00–10:00', 1, true, '41982046', 'G5pW1x'],
    ['1047', 'Camila Rojas', '978 901 607', 'Santa Anita', 'Calle Los Sauces 46', 'n02', 'Cancelada', 'B', null, -1, 0, '14:00–16:00', 1, true, '48705613', 'C3rJ6v'],
    ['1048', 'Mateo Vega', '989 012 608', 'Ate', 'Av. Las Magnolias 280', 'n24', 'Cliente ausente', 'B', '3', -3, 0, '08:00–10:00', 1, true, '42390857', 'T6vN2m']
  ];

  H.data = {
    today, addDays, dow, diffDays, nextWorkday, slotsFor, slotWindow, SLOTS, STATUSES, ZONES,
    CONTRACTORS, CREWS, CREW_SLOT_CAPACITY, nodes, idx, edges, adj, SPEED, INCIDENTS, PLACES,
    ADDRESS_BOOK, LAB, SEED
  };
})();
