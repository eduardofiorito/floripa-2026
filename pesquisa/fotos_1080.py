"""Rebaixa as fotos do Commons em 1080 px (para tela de celular de alta densidade) por cima de img/<id>-n.jpg.
Uso: python3 -I pesquisa/fotos_1080.py"""
import json, pathlib, subprocess, time, urllib.parse, urllib.request
R = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "floripa-roteiro/1.0 (viagem em grupo; sem fins comerciais)"}
m = json.loads((R / "img/mapa.json").read_text()); feito = R / "img/.1080"
feitos = set(feito.read_text().split()) if feito.exists() else set()
for lista in m.values():
    for f in lista:
        if f["arq"] in feitos or not f.get("pagina") or "File:" not in f["pagina"]: continue
        nome = urllib.parse.unquote(f["pagina"].split("File:", 1)[1])
        u = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(nome) + "?width=1080"
        tmp = R / "img/_baixando.jpg"
        for t in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r: tmp.write_bytes(r.read()); break
            except Exception as e: time.sleep(5 * (t + 1))
        else: continue
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-vf", "scale='min(1080,iw)':-2", "-q:v", "4", str(R / f["arq"])])
        tmp.unlink(missing_ok=True); feitos.add(f["arq"]); feito.write_text("\n".join(sorted(feitos))); print("ok", f["arq"], flush=True); time.sleep(1.2)
