# Análise completa do sistema e adaptação à referência visual

## 1. Leitura da referência

A imagem enviada não é apenas um desenho de personagem. Ela combina cinco camadas que precisam ser reproduzidas juntas:

1. **Personagem 2D/3D híbrido:** cabeça circular/bean, corpo simples, contorno escuro, olhos expressivos, óculos escuros e roupa amarela de alto contraste.
2. **Diorama 3D vertical:** piscina em primeiro plano, casa clara ao fundo, escada, piso, cercas e objetos reconhecíveis.
3. **Noite azul + luz prática quente:** fundo em azul-marinho quase preto, lâmpadas amarelas penduradas, janelas e porta emitindo calor.
4. **Objeto narrativo simples:** patinho amarelo com escala grande o bastante para funcionar como segundo personagem.
5. **Atuação mínima, mas legível:** telefone junto ao rosto, braço livre, leve flutuação, reflexo/água e uma pose congelada por beat.

A meta correta não é copiar pixels ou personagens. É transportar a **gramática visual**: personagem simples e grande, fundo mais detalhado, contraste frio/quente, props grandes e microanimações contínuas.

## 2. Diagnóstico do B7 antes da mudança

### O que já estava bem resolvido

- Projeto declarativo em JSON; o roteiro não executa código.
- `normalizeProject()` retima a linha do tempo e aplica limites.
- Cartões 2D cacheados, voltados para a câmera, com 15 expressões e 11 poses.
- Mundo 3D paramétrico com seis cenários, texturas pintadas e luzes toon.
- Câmera determinística, render no preview e no Playwright usando o mesmo `renderFrame()`.
- Captura RGBA crua para FFmpeg, evitando o gargalo do PNG por quadro.
- Exportação JSON/`.b7zip`, IndexedDB, waveform e suporte a voz/música.
- Testes de unidade e fumaça no Chromium.

### O que impedia a aproximação

- Não existia cenário aberto de lifestyle com piscina, casa e lâmpadas penduradas.
- A luz `night` era genérica; não havia receita azul/âmbar específica.
- Não havia água, reflexo, flutuação de props ou luzes pulsando.
- O catálogo não tinha telefone, patinho, pose de telefone nem personagem com óculos escuros.
- A animação era majoritariamente câmera + piscar: não havia callback de animação do mundo.
- O planejador não reconhecia palavras como piscina, telefone, boia ou patinho.
- Não havia preset de teste visual dedicado à nova linguagem.

## 3. O que foi implementado

### 3.1 Cenário `pool`

Novo construtor em `src/engine/world.js` com:

- piscina em primeiro plano com material azul brilhante;
- bordas claras e escada;
- casa clara, porta, janelas quentes e telhado;
- cordão diagonal de lâmpadas com cabos e luzes pontuais;
- patinho amarelo 3D com bico e olhos;
- callback `userData.animate(sec)` para água, patinho e pulsação sutil das lâmpadas;
- câmera vertical mais próxima do assunto.

### 3.2 Personagem e atuação

- Novo figurino `poolhost`: camisa amarela, calça azul, cabelo claro e óculos escuros.
- Nova pose `phone` e prop `phone`.
- O render aplica microinclinação e flutuação ao ator quando a cena usa `pool`.
- O patinho permanece separado do cartão do personagem, criando leitura de escala e profundidade.

### 3.3 Luz e composição

- Nova paleta `pool-night`: azul-marinho, ambiente azulado, luz âmbar e saturação maior.
- Luz de preenchimento específica para manter o rosto e a roupa legíveis sem apagar a noite.
- A referência foi tratada como sistema de contraste, não como um simples filtro escuro.

### 3.4 Planejador

O planejador agora converte frases contendo `piscina`, `boia`, `patinho`, `telefone`, `celular`, `ligação` ou `verão` em cenário `pool-night`, personagem `poolhost`, pose `phone` e prop `phone` quando aplicável.

### 3.5 Preset de demonstração

`public/presets/piscina-noturna.b7.json` contém três beats: atender o telefone, revelar o patinho e reagir à situação. É um teste de direção de arte e animação, não uma cópia de roteiro ou personagem de terceiros.

## 4. Fluxo completo auditado

```text
roteiro PT-BR
  -> planner.js (regras de cenário, personagem, pose e legenda)
  -> schema.js (normalização, limites e validação)
  -> main.js (estado e eventos)
  -> inspector/timeline (edição)
  -> player.js (relógio, preview, WebM e captureRGBA)
  -> renderer.js
       -> world.js (diorama 3D + animate(sec))
       -> cast.js (cartão 2D + piscar + microatuação)
       -> camera.js (movimento determinístico)
       -> pós-processamento (contorno, saturação, exposição, sRGB)
  -> local-renderer/render.mjs
  -> FFmpeg H.264/yuv420p
```

### Contratos importantes

- **Tempo:** `sceneProgress()` e `renderFrame(sec)` são a fonte de verdade; animações novas usam `sec`, nunca `Date.now()`.
- **Segurança:** dados continuam JSON validado; nenhum preset executa JavaScript.
- **Performance:** mundo permanece cacheado por cenário/parâmetros; cartões continuam cacheados por chave.
- **Compatibilidade:** o preset novo usa as mesmas rotas de preview, WebM e MP4 do piloto histórico.

## 5. Validação

- Build Vite: aprovado.
- Suíte anterior: 20/20 aprovado.
- Novo teste do planejador de referência: aprovado.
- Total atual: **21/21 testes aprovados**.
- Render de prova do preset piscina: aprovado em quatro quadros-chave.

A prova visual já mostra: noite azul, casa, lâmpadas suspensas, personagem amarelo com telefone, água e patinho. Ainda é uma aproximação procedural low-poly — não uma réplica de acabamento de animação gerada por IA.

## 6. Distância restante para a referência

### Próxima camada recomendada

1. **Reflexos reais ou fake pass:** duplicar silhueta do ator e do patinho sob a linha d'água com alpha decrescente e distorção senoidal.
2. **Bloom leve das lâmpadas:** passe de brilho separado para os bulbs e composição aditiva.
3. **Boca sincronizada por palavras:** pelo menos três estados de boca alternados por amplitude/ritmo da narração.
4. **Biblioteca de poses de atuação:** telefone, olhar para o objeto, susto, apontar e reação, com duração por beat.
5. **Som:** toque de telefone, splash, ambiente noturno e música baixa; hoje `sfx` ainda são marcadores.
6. **Render de referência com áudio:** gerar um vídeo de 12–15 s do preset piscina com narração e SFX reais.

## 7. Conclusão

O sistema deixou de ser apenas um editor de shorts subterrâneos e passou a ter uma rota de estilo reutilizável para cenas de comédia/lifestyle noturnas. A aproximação foi feita no nível certo: composição, paleta, escala, props, microanimação e regras de produção — preservando a arquitetura offline, determinística e testável.
