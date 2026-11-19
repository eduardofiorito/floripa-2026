"""Baixa até 2 fotos por lugar do Wikimedia Commons (largura 800) para img/ e grava img/mapa.json.
Uso: python3 -I pesquisa/baixar_fotos.py   (rodar da raiz do repo)"""
import json, glob, pathlib, time, urllib.request, urllib.parse, urllib.error

RAIZ = pathlib.Path(__file__).resolve().parent.parent
IMG = RAIZ / "img"; IMG.mkdir(exist_ok=True)
UA = {"User-Agent": "floripa-roteiro/1.0 (viagem em grupo; sem fins comerciais)"}
mapa = json.loads((IMG / "mapa.json").read_text()) if (IMG / "mapa.json").exists() else {}

def baixar(url_arquivo, destino):
    nome = urllib.parse.unquote(url_arquivo.rsplit("/", 1)[-1])
    u = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(nome) + "?width=800"
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
                dados = r.read(); tipo = r.headers.get("Content-Type", "")
            if not tipo.startswith("image/") or len(dados) < 2000: return False
            destino.write_bytes(dados); return True
        except urllib.error.HTTPError as e:
            if e.code in (429, 503): time.sleep(5 * (tentativa + 1)); continue
            return False
        except Exception:
            time.sleep(2)
    return False

for f in sorted(glob.glob(str(RAIZ / "pesquisa/lugares/*.json"))):
    d = json.load(open(f)); pid = d["id"]
    if pid in mapa: continue
    lista = []
    for i, ft in enumerate((d.get("fotos") or [])[:2]):
        destino = IMG / f"{pid}-{i+1}.jpg"
        if destino.exists() or baixar(ft["url"], destino):
            lista.append({"arq": f"img/{destino.name}", "autor": ft.get("autor"), "licenca": ft.get("licenca"), "pagina": ft.get("pagina")})
        time.sleep(0.8)
    mapa[pid] = lista
    (IMG / "mapa.json").write_text(json.dumps(mapa, ensure_ascii=False, indent=1))
    print(pid, len(lista), flush=True)
