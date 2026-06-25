// Package i18n traduz as mensagens do backend usando OS MESMOS arquivos de
// tradução do frontend (frontend/src/locales/*.json). Um arquivo = um idioma,
// cobrindo UI (lida pelo i18next no React) e erros do Go (lidos aqui).
//
// O modelo é deliberadamente mínimo (decisão P5): só lookup de chave +
// interpolação de {{var}}. Plurais ficam exclusivamente no i18next (frontend);
// o Go praticamente não pluraliza. As camadas internas (action/input/launch/…)
// NÃO chamam este pacote para traduzir: elas devolvem um *Error nomeando a
// chave, e a tradução acontece na BORDA (server.press / bindings), onde o
// idioma é conhecido (decisão P18). Isso evita acoplar as camadas ao config.
package i18n

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"sync"
)

// DefaultLang é o idioma de fallback: toda chave ausente num idioma cai aqui,
// e o en.json é o único que nos comprometemos a manter 100% (decisão P10).
const DefaultLang = "en"

var (
	mu       sync.RWMutex
	catalogs = map[string]map[string]string{} // lang -> chave achatada -> texto
	metaKey  = "_meta"                        // ignorado nos lookups de tradução
)

// Load lê todos os *.json na raiz de fsys (ex.: fs.Sub do embed dos locales),
// achatando o JSON aninhado em chaves pontuadas ("buttonEditor.save"). O código
// do idioma vem do nome do arquivo (en.json -> "en"; pt-BR.json -> "pt-BR").
// Idempotente: substitui o conteúdo carregado.
func Load(fsys fs.FS) error {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return err
	}
	loaded := map[string]map[string]string{}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".json") {
			continue
		}
		data, err := fs.ReadFile(fsys, name)
		if err != nil {
			return err
		}
		var nested map[string]any
		if err := json.Unmarshal(data, &nested); err != nil {
			return fmt.Errorf("locale %s: %w", name, err)
		}
		flat := map[string]string{}
		flatten("", nested, flat)
		lang := strings.TrimSuffix(name, ".json")
		loaded[lang] = flat
	}
	mu.Lock()
	catalogs = loaded
	mu.Unlock()
	return nil
}

// flatten percorre o mapa aninhado acumulando chaves pontuadas. Pula a chave
// _meta no topo (metadados do idioma, não traduções).
func flatten(prefix string, in map[string]any, out map[string]string) {
	for k, v := range in {
		if prefix == "" && k == metaKey {
			continue
		}
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}
		switch val := v.(type) {
		case string:
			out[key] = val
		case map[string]any:
			flatten(key, val, out)
		}
	}
}

// T traduz uma chave no idioma dado, caindo para o inglês quando a chave falta
// (ou o idioma não existe), e interpolando {{var}} com vars. Se nem o inglês
// tiver a chave, devolve a própria chave (sinaliza tradução faltando).
func T(lang, key string, vars map[string]any) string {
	mu.RLock()
	defer mu.RUnlock()
	if s, ok := lookup(lang, key); ok {
		return interpolate(s, vars)
	}
	if s, ok := lookup(DefaultLang, key); ok {
		return interpolate(s, vars)
	}
	return key
}

func lookup(lang, key string) (string, bool) {
	cat, ok := catalogs[lang]
	if !ok {
		return "", false
	}
	s, ok := cat[key]
	return s, ok
}

// interpolate substitui ocorrências de {{nome}} pelos valores de vars (formato
// compartilhado com o i18next — decisão P9). Placeholders sem valor são
// mantidos como estão.
func interpolate(s string, vars map[string]any) string {
	if len(vars) == 0 || !strings.Contains(s, "{{") {
		return s
	}
	pairs := make([]string, 0, len(vars)*2)
	for k, v := range vars {
		pairs = append(pairs, "{{"+k+"}}", fmt.Sprint(v))
	}
	return strings.NewReplacer(pairs...).Replace(s)
}

// Error é um erro que carrega a CHAVE de tradução (e suas vars), em vez de uma
// frase pronta. As camadas internas o devolvem; a borda o traduz com Translate.
// Wrapped, se presente, é traduzido recursivamente e exposto como a var
// {{detail}} (usado em "step {{n}}: {{detail}}", "launch {{path}}: {{detail}}"…).
type Error struct {
	Key     string
	Vars    map[string]any
	Wrapped error
}

// Error devolve um fallback não-traduzido (a própria chave), suficiente para
// logs e para o caso de o catálogo não estar carregado.
func (e *Error) Error() string {
	if e.Wrapped != nil {
		return e.Key + ": " + e.Wrapped.Error()
	}
	return e.Key
}

// Unwrap permite errors.Is/As atravessarem o erro encadeado.
func (e *Error) Unwrap() error { return e.Wrapped }

// New cria um *Error com chave e vars (vars pode ser nil).
func New(key string, vars map[string]any) *Error {
	return &Error{Key: key, Vars: vars}
}

// Wrap cria um *Error que embrulha outro erro, exposto como {{detail}} ao traduzir.
func Wrap(key string, vars map[string]any, err error) *Error {
	return &Error{Key: key, Vars: vars, Wrapped: err}
}

// Translate devolve a string traduzida de um erro no idioma dado. Se o erro
// (ou algo na sua cadeia) for um *Error, traduz pela chave; senão devolve a
// mensagem crua (erros de libs/SO, que não têm chave). É o ponto único de
// tradução de erros do backend (decisão P18).
func Translate(lang string, err error) string {
	if err == nil {
		return ""
	}
	var e *Error
	if errors.As(err, &e) {
		vars := map[string]any{}
		for k, v := range e.Vars {
			vars[k] = v
		}
		if e.Wrapped != nil {
			vars["detail"] = Translate(lang, e.Wrapped)
		}
		return T(lang, e.Key, vars)
	}
	return err.Error()
}

// TranslateErr é como Translate, mas devolve um error pronto (mensagem já
// traduzida) — conveniente para bindings do Wails que retornam error.
func TranslateErr(lang string, err error) error {
	if err == nil {
		return nil
	}
	return errors.New(Translate(lang, err))
}
