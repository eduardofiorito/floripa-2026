"""Busca ampla no Google Places (API oficial): até 20 resultados por consulta, com restrição de área.
Uso: python3 -I pesquisa/buscar_area.py consultas.json saida.json
consultas.json: {"grupo": [["texto", lat, lng, raio_m], ...]}"""
import importlib.util, json, pathlib, sys, time, urllib.request
AQUI = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gp", AQUI / "google_places.py"); gp = importlib.util.module_from_spec(spec); spec.loader.exec_module(gp)
def buscar(texto, lat, lng, raio):
    corpo = {"textQuery": texto, "languageCode": "pt-BR", "regionCode": "BR", "pageSize": 20,
             "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(raio)}}}
    req = urllib.request.Request("https://places.googleapis.com/v1/places:searchText", data=json.dumps(corpo).encode(),
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": gp.chave(), "X-Goog-FieldMask": gp.CAMPOS}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r: return [gp.resumo(p) for p in json.load(r).get("places", [])]
C = json.loads(pathlib.Path(sys.argv[1]).read_text()); out = {}
saida = pathlib.Path(sys.argv[2])
if saida.exists(): out = json.loads(saida.read_text())
for g, lista in C.items():
    for q in lista:
        out.setdefault(g, {})[q[0]] = buscar(*q); time.sleep(0.3)
saida.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print("ok", sum(len(v) for g in out.values() for v in g.values()))
