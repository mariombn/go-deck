package obs

import (
	"errors"
	"testing"

	"go-deck/internal/i18n"
)

// TestNewRetornaControllerNãoNil garante que o construtor devolve um Controller
// utilizável (não-nil), sem abrir conexão.
func TestNewRetornaControllerNãoNil(t *testing.T) {
	c := New(Settings{})
	if c == nil {
		t.Fatal("New devolveu Controller nil")
	}
	// E o tipo concreto é *client, carregando as settings dadas.
	cl, ok := c.(*client)
	if !ok {
		t.Fatalf("tipo concreto inesperado: %T", c)
	}
	if cl.settings.Enabled {
		t.Error("settings.Enabled deveria ser false por padrão")
	}
}

// TestSettingsMapeamento confirma que os campos passados ao New chegam intactos
// ao client (mapeamento direto, sem transformação).
func TestSettingsMapeamento(t *testing.T) {
	s := Settings{Enabled: true, Host: "10.0.0.5", Port: 4456, Password: "segredo"}
	cl := New(s).(*client)
	if cl.settings.Enabled != s.Enabled {
		t.Errorf("Enabled = %v, esperado %v", cl.settings.Enabled, s.Enabled)
	}
	if cl.settings.Host != s.Host {
		t.Errorf("Host = %q, esperado %q", cl.settings.Host, s.Host)
	}
	if cl.settings.Port != s.Port {
		t.Errorf("Port = %d, esperado %d", cl.settings.Port, s.Port)
	}
	if cl.settings.Password != s.Password {
		t.Errorf("Password = %q, esperado %q", cl.settings.Password, s.Password)
	}
}

// TestNewSatisfazInterface verifica em tempo de compilação/execução que *client
// implementa todos os métodos esperados de Controller.
func TestNewSatisfazInterface(t *testing.T) {
	var _ Controller = (*client)(nil)
	var c Controller = New(Settings{})
	// Apenas referenciamos os métodos para garantir que existem na interface.
	// Não os invocamos aqui para não disparar dial de rede.
	_ = c
}

// TestConnectDesabilitado é o único caminho de "ação" exercitável sem rede: com
// Enabled=false, connect() retorna cedo um *Error com a chave de OBS desabilitado,
// ANTES de qualquer tentativa de dial. Os métodos públicos (SetScene, etc.)
// passam por connect() via do(), então também falham rápido nesse estado.
func TestConnectDesabilitado(t *testing.T) {
	cl := New(Settings{Enabled: false}).(*client)
	_, err := cl.connect()
	if err == nil {
		t.Fatal("connect() deveria falhar com Enabled=false")
	}
	asseveraChave(t, err, "errors.obs.disabled")
}

// TestMétodosPúblicosComDesabilitado garante que cada método de ação, com a
// integração desligada, devolve o erro de desabilitado sem tocar a rede. do()
// chama connect() primeiro, então o curto-circuito acontece antes do dial.
func TestMétodosPúblicosComDesabilitado(t *testing.T) {
	c := New(Settings{Enabled: false})
	casos := map[string]func() error{
		"SetScene":      func() error { return c.SetScene("Cena") },
		"ToggleRecord":  func() error { return c.ToggleRecord() },
		"ToggleStream":  func() error { return c.ToggleStream() },
		"ToggleMute":    func() error { return c.ToggleMute("Mic") },
		"TriggerHotkey": func() error { return c.TriggerHotkey("hk") },
		"Ping":          func() error { return c.Ping() },
	}
	for nome, fn := range casos {
		t.Run(nome, func(t *testing.T) {
			err := fn()
			if err == nil {
				t.Fatalf("%s deveria falhar com Enabled=false", nome)
			}
			asseveraChave(t, err, "errors.obs.disabled")
		})
	}
}

// asseveraChave confirma que o erro é (ou embrulha) um *i18n.Error com a chave
// esperada, conforme o contrato do backend.
func asseveraChave(t *testing.T, err error, chave string) {
	t.Helper()
	var e *i18n.Error
	if !errors.As(err, &e) {
		t.Fatalf("erro não é *i18n.Error: %v (%T)", err, err)
	}
	if e.Key != chave {
		t.Errorf("chave = %q, esperado %q", e.Key, chave)
	}
}
