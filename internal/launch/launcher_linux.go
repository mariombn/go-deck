//go:build linux

package launch

import (
	"os/exec"
	"path/filepath"
	"strings"

	"go-deck/internal/i18n"
)

type linuxLauncher struct{}

func newLauncher() Launcher { return linuxLauncher{} }

func (linuxLauncher) Launch(path string, args []string) error {
	var cmd *exec.Cmd
	if strings.EqualFold(filepath.Ext(path), ".desktop") {
		// gio respeita os campos Exec/TryExec sem interpretar comandos num shell.
		cmd = exec.Command("gio", append([]string{"launch", path}, args...)...)
	} else {
		cmd = exec.Command(path, args...)
	}
	if err := cmd.Start(); err != nil {
		return i18n.Wrap("errors.launch.launchFailed", map[string]any{"path": path}, err)
	}
	go cmd.Wait()
	return nil
}

func (linuxLauncher) OpenURL(url string) error {
	cmd := exec.Command("xdg-open", url)
	if err := cmd.Start(); err != nil {
		return i18n.Wrap("errors.launch.urlOpenFailed", map[string]any{"url": url}, err)
	}
	go cmd.Wait()
	return nil
}
