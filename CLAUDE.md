# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Projeto e comentários em **pt-BR**. Mantenha esse idioma ao escrever código/docs.

## Comandos

A CLI do Wails é instalada via `go install` e fica em `$GOPATH/bin` (ex.: `C:\Users\<user>\go\bin`), que **não está no PATH por padrão** — adicione antes de usar (`$env:Path += ";$env:USERPROFILE\go\bin"`).

- **Dev (hot-reload):** `wails dev` — abre o webview e roda o Vite em `127.0.0.1:5173`. Compila com a tag `dev` automaticamente.
- **Build de produção:** `wails build` — regenera os bindings, builda o frontend e gera `build/bin/go-deck.exe` (app React embutido). Use isto para validar o build completo.
- **Frontend isolado:** dentro de `frontend/` → `npm run dev` | `npm run build` (`tsc && vite build`).
- **Go:** `go vet ./...`. `go build -tags dev ./...` valida a variante dev (reverse-proxy). `go build ./...` puro **falha** se `frontend/dist` não existir (por causa do `//go:embed`) — rode `wails build` ou builde o frontend antes.
- **Testes:** ainda não há testes. `go test ./...`; um único: `go test ./internal/input -run TestNome`.

## Arquitetura (o essencial não-óbvio)

**Um processo, duas superfícies.** O binário Go expõe:
1. O **webview do Wails** (UI desktop), que fala com o Go via **bindings** (`app.go`) e **não é exposto na rede**.
2. Um servidor **`net/http` + WebSocket separado** (`internal/server`) que serve o app ao **celular** na LAN. São coisas distintas — não confunda os dois caminhos.

**Um único bundle React, dois modos por runtime.** `frontend/src/lib/runtime.ts` detecta `window.runtime`/`window.go`: presente ⇒ `DesktopApp` (editor + QR); ausente ⇒ `MobileApp` (grid via WS). O mesmo `frontend/dist` é embutido no webview **e** servido ao celular.

**Fonte da verdade da config.** `internal/config.Store` (thread-safe) é a única fonte, persistida em `%APPDATA%/DeckPilot/config.json`. O **desktop** lê/escreve via bindings; o **celular** é read-only + envia `press` pelo WS. `App.SaveConfig` persiste **e** faz broadcast do novo config a todos os celulares conectados.

**Caminho crítico de um toque:**
`celular → WS {type:"press",buttonId} → server.press → Store.FindButton → action.Spec.Build() → Action.Execute(ExecContext{Input, Launcher}) → SendKeys / Launch / OpenURL`.

**Camadas isoladas por interface (para SO futuro):**
- `InputController` (`internal/input`) — implementação Windows é **`SendInput` em Go puro, sem CGO** (`sendinput_windows.go`); outros SOs são stub (`sendinput_other.go`). O vocabulário de teclas vive em `keymap.go`.
- `Launcher` (`internal/launch`) — abre programas/URLs (`os/exec`, **sem shell**); Windows (`launcher_windows.go`) usa `exec.Command` para `launch` e `rundll32 url.dll` para `url`; outros SOs são stub. Mesmo padrão do `InputController`.
- `Action` (`internal/action`) — polimórfico via `Spec.Build()`. Tipos: `keypress`, `launch`, `url`, `sequence` (lista de ações em ordem, aninhável até `maxSequenceDepth`=10, **aborta no 1º erro**). `Spec` é um struct **chato** (todos os campos `omitempty`); cada tipo usa só os seus. As ações recebem um `ExecContext{Input, Launcher}` em `Execute` — adicionar uma capacidade nova = novo campo no `ExecContext`, sem mudar a assinatura. Adicionar tipos = nova implementação, sem refatorar o resto.

**Dev vs. prod no servidor de assets** (build tags, casados com a tag `dev` do Wails):
- `assets_dev.go` (`//go:build dev`) — reverse-proxy para o Vite em `127.0.0.1:5173`.
- `assets_prod.go` (`//go:build !dev`) — serve o `frontend/dist` embutido via `embed.FS` passado de `main.go`.

## Pegadinhas (não reintroduzir)

- **`crossorigin` em `<script type="module">`** deixa o WebView2 **em branco** sob o esquema `wails.localhost`. O `frontend/vite.config.ts` tem um plugin que remove esse atributo no build — não tire.
- **Slice Go `nil` vira `null` no JSON** (não `[]`), quebrando `.find()`/`.length` no frontend. Sempre devolva slices não-nulos ao frontend: `config.Store.clone()` força `[]T{}`, e o frontend tem guardas defensivas (`?? []`).

## Convenções e estado atual

- Grid default **3 linhas × 5 colunas**; o celular **transpõe** para 3×5↔5×3 em portrait (só na renderização — o modelo de dados não muda).
- `id` de botão é gerado **no Go** (config `normalize`); o frontend nunca inventa id. Encolher o grid **dropa** botões órfãos.
- Porta padrão **8754**, lida na inicialização (trocar exige reiniciar). Porta ocupada ⇒ erro explícito, sem fallback.
- **Sem auth/HTTPS** (POC): só validação de `Origin` no upgrade do WS. Qualquer um na LAN pode acionar botões. **Com `launch`, isso vira execução de processos**: quem está na LAN dispara os botões já configurados (abre os programas/URLs definidos no desktop). O celular só envia **id de botão**, nunca um `path` — o `path`/`url` só é definido no editor desktop. Risco aceito na POC; mitigação real depende do item "Token de autenticação no QR".
- `main.tsx` tem um overlay que exibe qualquer erro de runtime na tela (útil debugando no celular, sem devtools).

Próximos passos: ver [docs/kanban.md](docs/kanban.md).
