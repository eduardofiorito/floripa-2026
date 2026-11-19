"""Perfil de altitude das trilhas (OpenTopoData, SRTM 30 m). Lê e atualiza dados/trilhas.json.
Uso: python3 -I pesquisa/altitude.py [--refazer]"""
import json, math, pathlib, sys, time, urllib.request
R = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "floripa-roteiro/1.0 (viagem em grupo; sem fins comerciais)"}
T = json.load(open(R / "dados/trilhas.json"))
def dkm(a, b): return math.hypot((a[0] - b[0]) * math.cos(math.radians(a[1])), a[1] - b[1]) * 111.32
def amostrar(linhas, passo=0.04, maximo=200):
    pts = [p for ln in linhas for p in ln]; tot = sum(dkm(a, b) for ln in linhas for a, b in zip(ln, ln[1:]))
    passo = max(passo, tot / maximo); out, acc, prox = [(0.0, pts[0])], 0.0, passo
    for ln in linhas:
        for a, b in zip(ln, ln[1:]):
            d = dkm(a, b)
            while d > 0 and acc + d >= prox:
                t = (prox - acc) / d; out.append((prox, (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))); prox += passo
            acc += d
    out.append((acc, linhas[-1][-1])); return out
def altitudes(pts):
    alt = []
    for i in range(0, len(pts), 100):
        q = "|".join(f"{p[1]:.5f},{p[0]:.5f}" for _, p in pts[i:i + 100])
        for tent in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request("https://api.opentopodata.org/v1/srtm30m?locations=" + q, headers=UA), timeout=40) as r:
                    alt += [x["elevation"] for x in json.load(r)["results"]]; break
            except Exception as e: time.sleep(3)
        time.sleep(1.2)
    return alt
for tid, t in T.items():
    if t.get("perfil") and "--refazer" not in sys.argv: continue
    am = amostrar(t["linhas"]); alt = altitudes(am)
    if len(alt) != len(am) or any(a is None for a in alt): print(tid, "falhou"); continue
    sm = [sum(alt[max(0, i - 2):i + 3]) / len(alt[max(0, i - 2):i + 3]) for i in range(len(alt))]
    ganho = perda = 0; ref = sm[0]
    for h in sm[1:]:
        if h - ref >= 6: ganho += h - ref; ref = h
        elif ref - h >= 6: perda += ref - h; ref = h
    passo = max(1, len(am) // 80)
    t["perfil"] = [[round(am[i][0], 3), round(sm[i])] for i in range(0, len(am), passo)] + ([[round(am[-1][0], 3), round(sm[-1])]] if (len(am) - 1) % passo else [])
    t["ganho"], t["perda"], t["alt_min"], t["alt_max"] = round(ganho), round(perda), round(min(sm)), round(max(sm))
    print(f"{tid:22} +{t['ganho']} m / -{t['perda']} m  ({t['alt_min']}–{t['alt_max']} m)", flush=True)
    json.dump(T, open(R / "dados/trilhas.json", "w"), ensure_ascii=False)
