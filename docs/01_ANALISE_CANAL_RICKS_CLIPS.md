# Análise do canal Ricks Clips (@RicksClips3000)

**Escopo:** 149 Shorts publicados entre 31/08/2025 e 08/11/2026, coletados da aba `/shorts` do canal (metadados públicos: data, duração, visualizações, título) e uma análise quadro a quadro de um dos vídeos de maior audiência.
**Canal:** 167 mil inscritos na data da coleta.
**Natureza dos dados:** visualizações acumuladas no momento da coleta. Não há acesso a retenção, CTR de impressões, RPM ou origem de tráfego — conclusões sobre "por que funcionou" são inferência a partir de formato, tema e desempenho, não leitura do algoritmo.

---

## 1. Resumo executivo

1. **O canal não cresceu por consistência: cresceu por uma virada de formato.** Até setembro de 2026 eram clipes curtos de filmes/séries e loops de 5 a 109 segundos, com mediana de **484 mil** visualizações. A partir de 06/10/2026 o canal passou a publicar **explicadores narrativos de ~60 segundos, quase diários**, e a mediana saltou para **8,5 milhões** — 17,5× maior.
2. **A duração mudou junto com o formato.** Na fase 2, 31 a 78 s, mediana de 60 s. Na fase 1, mediana de 10 s. O Short de 60 s permite uma mini-história com virada; o loop de 10 s entrega só o choque.
3. **O título é o gancho.** Mediana de 4 palavras, 20% com interrogação, predominância de "The…", "Why…", "What…". Os padrões de maior mediana são "The X that Y" (15,3 M) e "What/Which…" (9,9 M). "How…" rende bem menos no canal (2,9 M).
4. **O formato é reproduzível por um criador solo** — e é exatamente o que o `cartoon-short-kit` e o plano do B7 Studio Cinema tentam industrializar: personagens 2D sobre cenários 3D, cortes a cada 1,5–2 s, legenda queimada palavra a palavra e narração em ritmo de contação de história.
5. **O que não deve ser copiado:** identidade visual, personagens, títulos e roteiros. O valor está na gramática (estrutura, ritmo, gancho), não nos ativos.

![Visualizações por vídeo ao longo do tempo](/home/ubuntu/b7-studio-cinema/docs/img/canal_views_tempo.png)

---

## 2. Método

- Coleta dos 149 Shorts com `yt-dlp --flat-playlist` e enriquecimento por metadados públicos (`uploadDate`, `viewCount`, `lengthSeconds`, `title`).
- Separação em duas fases pela data de publicação (corte em 15/09/2026), verificada visualmente no gráfico de dispersão.
- Estatística descritiva (mediana, média, quantis), cadência de upload e análise textual dos títulos (palavras iniciais, pontuação, tamanho).
- Um vídeo de topo ("Why Perfect Railroads Don't Work", 65 s, 28 M) foi analisado quadro a quadro por um modelo de visão para descrever estilo, ritmo de corte, legendas, narração, música e estrutura dramática.

---

## 3. Os números

### 3.1 Visão geral

| Métrica | Valor |
|---|---|
| Shorts analisados | 149 |
| Período | 31/08/2025 → 08/11/2026 (434 dias) |
| Inscritos | 167 mil |
| Soma de visualizações | 427,4 milhões |
| Mediana por vídeo | 672,5 mil |
| Média por vídeo | 2,87 milhões |
| Quantis (10/25/50/75/90/99%) | 69 mil / 151 mil / 673 mil / 3,77 M / 8,62 M / 22,98 M |
| Maior vídeo | 33,35 M — "The Ancient Jar That Warned an Empire" (65 s) |
| Menor vídeo | 19,8 mil — "A World Based On Ratings" (95 s, fase 1) |
| Cadência média | 0,34 vídeos/dia (2,4/semana) |
| Cadência na fase 2 | ~1 vídeo/dia (intervalo mediano de 1,0 dia) |

### 3.2 Duas fases, dois canais dentro do mesmo canal

| | Fase 1 (31/08/2025–14/09/2026) | Fase 2 (06/10/2026–08/11/2026) |
|---|---|---|
| Vídeos | 122 | 27 |
| Mediana de views | **483.922** | **8.496.319** |
| Média de views | 1,45 M | 9,30 M |
| Duração | 5–109 s (mediana 10 s) | 31–78 s (mediana 60 s) |
| Formato | clipes de filme, loops, memes (`#shorts #movie`) | explicadores de curiosidade/história |
| Títulos | frases curtas e piadas visuais | gancho de curiosidade ("The… That…", "Why…") |

A amplitude da fase 1 vai de 19,8 mil a 15,8 milhões — ou seja, o canal já tinha picos, mas a **mediana** era baixa. Na fase 2 a mediana sobe duas ordens de grandeza: não é um viral isolado, é o piso do canal que mudou.

![Distribuição de audiência](/home/ubuntu/b7-studio-cinema/docs/img/canal_distribuicao.png)

### 3.3 Duração

![Duração e audiência](/home/ubuntu/b7-studio-cinema/docs/img/canal_duracao.png)

A correlação bruta entre duração e views é 0,46, mas isso é confundido pela fase: os vídeos curtos de 5–15 s são quase todos da fase 1. O dado útil é o oposto do senso comum de "Short tem que ter 7 segundos": **os maiores vídeos do canal têm 45–65 s**, porque o formato escolhido é uma mini-história com reviravolta, não um choque único.

### 3.4 Top 10

| Views | Duração | Data | Título |
|---|---|---|---|
| 33,35 M | 65 s | 19/10/2026 | The Ancient Jar That Warned an Empire |
| 27,97 M | 65 s | 01/11/2026 | Why Perfect Railroads Don't Work |
| 17,57 M | 61 s | 21/10/2026 | The Job Nobody Wants in Japan |
| 15,61 M | 65 s | 30/10/2026 | Why Sailors Carried Storm Oil |
| 15,51 M | 39 s | 10/10/2026 | Your Brain's Secret Idea Zone |
| 15,29 M | 45 s | 15/10/2026 | The Window That Breaks Japan's Gambling Law |
| 12,60 M | 60 s | 23/10/2026 | What the Grave Bell Really Meant |
| 9,59 M | 65 s | 03/11/2026 | The Pink Prison Cell Experiment |
| 9,52 M | 64 s | 18/10/2026 | Levels of Pirate Cannonballs |
| 9,37 M | 45 s | 17/10/2026 | An Unstoppable Spear vs an Unbreakable Shield |

Dez vídeos = 66% de toda a audiência do canal. A distribuição é de cauda longa clássica: mediana de 673 mil, mas o topo concentra dezenas de milhões.

### 3.5 Títulos

- Mediana de **4 palavras**; 20% terminam com interrogação.
- Primeiras palavras mais comuns: *The* (22), *He* (10), *What* (8), *Why* (8), *How* (6), *Would* (4).
- Medianas por padrão (fase 2): "The X that Y" → 15,3 M; "What/Which" → 9,9 M; "Why" → 9,2 M; "How" → 2,9 M.
- Nenhum título descreve o vídeo: todos abrem uma **lacuna de curiosidade** ("The Window That Breaks Japan's Gambling Law" não diz o que acontece; "Why Perfect Railroads Don't Work" promete uma explicação contraintuitiva).

---

## 4. Anatomia do formato (teardown de um vídeo de 65 s)

Análise quadro a quadro de "Why Perfect Railroads Don't Work" (28 M):

| Elemento | Como aparece |
|---|---|
| **Visual** | Personagens 2D desenhados (traço simples, rosto expressivo, contorno de tinta) sobre cenários 3D estilizados (deserto, trilho, estação). Fundo com luz consistente, não fotorrealista. |
| **Enquadramento** | Vertical 9:16, personagem sempre legível no terço inferior/central; cenário dá a escala. |
| **Ritmo de corte** | Troca de plano a cada **1,5–2 s**; o vídeo tem 65 s e aproximadamente 35–40 planos. |
| **Legenda** | Branca, sans-serif pesada, contorno preto grosso, centro-inferior, aparecendo em palavras/frases curtas sincronizadas com a narração. |
| **Narração** | Voz masculina de "contador de histórias", ritmo rápido, pausas dramáticas, ênfase em palavras-chave ("snake", "purple"). |
| **Música** | Orquestral leve, cresce em intensidade junto com a tensão. |
| **SFX** | Serra, apito de trem, "clickety-clack", metal rangendo, explosão. Cada ação tem som. |
| **Estrutura** | 0–3 s mistério (homem serrando trilhos) → 3–11 s apostas (duas companhias, um desfiladeiro) → 11–28 s conflito (o chefe furioso) → 28–36 s humilhação (concorrente "perfeito" vence) → 36–47 s virada (dilatação térmica) → 48–65 s pagamento (trilho do rival entorta e explode). |

**Por que funciona:** o espectador recebe uma pergunta estranha nos primeiros 2 segundos, um custo claro (perder a corrida), uma injustiça (o rival vence) e uma explicação física no final. É a estrutura de uma fábula de 60 segundos — não é "curiosidade aleatória".

---

## 5. O que isso significa para o B7 Histórias

### 5.1 Transferível

1. **Formato de 45–65 s com 6 a 8 planos**, não loop de 7 s.
2. **Um gancho visual nos primeiros 1,5 s** (ação estranha + legenda de 3–5 palavras).
3. **Legenda queimada, pesada, centro-inferior**, dentro da área segura do Shorts.
4. **Corte a cada 1,5–2 s** — o que o nosso motor já favorece, porque cada cena é um plano.
5. **SFX por ação** e música que cresce — o plano técnico já prevê SFX e ducking.
6. **Título-lacuna**, não descrição: "O homem que quebrou a parede e achou uma cidade" em vez de "Cidade subterrânea da Turquia".
7. **Cadência diária** na fase de tração: 27 vídeos em 33 dias.

### 5.2 Não transferível (e por que)

- **Identidade visual, personagens, paleta e lettering.** O plano é explícito: inspiração de gênero, nunca cópia. Além do risco jurídico, copiar visual mata a marca B7.
- **Roteiros e títulos.** Reutilizar título alheio é plágio e prejudica a distribuição.
- **O nicho "curiosidade histórica dos EUA/Japão".** Funciona para o público anglófono do canal; o B7 precisa de temas com identificação brasileira (história do Brasil, invenções, mistérios locais, ofícios desaparecidos).

### 5.3 O que o canal NÃO mostra

- Retenção média, curva de retenção, CTR e origem de tráfego: sem isso, não se sabe se o sucesso vem do feed de Shorts, de busca ou de recomendação.
- Custo de produção por vídeo e uso de IA generativa: o teardown mostra cenários 3D consistentes, o que é compatível tanto com render 3D real quanto com geração de imagem — não é possível afirmar qual.
- Frequência real de produção: os dados mostram rajadas (abril, junho, outubro), não uma rotina estável desde o início.

---

## 6. Checklist para os primeiros 10 vídeos do B7

- [ ] 45–65 s, 7 planos, uma reviravolta clara.
- [ ] Primeiro plano começa **no meio da ação** (martelo batendo, água subindo, porta abrindo) — nunca com personagem parado.
- [ ] Legenda de abertura com no máximo 5 palavras e uma lacuna ("ELE QUEBROU A PAREDE").
- [ ] Um tema por vídeo, com uma frase-tese que o espectador repetiria.
- [ ] SFX em cada ação física; música com clímax no plano 6.
- [ ] Título de 4–6 palavras no padrão "O que/O porquê/A coisa que…".
- [ ] Capa/primeiro quadro legível em miniatura.
- [ ] Publicação diária por 30 dias e medição de retenção no YouTube Studio (dado que o canal de referência não expõe).
