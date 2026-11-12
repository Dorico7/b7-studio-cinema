# Dependências e licenças

## Código próprio

- `src/**`, `local-renderer/**`, `tests/**`, `docs/**`: **MIT** (ver `LICENSE`).
- Personagens, cenários e o piloto Derinkuyu são desenhos originais gerados por código neste repositório. Nenhum quadro, personagem ou título de terceiros foi copiado.

## Dependências de execução

| Pacote | Versão | Licença | Uso |
|---|---|---|---|
| `three` | 0.160.1 | MIT | motor 3D |
| `fflate` | ^0.8.2 | MIT | leitura/escrita do pacote `.b7zip` |
| `vite` | ^5.4.11 | MIT | dev server e build |
| `playwright` | ^1.49.0 | Apache-2.0 | Chromium headless no renderizador local |
| `pngjs` | ^7.0.0 | MIT | PNGs de inspeção e testes |

Ferramentas externas: **FFmpeg** (LGPL/GPL conforme build) e **Chromium** (BSD). Nenhuma é redistribuída neste repositório; são instaladas pelo usuário.

## Referências de técnica (não redistribuídas)

- **`cartoon-short-kit`** (`mromidev/claude-animated-shorts`, MIT) — usado como referência de abordagem: "cartões 2D em cena 3D", regras de legibilidade (cabeça grande, contorno de tinta, paleta chapada) e o conceito de plano por câmera fixa.
  A biblioteca `toon.ts` **não estava no ZIP** e não foi baixada. A camada 2D foi reescrita do zero em `src/engine/pen.js` (primitivas de desenho, contorno, gradientes, texto) e `src/engine/cast.js` (personagens, rostos, objetos, efeitos). Nenhuma linha de código do kit foi copiada para esses arquivos.
- **Ricks Clips** — analisado apenas como **objeto de estudo de formato** (estrutura de 60 s, ritmo de corte, tipologia de títulos). Nenhum ativo visual, personagem, roteiro ou título foi reutilizado.

## Fontes

O app não carrega fontes externas (sem Google Fonts, sem CDN). As legendas usam a pilha do sistema:

```
Inter, "Arial Black", Arial, sans-serif
```

Isso garante funcionamento offline e elimina dependência de licença de fonte, com a contrapartida de a legenda variar levemente entre sistemas operacionais.

## Áudio

Nenhum áudio é distribuído com o projeto. A narração e a música são importadas pelo usuário e permanecem no navegador (IndexedDB) ou dentro do `.b7zip` exportado. A responsabilidade de licenciamento do áudio é de quem importa.
