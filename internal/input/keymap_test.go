package input

import "testing"

// TestLadoCtrlAltDiferenciado garante que as variantes por lado de Ctrl/Alt
// existem no vocabulário, mapeiam para os virtual-keys corretos do Windows e
// marcam as variantes direitas como estendidas (o flag que de fato diferencia
// o lado direito no SendInput).
func TestLadoCtrlAltDiferenciado(t *testing.T) {
	casos := []struct {
		nome     string
		code     uint16
		extended bool
	}{
		{"lctrl", 0xA2, false}, // VK_LCONTROL
		{"rctrl", 0xA3, true},  // VK_RCONTROL (estendida)
		{"lalt", 0xA4, false},  // VK_LMENU
		{"ralt", 0xA5, true},   // VK_RMENU / AltGr (estendida)
	}
	for _, c := range casos {
		v, ok := lookup(c.nome)
		if !ok {
			t.Fatalf("%q não encontrado no keymap", c.nome)
		}
		if v.code != c.code {
			t.Errorf("%q: code = %#x, esperado %#x", c.nome, v.code, c.code)
		}
		if v.extended != c.extended {
			t.Errorf("%q: extended = %v, esperado %v", c.nome, v.extended, c.extended)
		}
		if !isModifier(c.nome) {
			t.Errorf("%q deveria ser tratado como modificador", c.nome)
		}
	}
}

// TestLadosSaoDistintos confirma que esquerda e direita não colidem no mesmo
// virtual-key (do contrário não haveria diferenciação real).
func TestLadosSaoDistintos(t *testing.T) {
	lctrl, _ := lookup("lctrl")
	rctrl, _ := lookup("rctrl")
	if lctrl.code == rctrl.code {
		t.Errorf("lctrl e rctrl têm o mesmo code %#x", lctrl.code)
	}
	lalt, _ := lookup("lalt")
	ralt, _ := lookup("ralt")
	if lalt.code == ralt.code {
		t.Errorf("lalt e ralt têm o mesmo code %#x", lalt.code)
	}
}

// TestLookupCaseInsensitive garante o contrato existente (nomes normalizados).
func TestLookupCaseInsensitive(t *testing.T) {
	if _, ok := lookup("  RCtrl "); !ok {
		t.Error("lookup deveria normalizar caixa/espaços para rctrl")
	}
}
