# QA, evidências e limitações

Este documento registra **o que foi testado**, **com quais números** e **o que não funciona**. Nenhum item aqui é estimativa sem medição; quando é estimativa, está escrito que é.

## 1. Ambiente dos testes

| Item | Valor |
|---|---|
| Sandbox | Linux, 24 GB RAM, **sem GPU** |
| Renderização | Chromium headless com SwiftShader (software) |
| Node | 22.x |
| Three.js | 0.160.1 |
| FFmpeg | 6.x (com `libx264`) |
| Playwright | Chromium 158 (headless shell) |

O hardware do usuário (i3-7100 + GTX 1050) **não** foi testado. Os números abaixo são o pior caso; com GPU dedicada, a expectativa é de preview mais fluido e render mais rápido — a confirmar com `npm run render`.

## 2. Testes automatizados

`npm test` → **21/21 aprovados** (relatório em `out/test-report.json`).

### Unidade (14)

| Teste | Verifica |
|---|---|
| normalização recalcula a linha do tempo | `startSec` contínuo e `durationSec` total |
| normalização preenche defaults | fps, ator padrão, legenda vazia |
| limites são aplicados | duração ≤ 60 s, posição ±40, câmera inválida → estática |
| projeto válido passa na validação | `ok: true` sem erros |
| projeto inválido é reprovado com mensagens | ≥ 2 erros em português |
| planejador cria cenas dentro do limite | 3–6 cenas para `maxScenes: 6` |
| planejador usa cenários conhecidos | só ids do catálogo |
| planejador gera legendas curtas | 1–45 caracteres |
| planejador estima duração plausível | total entre 8 e 45 s |
| planejador mantém início contínuo | `startSec` crescente |
| planejador lida com roteiro vazio | 0 cenas, sem exceção |
| pacote `.b7zip` ida e volta | exporta projeto + mídia e reimporta com os bytes intactos |
| `sceneIndexAt` respeita limites | fronteiras de cena |
| planejador reconhece estilo piscina | `pool`, `poolhost`, `phone`, `pool-night` |

### Fumaça de render (7)

| Teste | Verifica |
|---|---|
| duração do piloto | 32 s ± 0,5 |
| quadro não está preto | média > 18, desvio > 8 |
| quadro tem áreas claras | > 0,5% de pixels acima de 110 |
| cenas diferentes geram quadros diferentes | ≥ 5 hashes distintos em 6 tempos |
| legenda desenhada na área segura | > 800 pixels opacos na faixa de 68–90% da altura |
| projeto do piloto tem 7 cenas | estrutura carregada |
| sem erros de console | nenhum erro de página |

## 3. Verificações manuais (com evidência)

| Verificação | Resultado | Evidência |
|---|---|---|
| App abre e renderiza os 6 cenários | OK | `docs/img/sets_*.png` |
| Piloto completo em 7 cenas | OK | `docs/img/piloto_*.png` |
| Contact sheet do piloto | OK | `docs/img/piloto_contact_sheet.png` |
| Vídeo MP4 1080×1920/30 fps | OK | `out/final/derinkuyu-1080.mp4` + `qa-report.json` |
| Exportação WebM no navegador | Implementada; gravação real depende do navegador | botão na UI |
| Importação/exportação `.b7zip` | Implementada (JSON + mídias) | `store.js` |
| Persistência em IndexedDB | Implementada (autosave) | `store.js` |
| Áudio importado na timeline | Implementado (waveform + ducking) | `audio.js` |
| Layout sem rolagem em 1500×940 | OK | `docs/img/app_ui.png` |
| Preset piscina noturna | OK | `public/presets/piscina-noturna.b7.json` + render de prova |

### 3.1 MP4 final (ffprobe)

| Campo | Valor |
|---|---|
| Arquivo | `out/final/derinkuyu-1080.mp4` (entrega: `derinkuyu-1080x1920.mp4`) |
| Codec / pixel format | h264 / yuv420p |
| Resolução | 1080×1920 |
| FPS | 30/1 |
| Duração | 32,00 s (960 quadros) |
| Tamanho / bitrate | 8,04 MB / 2,01 Mbps |
| Áudio | ausente no piloto (o pipeline muxa AAC quando o pacote traz `voice.*`) |
| Trechos pretos ≥ 0,5 s | 0 |
| Brilho médio por cena | 36 a 96 (antes da correção de exposição: 32 em todo o vídeo) |

## 4. Desempenho medido

| Etapa | 540×960 | 1080×1920 |
|---|---|---|
| `renderFrame` (engine) | 17 ms | ~60 ms |
| captura RGBA + base64 | ~0,1 s | ~0,4 s |
| pipeline completo (render + captura + x264) | ~0,4 s/quadro | **~1,3 s/quadro** |
| 32 s a 30 fps (960 quadros) | ~6 min | **~21 min** |

`toDataURL('image/png')` foi descartado: 0,9 s por quadro só de codificação (9× mais lento que RGBA cru).

## 5. Limitações conhecidas (honestas)

### 5.1 Arte

1. **Estilo é "cartoon de escritório", não o acabamento do canal de referência.** Personagens são formas 2D com contorno grosso sobre cenários low-poly; não há pintura digital nem sombreamento elaborado.
2. **Cenários são paramétricos e repetem padrões.** A parede de pedra é a mesma textura em várias cenas; há risco de "cara de template" em séries longas.
3. **Sem animação de corpo inteiro/caminhada.** Braços e olhos se movem; o preset piscina adiciona flutuação e inclinação sutis, mas pernas e locomoção ainda são cartões estáticos. Para "andar", a cena move o ator ou corta.
4. **Sem transições entre cenas.** Corte seco. Não há fade, wipe ou match cut.
5. **Boca não fala.** A expressão é fixa por cena; não há sincronia labial com a narração.

### 5.2 Áudio

6. **Sem TTS.** A narração precisa ser gravada/gerada fora e importada.
7. **Sem alinhamento palavra a palavra.** As legendas são por cena, não por sílaba.
8. **Ducking fixo** (música a 0,16 sob a voz), não adaptativo.
9. **Sem mixer de SFX.** Os SFX estão declarados no schema, mas não há biblioteca de sons embutida — a mixagem final é externa.

### 5.3 Edição

10. **Sem desfazer/refazer.**
11. **Sem seleção múltipla, cópia/colagem de atores entre cenas** (há duplicar cena).
12. **Sem zoom/pan no palco** para enquadrar com precisão.
13. **Sem régua de snapping** na timeline (o clique posiciona, mas não gruda em fronteiras).

### 5.4 Exportação

14. **WebM é tempo real** e depende do navegador; não gera MP4.
15. **MP4 exige Node + Playwright + FFmpeg** no PC.
16. **Sem retomada de render** (se cair, recomeça).
17. **Sem seleção de intervalo na UI** (existe via `--range` na CLI).
18. **Sem fila de render** para vários projetos.

### 5.5 Produto

19. **Sem colaboração, contas ou nuvem.** Tudo local.
20. **Sem biblioteca de projetos** além da lista do IndexedDB.
21. **Sem temas escuro/claro** (só escuro).
22. **Sem atalhos configuráveis** e sem acessibilidade completa (foco visível, leitor de tela).

## 6. Riscos técnicos

| Risco | Probabilidade | Impacto | Mitigação atual |
|---|---|---|---|
| WebGL indisponível/antigo no PC do usuário | Baixa | Alto | mensagem de erro no palco; recomendações no guia |
| IndexedDB cheio com áudios longos | Média | Médio | exportar `.b7zip`; limpar projetos antigos |
| Render muito lento em 1080 sem GPU | Alta | Médio | prévia em 540; `--width` configurável |
| Navegador sem MediaRecorder VP9 | Baixa | Baixo | fallback VP8/WebM; MP4 local sempre disponível |
| Fonte do sistema diferente muda a legenda | Baixa | Baixo | família com fallback explícito |

## 7. Backlog priorizado

**P0**
- [ ] Medir no PC-alvo (i3-7100/GTX 1050) e registrar fps/tempo por quadro no README.
- [ ] Desfazer/refazer.
- [ ] Marcadores de áudio arrastáveis + "ajustar cenas à narração".

**P1**
- [ ] Alinhamento de legenda por sílabas em PT-BR.
- [ ] Transições (fade, wipe) entre cenas.
- [ ] Biblioteca de SFX livre + mixer simples.
- [ ] Atlas de texturas e cache de geometria por cenário.

**P2**
- [ ] TTS local PT-BR (Piper) com licença explícita.
- [ ] Retomada de render e fila.
- [ ] Testes de regressão visual por diferença de imagem.
- [ ] Publicação automática no GitHub Pages com verificação de links.

## 8. Como reproduzir os testes

```bash
npm install
npx playwright install chromium
npm run build
npm test

# vídeo final (21 min no pior caso)
npm run render -- public/presets/derinkuyu.b7.json --video out/final/derinkuyu-1080.mp4

# QA do MP4
npm run render:encode -- out/quadros out/video.mp4 --audio narracao.mp3
```

O relatório de testes sai em `out/test-report.json`; o de QA do vídeo, em `qa-report.json` ao lado do MP4.
