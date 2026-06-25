// Package server expõe o deck na rede local: um servidor HTTP que serve o
// app React ao celular e um endpoint WebSocket para o protocolo de toques.
// É separado do webview interno do Wails (que não é exposto na rede).
package server

import (
	"crypto/subtle"
	"embed"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"

	"go-deck/internal/action"
	"go-deck/internal/config"
	"go-deck/internal/i18n"
	"go-deck/internal/input"
	"go-deck/internal/launch"
	"go-deck/internal/obs"
)

// Server orquestra HTTP + WebSocket + descoberta de IP + QR Code.
type Server struct {
	store    *config.Store
	input    input.InputController
	launcher launch.Launcher
	assets   embed.FS
	hub      *hub

	mu        sync.RWMutex
	ips       []string
	activeIP  string
	boundPort int
	startErr  string
}

// NetworkInfo é o resumo de rede exposto à UI desktop (IPs candidatos,
// porta efetiva, URL atual e eventual erro de bind).
type NetworkInfo struct {
	IPs      []string `json:"ips"`
	ActiveIP string   `json:"activeIP"`
	Port     int      `json:"port"`
	URL      string   `json:"url"`
	Error    string   `json:"error"`
}

// New cria o servidor com suas dependências.
func New(store *config.Store, ctrl input.InputController, launcher launch.Launcher, assets embed.FS) *Server {
	s := &Server{
		store:    store,
		input:    ctrl,
		launcher: launcher,
		assets:   assets,
		hub:      newHub(),
	}
	s.hub.onPress = s.press
	s.hub.initial = func() []byte { return s.configMessage() }
	return s
}

// Start sobe o servidor numa goroutine. A porta vem da config; se estiver
// ocupada, registra o erro (sem fallback automático — decisão p1) e o expõe
// via NetworkInfo para a UI.
func (s *Server) Start() {
	go s.hub.run()

	ips := DetectLANIPs()
	port := s.store.Get().Server.Port

	s.mu.Lock()
	s.ips = ips
	if len(ips) > 0 {
		s.activeIP = ips[0]
	}
	s.mu.Unlock()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handleWS)
	mux.Handle("/", assetHandler(s.assets))

	addr := fmt.Sprintf(":%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		s.mu.Lock()
		s.startErr = fmt.Sprintf("porta %d indisponível: %v", port, err)
		s.mu.Unlock()
		logf("falha ao escutar em %s: %v", addr, err)
		return
	}

	s.mu.Lock()
	s.boundPort = port
	s.mu.Unlock()
	logf("ouvindo em http://0.0.0.0:%d", port)

	go func() {
		if err := (&http.Server{Handler: mux}).Serve(ln); err != nil {
			logf("servidor encerrado: %v", err)
		}
	}()
}

// upgrader valida a origem da conexão WS (decisão S1 — higiene mínima):
// só aceita conexões cuja Origin bate com o Host servido, evitando que uma
// página de outra origem abra o WS pelo navegador da vítima.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     sameOrigin,
}

// validToken compara, em tempo constante, o token recebido com o do Store.
func (s *Server) validToken(got string) bool {
	want := s.store.Token()
	if want == "" {
		return true // sem token (não deveria ocorrer: normalize sempre gera um)
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // clientes não-browser (ex.: testes) não enviam Origin
	}
	i := strings.Index(origin, "://")
	if i < 0 {
		return false
	}
	return origin[i+3:] == r.Host
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	// Autenticação por token de pareamento (decisão S2): o celular obtém o
	// token pela URL do QR (?t=) e o reenvia no handshake. Sem isso, qualquer
	// um na LAN abriria o WS e acionaria botões (inclusive launch/url).
	if !s.validToken(r.URL.Query().Get("t")) {
		http.Error(w, i18n.T(s.store.Language(), "errors.server.invalidToken", nil), http.StatusForbidden)
		logf("ws recusado (token inválido) de %s", r.RemoteAddr)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logf("upgrade falhou: %v", err)
		return
	}
	c := &client{hub: s.hub, conn: conn, send: make(chan []byte, 16)}
	s.hub.register <- c
	go c.writePump()
	go c.readPump()
}

// press localiza o botão, constrói a ação e a executa. Devolve (ok, erro).
func (s *Server) press(buttonID string) (bool, string) {
	// Idioma global: a borda traduz os erros antes de devolvê-los no ACK do WS
	// (decisões P3-A/P18). O celular exibe a string já traduzida.
	lang := s.store.Language()
	btn, ok := s.store.FindButton(buttonID)
	if !ok {
		return false, i18n.T(lang, "errors.server.buttonNotFound", nil)
	}
	act, err := btn.Action.Build()
	if err != nil {
		return false, i18n.Translate(lang, err)
	}
	cfg := s.store.Get()
	ctx := action.ExecContext{
		Input:    s.input,
		Launcher: s.launcher,
		OBS:      obs.New(obsSettings(cfg.Integrations.OBS)),
	}
	if err := act.Execute(ctx); err != nil {
		return false, i18n.Translate(lang, err)
	}
	logf("press %s (%s) -> %s", buttonID, btn.Label, btn.Action.Type)
	return true, ""
}

// obsSettings traduz a config persistida em settings de conexão do pacote
// obs. (obs não importa config para evitar ciclo de dependência.)
func obsSettings(c config.OBSConfig) obs.Settings {
	return obs.Settings{
		Enabled:  c.Enabled,
		Host:     c.Host,
		Port:     c.Port,
		Password: c.Password,
	}
}

// BroadcastConfig envia a config atual para todos os celulares conectados.
func (s *Server) BroadcastConfig() {
	s.hub.broadcast <- s.configMessage()
}

func (s *Server) configMessage() []byte {
	msg, _ := json.Marshal(struct {
		Type    string            `json:"type"`
		Payload config.DeckConfig `json:"payload"`
	}{Type: "config", Payload: s.store.Get()})
	return msg
}

// TestOBS tenta conectar ao OBS com as settings dadas (sem persistir),
// devolvendo erro em caso de falha. Usado pelo botão "Testar conexão" do
// editor desktop.
func (s *Server) TestOBS(c config.OBSConfig) error {
	return obs.New(obsSettings(c)).Ping()
}

// SetActiveIP escolhe qual IP a URL/QR usa (dropdown do desktop).
func (s *Server) SetActiveIP(ip string) {
	s.mu.Lock()
	s.activeIP = ip
	s.mu.Unlock()
}

// Network devolve o estado de rede atual para a UI.
func (s *Server) Network() NetworkInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	info := NetworkInfo{
		IPs:      append([]string{}, s.ips...),
		ActiveIP: s.activeIP,
		Port:     s.boundPort,
		Error:    s.startErr,
	}
	if s.activeIP != "" && s.boundPort != 0 {
		info.URL = fmt.Sprintf("http://%s:%d", s.activeIP, s.boundPort)
		// O token de pareamento viaja na própria URL (?t=), para que o celular
		// o receba ao escanear o QR. Aparece no QR e no texto exibido — é a tela
		// do próprio dono, então não há exposição extra.
		if t := s.store.Token(); t != "" {
			info.URL += "/?t=" + t
		}
	}
	return info
}

// QRCode devolve o data URL (PNG base64) do QR Code da URL atual.
func (s *Server) QRCode() (string, error) {
	info := s.Network()
	if info.URL == "" {
		// Devolve um *i18n.Error nomeando a chave; a borda (binding GetQRCode)
		// traduz. info.Error já é uma string (pode estar em branco).
		return "", i18n.New("errors.server.noURL", map[string]any{"detail": info.Error})
	}
	return qrDataURL(info.URL)
}
