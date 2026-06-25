package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"go-deck/internal/action"
	"go-deck/internal/config"
	"go-deck/internal/i18n"
)

// reqComOrigin monta um *http.Request com Host e Origin dados (Origin vazio =
// header ausente).
func reqComOrigin(host, origin string) *http.Request {
	r, _ := http.NewRequest(http.MethodGet, "http://"+host+"/ws", nil)
	r.Host = host
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	return r
}

func TestSameOrigin(t *testing.T) {
	casos := []struct {
		nome   string
		host   string
		origin string
		quer   bool
	}{
		{"origin vazio (cliente não-browser)", "192.168.0.10:8754", "", true},
		{"origin bate com host", "192.168.0.10:8754", "http://192.168.0.10:8754", true},
		{"origin https bate com host", "192.168.0.10:8754", "https://192.168.0.10:8754", true},
		{"origin diverge do host", "192.168.0.10:8754", "http://malicioso.com", false},
		{"origin diverge na porta", "192.168.0.10:8754", "http://192.168.0.10:9999", false},
		{"origin sem esquema", "192.168.0.10:8754", "192.168.0.10:8754", false},
	}
	for _, tc := range casos {
		t.Run(tc.nome, func(t *testing.T) {
			if got := sameOrigin(reqComOrigin(tc.host, tc.origin)); got != tc.quer {
				t.Fatalf("sameOrigin = %v, quero %v", got, tc.quer)
			}
		})
	}
}

func TestValidToken(t *testing.T) {
	const tok = "0123456789abcdef0123456789abcdef"
	store := newStore(t, deckComBotao(tok, config.Button{
		ID:     "btn_x",
		Label:  "X",
		Action: action.Spec{Type: "keypress", Keys: []string{"a"}},
	}))
	s := New(store, &fakeInput{}, &fakeLauncher{}, emptyAssets)

	t.Run("token batendo aceita", func(t *testing.T) {
		if !s.validToken(tok) {
			t.Fatal("token correto deveria ser aceito")
		}
	})
	t.Run("token não batendo recusa", func(t *testing.T) {
		if s.validToken("errado") {
			t.Fatal("token incorreto deveria ser recusado")
		}
	})
	t.Run("token vazio recusa quando há token", func(t *testing.T) {
		if s.validToken("") {
			t.Fatal("token vazio deveria ser recusado quando o store tem token")
		}
	})
}

// TestValidTokenSemToken cobre o ramo "store sem token aceita". A API pública
// do config.Store sempre gera um token em normalize, então construímos um
// Server cujo Store é nil-token de forma indireta não é possível pela API
// pública; em vez disso validamos o ramo via um Server com store cujo Token()
// devolve vazio — só alcançável se o token nunca for gerado. Como isso é
// inatingível pela API pública (normalize sempre preenche), documentamos a
// limitação no resultado e validamos apenas o comportamento observável.
//
// (Ver nota no resultado final: o ramo `want == ""` de validToken não é
// exercitável sem acessar campos não-exportados do config.Store.)

func TestPressKeypress(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_kp",
		Label:  "Copiar",
		Action: action.Spec{Type: "keypress", Keys: []string{"ctrl", "c"}, HoldMs: 0},
	}))
	in := &fakeInput{}
	s := New(store, in, &fakeLauncher{}, emptyAssets)

	ok, errMsg := s.press("btn_kp")
	if !ok || errMsg != "" {
		t.Fatalf("press = (%v, %q), quero (true, \"\")", ok, errMsg)
	}
	if in.calls != 1 {
		t.Fatalf("SendKeys chamado %d vezes, quero 1", in.calls)
	}
	if strings.Join(in.keys, "+") != "ctrl+c" {
		t.Fatalf("keys = %v, quero [ctrl c]", in.keys)
	}
}

func TestPressLaunch(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_app",
		Label:  "Notepad",
		Action: action.Spec{Type: "launch", Path: `C:\Windows\notepad.exe`, Args: []string{"x.txt"}},
	}))
	lc := &fakeLauncher{}
	s := New(store, &fakeInput{}, lc, emptyAssets)

	ok, errMsg := s.press("btn_app")
	if !ok || errMsg != "" {
		t.Fatalf("press = (%v, %q), quero (true, \"\")", ok, errMsg)
	}
	if lc.launchN != 1 || lc.launchPath != `C:\Windows\notepad.exe` {
		t.Fatalf("Launch = (%d, %q), quero (1, notepad.exe)", lc.launchN, lc.launchPath)
	}
	if strings.Join(lc.launchArgs, ",") != "x.txt" {
		t.Fatalf("args = %v, quero [x.txt]", lc.launchArgs)
	}
}

func TestPressURL(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_url",
		Label:  "Site",
		Action: action.Spec{Type: "url", URL: "https://example.com"},
	}))
	lc := &fakeLauncher{}
	s := New(store, &fakeInput{}, lc, emptyAssets)

	ok, errMsg := s.press("btn_url")
	if !ok || errMsg != "" {
		t.Fatalf("press = (%v, %q), quero (true, \"\")", ok, errMsg)
	}
	if lc.openN != 1 || lc.openedURL != "https://example.com" {
		t.Fatalf("OpenURL = (%d, %q), quero (1, example.com)", lc.openN, lc.openedURL)
	}
}

// TestPressBotaoInexistente: id desconhecido devolve a chave buttonNotFound.
// Sem catálogo i18n carregado, i18n.T devolve a própria chave — então o
// errMsg É a chave (asserimos a chave, não a frase traduzida).
func TestPressBotaoInexistente(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_existe",
		Label:  "X",
		Action: action.Spec{Type: "keypress", Keys: []string{"a"}},
	}))
	s := New(store, &fakeInput{}, &fakeLauncher{}, emptyAssets)

	ok, errMsg := s.press("btn_nao_existe")
	if ok {
		t.Fatal("press de botão inexistente deveria devolver ok=false")
	}
	if errMsg != "errors.server.buttonNotFound" {
		t.Fatalf("errMsg = %q, quero a chave errors.server.buttonNotFound", errMsg)
	}
}

// TestPressAcaoInvalida: keypress sem teclas falha no Build; o erro
// (*i18n.Error com chave keypressNoKeys) é propagado e traduzido na borda.
// Sem catálogo, a tradução devolve a própria chave.
func TestPressAcaoInvalida(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_invalido",
		Label:  "Quebrado",
		Action: action.Spec{Type: "keypress"}, // sem keys
	}))
	in := &fakeInput{}
	s := New(store, in, &fakeLauncher{}, emptyAssets)

	ok, errMsg := s.press("btn_invalido")
	if ok {
		t.Fatal("press de ação inválida deveria devolver ok=false")
	}
	if errMsg != "errors.action.keypressNoKeys" {
		t.Fatalf("errMsg = %q, quero a chave errors.action.keypressNoKeys", errMsg)
	}
	if in.calls != 0 {
		t.Fatalf("SendKeys não deveria ser chamado em ação inválida (calls=%d)", in.calls)
	}
}

// TestPressErroDeExecucao: a ação compila, mas o Launcher devolve erro na
// execução; o erro cru (não-*i18n.Error) é repassado pela borda como sua
// própria mensagem (i18n.Translate devolve err.Error() para erros sem chave).
func TestPressErroDeExecucao(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_falha",
		Label:  "Falha",
		Action: action.Spec{Type: "url", URL: "https://x"},
	}))
	lc := &fakeLauncher{err: errFake}
	s := New(store, &fakeInput{}, lc, emptyAssets)

	ok, errMsg := s.press("btn_falha")
	if ok {
		t.Fatal("press com erro de execução deveria devolver ok=false")
	}
	if errMsg != errFake.Error() {
		t.Fatalf("errMsg = %q, quero %q", errMsg, errFake.Error())
	}
}

func TestConfigMessage(t *testing.T) {
	store := newStore(t, deckComBotao("tok-secreto", config.Button{
		ID:     "btn_cm",
		Label:  "CM",
		Action: action.Spec{Type: "keypress", Keys: []string{"a"}},
	}))
	s := New(store, &fakeInput{}, &fakeLauncher{}, emptyAssets)

	raw := s.configMessage()
	var msg struct {
		Type    string            `json:"type"`
		Payload config.DeckConfig `json:"payload"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		t.Fatalf("configMessage não é JSON válido: %v", err)
	}
	if msg.Type != "config" {
		t.Fatalf("type = %q, quero config", msg.Type)
	}
	if len(msg.Payload.Pages) != 1 || len(msg.Payload.Pages[0].Buttons) != 1 {
		t.Fatalf("payload deveria conter 1 página com 1 botão: %+v", msg.Payload.Pages)
	}
	// O token NUNCA viaja na config enviada ao celular (clone() o zera).
	if msg.Payload.Server.Token != "" {
		t.Fatalf("token vazou na configMessage: %q", msg.Payload.Server.Token)
	}
}

func TestNetworkURLComToken(t *testing.T) {
	const tok = "deadbeefdeadbeefdeadbeefdeadbeef"
	store := newStore(t, deckComBotao(tok, config.Button{
		ID:     "btn_n",
		Label:  "N",
		Action: action.Spec{Type: "keypress", Keys: []string{"a"}},
	}))
	s := New(store, &fakeInput{}, &fakeLauncher{}, emptyAssets)

	// Simula um servidor já "ligado" preenchendo IP/porta (sem bind real).
	s.mu.Lock()
	s.activeIP = "192.168.0.42"
	s.boundPort = 8754
	s.ips = []string{"192.168.0.42"}
	s.mu.Unlock()

	info := s.Network()
	want := "http://192.168.0.42:8754/?t=" + tok
	if info.URL != want {
		t.Fatalf("URL = %q, quero %q", info.URL, want)
	}
}

func TestNetworkSemIPouPortaURLVazia(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_v",
		Label:  "V",
		Action: action.Spec{Type: "keypress", Keys: []string{"a"}},
	}))
	s := New(store, &fakeInput{}, &fakeLauncher{}, emptyAssets)

	t.Run("sem IP nem porta", func(t *testing.T) {
		if got := s.Network().URL; got != "" {
			t.Fatalf("URL = %q, quero vazia", got)
		}
	})
	t.Run("com IP mas sem porta", func(t *testing.T) {
		s.mu.Lock()
		s.activeIP = "192.168.0.1"
		s.boundPort = 0
		s.mu.Unlock()
		if got := s.Network().URL; got != "" {
			t.Fatalf("URL = %q, quero vazia (sem porta)", got)
		}
	})
}

// TestQRCodeSemURL: sem URL montável, QRCode devolve um *i18n.Error com a chave
// errors.server.noURL (aserimos a chave via errors.As).
func TestQRCodeSemURL(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_q",
		Label:  "Q",
		Action: action.Spec{Type: "keypress", Keys: []string{"a"}},
	}))
	s := New(store, &fakeInput{}, &fakeLauncher{}, emptyAssets)

	_, err := s.QRCode()
	if err == nil {
		t.Fatal("QRCode sem URL deveria falhar")
	}
	if got := errKey(err); got != "errors.server.noURL" {
		t.Fatalf("chave = %q, quero errors.server.noURL (erro: %v)", got, err)
	}
}

// TestQRCodeComURL: com IP/porta, QRCode devolve um data URL PNG válido.
func TestQRCodeComURL(t *testing.T) {
	store := newStore(t, deckComBotao("tok", config.Button{
		ID:     "btn_qc",
		Label:  "QC",
		Action: action.Spec{Type: "keypress", Keys: []string{"a"}},
	}))
	s := New(store, &fakeInput{}, &fakeLauncher{}, emptyAssets)
	s.mu.Lock()
	s.activeIP = "192.168.0.1"
	s.boundPort = 8754
	s.mu.Unlock()

	data, err := s.QRCode()
	if err != nil {
		t.Fatalf("QRCode erro: %v", err)
	}
	if !strings.HasPrefix(data, "data:image/png;base64,") {
		t.Fatalf("data URL com prefixo inesperado: %.40q", data)
	}
}

// errKey extrai a chave i18n de um erro do backend (mesmo padrão de
// action_test.go). Os erros internos são *i18n.Error nomeando a chave.
func errKey(err error) string {
	var e *i18n.Error
	if errors.As(err, &e) {
		return e.Key
	}
	return ""
}
