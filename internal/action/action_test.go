package action

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"go-deck/internal/i18n"
)

// errKey extrai a chave i18n de um erro do backend. As camadas internas
// devolvem *i18n.Error nomeando a chave (a tradução só ocorre na borda), então
// os testes asseveram a CHAVE, não a frase traduzida.
func errKey(err error) string {
	var e *i18n.Error
	if errors.As(err, &e) {
		return e.Key
	}
	return ""
}

// nestSequences monta uma Spec com `depth` sequences aninhados, terminando
// num keypress válido. depth=1 => sequence[keypress].
func nestSequences(depth int) Spec {
	inner := Spec{Type: "keypress", Keys: []string{"a"}}
	for i := 0; i < depth; i++ {
		inner = Spec{Type: "sequence", Steps: []Spec{inner}}
	}
	return inner
}

func TestBuildValidTypes(t *testing.T) {
	cases := []struct {
		name string
		spec Spec
		want interface{} // tipo concreto esperado
	}{
		{"keypress", Spec{Type: "keypress", Keys: []string{"ctrl", "c"}}, KeypressAction{}},
		{"keypress hold", Spec{Type: "keypress", Keys: []string{"w"}, HoldMs: 2000}, KeypressAction{}},
		{"keypress hold no limite", Spec{Type: "keypress", Keys: []string{"w"}, HoldMs: maxHoldMs}, KeypressAction{}},
		{"launch", Spec{Type: "launch", Path: `C:\Windows\notepad.exe`, Args: []string{"x"}}, LaunchAction{}},
		{"url", Spec{Type: "url", URL: "https://example.com"}, URLAction{}},
		{"sequence", Spec{Type: "sequence", Steps: []Spec{{Type: "keypress", Keys: []string{"a"}}}}, SequenceAction{}},
		{"obs scene", Spec{Type: "obs", ObsOp: ObsOpScene, Target: "Cena 1"}, OBSAction{}},
		{"obs toggle_record", Spec{Type: "obs", ObsOp: ObsOpToggleRecord}, OBSAction{}},
		{"discord", Spec{Type: "discord", DiscordOp: "mute", Keys: []string{"ctrl", "shift", "m"}}, KeypressAction{}},
		{"navigate", Spec{Type: "navigate", TargetPage: "page_abc123"}, NavigateAction{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			act, err := tc.spec.Build()
			if err != nil {
				t.Fatalf("Build() erro inesperado: %v", err)
			}
			if got, want := typeName(act), typeName(tc.want); got != want {
				t.Fatalf("tipo concreto = %s, quero %s", got, want)
			}
		})
	}
}

func TestBuildValidationErrors(t *testing.T) {
	cases := []struct {
		name    string
		spec    Spec
		wantKey string // chave i18n esperada no *Error
	}{
		{"keypress sem teclas", Spec{Type: "keypress"}, "errors.action.keypressNoKeys"},
		{"keypress hold negativo", Spec{Type: "keypress", Keys: []string{"w"}, HoldMs: -1}, "errors.action.holdInvalid"},
		{"keypress hold acima do teto", Spec{Type: "keypress", Keys: []string{"w"}, HoldMs: maxHoldMs + 1}, "errors.action.holdInvalid"},
		{"launch sem path", Spec{Type: "launch"}, "errors.action.launchNoPath"},
		{"url vazia", Spec{Type: "url"}, "errors.action.urlEmpty"},
		{"sequence sem passos", Spec{Type: "sequence"}, "errors.action.sequenceNoSteps"},
		{"obs sem operação", Spec{Type: "obs"}, "errors.action.obsNoOp"},
		{"obs op inválida", Spec{Type: "obs", ObsOp: "explodir"}, "errors.action.obsUnknownOp"},
		{"obs scene sem alvo", Spec{Type: "obs", ObsOp: ObsOpScene}, "errors.action.obsNoTarget"},
		{"obs mute sem alvo", Spec{Type: "obs", ObsOp: ObsOpToggleMute}, "errors.action.obsNoTarget"},
		{"discord sem teclas", Spec{Type: "discord", DiscordOp: "mute"}, "errors.action.discordNoKeys"},
		{"navigate sem destino", Spec{Type: "navigate"}, "errors.action.navigateNoTarget"},
		{"tipo desconhecido", Spec{Type: "frobnicate"}, "errors.action.unknownType"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.spec.Build()
			if err == nil {
				t.Fatalf("Build() deveria ter falhado")
			}
			if got := errKey(err); got != tc.wantKey {
				t.Fatalf("chave = %q, quero %q (erro: %v)", got, tc.wantKey, err)
			}
		})
	}
}

func TestBuildSequenceErrorPropagates(t *testing.T) {
	// Um passo inválido dentro do sequence deve abortar o Build com contexto.
	spec := Spec{Type: "sequence", Steps: []Spec{
		{Type: "keypress", Keys: []string{"a"}},
		{Type: "launch"}, // sem path
	}}
	_, err := spec.Build()
	if err == nil {
		t.Fatal("Build() deveria falhar por passo inválido")
	}
	// O erro embrulha o passo falho: chave errors.action.step com a var n=2,
	// e dentro dela a causa raiz (launchNoPath).
	var e *i18n.Error
	if !errors.As(err, &e) || e.Key != "errors.action.step" {
		t.Fatalf("esperava *Error com chave errors.action.step, veio %v", err)
	}
	if fmt.Sprint(e.Vars["n"]) != "2" {
		t.Fatalf("esperava identificar o passo 2, veio n=%v", e.Vars["n"])
	}
	if errKey(e.Wrapped) != "errors.action.launchNoPath" {
		t.Fatalf("causa raiz = %q, esperava errors.action.launchNoPath", errKey(e.Wrapped))
	}
}

func TestBuildNestingWithinLimit(t *testing.T) {
	// Exatamente no limite (maxSequenceDepth níveis) ainda compila.
	spec := nestSequences(maxSequenceDepth)
	if _, err := spec.Build(); err != nil {
		t.Fatalf("aninhamento no limite deveria compilar: %v", err)
	}
}

func TestBuildNestingExceedsLimit(t *testing.T) {
	// Um nível além do limite deve ser rejeitado.
	spec := nestSequences(maxSequenceDepth + 1)
	_, err := spec.Build()
	if err == nil {
		t.Fatal("aninhamento além do limite deveria falhar")
	}
	// A causa raiz (no fundo da cadeia de errors.action.step) é sequenceTooDeep.
	if !strings.Contains(err.Error(), "errors.action.sequenceTooDeep") {
		t.Fatalf("erro = %q, esperava conter 'errors.action.sequenceTooDeep'", err.Error())
	}
}

// fakeOBS registra a última chamada feita, para checar o dispatch.
type fakeOBS struct {
	call   string
	target string
}

func (f *fakeOBS) SetScene(name string) error      { f.call, f.target = "scene", name; return nil }
func (f *fakeOBS) ToggleRecord() error             { f.call = "record"; return nil }
func (f *fakeOBS) ToggleStream() error             { f.call = "stream"; return nil }
func (f *fakeOBS) ToggleMute(input string) error   { f.call, f.target = "mute", input; return nil }
func (f *fakeOBS) TriggerHotkey(name string) error { f.call, f.target = "hotkey", name; return nil }
func (f *fakeOBS) Ping() error                     { f.call = "ping"; return nil }

func TestOBSActionDispatch(t *testing.T) {
	cases := []struct {
		op         string
		target     string
		wantCall   string
		wantTarget string
	}{
		{ObsOpScene, "Cena 1", "scene", "Cena 1"},
		{ObsOpToggleRecord, "", "record", ""},
		{ObsOpToggleStream, "", "stream", ""},
		{ObsOpToggleMute, "Mic/Aux", "mute", "Mic/Aux"},
		{ObsOpHotkey, "OBSBasic.StartRecording", "hotkey", "OBSBasic.StartRecording"},
	}
	for _, tc := range cases {
		t.Run(tc.op, func(t *testing.T) {
			fake := &fakeOBS{}
			err := OBSAction{Op: tc.op, Target: tc.target}.Execute(ExecContext{OBS: fake})
			if err != nil {
				t.Fatalf("Execute erro: %v", err)
			}
			if fake.call != tc.wantCall || fake.target != tc.wantTarget {
				t.Fatalf("dispatch = (%q,%q), quero (%q,%q)", fake.call, fake.target, tc.wantCall, tc.wantTarget)
			}
		})
	}
}

func TestOBSActionNilController(t *testing.T) {
	err := OBSAction{Op: ObsOpToggleRecord}.Execute(ExecContext{})
	if err == nil {
		t.Fatal("Execute sem ctx.OBS deveria falhar")
	}
}

// typeName devolve o nome do tipo concreto (sem o pacote) para comparação.
func typeName(v interface{}) string {
	return strings.TrimPrefix(fmt.Sprintf("%T", v), "action.")
}
