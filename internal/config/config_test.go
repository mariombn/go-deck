package config

import (
	"testing"

	"go-deck/internal/action"
)

// TestMigrateLegacy garante que um config no formato antigo (grid único +
// buttons no topo) vira uma única página, com os campos legados limpos.
func TestMigrateLegacy(t *testing.T) {
	s := &Store{cfg: DeckConfig{
		LegacyGrid: &Grid{Rows: 2, Cols: 4},
		LegacyButtons: []Button{
			{Label: "A", Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"a"}}},
		},
	}}
	s.normalize()

	if len(s.cfg.Pages) != 1 {
		t.Fatalf("esperava 1 página migrada, veio %d", len(s.cfg.Pages))
	}
	p := s.cfg.Pages[0]
	if p.Grid.Rows != 2 || p.Grid.Cols != 4 {
		t.Fatalf("grid migrado = %dx%d, quero 2x4", p.Grid.Rows, p.Grid.Cols)
	}
	if len(p.Buttons) != 1 || p.Buttons[0].ID == "" {
		t.Fatalf("botão migrado deveria existir e ganhar id: %+v", p.Buttons)
	}
	if p.ID == "" {
		t.Fatal("página migrada deveria ganhar id")
	}
	if s.cfg.LegacyGrid != nil || s.cfg.LegacyButtons != nil {
		t.Fatal("campos legados deveriam ter sido limpos")
	}
}

// TestNormalizeEmptyGetsDefaultPage: config vazio recebe uma página default.
func TestNormalizeEmptyGetsDefaultPage(t *testing.T) {
	s := &Store{cfg: DeckConfig{}}
	s.normalize()
	if len(s.cfg.Pages) != 1 {
		t.Fatalf("esperava 1 página default, veio %d", len(s.cfg.Pages))
	}
	if s.cfg.Server.Port != Default().Server.Port {
		t.Fatalf("porta default não aplicada: %d", s.cfg.Server.Port)
	}
}

// TestUniqueIDsAcrossPages: ids de botão duplicados entre páginas são
// reatribuídos para garantir unicidade no deck inteiro.
func TestUniqueIDsAcrossPages(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{
		{ID: "page_1", Name: "P1", Grid: Grid{Rows: 1, Cols: 1}, Buttons: []Button{
			{ID: "btn_dup", Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"a"}}},
		}},
		{ID: "page_2", Name: "P2", Grid: Grid{Rows: 1, Cols: 1}, Buttons: []Button{
			{ID: "btn_dup", Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"b"}}},
		}},
	}}}
	s.normalize()

	ids := map[string]bool{}
	for _, p := range s.cfg.Pages {
		for _, b := range p.Buttons {
			if ids[b.ID] {
				t.Fatalf("id de botão duplicado após normalize: %s", b.ID)
			}
			ids[b.ID] = true
		}
	}
	if len(ids) != 2 {
		t.Fatalf("esperava 2 ids únicos, veio %d", len(ids))
	}
}

// TestFindButtonAcrossPages: FindButton acha botões em qualquer página.
func TestFindButtonAcrossPages(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{
		{ID: "page_1", Name: "P1", Grid: Grid{Rows: 1, Cols: 1}, Buttons: []Button{
			{ID: "btn_a", Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"a"}}},
		}},
		{ID: "page_2", Name: "P2", Grid: Grid{Rows: 1, Cols: 1}, Buttons: []Button{
			{ID: "btn_b", Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"b"}}},
		}},
	}}}
	if _, ok := s.FindButton("btn_b"); !ok {
		t.Fatal("FindButton não achou botão na 2ª página")
	}
	if _, ok := s.FindButton("inexistente"); ok {
		t.Fatal("FindButton achou id inexistente")
	}
}
