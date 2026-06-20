package action

import (
	"fmt"
	"strings"
	"testing"
)

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
		wantSub string // trecho esperado na mensagem de erro
	}{
		{"keypress sem teclas", Spec{Type: "keypress"}, "sem teclas"},
		{"keypress hold negativo", Spec{Type: "keypress", Keys: []string{"w"}, HoldMs: -1}, "retenção inválida"},
		{"keypress hold acima do teto", Spec{Type: "keypress", Keys: []string{"w"}, HoldMs: maxHoldMs + 1}, "retenção inválida"},
		{"launch sem path", Spec{Type: "launch"}, "sem caminho"},
		{"url vazia", Spec{Type: "url"}, "url vazia"},
		{"sequence sem passos", Spec{Type: "sequence"}, "sem passos"},
		{"obs sem operação", Spec{Type: "obs"}, "sem operação"},
		{"obs op inválida", Spec{Type: "obs", ObsOp: "explodir"}, "desconhecida"},
		{"obs scene sem alvo", Spec{Type: "obs", ObsOp: ObsOpScene}, "sem alvo"},
		{"obs mute sem alvo", Spec{Type: "obs", ObsOp: ObsOpToggleMute}, "sem alvo"},
		{"discord sem teclas", Spec{Type: "discord", DiscordOp: "mute"}, "sem teclas"},
		{"navigate sem destino", Spec{Type: "navigate"}, "sem página de destino"},
		{"tipo desconhecido", Spec{Type: "frobnicate"}, "desconhecido"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.spec.Build()
			if err == nil {
				t.Fatalf("Build() deveria ter falhado")
			}
			if !strings.Contains(err.Error(), tc.wantSub) {
				t.Fatalf("erro = %q, esperava conter %q", err.Error(), tc.wantSub)
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
	if !strings.Contains(err.Error(), "passo 2") {
		t.Fatalf("erro = %q, esperava identificar 'passo 2'", err.Error())
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
	if !strings.Contains(err.Error(), "aninhado demais") {
		t.Fatalf("erro = %q, esperava conter 'aninhado demais'", err.Error())
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
