package server

import (
	"go-deck/internal/action"
	"go-deck/internal/config"
	"go-deck/internal/input"
	"testing"
)

type fakeMouseInput struct {
	fakeInput
	event      input.MouseEvent
	mouseCalls int
}

func (f *fakeMouseInput) SendMouse(e input.MouseEvent) error { f.event = e; f.mouseCalls++; return nil }

func TestPressMouseUsesInputCapability(t *testing.T) {
	store := newStore(t, deckComBotao("token", config.Button{ID: "mouse", Label: "Rolar", Action: action.Spec{Type: "mouse", MouseOp: "scroll", MouseY: -3}}))
	ctrl := &fakeMouseInput{}
	s := New(store, ctrl, &fakeLauncher{}, emptyAssets)
	ok, message := s.PressButton("mouse")
	if !ok || message != "" || ctrl.mouseCalls != 1 || ctrl.event.Y != -3 || ctrl.calls != 0 {
		t.Fatalf("ok=%v message=%s ctrl=%+v", ok, message, ctrl)
	}
}
