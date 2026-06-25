package server

import (
	"embed"
	"errors"
	"testing"

	"go-deck/internal/config"
)

// errFake é um erro cru (sem chave i18n) usado para simular falha de execução
// vinda de uma camada de SO (Launcher/Input). A borda repassa a mensagem crua.
var errFake = errors.New("falha simulada do SO")

// fakeInput registra a última chamada de SendKeys, para checar o dispatch das
// ações keypress/discord sem enviar teclas reais ao SO.
type fakeInput struct {
	keys   []string
	holdMs int
	calls  int
	err    error
}

func (f *fakeInput) SendKeys(keys []string, holdMs int) error {
	f.calls++
	f.keys = keys
	f.holdMs = holdMs
	return f.err
}

// fakeLauncher registra as chamadas de Launch/OpenURL, sem abrir processos nem
// o navegador de verdade.
type fakeLauncher struct {
	launchPath string
	launchArgs []string
	launchN    int
	openedURL  string
	openN      int
	err        error
}

func (f *fakeLauncher) Launch(path string, args []string) error {
	f.launchN++
	f.launchPath = path
	f.launchArgs = args
	return f.err
}

func (f *fakeLauncher) OpenURL(url string) error {
	f.openN++
	f.openedURL = url
	return f.err
}

// newStore monta um config.Store via a API pública (config.Load + Replace),
// apontando o diretório de config para um TempDir do teste — assim não toca o
// config.json real do usuário. Devolve o Store já com o deck dado.
//
// Pegadinha: config.Load/Replace persistem em disco; por isso redirecionamos
// %APPDATA%/XDG_CONFIG_HOME/HOME para o TempDir antes de chamar Load.
func newStore(t *testing.T, cfg config.DeckConfig) *config.Store {
	t.Helper()
	dir := t.TempDir()
	// Cobrir os três caminhos de os.UserConfigDir (Windows/Linux/macOS).
	t.Setenv("APPDATA", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("HOME", dir)

	store, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load: %v", err)
	}
	if _, err := store.Replace(cfg); err != nil {
		t.Fatalf("store.Replace: %v", err)
	}
	return store
}

// deckComBotao devolve um DeckConfig com uma única página e o botão dado, na
// posição (0,0). O token é fixado para os testes que dependem dele.
func deckComBotao(token string, btn config.Button) config.DeckConfig {
	btn.Position = config.Position{Row: 0, Col: 0}
	return config.DeckConfig{
		Pages: []config.Page{{
			ID:      "page_test",
			Name:    "Teste",
			Grid:    config.Grid{Rows: 1, Cols: 1},
			Buttons: []config.Button{btn},
		}},
		Server: config.Server{Port: 8754, Token: token},
	}
}

// emptyAssets é um embed.FS vazio, suficiente para construir o Server nos
// testes (não exercitamos o servidor de assets aqui).
var emptyAssets embed.FS
