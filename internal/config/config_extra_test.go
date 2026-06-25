package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"go-deck/internal/action"
)

// withTempConfigDir redireciona o diretório de config para um temporário,
// cobrindo Windows (APPDATA), XDG (XDG_CONFIG_HOME) e o fallback de HOME, de
// modo que Load/save jamais toquem o config.json real do usuário. Devolve o
// caminho esperado do config.json.
func withTempConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	// os.UserConfigDir consulta, em ordem por SO: APPDATA (Windows),
	// XDG_CONFIG_HOME e HOME (Unix). Setamos todos para o tempdir para não
	// depender do SO do runner.
	t.Setenv("APPDATA", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("HOME", dir)
	return filepath.Join(dir, "DeckPilot", "config.json")
}

// TestMigrateLegacyZeraCampos: além de virar página, os campos legados somem do
// JSON serializado (omitempty + zerados em migrateLegacy).
func TestMigrateLegacyZeraCampos(t *testing.T) {
	s := &Store{cfg: DeckConfig{
		LegacyGrid:    &Grid{Rows: 2, Cols: 3},
		LegacyButtons: []Button{{Label: "X", Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"x"}}}},
	}}
	s.normalize()

	data, err := json.Marshal(s.cfg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := raw["grid"]; ok {
		t.Error("campo legado 'grid' não deveria reaparecer no JSON")
	}
	if _, ok := raw["buttons"]; ok {
		t.Error("campo legado 'buttons' não deveria reaparecer no JSON")
	}
	if s.cfg.Pages[0].Name != "Principal" {
		t.Errorf("página migrada deveria se chamar Principal, veio %q", s.cfg.Pages[0].Name)
	}
}

// TestMigrateLegacySemGridUsaDefault: se só vierem buttons legados (sem grid),
// a página migrada herda o grid default (3x5).
func TestMigrateLegacySemGridUsaDefault(t *testing.T) {
	s := &Store{cfg: DeckConfig{
		LegacyButtons: []Button{{Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"a"}}}},
	}}
	s.normalize()
	g := s.cfg.Pages[0].Grid
	def := Default().Pages[0].Grid
	if g.Rows != def.Rows || g.Cols != def.Cols {
		t.Fatalf("grid migrado = %dx%d, esperado default %dx%d", g.Rows, g.Cols, def.Rows, def.Cols)
	}
}

// TestMigrateLegacyIgnoradoComPaginas: havendo páginas, os campos legados são
// apenas descartados (não migrados nem sobrescrevem nada).
func TestMigrateLegacyIgnoradoComPaginas(t *testing.T) {
	s := &Store{cfg: DeckConfig{
		Pages:         []Page{{ID: "page_x", Name: "Existente", Grid: Grid{Rows: 1, Cols: 1}}},
		LegacyGrid:    &Grid{Rows: 9, Cols: 9},
		LegacyButtons: []Button{{Position: Position{Row: 0, Col: 0}}},
	}}
	s.normalize()
	if len(s.cfg.Pages) != 1 || s.cfg.Pages[0].Name != "Existente" {
		t.Fatalf("páginas existentes não deveriam ser substituídas: %+v", s.cfg.Pages)
	}
	if s.cfg.LegacyGrid != nil || s.cfg.LegacyButtons != nil {
		t.Error("campos legados deveriam ser limpos mesmo quando ignorados")
	}
}

// TestNormalizePortaDefault: porta <= 0 vira a default 8754; porta válida é
// preservada.
func TestNormalizePortaDefault(t *testing.T) {
	t.Run("zero vira default", func(t *testing.T) {
		s := &Store{cfg: DeckConfig{Server: Server{Port: 0}}}
		s.normalize()
		if s.cfg.Server.Port != 8754 {
			t.Fatalf("porta = %d, esperado 8754", s.cfg.Server.Port)
		}
	})
	t.Run("negativa vira default", func(t *testing.T) {
		s := &Store{cfg: DeckConfig{Server: Server{Port: -1}}}
		s.normalize()
		if s.cfg.Server.Port != 8754 {
			t.Fatalf("porta = %d, esperado 8754", s.cfg.Server.Port)
		}
	})
	t.Run("válida preservada", func(t *testing.T) {
		s := &Store{cfg: DeckConfig{Server: Server{Port: 9000}}}
		s.normalize()
		if s.cfg.Server.Port != 9000 {
			t.Fatalf("porta = %d, esperado 9000 (preservada)", s.cfg.Server.Port)
		}
	})
}

// TestNormalizeOBSDefaults: host/port vazios do OBS recebem defaults.
func TestNormalizeOBSDefaults(t *testing.T) {
	s := &Store{cfg: DeckConfig{}}
	s.normalize()
	obs := s.cfg.Integrations.OBS
	if obs.Host != "localhost" {
		t.Errorf("OBS host default = %q, esperado localhost", obs.Host)
	}
	if obs.Port != 4455 {
		t.Errorf("OBS port default = %d, esperado 4455", obs.Port)
	}
}

// TestTokenTem32HexChars: o token gerado tem 16 bytes em hex (32 chars hex).
func TestTokenTem32HexChars(t *testing.T) {
	s := &Store{cfg: DeckConfig{}}
	s.normalize()
	tok := s.cfg.Server.Token
	if len(tok) != 32 {
		t.Fatalf("token = %q (len %d), esperado 32 chars hex", tok, len(tok))
	}
	for _, c := range tok {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Fatalf("token contém caractere não-hex: %q", tok)
		}
	}
}

// TestNormalizePreservaIDsDePagina: ids de página não-vazios e únicos são
// preservados (necessário para que um navigate referencie a página).
func TestNormalizePreservaIDsDePagina(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{
		{ID: "page_custom", Name: "P", Grid: Grid{Rows: 1, Cols: 1}},
	}}}
	s.normalize()
	if s.cfg.Pages[0].ID != "page_custom" {
		t.Fatalf("id de página não-vazio deveria ser preservado, veio %q", s.cfg.Pages[0].ID)
	}
}

// TestNormalizeReatribuiPaginaDuplicada: ids de página duplicados são
// reatribuídos (mantendo o primeiro).
func TestNormalizeReatribuiPaginaDuplicada(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{
		{ID: "dup", Name: "A", Grid: Grid{Rows: 1, Cols: 1}},
		{ID: "dup", Name: "B", Grid: Grid{Rows: 1, Cols: 1}},
	}}}
	s.normalize()
	if s.cfg.Pages[0].ID != "dup" {
		t.Errorf("primeira página deveria manter o id 'dup', veio %q", s.cfg.Pages[0].ID)
	}
	if s.cfg.Pages[1].ID == "dup" || s.cfg.Pages[1].ID == "" {
		t.Errorf("página duplicada deveria ganhar id novo, veio %q", s.cfg.Pages[1].ID)
	}
}

// TestNormalizeNomePadraoDePagina: páginas sem nome ganham "Grid N".
func TestNormalizeNomePadraoDePagina(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{
		{ID: "p1", Grid: Grid{Rows: 1, Cols: 1}},
		{ID: "p2", Grid: Grid{Rows: 1, Cols: 1}},
	}}}
	s.normalize()
	if s.cfg.Pages[0].Name != "Grid 1" || s.cfg.Pages[1].Name != "Grid 2" {
		t.Fatalf("nomes default = %q, %q; esperado Grid 1, Grid 2", s.cfg.Pages[0].Name, s.cfg.Pages[1].Name)
	}
}

// TestNormalizeGridDefaultPorPagina: grid com dimensões <= 0 recebe defaults.
func TestNormalizeGridDefaultPorPagina(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{
		{ID: "p", Name: "P", Grid: Grid{Rows: 0, Cols: 0}},
	}}}
	s.normalize()
	g := s.cfg.Pages[0].Grid
	def := Default().Pages[0].Grid
	if g.Rows != def.Rows || g.Cols != def.Cols {
		t.Fatalf("grid = %dx%d, esperado default %dx%d", g.Rows, g.Cols, def.Rows, def.Cols)
	}
}

// TestNormalizeDropaOrfaos: encolher o grid descarta botões fora dos limites,
// preservando os que continuam dentro.
func TestNormalizeDropaOrfaos(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{{
		ID:   "p",
		Name: "P",
		Grid: Grid{Rows: 1, Cols: 1}, // só a célula (0,0)
		Buttons: []Button{
			{ID: "dentro", Position: Position{Row: 0, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"a"}}},
			{ID: "fora_linha", Position: Position{Row: 5, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"b"}}},
			{ID: "fora_coluna", Position: Position{Row: 0, Col: 5}, Action: action.Spec{Type: "keypress", Keys: []string{"c"}}},
			{ID: "negativo", Position: Position{Row: -1, Col: 0}, Action: action.Spec{Type: "keypress", Keys: []string{"d"}}},
		},
	}}}}
	s.normalize()
	btns := s.cfg.Pages[0].Buttons
	if len(btns) != 1 {
		t.Fatalf("esperava 1 botão dentro do grid, veio %d: %+v", len(btns), btns)
	}
	if btns[0].ID != "dentro" {
		t.Fatalf("botão preservado errado: %q", btns[0].ID)
	}
}

// TestCloneForcaSlicesNaoNil: clone() devolve Pages e Buttons como slices
// não-nil (serializam como [] em vez de null no JSON do frontend).
func TestCloneForcaSlicesNaoNil(t *testing.T) {
	// Página com Buttons nil de propósito.
	s := &Store{cfg: DeckConfig{Pages: []Page{
		{ID: "p", Name: "P", Grid: Grid{Rows: 1, Cols: 1}, Buttons: nil},
	}}}
	s.normalize() // normalize já converte nil -> []Button{}
	c := s.clone()
	if c.Pages == nil {
		t.Fatal("clone.Pages não pode ser nil")
	}
	for i, p := range c.Pages {
		if p.Buttons == nil {
			t.Fatalf("clone.Pages[%d].Buttons não pode ser nil", i)
		}
	}

	// Garante que o JSON serializa como [] e não null.
	data, _ := json.Marshal(c)
	var probe struct {
		Pages []struct {
			Buttons json.RawMessage `json:"buttons"`
		} `json:"pages"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for i, p := range probe.Pages {
		if string(p.Buttons) == "null" {
			t.Fatalf("buttons da página %d serializou como null", i)
		}
	}
}

// TestCloneNaoCompartilhaButtons: alterar os Buttons da cópia não afeta o
// Store interno (deep-copy real, não alias de slice).
func TestCloneNaoCompartilhaButtons(t *testing.T) {
	s := &Store{cfg: DeckConfig{Pages: []Page{{
		ID: "p", Name: "P", Grid: Grid{Rows: 1, Cols: 1},
		Buttons: []Button{{ID: "btn", Position: Position{Row: 0, Col: 0}, Label: "orig"}},
	}}}}
	s.normalize()
	c := s.clone()
	c.Pages[0].Buttons[0].Label = "mexido"
	if s.cfg.Pages[0].Buttons[0].Label != "orig" {
		t.Fatal("clone deveria ser deep-copy: alteração vazou para o Store")
	}
}

// TestReplaceNaoSobrescreveTokenVindo: se a config que volta TROUXER um token,
// ele é respeitado (não sobrescrito pelo anterior).
func TestReplaceNaoSobrescreveTokenVindo(t *testing.T) {
	s := &Store{cfg: DeckConfig{}, path: filepath.Join(t.TempDir(), "config.json")}
	s.normalize()
	novo := DeckConfig{Pages: s.cfg.Pages, Server: Server{Port: 8754, Token: "tokennovoexplicito"}}
	if _, err := s.Replace(novo); err != nil {
		t.Fatalf("Replace: %v", err)
	}
	if s.cfg.Server.Token != "tokennovoexplicito" {
		t.Fatalf("token explícito deveria ser respeitado, veio %q", s.cfg.Server.Token)
	}
}

// TestLoadCriaArquivoComDefault: Load num diretório vazio cria o config.json
// com a configuração default.
//
// QUIRK DE PRODUÇÃO (documentado, não corrigido): no 1º run (arquivo
// inexistente) o Load grava Default() SEM chamar normalize(), então NENHUM
// token é gerado nessa primeira sessão — Token() devolve "". O token só nasce
// no 2º Load (ver TestLoadGeraTokenNaSegundaSessao). Asseveramos o
// comportamento atual para travar a regressão e flagrar a quirk.
func TestLoadCriaArquivoComDefault(t *testing.T) {
	path := withTempConfigDir(t)
	s, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if s.Path() != path {
		t.Errorf("Path = %q, esperado %q", s.Path(), path)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("config.json não foi criado: %v", err)
	}
	// Comportamento ATUAL: 1º run não gera token (quirk).
	if s.Token() != "" {
		t.Errorf("comportamento atual: 1º Load não gera token, veio %q", s.Token())
	}
	cfg := s.Get()
	if len(cfg.Pages) == 0 {
		t.Error("config carregada deveria ter ao menos uma página")
	}
	if cfg.Server.Token != "" {
		t.Error("Get() (clone) não deveria expor o token")
	}
}

// TestLoadGeraTokenNaSegundaSessao documenta a quirk: o token só é gerado e
// persistido no 2º Load (quando o arquivo já existe e normalize roda). A partir
// daí ele fica estável entre reinícios.
func TestLoadGeraTokenNaSegundaSessao(t *testing.T) {
	withTempConfigDir(t)
	s1, err := Load() // 1º run: cria Default sem token
	if err != nil {
		t.Fatalf("Load 1: %v", err)
	}
	if s1.Token() != "" {
		t.Fatalf("esperava token vazio no 1º run, veio %q", s1.Token())
	}
	s2, err := Load() // 2º run: normalize gera e persiste o token
	if err != nil {
		t.Fatalf("Load 2: %v", err)
	}
	tok := s2.Token()
	if tok == "" {
		t.Fatal("2º Load deveria ter gerado e persistido um token")
	}
	s3, err := Load() // 3º run: token estável
	if err != nil {
		t.Fatalf("Load 3: %v", err)
	}
	if s3.Token() != tok {
		t.Fatalf("token deveria ser estável a partir do 2º run: %q -> %q", tok, s3.Token())
	}
}

// TestSaveGetRoundTrip: Replace persiste em disco e um novo Load relê o mesmo
// conteúdo (round-trip via arquivo temporário), preservando o token.
func TestSaveGetRoundTrip(t *testing.T) {
	withTempConfigDir(t)
	s1, err := Load()
	if err != nil {
		t.Fatalf("Load inicial: %v", err)
	}

	novo := DeckConfig{Pages: []Page{{
		ID: "page_rt", Name: "RoundTrip", Grid: Grid{Rows: 2, Cols: 2},
		Buttons: []Button{{ID: "btn_rt", Label: "RT", Position: Position{Row: 1, Col: 1}, Action: action.Spec{Type: "keypress", Keys: []string{"a"}}}},
	}}, Server: Server{Port: 8754}}
	// Replace normaliza: gera o token (o 1º Load não havia gerado — ver quirk em
	// TestLoadGeraTokenNaSegundaSessao) e persiste tudo em disco.
	if _, err := s1.Replace(novo); err != nil {
		t.Fatalf("Replace: %v", err)
	}
	tok := s1.Token()
	if tok == "" {
		t.Fatal("Replace deveria ter gerado um token")
	}

	// Reabre do disco — deve reler a página e manter o mesmo token.
	s2, err := Load()
	if err != nil {
		t.Fatalf("Load reabrindo: %v", err)
	}
	if s2.Token() != tok {
		t.Fatalf("token não sobreviveu ao round-trip: %q -> %q", tok, s2.Token())
	}
	cfg := s2.Get()
	if len(cfg.Pages) != 1 || cfg.Pages[0].Name != "RoundTrip" {
		t.Fatalf("página não persistida corretamente: %+v", cfg.Pages)
	}
	if _, ok := s2.FindButton("btn_rt"); !ok {
		t.Error("botão persistido não foi reencontrado após reabrir")
	}
}

// TestSetLanguagePersiste: SetLanguage grava o idioma e ele sobrevive a um
// novo Load.
func TestSetLanguagePersiste(t *testing.T) {
	withTempConfigDir(t)
	s1, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if _, err := s1.SetLanguage("pt-BR"); err != nil {
		t.Fatalf("SetLanguage: %v", err)
	}
	s2, err := Load()
	if err != nil {
		t.Fatalf("Load reabrindo: %v", err)
	}
	if s2.Language() != "pt-BR" {
		t.Fatalf("idioma não persistido: %q", s2.Language())
	}
}
