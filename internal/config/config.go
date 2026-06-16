// Package config define o modelo de dados do deck e cuida da persistência
// em %APPDATA%/DeckPilot/config.json, além de oferecer um Store thread-safe
// (acessado tanto pelos bindings do desktop quanto pelos handlers do
// servidor WebSocket).
package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"go-deck/internal/action"
)

// Grid é o tamanho do grid (canônico = orientação landscape do desktop).
type Grid struct {
	Rows int `json:"rows"`
	Cols int `json:"cols"`
}

// Server guarda as configurações do servidor de rede.
type Server struct {
	Port int `json:"port"`
}

// OBSConfig são os dados de conexão do obs-websocket (uma instância de OBS,
// reaproveitada por todas as ações do tipo "obs"). Senha em texto puro —
// coerente com a postura POC (ver CLAUDE.md).
type OBSConfig struct {
	Enabled  bool   `json:"enabled"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Password string `json:"password"`
}

// Integrations agrupa as configurações de softwares externos controlados pelo
// deck. Hoje só OBS; Discord é tratado como keypress (keybind global) e não
// precisa de conexão.
type Integrations struct {
	OBS OBSConfig `json:"obs"`
}

// Position é a célula de um botão no grid.
type Position struct {
	Row int `json:"row"`
	Col int `json:"col"`
}

// Button é um botão configurável do deck.
type Button struct {
	ID       string      `json:"id"`
	Label    string      `json:"label"`
	Position Position    `json:"position"`
	Action   action.Spec `json:"action"`
}

// Page é um grid independente ("área"), com tamanho e botões próprios. O
// usuário navega entre páginas por botões do tipo "navigate" (tratados no
// cliente) ou pelo botão Home fixo do celular. O id é estável e referenciado
// pelas ações de navegação — por isso é gerado no frontend (exceção à regra
// "ids só no Go", necessária para linkar uma página recém-criada antes de
// salvar); o backend o preserva, ou atribui um se vier vazio/duplicado.
type Page struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Grid    Grid     `json:"grid"`
	Buttons []Button `json:"buttons"`
}

// DeckConfig é a configuração completa, espelhada nos tipos TypeScript do
// frontend e enviada ao celular via WebSocket.
type DeckConfig struct {
	Pages        []Page       `json:"pages"`
	Server       Server       `json:"server"`
	Integrations Integrations `json:"integrations"`

	// Campos legados do formato antigo (grid único). Mantidos apenas para
	// migrar config.json pré-páginas; em normalize viram a primeira Page e
	// são zerados (omitempty) para não reaparecerem no arquivo.
	LegacyGrid    *Grid    `json:"grid,omitempty"`
	LegacyButtons []Button `json:"buttons,omitempty"`
}

// Default devolve a configuração inicial: uma página "Principal" 3x5, porta
// 8754, sem botões.
func Default() DeckConfig {
	return DeckConfig{
		Pages: []Page{{
			Name:    "Principal",
			Grid:    Grid{Rows: 3, Cols: 5},
			Buttons: []Button{},
		}},
		Server: Server{Port: 8754},
		Integrations: Integrations{
			OBS: OBSConfig{Host: "localhost", Port: 4455},
		},
	}
}

// Store mantém a config em memória (fonte da verdade) e a persiste em disco.
// Todos os acessos são protegidos por mutex.
type Store struct {
	mu   sync.RWMutex
	cfg  DeckConfig
	path string
}

// configDir resolve %APPDATA%/DeckPilot (ou equivalente fora do Windows).
func configDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "DeckPilot"), nil
}

// Load abre o Store, lendo o config.json existente ou criando-o com defaults.
func Load() (*Store, error) {
	dir, err := configDir()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("criando diretório de config: %w", err)
	}
	path := filepath.Join(dir, "config.json")

	s := &Store{path: path}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		s.cfg = Default()
		if err := s.save(); err != nil {
			return nil, err
		}
		return s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("lendo config: %w", err)
	}
	if err := json.Unmarshal(data, &s.cfg); err != nil {
		return nil, fmt.Errorf("config.json inválido: %w", err)
	}
	s.normalize()
	return s, nil
}

// Get devolve uma cópia da config atual.
func (s *Store) Get() DeckConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.clone()
}

// Path devolve o caminho do arquivo de config (útil para a UI/diagnóstico).
func (s *Store) Path() string { return s.path }

// Replace substitui a config inteira (usado ao salvar pelo editor desktop),
// normaliza, persiste e devolve a versão efetivamente gravada.
func (s *Store) Replace(cfg DeckConfig) (DeckConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg = cfg
	s.normalize()
	if err := s.save(); err != nil {
		return DeckConfig{}, err
	}
	return s.clone(), nil
}

// FindButton procura um botão pelo id em todas as páginas (os ids são únicos
// no deck inteiro).
func (s *Store) FindButton(id string) (Button, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.cfg.Pages {
		for _, b := range p.Buttons {
			if b.ID == id {
				return b, true
			}
		}
	}
	return Button{}, false
}

// --- helpers internos (assumem lock já adquirido quando necessário) ---

// normalize aplica regras de integridade: migra o formato antigo, garante ao
// menos uma página, normaliza defaults de servidor/OBS, e — por página —
// aplica defaults de grid e dropa botões órfãos. Os ids de página e de botão
// são únicos no deck inteiro (atribuídos quando vazios/duplicados).
func (s *Store) normalize() {
	s.migrateLegacy()

	if s.cfg.Server.Port <= 0 {
		s.cfg.Server.Port = Default().Server.Port
	}
	if s.cfg.Integrations.OBS.Host == "" {
		s.cfg.Integrations.OBS.Host = Default().Integrations.OBS.Host
	}
	if s.cfg.Integrations.OBS.Port <= 0 {
		s.cfg.Integrations.OBS.Port = Default().Integrations.OBS.Port
	}

	// Sempre ao menos uma página.
	if len(s.cfg.Pages) == 0 {
		s.cfg.Pages = Default().Pages
	}

	pageIDs := map[string]bool{}  // unicidade de ids de página
	btnIDs := map[string]bool{}   // unicidade de ids de botão (deck inteiro)
	for pi := range s.cfg.Pages {
		p := &s.cfg.Pages[pi]
		if p.ID == "" || pageIDs[p.ID] {
			p.ID = newID("page_", pageIDs)
		}
		pageIDs[p.ID] = true
		if p.Name == "" {
			p.Name = fmt.Sprintf("Grid %d", pi+1)
		}
		if p.Grid.Rows <= 0 {
			p.Grid.Rows = Default().Pages[0].Grid.Rows
		}
		if p.Grid.Cols <= 0 {
			p.Grid.Cols = Default().Pages[0].Grid.Cols
		}
		if p.Buttons == nil {
			p.Buttons = []Button{}
		}
		kept := p.Buttons[:0]
		for _, b := range p.Buttons {
			// Dropa órfãos (botões fora do grid após encolher).
			if b.Position.Row < 0 || b.Position.Row >= p.Grid.Rows ||
				b.Position.Col < 0 || b.Position.Col >= p.Grid.Cols {
				continue
			}
			if b.ID == "" || btnIDs[b.ID] {
				b.ID = newID("btn_", btnIDs)
			}
			btnIDs[b.ID] = true
			kept = append(kept, b)
		}
		p.Buttons = kept
	}
}

// migrateLegacy converte o formato antigo (grid único + buttons no topo) em
// uma única página, e limpa os campos legados para não reaparecerem no JSON.
func (s *Store) migrateLegacy() {
	if len(s.cfg.Pages) > 0 {
		s.cfg.LegacyGrid, s.cfg.LegacyButtons = nil, nil
		return
	}
	if s.cfg.LegacyGrid == nil && len(s.cfg.LegacyButtons) == 0 {
		return // nada para migrar
	}
	grid := Grid{Rows: Default().Pages[0].Grid.Rows, Cols: Default().Pages[0].Grid.Cols}
	if s.cfg.LegacyGrid != nil {
		grid = *s.cfg.LegacyGrid
	}
	s.cfg.Pages = []Page{{
		Name:    "Principal",
		Grid:    grid,
		Buttons: s.cfg.LegacyButtons,
	}}
	s.cfg.LegacyGrid, s.cfg.LegacyButtons = nil, nil
}

// newID gera um id curto e único (prefixo + 6 hex) dentro do conjunto dado.
func newID(prefix string, used map[string]bool) string {
	for {
		var raw [3]byte
		_, _ = rand.Read(raw[:])
		id := prefix + hex.EncodeToString(raw[:])
		if !used[id] {
			return id
		}
	}
}

func (s *Store) save() error {
	data, err := json.MarshalIndent(s.cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o644)
}

func (s *Store) clone() DeckConfig {
	c := s.cfg
	// Deep-copy das páginas e seus botões. Importante: usar slices não-nil
	// para que serializem como [] (não null) no JSON enviado ao frontend.
	c.Pages = make([]Page, len(s.cfg.Pages))
	for i, p := range s.cfg.Pages {
		p.Buttons = append([]Button{}, s.cfg.Pages[i].Buttons...)
		c.Pages[i] = p
	}
	return c
}
