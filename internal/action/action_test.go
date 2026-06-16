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
		{"launch", Spec{Type: "launch", Path: `C:\Windows\notepad.exe`, Args: []string{"x"}}, LaunchAction{}},
		{"url", Spec{Type: "url", URL: "https://example.com"}, URLAction{}},
		{"sequence", Spec{Type: "sequence", Steps: []Spec{{Type: "keypress", Keys: []string{"a"}}}}, SequenceAction{}},
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
		{"launch sem path", Spec{Type: "launch"}, "sem caminho"},
		{"url vazia", Spec{Type: "url"}, "url vazia"},
		{"sequence sem passos", Spec{Type: "sequence"}, "sem passos"},
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

// typeName devolve o nome do tipo concreto (sem o pacote) para comparação.
func typeName(v interface{}) string {
	return strings.TrimPrefix(fmt.Sprintf("%T", v), "action.")
}
