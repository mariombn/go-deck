// Package launch isola, atrás de uma interface, a capacidade de iniciar
// processos e abrir URLs no SO — análogo ao input.InputController, que isola
// a simulação de teclado. Ações como launch/url passam por aqui, permitindo
// trocar a implementação por SO no futuro (macOS/Linux) sem mexer no resto.
// Na POC só existe a implementação Windows; outros SOs são stub.
package launch

// Launcher abstrai a abertura de programas e URLs pelo sistema operacional.
type Launcher interface {
	// Launch inicia um programa (fire-and-forget): dispara o processo e segue
	// sem esperar ele terminar. args são passados diretamente ao executável,
	// sem interpretação de shell.
	Launch(path string, args []string) error
	// OpenURL abre uma URL no aplicativo padrão do SO (navegador, etc.).
	OpenURL(url string) error
}

// New devolve a implementação adequada ao SO atual. No Windows usa os/exec
// nativo; em outros SOs é um stub que retorna erro (a POC só tem Windows
// como alvo, mas o código compila cross-platform).
func New() Launcher {
	return newLauncher()
}
