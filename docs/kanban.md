---

kanban-plugin: board

---

## 💡 Ideias futuras

- [ ] Migração para Wails v3 (quando sair do alpha)
- [ ] Descoberta automática via mDNS
	  Dispensa digitar/escolher o IP manualmente.
- [ ] HTTPS
- [ ] Cores e estados customizados de botão


## 📋 Backlog

- [ ] Ícones/imagens nos botões
- [ ] Reordenação drag-and-drop dos botões
- [ ] Perfis múltiplos
- [ ] Suporte a macOS
	  `CGEvent` + permissão de Acessibilidade, atrás do mesmo `InputController`.
- [ ] Suporte a Linux
	  X11 via XTEST; Wayland é o ponto fraco do input.
- [ ] Empacotamento e instaladores cross-platform
	  CGO não é usado, mas o webview ainda exige runners por SO.


## 🔜 Próximas

- [ ] Remover/condicionar o overlay de diagnóstico
	  Hoje qualquer erro vira caixa vermelha; tornar dev-only ou remover.
- [ ] Troca de porta sem reiniciar
	  Reiniciar o listener ao salvar a config com porta diferente.
- [ ] Token de autenticação no QR
	  Fechar o acesso aberto na LAN (decisão S2 adiada na POC).
- [ ] GitHub Actions: build do `.exe` no Windows
	  Runner windows; como não há CGO, o CI fica simples.
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




%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%