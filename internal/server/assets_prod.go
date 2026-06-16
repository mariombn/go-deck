//go:build !dev

package server

import (
	"io/fs"
	"net/http"
)

// assetHandler (produção) serve o build React embutido (frontend/dist) ao
// celular, a partir do mesmo embed.FS usado pelo webview do Wails.
func assetHandler(assets fs.FS) http.Handler {
	sub, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		logf("erro abrindo assets embutidos: %v", err)
		return http.NotFoundHandler()
	}
	return http.FileServer(http.FS(sub))
}
