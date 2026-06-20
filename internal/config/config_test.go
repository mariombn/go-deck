package config

import (
	"path/filepath"
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

// TestTokenGeneratedAndStable: normalize gera um token quando ausente e o
// mantém estável em chamadas subsequentes (não regenera a cada normalize).
func TestTokenGeneratedAndStable(t *testing.T) {
	s := &Store{cfg: DeckConfig{}}
	s.normalize()
	tok := s.cfg.Server.Token
	if tok == "" {
		t.Fatal("normalize deveria gerar um token de pareamento")
	}
	s.normalize()
	if s.cfg.Server.Token != tok {
		t.Fatalf("token mudou entre normalizes: %q -> %q", tok, s.cfg.Server.Token)
	}
}

// TestCloneStripsToken: a config exposta ao frontend/celular não leva o token.
func TestCloneStripsToken(t *testing.T) {
	s := &Store{cfg: DeckConfig{Server: Server{Port: 8754, Token: "segredo"}}}
	s.normalize()
	if got := s.clone(); got.Server.Token != "" {
		t.Fatalf("clone deveria remover o token, veio %q", got.Server.Token)
	}
	if s.cfg.Server.Token == "" {
		t.Fatal("clone não pode apagar o token interno do Store")
	}
}

// TestReplacePreservesToken: salvar uma config vinda do frontend (sem token)
// preserva o token atual, sem invalidar o pareamento.
func TestReplacePreservesToken(t *testing.T) {
	s := &Store{cfg: DeckConfig{}, path: filepath.Join(t.TempDir(), "config.json")}
	s.normalize()
	original := s.cfg.Server.Token

	// Simula o save do desktop: config sem token (clone o removeu).
	incoming := DeckConfig{Pages: s.cfg.Pages, Server: Server{Port: 8754}}
	if _, err := s.Replace(incoming); err != nil {
		t.Fatalf("Replace falhou: %v", err)
	}
	if s.cfg.Server.Token != original {
		t.Fatalf("token deveria ser preservado: %q -> %q", original, s.cfg.Server.Token)
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
