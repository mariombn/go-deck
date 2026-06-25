//go:build !windows && !darwin

package launch

import "go-deck/internal/i18n"

// otherLauncher é um stub para SOs ainda não suportados. Mantém o pacote
// compilável em qualquer plataforma (CI/validação) e marca onde entram as
// futuras implementações (macOS: "open"; Linux: "xdg-open"), atrás da mesma
// interface Launcher.
type otherLauncher struct{}

func newLauncher() Launcher { return otherLauncher{} }

func (otherLauncher) Launch(path string, args []string) error {
	return i18n.New("errors.launch.notImplemented", nil)
}

func (otherLauncher) OpenURL(url string) error {
	return i18n.New("errors.launch.urlNotImplemented", nil)
}
