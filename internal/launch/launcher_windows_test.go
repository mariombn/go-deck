//go:build windows

package launch

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

// TestLaunchCaminhoVazio: path vazio é rejeitado ANTES de qualquer
// exec.Command — nenhum processo é iniciado.
func TestLaunchCaminhoVazio(t *testing.T) {
	l := New()
	err := l.Launch("", nil)
	if got := errKey(err); got != "errors.launch.emptyPath" {
		t.Fatalf("chave = %q, esperado errors.launch.emptyPath", got)
	}
}

// TestOpenURLVazia: URL vazia é rejeitada ANTES de qualquer exec.Command —
// nenhum navegador é aberto.
func TestOpenURLVazia(t *testing.T) {
	l := New()
	err := l.OpenURL("")
	if got := errKey(err); got != "errors.launch.urlEmpty" {
		t.Fatalf("chave = %q, esperado errors.launch.urlEmpty", got)
	}
}
