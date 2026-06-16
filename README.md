# go-deck

POC de um *Stream Deck* open-source: um app desktop (Windows) que expõe um
grid de botões na rede local. Pelo celular, via QR Code, você abre o grid no
navegador e, ao tocar num botão, o PC executa uma **macro de teclado**.

Inspirado no [OpenDeck](https://github.com/nekename/OpenDeck). Construído com
**Go + Wails v2 + React/TypeScript + Tailwind**.

## Como funciona

```
Toque no celular ──ws──► servidor Go ──► executa a Action (combo de teclas)
                                          via SendInput (Win32, Go puro)
```

- **Desktop (Wails):** editor de configuração + QR Code. Webview NÃO exposto na rede.
- **Servidor de rede (net/http + gorilla/websocket):** processo separado, no mesmo
  binário, serve o app React ao celular e recebe os toques via WebSocket.
- **Input:** `SendInput` nativo do Windows via `golang.org/x/sys/windows` — **Go puro,
  sem CGO** (não precisa de robotgo nem de compilador C). Isolado atrás da interface
  `InputController` para permitir macOS/Linux no futuro.
- **Um único bundle React:** detecta em runtime se está no Wails (mostra o editor) ou
  no navegador do celular (mostra só o grid).

## Pré-requisitos

- **Go 1.21+**
- **Node.js LTS**
- **WebView2 runtime** (já vem no Windows 11)
- **Wails CLI v2:** `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

> Não é necessário compilador C / MinGW: a POC não usa CGO.

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

Gera um binário único em `build/bin/go-deck.exe` (com o app React embutido).

## Uso

1. Abra o `go-deck.exe` (ou `wails dev`).
2. Defina o grid (linhas × colunas) e clique numa célula para criar um botão
   (rótulo + combinação de teclas — capture ao vivo ou use os botões de teclas
   especiais para Win/mídia). Clique em **Salvar configuração**.
3. No celular (mesma rede Wi-Fi), escaneie o QR Code.
4. Toque num botão → a combinação de teclas é executada no PC, no app em foco.

A configuração é salva em `%APPDATA%/DeckPilot/config.json`.

## Modelo de teclas

- Modificadores: `ctrl`, `shift`, `alt`, `win`
- Letras `a`–`z`, dígitos `0`–`9`, `f1`–`f12`
- Especiais: `enter`, `esc`, `tab`, `space`, `backspace`, `delete`, `insert`,
  `home`, `end`, `pageup`, `pagedown`, setas (`up`/`down`/`left`/`right`)
- Mídia: `mute`, `volup`, `voldown`, `playpause`, `nexttrack`, `prevtrack`
- Um botão = **um combo simultâneo** (ex.: `["ctrl","shift","m"]`).

## Limitações conhecidas (POC)

- **Sem autenticação/HTTPS:** qualquer dispositivo na LAN que abrir a URL pode
  acionar os botões. Há validação de `Origin` no WebSocket (higiene mínima) e um
  aviso na UI, mas não é seguro para redes não confiáveis.
- A **porta** é lida na inicialização. Mudá-la no editor exige reiniciar o app
  (porta ocupada gera erro explícito, sem fallback automático).
- `Ctrl+Alt+Del` e a tecla Win em combo não são capturáveis pelo navegador (o
  SO os intercepta); use os botões de teclas especiais para Win/mídia.
- Alvo único: **Windows**. macOS/Linux ficam para depois (input já isolado por interface).

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

> Bônus: a POC **não usa CGO** (input via `SendInput` em Go puro), então a
> "pegadinha #1" do brief original (compilador C para o robotgo) não se aplica.

## Estrutura

```
go-deck/
├── main.go                 # bootstrap Wails + embed do frontend
├── app.go                  # bindings expostos ao desktop (config, rede, QR)
├── internal/
│   ├── config/             # modelo de dados + load/save do config.json (thread-safe)
│   ├── input/              # InputController + SendInput (Windows, Go puro)
│   ├── action/             # interface Action + KeypressAction
│   └── server/             # http + websocket + QR + detecção de IP da LAN
└── frontend/src/
    ├── components/         # DeckGrid, DeckButton (compartilhados)
    ├── desktop/            # editor de config + QR (modo Wails)
    ├── mobile/             # grid + WebSocket (modo celular)
    ├── lib/                # detecção de runtime + vocabulário/captura de teclas
    └── types.ts            # tipos compartilhados (DeckConfig etc.)
```
