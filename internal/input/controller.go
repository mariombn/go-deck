// Package input isola teclado e mouse por interface. Windows usa SendInput,
// macOS usa CGEvent e Linux usa dispositivos virtuais uinput (Wayland/X11).
// MouseController é uma capacidade separada para preservar clientes só de teclado.
package input

// InputController abstrai o envio de combinações de teclas ao sistema
// operacional. Toda execução de macro passa por aqui.
type InputController interface {
	// SendKeys dispara um combo simultâneo. Com holdMs == 0 é um toque:
	// pressiona os modificadores na ordem dada, pressiona+solta as teclas
	// principais, e solta os modificadores na ordem inversa (ex.: ["ctrl","c"]
	// => Ctrl+C). Com holdMs > 0 é um "apertar e manter": pressiona TODAS as
	// teclas do combo (modificadores e principais), aguarda holdMs
	// milissegundos, e então solta tudo na ordem inversa.
	SendKeys(keys []string, holdMs int) error
}

// New devolve a implementação adequada ao SO atual. Os controladores nativos
// também implementam MouseController; SOs não suportados usam stubs.
func New() InputController {
	return newController()
}
