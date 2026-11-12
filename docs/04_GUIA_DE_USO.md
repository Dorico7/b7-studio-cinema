# Guia de uso — B7 Studio Cinema

Este guia cobre o fluxo completo: do roteiro ao MP4 vertical. Não é preciso escrever código.

## 1. Abrir o estúdio

**Opção A — no seu PC (recomendado para editar):**

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:5173`.

**Opção B — no GitHub Pages:** a versão publicada abre direto no navegador. A prévia funciona; a exportação MP4 continua sendo feita no PC (o Pages é estático).

Requisitos: Node 18+ e um navegador atualizado (Chrome/Edge). Para MP4: FFmpeg instalado e no PATH.

## 2. Escrever o roteiro

No painel esquerdo, cole o texto em português. Exemplo:

> Em 1963, um homem quebrou uma parede do porão da própria casa e encontrou uma passagem escura. Ele cavou e descobriu corredores que levavam a dezoito níveis abaixo da terra. Era Derinkuyu, uma cidade subterrânea inteira, com depósitos, capelas e túneis de ventilação. Cerca de vinte mil pessoas podiam viver ali, protegidas de invasores. Durante séculos, a cidade existiu embaixo dos pés de quem caminhava na superfície.

Regras práticas:

- **Uma ideia por frase.** O planejador transforma frase em cena.
- Frases de 8 a 20 palavras funcionam melhor; frases muito longas são divididas automaticamente.
- Use palavras concretas ("parede", "túnel", "cavou", "encontrou") — elas escolhem cenário e pose.

## 3. Planejar cenas

Escolha o número máximo de cenas (5 a 10) e clique em **Planejar cenas**.

O planejador é **automação por regras**, não IA generativa. Ele:

- escolhe o cenário por palavras-chave (caverna, túnel, rocha, parede, vila…);
- escolhe personagem (criança, ancião, operário, cientista, guarda…);
- escolhe pose/objeto (martelo, tocha, apontar…);
- gera uma legenda curta (2 a 5 palavras) a partir da frase;
- estima a duração por palavras (≈2,6 palavras/s) e, se houver narração importada, ajusta a soma das cenas para caber no áudio.

**Sempre revise.** O planejador não entende semântica: ele reconhece padrões.

## 4. Editar a cena

Clique numa cena (lista à esquerda ou timeline) e use o painel direito:

| Campo | O que faz |
|---|---|
| Cenário | Troca o set 3D (sala, túnel, caverna, rocha, corte do subsolo, superfície) |
| Luz | Dia, fim de tarde, tocha, caverna, noite, neblina |
| Duração | Tempo da cena em segundos (0,4 a 60) |
| Movimento de câmera | Estático, push-in, pull-back, pan, tilt, crane, orbit, reveal |
| Intensidade | Quanto o movimento avança |
| Atores | Personagem, expressão, braços (pose), objeto, posição X/Z, escala, espelhar, olhar |
| Legenda | Texto, estilo e altura |
| Efeitos | Poeira, brilho, faíscas, "zzz", chama — com início, duração e escala |
| Cena | Duplicar / excluir |

Atalhos: **Espaço** reproduz, **←/→** anda um quadro, **Home/End** vai ao início/fim.

## 5. Áudio

No painel direito, em **Áudio**:

- **Importar voz** (MP3/WAV): a waveform aparece na timeline e a duração é usada para ajustar o planejamento.
- **Importar música**: entra com volume reduzido e ducking sob a voz.

O áudio não sai do seu computador: fica no IndexedDB do navegador e, ao exportar o pacote, viaja dentro do `.b7zip`.

> Ainda não há geração de voz (TTS) nem alinhamento palavra a palavra. Grave a narração ou use a ferramenta de sua preferência e importe o arquivo.

## 6. Salvar e abrir

- **Salvar** grava no navegador (IndexedDB). O projeto é recarregado automaticamente ao abrir o app.
- **Arquivo → Exportar JSON** gera um `.json` só com o projeto (sem áudio).
- **Renderizar MP4 → Baixar pacote (.b7zip)** gera um zip com `project.json` + `media/`.
- **Abrir** aceita `.json` ou `.b7zip`.

## 7. Exportar

### 7.1 WebM (rápido, para revisão)

Botão **Exportar WebM**. Grava em tempo real (32 s de vídeo = ~32 s de gravação), com áudio, no formato suportado pelo navegador (VP9/VP8 + Opus). Serve para revisar no celular, não para publicar em melhor qualidade.

### 7.2 MP4 1080×1920 (final)

1. Clique em **Renderizar MP4** e baixe o pacote `.b7zip`.
2. No PC, na pasta do projeto:

```bash
npm install
npx playwright install chromium
npm run render -- caminho/para/pacote.b7zip --video out/video.mp4
```

3. Se preferir gerar quadros e codificar depois:

```bash
npm run render:frames -- pacote.b7zip --out out/quadros
npm run render:encode -- out/quadros out/video.mp4 --audio narracao.mp3
```

O `encode` roda o QA automaticamente: duração, proporção vertical, H.264, AAC, fps e trechos pretos. O relatório fica em `qa-report.json`.

### 7.3 Ajustes de render

```bash
# prévia rápida em 540x960
npm run render -- pacote.b7zip --video out/teste.mp4 --width 540 --height 960

# só alguns segundos
npm run render -- pacote.b7zip --video out/trecho.mp4 --range 0-149

# quadros-chave para inspeção
npm run render -- pacote.b7zip --times 1,6.5,21,30 --out out/stills
```

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Tela preta no palco | WebGL indisponível ou driver antigo | Atualize o navegador; teste em Chrome/Edge; evite modo de economia de energia |
| "Falha ao renderizar a cena" | Cena inválida (normalmente importada) | Abra o JSON, confira `set` e `camera`; o validador aponta a cena |
| WebM não grava | Navegador sem MediaRecorder/VP9 | Use Chrome/Edge atualizado; ou gere o MP4 local |
| MP4 sem áudio | Narração não estava no pacote | Importe a voz antes de gerar o pacote; confira `media/voice.*` dentro do zip |
| Render muito lento | Sem GPU / muitos efeitos | Use 540×960 para testar; feche outros programas; veja `docs/05_QA_E_LIMITACOES.md` |
| Projeto sumiu | Cache/IndexedDB limpo | Restaure o `.b7zip` exportado (exporte sempre antes de limpar o navegador) |

## 9. Publicar no GitHub Pages

1. Crie o repositório e envie o código.
2. Em **Settings → Pages**, escolha **GitHub Actions**.
3. O workflow `.github/workflows/deploy.yml` faz `npm ci`, `npm run build` e publica `dist/`.
4. O `vite.config.js` usa `base: './'`, então funciona tanto na raiz quanto em subpasta.

Lembre: o Pages **não** renderiza MP4. Ele entrega o editor e a prévia; o vídeo final sai do seu PC.
