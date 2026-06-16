// Package action define o modelo polimórfico de ações executáveis por um
// botão do deck. Na POC só existe KeypressAction, mas o design (interface
// Action + factory a partir de uma Spec serializável) permite adicionar
// tipos novos (launch, script, url, sequence...) sem refatoração.
package action

import (
	"fmt"

	"go-deck/internal/input"
)

// Action é qualquer ação que um botão pode executar.
type Action interface {
	Execute(ctrl input.InputController) error
}

// Spec é a forma serializável (JSON) de uma ação, como aparece no
// config.json. É traduzida para uma Action concreta por Build().
//
//	{ "type": "keypress", "keys": ["ctrl","shift","m"] }
type Spec struct {
	Type string   `json:"type"`
	Keys []string `json:"keys,omitempty"`
}

// Build converte a Spec na Action concreta correspondente.
func (s Spec) Build() (Action, error) {
	switch s.Type {
	case "keypress":
		if len(s.Keys) == 0 {
			return nil, fmt.Errorf("keypress sem teclas")
		}
		return KeypressAction{Keys: s.Keys}, nil
	default:
		return nil, fmt.Errorf("tipo de ação desconhecido: %q", s.Type)
	}
}

// KeypressAction dispara um combo simultâneo de teclas.
type KeypressAction struct {
	Keys []string
}

func (k KeypressAction) Execute(ctrl input.InputController) error {
	return ctrl.SendKeys(k.Keys)
}
