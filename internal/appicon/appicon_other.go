//go:build !windows && !darwin

package appicon

import "go-deck/internal/i18n"

// stubProvider para SOs sem suporte a extração de ícone (Linux e outros). Lista
// vazia + erro na extração; o build cross-platform continua válido.
type stubProvider struct{}

func newProvider() Provider { return stubProvider{} }

func (stubProvider) List() ([]AppEntry, error) { return []AppEntry{}, nil }

func (stubProvider) Extract(path string) (string, error) {
	return "", i18n.New("errors.appicon.unsupported", nil)
}
