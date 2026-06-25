//go:build windows

package input

import (
	"errors"
	"testing"

	"go-deck/internal/i18n"
)

// errKey extrai a chave i18n de um erro do backend (mesmo padrão de
// action_test.errKey).
func errKey(err error) string {
	var e *i18n.Error
	if errors.As(err, &e) {
		return e.Key
	}
	return ""
}

// TestSendKeysComboVazio: combo vazio é rejeitado ANTES de qualquer chamada ao
// SendInput — caminho de erro puro, sem efeito no SO.
func TestSendKeysComboVazio(t *testing.T) {
	c := New()
	err := c.SendKeys(nil, 0)
	if got := errKey(err); got != "errors.input.comboEmpty" {
		t.Fatalf("chave = %q, esperado errors.input.comboEmpty", got)
	}
}

// TestSendKeysTeclaDesconhecida: a validação é all-or-nothing — uma tecla
// inválida no combo aborta ANTES de enviar qualquer evento (nenhum keystroke
// real é disparado).
func TestSendKeysTeclaDesconhecida(t *testing.T) {
	c := New()
	// "ctrl" é válido, mas "naoexiste" não — o combo todo é rejeitado sem
	// disparar nada ao SO.
	err := c.SendKeys([]string{"ctrl", "naoexiste"}, 0)
	if got := errKey(err); got != "errors.input.unknownKey" {
		t.Fatalf("chave = %q, esperado errors.input.unknownKey", got)
	}
}
