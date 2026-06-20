# go-deck

Um *Stream Deck* open-source: um app desktop (**Windows e macOS**) que expõe
**vários grids** de botões na rede local. Pelo celular, via QR Code, você abre
os grids no navegador e, ao tocar num botão, o computador executa a ação
configurada — desde uma **macro de teclado** até abrir um programa, uma URL,
controlar o **OBS Studio** ou mutar o **Discord**.

Inspirado no [OpenDeck](https://github.com/nekename/OpenDeck). Construído com
**Go + Wails v2 + React/TypeScript + Tailwind**.

## Como funciona

```
Toque no celular ──ws──► servidor Go ──► executa a Action:
                                          • keypress  (SendInput/Win32 ou CGEvent/macOS)
                                          • launch / url (os/exec, sem shell)
                                          • obs       (obs-websocket v5)
                                          • discord   (keybind global)
                                          • sequence  (várias em ordem)
                            └─ navigate é resolvido no próprio celular (troca de grid)
```

- **Desktop (Wails):** editor de configuração + QR Code. Webview NÃO exposto na rede.
- **Servidor de rede (net/http + gorilla/websocket):** processo separado, no mesmo
  binário, serve o app React ao celular e recebe os toques via WebSocket.
- **Camadas isoladas por interface:** `InputController` (teclado — Windows via
  `SendInput` em Go puro, macOS via `CGEvent` com CGO), `Launcher` (abre
  programas/URLs — Windows usa `rundll32`, macOS usa `open`) e `obs.Controller`
  (OBS via obs-websocket, plataforma-agnóstico). As ações recebem um `ExecContext`
  com essas capacidades, então adicionar uma nova = um campo a mais, sem refatorar
  o resto.
- **Um único bundle React:** detecta em runtime se está no Wails (mostra o editor) ou
  no navegador do celular (mostra só os grids).

## Pré-requisitos

- **Go 1.21+**
- **Node.js LTS**
- **Wails CLI v2:** `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Windows:** WebView2 runtime (já vem no Windows 11); sem CGO (teclado via `SendInput` em Go puro)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`); CGO é necessário para a simulação de teclado via `CGEvent`

## Rodar em desenvolvimento

```bash
wails dev
```

Abre a janela desktop com hot-reload. Em dev, o servidor de rede faz reverse-proxy
para o Vite (porta 5173), então o celular recebe a mesma versão. O endereço de acesso
do celular aparece no QR Code da própria UI.

## Build de produção

```bash
wails build
```

Gera o app com o React embutido:
- **Windows:** `build/bin/go-deck.exe`
- **macOS:** `build/bin/go-deck.app`

## Uso

1. Abra o `go-deck.exe` (ou `wails dev`).
2. Crie/renomeie **grids** nas abas laterais e defina o tamanho (linhas × colunas)
   de cada um. Clique numa célula para criar um botão: rótulo, **tipo de ação** e
   **aparência** (emoji/imagem/cor). Clique em **Salvar configuração**.
3. No celular (mesma rede Wi-Fi), escaneie o QR Code.
4. Toque num botão → a ação é executada no PC (ou, se for *navigate*, troca de grid
   no próprio celular). O botão **Home** volta ao primeiro grid.

A configuração é salva em:
- **Windows:** `%APPDATA%/DeckPilot/config.json`
- **macOS:** `~/Library/Application Support/DeckPilot/config.json`

## Ações disponíveis

| Tipo | O que faz |
|------|-----------|
| **keypress** | Dispara um combo simultâneo de teclas (ver modelo abaixo). |
| **launch** | Abre um programa (`path` + `args`), via `os/exec` sem shell. |
| **url** | Abre uma URL no aplicativo padrão do SO. |
| **obs** | Controla o OBS: trocar cena, gravar/transmitir, mutar fonte, disparar hotkey. |
| **discord** | Mute/Deafen — na prática um *keypress* do keybind global do Discord. |
| **sequence** | Executa uma lista de ações em ordem (aborta no 1º erro). |
| **navigate** | Vai para outro grid — resolvido **no celular**, não toca o PC. |

### Integrações

- **OBS Studio:** habilite *Ferramentas → Configurações do Servidor WebSocket* no
  OBS, e preencha host/porta/senha no painel lateral do editor (com **Testar
  conexão**). A conexão é feita por toque (sem estado), via obs-websocket v5.
- **Discord:** não há API local para controlar o próprio cliente. Configure o
  atalho desejado como **keybind global** no Discord e capture a mesma tecla no
  go-deck. Por isso só *mute/deafen* (push-to-talk é "segurar", não casa com toque).

### Vários grids e navegação

Cada grid é uma página com tamanho e botões próprios. Um botão *navigate* leva a
outro grid (troca client-side, sem enviar nada ao PC); o celular tem um botão
**Home** fixo para voltar ao primeiro.

### Aparência dos botões

Cada botão pode ter cor de fundo (paleta ou cor livre; o texto ganha contraste
automático) e um ícone — **emoji** (seletor com busca) **ou imagem** (enviada e
redimensionada para 128 px, embutida na config como data URL).

## Modelo de teclas

- Modificadores: `ctrl`, `shift`, `alt`, `win` — mais `cmd`, `opt` (exclusivos macOS)
- Letras `a`–`z`, dígitos `0`–`9`, `f1`–`f12`
- Especiais: `enter`, `esc`, `tab`, `space`, `backspace`, `delete`, `insert`,
  `home`, `end`, `pageup`, `pagedown`, setas (`up`/`down`/`left`/`right`)
- Mídia: `mute`, `volup`, `voldown` — mais `playpause`, `nexttrack`, `prevtrack` (só Windows)
- Um botão = **um combo simultâneo** (ex.: `["ctrl","shift","m"]` ou `["cmd","c"]` no Mac).

## Limitações conhecidas (POC)

- **Sem autenticação/HTTPS:** qualquer dispositivo na LAN que abrir a URL pode
  acionar os botões **já configurados**. Há validação de `Origin` no WebSocket
  (higiene mínima) e um aviso na UI, mas não é seguro para redes não confiáveis.
  Com a ação **launch**, isso significa que a LAN pode disparar a abertura dos
  programas/URLs definidos no PC (o celular só envia o *id* do botão, nunca um
  `path`). A **senha do OBS** fica no `config.json` em **texto puro**.
- A **porta** é lida na inicialização. Mudá-la no editor exige reiniciar o app
  (porta ocupada gera erro explícito, sem fallback automático).
- `Ctrl+Alt+Del` e a tecla Win em combo não são capturáveis pelo navegador (o
  SO os intercepta); use os botões de teclas especiais para Win/mídia.
- **Linux** ainda não suportado (stubs retornam erro; input já isolado por interface).
- **macOS:** ações `keypress` exigem permissão de **Acessibilidade** (Configurações do Sistema → Privacidade e Segurança → Acessibilidade). Na primeira execução o app abre o painel automaticamente. Teclas de mídia `playpause`/`nexttrack`/`prevtrack` não são suportadas no macOS.
- O app macOS não é assinado/notarizado — para abrir pela primeira vez: clique direito → Abrir.

## Pegadinhas de implementação (Windows + Wails v2)

Duas armadilhas que custam horas de debug e já estão tratadas no código:

1. **`crossorigin` no `<script type="module">`** — o Vite adiciona esse atributo
   por padrão. Sob o esquema interno do Wails (`wails.localhost`), o WebView2
   pode bloquear o módulo como CORS (sem header `Access-Control-Allow-Origin`),
   resultando num **webview totalmente em branco** (só a cor de fundo). Removido
   via plugin no [vite.config.ts](frontend/vite.config.ts).
2. **Slice `nil` vira `null` no JSON** — em Go, `append([]T(nil))` com zero
   elementos retorna `nil`, que serializa como `null` (não `[]`). Um deck sem
   botões enviava `"buttons": null`, e o frontend quebrava em `.find()`. O
   `clone()` do config força `[]T{}`; o frontend ainda tem guardas defensivas.

> No **Windows** não há CGO (input via `SendInput` em Go puro). No **macOS** o
> CGO é necessário para o `CGEvent` — exige Xcode Command Line Tools instalados.

## Estrutura

```
go-deck/
├── main.go                 # bootstrap Wails + embed do frontend
├── app.go                  # bindings expostos ao desktop (config, rede, QR, TestOBS)
├── internal/
│   ├── config/             # modelo de dados (Pages/Button/Integrations) + load/save
│   ├── input/              # InputController — SendInput (Windows) / CGEvent (macOS)
│   ├── launch/             # Launcher (abre programas/URLs, sem shell) — por SO
│   ├── obs/                # obs.Controller via obs-websocket v5 (lib goobs)
│   ├── action/             # interface Action + tipos (keypress/launch/url/obs/…)
│   └── server/             # http + websocket + QR + detecção de IP da LAN
└── frontend/src/
    ├── components/         # DeckGrid, DeckButton (compartilhados)
    ├── desktop/            # editor: abas de grids, ButtonEditor, ActionFields,
    │                       #   AppearanceFields (emoji/imagem/cor), OBSPanel
    ├── mobile/             # grids + WebSocket + navegação/Home (modo celular)
    ├── lib/                # runtime, teclas, resumo de ação, aparência/contraste
    └── types.ts            # tipos compartilhados (DeckConfig, Page, Action…)
```

## Licença

[MIT](LICENSE) © Mario de Moraes
