#!/usr/bin/env python3
"""Valida ícones versionados sem instalar ferramentas gráficas na CI."""

from pathlib import Path
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parent.parent


def png_size(path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"PNG inválido: {path}"
    return struct.unpack(">II", data[16:24])


def main():
    for line in (ROOT / "build/icons.sha256").read_text().splitlines():
        expected, name = line.split("  ", 1)
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, (
            f"Ícone fora de sincronia: {name}. Rode python3 scripts/generate-icons.py."
        )
    assert png_size(ROOT / "build/appicon.png") == (1024, 1024)
    for size in (16, 24, 32, 48, 64, 128, 256, 512):
        assert png_size(ROOT / f"build/linux/icons/go-deck-{size}.png") == (size, size)
    data = (ROOT / "build/windows/icon.ico").read_bytes()
    reserved, kind, count = struct.unpack_from("<HHH", data)
    assert (reserved, kind, count) == (0, 1, 7), "ICO precisa ter sete resoluções"
    sizes = set()
    for index in range(count):
        width, height, _, _, _, _, length, offset = struct.unpack_from("<BBBBHHII", data, 6 + index * 16)
        assert offset + length <= len(data), "Frame ICO truncado"
        sizes.add((width or 256, height or 256))
    assert sizes == {(n, n) for n in (16, 24, 32, 48, 64, 128, 256)}
    public = ROOT / "frontend/public"
    assert (public / "favicon.svg").read_bytes() == (ROOT / "build/appicon.svg").read_bytes()
    assert png_size(public / "apple-touch-icon.png") == (180, 180)
    manifest = json.loads((public / "manifest.webmanifest").read_text())
    for icon in manifest["icons"]:
        width, height = map(int, icon["sizes"].split("x"))
        assert png_size(public / icon["src"]) == (width, height)
    print("Ícones Windows/macOS/Linux/PWA válidos e sincronizados.")


if __name__ == "__main__":
    main()
