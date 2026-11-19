"""Localiza cada ficha no Google Places (API oficial, chave em ~/.config/peregrino/google.env).
Para cada lugar: busca, compara nome e distância ao ponto do OSM, escolhe o melhor e grava em google.json
(campos 'escolhido' e 'loc'). Classes de confiança, no estilo do Peregrino:
  A  nome bate e o ponto fica a menos de 300 m do OSM (duas fontes concordam)
  B  nome bate e o ponto fica entre 300 m e 1,5 km do OSM
  C  nome bate, mas a única fonte é o Google ou a distância passa de 1,5 km
  D  nome só parece
  E  não achou
Uso: python3 -I pesquisa/google_localizar.py [--refazer]"""
import importlib.util, json, math, pathlib, re, sys, time, unicodedata, datetime

AQUI = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gp", AQUI / "google_places.py"); gp = importlib.util.module_from_spec(spec); spec.loader.exec_module(gp)
G = json.loads((AQUI / "google.json").read_text()) if (AQUI / "google.json").exists() else {}
PULAR = {"agenda-noite-20-28-nov", "festas-universitarias", "warung-e-green-valley", "centro-noite", "ingleses-santinho-jantar",
         "sc21k-2026", "cafe-de-la-musique-jurere"}
CONSULTA = {
 "lagoinha-do-leste": "Trilha Lagoinha do Leste Pântano do Sul", "joaquina-e-dunas": "Dunas da Joaquina", "morro-das-aranhas": "Trilha do Morro das Aranhas Santinho",
 "novo-campeche": "Novo Campeche Florianópolis", "barra-da-lagoa": "Praia da Barra da Lagoa", "praia-mole": "Praia Mole", "centrinho-da-lagoa": "Praça Bento Silvério Lagoa da Conceição",
 "centro-historico": "Praça XV de Novembro Florianópolis", "kart-ingleses": "Kartódromo dos Ingleses", "coworking-lagoa": "Cool Office Lagoa da Conceição coworking",
 "sup-lagoa": "Aldeia da Conceição stand up paddle Lagoa da Conceição", "escuna-anhatomirim": "Fortaleza de Santa Cruz de Anhatomirim",
 "costa-da-lagoa": "Trilha Costa da Lagoa", "guarda-do-embau": "Guarda do Embaú", "bar-deraiz": "Bar DeRaiz Lagoa da Conceição", "naufragados": "Trilha Caminho dos Naufragados",
 "praia-da-solidao": "Cachoeira da Solidão Florianópolis", "trilha-do-gravata": "Trilha Praia do Gravatá", "piscinas-naturais-barra-da-lagoa": "Piscinas Naturais Barra da Lagoa",
 "ribeirao-da-ilha": "Ribeirão da Ilha Florianópolis", "praia-da-galheta": "Praia da Galheta", "ilha-do-campeche": "Ilha do Campeche", "ponte-hercilio-luz": "Ponte Hercílio Luz",
 "morro-das-pedras": "Mirante Morro das Pedras", "mirante-da-lagoa": "Mirante do Morro da Lagoa da Conceição", "parapente-lagoa": "Rampa de Voo Livre Morro da Lagoa Florianópolis",
 "avenida-das-rendeiras": "Avenida das Rendeiras Lagoa da Conceição", "aktionpaz-lagoa": "Aktion Paz academia Lagoa da Conceição", "p12-jurere": "P12 Jurerê Parador 12",
}
PARADA = set("de do da dos das e a o em no na com para por sul ilha floripa florianopolis sc trilha praia bar restaurante lagoa conceicao".split())
def norm(s): return re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower())
def toks(s): return {t for t in norm(s).split() if t not in PARADA and len(t) > 1}
def sim(a, b):
    A, B = toks(a), toks(b)
    return len(A & B) / max(1, min(len(A), len(B))) if A and B else 0
def dist_m(a, b):
    R = 6371000; p1, p2 = math.radians(a[0]), math.radians(b[0]); dp = p2 - p1; dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

refazer = "--refazer" in sys.argv
for arq in sorted((AQUI / "lugares").glob("*.json")):
    d = json.loads(arq.read_text()); pid = d["id"]
    if pid in PULAR: continue
    if not refazer and G.get(pid, {}).get("loc"): continue
    c = d.get("coords") or {}; osm = (c["lat"], c["lng"]) if c.get("lat") is not None else None
    q = CONSULTA.get(pid) or d.get("google_consulta") or re.sub(r"\s*\(.*?\)", "", d["nome"]) + ", Florianópolis SC"
    try: cands = [gp.resumo(p) for p in gp.buscar(q, *(osm or (-27.6, -48.5)))]
    except SystemExit as e: print(pid, "erro", e); continue
    melhor, nota = None, -9
    for r in cands:
        if r.get("lat") is None or r.get("status") not in (None, "OPERATIONAL"): continue
        s = sim(r["nome_google"] or "", d["nome"]); dm = dist_m(osm, (r["lat"], r["lng"])) if osm else None
        pt = s * 2 - (min(dm / 3000, 1) if dm is not None else 0.3)
        if pt > nota: melhor, nota, r["_s"], r["_d"] = r, pt, s, dm
    if not melhor: classe, loc = "E", None
    else:
        s, dm = melhor["_s"], melhor["_d"]
        if dm is not None and dm > 20000: classe = "D"  # outra cidade: nome parecido não basta
        elif s >= 0.5 and dm is not None and dm < 300: classe = "A"
        elif s >= 0.5 and dm is not None and dm < 1500: classe = "B"
        elif s >= 0.34 or (dm is not None and dm < 400 and s >= 0.2): classe = "C"
        else: classe = "D"
        loc = {"place_id": melhor["place_id"], "nome_google": melhor["nome_google"], "lat": melhor["lat"], "lng": melhor["lng"],
               "endereco": melhor["endereco"], "dist_osm_m": None if dm is None else round(dm), "similaridade": round(s, 2), "classe": classe, "consulta": q,
               "em": datetime.date.today().isoformat()}
    G.setdefault(pid, {"consulta": q, "em": datetime.date.today().isoformat(), "candidatos": []})
    G[pid]["loc"] = loc
    if melhor and classe in "ABC": G[pid]["escolhido"] = {k: v for k, v in melhor.items() if not k.startswith("_")}
    elif classe in "DE": G[pid]["escolhido"] = None
    (AQUI / "google.json").write_text(json.dumps(G, ensure_ascii=False, indent=1))
    print(f"{pid:42} {classe} {('%dm' % loc['dist_osm_m']) if loc and loc['dist_osm_m'] is not None else '-':>7}  {(loc or {}).get('nome_google','')[:44]}", flush=True)
    time.sleep(0.25)
