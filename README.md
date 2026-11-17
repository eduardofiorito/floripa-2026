# Floripa 20–29 nov 2026

Guia de viagem do grupo: roteiro dia a dia, lugares priorizados e pendências.

- `index.html` — a página do guia. Abre direto no navegador ou pelo GitHub Pages (raiz do repo).
  No claude.ai ela tem votação e checklist compartilhados; fora de lá, os votos ficam só no aparelho.
- `pesquisa/BRIEF.md` — formato das fichas de cada lugar.
- `pesquisa/lugares/*.json` — uma ficha por lugar (coordenadas, links de Maps e Waze, horários, preços, dicas, fotos do Commons).
- `pesquisa/<regiao>.md` — ranking e combinações de dia por região.
- `pesquisa/google_places.py` — preenche `pesquisa/google.json` com `place_id`, nota e horários pela API do Google Places.
  Lê a chave de `~/.config/peregrino/google.env`; a chave nunca entra no repo.

Versão publicada no claude.ai: https://claude.ai/artifact/PTY8KPBBSBVEEuKk9mCwSB
