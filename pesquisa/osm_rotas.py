"""Calcula rotas a pé sobre a rede de caminhos do OpenStreetMap para trilhas que não têm traçado nomeado.
Pega os caminhos (path, footway, track, steps) entre o início e o fim, acha o menor caminho (Dijkstra, ruas pesam mais)
e grava gpx/<id>.gpx e o registro em dados/trilhas.json com estimada=true.
© colaboradores do OpenStreetMap (ODbL). É uma estimativa: não é um traçado gravado por alguém.
Uso: python3 -I pesquisa/osm_rotas.py"""
import heapq, json, math, pathlib, time, urllib.parse, urllib.request, datetime
R = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "floripa-roteiro/1.0 (viagem em grupo; sem fins comerciais)"}
URLS = ["https://z.overpass-api.de/api/interpreter", "https://overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
ROTAS = {
 "gravata": ("Trilha do Gravatá (SC-406 → Praia do Gravatá)", "trilha-do-gravata", (-27.60753, -48.44106), (-27.61337, -48.43384)),
 "morro-das-aranhas": ("Trilha do Morro das Aranhas (Santinho)", "morro-das-aranhas", (-27.46837, -48.37606), (-27.47149, -48.37993)),
 "pedra-do-urubu": ("Pedra do Urubu (Guarda do Embaú)", "guarda-do-embau", (-27.90333, -48.58977), (-27.90135, -48.58705)),
 "mole-galheta": ("Praia Mole → Praia da Galheta", "praia-da-galheta", (-27.60317, -48.43501), (-27.59251, -48.42518)),
}
LEVES = {"path", "footway", "track", "steps", "pedestrian", "bridleway", "cycleway"}
def dkm(a, b): return math.hypot((a[1] - b[1]) * math.cos(math.radians(a[0])), a[0] - b[0]) * 111.32
def overpass(q):
    for tent in range(18):
        url = URLS[tent % len(URLS)]
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers=UA), timeout=90) as r: return json.load(r)
        except Exception as e: print("  tentativa", tent + 1, url.split("/")[2], str(e)[:50], flush=True); time.sleep(10)
    raise SystemExit("Overpass indisponível")
saida = json.load(open(R / "dados/trilhas.json"))
for tid, (nome, lugar, a, b) in ROTAS.items():
    pad = 0.012
    s, w, n, e = min(a[0], b[0]) - pad, min(a[1], b[1]) - pad, max(a[0], b[0]) + pad, max(a[1], b[1]) + pad
    d = overpass(f'[out:json][timeout:90];way["highway"~"path|footway|track|steps|pedestrian|service|residential|unclassified|tertiary|living_street|bridleway"]({s},{w},{n},{e});out body geom;')
    pos, g = {}, {}
    for el in d["elements"]:
        if not el.get("geometry") or not el.get("nodes"): continue
        leve = el["tags"].get("highway") in LEVES; mult = 1.0 if leve else 2.5
        for (n1, p1), (n2, p2) in zip(zip(el["nodes"], el["geometry"]), zip(el["nodes"][1:], el["geometry"][1:])):
            pa, pb = (p1["lat"], p1["lon"]), (p2["lat"], p2["lon"]); pos[n1], pos[n2] = pa, pb
            c = dkm(pa, pb) * mult; g.setdefault(n1, []).append((n2, c)); g.setdefault(n2, []).append((n1, c))
    def perto(p):
        m = min(pos, key=lambda k: dkm(pos[k], p)); return m, dkm(pos[m], p)
    ni, di = perto(a); nf, df = perto(b)
    print(f"{tid}: {len(el_ := d['elements'])} vias, {len(pos)} nós; início a {di*1000:.0f} m, fim a {df*1000:.0f} m da rede")
    if di > 0.25 or df > 0.25: print("  longe demais da rede; pulado"); continue
    dist, prev, fila = {ni: 0}, {}, [(0, ni)]
    while fila:
        c, u = heapq.heappop(fila)
        if u == nf: break
        if c > dist.get(u, 1e9): continue
        for v, w_ in g.get(u, []):
            if c + w_ < dist.get(v, 1e9): dist[v] = c + w_; prev[v] = u; heapq.heappush(fila, (c + w_, v))
    if nf not in dist: print("  sem caminho"); continue
    cam, u = [nf], nf
    while u != ni: u = prev[u]; cam.append(u)
    cam.reverse(); pts = [(pos[k][1], pos[k][0]) for k in cam]
    km = sum(dkm((p[1], p[0]), (q[1], q[0])) for p, q in zip(pts, pts[1:]))
    print(f"  rota de {km:.2f} km com {len(pts)} pontos")
    gpx = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="floripa-roteiro" xmlns="http://www.topografix.com/GPX/1/1">',
           f'<metadata><name>{nome}</name><desc>Rota calculada sobre caminhos do OpenStreetMap (© colaboradores do OpenStreetMap, ODbL). É uma estimativa: confira no local.</desc><time>{datetime.date.today().isoformat()}T00:00:00Z</time></metadata>',
           f'<wpt lat="{a[0]:.6f}" lon="{a[1]:.6f}"><name>Início</name></wpt>', f'<wpt lat="{b[0]:.6f}" lon="{b[1]:.6f}"><name>Chegada</name></wpt>', f"<trk><name>{nome}</name><trkseg>"]
    gpx += [f'<trkpt lat="{p[1]:.6f}" lon="{p[0]:.6f}"/>' for p in pts] + ["</trkseg></trk>", "</gpx>"]
    (R / f"gpx/{tid}.gpx").write_text("\n".join(gpx))
    saida[tid] = {"nome": nome, "lugar": lugar, "km": round(km, 1), "trechos": 1, "inicio": [a[0], a[1]], "gpx": f"gpx/{tid}.gpx", "estimada": True,
                  "linhas": [[[round(x, 5), round(y, 5)] for x, y in pts]], "fonte": "Rota sobre caminhos do OpenStreetMap (ODbL)"}
json.dump(saida, open(R / "dados/trilhas.json", "w"), ensure_ascii=False)
