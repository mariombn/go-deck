//go:build linux

package launch

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func helper(t *testing.T, dir, name string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$DECKPILOT_TEST_OUTPUT\"\n"), 0755); err != nil {
		t.Fatal(err)
	}
	return path
}

func awaitArgs(t *testing.T, path, want string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		data, _ := os.ReadFile(path)
		if string(data) == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	data, _ := os.ReadFile(path)
	t.Fatalf("argumentos: %q; esperado %q", data, want)
}

func TestLinuxLaunchAndURLWithoutShell(t *testing.T) {
	dir := t.TempDir()
	output := filepath.Join(dir, "output")
	t.Setenv("PATH", dir)
	t.Setenv("DECKPILOT_TEST_OUTPUT", output)
	bin := helper(t, dir, "programa com espaço")
	helper(t, dir, "gio")
	helper(t, dir, "xdg-open")
	l := linuxLauncher{}
	if err := l.Launch(bin, []string{"um argumento", "$(não executar)"}); err != nil {
		t.Fatal(err)
	}
	awaitArgs(t, output, "um argumento\n$(não executar)\n")
	os.Remove(output)
	if err := l.Launch("/tmp/app com espaço.desktop", []string{"arquivo"}); err != nil {
		t.Fatal(err)
	}
	awaitArgs(t, output, "launch\n/tmp/app com espaço.desktop\narquivo\n")
	os.Remove(output)
	if err := l.OpenURL("https://example.org/?a=1&b=2"); err != nil {
		t.Fatal(err)
	}
	awaitArgs(t, output, "https://example.org/?a=1&b=2\n")
	if err := l.Launch(filepath.Join(dir, "inexistente"), nil); err == nil {
		t.Fatal("falha ignorada")
	}
}
