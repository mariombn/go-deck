#!/usr/bin/env bash
# Mantém a tag pública (ex.: v0.1) e deriva SemVer para os pacotes (0.1.0).
set -euo pipefail
version="${1:?Uso: bash scripts/normalize-release-version.sh v0.1}"
version="${version#v}"
if [[ "$version" =~ ^[0-9]+\.[0-9]+$ ]]; then
  version="$version.0"
fi
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?([+][0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
  echo "Tag/versão inválida: $1 (use v0.1, v0.1.0 ou v0.1.0-beta.1)." >&2
  exit 1
fi
printf '%s\n' "$version"
