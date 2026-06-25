package main

import (
	"context"
	"embed"
	"log"
	"runtime"
	"time"

	"go-deck/internal/appicon"
	"go-deck/internal/config"
	"go-deck/internal/i18n"
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

	// Carrega os catálogos de tradução (compartilhados com o frontend) para que
	// as mensagens de erro do backend possam ser traduzidas na borda.
	loadLocales()

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

// lang devolve o idioma global atual (para traduzir erros na borda), com
// fallback seguro se a config ainda não carregou.
func (a *App) lang() string {
	if a.store == nil {
		return i18n.DefaultLang
	}
	return a.store.Language()
}

// GetConfig devolve a config atual.
func (a *App) GetConfig() config.DeckConfig {
	return a.store.Get()
}

// SetLanguage grava o idioma global escolhido (ou detectado na 1ª vez),
// persiste na hora (decisão P8) e faz broadcast da config para os celulares —
// que seguem o idioma global (decisão P3-A). Devolve a config gravada.
func (a *App) SetLanguage(lang string) (config.DeckConfig, error) {
	saved, err := a.store.SetLanguage(lang)
	if err != nil {
		return config.DeckConfig{}, i18n.TranslateErr(a.lang(), err)
	}
	if a.server != nil {
		a.server.BroadcastConfig()
	}
	return saved, nil
}

// SaveConfig persiste a config (atribuindo ids a botões novos, dropando
// órfãos) e faz broadcast da versão normalizada para os celulares.
// Devolve a config efetivamente gravada (com ids atribuídos).
func (a *App) SaveConfig(cfg config.DeckConfig) (config.DeckConfig, error) {
	saved, err := a.store.Replace(cfg)
	if err != nil {
		return config.DeckConfig{}, i18n.TranslateErr(a.lang(), err)
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
		return i18n.TranslateErr(a.lang(), i18n.New("errors.server.notStarted", nil))
	}
	return i18n.TranslateErr(a.lang(), a.server.TestOBS(c))
}

// GetNetworkInfo devolve IPs candidatos, porta efetiva, URL e erros de bind.
func (a *App) GetNetworkInfo() server.NetworkInfo {
	if a.server == nil {
		return server.NetworkInfo{Error: i18n.T(a.lang(), "errors.server.notStarted", nil)}
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
		return "", i18n.TranslateErr(a.lang(), i18n.New("errors.server.notStarted", nil))
	}
	url, err := a.server.QRCode()
	return url, i18n.TranslateErr(a.lang(), err)
}

// ListInstalledApps enumera os apps instalados no SO com seus ícones (data
// URL PNG), para o usuário escolher um como ícone de botão. Pode demorar
// alguns segundos (extrai o ícone de cada app) — o frontend chama de forma
// assíncrona com indicador de carregamento.
func (a *App) ListInstalledApps() ([]appicon.AppEntry, error) {
	list, err := a.appicons.List()
	return list, i18n.TranslateErr(a.lang(), err)
}

// PickAppIcon abre o seletor de arquivos nativo (filtrado por executável/.app
// conforme o SO) e devolve o ícone do app escolhido como data URL PNG. Devolve
// string vazia se o usuário cancelar.
func (a *App) PickAppIcon() (string, error) {
	lang := a.lang()
	var filters []wailsruntime.FileFilter
	switch runtime.GOOS {
	case "windows":
		filters = []wailsruntime.FileFilter{{DisplayName: i18n.T(lang, "appearance.appDialog.exeFilter", nil), Pattern: "*.exe;*.lnk"}}
	case "darwin":
		filters = []wailsruntime.FileFilter{{DisplayName: i18n.T(lang, "appearance.appDialog.appFilter", nil), Pattern: "*.app"}}
	}
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:   i18n.T(lang, "appearance.appDialog.title", nil),
		Filters: filters,
	})
	if err != nil {
		return "", i18n.TranslateErr(lang, err)
	}
	if path == "" {
		return "", nil // cancelado
	}
	icon, err := a.appicons.Extract(path)
	return icon, i18n.TranslateErr(lang, err)
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
