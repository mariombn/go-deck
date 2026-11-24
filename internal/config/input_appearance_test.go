package config

import (
	"go-deck/internal/action"
	"reflect"
	"testing"
)

func TestHiddenLabelAndInputActionsPersist(t *testing.T) {
	withTempConfigDir(t)
	store, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	cfg := Default()
	cfg.Pages[0].Buttons = []Button{
		{Label: "Organização", HideLabel: true, Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", KeySequence: [][]string{{"ctrl", "c"}, {"ctrl", "v"}}}},
		{Label: "Mouse", Position: Position{Row: 0, Col: 1}, Action: action.Spec{Type: "mouse", MouseOp: "click", MouseButton: "right"}},
	}
	if _, err := store.Replace(cfg); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	buttons := loaded.Get().Pages[0].Buttons
	if !buttons[0].HideLabel || buttons[0].Label != "Organização" || !reflect.DeepEqual(buttons[0].Action.KeySequence, cfg.Pages[0].Buttons[0].Action.KeySequence) {
		t.Fatalf("rótulo/teclas perdidos: %+v", buttons[0])
	}
	if buttons[1].Action.MouseButton != "right" {
		t.Fatal("mouse perdido ao recarregar")
	}
	if loaded.Get().Server.Token != "" {
		t.Fatal("token exposto no clone")
	}
}
