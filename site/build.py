"""Monta a página a partir de pesquisa/lugares/*.json, roteiro/dias.json e roteiro/pendencias.json.

  python3 -I site/build.py

Saídas:
  index.html            versão do repo: imagens por caminho relativo (img/), sem dados do Google
  dist/artifact.html    mesma página com as notas do Google (para publicar no claude.ai, com img/)
  dist/preview.html     tudo embutido (imagens em data URI) para abrir direto do disco
"""
import base64, glob, hashlib, json, pathlib, urllib.parse

R = pathlib.Path(__file__).resolve().parent.parent
CAMPOS = ["id", "nome", "categoria", "regiao", "cidade", "estrada", "resumo", "destaques", "coords", "endereco", "links", "da_lagoa", "estacionamento",
          "horarios", "precos", "melhor_horario", "duracao", "trilha", "o_que_levar", "cuidados", "clima", "publico",
          "combina_com", "dicas", "fontes", "pendencias", "confianca", "verificado_em", "lista"]

import subprocess
fotos = json.loads((R / "img/mapa.json").read_text()) if (R / "img/mapa.json").exists() else {}
(R / "img/t").mkdir(exist_ok=True)
for lista in fotos.values():
    for f in lista:
        orig, mini = R / f["arq"], R / "img/t" / pathlib.Path(f["arq"]).name
        if orig.exists() and not mini.exists():
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(orig), "-vf", "scale='min(420,iw)':-2", "-q:v", "6", str(mini)], check=False)
        if mini.exists(): f["t"] = "img/t/" + mini.name
lugares = []
for f in sorted(glob.glob(str(R / "pesquisa/lugares/*.json"))):
    d = json.load(open(f))
    l = {k: d.get(k) for k in CAMPOS}
    recentes = []
    mf = R / "pesquisa/midia" / f"{d['id']}.json"
    if mf.exists():
        for x in json.load(open(mf)).get("fotos_commons_recentes") or []:
            if x.get("arq") and (R / x["arq"]).exists():
                mini = R / "img/t" / ("r-" + pathlib.Path(x["arq"]).name)
                if not mini.exists():
                    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(R / x["arq"]), "-vf", "scale='min(420,iw)':-2", "-q:v", "6", str(mini)], check=False)
                recentes.append({"arq": x["arq"], "t": "img/t/" + mini.name if mini.exists() else x["arq"], "autor": x.get("autor"), "licenca": x.get("licenca"), "pagina": x.get("pagina"), "data": x.get("data"), "mostra": x.get("mostra")})
    recentes.sort(key=lambda x: x.get("data") or "", reverse=True)
    l["fotos"] = recentes + [x for x in fotos.get(d["id"], []) if (R / x["arq"]).exists()]
    lugares.append(l)

google = {}
gj = R / "pesquisa/google.json"
if gj.exists():
    for k, v in json.load(open(gj)).items():
        e = v.get("escolhido")
        if e and e.get("nota") is not None:
            google[k] = {"nota": e["nota"], "avaliacoes": e.get("avaliacoes"), "em": v.get("em")}
ilha_geo = json.load(open(R / "dados/ilha-nominatim.json"))
anel = ilha_geo["coordinates"][0] if ilha_geo["type"] == "Polygon" else max((p[0] for p in ilha_geo["coordinates"]), key=len)
trilhas = [{"id": k, **v} for k, v in json.load(open(R / "dados/trilhas.json")).items()]
links_trilhas = json.load(open(R / "pesquisa/links_trilhas.json"))
loc_google = {}
if gj.exists():
    for k, v in json.load(open(gj)).items():
        L = v.get("loc")
        if L and L.get("classe") in ("A", "B", "C"): loc_google[k] = L
midia = {}
for f in sorted(glob.glob(str(R / "pesquisa/midia/*.json"))):
    try:
        m = json.load(open(f)); midia[m["id"]] = {k: m.get(k) for k in ("videos", "instagram", "pontos_de_vista", "vibe")}
    except Exception: pass
base = {"guia": json.load(open(R / "roteiro/guia.json")), "decidir": json.load(open(R / "roteiro/decidir.json")), "midia": midia, "ilha": [[round(x, 4), round(y, 4)] for x, y in anel], "trilhas": trilhas, "links": links_trilhas,"lugares": lugares, "dias": json.load(open(R / "roteiro/dias.json"))["dias"],
        "meta": json.load(open(R / "roteiro/dias.json"))["meta"], "clima": json.load(open(R / "pesquisa/clima_atual.json")) if (R / "pesquisa/clima_atual.json").exists() else None, "pendencias": json.load(open(R / "roteiro/pendencias.json"))}
modelo = (R / "site/modelo.html").read_text().replace("/*__FONTES__*/", (R / "site/fontes/embutidas.css").read_text())

ICONE = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23F08A00'/%3E"
         "%3Cpath d='M8 40c6 0 6-8 12-8s6 8 12 8 6-8 12-8 6 8 12 8' fill='none' stroke='%230F1A1F' stroke-width='6' stroke-linecap='round'/%3E%3Ccircle cx='44' cy='18' r='7' fill='%230F1A1F'/%3E%3C/svg%3E")
DESCRICAO = "Roteiro do grupo em Florianópolis, 20 a 29 de novembro de 2026: dia a dia com plano de sol e de chuva, lugares, mapa e trilhas com GPX."
PREFIXO = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
           f'<meta name="description" content="{DESCRICAO}">'
           '<meta name="color-scheme" content="light dark">'
           '<meta name="theme-color" content="#F3F6EF" media="(prefers-color-scheme: light)">'
           '<meta name="theme-color" content="#0B1416" media="(prefers-color-scheme: dark)">'
           '<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">'
           '<meta property="og:title" content="Floripa 20–29 nov">'
           f'<meta property="og:description" content="{DESCRICAO}">'
           '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
           '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Floripa">'
           f'<link rel="icon" href="{ICONE}"><link rel="manifest" href="manifest.webmanifest">'
           '<style>[hidden]{display:none!important}</style>')

def com_google(dados):
    """Troca o ponto do OSM pelo do Google (classes A, B ou C) e guarda a classe de confiança."""
    for l in dados["lugares"]:
        L = loc_google.get(l["id"])
        if not L: continue
        l["coords"] = {"lat": L["lat"], "lng": L["lng"], "fonte": "Google Places", "ponto": (l.get("coords") or {}).get("ponto")}
        l["loc"] = {"classe": L["classe"], "nome_google": L["nome_google"], "dist_osm_m": L.get("dist_osm_m")}
        l["links"] = {**(l.get("links") or {}), "waze": f"https://waze.com/ul?ll={L['lat']},{L['lng']}&navigate=yes"}
    return dados

OPG = json.load(open(R / "pesquisa/opcoes_google.json")) if (R / "pesquisa/opcoes_google.json").exists() else {}
PIDX = {}
for _f in ("pesquisa/opcoes_google.json", "pesquisa/area_google.json"):
    if (R / _f).exists():
        for _g in json.load(open(R / _f)).values():
            for _res in _g.values():
                for _r in _res:
                    if _r and _r.get("place_id"): PIDX[_r["place_id"]] = _r
def resolve(ref):
    if not ref: return None
    if ref.startswith("pid:"): return PIDX.get(ref[4:])
    a, q, i = ref.split("|"); return (OPG.get(a, {}).get(q) or [None] * 9)[int(i)]
def anexa(o, google):
    ref = o.pop("g", None)
    if not (google and ref): return
    r = resolve(ref)
    if r: o.update({k: v for k, v in {"gn": r.get("nota"), "ga": r.get("avaliacoes"), "gp": r.get("place_id"), "gpreco": r.get("preco")}.items() if v})
def opcoes(dados, google):
    """Possibilidades de cada momento: com Google, junta nota, avaliações e place_id; sem Google, só tira a referência."""
    for d in dados["dias"]:
        for m in ("sol", "chuva"):
            for it in d[m]:
                for o in (it.get("opcoes") or {}).get("itens", []): anexa(o, google)
    for l in dados["lugares"]:
        for x in ((l.get("lista") or {}).get("itens") or []): anexa(x, google)
    return dados

def montar(dados, embutir_img=False, autonoma=True):
    s = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    if embutir_img:
        for t in dados["trilhas"]:
            t["gpx"] = "data:application/gpx+xml;base64," + base64.b64encode((R / t["gpx"]).read_bytes()).decode()
        for l in dados["lugares"]:
            for f in l["fotos"]:
                p = R / (f.get("t") or f["arq"])
                f["arq"] = f["t"] = "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()
        s = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    pagina = modelo.replace("__DADOS__", s)
    return PREFIXO + pagina + "</body></html>" if autonoma else pagina

import copy, shutil
if (R / "pesquisa/clima_atual.json").exists(): shutil.copyfile(R / "pesquisa/clima_atual.json", R / "clima.json")
(R / "dist").mkdir(exist_ok=True)
(R / "index.html").write_text(montar(opcoes({**copy.deepcopy(base), "google": {}}, False)))
(R / "dist/artifact.html").write_text(montar(opcoes(com_google({**copy.deepcopy(base), "google": google}), True), autonoma=False))
(R / "dist/preview.html").write_text(montar(opcoes(com_google({**copy.deepcopy(base), "google": google}), True), embutir_img=True))
for n in ("index.html", "dist/artifact.html", "dist/preview.html"):
    print(n, round((R / n).stat().st_size / 1024), "KB")
print(len(lugares), "lugares,", sum(1 for l in lugares if l["fotos"]), "com foto,", len(google), "com nota do Google")

# manifest e service worker: só a versão estática (GitHub Pages) usa; no claude.ai a página roda num iframe e não registra
(R / "manifest.webmanifest").write_text(json.dumps({
    "name": "Floripa 20–29 nov", "short_name": "Floripa", "lang": "pt-BR", "start_url": ".", "scope": ".", "display": "standalone",
    "background_color": "#F3F6EF", "theme_color": "#F08A00", "description": DESCRICAO,
    "icons": [{"src": "icone.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}]}, ensure_ascii=False, indent=1))
(R / "icone.svg").write_text(urllib.parse.unquote(ICONE.split(",", 1)[1]))
precache = ["./", "index.html", "manifest.webmanifest", "icone.svg"] + sorted(f"gpx/{p.name}" for p in (R / "gpx").glob("*.gpx")) + sorted(f"img/t/{p.name}" for p in (R / "img/t").glob("*.jpg"))
versao = hashlib.sha1((R / "index.html").read_bytes()).hexdigest()[:10]
(R / "sw.js").write_text(f"""// Guarda a página, os GPX e as miniaturas no aparelho para abrir sem sinal na trilha.
const CACHE = "floripa-{versao}";
const PRE = {json.dumps(precache)};
self.addEventListener("install", e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRE)).then(() => self.skipWaiting())); }});
self.addEventListener("activate", e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener("fetch", e => {{
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // previsão e página: rede primeiro (sempre a mais nova), cache só sem sinal
  if (u.pathname.endsWith("clima.json") || u.pathname.endsWith("/") || u.pathname.endsWith("index.html")) {{
    const chave = u.pathname.endsWith("clima.json") ? "clima.json" : e.request;
    e.respondWith(fetch(e.request).then(res => {{ const c = res.clone(); caches.open(CACHE).then(k => k.put(chave, c)); return res; }}).catch(() => caches.match(chave).then(r => r || caches.match("index.html"))));
    return;
  }}
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {{ const c = res.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return res; }}).catch(() => caches.match("index.html"))));
}});
""")
print("manifest, icone.svg e sw.js gravados;", len(precache), "arquivos no precache")
