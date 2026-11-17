"""Busca place_id, nota e links no Google Places API (New) para os lugares pesquisados.

Uso:
  python3 -I google_places.py --teste "Bar do Boni, Lagoa da Conceição"
  python3 -I google_places.py            # todos os lugares/*.json sem entrada em google.json

Lê a chave de ~/.config/peregrino/google.env (GOOGLE_MAPS_API_KEY). Nunca imprime a chave.
Grava em google.json (um registro por id, com data da consulta). Não altera lugares/*.json.
"""
import json, sys, time, pathlib, urllib.request, datetime

AQUI = pathlib.Path(__file__).resolve().parent
ENV = pathlib.Path.home() / ".config/peregrino/google.env"
SAIDA = AQUI / "google.json"
# fichas que agrupam vários lugares ou eventos: não têm um único ponto no Google
PULAR = {"agenda-noite-20-28-nov", "festas-universitarias", "warung-e-green-valley", "centro-noite",
         "ingleses-santinho-jantar", "coworking-lagoa", "sup-lagoa", "sc21k-2026"}
CAMPOS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress", "places.location",
    "places.rating", "places.userRatingCount", "places.googleMapsUri", "places.websiteUri",
    "places.regularOpeningHours.weekdayDescriptions", "places.priceLevel", "places.businessStatus",
    "places.primaryTypeDisplayName",
])


def chave():
    for linha in ENV.read_text().splitlines():
        if linha.startswith("GOOGLE_MAPS_API_KEY="):
            return linha.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("GOOGLE_MAPS_API_KEY não encontrada")


def buscar(texto, lat=None, lng=None):
    corpo = {"textQuery": texto, "languageCode": "pt-BR", "regionCode": "BR", "pageSize": 3}
    if lat is not None and lng is not None:
        corpo["locationBias"] = {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 3000.0}}
    req = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchText",
        data=json.dumps(corpo).encode(),
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": chave(), "X-Goog-FieldMask": CAMPOS},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r).get("places", [])
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        raise SystemExit(f"HTTP {e.code}: {msg}")


def resumo(p):
    return {
        "place_id": p.get("id"),
        "nome_google": (p.get("displayName") or {}).get("text"),
        "tipo": (p.get("primaryTypeDisplayName") or {}).get("text"),
        "endereco": p.get("formattedAddress"),
        "lat": (p.get("location") or {}).get("latitude"),
        "lng": (p.get("location") or {}).get("longitude"),
        "nota": p.get("rating"),
        "avaliacoes": p.get("userRatingCount"),
        "maps_uri": p.get("googleMapsUri"),
        "site": p.get("websiteUri"),
        "horarios": (p.get("regularOpeningHours") or {}).get("weekdayDescriptions"),
        "preco": p.get("priceLevel"),
        "status": p.get("businessStatus"),
    }


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "--teste":
        for p in buscar(sys.argv[2]):
            r = resumo(p)
            print(r["nome_google"], "|", r["nota"], f"({r['avaliacoes']})", "|", r["endereco"])
        return
    feito = json.loads(SAIDA.read_text()) if SAIDA.exists() else {}
    for arq in sorted((AQUI / "lugares").glob("*.json")):
        d = json.loads(arq.read_text())
        if d["id"] in feito or d["id"] in PULAR:
            continue
        c = d.get("coords") or {}
        consulta = d.get("google_consulta") or f"{d['nome']}, Florianópolis SC"
        cand = [resumo(p) for p in buscar(consulta, c.get("lat"), c.get("lng"))]
        feito[d["id"]] = {"consulta": consulta, "em": datetime.date.today().isoformat(),
                          "escolhido": cand[0] if cand else None, "candidatos": cand[1:]}
        print(d["id"], "→", cand[0]["nome_google"] if cand else "SEM RESULTADO",
              cand[0]["nota"] if cand else "")
        SAIDA.write_text(json.dumps(feito, ensure_ascii=False, indent=1))
        time.sleep(0.3)


if __name__ == "__main__":
    main()
