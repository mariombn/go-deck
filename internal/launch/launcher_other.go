//go:build !windows

package launch

import "fmt"

// otherLauncher é um stub para SOs ainda não suportados. Mantém o pacote
// compilável em qualquer plataforma (CI/validação) e marca onde entram as
// futuras implementações (macOS: "open"; Linux: "xdg-open"), atrás da mesma
// interface Launcher.
type otherLauncher struct{}

func newLauncher() Launcher { return otherLauncher{} }

func (otherLauncher) Launch(path string, args []string) error {
	return fmt.Errorf("launch de processo não implementado neste SO (POC só suporta Windows)")
}

func (otherLauncher) OpenURL(url string) error {
	return fmt.Errorf("abertura de URL não implementada neste SO (POC só suporta Windows)")
}
