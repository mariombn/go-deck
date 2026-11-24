#!/usr/bin/env bash
# Empacota o MESMO binário Wails em AppImage, Debian e RPM (não recompila).
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/.."
export VERSION="${1:?Uso: bash scripts/package-linux.sh 1.2.3}"
VERSION="${VERSION#v}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.+-]+)?$ ]]; then
  echo "Versão inválida: $VERSION (use SemVer, por exemplo 1.2.3 ou 1.2.3-beta.1)." >&2
  exit 1
fi
if [[ $(uname -m) != x86_64 ]]; then
  echo 'Os pacotes Linux de release são, por enquanto, x86_64/amd64.' >&2
  exit 1
fi
for tool in nfpm appimagetool desktop-file-validate readelf; do
  command -v "$tool" >/dev/null || { echo "Ferramenta ausente: $tool (ver docs/releases.md)" >&2; exit 1; }
done
if [[ ! -x build/bin/go-deck ]]; then
  echo 'Compile antes com: bash scripts/build-linux.sh' >&2
  exit 1
fi
if ! readelf -h build/bin/go-deck | grep -q 'Advanced Micro Devices X86-64'; then
  echo 'O binário precisa ser ELF Linux x86_64.' >&2
  exit 1
fi
if ! readelf -d build/bin/go-deck | grep -q 'libwebkit2gtk-4.1.so'; then
  echo 'Os pacotes usam WebKitGTK 4.1. Recompile com: wails build -tags webkit2_41' >&2
  exit 1
fi
# Não promete uma glibc mais antiga que a efetivamente usada pelo binário
# (builds oficiais em Ubuntu 22.04; builds locais podem exigir versão maior).
detected_glibc="$(readelf --version-info build/bin/go-deck | grep -o 'GLIBC_[0-9][0-9.]*' | sort -Vu | tail -n 1)"
export GLIBC_VERSION="$(printf '%s\n' 2.35 "${detected_glibc#GLIBC_}" | sort -V | tail -n 1)"
desktop-file-validate build/linux/go-deck.desktop
runtime="${APPIMAGE_RUNTIME_FILE:-$(dirname "$(command -v appimagetool)")/runtime-x86_64}"
if [[ ! -f "$runtime" ]]; then
  echo 'Runtime AppImage ausente: rode scripts/install-linux-packaging-tools.sh.' >&2
  exit 1
fi
runtime="$(realpath "$runtime")"
mkdir -p build/release
out="$(realpath build/release)"
name="go-deck_${VERSION}_linux_amd64"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
appdir="$staging/go-deck.AppDir"
install -Dm755 build/bin/go-deck "$appdir/usr/bin/go-deck"
install -Dm755 build/linux/AppRun "$appdir/AppRun"
install -Dm644 build/linux/go-deck.desktop "$appdir/go-deck.desktop"
install -Dm644 build/linux/go-deck.desktop "$appdir/usr/share/applications/go-deck.desktop"
install -Dm644 build/linux/icons/go-deck-256.png "$appdir/go-deck.png"
ln -s go-deck.png "$appdir/.DirIcon"
for size in 16 24 32 48 64 128 256 512; do
  install -Dm644 "build/linux/icons/go-deck-$size.png" "$appdir/usr/share/icons/hicolor/${size}x${size}/apps/go-deck.png"
done
install -Dm644 build/appicon.svg "$appdir/usr/share/icons/hicolor/scalable/apps/go-deck.svg"
install -Dm644 build/linux/io.github.mariombn.go-deck.metainfo.xml "$appdir/usr/share/metainfo/io.github.mariombn.go-deck.metainfo.xml"
install -Dm644 docs/linux.md "$appdir/usr/share/doc/go-deck/linux.md"
install -Dm644 LICENSE "$appdir/usr/share/licenses/go-deck/LICENSE"
# Dentro do AppImage, regras são apenas recursos para instalação manual.
install -Dm644 build/linux/70-deckpilot.rules "$appdir/usr/lib/udev/rules.d/70-deckpilot.rules"
install -Dm644 build/linux/deckpilot-uinput.conf "$appdir/usr/lib/modules-load.d/deckpilot-uinput.conf"
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 appimagetool \
  --no-appstream --mksquashfs-opt=-processors --mksquashfs-opt=2 \
  --runtime-file "$runtime" "$appdir" "$staging/$name.AppImage"
nfpm package --config build/linux/nfpm.yaml --packager deb --target "$staging/$name.deb"
nfpm package --config build/linux/nfpm.yaml --packager rpm --target "$staging/$name.rpm"
# Só publica os resultados depois que os três formatos estiverem completos.
install -m755 "$staging/$name.AppImage" "$out/$name.AppImage"
install -m644 "$staging/$name.deb" "$out/$name.deb"
install -m644 "$staging/$name.rpm" "$out/$name.rpm"
(cd "$out" && sha256sum "$name.AppImage" "$name.deb" "$name.rpm" > "$name.sha256")
printf 'Pacotes e checksums prontos: %s/%s.*\n' "$out" "$name"
