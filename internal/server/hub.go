package server

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

// Tempos de keepalive do WebSocket.
const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

// hub mantém o conjunto de clientes (celulares) conectados e faz o broadcast
// das atualizações de config.
type hub struct {
	register   chan *client
	unregister chan *client
	broadcast  chan []byte
	clients    map[*client]bool

	// onPress executa a ação do botão e devolve (ok, mensagemDeErro).
	onPress func(buttonID string) (bool, string)
	// initial produz a mensagem enviada a cada cliente assim que conecta.
	initial func() []byte
}

func newHub() *hub {
	return &hub{
		register:   make(chan *client),
		unregister: make(chan *client),
		broadcast:  make(chan []byte, 8),
		clients:    make(map[*client]bool),
	}
}

func (h *hub) run() {
	for {
		select {
		case c := <-h.register:
			h.clients[c] = true
			if h.initial != nil {
				select {
				case c.send <- h.initial():
				default:
				}
			}
		case c := <-h.unregister:
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
		case msg := <-h.broadcast:
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					// Cliente lento: descarta e desconecta.
					delete(h.clients, c)
					close(c.send)
				}
			}
		}
	}
}

// --- cliente ---

type client struct {
	hub  *hub
	conn *websocket.Conn
	send chan []byte
}

// inbound é a mensagem que o celular envia ao servidor.
type inbound struct {
	Type     string `json:"type"`
	ButtonID string `json:"buttonId"`
}

// ackMessage é o feedback de execução enviado de volta ao celular.
type ackMessage struct {
	Type     string `json:"type"`
	ButtonID string `json:"buttonId"`
	OK       bool   `json:"ok"`
	Error    string `json:"error,omitempty"`
}

// readPump lê mensagens do celular. Cada "press" dispara a ação numa
// goroutine (para não travar a leitura) e responde com um ack.
func (c *client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var msg inbound
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		if msg.Type != "press" {
			continue
		}
		go c.handlePress(msg.ButtonID)
	}
}

func (c *client) handlePress(buttonID string) {
	ok, errMsg := true, ""
	if c.hub.onPress != nil {
		ok, errMsg = c.hub.onPress(buttonID)
	}
	ack, _ := json.Marshal(ackMessage{
		Type:     "ack",
		ButtonID: buttonID,
		OK:       ok,
		Error:    errMsg,
	})
	select {
	case c.send <- ack:
	default:
	}
}

// writePump envia mensagens (config/ack) e pings periódicos para o celular.
func (c *client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func logf(format string, args ...interface{}) {
	log.Printf("[server] "+format, args...)
}
