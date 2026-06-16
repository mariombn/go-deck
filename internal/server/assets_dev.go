//go:build dev

package server

import (
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
)

// viteDevServer é o endereço fixo do Vite dev server (ver vite.config.ts).
const viteDevServer = "http://127.0.0.1:5173"

// assetHandler (dev) faz reverse-proxy do app React servido pelo Vite, para
// que o celular receba a mesma versão em desenvolvimento que o desktop. A
// tag de build `dev` é definida automaticamente pelo `wails dev`.
//
// Observação: o hot-reload (HMR) do Vite usa um WebSocket próprio que aponta
// para localhost; no celular ele pode não reconectar, mas um refresh sempre
// traz a versão atual. O webview desktop mantém HMR completo via Wails.
func assetHandler(_ fs.FS) http.Handler {
	target, _ := url.Parse(viteDevServer)
	return httputil.NewSingleHostReverseProxy(target)
}
