# Brief de pesquisa — guia Floripa 20–29 nov 2026

Grupo: 4 amigos solteiros, 20–30 anos, 1 carro, base na Lagoa da Conceição (Centrinho). Trabalham home office nos dias úteis 23–27 (turno 8h–17h ou 9h–18h). Fins de semana 21 e 22 lotados; sáb 28 leve (véspera da SC21K, dom 29 5h30). Pôr do sol ~18h50, nascer ~5h05 (sem horário de verão). Hoje: 16/11/2026.

Cada lugar vira uma página inteira no guia futuro: o grupo clica no item, vê tudo e manda para Google Maps ou Waze.

## Saída: um JSON por lugar

Arquivo: `/home/fiorito/floripa-2026/pesquisa/lugares/<id>.json` (id em kebab-case, sem acento). Campos (use `null` quando não achar; nunca invente):

```json
{
  "id": "lagoinha-do-leste",
  "nome": "Lagoinha do Leste",
  "categoria": "trilha | praia | mirante | noite | comida | atividade | passeio | evento | bate-volta",
  "regiao": "sul | leste-lagoa | norte | centro | continente | fora-da-ilha",
  "resumo": "2–3 frases do porquê ir, em português simples",
  "destaques": ["..."],
  "coords": { "lat": -27.0, "lng": -48.0, "fonte": "OSM Nominatim | Wikipedia | Commons | outra (url)", "ponto": "o que o ponto marca: início da trilha, estacionamento, entrada" },
  "endereco": "...",
  "links": {
    "google_maps": "https://www.google.com/maps/search/?api=1&query=<lat>,<lng>",
    "waze": "https://waze.com/ul?ll=<lat>,<lng>&navigate=yes",
    "site": null, "instagram": null, "ingressos": null, "reserva": null
  },
  "nota_google": null,
  "outras_notas": [{ "fonte": "TripAdvisor", "nota": 4.5, "avaliacoes": 1234, "url": "..." }],
  "da_lagoa": { "tempo_min": 40, "km": 25, "obs": "trânsito de fim de tarde, rota" },
  "estacionamento": "onde, custo, lota?",
  "horarios": "...", "precos": "...",
  "melhor_horario": "...", "duracao": "...",
  "trilha": { "distancia_km": null, "tempo_ida_min": null, "desnivel_m": null, "dificuldade": null, "inicio": null, "sinalizacao": null },
  "o_que_levar": ["..."],
  "cuidados": ["segurança, maré, mar, cobras, golpes, multa"],
  "clima": { "sensivel_a": ["chuva", "vento sul", "mar agitado"], "plano_b": "..." },
  "publico": "para noite/praia: perfil, faixa etária, dias fortes, dress code",
  "combina_com": ["ids de lugares próximos para o mesmo dia"],
  "encaixe": ["cedo-dia-util", "pos-expediente", "fim-de-semana", "noite"],
  "fotos": [{ "url": "https://upload.wikimedia.org/...", "pagina": "https://commons.wikimedia.org/wiki/File:...", "autor": "...", "licenca": "CC BY-SA 4.0" }],
  "dicas": ["dicas locais concretas"],
  "fontes": ["urls usadas"],
  "verificado_em": "2026-11-16",
  "confianca": "alta | media | baixa",
  "pendencias": ["o que só dá para confirmar ligando/no Instagram"]
}
```

## Regras

- **Google:** não abrir, raspar nem automatizar google.com/maps, Google Search ou Google Imagens. O link do Maps é montado só pelo padrão de URL acima. `nota_google` fica `null` (vai ser preenchido depois pela API oficial, se houver chave).
- **Coordenadas:** OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/search?format=json&q=...`), no máximo 1 requisição por segundo, User-Agent genérico `floripa-roteiro/1.0` (sem e-mail ou nome). Ou coordenadas de Wikipedia/Commons. Para trilha, o ponto é o início da trilha ou o estacionamento, e diga qual.
- **Fotos:** só Wikimedia Commons (API `https://commons.wikimedia.org/w/api.php`), com autor e licença. De 2 a 4 por lugar quando existir. Não use fotos de sites comerciais.
- **Notas:** TripAdvisor e similares só se aparecerem em resultado de busca ou página pública; cite a url.
- **Fontes divergentes:** registre as duas e baixe a `confianca`.
- **Datas:** nada de eventos de anos anteriores apresentados como atuais.
- Não use dados pessoais de ninguém em requisições.
- Não edite `/home/fiorito/floripa-2026/index.html`.

## Relatório final (curto)

Ao terminar, além dos JSONs, escreva `/home/fiorito/floripa-2026/pesquisa/<regiao>.md` com: ranking da região para este grupo (do mais imperdível ao dispensável, uma linha de porquê cada), combinações de dia que funcionam, e o que ficou pendente. Responda ao chamador só com: lista de ids criados, top 3 da região e pendências críticas, em até 15 linhas.
