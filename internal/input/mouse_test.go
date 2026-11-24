package input

import "testing"

func TestMouseValidation(t *testing.T) {
	for _, e := range []MouseEvent{
		{Op: "click", Button: "left"}, {Op: "click", Button: "back", HoldMs: 5000},
		{Op: "double_click", Button: "right"}, {Op: "move", X: -10000, Y: 10000}, {Op: "scroll", X: -100, Y: 100},
	} {
		if err := ValidateMouse(e); err != nil {
			t.Errorf("%+v: %v", e, err)
		}
	}
	for _, e := range []MouseEvent{
		{}, {Op: "click", Button: "invalid"}, {Op: "click", Button: "left", HoldMs: -1},
		{Op: "click", Button: "left", HoldMs: 5001}, {Op: "double_click", Button: "left", HoldMs: 1},
		{Op: "move"}, {Op: "move", X: 10001}, {Op: "move", Y: 1, HoldMs: 10}, {Op: "scroll", Y: 101},
		{Op: "scroll", X: -101}, {Op: "scroll"}, {Op: "unknown", Button: "left"},
	} {
		if err := ValidateMouse(e); err == nil {
			t.Errorf("evento inválido aceito: %+v", e)
		}
	}
}
