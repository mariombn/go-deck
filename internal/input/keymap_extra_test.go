package input

import "testing"

// TestLookupModificadoresMacOS confirma que cmd e opt existem no vocabulário e
// são tratados como modificadores. (No keymap atual cmd/opt são compartilhados
// pelo binário em qualquer SO, mas semanticamente são macOS-only — ver
// CLAUDE.md.)
func TestLookupModificadoresMacOS(t *testing.T) {
	for _, nome := range []string{"cmd", "opt"} {
		if !isModifier(nome) {
			t.Errorf("%q deveria ser tratado como modificador", nome)
		}
	}
}

// TestLookupTeclasDeMidia: as teclas de mídia (clássicas de um deck) resolvem
// para os virtual-keys corretos e são estendidas.
func TestLookupTeclasDeMidia(t *testing.T) {
	casos := []struct {
		nome string
		code uint16
	}{
		{"volup", 0xAF},
		{"voldown", 0xAE},
		{"mute", 0xAD},
		{"playpause", 0xB3},
		{"nexttrack", 0xB0},
		{"prevtrack", 0xB1},
	}
	for _, c := range casos {
		v, ok := lookup(c.nome)
		if !ok {
			t.Errorf("%q não encontrado no keymap", c.nome)
			continue
		}
		if v.code != c.code {
			t.Errorf("%q: code = %#x, esperado %#x", c.nome, v.code, c.code)
		}
		if !v.extended {
			t.Errorf("%q deveria ser tecla estendida", c.nome)
		}
		// Teclas de mídia não são modificadores.
		if isModifier(c.nome) {
			t.Errorf("%q não deveria ser modificador", c.nome)
		}
	}
}

// TestLookupLetras: a–z mapeiam para VK 0x41–0x5A (ASCII maiúsculo).
func TestLookupLetras(t *testing.T) {
	casos := map[string]uint16{"a": 0x41, "m": 0x4D, "z": 0x5A}
	for nome, code := range casos {
		v, ok := lookup(nome)
		if !ok {
			t.Errorf("%q não encontrado", nome)
			continue
		}
		if v.code != code || v.extended {
			t.Errorf("%q: code=%#x extended=%v, esperado %#x false", nome, v.code, v.extended, code)
		}
	}
}

// TestLookupDigitos: 0–9 mapeiam para VK 0x30–0x39.
func TestLookupDigitos(t *testing.T) {
	casos := map[string]uint16{"0": 0x30, "5": 0x35, "9": 0x39}
	for nome, code := range casos {
		v, ok := lookup(nome)
		if !ok {
			t.Errorf("%q não encontrado", nome)
			continue
		}
		if v.code != code {
			t.Errorf("%q: code=%#x, esperado %#x", nome, v.code, code)
		}
	}
}

// TestLookupFKeys: F1–F12 mapeiam para VK 0x70–0x7B.
func TestLookupFKeys(t *testing.T) {
	casos := map[string]uint16{"f1": 0x70, "f6": 0x75, "f12": 0x7B}
	for nome, code := range casos {
		v, ok := lookup(nome)
		if !ok {
			t.Errorf("%q não encontrado", nome)
			continue
		}
		if v.code != code {
			t.Errorf("%q: code=%#x, esperado %#x", nome, v.code, code)
		}
	}
}

// TestLookupTeclaDesconhecida: nome fora do vocabulário não resolve.
func TestLookupTeclaDesconhecida(t *testing.T) {
	for _, nome := range []string{"naoexiste", "f13", "ctrlx", ""} {
		if _, ok := lookup(nome); ok {
			t.Errorf("%q não deveria resolver", nome)
		}
	}
}

// TestLookupNormalizaCaixaEEspacos: o lookup é case-insensitive e apara
// espaços, para qualquer entrada do vocabulário.
func TestLookupNormalizaCaixaEEspacos(t *testing.T) {
	casos := []string{"  CTRL ", "Enter", "VolUp", "F5", "A"}
	for _, nome := range casos {
		if _, ok := lookup(nome); !ok {
			t.Errorf("lookup(%q) deveria normalizar e resolver", nome)
		}
	}
}

// TestIsModifierNegativo: teclas comuns não são modificadores.
func TestIsModifierNegativo(t *testing.T) {
	for _, nome := range []string{"a", "enter", "f1", "volup", "left"} {
		if isModifier(nome) {
			t.Errorf("%q não deveria ser modificador", nome)
		}
	}
}

// TestItoaInterno cobre o helper itoa minimalista usado para nomear F1–F12.
func TestItoaInterno(t *testing.T) {
	casos := map[int]string{0: "0", 1: "1", 9: "9", 12: "12", 105: "105"}
	for n, esperado := range casos {
		if got := itoa(n); got != esperado {
			t.Errorf("itoa(%d) = %q, esperado %q", n, got, esperado)
		}
	}
}
