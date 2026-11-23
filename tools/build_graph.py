"""Construye js/geo-data.js a partir de datos de OpenStreetMap (Overpass).

Uso:
  python3 tools/build_graph.py roads.json districts.json js/geo-data.js

roads.json: vías (trunk, primary, secondary, tertiary y calles residenciales con nombre)
            del recuadro -12.100,-76.995,-12.018,-76.900 (Santa Anita, Ate y La Molina).
districts.json: límites administrativos (admin_level=8) de Santa Anita, Ate y La Molina.

El grafo resultante es dirigido (respeta los sentidos únicos), usa solo las intersecciones
como vértices, conserva la geometría simplificada de cada tramo y se queda con la mayor
componente fuertemente conexa. Datos © colaboradores de OpenStreetMap (ODbL).
"""
import json, math, sys
from collections import defaultdict

roads_path, districts_path, out_path = sys.argv[1:4]
R = json.load(open(roads_path))
DIS = json.load(open(districts_path))

CLS = {'trunk': 0, 'trunk_link': 0, 'primary': 1, 'primary_link': 1, 'secondary': 2, 'secondary_link': 2,
       'tertiary': 3, 'tertiary_link': 3, 'residential': 4, 'unclassified': 4, 'living_street': 4}

pos = {e['id']: (e['lat'], e['lon']) for e in R['elements'] if e['type'] == 'node'}
ways = [e for e in R['elements'] if e['type'] == 'way' and e['tags'].get('highway') in CLS]

def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))

def simplify(pts, tol):
    if len(pts) < 3: return pts
    lat0 = math.radians(pts[0][0]); kx = 111320 * math.cos(lat0); ky = 110540
    P = [((p[1] - pts[0][1]) * kx, (p[0] - pts[0][0]) * ky) for p in pts]
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay = P[i]; bx, by = P[j]; dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1e-9
        best, bi = 0, -1
        for k in range(i + 1, j):
            d = abs(dy * (P[k][0] - ax) - dx * (P[k][1] - ay)) / L
            if d > best: best, bi = d, k
        if best > tol:
            keep[bi] = True; stack += [(i, bi), (bi, j)]
    return [p for p, k in zip(pts, keep) if k]

# Vértices: extremos de vías o nodos compartidos por 2+ vías.
use = defaultdict(int)
for w in ways:
    for nd in set(w['nodes']): use[nd] += 1
    use[w['nodes'][0]] += 2; use[w['nodes'][-1]] += 2

names, name_idx = [], {}
def nid(n):
    if n not in name_idx: name_idx[n] = len(names); names.append(n)
    return name_idx[n]

raw_edges = []  # (u, v, cls, name, length, oneway, geom)
for w in ways:
    t = w['tags']; cls = CLS[t['highway']]
    ow = t.get('oneway')
    nds = [n for n in w['nodes'] if n in pos]
    if ow == '-1': nds = nds[::-1]
    oneway = 1 if ow in ('yes', '-1', 'true', '1') or t.get('junction') == 'roundabout' else 0
    name = t.get('name') or ''
    start = 0
    for k in range(1, len(nds)):
        if use[nds[k]] >= 2 or k == len(nds) - 1:
            seg = nds[start:k + 1]
            pts = [pos[n] for n in seg]
            L = sum(hav(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
            if L > 0.5:
                raw_edges.append((seg[0], seg[-1], cls, name, L, oneway, simplify(pts, 3.5)[1:-1]))
            start = k

# Mayor componente fuertemente conexa (Kosaraju iterativo).
out_adj, in_adj = defaultdict(list), defaultdict(list)
for e in raw_edges:
    u, v, ow = e[0], e[1], e[5]
    out_adj[u].append(v); in_adj[v].append(u)
    if not ow: out_adj[v].append(u); in_adj[u].append(v)
verts = set(out_adj) | set(in_adj)
order, seen = [], set()
for s in verts:
    if s in seen: continue
    seen.add(s); stack = [(s, iter(out_adj[s]))]
    while stack:
        node, it = stack[-1]
        nxt = next(it, None)
        if nxt is None: stack.pop(); order.append(node)
        elif nxt not in seen: seen.add(nxt); stack.append((nxt, iter(out_adj[nxt])))
comp, best = {}, None
for s in reversed(order):
    if s in comp: continue
    members = [s]; comp[s] = s; st = [s]
    while st:
        x = st.pop()
        for y in in_adj[x]:
            if y not in comp: comp[y] = s; members.append(y); st.append(y)
    if best is None or len(members) > len(best): best = members
keep = set(best)

# Límites de distritos
def rings(rel):
    segs = [[(p['lat'], p['lon']) for p in m['geometry']] for m in rel['members'] if m['type'] == 'way' and m.get('role') in ('outer', '') and 'geometry' in m]
    out = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]: ring += s[1:]
                elif s[-1] == ring[-1]: ring += s[::-1][1:]
                elif s[-1] == ring[0]: ring = s[:-1] + ring
                elif s[0] == ring[0]: ring = s[::-1][:-1] + ring
                else: continue
                segs.pop(i); changed = True; break
        out.append(ring)
    return max(out, key=len)
ZONES = ['Santa Anita', 'Ate', 'La Molina']
districts = {}
for r in DIS['elements']:
    nm = r['tags']['name']
    if nm in ZONES:
        ring = rings(r); h = len(ring) // 2
        districts[nm] = simplify(ring[:h + 1], 15)[:-1] + simplify(ring[h:], 15)
def inside(p, poly):
    x, y, c = p[1], p[0], False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a[0] > y) != (b[0] > y) and x < (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]) + a[1]: c = not c
    return c

idmap, nodes, zones = {}, [], []
def vid(n):
    if n not in idmap:
        idmap[n] = len(nodes); p = pos[n]; nodes.append(p)
        z = -1
        for k, zn in enumerate(ZONES):
            if zn in districts and inside(p, districts[zn]): z = k; break
        zones.append(z)
    return idmap[n]

LAT0, LNG0 = -12.06, -76.95
enc = lambda p: [round((p[0] - LAT0) * 1e5), round((p[1] - LNG0) * 1e5)]
edges = []
for u, v, cls, name, L, ow, geom in raw_edges:
    if u in keep and v in keep:
        g = []
        for p in geom: g += enc(p)
        edges.append([vid(u), vid(v), cls, nid(name), round(L), ow, g])

data = {
    'source': 'Datos de calles © colaboradores de OpenStreetMap (ODbL)',
    'base': [LAT0, LNG0],
    'nodes': [c for p in nodes for c in enc(p)],
    'zones': zones,
    'names': names,
    'edges': edges,
    'districts': {k: [c for p in v for c in enc(p)] for k, v in districts.items()}
}
with open(out_path, 'w') as f:
    f.write('/* Red vial real (simplificada) de Santa Anita, Ate y La Molina.\n * Generado con tools/build_graph.py. Datos © colaboradores de OpenStreetMap (ODbL). */\n')
    f.write('window.HubGeo=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('nodos', len(nodes), 'tramos', len(edges), 'nombres', len(names), 'zonas', {z: zones.count(i) for i, z in enumerate(ZONES)})
