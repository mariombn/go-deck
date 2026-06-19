---

kanban-plugin: board

---

## 💡 Ideias futuras

- [ ] Migração para Wails v3 (quando sair do alpha)
- [ ] Descoberta automática via mDNS
	  Dispensa digitar/escolher o IP manualmente.
- [ ] HTTPS


## 📋 Backlog

- [ ] Reordenação drag-and-drop dos botões
- [ ] Suporte a macOS
	  `CGEvent` + permissão de Acessibilidade, atrás do mesmo `InputController`.
- [ ] Suporte a Linux
	  X11 via XTEST; Wayland é o ponto fraco do input.
- [ ] Assinatura e notarização (macOS) + code signing (Windows)
	  Sem isso o Gatekeeper/SmartScreen bloqueiam. Notarização exige conta
	  Apple Developer; pode ser adicionada ao workflow de release depois.
- [ ] Instaladores (NSIS no Windows, DMG no macOS)
	  Hoje o release publica binário/.app soltos via `wails build`.


## 🔜 Próximas

- [ ] Remover/condicionar o overlay de diagnóstico
	  Hoje qualquer erro vira caixa vermelha; tornar dev-only ou remover.
- [ ] Troca de porta sem reiniciar
	  Reiniciar o listener ao salvar a config com porta diferente.
- [ ] Token de autenticação no QR
	  Fechar o acesso aberto na LAN (decisão S2 adiada na POC).
- [x] GitHub Actions: build de release (Windows + macOS)
	  `.github/workflows/release.yml` dispara ao publicar um release; matrix
	  com runners nativos (mac precisa de CGO), anexa `.exe` e `.app` (zip).
- [ ] Adicionar `LICENSE` ao repositório
- [ ] Testes unitários
	  Keymap, normalização da config e detecção de IP da LAN.


## ✅ Concluído (POC)

**Complete**
- [x] Vertical slice: `SendInput` em Go puro validado
	  Input nativo do Windows sem CGO, isolado atrás de `InputController`.
- [x] Servidor HTTP + WebSocket na LAN
	  Processo separado do webview do Wails, no mesmo binário.
- [x] Detecção de IP da LAN + QR Code
	  Pula adaptadores virtuais (WSL/VM/VPN); dropdown para trocar.
- [x] Cliente celular responsivo
	  Reconexão com backoff, flash de ack, transposição do grid em portrait.
- [x] Editor de config no desktop
	  Grid, CRUD por clique na célula, captura de teclas híbrida.
- [x] Persistência em `config.json` + broadcast ao vivo
- [x] Validado end-to-end no celular real
- [x] Publicado no GitHub
- [x] Novos tipos de `Action`: launch, url, sequence
	  Interface `Launcher` (por SO) + `ExecContext`; `Spec` chato com campos
	  por tipo; sequence aninhável (limite 10) abortando no 1º erro. `script`
	  foi fundido em `launch` (sem shell, `path` + `args`). Editor com seletor
	  de tipo e testes do `Build()`.
- [x] Integração com OBS Studio (obs-websocket v5)
	  Camada `obs.Controller` (lib `goobs`, conexão por toque); action `obs`
	  com cena/gravação/transmissão/mudo/hotkey; bloco `Integrations.OBS` na
	  config + painel com "Testar conexão". `ExecContext` ganhou o campo OBS.
- [x] Action `discord` (mute/deafen)
	  Keypress rotulado para os keybinds globais do Discord (não há API local
	  de controle do cliente). PTT fica de fora (não casa com toque).
- [x] Múltiplos grids (páginas) + navegação entre eles
	  `DeckConfig.Pages` (cada um com tamanho próprio); migração do formato
	  antigo; ids de botão únicos no deck inteiro. Action `navigate`
	  (client-side) + botão Home no celular; abas laterais nomeáveis no
	  editor. Cobre o antigo item "Perfis múltiplos" numa forma mais leve.
- [x] Aparência dos botões: emoji, imagem e cor
	  `Button.icon` (emoji OU imagem base64 inline) + `Button.color` (fundo,
	  texto com contraste automático). Editor com paleta+cor custom, seletor
	  de emoji (emoji-picker-react, nativo) e upload de imagem redimensionada.
	  Cobre os itens "Ícones/imagens" e "Cores customizadas".




%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%