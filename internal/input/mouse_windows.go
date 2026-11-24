//go:build windows

package input

import (
	"fmt"
	"sync"
	"time"
	"unsafe"

	"go-deck/internal/i18n"
)

func platformKeyExists(name string) bool { _, ok := lookup(name); return ok }

// MOUSEINPUT e INPUT respeitam o alinhamento nativo em amd64/386.
type mouseInput struct {
	dx, dy            int32
	data, flags, time uint32
	extra             uintptr
}
type rawMouseInput struct {
	kind  uint32
	mouse mouseInput
}

var mouseMu sync.Mutex

func sendMouseInputs(events []mouseInput) error {
	raw := make([]rawMouseInput, len(events))
	for i, e := range events {
		raw[i] = rawMouseInput{mouse: e}
	} // INPUT_MOUSE = 0
	n, _, err := procSendInut.Call(uintptr(len(raw)), uintptr(unsafe.Pointer(&raw[0])), unsafe.Sizeof(raw[0]))
	if int(n) != len(raw) {
		return i18n.New("errors.input.sendFailed", map[string]any{"sent": n, "total": len(raw), "detail": fmt.Sprint(err)})
	}
	return nil
}

func (windowsController) SendMouse(e MouseEvent) error {
	if err := ValidateMouse(e); err != nil {
		return err
	}
	mouseMu.Lock()
	defer mouseMu.Unlock()
	switch e.Op {
	case "move":
		return sendMouseInputs([]mouseInput{{dx: int32(e.X), dy: int32(e.Y), flags: 1}})
	case "scroll":
		var events []mouseInput
		if e.X != 0 {
			events = append(events, mouseInput{data: uint32(int32(e.X * 120)), flags: 0x1000})
		}
		if e.Y != 0 {
			events = append(events, mouseInput{data: uint32(int32(e.Y * 120)), flags: 0x0800})
		}
		return sendMouseInputs(events)
	default:
		type flags struct{ down, up, data uint32 }
		f := map[string]flags{"left": {2, 4, 0}, "right": {8, 16, 0}, "middle": {32, 64, 0}, "back": {128, 256, 1}, "forward": {128, 256, 2}}[e.Button]
		click := func() (result error) {
			defer func() {
				if err := sendMouseInputs([]mouseInput{{flags: f.up, data: f.data}}); result == nil {
					result = err
				}
			}()
			if err := sendMouseInputs([]mouseInput{{flags: f.down, data: f.data}}); err != nil {
				return err
			}
			if e.HoldMs > 0 {
				time.Sleep(time.Duration(e.HoldMs) * time.Millisecond)
			}
			return nil
		}
		if err := click(); err != nil {
			return err
		}
		if e.Op == "double_click" {
			time.Sleep(60 * time.Millisecond)
			return click()
		}
		return nil
	}
}
