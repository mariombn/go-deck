package main

import (
	"testing"

	"go-deck/internal/action"
	"go-deck/internal/config"
	"go-deck/internal/i18n"
)

// redirectConfig aponta o diretório de config (os.UserConfigDir) para um
// temporário, em todos os SOs, para que os testes não toquem o config.json
// real do usuário. Windows lê APPDATA; macOS, HOME (…/Library/Application
// Support); Linux, XDG_CONFIG_HOME/HOME.
func redirectConfig(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("APPDATA", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("HOME", dir)
}

// newTestApp monta uma App com um Store de verdade (em diretório temporário) e
// SEM servidor — suficiente para exercitar as guardas de "servidor não iniciado"
// e os bindings que só dependem do Store.
func newTestApp(t *testing.T) *App {
	t.Helper()
	redirectConfig(t)
	store, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load: %v", err)
	}
	return &App{store: store}
}

// TestLoadLocales prova que o //go:embed dos locales parseia e é carregado no
// pacote i18n: após loadLocales, uma chave conhecida resolve para o texto (e
// não cai no fallback de devolver a própria chave).
func TestLoadLocales(t *testing.T) {
	loadLocales()
	got := i18n.T("en", "errors.server.notStarted", nil)
	if got != "server not started" {
		t.Fatalf("T(notStarted) = %q, esperava o texto traduzido (locales não carregaram?)", got)
	}
}

func TestLangFallback(t *testing.T) {
	// Sem store, lang() cai para o idioma default (config ainda não carregou).
	app := &App{}
	if got := app.lang(); got != i18n.DefaultLang {
		t.Fatalf("lang() sem store = %q, quero %q", got, i18n.DefaultLang)
	}
	// Com store, reflete o idioma da config.
	app = newTestApp(t)
	if got := app.lang(); got != app.store.Language() {
		t.Fatalf("lang() = %q, quero %q", got, app.store.Language())
	}
}

func TestGetConfig(t *testing.T) {
	app := newTestApp(t)
	cfg := app.GetConfig()
	if cfg.Language != app.store.Get().Language {
		t.Fatalf("GetConfig não reflete o Store")
	}
	// O token nunca é exposto ao frontend (clone o zera).
	if cfg.Server.Token != "" {
		t.Fatalf("GetConfig vazou o token de pareamento: %q", cfg.Server.Token)
	}
}

// TestNilServerGuards: com server nil, os bindings de rede/OBS devolvem erro/
// "notStarted" em vez de panicar.
func TestNilServerGuards(t *testing.T) {
	app := newTestApp(t)

	if info := app.GetNetworkInfo(); info.Error == "" {
		t.Fatal("GetNetworkInfo sem server deveria reportar erro")
	}
	if _, err := app.GetQRCode(); err == nil {
		t.Fatal("GetQRCode sem server deveria falhar")
	}
	if err := app.TestOBS(config.OBSConfig{}); err == nil {
		t.Fatal("TestOBS sem server deveria falhar")
	}
	if info := app.SetActiveIP("192.168.0.10"); info.Error == "" {
		t.Fatal("SetActiveIP sem server deveria devolver NetworkInfo com erro")
	}
}

// TestSaveConfigNilServer: persiste sem panicar quando não há server (o
// broadcast é pulado) e devolve a config normalizada (com ids atribuídos).
func TestSaveConfigNilServer(t *testing.T) {
	app := newTestApp(t)
	cfg := app.store.Get()
	cfg.Pages[0].Buttons = append(cfg.Pages[0].Buttons, config.Button{
		Label:    "Novo",
		Position: config.Position{Row: 0, Col: 0},
		Action:   action.Spec{Type: "keypress", Keys: []string{"a"}},
	})
	saved, err := app.SaveConfig(cfg)
	if err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	// O id do botão novo é atribuído no normalize do Replace.
	var found bool
	for _, b := range saved.Pages[0].Buttons {
		if b.Label == "Novo" && b.ID != "" {
			found = true
		}
	}
	if !found {
		t.Fatal("SaveConfig deveria devolver o botão novo com id atribuído")
	}
}

// TestSetLanguageNilServer: grava o idioma e devolve a config, sem panicar com
// server nil.
func TestSetLanguageNilServer(t *testing.T) {
	app := newTestApp(t)
	saved, err := app.SetLanguage("en")
	if err != nil {
		t.Fatalf("SetLanguage: %v", err)
	}
	if saved.Language != "en" {
		t.Fatalf("SetLanguage não aplicou o idioma: %q", saved.Language)
	}
}
