# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Projeto e comentários em **pt-BR**. Mantenha esse idioma ao escrever código/docs.

## Comandos

A CLI do Wails é instalada via `go install` e fica em `$(go env GOPATH)/bin`, que **não está no PATH por padrão**:
- Windows: `$env:Path += ";$env:USERPROFILE\go\bin"`
- macOS: `export PATH="$PATH:$(go env GOPATH)/bin"` (ou adicione ao `.zshrc`)

- **Dev (hot-reload):** `wails dev` — abre o webview e roda o Vite em `127.0.0.1:5173`. Compila com a tag `dev` automaticamente.
- **Build de produção:** `wails build` — regenera os bindings, builda o frontend e gera `build/bin/go-deck.exe` (Windows) ou `build/bin/go-deck.app` (macOS). Use isto para validar o build completo.
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
`celular → WS {type:"press",buttonId} → server.press → Store.FindButton → action.Spec.Build() → Action.Execute(ExecContext{Input, Launcher, OBS}) → SendKeys / Launch / OpenURL / OBS.*`.

**Camadas isoladas por interface:**
- `InputController` (`internal/input`) — Windows: **`SendInput` em Go puro, sem CGO** (`sendinput_windows.go`); macOS: **`CGEvent` via CGO** (`sendinput_darwin.go`, requer permissão de Acessibilidade — `AXIsProcessTrustedWithOptions` abre o prompt automático na 1ª chamada sem permissão); Linux e outros: stub (`sendinput_other.go`). Vocabulário de teclas em `keymap.go` (`cmd`/`opt` são macOS-only; `playpause`/`nexttrack`/`prevtrack` são Windows-only).
- `Launcher` (`internal/launch`) — Windows (`launcher_windows.go`): `exec.Command` para `launch` e `rundll32 url.dll` para `url`; macOS (`launcher_darwin.go`): `open path` para bundles `.app`, `exec.Command` para binários, `open url` para URLs; Linux e outros: stub. Mesmo padrão do `InputController`.
- `obs.Controller` (`internal/obs`) — controla o OBS Studio via **obs-websocket v5** (lib `goobs`, Go puro). É **rede pura** (não depende do SO), então tem **uma implementação só** (sem arquivos por SO). **Conecta por toque** (dial→request→fecha), com timeouts; não importa `config` (evita ciclo — o mapeamento `config.OBSConfig → obs.Settings` vive em `server.obsSettings`).
- `Action` (`internal/action`) — polimórfico via `Spec.Build()`. Tipos: `keypress`, `launch`, `url`, `sequence` (lista de ações em ordem, aninhável até `maxSequenceDepth`=10, **aborta no 1º erro**), `obs` (`obsOp` + `target`), `discord` (mute/deafen — **é keypress por baixo**, dispara o keybind global do Discord; o `discordOp` é só rótulo/UI) e `navigate` (`targetPage` — **resolvido no cliente**, troca a página exibida no celular; não executa no servidor). `Spec` é um struct **chato** (todos os campos `omitempty`); cada tipo usa só os seus. As ações recebem um `ExecContext{Input, Launcher, OBS}` em `Execute` — adicionar uma capacidade nova = novo campo no `ExecContext`, sem mudar a assinatura. Adicionar tipos = nova implementação, sem refatorar o resto.

**Dev vs. prod no servidor de assets** (build tags, casados com a tag `dev` do Wails):
- `assets_dev.go` (`//go:build dev`) — reverse-proxy para o Vite em `127.0.0.1:5173`.
- `assets_prod.go` (`//go:build !dev`) — serve o `frontend/dist` embutido via `embed.FS` passado de `main.go`.

## Pegadinhas (não reintroduzir)

- **`crossorigin` em `<script type="module">`** deixa o WebView2 **em branco** sob o esquema `wails.localhost`. O `frontend/vite.config.ts` tem um plugin que remove esse atributo no build — não tire.
- **Slice Go `nil` vira `null` no JSON** (não `[]`), quebrando `.find()`/`.length` no frontend. Sempre devolva slices não-nulos ao frontend: `config.Store.clone()` força `[]T{}`, e o frontend tem guardas defensivas (`?? []`).
- **macOS + `sendinput_other.go`:** a build tag é `!windows && !darwin`. Se adicionar suporte a outro SO (ex.: Linux), crie `sendinput_linux.go` e atualize a tag do `_other.go` de novo — senão haverá dois `newController()` no mesmo pacote e o build quebra.

## Convenções e estado atual

- **Múltiplos grids (páginas).** `DeckConfig.Pages []Page`, cada `Page{id,name,grid,buttons}` com **tamanho próprio**. Não existe mais grid/buttons no topo — `config.go` migra o formato antigo (campos `LegacyGrid`/`LegacyButtons`, só de leitura) para uma página "Principal" e os zera. Sempre há ≥1 página.
- **Navegação entre páginas é client-side.** A action `navigate` (`targetPage`=id da página) é interceptada no **celular** (`MobileApp.onCell`): troca a página exibida e **não** envia `press`. O celular tem um botão **Home** fixo (volta à 1ª página). O protocolo WS não mudou (a config inteira já trafega; navegação não toca o servidor). Se um `navigate` chegar ao servidor por engano, `NavigateAction.Execute` retorna erro.
- Grid default **3 linhas × 5 colunas**; o celular **transpõe** para 3×5↔5×3 em portrait (só na renderização — o modelo de dados não muda).
- `id` de botão é gerado **no Go** (config `normalize`) e é **único no deck inteiro** (`FindButton` varre todas as páginas). **Exceção:** o `id` de **página** é gerado no **frontend** (`DesktopApp.newPageId`) — necessário para um `navigate` referenciar uma página recém-criada antes de salvar; o Go preserva ids não-vazios/únicos e atribui se faltarem. Encolher o grid **dropa** botões órfãos (por página).
- Porta padrão **8754**, lida na inicialização (trocar exige reiniciar). Porta ocupada ⇒ erro explícito, sem fallback.
- **Sem auth/HTTPS** (POC): só validação de `Origin` no upgrade do WS. Qualquer um na LAN pode acionar botões. **Com `launch`, isso vira execução de processos**: quem está na LAN dispara os botões já configurados (abre os programas/URLs definidos no desktop). O celular só envia **id de botão**, nunca um `path` — o `path`/`url` só é definido no editor desktop. Risco aceito na POC; mitigação real depende do item "Token de autenticação no QR".
- **Aparência do botão.** `Button` tem `icon` e `color` (opcionais). `icon` é OU um emoji OU uma **imagem como data URL base64** embutida no próprio config (distinguidos por `data:` no início) — viaja de graça no WS/webview; o upload é redimensionado no cliente p/ 128px (`lib/appearance.resizeImageToDataURL`). `color` é o fundo (hex); o texto usa **contraste automático** (`textColorFor`). O `DeckButton` (compartilhado) renderiza tudo; o **resumo da ação** aparece só no modo `desktop`. O seletor de emoji (`emoji-picker-react`, `emojiStyle="native"`, sem CDN) roda **só no editor**; o celular exibe o caractere pela fonte do SO.
- `main.tsx` tem um overlay que exibe qualquer erro de runtime na tela (útil debugando no celular, sem devtools).
- **OBS:** conexão em `DeckConfig.Integrations.OBS` (`{enabled,host,port=4455,password}`), editada no painel lateral do desktop (com "Testar conexão" via binding `App.TestOBS`). A senha fica no `config.json` em **texto puro** (postura POC). Requer o **WebSocket Server** habilitado no OBS.
- **Discord não tem API local** de controle do próprio cliente: a action `discord` é só um keypress rotulado. O usuário configura o atalho como **keybind global** no Discord e captura a mesma tecla. Push-to-talk **não** funciona por toque (é segurar) — por isso só mute/deafen.

Próximos passos: ver [docs/kanban.md](docs/kanban.md).
