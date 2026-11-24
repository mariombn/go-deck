#!/usr/bin/env python3
"""Gera todos os ícones a partir de build/appicon.svg (Inkscape + ImageMagick)."""

from pathlib import Path
import hashlib
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
SIZES = (16, 24, 32, 48, 64, 128, 256, 512)


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def main():
    for tool in ("inkscape", "magick"):
        if not shutil.which(tool):
            raise SystemExit(f"Instale {tool} antes de gerar os ícones.")

    source = ROOT / "build/appicon.svg"
    master = ROOT / "build/appicon.png"
    run("inkscape", source, "--export-type=png", "--export-width=1024",
        "--export-height=1024", f"--export-filename={master}")
    icons = ROOT / "build/linux/icons"
    icons.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        run("magick", master, "-resize", f"{size}x{size}", "-strip",
            icons / f"go-deck-{size}.png")

    # Windows recebe todas as resoluções no mesmo ICO; macOS usa o PNG
    # mestre, convertido em iconfile.icns pelo empacotador nativo do Wails.
    run("magick", *(icons / f"go-deck-{size}.png" for size in SIZES if size <= 256),
        ROOT / "build/windows/icon.ico")

    public = ROOT / "frontend/public"
    for size in (192, 512):
        run("magick", master, "-resize", f"{size}x{size}", "-strip",
            public / f"icon-{size}.png")
    run("magick", master, "-resize", "180x180", "-strip", public / "apple-touch-icon.png")
    shutil.copyfile(source, public / "favicon.svg")
    # Favicon raster também atende navegadores/webviews sem favicon SVG.
    with tempfile.TemporaryDirectory() as directory:
        png = Path(directory) / "favicon.png"
        run("magick", master, "-resize", "32x32", "-strip", png)
        run("magick", png, public / "favicon.ico")
    generated = [source, master, ROOT / "build/windows/icon.ico", *sorted(icons.glob("*.png")),
                 *(public / name for name in ("icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon.svg", "favicon.ico"))]
    checksums = "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(ROOT).as_posix()}\n"
                        for path in generated)
    (ROOT / "build/icons.sha256").write_text(checksums, encoding="utf-8")
    print("Ícones Windows, macOS, Linux e navegador atualizados.")


if __name__ == "__main__":
    main()
