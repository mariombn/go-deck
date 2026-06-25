//go:build windows

package input

import (
	"fmt"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"

	"go-deck/internal/i18n"
)

// Flags do SendInput / KEYBDINPUT.
const (
	inputKeyboard = 1

	keyeventfExtendedKey = 0x0001
	keyeventfKeyUp       = 0x0002
)

// keybdInput espelha a struct KEYBDINPUT do Win32 (24 bytes em amd64).
type keybdInput struct {
	wVk         uint16
	wScan       uint16
	dwFlags     uint32
	time        uint32
	dwExtraInfo uintptr
}

// rawInput espelha a struct INPUT do Win32 para o caso teclado. Em amd64
// o INPUT tem 40 bytes: 4 (type) + 4 (padding de alinhamento) + 24
// (KEYBDINPUT) + 8 (resto da union, que comporta o MOUSEINPUT). O campo de
// padding final garante esse tamanho independente do KEYBDINPUT.
type rawInput struct {
	inputType uint32
	ki        keybdInput
	_         [8]byte
}

var (
	user32       = windows.NewLazySystemDLL("user32.dll")
	procSendInut = user32.NewProc("SendInput")
)

// windowsController implementa InputController via SendInput nativo.
type windowsController struct{}

func newController() InputController { return windowsController{} }

// SendKeys monta a sequência de eventos de um combo simultâneo e a envia.
//
// Toque (holdMs == 0): tudo numa única chamada de SendInput (atômica do ponto
// de vista do SO):
//
//	modificadores DOWN (ordem) -> principais DOWN+UP (ordem) -> modificadores UP (inversa)
//
// Apertar e manter (holdMs > 0): duas chamadas com uma espera no meio — TODAS
// as teclas DOWN, sleep, TODAS as teclas UP (inversa). Durante a espera o combo
// fica fisicamente pressionado:
//
//	tudo DOWN (ordem) -> sleep holdMs -> tudo UP (inversa)
func (windowsController) SendKeys(keys []string, holdMs int) error {
	if len(keys) == 0 {
		return i18n.New("errors.input.comboEmpty", nil)
	}

	// Valida tudo antes de enviar qualquer evento (all-or-nothing).
	resolved := make([]struct {
		v   vkey
		mod bool
	}, len(keys))
	for i, k := range keys {
		v, ok := lookup(k)
		if !ok {
			return i18n.New("errors.input.unknownKey", map[string]any{"key": k})
		}
		resolved[i] = struct {
			v   vkey
			mod bool
		}{v, isModifier(k)}
	}

	if holdMs > 0 {
		// Apertar e manter: DOWN de tudo (modificadores na ordem, depois
		// principais na ordem), espera, e UP de tudo na ordem inversa.
		var down []rawInput
		for _, r := range resolved {
			if r.mod {
				down = append(down, keyEvent(r.v, false))
			}
		}
		for _, r := range resolved {
			if !r.mod {
				down = append(down, keyEvent(r.v, false))
			}
		}
		if err := sendInputs(down); err != nil {
			return err
		}

		time.Sleep(time.Duration(holdMs) * time.Millisecond)

		var up []rawInput
		for i := len(resolved) - 1; i >= 0; i-- {
			up = append(up, keyEvent(resolved[i].v, true))
		}
		return sendInputs(up)
	}

	var events []rawInput

	// 1) Modificadores DOWN, na ordem.
	for _, r := range resolved {
		if r.mod {
			events = append(events, keyEvent(r.v, false))
		}
	}
	// 2) Teclas principais DOWN+UP, na ordem.
	for _, r := range resolved {
		if !r.mod {
			events = append(events, keyEvent(r.v, false))
			events = append(events, keyEvent(r.v, true))
		}
	}
	// 3) Modificadores UP, na ordem inversa.
	for i := len(resolved) - 1; i >= 0; i-- {
		if resolved[i].mod {
			events = append(events, keyEvent(resolved[i].v, true))
		}
	}

	return sendInputs(events)
}

// sendInputs envia um lote de eventos numa única chamada de SendInput e
// confere que todos foram aceitos.
func sendInputs(events []rawInput) error {
	if len(events) == 0 {
		return nil
	}
	sent, _, err := procSendInut.Call(
		uintptr(len(events)),
		uintptr(unsafe.Pointer(&events[0])),
		uintptr(unsafe.Sizeof(rawInput{})),
	)
	if int(sent) != len(events) {
		return i18n.New("errors.input.sendFailed", map[string]any{
			"sent": sent, "total": len(events), "detail": fmt.Sprint(err),
		})
	}
	return nil
}

// keyEvent constrói um evento de tecla (down ou up) para o virtual-key dado.
func keyEvent(v vkey, up bool) rawInput {
	var flags uint32
	if v.extended {
		flags |= keyeventfExtendedKey
	}
	if up {
		flags |= keyeventfKeyUp
	}
	return rawInput{
		inputType: inputKeyboard,
		ki: keybdInput{
			wVk:     v.code,
			dwFlags: flags,
		},
	}
}
