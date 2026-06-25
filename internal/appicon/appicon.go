// Package appicon extrai ícones de aplicativos instalados no SO e os devolve
// como data URL PNG — o mesmo formato que o resto do app usa para ícones de
// botão (ver lib/appearance.isImageIcon). Assim, um ícone de app fica
// indistinguível de uma imagem enviada manualmente: viaja de graça no
// WS/webview e é renderizado sem nenhum caminho especial.
//
// Segue o padrão de implementação-por-SO de internal/input e internal/launch:
// Windows usa Win32 via syscall (sem CGO); macOS usa Cocoa via CGO; demais
// SOs são stub.
package appicon

// AppEntry descreve um app instalado e seu ícone (data URL PNG; vazio quando a
// extração falha para aquele app).
type AppEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Icon string `json:"icon"`
}

// Provider enumera apps instalados e extrai o ícone de um caminho arbitrário.
type Provider interface {
	// List devolve os apps instalados detectáveis (atalhos do Start Menu no
	// Windows, bundles de /Applications no macOS), cada um com seu ícone.
	// Sempre devolve slice não-nulo — slice nil vira null no JSON e quebra o
	// frontend (ver pegadinha no CLAUDE.md).
	List() ([]AppEntry, error)
	// Extract devolve o ícone de um executável/atalho/.app específico como
	// data URL PNG.
	Extract(path string) (string, error)
}

// New devolve a implementação adequada ao SO atual.
func New() Provider { return newProvider() }
