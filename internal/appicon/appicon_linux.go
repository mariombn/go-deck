//go:build linux

package appicon

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type linuxProvider struct{}

func newProvider() Provider { return linuxProvider{} }

func dataDirs() []string {
	home, _ := os.UserHomeDir()
	local := os.Getenv("XDG_DATA_HOME")
	if local == "" {
		local = filepath.Join(home, ".local", "share")
	}
	shared := os.Getenv("XDG_DATA_DIRS")
	if shared == "" {
		shared = "/usr/local/share:/usr/share"
	}
	return append([]string{local}, filepath.SplitList(shared)...)
}

func desktopFields(path string) (map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	fields := map[string]string{}
	inEntry := false
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "[") {
			inEntry = line == "[Desktop Entry]"
			continue
		}
		if !inEntry || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if ok {
			fields[key] = value
		}
	}
	return fields, scanner.Err()
}

func iconData(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if info.Size() > 4*1024*1024 || !info.Mode().IsRegular() {
		return "", fmt.Errorf("ícone inválido ou maior que 4 MiB")
	}
	mime := map[string]string{".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}[strings.ToLower(filepath.Ext(path))]
	if mime == "" {
		return "", fmt.Errorf("formato de ícone não suportado")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

func resolveIcon(name string) (string, error) {
	if filepath.IsAbs(name) {
		return iconData(name)
	}
	if name == "" || strings.ContainsAny(name, `/\\*?[]`) {
		return "", fmt.Errorf("nome de ícone inválido")
	}
	for _, dir := range dataDirs() {
		for _, size := range []string{"128x128", "256x256", "scalable", "64x64", "48x48", "32x32"} {
			for _, ext := range []string{".png", ".svg", ""} {
				paths, _ := filepath.Glob(filepath.Join(dir, "icons", "*", size, "apps", name+ext))
				for _, path := range paths {
					if data, err := iconData(path); err == nil {
						return data, nil
					}
				}
			}
		}
		for _, ext := range []string{".png", ".svg", ""} {
			if data, err := iconData(filepath.Join(dir, "pixmaps", name+ext)); err == nil {
				return data, nil
			}
		}
	}
	return "", fmt.Errorf("ícone %q não encontrado nos diretórios XDG", name)
}

func (linuxProvider) List() ([]AppEntry, error) {
	entries := []AppEntry{}
	seen := map[string]bool{}
	for _, dir := range dataDirs() {
		root := filepath.Join(dir, "applications")
		// Inclui subdiretórios; a primeira entrada XDG com o mesmo desktop ID
		// prevalece, inclusive quando Hidden=true desativa uma entrada global.
		filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil || entry.IsDir() || filepath.Ext(path) != ".desktop" {
				return nil
			}
			rel, _ := filepath.Rel(root, path)
			id := strings.ReplaceAll(rel, string(filepath.Separator), "-")
			if seen[id] {
				return nil
			}
			seen[id] = true
			f, err := desktopFields(path)
			if err != nil || f["Type"] != "Application" || f["Hidden"] == "true" || f["NoDisplay"] == "true" || f["Name"] == "" {
				return nil
			}
			icon, _ := resolveIcon(f["Icon"])
			entries = append(entries, AppEntry{Name: f["Name"], Path: path, Icon: icon})
			return nil
		})
	}
	sort.Slice(entries, func(i, j int) bool { return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name) })
	return entries, nil
}

func (linuxProvider) Extract(path string) (string, error) {
	if filepath.Ext(path) == ".desktop" {
		f, err := desktopFields(path)
		if err != nil {
			return "", err
		}
		return resolveIcon(f["Icon"])
	}
	// Binários Linux não têm um recurso de ícone padronizado. Procura o
	// nome do executável no tema; o usuário também pode escolher o .desktop.
	return resolveIcon(filepath.Base(path))
}
