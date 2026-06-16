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

// DeckConfig é a configuração completa, espelhada nos tipos TypeScript do
// frontend e enviada ao celular via WebSocket.
type DeckConfig struct {
	Grid    Grid     `json:"grid"`
	Server  Server   `json:"server"`
	Buttons []Button `json:"buttons"`
}

// Default devolve a configuração inicial (grid 5x3, porta 8754, sem botões).
func Default() DeckConfig {
	return DeckConfig{
		Grid:    Grid{Rows: 3, Cols: 5},
		Server:  Server{Port: 8754},
		Buttons: []Button{},
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

// FindButton procura um botão pelo id.
func (s *Store) FindButton(id string) (Button, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, b := range s.cfg.Buttons {
		if b.ID == id {
			return b, true
		}
	}
	return Button{}, false
}

// --- helpers internos (assumem lock já adquirido quando necessário) ---

// normalize aplica regras de integridade: defaults de grid/porta, dropar
// botões fora do grid (órfãos após encolher) e garantir slice não-nil.
func (s *Store) normalize() {
	if s.cfg.Grid.Rows <= 0 {
		s.cfg.Grid.Rows = Default().Grid.Rows
	}
	if s.cfg.Grid.Cols <= 0 {
		s.cfg.Grid.Cols = Default().Grid.Cols
	}
	if s.cfg.Server.Port <= 0 {
		s.cfg.Server.Port = Default().Server.Port
	}
	if s.cfg.Buttons == nil {
		s.cfg.Buttons = []Button{}
	}
	kept := s.cfg.Buttons[:0]
	used := map[string]bool{}
	for _, b := range s.cfg.Buttons {
		// Dropa órfãos (botões fora do grid após encolher).
		if b.Position.Row < 0 || b.Position.Row >= s.cfg.Grid.Rows ||
			b.Position.Col < 0 || b.Position.Col >= s.cfg.Grid.Cols {
			continue
		}
		// Atribui id no backend a botões novos (id vazio) — o frontend nunca
		// inventa ids. Garante unicidade dentro do conjunto.
		if b.ID == "" || used[b.ID] {
			b.ID = newButtonID(used)
		}
		used[b.ID] = true
		kept = append(kept, b)
	}
	s.cfg.Buttons = kept
}

// newButtonID gera um id curto e único ("btn_" + 6 hex).
func newButtonID(used map[string]bool) string {
	for {
		var raw [3]byte
		_, _ = rand.Read(raw[:])
		id := "btn_" + hex.EncodeToString(raw[:])
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
	// Importante: usar []Button{} (não nil) para que um deck sem botões
	// serialize como [] e não como null no JSON enviado ao frontend.
	c.Buttons = append([]Button{}, s.cfg.Buttons...)
	return c
}
