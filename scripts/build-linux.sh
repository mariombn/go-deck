#!/usr/bin/env bash
# Compila o desktop Linux com a versão de WebKitGTK disponível.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v go >/dev/null; then
  echo 'Instale Go >= 1.23 e adicione seu diretório bin ao PATH.' >&2
  exit 1
fi
export PATH="$(go env GOPATH)/bin:$PATH"
if ! command -v wails >/dev/null; then
  echo 'Instale a CLI: go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0' >&2
  exit 1
fi
if ! command -v npm >/dev/null || ! command -v pkg-config >/dev/null; then
  echo 'Instale Node.js/npm e pkg-config (ver docs/linux.md).' >&2
  exit 1
fi
if ! pkg-config --exists gtk+-3.0; then
  echo 'Instale os headers GTK3 (gtk3-devel ou libgtk-3-dev; ver docs/linux.md).' >&2
  exit 1
fi
if pkg-config --exists webkit2gtk-4.1; then
  exec wails build -tags webkit2_41 "$@"
elif pkg-config --exists webkit2gtk-4.0; then
  exec wails build "$@"
else
  echo 'Instale WebKitGTK 4.1 de desenvolvimento (ver docs/linux.md).' >&2
  exit 1
fi
