# Project Brief — "DeckPilot" (nome provisório)

> Documento de inicialização para uso no **Claude Code**.
> Objetivo: construir uma **POC funcional** de um software tipo *Stream Deck* open-source, controlável pelo celular via navegador.

---

## 1. Visão do produto

Um aplicativo desktop que:

1. Roda no PC e expõe um **servidor web na rede local**.
2. Permite acessar, pelo **celular** (via QR Code), uma interface web com um **grid de botões**.
3. Ao tocar num botão no celular, o PC **executa uma ação** — na POC, uma **macro de teclado** (atalho/combo de teclas).
4. O grid de botões é **configurável pela interface desktop** e a configuração é **salva em arquivo JSON local**.

Inspiração de referência: [OpenDeck](https://github.com/nekename/OpenDeck).

---

## 2. Stack definida

| Camada | Tecnologia | Observação |
|---|---|---|
| Runtime / backend | **Go** | Lógica de sistema, servidor HTTP/WS, execução de input |
| Shell desktop | **Wails v2** (estável) | UI web embutida em janela nativa. *Não usar v3 — está em alpha* |
| Frontend (desktop **e** celular) | **React + TypeScript** | Componentes reaproveitados entre os dois clientes |
| Build / estilo do frontend | **Vite + Tailwind CSS** | Padrão do Wails v2 com template React-TS |
| Simulação de teclado | **robotgo** (`github.com/go-vgo/robotgo`) | Cross-platform; usa **CGO** |
| Servidor HTTP/WS | `net/http` + **gorilla/websocket** (`github.com/gorilla/websocket`) | Servidor separado do webview interno do Wails |
| Geração de QR Code | `github.com/skip2/go-qrcode` | Gera PNG/base64 da URL local |

> **Decisão sobre Wails:** o Wails **v3** ainda está em **alpha** (`v3.0.0-alpha.x`). Para a POC, usar **Wails v2**, que é estável e bem documentado. Manter a arquitetura desacoplada o suficiente para uma futura migração ao v3.

---

## 3. Escopo da POC (o que ENTRA)

- [ ] App Wails v2 inicializável no **Windows** (alvo único da POC).
- [ ] **UI desktop** (React) que permite:
  - Definir o tamanho do grid (ex.: linhas × colunas).
  - Adicionar / editar / remover botões: label, e a combinação de teclas da macro.
  - Salvar a configuração em **arquivo JSON local**.
- [ ] **Servidor HTTP + WebSocket** na rede local, iniciado junto com o app.
- [ ] **QR Code** exibido na UI desktop, codificando a URL local (ex.: `http://192.168.x.x:PORTA`).
- [ ] **Cliente web do celular** (React) servido pelo Go:
  - Renderiza o mesmo grid de botões.
  - Conecta via WebSocket e recebe o estado atual dos botões.
  - Ao tocar num botão, envia o evento para o PC executar a macro.
- [ ] **Execução da macro de teclado** no Windows via robotgo.

## 4. Fora de escopo da POC (NÃO fazer agora)

- Abrir programas, rodar scripts, ações multi-passo, URLs.
- Ícones/imagens customizadas nos botões (só texto/label).
- Suporte a macOS e Linux (estruturar o código para permitir depois, mas **não** implementar/testar).
- Autenticação, HTTPS, descoberta automática (mDNS).
- Auto-update, instaladores, assinatura de código.
- Persistência de perfis múltiplos.

---

## 5. Arquitetura

### 5.1 Processos e comunicação

```
┌─────────────────────────────────────────────────────────┐
│                    PROCESSO GO (app)                      │
│                                                           │
│  ┌──────────────┐   bindings    ┌───────────────────┐    │
│  │  UI Desktop  │ ◄───nativos──► │   Core (Go)       │    │
│  │ (React/Wails)│                │  - config (JSON)  │    │
│  └──────────────┘                │  - input (robotgo)│    │
│                                  │  - action runner  │    │
│  ┌──────────────────────┐        └─────────┬─────────┘    │
│  │ HTTP/WS Server        │ ◄────────────────┘             │
│  │ (net/http + gorilla)  │                                │
│  └──────────┬────────────┘                                │
└─────────────┼─────────────────────────────────────────────┘
              │ rede local (LAN)
              ▼
       ┌─────────────┐
       │  Celular    │  React (mesma base do desktop)
       │  navegador  │  via QR Code → WebSocket
       └─────────────┘
```

**Pontos críticos de arquitetura:**

1. O webview interno do Wails (UI desktop) **não** é exposto na rede. O servidor para o celular é um `net/http` **separado**, no mesmo processo Go.
2. Toda chamada de input deve passar por uma **interface Go** (`InputController`), para isolar o robotgo e permitir trocar a implementação por SO no futuro.
3. As ações devem usar um design **polimórfico** (`Action` com método `Execute()`), mesmo que a POC só implemente `KeypressAction` — isso evita refatoração grande ao adicionar tipos depois.

### 5.2 Caminho crítico (fluxo de um toque)

```
Toque no celular
  → React envia {"type":"press","buttonId":"<id>"} pelo WebSocket
  → Handler Go recebe e busca a config do botão
  → ActionRunner localiza a Action (KeypressAction)
  → InputController.SendKeys(combo) → robotgo executa no Windows
  → (opcional) broadcast de feedback de estado pelo WebSocket
```

> **Recomendação de ordem de construção:** começar por um **vertical slice** — um único botão hardcoded que, do celular, dispara uma tecla no PC — para validar o caminho crítico inteiro **antes** de investir na UI de configuração.

---

## 6. Modelo de dados (config)

Arquivo `config.json` (local, ex. em `%APPDATA%/DeckPilot/config.json` no Windows):

```json
{
  "grid": { "rows": 3, "cols": 3 },
  "server": { "port": 8754 },
  "buttons": [
    {
      "id": "btn_1",
      "label": "Mute Mic",
      "position": { "row": 0, "col": 0 },
      "action": {
        "type": "keypress",
        "keys": ["ctrl", "shift", "m"]
      }
    }
  ]
}
```

**Tipos TypeScript correspondentes** (compartilhar entre desktop e celular):

```ts
type KeypressAction = { type: "keypress"; keys: string[] };
type Action = KeypressAction; // união expansível no futuro

interface ButtonConfig {
  id: string;
  label: string;
  position: { row: number; col: number };
  action: Action;
}

interface DeckConfig {
  grid: { rows: number; cols: number };
  server: { port: number };
  buttons: ButtonConfig[];
}
```

**Interface Go (polimorfismo de ações):**

```go
type Action interface {
    Execute(ctrl InputController) error
}

type InputController interface {
    SendKeys(keys []string) error
}
```

---

## 7. Protocolo WebSocket (POC)

Mensagens em JSON. Mínimo necessário:

**Cliente (celular) → Servidor:**
```json
{ "type": "press", "buttonId": "btn_1" }
```

**Servidor → Cliente (ao conectar e em updates):**
```json
{ "type": "config", "payload": { /* DeckConfig */ } }
```

**Servidor → Cliente (feedback opcional de execução):**
```json
{ "type": "ack", "buttonId": "btn_1", "ok": true }
```

---

## 8. Pré-requisitos do ambiente (Windows)

> ⚠️ **Atenção — pegadinha #1:** `robotgo` usa **CGO**, então é obrigatório um **compilador C** instalado e no PATH. Sem isso o build falha.

1. **Go 1.21+** — https://go.dev/dl
2. **Node.js LTS** (para o frontend Vite/React).
3. **Compilador C (MinGW-w64 / gcc)** no PATH — ex.: via [MSYS2](https://www.msys2.org/) ou [TDM-GCC]. Verificar com `gcc --version`.
4. **Wails CLI v2:**
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```
5. Rodar `wails doctor` e **garantir que todas as dependências estão OK** antes de prosseguir.

---

## 9. Passos de implementação (ordem sugerida para o Claude Code)

### Etapa 0 — Bootstrap
1. Criar projeto Wails v2 com template **React + TypeScript**:
   ```bash
   wails init -n deckpilot -t react-ts
   ```
2. Adicionar Tailwind CSS ao frontend (config Vite + diretivas Tailwind).
3. Confirmar que `wails dev` abre a janela e o hot-reload funciona.

### Etapa 1 — Vertical slice (validar o caminho crítico)
4. Adicionar `robotgo` e implementar `InputController.SendKeys()` (Windows).
5. Criar um botão **hardcoded** na UI desktop que, ao clicar, chama um binding Go que dispara uma combinação de teclas (ex.: abrir o Bloco de Notas e digitar/atalho). **Validar que a tecla é realmente executada no SO.**

### Etapa 2 — Servidor de rede + celular
6. Subir `net/http` + `gorilla/websocket` num goroutine no startup do app, numa porta configurável.
7. Detectar o **IP da LAN** da máquina e montar a URL (`http://<ip>:<porta>`).
8. Gerar **QR Code** dessa URL com `go-qrcode` e exibi-lo na UI desktop.
9. Servir um build React do **cliente celular** a partir do servidor Go.
10. Cliente celular conecta no WS, recebe o `config` e renderiza o grid.
11. Toque no celular → `press` → Go executa a macro. **Validar end-to-end com o celular real.**

### Etapa 3 — Configuração persistente
12. Implementar leitura/escrita do `config.json` (criar com defaults se não existir).
13. UI desktop: editor de grid (linhas/colunas) e CRUD de botões (label + captura/seleção da combinação de teclas).
14. Ao salvar, persistir no JSON **e** fazer broadcast do novo `config` para os celulares conectados via WS.

### Etapa 4 — Polimento mínimo
15. Tratar reconexão do WebSocket no celular.
16. Tratar erros de execução de macro e refletir no `ack`.
17. README com instruções de build/run.

---

## 10. Estrutura de pastas sugerida

```
deckpilot/
├── main.go                 # bootstrap Wails + start do servidor de rede
├── app.go                  # struct App + bindings expostos ao frontend desktop
├── internal/
│   ├── config/             # load/save do config.json
│   ├── input/              # InputController (robotgo) — isolado por interface
│   ├── action/             # Action interface + KeypressAction
│   └── server/             # http + websocket + qrcode + IP da LAN
├── frontend/               # app React-TS do DESKTOP (Wails)
│   └── src/
│       ├── components/     # Grid, Button, ConfigEditor...
│       └── types/          # tipos compartilhados (DeckConfig etc.)
└── mobile/                 # app React-TS do CELULAR (buildado e servido pelo Go)
    └── src/
        └── components/     # reaproveitar Grid/Button do desktop
```

> Considerar extrair os componentes/tipos compartilhados (Grid, Button, types) para um local comum, evitando duplicação entre `frontend/` e `mobile/`.

---

## 11. Critérios de aceite da POC

A POC está pronta quando, **no Windows**:

1. `wails dev` (ou o binário) abre a janela desktop com a UI de configuração.
2. É possível definir o grid e criar pelo menos um botão com uma macro de teclado, e isso persiste no `config.json`.
3. A UI desktop mostra um QR Code válido.
4. Escaneando o QR Code, o celular abre o grid no navegador e mostra os mesmos botões.
5. Tocar num botão no celular **executa de fato** a combinação de teclas no PC.
6. Editar/salvar a config no desktop atualiza o grid no celular sem recarregar manualmente.

---

## 12. Notas para o futuro (pós-POC)

- Abstração de input já isolada → adicionar implementações para macOS (`CGEvent`, requer permissão de Acessibilidade) e Linux (X11 via XTEST; **Wayland é o ponto fraco** do robotgo).
- Novos tipos de `Action`: launch, script, multi, url.
- Ícones nos botões, perfis múltiplos, reordenação drag-and-drop.
- Empacotamento cross-platform via GitHub Actions (runners por SO — CGO impede cross-compilation simples).
- Avaliar migração para Wails v3 quando sair do alpha.