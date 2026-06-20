//go:build !windows && !darwin

package input

import "fmt"

// otherController é um stub para SOs ainda não suportados. A POC só tem o
// Windows como alvo, mas manter este arquivo faz o pacote compilar em
// qualquer plataforma — útil para validação/CI e para a futura expansão
// (macOS via CGEvent, Linux via XTEST), que entram aqui atrás da mesma
// interface InputController.
type otherController struct{}

func newController() InputController { return otherController{} }

func (otherController) SendKeys(keys []string, holdMs int) error {
	return fmt.Errorf("simulação de teclado não implementada neste SO (POC só suporta Windows)")
}
