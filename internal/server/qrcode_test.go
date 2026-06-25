package server

import (
	"encoding/base64"
	"strings"
	"testing"
)

// TestQRDataURL: gera um data URL PNG base64 decodificável para uma URL comum.
func TestQRDataURL(t *testing.T) {
	const prefixo = "data:image/png;base64,"
	data, err := qrDataURL("http://192.168.0.42:8754/?t=deadbeef")
	if err != nil {
		t.Fatalf("qrDataURL erro: %v", err)
	}
	if !strings.HasPrefix(data, prefixo) {
		t.Fatalf("prefixo inesperado: %.40q", data)
	}
	// O payload após o prefixo deve ser base64 válido e não-vazio (PNG real).
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(data, prefixo))
	if err != nil {
		t.Fatalf("payload não é base64 válido: %v", err)
	}
	if len(raw) == 0 {
		t.Fatal("PNG decodificado está vazio")
	}
	// Assinatura PNG: 0x89 'P' 'N' 'G'.
	if len(raw) < 4 || raw[0] != 0x89 || raw[1] != 'P' || raw[2] != 'N' || raw[3] != 'G' {
		t.Fatalf("bytes não começam com a assinatura PNG: % x", raw[:4])
	}
}
