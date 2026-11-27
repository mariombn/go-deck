# Rise Mode Vision 2

O Go Deck controla as 15 teclas e telas do Rise Mode Vision 2 via USB. O modelo
suportado usa o identificador `0a00:1002` e a interface HID `00`.

## Conectar

1. Feche o OpenDeck, o software da Rise Mode e outros controladores do aparelho.
2. Conecte o Vision 2 à USB e abra o Go Deck. No Linux, siga as instruções de
   [permissões USB](linux.md#permissões-uma-vez). Se o macOS pedir para permitir
   a conexão do acessório, autorize o Vision 2.
3. No painel **Rise Mode Vision 2**, ative **Controlar USB** e confira o estado
   **Conectado**. Salve a configuração para enviar os botões e as imagens.

No Windows e macOS, o Go Deck acessa o driver HID do sistema via HIDAPI, que
é compilado junto com o app. No Linux, o app acessa `hidraw`. Desmarque
**Controlar USB** ou feche o Go Deck antes de abrir outro controlador.

Os LCDs exibem as primeiras 3 linhas × 5 colunas da página selecionada, com
rótulo, cor, emoji ou imagem. A página inicial é a primeira página salva.
Use uma ação **Navegar** para trocar de página pelo próprio aparelho, ou use
os controles do painel. O celular tem sua própria página ativa. O brilho
inicial é 80% e as configurações de brilho e de controle USB não são persistidas.

## Testar com o hardware

1. Crie e salve botões com rótulo, cor, emoji e imagem. Confira a orientação
   dos quatro cantos do grid e dos LCDs.
2. Configure uma ação fácil de observar e confirme que cada toque executa
   uma vez. No macOS, ações de teclado e mouse exigem permissão de
   **Acessibilidade**. Uma ação de abrir URL também permite testar o toque.
3. Crie outra página, teste a navegação no aparelho e confira que a página
   ativa no celular permanece independente.
4. Desconecte e reconecte o USB. Confira a recuperação das telas e das teclas.
   Desative e reative **Controlar USB** e repita a verificação.

### Diagnóstico para builds locais

O teste opcional abaixo inicializa a interface USB e grava uma imagem de
teste nos 15 LCDs. Execute com o Go Deck e os outros controladores fechados.

Linux ou macOS:

```bash
DECKPILOT_TEST_VISION2=1 go test -v ./internal/vision2 -run '^TestVision2HardwareSmoke$'
```

Windows (PowerShell, com MinGW-w64 no `PATH`):

```powershell
$env:CGO_ENABLED = '1'
$env:DECKPILOT_TEST_VISION2 = '1'
go test -v ./internal/vision2 -run '^TestVision2HardwareSmoke$'
Remove-Item Env:DECKPILOT_TEST_VISION2
```

O protocolo usa reports HID de saída com 1024 bytes, além do byte de ID na
API, e JPEGs de 112 × 112 pixels. O app mantém a conexão com o aparelho e
reconecta quando ele volta a aparecer. A [origem do protocolo](linux.md#origem-do-protocolo)
está documentada no guia de Linux.
