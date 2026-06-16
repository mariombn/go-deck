package server

import (
	"encoding/base64"

	qrcode "github.com/skip2/go-qrcode"
)

// qrDataURL gera um PNG do QR Code da URL e o devolve como data URL base64,
// pronto para ser usado em <img src=...> no frontend.
func qrDataURL(url string) (string, error) {
	png, err := qrcode.Encode(url, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), nil
}
