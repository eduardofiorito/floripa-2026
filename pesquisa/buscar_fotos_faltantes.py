"""Procura no Wikimedia Commons fotos para lugares sem foto e baixa até 2 por lugar (720 px) para img/.
Uso: python3 -I pesquisa/buscar_fotos_faltantes.py   (da raiz do repo). Atualiza img/mapa.json."""
import json, pathlib, time, urllib.parse, urllib.request, re, html

R = pathlib.Path(__file__).resolve().parent.parent
IMG = R / "img"; mapa = json.loads((IMG / "mapa.json").read_text())
UA = {"User-Agent": "floripa-roteiro/1.0 (viagem em grupo; sem fins comerciais)"}
BUSCA = {
 "ponte-hercilio-luz": "Ponte Hercílio Luz Florianópolis", "mercado-publico": "Mercado Público de Florianópolis",
 "forte-santana": "Forte Santana Florianópolis", "santo-antonio-de-lisboa": "Santo Antônio de Lisboa Florianópolis",
 "sambaqui": "Sambaqui Florianópolis", "centro-historico": "Praça XV de Novembro Florianópolis",
 "fortaleza-ponta-grossa": "Fortaleza de São José da Ponta Grossa", "morro-das-aranhas": "Praia do Santinho Florianópolis",
 "costao-do-santinho-inscricoes-rupestres": "Inscrições rupestres Santinho Florianópolis", "escuna-anhatomirim": "Fortaleza de Anhatomirim",
 "kart-ingleses": "Praia dos Ingleses Florianópolis", "sc21k-2026": "Beira-Mar Continental Florianópolis",
 "aktionpaz-lagoa": None, "coworking-lagoa": "Lagoa da Conceição Florianópolis centrinho", "agenda-noite-20-28-nov": None,
}
def api(params):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r: return json.load(r)
def limpo(s): return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()
for pid, q in BUSCA.items():
    if not q or mapa.get(pid): continue
    try:
        r = api({"action": "query", "generator": "search", "gsrsearch": q + " filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 8,
                 "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 720})
    except Exception as e:
        print(pid, "erro", e); continue
    cand = sorted((r.get("query", {}).get("pages", {})).values(), key=lambda p: p.get("index", 99))
    lista = []
    for p in cand:
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("mime") != "image/jpeg" or (ii.get("width") or 0) < 900 or not ii.get("thumburl"): continue
        em = ii.get("extmetadata", {})
        lic = limpo((em.get("LicenseShortName") or {}).get("value"))
        if not lic or "nc" in lic.lower().split("-")[:3]: continue
        dest = IMG / f"{pid}-{len(lista)+1}.jpg"
        try:
            with urllib.request.urlopen(urllib.request.Request(ii["thumburl"], headers=UA), timeout=30) as rr: dest.write_bytes(rr.read())
        except Exception: continue
        lista.append({"arq": f"img/{dest.name}", "autor": limpo((em.get("Artist") or {}).get("value"))[:80] or None, "licenca": lic,
                      "pagina": ii.get("descriptionurl")})
        print(" ", pid, "←", p["title"][:80], "|", lic)
        time.sleep(1.0)
        if len(lista) >= 2: break
    mapa[pid] = lista
    (IMG / "mapa.json").write_text(json.dumps(mapa, ensure_ascii=False, indent=1))
    print(pid, len(lista), flush=True); time.sleep(1.0)
