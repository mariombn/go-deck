// Package input isola a simulação de teclado atrás de uma interface,
// permitindo trocar a implementação por SO no futuro (macOS/Linux) sem
// alterar o restante do app. Na POC só existe a implementação Windows
// (SendInput, Go puro — sem CGO).
package input

// InputController abstrai o envio de combinações de teclas ao sistema
// operacional. Toda execução de macro passa por aqui.
type InputController interface {
	// SendKeys dispara um combo simultâneo: pressiona os modificadores na
	// ordem dada, pressiona+solta as teclas principais, e solta os
	// modificadores na ordem inversa. Ex.: ["ctrl","c"] => Ctrl+C.
	SendKeys(keys []string) error
}

// New devolve a implementação adequada ao SO atual. No Windows é o
// SendInput nativo; em outros SOs é um stub que retorna erro (a POC só
// tem como alvo o Windows, mas o código compila cross-platform).
func New() InputController {
	return newController()
}
