# Atualização de escala — 5 de outubro de 2026

Branch: `codex/assets-tab-scale`, criada a partir de `origin/claude/jolly-mccarthy-yvahse`.
O pacote solicitado tem 320 imagens/tiras. Foram instaladas 145, além da fonte
Cinzel com licença OFL e das cores da interface. **A atualização está incompleta.**

| Grupo | Instalados | Solicitados |
|---|---:|---:|
| Construções | 48 | 48 |
| Ninhos | 0 | 3 |
| Unidades, incluindo animações | 9 | 21 |
| Infectados, incluindo animações | 5 | 33 |
| Props de terreno | 37 | 126 |
| Grama e lama | 29 | 48 |
| Interface | 17 | 41 |

As 17 peças de interface compreendem as 15 molduras/botões, o fundo do menu e o
logo. Os 24 ícones continuam pendentes. Ranger e Soldier têm pose parada e tiras
novas de andar/atacar; as outras 32 tiras ainda precisam ser geradas.

## Bloqueio real

A ferramenta nativa `image_gen` retornou HTTP 429 `usage_limit_reached`.
A liberação indicada pela ferramenta foi **6 de outubro de 2026, 09:09:11**,
horário de São Paulo. Nenhuma alternativa paga via API foi acionada.
Todas as chamadas em andamento foram encerradas e seus resultados disponíveis
instalados; não há geração em segundo plano nesta entrega.

## Validação feita

- `python3 tools/verify-art.py`: passou para todos os arquivos ativos no manifest.
  Verifica dimensões, alpha, hashes, base inferior de prédios/props e enquadramento
  dos personagens novos.
- Nos quadros novos de Ranger e Soldier, os centros dos pés ficam entre 49,86%
  e 50,21% da largura, com base a 90% da altura. Os 32 estados pendentes ainda
  precisam passar pela mesma conferência.
- `npm test`: 19 testes passaram, incluindo os contratos do novo pacote.
- `git diff --check`: passou.
- Chrome: menu e jogo em 1440×900 e 390×844, sem erros JavaScript, respostas HTTP
  com erro ou overflow horizontal. Textos dos botões legíveis nas capturas.
- Cena controlada: zoom de 48 e 25 pixels por célula, floresta e rochedos densos,
  prédios, muros e 70 infectados. Os props de FA formam massas contínuas.

Capturas: [menu desktop](qa-desktop-menu.png), [jogo desktop](qa-desktop-game.png),
[menu mobile](qa-mobile-menu.png), [jogo mobile](qa-mobile-game.png),
[zoom próximo](qa-fixture-near.png), [zoom afastado](qa-fixture-far.png).

## Retomada

1. Execute `node tools/art-update-status.mjs` para obter as 175 chaves pendentes.
   `art/update-pending.json` guarda a lista desta entrega; `art/update-jobs.json`
   guarda todos os prompts/dimensões solicitados.
2. Corrija primeiro `unit/sniper`, `unit/mutant` e `infected/fresh` usando as imagens
   preservadas em `art/rework/`. As poses rejeitadas comprimem o corpo abaixo de
   68% do quadro. Use rifle diagonal para baixo, cotovelos dobrados e pés próximos.
   Os três sprites anteriores permanecem ativos até a correção.
3. Gere as tiras usando a imagem parada nova como referência, uma chamada nativa
   por tira. Mantenha raiz, identidade e escala; andar: 6 quadros/10 fps;
   atacar: 4 quadros/12 fps. O instalador guarda o hash da pose de referência.
4. Complete props, texturas, ícones e ninhos. Para variantes de chão, use o arquivo
   `*_0` novo como referência, preservando tom médio e bordas. FA e BR já têm
   quatro variantes novas de grama e lama; os demais mapas ainda misturam arte
   antiga e nova. A liberação dos mapas restantes exige nova inspeção de emendas.
5. Refine os muros: as bordas horizontais se encontram, mas as fileiras verticais
   ainda mostram painéis frontais repetidos. A câmera precisa mostrar mais o topo
   de um bloco quadrado para atender à emenda visual nos quatro lados.
6. Instale com `node tools/install-art.mjs <chave> <original.png>`. Quando o prompt
   real diferir do registro, grave-o em arquivo e use `ART_PROMPT_FILE=<arquivo>`.
7. Rode o verificador, testes e `node tools/art-update-status.mjs --require-complete`.
   Revise pés entre todos os estados, seis biomas, muros em ambos os eixos,
   nine-slice e multidões no desktop e celular antes de declarar o pacote completo.

As 16 tiras antigas incompatíveis com poses novas foram retiradas do manifest e
listadas em `art/deferred-legacy-strips.json`. Seus arquivos continuam disponíveis;
o jogo usa temporariamente a pose nova enquanto suas tiras não chegam.
Os prompts realmente enviados, originais e hashes estão em `art/generated.json`.
A arte foi criada pela ferramenta nativa; os prints fornecidos orientaram escala
e composição. Não houve alteração do código de execução do jogo, commit ou push.
