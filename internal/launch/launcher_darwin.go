//go:build darwin

package launch

import (
	"os/exec"
	"strings"

	"go-deck/internal/i18n"
)

// darwinLauncher implementa Launcher para macOS: usa "open" para bundles .app
// e exec direto para binários; OpenURL delega ao "open" do SO.
type darwinLauncher struct{}

func newLauncher() Launcher { return darwinLauncher{} }

func (darwinLauncher) Launch(path string, args []string) error {
	var cmd *exec.Cmd
	if strings.HasSuffix(path, ".app") {
		// "open app.app --args a b" passa argumentos ao bundle.
		if len(args) > 0 {
			cmd = exec.Command("open", append([]string{path, "--args"}, args...)...)
		} else {
			cmd = exec.Command("open", path)
		}
	} else {
		cmd = exec.Command(path, args...)
	}
	if err := cmd.Start(); err != nil {
		return i18n.Wrap("errors.launch.launchFailed", map[string]any{"path": path}, err)
	}
	go cmd.Wait()
	return nil
}

func (darwinLauncher) OpenURL(url string) error {
	cmd := exec.Command("open", url)
	if err := cmd.Start(); err != nil {
		return i18n.Wrap("errors.launch.urlOpenFailed", map[string]any{"url": url}, err)
	}
	go cmd.Wait()
	return nil
}
