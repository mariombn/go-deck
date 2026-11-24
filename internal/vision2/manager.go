package vision2

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"go-deck/internal/config"
)

// Info é um diagnóstico local, sem token de pareamento nem senha do OBS.
type Info struct {
	Supported   bool   `json:"supported"`
	Enabled     bool   `json:"enabled"`
	Connected   bool   `json:"connected"`
	Path        string `json:"path"`
	PageID      string `json:"pageId"`
	Revision    uint64 `json:"revision"`
	Error       string `json:"error"`
	ActionError string `json:"actionError"`
}

// Manager serializa todo o tráfego USB numa única goroutine. Execução de ações
// é separada, para um hold/sequence/OBS não interromper leitura e keepalive.
type Manager struct {
	mu      sync.Mutex
	info    Info
	cfg     config.DeckConfig
	images  map[string][]byte
	actions chan string
	execute func(string) (bool, string)
}

func New(execute func(string) (bool, string)) *Manager {
	return &Manager{info: Info{Supported: supported, Enabled: supported}, images: map[string][]byte{}, actions: make(chan string, 16), execute: execute}
}

func (m *Manager) Info() Info { m.mu.Lock(); defer m.mu.Unlock(); return m.info }

// UpdateConfig recebe somente configurações já salvas (nunca o rascunho).
func (m *Manager) UpdateConfig(cfg config.DeckConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cfg = cfg
	m.info.Revision++
	m.images = map[string][]byte{}
	m.ensurePage()
}

func (m *Manager) ensurePage() {
	for _, p := range m.cfg.Pages {
		if p.ID == m.info.PageID {
			return
		}
	}
	m.info.PageID = ""
	if len(m.cfg.Pages) > 0 {
		m.info.PageID = m.cfg.Pages[0].ID
	}
}

func (m *Manager) SetEnabled(enabled bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.info.Enabled = enabled && supported
}

func (m *Manager) SelectPage(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range m.cfg.Pages {
		if p.ID == id {
			m.info.PageID = id
			return nil
		}
	}
	return fmt.Errorf("página do Vision 2 não encontrada")
}

// SetImages recebe JPEGs já rasterizados e girados 180° pelo canvas do
// desktop. A revisão impede que uma renderização antiga sobreponha um save.
func (m *Manager) SetImages(revision uint64, images map[string]string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if revision != m.info.Revision {
		return nil
	}
	decoded := make(map[string][]byte)
	for _, p := range m.cfg.Pages {
		for _, b := range p.Buttons {
			source, ok := images[b.ID]
			if !ok {
				continue
			}
			if len(source) > 90000 || !strings.HasPrefix(source, "data:image/jpeg;base64,") {
				return fmt.Errorf("imagem LCD inválida: %s", b.ID)
			}
			data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(source, "data:image/jpeg;base64,"))
			if err != nil || !validJPEG(data) {
				return fmt.Errorf("JPEG LCD inválido: %s", b.ID)
			}
			decoded[b.ID] = data
		}
	}
	m.images = decoded
	log.Printf("[vision2] aparência atualizada: %d botões", len(decoded))
	return nil
}

func (m *Manager) onKey(position int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range m.cfg.Pages {
		if p.ID != m.info.PageID {
			continue
		}
		for _, b := range p.Buttons {
			if b.Position.Row != position/Cols || b.Position.Col != position%Cols {
				continue
			}
			if b.Action.Type == "navigate" {
				for _, target := range m.cfg.Pages {
					if target.ID == b.Action.TargetPage {
						m.info.PageID = target.ID
						m.info.ActionError = ""
						return
					}
				}
				m.info.ActionError = "página de destino não encontrada"
				return
			}
			select {
			case m.actions <- b.ID:
			default:
				m.info.ActionError = "fila de ações do Vision 2 cheia"
			}
			return
		}
	}
}

func (m *Manager) desiredImages() [KeyCount][]byte {
	m.mu.Lock()
	defer m.mu.Unlock()
	var images [KeyCount][]byte
	for _, p := range m.cfg.Pages {
		if p.ID != m.info.PageID {
			continue
		}
		for _, b := range p.Buttons {
			if b.Position.Row >= 0 && b.Position.Row < Rows && b.Position.Col >= 0 && b.Position.Col < Cols {
				images[b.Position.Row*Cols+b.Position.Col] = m.images[b.ID]
			}
		}
	}
	return images
}

func (m *Manager) connection(path string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.info.Path = path
	m.info.Connected = path != ""
	message := ""
	if err != nil {
		message = err.Error()
	}
	if message != "" && message != m.info.Error {
		log.Printf("[vision2] %s", message)
	}
	m.info.Error = message
}

func (m *Manager) Run(ctx context.Context) {
	if !supported {
		return
	}
	workerDone := make(chan struct{})
	go func() {
		defer close(workerDone)
		for {
			select {
			case <-ctx.Done():
				return
			case id := <-m.actions:
				if ctx.Err() != nil {
					return
				}
				if m.execute == nil || !m.Info().Enabled {
					continue
				}
				_, message := m.execute(id)
				m.mu.Lock()
				m.info.ActionError = message
				m.mu.Unlock()
			}
		}
	}()
	defer func() { <-workerDone }()
	tick := time.NewTicker(15 * time.Millisecond)
	defer tick.Stop()
	var d *device
	var current candidate
	var sent [KeyCount][]byte
	var nextScan, heartbeat, lastTick time.Time
	disconnect := func(err error) {
		if d != nil {
			d.Close()
			d = nil
		}
		m.connection("", err)
	}
	defer disconnect(nil)
	input := make([]byte, 513)
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-tick.C:
			// Após suspensão do sistema, reinicia o protocolo e repinta o LCD.
			if d != nil && !lastTick.IsZero() && now.Sub(lastTick) > 10*time.Second {
				if err := d.initialise(); err != nil {
					disconnect(err)
				} else {
					sent = [KeyCount][]byte{}
				}
			}
			lastTick = now
			if !m.Info().Enabled {
				if d != nil {
					disconnect(nil)
				}
				nextScan = time.Time{}
				continue
			}
			if !now.Before(nextScan) {
				nextScan = now.Add(2 * time.Second)
				found, err := findDevices()
				if err != nil {
					disconnect(err)
					continue
				}
				if d != nil {
					present := false
					for _, c := range found {
						if c == current {
							present = true
						}
					}
					if !present {
						disconnect(nil)
					}
				}
				if d == nil && len(found) > 0 {
					current = found[0]
					d, err = openDevice(current)
					if err != nil {
						m.connection("", err)
						continue
					}
					m.connection(current.path, nil)
					log.Printf("[vision2] conectado em %s", current.path)
					sent = [KeyCount][]byte{}
					heartbeat = now.Add(4 * time.Second)
				}
			}
			if d == nil {
				continue
			}
			for i := 0; i < 32; i++ {
				n, err := d.Read(input)
				if wouldBlock(err) {
					break
				}
				if err != nil || n == 0 {
					if err == nil {
						err = fmt.Errorf("Vision 2 desconectado")
					}
					disconnect(err)
					break
				}
				position, pressed, ok := keyEvent(input[:n])
				if !ok || d.pressed[position] == pressed {
					continue
				}
				d.pressed[position] = pressed
				if pressed {
					m.onKey(position)
				}
			}
			if d == nil {
				continue
			}
			if !now.Before(heartbeat) {
				if err := d.command("CONNECT"); err != nil {
					disconnect(err)
					continue
				}
				heartbeat = now.Add(4 * time.Second)
			}
			// Um LCD por iteração mantém leitura de teclas responsiva. Compara
			// bytes para não retransmitir os outros 14 ao editar um único botão.
			for position, image := range m.desiredImages() {
				if bytes.Equal(sent[position], image) {
					continue
				}
				if err := d.setImage(position, image); err != nil {
					disconnect(err)
				} else {
					sent[position] = image
				}
				break
			}
		}
	}
}
