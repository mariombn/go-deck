# Editor, teclado e mouse

## Seletores escuros no Linux

Os seletores de tipo de ação, destino, página no hardware, OBS/Discord, idioma e
IP usam um popup próprio, não o menu nativo do WebKitGTK. Assim, o tema claro do
GTK não produz texto branco sobre fundo branco. O menu suporta setas, Home/End,
busca digitando o início da opção, Enter para confirmar e Escape para cancelar.

## Teclado virtual e sequências

Ao lado de **Capturar**, o botão com ícone de teclado abre o teclado virtual.
Nada é enviado ao sistema enquanto você edita.

- **Combinação (atalho):** selecione as teclas do combo, por exemplo Ctrl + C,
  e clique em **Aplicar teclas**. Clicar novamente numa tecla a desmarca.
- **Sequência em ordem:** monte um combo e clique em **Adicionar combinação à
  sequência**. Repita para os próximos passos, por exemplo Ctrl+C → Tab →
  Ctrl+V. As setas mudam a ordem e o X remove um passo. A combinação atual, se
  não estiver vazia, também é incluída ao aplicar.
- Repetir uma tecla é possível adicionando-a em passos separados: A → A → B.
- São permitidas até 64 combinações por sequência de teclado. As teclas são
  soltas entre combinações; a execução para no primeiro erro.
- **Segurar por** vale para cada combinação; 0 é toque rápido, máximo 5 s.
- **Capturar** continua substituindo o conteúdo por um combo capturado pelo
  teclado físico. O editor do Discord aceita combos, não sequências.
- A pontuação no teclado virtual representa posições físicas; o layout ativo
  (ABNT2, ANSI etc.) define os caracteres produzidos. `cmd`/`opt` continuam
  exclusivos do macOS e `win` equivale a Command nele.

As configurações antigas com `keys` continuam funcionando. A nova sequência é
persistida em `keySequence`, sem um `keys` separado:

```json
{"type":"keypress","keySequence":[["ctrl","c"],["tab"],["ctrl","v"]]}
```

Para misturar teclado, mouse, programas e OBS, use o tipo de ação **Sequência**
e escolha o tipo de cada passo. Isso é diferente da sequência de combinações
editada dentro de **Atalho de teclas**.

## Rótulo oculto e prévia

**Ocultar rótulo no botão** mantém o nome salvo para organização e edição,
mas não desenha o texto no celular, no preview do editor ou nos LCDs do Vision 2.
O nome continua acessível a leitores de tela e no tooltip do grid desktop.
Botões com ícone e rótulo oculto aproveitam mais espaço para a imagem/emoji.
Sem ícone nem rótulo visível, a célula fica visualmente vazia.

A prévia tem tamanho fixo e rótulos longos quebram em até duas linhas, sem
expandir a coluna do editor. O LCD mantém seu próprio limite de linhas.

## Arrastar botões

No grid desktop, arraste um botão até outra posição:

- destino vazio: move o botão;
- destino ocupado: troca as posições dos dois botões;
- preserva ID, ação, rótulo e aparência;
- também funciona no preview em retrato, preservando as coordenadas canônicas;
- aplica-se à página atual; o celular não permite reorganização.

O arraste modifica o rascunho. Clique em **Salvar configuração** para persistir
e atualizar celular/hardware. Novos botões ainda sem ID também podem ser movidos.

## Ações de mouse

O tipo **Mouse** está disponível no botão ou como passo de uma sequência:

- **Clique:** esquerdo, direito, central e laterais voltar/avançar; pode segurar
  por até 5 s, sempre soltando ao final.
- **Clique duplo:** dois cliques, sem retenção.
- **Mover ponteiro:** deslocamento relativo; X positivo vai à direita, Y positivo
  para baixo; intervalo de -10000 a 10000 por eixo.
- **Rolar:** passos de roda; X positivo vai à direita, Y positivo para cima;
  intervalo de -100 a 100 por eixo.

Mover/rolar exige pelo menos um eixo não zero. Não há coordenadas absolutas nem
botões DOWN/UP avulsos que poderiam ficar presos entre ações. Os cliques usam a
posição atual do ponteiro; aceleração/configurações do SO podem alterar a
trajetória/distância percebida.

Implementações: Linux via mouse virtual `uinput` separado do teclado (Wayland e
X11), Windows via `SendInput`, macOS via `CGEvent`. Linux usa a mesma regra udev
de `/dev/uinput` documentada em [linux.md](linux.md); macOS exige Acessibilidade.
O encerramento destrói os dispositivos virtuais. Os testes normais usam pipes e
mocks: não movem o ponteiro, clicam nem digitam no computador real.

Exemplos de configuração:

```json
{"type":"mouse","mouseOp":"click","mouseButton":"right"}
{"type":"mouse","mouseOp":"move","mouseX":100,"mouseY":-20}
{"type":"mouse","mouseOp":"scroll","mouseY":-3}
```
