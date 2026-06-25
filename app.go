package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"runtime"
	"time"

	"go-deck/internal/appicon"
	"go-deck/internal/config"
	"go-deck/internal/input"
	"go-deck/internal/launch"
	"go-deck/internal/server"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App é a struct exposta ao frontend desktop via bindings do Wails.
type App struct {
	ctx      context.Context
	assets   embed.FS
	input    input.InputController
	launcher launch.Launcher
	appicons appicon.Provider
	store    *config.Store
	server   *server.Server
}

// NewApp cria a App, já com o controller de input e o launcher do SO atual.
func NewApp(assets embed.FS) *App {
	return &App{
		assets:   assets,
		input:    input.New(),
		launcher: launch.New(),
		appicons: appicon.New(),
	}
}

// startup roda quando a janela abre: carrega a config e sobe o servidor de
// rede (HTTP + WebSocket) numa goroutine.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	store, err := config.Load()
	if err != nil {
		log.Printf("erro carregando config: %v", err)
		return
	}
	a.store = store
	log.Printf("config carregada de %s", store.Path())

	a.server = server.New(store, a.input, a.launcher, a.assets)
	a.server.Start()
}

// --- Bindings expostos ao frontend desktop ---

// GetConfig devolve a config atual.
func (a *App) GetConfig() config.DeckConfig {
	return a.store.Get()
}

// SaveConfig persiste a config (atribuindo ids a botões novos, dropando
// órfãos) e faz broadcast da versão normalizada para os celulares.
// Devolve a config efetivamente gravada (com ids atribuídos).
func (a *App) SaveConfig(cfg config.DeckConfig) (config.DeckConfig, error) {
	saved, err := a.store.Replace(cfg)
	if err != nil {
		return config.DeckConfig{}, err
	}
	if a.server != nil {
		a.server.BroadcastConfig()
	}
	return saved, nil
}

// TestOBS tenta conectar ao OBS com as settings informadas no editor (ainda
// não persistidas) e devolve erro se não conseguir. Alimenta o botão
// "Testar conexão" do painel de integrações.
func (a *App) TestOBS(c config.OBSConfig) error {
	if a.server == nil {
		return fmt.Errorf("servidor não iniciado")
	}
	return a.server.TestOBS(c)
}

// GetNetworkInfo devolve IPs candidatos, porta efetiva, URL e erros de bind.
func (a *App) GetNetworkInfo() server.NetworkInfo {
	if a.server == nil {
		return server.NetworkInfo{Error: "servidor não iniciado"}
	}
	return a.server.Network()
}

// SetActiveIP escolhe qual IP a URL/QR usa.
func (a *App) SetActiveIP(ip string) server.NetworkInfo {
	if a.server != nil {
		a.server.SetActiveIP(ip)
	}
	return a.GetNetworkInfo()
}

// GetQRCode devolve o data URL (PNG base64) do QR da URL atual.
func (a *App) GetQRCode() (string, error) {
	if a.server == nil {
		return "", fmt.Errorf("servidor não iniciado")
	}
	return a.server.QRCode()
}

// ListInstalledApps enumera os apps instalados no SO com seus ícones (data
// URL PNG), para o usuário escolher um como ícone de botão. Pode demorar
// alguns segundos (extrai o ícone de cada app) — o frontend chama de forma
// assíncrona com indicador de carregamento.
func (a *App) ListInstalledApps() ([]appicon.AppEntry, error) {
	return a.appicons.List()
}

// PickAppIcon abre o seletor de arquivos nativo (filtrado por executável/.app
// conforme o SO) e devolve o ícone do app escolhido como data URL PNG. Devolve
// string vazia se o usuário cancelar.
func (a *App) PickAppIcon() (string, error) {
	var filters []wailsruntime.FileFilter
	switch runtime.GOOS {
	case "windows":
		filters = []wailsruntime.FileFilter{{DisplayName: "Aplicativos (*.exe, *.lnk)", Pattern: "*.exe;*.lnk"}}
	case "darwin":
		filters = []wailsruntime.FileFilter{{DisplayName: "Aplicativos (*.app)", Pattern: "*.app"}}
	}
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:   "Escolher aplicativo",
		Filters: filters,
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // cancelado
	}
	return a.appicons.Extract(path)
}

// TestKeypress é o teste de input do vertical slice (digita "hi" após 3s).
// Mantido para diagnóstico rápido do caminho de input.
func (a *App) TestKeypress() error {
	time.Sleep(3 * time.Second)
	for _, k := range []string{"h", "i"} {
		if err := a.input.SendKeys([]string{k}, 0); err != nil {
			return err
		}
	}
	return nil
}
