//go:build linux

package appicon

import (
	"os"
	"path/filepath"
	"testing"
)

func put(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestLinuxXDGAppsAndIcons(t *testing.T) {
	user, system := t.TempDir(), t.TempDir()
	t.Setenv("XDG_DATA_HOME", user)
	t.Setenv("XDG_DATA_DIRS", system)
	iconPath := filepath.Join(system, "icons", "hicolor", "128x128", "apps", "demo.png")
	put(t, iconPath, "PNG")
	app := filepath.Join(system, "applications", "demo.desktop")
	put(t, app, "[Desktop Entry]\nType=Application\nName=Demo\nIcon=demo\nExec=demo\n[Desktop Action Other]\nName=Não usar este nome\nIcon=outro\n")
	put(t, filepath.Join(system, "applications", "hidden.desktop"), "[Desktop Entry]\nType=Application\nName=Oculto\nHidden=true\n")
	put(t, filepath.Join(system, "applications", "override.desktop"), "[Desktop Entry]\nType=Application\nName=Sobrescrito\n")
	put(t, filepath.Join(user, "applications", "override.desktop"), "[Desktop Entry]\nHidden=true\n")
	provider := linuxProvider{}
	apps, err := provider.List()
	if err != nil || len(apps) != 1 {
		t.Fatalf("%v, %v", apps, err)
	}
	if apps[0].Name != "Demo" || apps[0].Path != app || apps[0].Icon != "data:image/png;base64,UE5H" {
		t.Fatal(apps[0])
	}
	icon, err := provider.Extract(app)
	if err != nil || icon != apps[0].Icon {
		t.Fatalf("%s %v", icon, err)
	}
	icon, err = provider.Extract("/usr/bin/demo")
	if err != nil || icon != apps[0].Icon {
		t.Fatalf("%s %v", icon, err)
	}
}

func TestLinuxIconRejectsTraversalAndUnsupported(t *testing.T) {
	for _, name := range []string{"", "../segredo", "demo*"} {
		if _, err := resolveIcon(name); err == nil {
			t.Fatal(name)
		}
	}
	path := filepath.Join(t.TempDir(), "icon.txt")
	put(t, path, "texto")
	if _, err := iconData(path); err == nil {
		t.Fatal("formato inválido aceito")
	}
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	t.Setenv("XDG_DATA_DIRS", t.TempDir())
	apps, err := (linuxProvider{}).List()
	if err != nil || apps == nil || len(apps) != 0 {
		t.Fatalf("%v, %v", apps, err)
	}
}
