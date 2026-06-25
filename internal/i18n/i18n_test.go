package i18n

import (
	"errors"
	"strings"
	"testing"
	"testing/fstest"
)

// catálogoEN é o conteúdo base usado na maioria dos testes: JSON aninhado
// (achatado em chaves pontuadas), um _meta no topo (deve ser ignorado) e
// strings com placeholders {{var}}.
const catálogoEN = `{
	"_meta": { "name": "English", "code": "en" },
	"buttonEditor": { "save": "Save", "cancel": "Cancel" },
	"errors": {
		"obs": {
			"disabled": "OBS disabled",
			"connectFailed": "connect to {{addr}} failed: {{detail}}"
		},
		"step": "step {{n}}: {{detail}}"
	},
	"greeting": "Hello {{name}}"
}`

const catálogoPTBR = `{
	"_meta": { "name": "Português", "code": "pt-BR" },
	"buttonEditor": { "save": "Salvar" },
	"greeting": "Olá {{name}}"
}`

// carregaCatálogosPadrão monta um MapFS com en.json e pt-BR.json e chama Load.
// Falha o teste se Load retornar erro. Como catalogs é estado global de pacote,
// cada teste que precisa de catálogo previsível chama isto primeiro.
func carregaCatálogosPadrão(t *testing.T) {
	t.Helper()
	fsys := fstest.MapFS{
		"en.json":    {Data: []byte(catálogoEN)},
		"pt-BR.json": {Data: []byte(catálogoPTBR)},
	}
	if err := Load(fsys); err != nil {
		t.Fatalf("Load retornou erro inesperado: %v", err)
	}
}

func TestLoad(t *testing.T) {
	t.Run("achata JSON aninhado em chaves pontuadas", func(t *testing.T) {
		carregaCatálogosPadrão(t)
		mu.RLock()
		defer mu.RUnlock()
		en := catalogs["en"]
		if got := en["buttonEditor.save"]; got != "Save" {
			t.Errorf("buttonEditor.save = %q, esperado %q", got, "Save")
		}
		if got := en["errors.obs.disabled"]; got != "OBS disabled" {
			t.Errorf("errors.obs.disabled = %q, esperado %q", got, "OBS disabled")
		}
	})

	t.Run("ignora _meta no topo", func(t *testing.T) {
		carregaCatálogosPadrão(t)
		mu.RLock()
		defer mu.RUnlock()
		for k := range catalogs["en"] {
			if k == "_meta" || k == "_meta.name" || k == "_meta.code" {
				t.Errorf("chave de _meta vazou no catálogo: %q", k)
			}
		}
	})

	t.Run("código do idioma vem do nome do arquivo", func(t *testing.T) {
		carregaCatálogosPadrão(t)
		mu.RLock()
		defer mu.RUnlock()
		if _, ok := catalogs["en"]; !ok {
			t.Error("idioma en ausente")
		}
		if _, ok := catalogs["pt-BR"]; !ok {
			t.Error("idioma pt-BR ausente")
		}
	})

	t.Run("pula arquivos não-.json", func(t *testing.T) {
		fsys := fstest.MapFS{
			"en.json":     {Data: []byte(`{"a":"A"}`)},
			"leia-me.txt": {Data: []byte("não é json")},
			"notas.md":    {Data: []byte("# título")},
		}
		if err := Load(fsys); err != nil {
			t.Fatalf("Load retornou erro inesperado: %v", err)
		}
		mu.RLock()
		defer mu.RUnlock()
		if len(catalogs) != 1 {
			t.Errorf("esperado 1 catálogo, obtido %d", len(catalogs))
		}
		if _, ok := catalogs["en"]; !ok {
			t.Error("idioma en ausente")
		}
	})

	t.Run("pula diretórios", func(t *testing.T) {
		fsys := fstest.MapFS{
			"en.json":         {Data: []byte(`{"a":"A"}`)},
			"sub/dentro.json": {Data: []byte(`{"b":"B"}`)},
		}
		if err := Load(fsys); err != nil {
			t.Fatalf("Load retornou erro inesperado: %v", err)
		}
		mu.RLock()
		defer mu.RUnlock()
		// "sub" é um diretório na raiz e deve ser pulado; só "en" entra.
		if _, ok := catalogs["sub"]; ok {
			t.Error("diretório sub não deveria virar catálogo")
		}
		if _, ok := catalogs["en"]; !ok {
			t.Error("idioma en ausente")
		}
	})

	t.Run("erro de JSON inválido", func(t *testing.T) {
		fsys := fstest.MapFS{
			"en.json": {Data: []byte(`{ isto não é json`)},
		}
		err := Load(fsys)
		if err == nil {
			t.Fatal("esperado erro de JSON inválido, obtido nil")
		}
		// A mensagem deve nomear o arquivo de locale problemático.
		if !errorContém(err, "en.json") {
			t.Errorf("erro deveria nomear o arquivo: %v", err)
		}
	})

	t.Run("é idempotente substituindo o conteúdo carregado", func(t *testing.T) {
		carregaCatálogosPadrão(t)
		// Recarrega com um conjunto diferente (só fr.json).
		fsys := fstest.MapFS{"fr.json": {Data: []byte(`{"x":"X"}`)}}
		if err := Load(fsys); err != nil {
			t.Fatalf("Load retornou erro: %v", err)
		}
		mu.RLock()
		defer mu.RUnlock()
		if _, ok := catalogs["en"]; ok {
			t.Error("en deveria ter sido substituído ao recarregar")
		}
		if _, ok := catalogs["fr"]; !ok {
			t.Error("fr ausente após recarga")
		}
	})
}

func TestT(t *testing.T) {
	carregaCatálogosPadrão(t)

	t.Run("lookup no idioma pedido", func(t *testing.T) {
		if got := T("pt-BR", "buttonEditor.save", nil); got != "Salvar" {
			t.Errorf("T = %q, esperado %q", got, "Salvar")
		}
	})

	t.Run("fallback para DefaultLang quando a chave falta no idioma", func(t *testing.T) {
		// pt-BR não tem buttonEditor.cancel; cai para o en.
		if got := T("pt-BR", "buttonEditor.cancel", nil); got != "Cancel" {
			t.Errorf("T = %q, esperado fallback %q", got, "Cancel")
		}
	})

	t.Run("fallback para DefaultLang quando o idioma não existe", func(t *testing.T) {
		if got := T("xx", "buttonEditor.save", nil); got != "Save" {
			t.Errorf("T = %q, esperado fallback %q", got, "Save")
		}
	})

	t.Run("chave totalmente ausente devolve a própria chave", func(t *testing.T) {
		if got := T("en", "nao.existe.nada", nil); got != "nao.existe.nada" {
			t.Errorf("T = %q, esperado a própria chave", got)
		}
	})

	t.Run("interpolação de {{var}}", func(t *testing.T) {
		if got := T("en", "greeting", map[string]any{"name": "Mario"}); got != "Hello Mario" {
			t.Errorf("T = %q, esperado %q", got, "Hello Mario")
		}
	})

	t.Run("placeholder sem valor é mantido", func(t *testing.T) {
		// vars vazio: a string tem {{name}} mas nada o substitui.
		if got := T("en", "greeting", nil); got != "Hello {{name}}" {
			t.Errorf("T = %q, esperado o placeholder intacto", got)
		}
	})
}

func TestInterpolate(t *testing.T) {
	t.Run("sem vars retorna a string igual", func(t *testing.T) {
		s := "Hello {{name}}"
		if got := interpolate(s, nil); got != s {
			t.Errorf("interpolate = %q, esperado %q", got, s)
		}
	})

	t.Run("sem {{ retorna igual mesmo com vars", func(t *testing.T) {
		s := "sem placeholder"
		if got := interpolate(s, map[string]any{"name": "x"}); got != s {
			t.Errorf("interpolate = %q, esperado %q", got, s)
		}
	})

	t.Run("substituição múltipla", func(t *testing.T) {
		s := "{{a}} e {{b}} e {{a}}"
		got := interpolate(s, map[string]any{"a": "1", "b": "2"})
		if got != "1 e 2 e 1" {
			t.Errorf("interpolate = %q, esperado %q", got, "1 e 2 e 1")
		}
	})

	t.Run("placeholder sem valor correspondente é mantido", func(t *testing.T) {
		got := interpolate("{{a}}-{{b}}", map[string]any{"a": "1"})
		if got != "1-{{b}}" {
			t.Errorf("interpolate = %q, esperado %q", got, "1-{{b}}")
		}
	})
}

func TestErrorMétodos(t *testing.T) {
	t.Run("Error() sem Wrapped devolve a chave", func(t *testing.T) {
		e := New("errors.obs.disabled", nil)
		if got := e.Error(); got != "errors.obs.disabled" {
			t.Errorf("Error() = %q, esperado a chave", got)
		}
	})

	t.Run("Error() com Wrapped concatena chave e detalhe", func(t *testing.T) {
		base := errors.New("conexão recusada")
		e := Wrap("errors.obs.connectFailed", nil, base)
		want := "errors.obs.connectFailed: conexão recusada"
		if got := e.Error(); got != want {
			t.Errorf("Error() = %q, esperado %q", got, want)
		}
	})

	t.Run("Unwrap devolve o erro embrulhado", func(t *testing.T) {
		base := errors.New("base")
		e := Wrap("k", nil, base)
		if got := e.Unwrap(); got != base {
			t.Errorf("Unwrap = %v, esperado %v", got, base)
		}
	})

	t.Run("Unwrap de erro sem Wrapped é nil", func(t *testing.T) {
		if got := New("k", nil).Unwrap(); got != nil {
			t.Errorf("Unwrap = %v, esperado nil", got)
		}
	})

	t.Run("New guarda chave e vars", func(t *testing.T) {
		vars := map[string]any{"x": 1}
		e := New("minha.chave", vars)
		if e.Key != "minha.chave" {
			t.Errorf("Key = %q", e.Key)
		}
		if e.Vars["x"] != 1 {
			t.Errorf("Vars = %v", e.Vars)
		}
		if e.Wrapped != nil {
			t.Errorf("Wrapped = %v, esperado nil", e.Wrapped)
		}
	})

	t.Run("Wrap guarda chave, vars e wrapped", func(t *testing.T) {
		base := errors.New("base")
		e := Wrap("minha.chave", map[string]any{"y": 2}, base)
		if e.Key != "minha.chave" {
			t.Errorf("Key = %q", e.Key)
		}
		if e.Vars["y"] != 2 {
			t.Errorf("Vars = %v", e.Vars)
		}
		if e.Wrapped != base {
			t.Errorf("Wrapped = %v, esperado %v", e.Wrapped, base)
		}
	})

	t.Run("errors.As atravessa a cadeia até *Error", func(t *testing.T) {
		base := errors.New("base")
		e := Wrap("k", nil, base)
		var alvo *Error
		if !errors.As(error(e), &alvo) {
			t.Fatal("errors.As deveria achar *Error")
		}
		if alvo.Key != "k" {
			t.Errorf("Key = %q", alvo.Key)
		}
	})
}

func TestTranslate(t *testing.T) {
	carregaCatálogosPadrão(t)

	t.Run("nil devolve string vazia", func(t *testing.T) {
		if got := Translate("en", nil); got != "" {
			t.Errorf("Translate(nil) = %q, esperado vazio", got)
		}
	})

	t.Run("*Error traduz pela chave", func(t *testing.T) {
		e := New("errors.obs.disabled", nil)
		if got := Translate("en", e); got != "OBS disabled" {
			t.Errorf("Translate = %q, esperado %q", got, "OBS disabled")
		}
	})

	t.Run("erro cru (não-*Error) devolve a própria mensagem", func(t *testing.T) {
		base := errors.New("falha de rede")
		if got := Translate("en", base); got != "falha de rede" {
			t.Errorf("Translate = %q, esperado %q", got, "falha de rede")
		}
	})

	t.Run("cadeia com Wrapped expõe {{detail}}", func(t *testing.T) {
		base := errors.New("recusado")
		e := Wrap("errors.obs.connectFailed", map[string]any{"addr": "host:4455"}, base)
		want := "connect to host:4455 failed: recusado"
		if got := Translate("en", e); got != want {
			t.Errorf("Translate = %q, esperado %q", got, want)
		}
	})

	t.Run("Wrapped é traduzido recursivamente quando também é *Error", func(t *testing.T) {
		// O detalhe é, ele próprio, um *Error com chave traduzível.
		interno := New("errors.obs.disabled", nil)
		externo := Wrap("errors.step", map[string]any{"n": 2}, interno)
		want := "step 2: OBS disabled"
		if got := Translate("en", externo); got != want {
			t.Errorf("Translate = %q, esperado %q", got, want)
		}
	})

	t.Run("traduz no idioma pedido com fallback", func(t *testing.T) {
		e := New("buttonEditor.save", nil)
		if got := Translate("pt-BR", e); got != "Salvar" {
			t.Errorf("Translate pt-BR = %q, esperado %q", got, "Salvar")
		}
		// chave só existente no en, pedindo pt-BR: cai para o en.
		eCancel := New("buttonEditor.cancel", nil)
		if got := Translate("pt-BR", eCancel); got != "Cancel" {
			t.Errorf("Translate pt-BR fallback = %q, esperado %q", got, "Cancel")
		}
	})
}

func TestTranslateErr(t *testing.T) {
	carregaCatálogosPadrão(t)

	t.Run("nil devolve nil", func(t *testing.T) {
		if got := TranslateErr("en", nil); got != nil {
			t.Errorf("TranslateErr(nil) = %v, esperado nil", got)
		}
	})

	t.Run("*Error vira error com a mensagem traduzida", func(t *testing.T) {
		e := New("errors.obs.disabled", nil)
		got := TranslateErr("en", e)
		if got == nil {
			t.Fatal("TranslateErr devolveu nil inesperadamente")
		}
		if got.Error() != "OBS disabled" {
			t.Errorf("TranslateErr = %q, esperado %q", got.Error(), "OBS disabled")
		}
	})

	t.Run("erro cru preserva a mensagem", func(t *testing.T) {
		base := errors.New("xyz")
		got := TranslateErr("en", base)
		if got == nil || got.Error() != "xyz" {
			t.Errorf("TranslateErr = %v, esperado mensagem %q", got, "xyz")
		}
	})
}

// errorContém checa se a mensagem do erro contém a substring dada.
func errorContém(err error, sub string) bool {
	return err != nil && strings.Contains(err.Error(), sub)
}
