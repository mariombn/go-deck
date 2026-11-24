#!/usr/bin/env bash
# Ferramentas de empacotamento fixadas, sem sudo nem dependência de FUSE.
set -euo pipefail
if [[ $(uname -m) != x86_64 ]]; then
  echo 'O empacotamento Linux de release é, por enquanto, x86_64/amd64.' >&2
  exit 1
fi
for tool in go curl sha256sum; do
  command -v "$tool" >/dev/null || { echo "Ferramenta ausente: $tool" >&2; exit 1; }
done
TOOLS="${PACKAGING_TOOLS_DIR:-$HOME/.cache/go-deck/packaging}"
mkdir -p "$TOOLS"
TOOLS="$(cd "$TOOLS" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch() {
  local name="$1" url="$2" checksum="$3"
  curl --fail --location --retry 3 "$url" --output "$tmp/$name"
  printf '%s  %s\n' "$checksum" "$tmp/$name" | sha256sum --check --status
  install -m 755 "$tmp/$name" "$TOOLS/$name"
}

GOBIN="$TOOLS" go install github.com/goreleaser/nfpm/v2/cmd/nfpm@v2.41.3
fetch appimagetool \
  https://github.com/AppImage/appimagetool/releases/download/1.9.1/appimagetool-x86_64.AppImage \
  ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0
# Evita o download implícito do runtime "continuous" pelo appimagetool.
fetch runtime-x86_64 \
  https://github.com/AppImage/type2-runtime/releases/download/20251108/runtime-x86_64 \
  2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d
printf 'Ferramentas prontas. Adicione ao PATH: %s\n' "$TOOLS"
