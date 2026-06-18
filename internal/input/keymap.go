package input

import "strings"

// vkey descreve o virtual-key code de uma tecla e se ela é "estendida"
// (teclas que exigem KEYEVENTF_EXTENDEDKEY no SendInput: setas, navegação,
// teclas de mídia, etc.).
type vkey struct {
	code     uint16
	extended bool
}

// modifiers são as teclas que ficam pressionadas durante o combo.
var modifiers = map[string]bool{
	"ctrl":  true,
	"shift": true,
	"alt":   true,
	"win":   true,
	"cmd":   true, // macOS Command (⌘)
	"opt":   true, // macOS Option (⌥), alias de alt
}

// keymap mapeia os nomes usados no config.json para virtual-key codes do
// Windows. Cobre o vocabulário decidido para a POC: modificadores, letras,
// dígitos, F1–F12, especiais de navegação e teclas de mídia.
var keymap = map[string]vkey{
	// Modificadores
	"ctrl":  {0x11, false}, // VK_CONTROL
	"shift": {0x10, false}, // VK_SHIFT
	"alt":   {0x12, false}, // VK_MENU
	"win":   {0x5B, true},  // VK_LWIN (estendida)

	// Especiais
	"enter":     {0x0D, false}, // VK_RETURN
	"esc":       {0x1B, false}, // VK_ESCAPE
	"tab":       {0x09, false}, // VK_TAB
	"space":     {0x20, false}, // VK_SPACE
	"backspace": {0x08, false}, // VK_BACK
	"delete":    {0x2E, true},  // VK_DELETE (estendida)
	"insert":    {0x2D, true},  // VK_INSERT (estendida)
	"home":      {0x24, true},  // VK_HOME (estendida)
	"end":       {0x23, true},  // VK_END (estendida)
	"pageup":    {0x21, true},  // VK_PRIOR (estendida)
	"pagedown":  {0x22, true},  // VK_NEXT (estendida)
	"left":      {0x25, true},  // VK_LEFT (estendida)
	"up":        {0x26, true},  // VK_UP (estendida)
	"right":     {0x27, true},  // VK_RIGHT (estendida)
	"down":      {0x28, true},  // VK_DOWN (estendida)

	// Teclas de mídia (caso de uso clássico de um deck)
	"volup":     {0xAF, true}, // VK_VOLUME_UP
	"voldown":   {0xAE, true}, // VK_VOLUME_DOWN
	"mute":      {0xAD, true}, // VK_VOLUME_MUTE
	"playpause": {0xB3, true}, // VK_MEDIA_PLAY_PAUSE
	"nexttrack": {0xB0, true}, // VK_MEDIA_NEXT_TRACK
	"prevtrack": {0xB1, true}, // VK_MEDIA_PREV_TRACK
}

func init() {
	// Letras a–z -> VK 0x41–0x5A (códigos ASCII maiúsculos).
	for c := byte('a'); c <= 'z'; c++ {
		keymap[string(c)] = vkey{uint16('A' + (c - 'a')), false}
	}
	// Dígitos 0–9 -> VK 0x30–0x39.
	for c := byte('0'); c <= '9'; c++ {
		keymap[string(c)] = vkey{uint16(c), false}
	}
	// F1–F12 -> VK 0x70–0x7B.
	for i := 0; i < 12; i++ {
		keymap["f"+itoa(i+1)] = vkey{uint16(0x70 + i), false}
	}
}

// lookup resolve o nome de uma tecla (case-insensitive) para seu vkey.
func lookup(name string) (vkey, bool) {
	v, ok := keymap[strings.ToLower(strings.TrimSpace(name))]
	return v, ok
}

func isModifier(name string) bool {
	return modifiers[strings.ToLower(strings.TrimSpace(name))]
}

// itoa minimalista para evitar importar strconv só por isto.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [4]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
