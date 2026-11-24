package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/dist
var assets embed.FS

// O mesmo desenho alimenta recursos nativos no Windows/macOS e a janela GTK.
//
//go:embed build/appicon.png
var appIcon []byte

func main() {
	// Create an instance of the app structure. O mesmo embed.FS (frontend/dist)
	// alimenta tanto o webview do Wails quanto o servidor que serve o celular.
	app := NewApp(assets)

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "go-deck",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Linux: &linux.Options{
			Icon:        appIcon,
			ProgramName: "go-deck",
			// Preserva a política padrão do Wails ao configurar o ícone.
			WebviewGpuPolicy: linux.WebviewGpuPolicyNever,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
