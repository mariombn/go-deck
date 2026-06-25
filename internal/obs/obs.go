// Package obs isola, atrás de uma interface, o controle do OBS Studio via
// obs-websocket v5 — análogo a input.InputController e launch.Launcher. É
// uma integração de rede (não depende do SO), então tem uma implementação
// só, apoiada na lib goobs. A conexão é feita por toque (dial → request →
// fecha): sem estado de longa duração, robusto a OBS reiniciar ou estar
// fechado (vira erro, reportado no ack ao celular).
package obs

import (
	"fmt"
	"time"

	"github.com/andreykaipov/goobs"
	"github.com/andreykaipov/goobs/api/requests/general"
	"github.com/andreykaipov/goobs/api/requests/inputs"
	"github.com/andreykaipov/goobs/api/requests/scenes"
	"github.com/gorilla/websocket"

	"go-deck/internal/i18n"
)

// Settings são os dados de conexão do obs-websocket, vindos do config.json
// (bloco Integrations.OBS).
type Settings struct {
	Enabled  bool
	Host     string
	Port     int
	Password string
}

// Controller abstrai as operações do OBS expostas como ações de botão.
type Controller interface {
	SetScene(name string) error      // troca a cena de programa
	ToggleRecord() error             // liga/desliga gravação
	ToggleStream() error             // liga/desliga transmissão
	ToggleMute(input string) error   // alterna mudo de uma fonte de áudio
	TriggerHotkey(name string) error // dispara uma hotkey nomeada do OBS
	// Ping só conecta e desconecta, para o botão "Testar conexão" do desktop.
	Ping() error
}

// New devolve um Controller vinculado às settings dadas. Não conecta ainda —
// cada chamada abre sua própria conexão.
func New(s Settings) Controller { return &client{settings: s} }

type client struct {
	settings Settings
}

// dialTimeout limita o handshake; responseTimeout limita cada request. Sem
// eles, um host inalcançável (firewall) penduraria o toque.
const (
	dialTimeout     = 4 * time.Second
	responseTimeout = 4 * time.Second
)

// connect abre uma conexão obs-websocket usando as settings atuais.
func (c *client) connect() (*goobs.Client, error) {
	if !c.settings.Enabled {
		return nil, i18n.New("errors.obs.disabled", nil)
	}
	host := c.settings.Host
	if host == "" {
		host = "localhost"
	}
	port := c.settings.Port
	if port <= 0 {
		port = 4455
	}
	addr := fmt.Sprintf("%s:%d", host, port)
	dialer := &websocket.Dialer{HandshakeTimeout: dialTimeout}
	cl, err := goobs.New(addr,
		goobs.WithPassword(c.settings.Password),
		goobs.WithDialer(dialer),
		goobs.WithResponseTimeout(responseTimeout),
	)
	if err != nil {
		return nil, i18n.Wrap("errors.obs.connectFailed", map[string]any{"addr": addr}, err)
	}
	return cl, nil
}

// do conecta, executa fn e desconecta sempre ao final.
func (c *client) do(fn func(*goobs.Client) error) error {
	cl, err := c.connect()
	if err != nil {
		return err
	}
	defer cl.Disconnect()
	return fn(cl)
}

func (c *client) SetScene(name string) error {
	return c.do(func(cl *goobs.Client) error {
		_, err := cl.Scenes.SetCurrentProgramScene(
			scenes.NewSetCurrentProgramSceneParams().WithSceneName(name))
		return err
	})
}

func (c *client) ToggleRecord() error {
	return c.do(func(cl *goobs.Client) error {
		_, err := cl.Record.ToggleRecord()
		return err
	})
}

func (c *client) ToggleStream() error {
	return c.do(func(cl *goobs.Client) error {
		_, err := cl.Stream.ToggleStream()
		return err
	})
}

func (c *client) ToggleMute(input string) error {
	return c.do(func(cl *goobs.Client) error {
		_, err := cl.Inputs.ToggleInputMute(
			inputs.NewToggleInputMuteParams().WithInputName(input))
		return err
	})
}

func (c *client) TriggerHotkey(name string) error {
	return c.do(func(cl *goobs.Client) error {
		_, err := cl.General.TriggerHotkeyByName(
			general.NewTriggerHotkeyByNameParams().WithHotkeyName(name))
		return err
	})
}

func (c *client) Ping() error {
	return c.do(func(*goobs.Client) error { return nil })
}
