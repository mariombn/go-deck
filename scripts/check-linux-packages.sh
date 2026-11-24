#!/usr/bin/env bash
# Inspeção offline: extrai pacotes sem instalar, abrir GUI ou tocar no USB.
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/.."
version="${1:?Uso: bash scripts/check-linux-packages.sh 1.2.3}"
version="${version#v}"
name="go-deck_${version}_linux_amd64"
out="$(realpath build/release)"
for tool in dpkg-deb rpm rpm2cpio cpio desktop-file-validate; do
  command -v "$tool" >/dev/null || { echo "Ferramenta ausente: $tool" >&2; exit 1; }
done
(cd "$out" && sha256sum --check "$name.sha256")
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
dpkg-deb --extract "$out/$name.deb" "$work/deb"
dpkg-deb --control "$out/$name.deb" "$work/deb-control"
test "$(dpkg-deb --field "$out/$name.deb" Architecture)" = amd64
mkdir -p "$work/rpm" "$work/appimage"
(rpm2cpio "$out/$name.rpm" | (cd "$work/rpm" && cpio -idm --quiet))
test "$(rpm -qp --qf '%{ARCH}' "$out/$name.rpm")" = x86_64
(cd "$work/appimage" && "$out/$name.AppImage" --appimage-extract > /dev/null)
appdir="$work/appimage/squashfs-root"
test -x "$appdir/AppRun"
for root in "$work/deb" "$work/rpm" "$appdir"; do
  test -x "$root/usr/bin/go-deck"
  cmp build/bin/go-deck "$root/usr/bin/go-deck"
  cmp build/appicon.svg "$root/usr/share/icons/hicolor/scalable/apps/go-deck.svg"
  cmp build/linux/icons/go-deck-256.png "$root/usr/share/icons/hicolor/256x256/apps/go-deck.png"
  cmp build/linux/70-deckpilot.rules "$root/usr/lib/udev/rules.d/70-deckpilot.rules"
  cmp build/linux/deckpilot-uinput.conf "$root/usr/lib/modules-load.d/deckpilot-uinput.conf"
  desktop-file-validate "$root/usr/share/applications/go-deck.desktop"
done
cmp build/linux/postinstall.sh "$work/deb-control/postinst"
cmp build/linux/postremove.sh "$work/deb-control/postrm"
rpm -qp --scripts "$out/$name.rpm" > "$work/rpm-scripts"
grep -q 'modprobe uinput' "$work/rpm-scripts"
grep -q 'libwebkit2gtk-4.1-0' "$work/deb-control/control"
rpm -qp --requires "$out/$name.rpm" > "$work/rpm-depends"
grep -q webkit2gtk4.1 "$work/rpm-depends"
printf 'AppImage, .deb e .rpm válidos: mesmo binário, ícones, regras USB e dependências.\n'
