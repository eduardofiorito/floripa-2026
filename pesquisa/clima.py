"""Previsão do tempo para o roteiro: INMET (oficial, resumo por turno e alertas) + Open-Meteo (chance de chuva hora a hora).

Uso: python3 -I pesquisa/clima.py            (atualiza clima.json e roteiro/dias.json)
     python3 -I pesquisa/clima.py --so-json  (só clima.json; usado pelo GitHub Actions)
     python3 -I pesquisa/clima.py --db       (só pesquisa/clima_atual.json, para o banco do claude.ai)
Gera:
  pesquisa/clima_atual.json   documento para o banco da página (coleção "clima", doc "atual")
  roteiro/dias.json           atualiza risco e previsao de cada dia (versão estática e repo)
Fontes públicas, sem chave. Nada pessoal é enviado (só o código IBGE de Florianópolis e um ponto da Lagoa).
"""
import datetime, json, pathlib, sys, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "floripa-roteiro/1.0 (viagem em grupo)"}
IBGE = "4205407"                       # Florianópolis
LAT, LNG = -27.60, -48.47               # Lagoa da Conceição
DIAS = [str(d) for d in range(20, 30)]
TURNOS = {"madrugada": range(0, 6), "manha": range(6, 12), "tarde": range(12, 18), "noite": range(18, 24)}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)


def risco(p, mm, trovoada=False):
    if trovoada or (p >= 60 and mm >= 2) or mm >= 8:
        return "alto"
    if p >= 40 or mm >= 1:
        return "medio"
    return "baixo"


def main():
    om = get("https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s"
             "&hourly=precipitation_probability,precipitation,weather_code,wind_gusts_10m"
             "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max"
             "&timezone=America%%2FSao_Paulo&start_date=2026-11-20&end_date=2026-11-29" % (LAT, LNG))
    try:
        inmet = get("https://apiprevmet3.inmet.gov.br/previsao/" + IBGE).get(IBGE, {})
    except Exception:
        inmet = {}
    try:
        avisos = get("https://apiprevmet3.inmet.gov.br/avisos/ativos")
    except Exception:
        avisos = {}

    h = om["hourly"]
    por_dia = {}
    for i, t in enumerate(h["time"]):
        d, hh = str(int(t[8:10])), int(t[11:13])
        por_dia.setdefault(d, []).append((hh, h["precipitation_probability"][i] or 0, h["precipitation"][i] or 0, h["weather_code"][i] or 0, h["wind_gusts_10m"][i] or 0))

    dd = om["daily"]
    out = {"em": int(datetime.datetime.now().timestamp() * 1000), "fonte": "INMET + Open-Meteo", "dias": {}, "alertas": []}
    for k, t in enumerate(dd["time"]):
        d = str(int(t[8:10]))
        horas = por_dia.get(d, [])
        turnos = {}
        for nome, faixa in TURNOS.items():
            hs = [x for x in horas if x[0] in faixa]
            if not hs:
                continue
            p, mm, trov = max(x[1] for x in hs), round(sum(x[2] for x in hs), 1), any(x[3] >= 95 for x in hs)
            turnos[nome] = {"p": p, "mm": mm, "trovoada": trov, "risco": risco(p, mm, trov), "pico": max(hs, key=lambda x: x[1])[0]}
        horario = {str(x[0]): x[1] for x in horas}
        chave_inmet = f"{t[8:10]}/{t[5:7]}/{t[0:4]}"
        im = inmet.get(chave_inmet) or {}
        resumo = {p: im[p]["resumo"] for p in ("manha", "tarde", "noite") if isinstance(im.get(p), dict)} or ({"dia": im["resumo"]} if im.get("resumo") else {})
        trov_inmet = any("trovoada" in s.lower() for s in resumo.values())
        dia_turnos = [turnos[n] for n in ("manha", "tarde") if n in turnos]
        r_dia = max((x["risco"] for x in dia_turnos), key=["baixo", "medio", "alto"].index, default="baixo")
        if trov_inmet and r_dia == "medio":
            r_dia = "alto"
        out["dias"][d] = {
            "p": dd["precipitation_probability_max"][k], "mm": dd["precipitation_sum"][k],
            "max": dd["temperature_2m_max"][k], "min": dd["temperature_2m_min"][k], "rajada": dd["wind_gusts_10m_max"][k],
            "risco": r_dia, "turnos": turnos, "horas": horario, "inmet": resumo,
        }

    for lista in (avisos.get("hoje") or []) + (avisos.get("futuro") or []):
        if IBGE not in (lista.get("geocodes") or ""):
            continue
        out["alertas"].append({
            "titulo": lista.get("descricao"), "severidade": lista.get("severidade"), "cor": lista.get("aviso_cor"),
            "inicio": lista.get("inicio"), "fim": lista.get("fim"),
            "riscos": (lambda r: (r[0] if isinstance(r, list) and r else str(r or "")).strip("[]'\" ")[:220])(lista.get("riscos")),
        })

    (R / "pesquisa/clima_atual.json").write_text(json.dumps(out, ensure_ascii=False))
    if "--db" in sys.argv:  # só o arquivo do banco do claude.ai (não mexe em arquivos versionados)
        print("ok (só banco)", {d: v["risco"] for d, v in out["dias"].items()}, "alertas:", len(out["alertas"]))
        return
    (R / "clima.json").write_text(json.dumps(out, ensure_ascii=False))
    if "--so-json" in sys.argv:
        print("ok (só clima.json)", {d: v["risco"] for d, v in out["dias"].items()}, "alertas:", len(out["alertas"]))
        return

    # versão estática: risco e texto de previsão de cada dia
    p = R / "roteiro/dias.json"
    D = json.loads(p.read_text())
    nomes = {"manha": "manhã", "tarde": "tarde", "noite": "noite"}
    for dia in D["dias"]:
        c = out["dias"].get(dia["id"])
        if not c:
            continue
        dia["risco"] = c["risco"]
        partes = []
        if c["inmet"]:
            partes.append("INMET: " + "; ".join(f"{nomes.get(k, k)}: {v.lower()}" if k in nomes else v for k, v in c["inmet"].items()) + ".")
        tur = ", ".join(f"{nomes[n]} {c['turnos'][n]['p']}%" for n in ("manha", "tarde", "noite") if n in c["turnos"])
        partes.append(f"Chuva {c['p']}% ({str(round(c['mm'], 1)).replace('.', ',')} mm): {tur}. Máx {round(c['max'])}°, rajadas até {round(c['rajada'])} km/h.")
        dia["previsao"] = " ".join(partes)
    p.write_text(json.dumps(D, ensure_ascii=False, indent=2) + "\n")
    print("ok", {d: v["risco"] for d, v in out["dias"].items()}, "alertas:", len(out["alertas"]))


if __name__ == "__main__":
    main()
