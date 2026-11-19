# Revisão UX 1: guia Floripa 20–29/11 (17/11/2026)

Avaliado em `dist/preview.html`, celular 390×844 (claro e escuro) e desktop 1280. Rotas: `#roteiro`, `#dia-21`, `#lugares`, `#lugar-joaquina-e-dunas`, `#lugar-praia-mole`, `#mapa`, `#pendencias`. Fonte: `site/modelo.html`.

Resumo: a base visual é forte (identidade, timeline, Maps/Waze sempre à mão, modo trilha). Os problemas estão na **ordem**. A página abre num cartaz de marketing, não no "agora". A decisão entre praias é feita com texto, e a ficha mostra o mapa antes da foto. Faltam também os dados práticos da viagem.

## P0: atrapalha o uso

**1. Falta a tela "Hoje/Agora".** *Evidência:* `#roteiro` abre com hero, 4 contadores e legenda. O primeiro horário só aparece no 2º scroll (~y 1000). O dia selecionado é sempre Sex 20 (`diaSel` não olha a data). O único uso de data é o contador "dias pra cair na estrada". *Proposta:* um card fixo no topo do Roteiro, logo abaixo do header:
- **Antes de 20/11:** "Faltam 3 dias · saída sex 4h", com as 3 pendências urgentes.
- **Durante a viagem:** "AGORA 14h–15h30 Almoço no Bar do Arante [Maps] [Waze]", depois "DEPOIS 16h30 Uber pro P12". Por baixo, previsão e pôr do sol do dia.
- **Depois das 21h:** "AMANHÃ 6h30 sair para a Armação".

O chip do dia de hoje fica pré-selecionado e marcado "hoje", e a timeline rola até o item atual com uma linha "agora". O hero vai para o fim da página ou some depois de 20/11. *Esforço:* M.

**2. A ficha de lugar mostra mapa antes da foto, e a foto é ruim.** *Evidência:* `#lugar-joaquina-e-dunas`. A 1ª tela tem título enorme, resumo, selos e um mapa esquemático quase vazio (bege + 2 pontos). A foto aparece só em y≈880, em **preto e branco**. Em `#lugar-praia-mole` há rótulos sobrepostos no mapa ("Praia Mole" × "Clássico da Mole"). *Proposta:* a ficha abre com uma foto hero em sangria (16:10, ~45% da tela) e título sobreposto. Embaixo, uma galeria em carrossel com as 3–4 fotos que já existem em `fotos[]`. O mapa esquemático desce para "Como chegar" e fica colapsado. *Esforço:* P.

**3. As fotos enganam ou estão em baixa resolução.** *Evidência:* as imagens têm 420 px de largura num celular de 1170 px físicos, então ficam borradas no hero do card. Bar do Boni e Espartano usam a mesma foto da Av. das Rendeiras, e o Rufus usa uma vista da Lagoa. 13 lugares não têm foto. *Proposta:* servir 1080 px (thumb do Commons `/1080px-`) com `srcset`. Para bar/balada sem foto própria, usar um card tipográfico (ícone + cor da categoria) no lugar de paisagem genérica. Nunca reaproveitar a foto de outro lugar. *Esforço:* P.

## P1: melhora muito a decisão e o uso

**4. Falta um comparador de praias ("Decidir").** A decisão é emocional, e hoje exige abrir 3 fichas de ~5.900 px cada. *Proposta:* rota `#decidir/praias` (ou botão "Comparar" com seleção de 2–3 cards em Lugares). Fica assim no celular:
- **Swipe horizontal de cards em tela cheia** (estilo stories), um por praia, nesta ordem: foto grande → frase-gancho de 1 linha ("Pedras no canto esquerdo e duna com pôr do sol") → 3 chips de vibe (Público: *jovem/surf*, *deserta*, *família*; Mar: *ondas fortes*, *calmo*; Estrutura: *bar, ducha, salva-vidas* / *nada*) → distância e estacionamento em 1 linha → link de vídeo com capa → votos com rostos/iniciais → [Bora!].
- **Depois do swipe, uma tabela-resumo** de 3 colunas com linhas fixas: Vibe, Público, Mar, Estrutura, Da Lagoa, Melhor hora, Votos.

O conteúdo já existe em `publico`, `destaques`, `cuidados` e `da_lagoa`. Hoje "Público" fica escondido na grade "Antes de ir". Os chips precisam de um campo curto novo (`vibe: ["jovem","surf"]`, `mar`, `estrutura`). *Esforço:* M.

**5. Faltam vídeo e Instagram.** *Evidência:* nenhuma ficha tem vídeo. O Instagram só aparece se houver URL, e a Joaquina diz "A pesquisa não achou contato público". *Proposta:* um bloco "Ver como é" logo após a galeria, com 1–2 links do YouTube com capa (`img.youtube.com/vi/<id>/hqdefault.jpg` + ▶, abrindo o app) e um link de hashtag/local do Instagram ("#praiamole recentes"). Isso cobre o "recente" que o Commons não dá. *Esforço:* P–M (curadoria).

**6. A ficha é longa demais, e repete coisas.** *Evidência:* Joaquina tem ~7 telas. "Duração" aparece 2× (fato e "Antes de ir"). Horário aparece como "Abre" e "Horários". Maps/Waze aparecem 3× (topo, "Como chegar" e barra fixa). "Preços" é um parágrafo com 4 fontes numa grade de 2 colunas de 180 px. *Proposta:* nova ordem:
1. Foto/galeria
2. Gancho + chips de vibe
3. "No roteiro: Dom 22, Sex 27" (com horários)
4. Votos
5. "Por que ir" (3 bullets)
6. "Se liga" (cuidados)
7. Colapsados (`<details>`): Como chegar e estacionar, Preços, Horários, O que levar, Plano B, Confiança dos dados, Mapa

A barra fixa Maps/Waze basta, então os botões duplicados saem. As fontes dos preços ficam em letra pequena. *Esforço:* M.

**7. A lista de Lugares é lenta para varrer.** *Evidência:* `#lugares` tem 55 cards de ~1 tela cada, com 2 filas de chips (região × categoria, 15 chips) e um select de ordem. *Proposta:* um alternador "Grade/Lista". Grade com 2 colunas de foto quadrada + nome + 1 chip de vibe. Lista compacta com thumb 64 px. Chips de atalho: "Praias", "Pôr do sol", "Noite", "Perto de casa", com a categoria primeiro. *Esforço:* M.

**8. Os votos não dizem quem votou nem o que cada botão significa.** *Evidência:* os botões "Bora! / Topo / Passo" não têm legenda, e a contagem fica anônima ("2 bora"). Em preview aparece "Votos neste aparelho". *Proposta:* legenda curta ("Quero muito / Topo / Passo") e avatares com iniciais dos 4 por estado. No Roteiro, um selo nos itens ainda em decisão ("sex 27: funk ou samba? 1×2"). *Esforço:* P.

**9. As pendências não têm dono nem ação.** *Evidência:* `#pendencias` mostra 15 itens sem responsável. "Comprar ingresso P12" não leva link da Ingresse, e "Reservar no Freguesia" não leva WhatsApp. A aba não tem contador. *Proposta:* chip de responsável (iniciais) e um botão de ação por item (Comprar, WhatsApp, Ver Instagram). A aba ganha badge com o número de "Fazer agora". Prazo como data ("até qui 19"), não "esta semana". *Esforço:* P–M.

**10. Falta o "kit da viagem" (veja a lista abaixo).** *Esforço:* M.

**11. O Mapa não serve para navegar.** *Evidência:* `#mapa` é um esquema sem ruas e sem rótulos, sem o ponto "Casa" e com 6 pontos sobrepostos na Lagoa. *Proposta:* marcador "Casa (Lagoa)" aproximado de bairro, nunca o endereço. Um toque no ponto abre uma folha inferior com foto, nome e [Maps][Waze][Ficha]. Filtro "Hoje" que mostra só os pontos do dia, numerados na ordem da timeline. *Esforço:* M.

## P2: polimento

**12.** Header com sol/chuva global + chip "Plano sol" + "Comparar sol × chuva": são 3 controles para o mesmo conceito. Fica só o toggle do header. "Comparar" vira o 2º estado do mesmo toggle. *(P)*

**13.** O ponto cinza no canto do header (status de sync) não tem rótulo. Mostrar "Votos ao vivo" ou "offline" só quando houver erro. *(P)*

**14.** Animações: a entrada "sobe" em toda a view, a ribbon que cresce, o sol girando sem parar no header e o pulso infinito do sync. Os dois loops infinitos distraem e gastam bateria. Rodar uma vez. A contagem dos números do hero mostra "28" no meio da animação e engana no print. *(P)*

**15.** A ribbon da timeline não tem legenda de cores nem rótulos. Pôr o nome do bloco no toque e uma linha "agora". Na legenda de risco, o texto de 12 px fica pequeno ao sol: subir para 14 px. *(P)*

**16.** Links inline na timeline + card com Maps/Waze/Ficha repetem o mesmo destino. No card da timeline, o "Ficha" amarelo cai sozinho numa 2ª linha: deixar os 3 botões numa linha só de ícone + texto curto, ou fazer o card inteiro abrir a ficha. *(P)*

**17.** No desktop 1280, o roteiro ocupa 1 coluna e sobra metade da tela. Usar timeline à esquerda e mapa do dia + previsão à direita. *(M)*

**18.** Escuro está bom. O Maps em turquesa saturado sobre fundo escuro chama mais atenção do que o título: baixar a saturação. *(P)*

## O que falta para ser "o ponto de referência de tudo"

| Item | Onde mora |
|---|---|
| Hospedagens: nome do bairro, check-in/out (Lagoa: out 28 até 11h; continente: in 14h, out dom 12h), regras da casa, wi-fi. **Endereço só em link privado** (ex.: "Abrir no Maps" vindo de um campo que não vai para o build público) ou "pergunte no grupo" | Guia › Hospedagem; também no card Hoje nos dias 20, 28 e 29 |
| Contatos: anfitriões (privado), restaurantes com reserva, Uber/99, táxi | Guia › Contatos |
| Emergência: SAMU 192, Bombeiros 193 (resgate no mar e em trilha), Polícia 190, UPA/hospital e farmácia 24h mais perto da Lagoa e do continente | Guia › Emergência, com atalho no header (ícone "+") |
| Previsão e mar: links Ciram/Epagri, Windy, tábua de maré (Marinha/Tábua de Marés), Surfguru, horário do sol | Card Hoje + Guia › Tempo e mar |
| O que levar: geral, trilha (já existe `CHECK_TRILHA`), praia, prova | Guia › Malas (checklist por pessoa) |
| SC21K: kit sáb 28 9h–19h (voucher, documento, 1 kg de alimento), largada 5h31/6h, percurso, guarda-volumes, plano de chuva | Card próprio em Dom 29 + ficha `sc21k-2026` no topo |
| Orçamento e rachar contas: estimativas (P12, kart, Uber, gasolina, pedágio), link do Splitwise/Tricount | Guia › Dinheiro |
| Documentos: RG/CNH, CRLV, comprovante de inscrição, Wellhub | Guia › Malas |
| Transporte: regra carro × Uber (de `decisoes.md`), motorista da vez por dia, estacionamentos e preços | Guia › Regras + nota em cada item do roteiro |
| Regras do grupo: horários de silêncio no expediente, quem cozinha, lixo na trilha | Guia › Regras |

## Nova estrutura de navegação (barra inferior, 5 abas)

1. **Hoje**: card Agora/Depois/Amanhã, previsão, sol, maré, pendências do dia, pontos do dia no mapa. Antes da viagem, mostra a contagem regressiva e os "Fazer agora".
2. **Roteiro**: chips dos 10 dias (hoje marcado), timeline, toggle sol/chuva/comparar.
3. **Explorar**: Lugares (grade/lista) + **Decidir** (comparador por categoria: praias, pôr do sol, noite) + Mapa como 3ª vista da mesma aba.
4. **Grupo**: votos em aberto, pendências com dono, quem já votou.
5. **Guia**: Hospedagem, Emergência, Malas, SC21K, Dinheiro, Tempo e mar, Regras, Fontes.

Ficha de lugar e modo trilha ficam como telas de detalhe com barra fixa [Maps][Waze][GPX].
