# Ícone e distribuição

## Identidade visual

O ícone original está em **`build/appicon.svg`**: um deck azul-noite com teclas arredondadas e uma ação central iluminada em ciano/índigo. Não depende de fontes, imagens externas ou serviços de geração.

Arquivos gerados e versionados:

- `build/appicon.png` (1024×1024): fonte do Wails para o ícone `.icns` do macOS e para a janela GTK no Linux.
- `build/windows/icon.ico`: 16, 24, 32, 48, 64, 128 e 256 px no mesmo arquivo.
- `build/linux/icons/`: PNGs de 16 a 512 px; o SVG também é instalado no tema hicolor.
- `frontend/public/`: favicon SVG/ICO, apple-touch-icon 180 px e ícones PWA 192/512 px.
- `build/icons.sha256`: garante que os derivados estão sincronizados com a fonte.

Para alterar o desenho e regenerar tudo, instale Inkscape e ImageMagick 7:

```bash
python3 scripts/generate-icons.py
python3 scripts/check-icons.py
```

Depois recompile o app. A CI só valida os arquivos gerados, não exige ferramentas gráficas. No macOS, o Wails gera `go-deck.app/Contents/Resources/iconfile.icns` a partir do PNG. No Windows, ele usa o ICO versionado. No Linux, `main.go` define o ícone GTK e `ProgramName=go-deck`, combinando com `go-deck.desktop`.

**No Wayland, o ícone do menu/dock depende também do lançador `.desktop` instalado**, não apenas do PNG embutido na janela. Os pacotes nativos já incluem lançador e ícones. Windows/macOS podem manter ícones antigos em cache; normalmente basta fechar/reabrir o aplicativo ou reinstalar a nova versão. Atalhos já adicionados à tela inicial do celular precisam ser adicionados novamente para atualizar o ícone.

### Testar um build local no KDE/Wayland

Reabrir o binário sozinho pode continuar mostrando um ícone genérico: registre
um lançador com o mesmo ID `go-deck` e instale o ícone para o usuário:

```bash
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
install -Dm644 build/appicon.svg "$data_home/icons/hicolor/scalable/apps/go-deck.svg"
install -Dm644 build/linux/icons/go-deck-256.png "$data_home/icons/hicolor/256x256/apps/go-deck.png"
mkdir -p "$data_home/applications"
desktop-file-install --dir="$data_home/applications" \
  --set-key=Exec --set-value="\"$(realpath build/bin/go-deck)\"" \
  build/linux/go-deck.desktop
update-desktop-database "$data_home/applications"
gtk-update-icon-cache --force --ignore-theme-index "$data_home/icons/hicolor"
# Somente KDE:
kbuildsycoca6 --noincremental
```

Feche o app e abra **go-deck pelo menu de aplicativos**. Se havia um atalho
antigo fixado na barra, remova-o e fixe o novo lançador. Esse registro local
aponta para o binário do repositório; antes de migrar para um pacote instalado,
remova o `go-deck.desktop` e os ícones `go-deck` locais para não sobrepor os
arquivos de `/usr/share` com uma versão antiga.

## Pipeline de release

`.github/workflows/release.yml` usa runners nativos:

| Runner | Artefatos |
| --- | --- |
| Windows | `go-deck.exe` |
| macOS | `go-deck-macos.zip` (contém `.app`) |
| Ubuntu 22.04 / amd64 | AppImage, `.deb`, `.rpm` e SHA-256 |

- **Push de tag `v*`:** compila todas as plataformas, valida os pacotes, reúne os artifacts e só então cria/publica o release. As notas completas devem estar em `docs/release-notes/<tag>.md`.
- **Release publicado manualmente:** atualiza os anexos do release correspondente. Se houver notas versionadas para a tag, aplica também esse texto.
- **Tags curtas:** `scripts/normalize-release-version.sh` traduz `v0.1` para `0.1.0` nos pacotes, preservando o nome/tag públicos. Também aceita tags como `v1.2.3` e `v1.2.3-beta.1`.
- **Execução manual (`workflow_dispatch`):** guarda artifacts do run, sem publicar release, com versão `0.0.0-dev.<número do run>`.
- `scripts/set-build-version.mjs` sincroniza os metadados numéricos Windows/macOS no runner; o arquivo do repositório não precisa ser alterado para cada release.
- O job final tem permissão de escrita e usa somente o `GITHUB_TOKEN`; não exige PAT pessoal nem dispara outra execução recursiva de release. `SHA256SUMS` cobre os binários/pacotes de todas as plataformas.
- Wails é fixado em **v2.12.0**, a mesma versão do `go.mod`.
- Linux compila com **`webkit2_41`**. Usa Ubuntu 22.04 como base glibc 2.35 e publica, nesta etapa, somente **amd64/x86_64**.
- O `.deb` e o `.rpm` são gerados pelo **nFPM v2.41.3**; AppImage usa **appimagetool 1.9.1** e runtime **20251108**, ambos com download validado por SHA-256. Não usa `continuous` nem FUSE durante o build.
- Os três formatos contêm exatamente o mesmo binário. Antes do upload, a pipeline extrai os três sem instalá-los e confere binário, ícones, lançador, regras USB, scripts e dependências.
- `.github/workflows/ci.yml` também compila a variante Linux nativa de produção, valida ícones/scripts e executa testes Linux sem acessar hardware.

Os pacotes nativos instalam o executável em `/usr/bin/go-deck`, ícones/lançador em `/usr/share`, regras em `/usr/lib/udev/rules.d` e configuração de carregamento de `uinput` em `/usr/lib/modules-load.d`. Hooks recarregam regras e caches quando as ferramentas estão disponíveis. A instalação/remoção não abre o app nem remove `~/.config/DeckPilot`.

### Limites do AppImage

O AppImage **não embute GTK3/WebKitGTK**: utiliza as bibliotecas da distribuição para preservar integração, sandbox do WebKit e atualizações de segurança. Não é um binário totalmente estático nem dispensa dependências nativas.

Requer Linux x86_64, glibc >= 2.35 e GTK3/WebKitGTK 4.1. Se uma build local usar símbolos de glibc mais novos, os pacotes nativos declararão a versão efetivamente detectada no ELF. O AppImage inclui uma checagem de bibliotecas ausentes antes de abrir o app.

No AppImage as regras USB estão disponíveis para extração, mas não são instaladas automaticamente nem elevam privilégios. Instale-as conforme `docs/linux.md`, ou prefira o `.deb`/`.rpm`.

## Empacotamento local

Em Ubuntu 22.04, além das dependências de compilação de `docs/linux.md`:

```bash
sudo apt install desktop-file-utils rpm file libarchive-tools
bash scripts/install-linux-packaging-tools.sh
export PATH="$HOME/.cache/go-deck/packaging:$(go env GOPATH)/bin:$PATH"
wails build -tags webkit2_41
bash scripts/package-linux.sh 1.2.3
bash scripts/check-linux-packages.sh 1.2.3
```

O verificador também exige `dpkg-deb` (normalmente já instalado no Debian/Ubuntu). Em Fedora/Nobara, instale `desktop-file-utils`, `rpm`, `file`, `bsdtar` (libarchive) e `dpkg`. `PACKAGING_TOOLS_DIR` permite mudar o diretório das ferramentas; `APPIMAGE_RUNTIME_FILE` permite indicar um runtime local. O empacotador rejeita binários de outra arquitetura ou compilados contra WebKitGTK 4.0.

Saída em `build/release/` (ignorada pelo Git):

```text
go-deck_1.2.3_linux_amd64.AppImage
go-deck_1.2.3_linux_amd64.deb
go-deck_1.2.3_linux_amd64.rpm
go-deck_1.2.3_linux_amd64.sha256
```

Verificar integridade:

```bash
cd build/release
sha256sum --check go-deck_1.2.3_linux_amd64.sha256
```

## Instalação dos pacotes

```bash
# Debian/Ubuntu: resolve também as dependências.
sudo apt install ./go-deck_1.2.3_linux_amd64.deb

# Fedora/Nobara:
sudo dnf install ./go-deck_1.2.3_linux_amd64.rpm

# AppImage:
chmod +x go-deck_1.2.3_linux_amd64.AppImage
./go-deck_1.2.3_linux_amd64.AppImage
# Alternativa sem FUSE:
./go-deck_1.2.3_linux_amd64.AppImage --appimage-extract-and-run
```

Não execute o aplicativo como root. Após instalar um pacote nativo, reconecte o Vision 2 e, se necessário, reabra a sessão para atualizar as permissões `uaccess`.
