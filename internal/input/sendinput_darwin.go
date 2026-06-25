//go:build darwin

package input

/*
#cgo LDFLAGS: -framework ApplicationServices
#include <ApplicationServices/ApplicationServices.h>

// ensureAccessibility abre o painel de Acessibilidade se o app ainda não
// tiver permissão. Retorna 1 se confiado, 0 caso contrário.
static int ensureAccessibility() {
	const void *keys[]   = { kAXTrustedCheckOptionPrompt };
	const void *values[] = { kCFBooleanTrue };
	CFDictionaryRef opts = CFDictionaryCreate(
		kCFAllocatorDefault, keys, values, 1,
		&kCFTypeDictionaryKeyCallBacks,
		&kCFTypeDictionaryValueCallBacks);
	bool trusted = AXIsProcessTrustedWithOptions(opts);
	CFRelease(opts);
	return trusted ? 1 : 0;
}

// postKeyEvent envia um evento de tecla (down=1 / up=0) com os flags de
// modificador. flags=0 => evento sem modificadores.
static void postKeyEvent(CGKeyCode keyCode, CGEventFlags flags, int down) {
	CGEventRef ev = CGEventCreateKeyboardEvent(NULL, keyCode, down != 0);
	if (flags) CGEventSetFlags(ev, flags);
	CGEventPost(kCGSessionEventTap, ev);
	CFRelease(ev);
}
*/
import "C"

import (
	"strings"
	"time"

	"go-deck/internal/i18n"
)

// darwinController implementa InputController via CGEvent (CoreGraphics).
type darwinController struct{}

func newController() InputController { return darwinController{} }

// macModFlags mapeia modificadores para bitmasks CGEventFlags.
var macModFlags = map[string]uint64{
	"shift": 0x00020000, // kCGEventFlagMaskShift
	"ctrl":  0x00040000, // kCGEventFlagMaskControl
	"alt":   0x00080000, // kCGEventFlagMaskAlternate
	"opt":   0x00080000,
	"cmd":   0x00100000, // kCGEventFlagMaskCommand
	"win":   0x00100000, // equivalente macOS do Win
	// Variantes por lado — usam o mesmo bitmask genérico; a diferenciação
	// real vem do CGKeyCode específico (esquerda x direita) em cgKeymap.
	"lctrl": 0x00040000,
	"rctrl": 0x00040000,
	"lalt":  0x00080000,
	"ralt":  0x00080000,
}

// cgKeymap mapeia nomes de teclas para CGKeyCode do macOS (layout ANSI).
var cgKeymap = map[string]uint32{
	// Modificadores (como teclas isoladas)
	"ctrl":  59, // kVK_Control
	"shift": 56, // kVK_Shift
	"alt":   58, // kVK_Option
	"opt":   58,
	"cmd":   55, // kVK_Command
	"win":   55,
	// Variantes por lado (o macOS tem keycodes distintos p/ esquerda x direita)
	"lctrl": 59, // kVK_Control (esquerdo)
	"rctrl": 62, // kVK_RightControl
	"lalt":  58, // kVK_Option (esquerdo)
	"ralt":  61, // kVK_RightOption

	// Especiais
	"enter":     36,  // kVK_Return
	"esc":       53,  // kVK_Escape
	"tab":       48,  // kVK_Tab
	"space":     49,  // kVK_Space
	"backspace": 51,  // kVK_Delete
	"delete":    117, // kVK_ForwardDelete
	"insert":    114, // kVK_Help (posição equivalente em teclados externos)
	"home":      115, // kVK_Home
	"end":       119, // kVK_End
	"pageup":    116, // kVK_PageUp
	"pagedown":  121, // kVK_PageDown
	"left":      123, // kVK_LeftArrow
	"right":     124, // kVK_RightArrow
	"up":        126, // kVK_UpArrow
	"down":      125, // kVK_DownArrow

	// Teclas de volume (teclados com teclas de mídia físicas)
	"volup":   72, // kVK_VolumeUp
	"voldown": 73, // kVK_VolumeDown
	"mute":    74, // kVK_Mute
}

func init() {
	// Letras — CGKeyCode segue posição física ANSI, não código ASCII.
	ansiLetters := map[byte]uint32{
		'a': 0, 's': 1, 'd': 2, 'f': 3, 'h': 4, 'g': 5,
		'z': 6, 'x': 7, 'c': 8, 'v': 9, 'b': 11, 'q': 12,
		'w': 13, 'e': 14, 'r': 15, 'y': 16, 't': 17, 'i': 34,
		'o': 31, 'p': 35, 'l': 37, 'j': 38, 'k': 40, 'n': 45,
		'm': 46, 'u': 32,
	}
	for c, code := range ansiLetters {
		cgKeymap[string(c)] = code
	}
	// Dígitos
	digits := map[byte]uint32{
		'1': 18, '2': 19, '3': 20, '4': 21, '5': 23,
		'6': 22, '7': 26, '8': 28, '9': 25, '0': 29,
	}
	for c, code := range digits {
		cgKeymap[string(c)] = code
	}
	// F1–F12
	fkeys := []uint32{122, 120, 99, 118, 96, 97, 98, 100, 101, 109, 103, 111}
	for i, code := range fkeys {
		cgKeymap["f"+itoa(i+1)] = code
	}
}

// cgLookup resolve o nome de uma tecla para seu CGKeyCode.
func cgLookup(name string) (uint32, bool) {
	code, ok := cgKeymap[strings.ToLower(strings.TrimSpace(name))]
	return code, ok
}

// SendKeys dispara um combo via CGEvent, com a mesma semântica da implementação
// Windows. Os flags de modificador são aplicados nos eventos das teclas
// principais, garantindo reconhecimento pelo sistema.
//
// Toque (holdMs == 0): modificadores DOWN → principais DOWN+UP → modificadores
// UP (inverso). Apertar e manter (holdMs > 0): tudo DOWN → sleep holdMs → tudo
// UP (inverso), mantendo o combo pressionado durante a espera.
func (darwinController) SendKeys(keys []string, holdMs int) error {
	if len(keys) == 0 {
		return i18n.New("errors.input.comboEmpty", nil)
	}

	if C.ensureAccessibility() == 0 {
		return i18n.New("errors.input.accessibilityDenied", nil)
	}

	// Valida tudo antes de enviar qualquer evento (all-or-nothing).
	type resolved struct {
		code uint32
		mod  bool
	}
	res := make([]resolved, len(keys))
	for i, k := range keys {
		code, ok := cgLookup(k)
		if !ok {
			return i18n.New("errors.input.unknownKey", map[string]any{"key": k})
		}
		res[i] = resolved{code, isModifier(k)}
	}

	// Calcula o bitmask CGEventFlags combinado de todos os modificadores.
	var flags uint64
	for _, k := range keys {
		if f, ok := macModFlags[strings.ToLower(strings.TrimSpace(k))]; ok {
			flags |= f
		}
	}

	if holdMs > 0 {
		// Apertar e manter: DOWN de tudo (modificadores e principais), espera,
		// UP de tudo na ordem inversa.
		for _, r := range res {
			if r.mod {
				C.postKeyEvent(C.CGKeyCode(r.code), 0, 1)
			}
		}
		for _, r := range res {
			if !r.mod {
				C.postKeyEvent(C.CGKeyCode(r.code), C.CGEventFlags(flags), 1)
			}
		}
		time.Sleep(time.Duration(holdMs) * time.Millisecond)
		for i := len(res) - 1; i >= 0; i-- {
			if res[i].mod {
				C.postKeyEvent(C.CGKeyCode(res[i].code), 0, 0)
			} else {
				C.postKeyEvent(C.CGKeyCode(res[i].code), C.CGEventFlags(flags), 0)
			}
		}
		return nil
	}

	// 1) Modificadores DOWN.
	for _, r := range res {
		if r.mod {
			C.postKeyEvent(C.CGKeyCode(r.code), 0, 1)
		}
	}
	// 2) Teclas principais DOWN+UP com flags de modificadores ativos.
	for _, r := range res {
		if !r.mod {
			C.postKeyEvent(C.CGKeyCode(r.code), C.CGEventFlags(flags), 1)
			C.postKeyEvent(C.CGKeyCode(r.code), C.CGEventFlags(flags), 0)
		}
	}
	// 3) Modificadores UP (ordem inversa).
	for i := len(res) - 1; i >= 0; i-- {
		if res[i].mod {
			C.postKeyEvent(C.CGKeyCode(res[i].code), 0, 0)
		}
	}
	return nil
}
