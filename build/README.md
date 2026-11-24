# Arquivos de build

- `appicon.svg`: fonte vetorial original do ícone.
- `appicon.png`: ícone 1024×1024 usado pelo Wails (macOS e janela Linux).
- `icons.sha256`: hashes dos ícones gerados, validados na CI.
- `bin/`: binários compilados; ignorado pelo Git.
- `release/`: AppImage, `.deb`, `.rpm` e checksums; ignorado pelo Git.

## Windows

- `windows/icon.ico`: ícone multirresolução embutido no `.exe` pelo Wails.
- `windows/info.json`: metadados do executável/instalador.
- `windows/wails.exe.manifest`: manifesto do executável.
- `windows/installer/`: scripts NSIS.

## macOS

- `darwin/Info.plist`: metadados do bundle de produção.
- `darwin/Info.dev.plist`: variante de desenvolvimento.

O Wails converte `appicon.png` para `Contents/Resources/iconfile.icns` ao gerar o `.app`.

## Linux

- `linux/go-deck.desktop` e `linux/icons/`: menu, dock e tema hicolor.
- `linux/AppRun`: entrada do AppImage; usa GTK3/WebKitGTK 4.1 do sistema.
- `linux/nfpm.yaml`: conteúdo, dependências e hooks dos pacotes `.deb`/`.rpm`.
- `linux/70-deckpilot.rules`: permissões locais para Vision 2 e `uinput`.
- `linux/deckpilot-uinput.conf`: carrega `uinput` no boot.
- `linux/postinstall.sh` / `postremove.sh`: atualização de regras/caches.

Regenerar ícones: `python3 scripts/generate-icons.py` (Inkscape + ImageMagick 7).
Validar ícones: `python3 scripts/check-icons.py` (só Python 3).

Build/USB: [docs/linux.md](../docs/linux.md). Empacotamento/release: [docs/releases.md](../docs/releases.md).
