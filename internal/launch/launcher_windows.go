package launch

import (
	"os/exec"

	"go-deck/internal/i18n"
)

// windowsLauncher usa os/exec nativo (Go puro, sem CGO) — coerente com a
// implementação de input no Windows.
type windowsLauncher struct{}

func newLauncher() Launcher { return windowsLauncher{} }

// Launch inicia o programa sem esperar (Start, não Run). Os args vão direto
// ao executável — não há shell, então não há interpretação de aspas/pipes,
// e portanto não há injeção de shell.
func (windowsLauncher) Launch(path string, args []string) error {
	if path == "" {
		return i18n.New("errors.launch.emptyPath", nil)
	}
	cmd := exec.Command(path, args...)
	if err := cmd.Start(); err != nil {
		return i18n.Wrap("errors.launch.launchFailed", map[string]any{"path": path}, err)
	}
	// Não esperamos o término (fire-and-forget); liberamos os recursos do
	// processo numa goroutine para não deixar zumbis.
	go func() { _ = cmd.Wait() }()
	return nil
}

// OpenURL abre a URL no app padrão via rundll32 + url.dll, evitando o uso de
// "cmd /c start" (que exigiria shell e abriria espaço para injeção).
func (windowsLauncher) OpenURL(url string) error {
	if url == "" {
		return i18n.New("errors.launch.urlEmpty", nil)
	}
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	if err := cmd.Start(); err != nil {
		return i18n.Wrap("errors.launch.urlOpenFailed", map[string]any{"url": url}, err)
	}
	go func() { _ = cmd.Wait() }()
	return nil
}
