"""Busca candidatos no Google Places (API oficial) para as possibilidades de cada momento do roteiro.
Entrada: lista CONSULTAS abaixo (id do grupo, texto, lat, lng). Saída: pesquisa/opcoes_google.json (fora do git).
Uso: python3 -I pesquisa/opcoes_buscar.py [grupo ...]"""
import importlib.util, json, pathlib, sys, time
AQUI = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gp", AQUI / "google_places.py"); gp = importlib.util.module_from_spec(spec); spec.loader.exec_module(gp)
SAIDA = AQUI / "opcoes_google.json"
CONSULTAS = json.loads((AQUI / "opcoes_consultas.json").read_text())
feito = json.loads(SAIDA.read_text()) if SAIDA.exists() else {}
quais = set(sys.argv[1:])
for g, lista in CONSULTAS.items():
    if quais and g not in quais: continue
    for q in lista:
        texto, lat, lng = q[0], (q[1] if len(q) > 1 else None), (q[2] if len(q) > 2 else None)
        res = [gp.resumo(p) for p in gp.buscar(texto, lat, lng)]
        feito.setdefault(g, {})[texto] = res
        for r in res:
            h = (r["horarios"] or [""])[4] if r["horarios"] else ""
            print(f"[{g}] {r['nome_google']} | {r['nota']} ({r['avaliacoes']}) | {r['preco'] or ''} | {r['status']} | {r['endereco'][:70]} | sex: {h}")
        time.sleep(0.25)
SAIDA.write_text(json.dumps(feito, ensure_ascii=False, indent=1))
