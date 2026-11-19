"""Monta GPX e traçados simplificados das trilhas a partir dos dados do OpenStreetMap (© colaboradores do OpenStreetMap, ODbL).
Lê dados/trilhas-osm-brutas.json (resposta do Overpass) e grava gpx/<id>.gpx e dados/trilhas.json.
Uso: python3 -I pesquisa/osm_trilhas.py"""
import json, math, pathlib, datetime
R = pathlib.Path(__file__).resolve().parent.parent
els = [e for e in json.load(open(R / "dados/trilhas-osm-brutas.json")) if e.get("geometry")]
TRILHAS = {
 "lagoinha-pantano": ("Lagoinha do Leste pelo Pântano do Sul", "lagoinha-do-leste", ["Trilha da Lagoinha do Leste"]),
 "lagoinha-matadeiro": ("Armação → Matadeiro → Lagoinha do Leste", "lagoinha-do-leste", ["Trekking Armação até Lagoinha do Leste", "Caminho para Praia do Matadeiro"]),
 "morro-da-coroa": ("Morro da Coroa", "lagoinha-do-leste", ["Morro da Coroa (via sul)", "Trilha do Pico da Coroa"]),
 "naufragados": ("Trilha de Naufragados", "naufragados", ["Trilha de Naufragados"]),
 "pantano-naufragados": ("Pântano do Sul → Naufragados (travessia)", "naufragados", ["Pântano do Sul - Praia Naufragados"]),
 "costa-da-lagoa": ("Canto dos Araçás → Costa da Lagoa", "costa-da-lagoa", ["Caminho da Costa da Lagoa ao Canto dos Araçás"]),
 "barra-galheta": ("Barra da Lagoa → Galheta", "praia-da-galheta", ["Trilha Barra da Lagoa - Praia da Galheta"]),
 "piscinas": ("Trilha das Piscinas Naturais", "piscinas-naturais-barra-da-lagoa", ["Trilha das Piscinas"]),
 "solidao": ("Trilha da Cachoeira da Solidão", "praia-da-solidao", ["Trilha Cachoeira da Solidão"]),
}
def dkm(a, b): return math.hypot((a[0] - b[0]) * math.cos(math.radians(a[1])), a[1] - b[1]) * 111.32
def comprimento(p): return sum(dkm(a, b) for a, b in zip(p, p[1:]))
def encadear(linhas, tol=0.04):
    linhas = [l[:] for l in linhas]; cadeias = []
    while linhas:
        c = linhas.pop(0); mudou = True
        while mudou:
            mudou = False
            for i, l in enumerate(linhas):
                if dkm(c[-1], l[0]) < tol: c.extend(l)
                elif dkm(c[-1], l[-1]) < tol: c.extend(l[::-1])
                elif dkm(c[0], l[-1]) < tol: c[0:0] = l
                elif dkm(c[0], l[0]) < tol: c[0:0] = l[::-1]
                else: continue
                linhas.pop(i); mudou = True; break
        cadeias.append(c)
    return cadeias
def simplificar(p, eps=0.012):
    if len(p) < 3: return p
    a, b = p[0], p[-1]; dm, im = 0, 0
    for i in range(1, len(p) - 1):
        # distância ponto-segmento aproximada em km
        ax, ay = a[0] * math.cos(math.radians(a[1])) * 111.32, a[1] * 111.32; bx, by = b[0] * math.cos(math.radians(a[1])) * 111.32, b[1] * 111.32
        px, py = p[i][0] * math.cos(math.radians(a[1])) * 111.32, p[i][1] * 111.32
        L = math.hypot(bx - ax, by - ay) or 1e-9; t = max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L ** 2))
        d = math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)))
        if d > dm: dm, im = d, i
    return simplificar(p[:im + 1], eps)[:-1] + simplificar(p[im:], eps) if dm > eps else [a, b]
saida = {}
for tid, (nome, lugar, nomes) in TRILHAS.items():
    linhas = [[(g["lon"], g["lat"]) for g in e["geometry"]] for e in els if e["tags"].get("name") in nomes]
    if not linhas: continue
    cadeias = encadear(linhas); km = sum(comprimento(c) for c in cadeias)
    ini = cadeias[0][0]
    gpx = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="floripa-roteiro" xmlns="http://www.topografix.com/GPX/1/1">',
           f'<metadata><name>{nome}</name><desc>Traçado do OpenStreetMap (© colaboradores do OpenStreetMap, ODbL). Pode estar incompleto ou fora de ordem: confira no local.</desc><time>{datetime.date.today().isoformat()}T00:00:00Z</time></metadata>',
           f'<wpt lat="{ini[1]:.6f}" lon="{ini[0]:.6f}"><name>Início provável</name></wpt>', f"<trk><name>{nome}</name>"]
    for c in cadeias: gpx.append("<trkseg>" + "".join(f'<trkpt lat="{p[1]:.6f}" lon="{p[0]:.6f}"/>' for p in c) + "</trkseg>")
    gpx += ["</trk>", "</gpx>"]
    (R / f"gpx/{tid}.gpx").write_text("\n".join(gpx))
    saida[tid] = {"nome": nome, "lugar": lugar, "km": round(km, 1), "trechos": len(cadeias), "inicio": [round(ini[1], 6), round(ini[0], 6)],
                  "gpx": f"gpx/{tid}.gpx", "linhas": [[[round(x, 5), round(y, 5)] for x, y in simplificar(c)] for c in cadeias],
                  "fonte": "OpenStreetMap (ODbL)"}
    print(f"{tid:22} {km:5.1f} km  {len(cadeias)} trecho(s)  {sum(len(l) for l in saida[tid]['linhas'])} pontos")
json.dump(saida, open(R / "dados/trilhas.json", "w"), ensure_ascii=False)
