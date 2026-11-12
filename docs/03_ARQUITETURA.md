# Arquitetura do B7 Studio Cinema

## 1. Visão em uma frase

Um app estático (Vite + Three.js, sem backend) em que **o projeto é um JSON**, o **tempo é a fonte de verdade** e o mesmo código de render serve ao preview, ao WebM do navegador e ao MP4 gerado no PC.

```
Roteiro (texto PT-BR)
   │  planejador heurístico (regras, sem IA)
   ▼
project.json  ── validado/normalizado ──►  estado do editor
   │                                          │
   │                                          ├── preview (canvas 540×960)
   │                                          ├── WebM (MediaRecorder, tempo real)
   │                                          └── pacote .b7zip
   │                                                  │
   │                                                  ▼
   │                                     renderizador local (Playwright)
   │                                        frames RGBA → FFmpeg → MP4
   ▼
IndexedDB (projetos + mídias)
```

## 2. Módulos

| Caminho | Responsabilidade | Depende de |
|---|---|---|
| `src/main.js` | Bootstrap, estado, eventos de UI, modo `?render=1` | todos abaixo |
| `src/storyboard/schema.js` | Schema, normalizador, validação, catálogos (poses, expressões, luzes) | engine (catálogos) |
| `src/storyboard/planner.js` | Roteiro → cenas por regras (cenário, personagem, pose, legenda, duração) | schema |
| `src/engine/pen.js` | Biblioteca 2D: contorno de tinta, blobs, gradientes, curvas, texto | — |
| `src/engine/cast.js` | Personagens (9), rostos (15 expressões), props, efeitos (dust, sparkle, glow, zzz, flame) | pen |
| `src/engine/paint.js` | Texturas pintadas em canvas (pedra, terra, grama, madeira, telha, metal) | — |
| `src/engine/world.js` | 7 cenários 3D paramétricos + câmera base e animação de mundo | three, paint |
| `src/engine/camera.js` | 10 movimentos de câmera determinísticos (push-in, pan, crane, reveal, orbit…) | — |
| `src/engine/renderer.js` | Palco: cartões 2D em cena 3D, luzes, névoa, passe de tinta, legendas | three, todos os anteriores |
| `src/app/player.js` | Relógio, play/pause, passo de quadro, captura RGBA, WebM | renderer |
| `src/app/timeline.js` | Timeline em canvas (cenas, atores, câmera, waveform, legendas) | — |
| `src/app/inspector.js` | Painel de propriedades sem código | schema |
| `src/app/store.js` | IndexedDB, export/import JSON e `.b7zip`, download | fflate |
| `src/app/audio.js` | Decodificação, waveform, reprodução, ducking, destino alternativo | Web Audio |
| `local-renderer/render.mjs` | Chromium headless → frames RGBA → FFmpeg | playwright, fflate |
| `local-renderer/encode.mjs` | PNGs + áudio → MP4 + QA com ffprobe | ffmpeg |
| `tests/run.mjs` | 21 testes (unidade + fumaça de render) | vite, playwright |

## 3. Modelo de dados

```json
{
  "schema": "b7studio/project@1",
  "title": "Derinkuyu: a cidade atras da parede",
  "script": "Em 1963, um homem quebrou uma parede...",
  "fps": 30,
  "resolution": { "w": 1080, "h": 1920 },
  "style": "equilibrado",
  "captionsEnabled": true,
  "voice": { "name": "narracao.mp3", "duration": 31.4, "mediaId": "m_..." },
  "music": null,
  "durationSec": 32,
  "scenes": [
    {
      "id": "s1",
      "set": "room",
      "setParams": { "w": 10, "d": 9, "h": 4.6, "wall": "stone", "hole": 0 },
      "light": "torch",
      "startSec": 0,
      "durationSec": 4.5,
      "camera": { "type": "push-in", "intensity": 0.6 },
      "actors": [
        { "id": "a1", "character": "explorer", "expression": "stern",
          "L": "hold", "R": "hammer", "prop": "hammer",
          "x": 0.7, "z": -1.6, "scale": 1, "flip": false, "look": 0.3 }
      ],
      "caption": { "text": "ELE QUEBROU A PAREDE", "y": 0.78, "style": "impact" },
      "fx": [{ "type": "dust", "x": 0.55, "y": 1.45, "z": -4.3, "scale": 0.45, "start": 0.3, "duration": 1.2 }],
      "sfx": ["martelo"]
    }
  ]
}
```

Regras aplicadas por `normalizeProject()`:

- `startSec` é **sempre recalculado** a partir das durações (a linha do tempo é contínua; não há sobreposição nem buraco).
- Campos fora dos catálogos caem para o padrão (`set: room`, `camera: static`, `character: explorer`).
- Números são limitados (duração 0,4–60 s; posição ±40 m; escala 0,3–3; intensidade 0–1).
- Legendas são limitadas a 90 caracteres e renderizadas como texto de canvas — **nunca** como HTML.

`validateProject()` devolve `{ ok, errors[], warnings[], durationSec }` em português. Erros impedem o render; avisos (cena sem legenda, vídeo curto) apenas informam.

## 4. Caminho de render

### 4.1 Cartões 2D em cena 3D

Cada ator é um `PlaneGeometry` vertical com uma `CanvasTexture` de 1.200×2.000 px, desenhada sob demanda e **cacheada por chave** (`cena|personagem|expressão|braços|prop|flip|escala|olhar|frame`). O cartão sempre encara a câmera (`rotation.y = atan2(camX - x, camZ - z)`), garantindo leitura do rosto em qualquer ângulo — a mesma solução do kit.

Como o cartão é `MeshBasicMaterial`, ele não recebe sombra nem luz; a integração com o ambiente é feita por **tinta** (cor de multiplicação por paleta: quente em tocha, azulada à noite) e pela sombra de contato (plano radial no chão).

### 4.2 Duas passadas + composição

1. **Cor**: cena com `MeshToonMaterial`, luz hemisférica, sol direcional com sombra, ponto de preenchimento acompanhando a câmera e névoa.
2. **Normal + profundidade**: a mesma cena com um `ShaderMaterial` que grava `normal*0.5+0.5` em RGB e distância em A.
3. **Composição**: shader de tela cheia que detecta bordas por 12 amostras em disco (diferença de profundidade + variação de normal), pinta o contorno, aplica saturação, calor, vinheta e **converte linear → sRGB**.

> O passo 3 é onde estava o bug mais caro do projeto: sem a conversão explícita, todo o vídeo saía subexposto (valores lineares exibidos como se fossem sRGB). Foi identificado comparando um render direto (sem passe de tinta) com o composto.

### 4.3 Legendas

Canvas 2D separado, sobreposto ao WebGL no DOM. Fonte pesada, caixa alta, contorno grosso, largura máxima de 84% e quebra por palavra. Fica fora do passe 3D, então **nunca** perde nitidez. O `captureRGBA()` compõe os dois canvases antes de exportar.

### 4.4 Determinismo

`renderFrame(sec)` não consulta `Date.now()` nem `Math.random()`: variações usam senoides de `sec` e sementes derivadas do índice do ator. O mesmo segundo gera o mesmo quadro em qualquer máquina — requisito para o MP4 ser reproduzível.

## 5. Exportação

| Caminho | Como | Limite |
|---|---|---|
| **WebM** | `MediaRecorder` sobre `canvas.captureStream(30)`, áudio via `MediaStreamAudioDestinationNode`; grava em tempo real | Duração = tempo real; qualidade depende do navegador; sem MP4 |
| **MP4 local** | Chromium headless renderiza, captura RGBA e envia por streaming para o FFmpeg (x264, CRF 18, yuv420p, faststart) | Requer Node + Playwright + FFmpeg |
| **Sequência PNG** | `--out pasta` grava quadros para inspeção/edição externa | Lento (encode PNG) |
| **Stills** | `--times 1,6.5,21` grava quadros-chave | — |

O renderizador local valida o caminho dos arquivos servidos (`file.startsWith(dist)`) e não escreve nada fora da pasta de saída.

## 6. Desempenho

Medido no pior caso (Linux, sem GPU, SwiftShader):

| Etapa | 540×960 | 1080×1920 |
|---|---|---|
| `renderFrame` | 17 ms | ~60 ms |
| captura RGBA + base64 | ~100 ms | ~400 ms |
| pipeline completo | ~0,4 s/quadro | ~1,4 s/quadro |

Decisões que vieram dessas medições:

- **Não usar `toDataURL('image/png')` no loop**: 0,9 s por quadro só de encode. A captura virou RGBA cru.
- **Prévia em 540×960 por padrão** (360/540/720 selecionáveis).
- **Cartões cacheados por chave**: sem isso, cada quadro redesenharia 8 personagens em 1.200×2.000.
- **Mundo cacheado por `set + parâmetros`**, com descarte ao passar de 10 cenários.
- **Sombras com mapa 1.024** e apenas no passe de cor.

## 7. Segurança e privacidade

- Nenhuma chamada de rede em tempo de execução (fontes do sistema, nenhum CDN).
- Projetos e áudios ficam em IndexedDB; exportar é ação explícita do usuário.
- Texto do usuário nunca é injetado como HTML: legendas são desenhadas em canvas; a UI usa `textContent`/escape.
- Importação lê apenas `project.json` e `media/*`; nomes de arquivo são rótulos, não caminhos.
- Sem `eval`, sem execução de código vindo do projeto.
- O renderizador local escuta apenas em `127.0.0.1` e valida o caminho antes de servir.

## 8. Testes

`npm test` sobe o Vite, abre o Chromium e executa 21 verificações:

- **Unidade (14):** normalização, limites, validação (projeto válido e inválido), planejador (quantidade, cenários, legendas, duração, continuidade, roteiro vazio, reconhecimento de piscina/telefone), `sceneIndexAt`, pacote `.b7zip` (ida e volta com mídia).
- **Fumaça de render (7):** duração do piloto, quadro não preto, presença de áreas claras, seis cenas distintas, legenda desenhada na área segura, piloto com 7 cenas, zero erros de console.

A escolha de rodar unidade **no navegador** é deliberada: os módulos importam Three.js e usam canvas, então um runner Node puro precisaria de mocks que testariam o mock, não o código.

## 9. Decisões registradas (ADR resumido)

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Reconstruir `Pen`/`cast` em vez de baixar `toon.ts` | Rodar `setup.sh` | Dependência externa não versionada, Bash, sem licença clara no pacote; e o plano proíbe executar script sem auditoria |
| JSON próprio versionado | Usar o exemplo da seção 5 do plano | O exemplo não cobre atores múltiplos, expressões, props e FX |
| Planejador por regras | "IA" de roteiro | Regra 5 do plano: sem falsa IA; e o custo seria API paga |
| RGBA cru para o FFmpeg | PNG por quadro | 9× mais rápido no pior caso |
| WebM no navegador + MP4 local | Só MP4 local | O plano pede os dois caminhos e o WebM serve para revisão rápida |
| Legendas em canvas 2D | Texto no DOM | Nitidez e composição garantidas na exportação |
