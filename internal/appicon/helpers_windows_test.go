//go:build windows

package appicon

import (
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"
)

// preencher cria um RGBA size×size com cor uniforme.
func preencher(w, h int, c color.RGBA) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetRGBA(x, y, c)
		}
	}
	return img
}

// TestEncodePNGDataURL: produz um data URL PNG base64 decodificável de volta
// para uma imagem PNG válida.
func TestEncodePNGDataURL(t *testing.T) {
	img := preencher(4, 4, color.RGBA{R: 10, G: 20, B: 30, A: 255})
	url, err := encodePNGDataURL(img)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	const prefixo = "data:image/png;base64,"
	if !strings.HasPrefix(url, prefixo) {
		t.Fatalf("data URL não tem o prefixo esperado: %.40q", url)
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(url, prefixo))
	if err != nil {
		t.Fatalf("base64 inválido: %v", err)
	}
	if _, err := png.Decode(strings.NewReader(string(raw))); err != nil {
		t.Fatalf("payload não é PNG válido: %v", err)
	}
}

// TestClamp8: satura em [0,255] e arredonda.
func TestClamp8(t *testing.T) {
	casos := []struct {
		in   float64
		want uint8
	}{
		{-5, 0},
		{0, 0},
		{127.4, 127},
		{127.6, 128},
		{255, 255},
		{300, 255},
	}
	for _, c := range casos {
		if got := clamp8(c.in); got != c.want {
			t.Errorf("clamp8(%v) = %d, esperado %d", c.in, got, c.want)
		}
	}
}

// TestTrimTransparentRecorta: borda totalmente transparente é removida,
// mantendo só a região opaca central.
func TestTrimTransparentRecorta(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	// Um único pixel opaco em (3,4) — todo o resto é transparente (alfa 0).
	img.SetRGBA(3, 4, color.RGBA{R: 255, A: 255})
	out := trimTransparent(img)
	if out.Bounds().Dx() != 1 || out.Bounds().Dy() != 1 {
		t.Fatalf("recorte = %dx%d, esperado 1x1", out.Bounds().Dx(), out.Bounds().Dy())
	}
	r, _, _, a := out.At(0, 0).RGBA()
	if a == 0 || r == 0 {
		t.Fatalf("pixel recortado deveria ser o opaco vermelho, veio r=%d a=%d", r>>8, a>>8)
	}
}

// TestTrimTransparentTotalmenteVazio: imagem 100% transparente é devolvida sem
// alteração (não há nada para recortar).
func TestTrimTransparentTotalmenteVazio(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 6, 6))
	out := trimTransparent(img)
	if out.Bounds() != img.Bounds() {
		t.Fatalf("imagem vazia não deveria ser recortada: %v", out.Bounds())
	}
}

// TestTrimTransparentJaApertado: imagem sem borda transparente é devolvida tal
// qual (sem cópia desnecessária de dimensão diferente).
func TestTrimTransparentJaApertado(t *testing.T) {
	img := preencher(5, 5, color.RGBA{B: 255, A: 255})
	out := trimTransparent(img)
	if out.Bounds().Dx() != 5 || out.Bounds().Dy() != 5 {
		t.Fatalf("dimensão = %dx%d, esperado 5x5", out.Bounds().Dx(), out.Bounds().Dy())
	}
}

// TestScaleToFitReduz: imagem maior que max é reduzida mantendo a proporção.
func TestScaleToFitReduz(t *testing.T) {
	img := preencher(256, 128, color.RGBA{G: 255, A: 255})
	out := scaleToFit(img, 128)
	if out.Bounds().Dx() != 128 {
		t.Errorf("largura = %d, esperado 128", out.Bounds().Dx())
	}
	// Proporção 2:1 preservada -> altura 64.
	if out.Bounds().Dy() != 64 {
		t.Errorf("altura = %d, esperado 64 (proporção mantida)", out.Bounds().Dy())
	}
}

// TestScaleToFitNaoAmplia: imagem menor ou igual a max não é ampliada (mesma
// instância devolvida).
func TestScaleToFitNaoAmplia(t *testing.T) {
	img := preencher(64, 64, color.RGBA{A: 255})
	out := scaleToFit(img, 128)
	if out != img {
		t.Error("scaleToFit não deveria tocar imagem já menor que max")
	}
}

// TestBilinearCorUniforme: numa imagem de cor uniforme, a interpolação devolve
// a mesma cor em qualquer ponto fracionário.
func TestBilinearCorUniforme(t *testing.T) {
	img := preencher(4, 4, color.RGBA{R: 100, G: 150, B: 200, A: 255})
	r, g, b, a := bilinear(img, 1.5, 2.5)
	if r != 100 || g != 150 || b != 200 || a != 255 {
		t.Fatalf("bilinear uniforme = (%d,%d,%d,%d), esperado (100,150,200,255)", r, g, b, a)
	}
}
