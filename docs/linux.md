# Linux e Rise Mode Vision 2

## Instalação pelo release

Há AppImage, `.deb` e `.rpm` para x86_64. Veja [docs de distribuição](releases.md)
para instalação, dependências e checksums. Os pacotes nativos já instalam ícones,
lançador e regras de acesso USB/uinput. O AppImage usa GTK3/WebKitGTK 4.1 do host
e exige instalar as regras manualmente; não altera o sistema ao abrir.

## Desktop

O Linux usa o mesmo editor Wails, servidor LAN, config e ações dos outros SOs:

- atalhos de teclado/mídia via `/dev/uinput`, em **Wayland e X11**, sem `xdotool`/`ydotool`;
- programas/binários/AppImages via execução direta (o arquivo precisa ser executável);
- lançadores `.desktop` via `gio launch`; URLs via `xdg-open`;
- listagem de aplicativos/ícones via diretórios XDG (`applications`, temas e `pixmaps`);
- OBS via obs-websocket, sem mudança no protocolo.

Os atalhos usam posições evdev do teclado e respeitam o layout ativo do compositor. `win` é Super; `cmd`/`opt` continuam exclusivos do macOS. Ctrl/Alt direitos e teclas multimídia são suportados. O compositor/aplicativo ainda pode reservar atalhos, e o Discord precisa ter seu keybind global configurado.

### Dependências e build

Requer Go >= 1.23, Node.js/npm, compilador C, `pkg-config`, GTK3 e WebKitGTK. Em Fedora/Nobara:

```bash
sudo dnf install golang nodejs npm gcc pkgconf-pkg-config gtk3-devel webkit2gtk4.1-devel
```

Em Debian/Ubuntu recentes:

```bash
sudo apt install golang nodejs npm build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
```

Confira a versão do Go fornecida pela distribuição. Depois:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0
bash scripts/build-linux.sh
./build/bin/go-deck
```

O script escolhe WebKitGTK 4.1 (`wails build -tags webkit2_41`) ou 4.0. Para desenvolvimento com WebKitGTK 4.1: `wails dev -tags webkit2_41`. A config fica em `${XDG_CONFIG_HOME:-~/.config}/DeckPilot/config.json`.

### Permissões (uma vez)

Não execute o DeckPilot como root. Nos pacotes `.deb`/`.rpm`, as regras já vêm em `/usr/lib/udev/rules.d` e o módulo em `/usr/lib/modules-load.d`; reconecte o USB após instalar. Para builds locais, disponibilize o hardware e o teclado virtual ao usuário da sessão local:

```bash
sudo install -m 644 build/linux/70-deckpilot.rules /etc/udev/rules.d/70-deckpilot.rules
sudo install -m 644 build/linux/deckpilot-uinput.conf /etc/modules-load.d/deckpilot-uinput.conf
sudo modprobe uinput
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=misc --sysname-match=uinput
sudo udevadm trigger --subsystem-match=hidraw
```

No AppImage, extraia com `./go-deck_versao_linux_amd64.AppImage --appimage-extract` e use os arquivos em `squashfs-root/usr/lib/udev/rules.d/70-deckpilot.rules` e `squashfs-root/usr/lib/modules-load.d/deckpilot-uinput.conf` como origem nos comandos `install` acima.

Reconecte o USB e, se necessário, encerre e reabra sua sessão. As regras usam `uaccess`/logind, não permissão global `0666`. O acesso a `uinput` permite injetar entrada na sessão; use apenas aplicativos confiáveis. Sessões remotas/headless sem logind podem exigir uma política de acesso específica do administrador.

## Rise Mode Vision 2

O suporte **ao hardware é Linux-only** nesta versão. Não é necessário instalar/rodar OpenDeck, seu plugin, Node.js ou ImageMagick para usar o binário compilado.

- USB `0a00:1002`, interface HID `00`, acesso direto a `hidraw` em Go, sem libusb/CGO.
- 15 teclas: 3 linhas × 5 colunas, posição 1 no canto superior esquerdo.
- LCDs JPEG 112×112, com cores, rótulos, emoji e imagens rasterizadas pelo canvas do desktop. O JPEG é girado 180° e os slots LCD têm as linhas invertidas, conforme o plugin local.
- Heartbeat a cada 4 s, detecção/reconexão a cada 2 s e reinicialização após suspensão.
- Somente uma ação por key-down (reports repetidos e key-up não executam novamente).
- Ações usam o mesmo executor dos toques do celular. `navigate` muda somente a página do hardware, sem executar no servidor.
- Página inicial = primeira página salva. O painel **Rise Mode Vision 2** permite escolher outra página ou voltar ao início. Para voltar pelo próprio aparelho, crie uma ação de navegação para a primeira página.
- Grids maiores não são redimensionados: apenas as primeiras 3 linhas × 5 colunas aparecem. O painel avisa sobre o recorte.
- Apenas configurações **salvas** vão para o hardware; rascunhos do editor não alteram as teclas. Navegação USB e navegação no celular são independentes.
- Brilho inicial: 80%. A configuração do brilho e do estado ligado/desligado ainda não é persistida.

**Mantenha o OpenDeck fechado.** O lock USB evita duas instâncias cooperantes do DeckPilot, mas não bloqueia programas que ignoram `flock`. Desmarque **Controlar USB** (ou feche o app) antes de abrir outro controlador. O estado “Aguardando USB” é normal sem o aparelho; falhas de permissão e de execução aparecem no painel.

### Teste manual

1. Abra o app, confira “Conectado” e crie/salve botões com rótulo, cor, emoji e uma imagem.
2. Confira a orientação e os quatro cantos do grid: superior esquerdo, superior direito, inferior esquerdo e inferior direito.
3. Configure um atalho fácil de observar (por exemplo, mídia) e confira que cada toque dispara uma única vez.
4. Crie uma segunda página com navegação de ida e volta. Confira que o celular não muda de página junto.
5. Edite/salve um botão, desconecte/reconecte o USB e teste a recuperação. Teste também liberar/reativar “Controlar USB”.

### Testes automatizados

```bash
go test -race ./...
go vet ./...
cd frontend && npm ci && npm test -- --threads=false && npm run build
```

Por padrão os testes **não acessam o hardware nem enviam teclas**. Os testes de protocolo usam transporte falso e os de input usam um pipe.

Diagnósticos opcionais, com o app e OpenDeck fechados:

```bash
# Cria e destrói o teclado virtual, SEM digitar.
DECKPILOT_TEST_UINPUT=1 go test -v ./internal/input -run HardwareSmoke
# Inicializa o USB e grava uma imagem de teste nos 15 LCDs.
DECKPILOT_TEST_VISION2=1 go test -v ./internal/vision2 -run HardwareSmoke
```

### Origem do protocolo

Referência local inspecionada: `io.local.risemode.vision2.sdPlugin/{plugin,vision2}.mjs` do OpenDeck. A inspeção estática REA identificou o artefato SHA-256 `ffd00efad336b42e9a86c19733357fb2ed9408b1d0f923bcfa0e9478d6df15a1`, Evidence `ev_a63e1db2244b00d38a07f16ab18ebf71f60b065ca3919cdf83a3cdfafc85c109`. Ela estabelece o código observado, não comprova execução física; a confirmação visual e dos toques depende do teste manual. A implementação não importa o plugin em runtime.
