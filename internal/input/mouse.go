package input

import "go-deck/internal/i18n"

// MouseEvent usa deslocamento relativo (X direita/Y baixo) e rolagem em
// passos (X direita/Y cima). Nunca depende da resolução ou monitor ativo.
type MouseEvent struct {
	Op     string
	Button string
	X, Y   int
	HoldMs int
}

// MouseController é separado para preservar controladores/mocks só de teclado.
type MouseController interface{ SendMouse(MouseEvent) error }

// ValidateMouse impede eventos desconhecidos e deslocamentos/durações absurdos.
func ValidateMouse(e MouseEvent) error {
	if e.HoldMs < 0 || e.HoldMs > 5000 {
		return i18n.New("errors.action.holdInvalid", map[string]any{"ms": e.HoldMs, "max": 5000})
	}
	switch e.Op {
	case "click", "double_click":
		switch e.Button {
		case "left", "right", "middle", "back", "forward":
		default:
			return i18n.New("errors.mouse.invalidButton", nil)
		}
		if e.Op == "double_click" && e.HoldMs != 0 {
			return i18n.New("errors.mouse.invalidHold", nil)
		}
	case "move", "scroll":
		limit := 10000
		if e.Op == "scroll" {
			limit = 100
		}
		if e.HoldMs != 0 || (e.X == 0 && e.Y == 0) || e.X < -limit || e.X > limit || e.Y < -limit || e.Y > limit {
			return i18n.New("errors.mouse.invalidMovement", map[string]any{"max": limit})
		}
	default:
		return i18n.New("errors.mouse.invalidOperation", nil)
	}
	return nil
}

// ValidateKeys permite validar toda uma sequência antes de injetar sua 1ª tecla.
func ValidateKeys(keys []string) error {
	if len(keys) == 0 {
		return i18n.New("errors.input.comboEmpty", nil)
	}
	for _, name := range keys {
		if !platformKeyExists(name) {
			return i18n.New("errors.input.unknownKey", map[string]any{"key": name})
		}
	}
	return nil
}
