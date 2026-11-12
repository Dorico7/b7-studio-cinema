# Análise crítica do pacote de planejamento B7 Studio Cinema

**Pacote recebido:** `B7_Studio_Cinema_Planejamento_para_IA.zip` (3 arquivos, ~24 KB de texto)
**Lido integralmente:** `LEIA_PRIMEIRO.md` (8 linhas), `PLANO_TECNICO_B7_STUDIO_CINEMA.md` (287 linhas, 12 seções), `PROMPT_PARA_IA_DESENVOLVEDORA.md` (36 linhas).
**Complemento avaliado:** o `cartoon-short-kit` citado no plano (13 arquivos, 1.126 linhas de JS/Python).

---

## 1. Veredito curto

É um plano **acima da média**: escopo honesto, critérios de aceite por fase, restrições não negociáveis explícitas e uma preocupação rara com "não prometer IA que não existe". Ao mesmo tempo, ele tem **três furos que travariam qualquer IA literal**:

1. A Fase 0 exige "demonstrar funcionamento do exemplo original", mas o ZIP do kit **não contém** as duas dependências centrais (`toon.js` e `lib/three.module.js`) e o `setup.sh` as busca na internet — ou seja, o critério de aceite depende de rede e de um passo de build que o pacote não documenta.
2. O plano exige "JSON validado por schema" sem definir o schema — e o exemplo da seção 5 é **mais pobre que o próprio requisito** (não tem múltiplos atores, expressões, props, SFX por cena, áudio por cena).
3. Não há **nenhum número-alvo de desempenho** apesar de o hardware ser conhecido (i3-7100 + GTX 1050) e de a Fase 6 pedir "medir FPS". Sem alvo, "aceite" vira opinião.

Nada disso invalida o plano. Significa que ele é um **contrato de intenção**, não um contrato executável: falta a camada de decisão técnica que uma IA precisa para não improvisar errado.

---

## 2. O que o pacote entrega, arquivo por arquivo

| Arquivo | Função real | Qualidade | Observação |
|---|---|---|---|
| `LEIA_PRIMEIRO.md` | Ordem de leitura e aviso de que é planejamento, não app | Boa | Deixa claro que não há código pronto; evita expectativa errada. |
| `PLANO_TECNICO_B7_STUDIO_CINEMA.md` | Missão, inventário do kit, arquitetura, requisitos, fases, regras, critérios | Muito boa | 12 seções; a melhor parte é a seção 9 (regras não negociáveis) e a 11 (primeiro entregável mínimo). |
| `PROMPT_PARA_IA_DESENVOLVEDORA.md` | Instrução operacional para a IA | Boa | Pede Fase 0 + início da Fase 1, formato de resposta e proíbe "100% pronto" sem teste. |

O pacote **não** contém: schema JSON, paleta, tipografia, lista de personagens, lista de cenários, licenças de terceiros, workflow de deploy, nem os scripts do motor. Isso é coerente com o aviso do `LEIA_PRIMEIRO.md`, mas concentra toda a decisão visual e técnica no implementador.

---

## 3. Pontos fortes (o que eu manteria sem mudar)

1. **Separação site estático × renderizador local** (seção 3). É a decisão arquitetural mais importante e está correta: GitHub Pages não roda FFmpeg, e fingir que roda é o erro clássico.
2. **"Sem falsa IA"** (regra 5). O plano proíbe chamar heurística de IA generativa. Isso moldou o planejador deste projeto: regras transparentes, revisão humana obrigatória, aviso na interface.
3. **Fonte de verdade é o ZIP** (regra 3) com a ressalva de auditar antes de executar (Fase 0). Correto em segurança: `setup.sh` baixa código de terceiros.
4. **Critérios de aceite por fase** (seção 7). Poucos planos têm; aqui cada fase tem um "Aceite" verificável.
5. **Piloto Derinkuyu com 7 tomadas e 25–30 s** (seção 6). Dá um alvo concreto, com batidas dramáticas já descritas.
6. **Regra 9: não anunciar conclusão sem teste real.** Foi o que me obrigou a medir tempo por quadro, rodar testes automatizados e gerar MP4 de verdade em vez de entregar mockup.
7. **Restrição de identidade** (regra 4): inspirar-se no gênero, não copiar o Ricks Clips. Está alinhado com a análise do canal (documento 01).

---

## 4. Lacunas e inconsistências (com evidência)

### 4.1 O kit não roda como entregue (bloqueia a Fase 0)

O plano afirma (seção 2) que `engine/main.js` é "renderização WebGL/Three.js" e manda "reaproveitar". No arquivo real:

```js
// engine/main.js, linhas 1-4
import * as THREE from './lib/three.module.js';   // arquivo ausente
import * as T from './toon.js';                   // arquivo ausente
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, ... } from './story.js'; // story.js está em example/soldier/
```

- `toon.js` e `lib/three.module.js` **não existem** no ZIP.
- `roman.js` usa `Pen`, `FACE`, `blob`, `INK` como **globais** — eles viveriam em `toon.js`. Sem ele, o arquivo nem executa.
- `SKILL.md` confirma que o Pen vem de `github.com/mromidev/claude-animated-shorts` via `setup.sh`.
- `setup.sh` é Bash e assume Playwright global — incompatível com o alvo Windows sem WSL (o plano reconhece, mas só na seção de problemas; a Fase 0 continua exigindo "demonstrar funcionamento").

**Consequência prática:** o critério de aceite da Fase 0 é inatingível *offline* e não há caminho reproduzível documentado para obtê-lo. Neste projeto, a decisão foi **reconstruir a camada ausente** (`pen.js` + `cast.js`, ~1.100 linhas) mantendo as regras de legibilidade do kit (cabeça-bean, contorno de tinta, paleta chapada), em vez de depender de download externo. Isso está registrado em `docs/03_ARQUITETURA.md`.

### 4.2 "JSON validado por schema" sem schema

A seção 5 diz que toda história deve virar JSON validado, mas não define tipos, campos obrigatórios, limites ou versão. O exemplo tem 2 cenas com 6 campos cada. Requisitos da seção 4.2 (poses, expressões, posição, câmera, efeitos, timing) **não cabem** no exemplo.

O que foi feito: schema próprio versionado (`schema: "b7studio/project@1"`) com normalizador, limites e validação em português (`src/storyboard/schema.js`), cobrindo atores múltiplos, expressões, poses, props, câmera com intensidade/roll, legendas com estilo/altura, SFX, FX e áudio.

### 4.3 Contrato de `renderFrame` indefinido

A Fase 1 exige "função determinística `renderFrame(timeSec, project)` que não dependa do relógio do browser". Não diz o que ela retorna, se desenha em canvas próprio, como lida com resolução, nem como o exportador a consome.

O que foi feito: `stage.renderFrame(sec, project)` desenha no canvas do palco e é determinística (nenhum `Math.random` no caminho de render; sementes fixas por ator). O renderizador local chama a mesma função via `window.b7.renderFrame(sec)` e captura RGBA — mesma engine no preview e no MP4.

### 4.4 Requisitos sem número

| Requisito | O que o plano diz | O que faltava definir |
|---|---|---|
| Desempenho | "medir FPS em GPU/CPU reais" | alvo mínimo (ex.: 24 fps de preview em 540×960 no i3-7100) |
| Legendas | "respeitar áreas seguras" | valores (ex.: margem inferior de 15%, largura máxima de 84%) |
| Exportação | "MP4 H.264/AAC 1080×1920" | bitrate/CRF, `yuv420p`, faststart, critério de sincronia |
| Armazenamento | "IndexedDB" | limite prático de áudio e o que fazer ao estourar cota |
| Planejador | "5–10 cenas" | como medir duração por fala (PT-BR ≈ 2,6 palavras/s) |

Todos esses números foram decididos e documentados neste projeto (ver `docs/03_ARQUITETURA.md` e `docs/05_QA_E_LIMITACOES.md`).

### 4.5 Escopo da Fase 2 vs. Fase 11 ("primeiro entregável mínimo")

A Fase 2 pede 6+ presets, 3 personagens, 8 poses, 5 movimentos de câmera; a seção 11 manda começar com **1 cena**. Não há ordem de prioridade entre os dois. Um implementador literal gasta a sessão inteira em biblioteca e não entrega vídeo.

Decisão: entregar primeiro o **vertical slice** (7 cenas do piloto + editor + exportação) e só depois ampliar catálogo. O catálogo atual tem 6 cenários, 8 personagens, 11 poses, 15 expressões, 8 props e 10 movimentos de câmera — acima do pedido, mas construído **depois** do piloto rodar.

### 4.6 Áudio: o plano subestima a sincronização

A Fase 4 pede "marcadores editáveis" e "ducking". O `timing.py` do kit usa `base.en` (inglês) e heurística silábica de inglês. Para PT-BR, o plano sugere "modelo multilíngue opcional ou sincronização editável", mas não define como o usuário alinha fala e cena sem transcrição.

O que foi feito: importação de MP3/WAV, decodificação no navegador, waveform na timeline, duração do áudio usada como restrição do planejador (ajusta a soma das cenas para caber na narração) e ducking fixo da música (0,16 sob a voz). Alinhamento palavra a palavra **não** foi implementado — está declarado como limitação.

### 4.7 Segurança: bom, mas incompleto

O plano acerta ao proibir `eval` e exigir sanitização. Faltam dois pontos:
- **Path traversal no renderizador local**: o plano cita "prevenir path traversal no servidor local", mas o `tools/render.mjs` do kit serve arquivos sem checar se o caminho sai do diretório. A versão deste projeto valida `file.startsWith(dist)` antes de servir.
- **Conteúdo importado**: um `.b7zip` pode conter PNGs/áudios maliciosos ou nomes com `../`. A importação atual lê apenas `project.json` e `media/*`, e o nome do arquivo é usado só como rótulo — nenhum caminho é escrito no disco a partir do nome.

### 4.8 O que o pacote não pede, mas o produto precisa

- **Desfazer/refazer** (o plano fala em edição, não em histórico).
- **Duplicar projeto** (seção 4.1 pede "duplicar", o pacote não define o que copiar de mídia).
- **Acessibilidade** (contraste, tamanho mínimo de texto, navegação por teclado).
- **Licenças de terceiros** (o plano pede créditos, mas não lista o que será usado; o `three` é MIT, `fflate` é MIT, `pngjs` é MIT, Playwright é Apache-2.0).
- **Testes automatizados** (a seção 10 tem checklist manual; nada sobre suíte executável).

---

## 5. Status por fase (o que está feito, com evidência)

| Fase do plano | Status | Evidência |
|---|---|---|
| 0 — Auditoria e ambiente | **Concluída com desvio documentado** | Kit inventariado; dependências ausentes identificadas; `package.json` com versões fixas; exemplo original **não** executado (bloqueio descrito em 4.1); camada `pen/cast` reconstruída. |
| 1 — Núcleo + interface mínima | **Concluída** | `src/engine/*`, painel PT-BR, play/pause, seek, lista de cenas, `renderFrame(sec, project)` determinístico. |
| 2 — Templates e JSON | **Concluída (acima do pedido)** | Schema versionado + normalizador + validação; 6 cenários, 8 personagens, 11 poses, 15 expressões, 8 props, 8 câmeras; planejador heurístico com 12 testes. |
| 3 — Piloto Derinkuyu | **Concluída** | 7 cenas, 32 s, 1080×1920, MP4 gerado; contact sheet e stills em `out/`. |
| 4 — Áudio | **Parcial** | Importação, waveform, ducking e duração integrada ao planejador. Sem TTS e sem alinhamento palavra a palavra. |
| 5 — Exportação e QA | **Concluída (browser + local)** | WebM no navegador; MP4 via Playwright+FFmpeg; `encode.mjs` roda ffprobe e 6 checagens (duração, vertical, H.264, AAC, fps, trechos pretos). |
| 6 — Qualidade e desempenho | **Parcial** | 3 presets de estilo; medições reais (ver 6.1); sem atlas de texturas nem LOD. |
| 7 — Publicação | **Preparada, não publicada** | `vite.config.js` com `base: './'`, workflow de Pages, `.nojekyll`; publicação depende da conta do usuário. |

### 5.1 Desempenho medido (não estimado)

Ambiente de teste: sandbox Linux, **sem GPU**, renderização por software (SwiftShader), Chromium headless — ou seja, o pior caso possível.

| Operação | Resolução | Tempo |
|---|---|---|
| `renderFrame` (engine pura) | 540×960 | **17 ms/quadro** (~58 fps teóricos) |
| `renderFrame` (engine pura) | 1080×1920 | ~60 ms/quadro |
| Captura RGBA + transferência | 540×960 | ~0,1 s |
| Pipeline completo para MP4 | 1080×1920 | **~1,44 s/quadro** (medido: 60 quadros em 86 s) |
| `toDataURL('image/png')` | 540×960 | ~0,9 s (descartado; virou gargalo) |

Conclusão: a engine é barata; **o gargalo é a captura/encodificação**, não o Three.js. No PC-alvo (GTX 1050), o preview deve rodar com folga em 540×960; o MP4 de 32 s deve levar minutos, não horas. Números exatos na máquina do usuário precisam ser medidos com `npm run render`.

---

## 6. Riscos que o plano não nomeia

1. **Qualidade visual é o risco real, não a arquitetura.** Um motor que roda e um vídeo que as pessoas assistem são coisas diferentes. O plano trata "estética autoral" como requisito, mas não define critério de aprovação visual além de "sem telas pretas". Neste projeto, a arte passou por três rodadas de correção com folhas de contato (proporção de personagem, cabelo cobrindo o rosto, cenários com câmera dentro da geometria).
2. **Custo de arte por cena.** Cada cenário novo é código (300–500 linhas). O plano fala em "biblioteca de cenários" como se fosse upload de imagens. Na prática, ampliar catálogo é trabalho de programação.
3. **Direitos de temas reais.** Derinkuyu é fato histórico; o plano acerta ao pedir distinção entre fato e dramatização, mas não define revisão editorial. Vídeos de "curiosidade" erram fatos com facilidade.
4. **Dependência de uma única pessoa.** 27 vídeos em 33 dias no canal de referência é cadência de equipe. O produto reduz o custo, mas não elimina roteiro, revisão e publicação.

---

## 7. Recomendações priorizadas

**P0 (antes de qualquer novo recurso)**
1. Medir o pipeline completo no PC-alvo e registrar fps de preview e tempo/quadro no MP4.
2. Fechar o contrato de áudio: marcadores por cena arrastáveis + botão "ajustar cenas à narração".
3. Adicionar desfazer/refazer (histórico de projeto) — sem isso, editar é frágil.

**P1**
4. Alinhamento de legenda por sílabas em PT-BR (sem transcrição): estimar por duração de fala e permitir correção manual.
5. Atlas de texturas e cache de geometria para reduzir tempo de abertura de cena.
6. Presets de \*storyboard\* (não só de cenário): "descoberta", "fuga", "revelação", "comparação".

**P2**
7. TTS local PT-BR (Piper) como opção instalável, com licença de voz explícita.
8. Exportação de trecho (range) e retomada de render.
9. Testes visuais por diferença de imagem (regressão de render).
10. Publicação automática no Pages com verificação de links.

---

## 8. Conclusão

O pacote é um **bom contrato de produto** e um **contrato técnico incompleto**. Ele acerta o que mais importa — escopo honesto, separação site/local, proibição de falsa IA, critérios por fase — e erra ao assumir que o kit é executável e que "schema" se resolve com um exemplo de 12 linhas.

A resposta correta a esse tipo de plano não é obedecer literalmente nem reescrever tudo: é **fechar as lacunas com decisões explícitas, medir, e entregar um vertical slice funcionando** — que é o que este repositório faz, com as decisões registradas em `docs/03_ARQUITETURA.md` e as pendências em `docs/05_QA_E_LIMITACOES.md`.
