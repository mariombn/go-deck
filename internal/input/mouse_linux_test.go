//go:build linux

package input

import (
	"encoding/binary"
	"os"
	"testing"
	"unsafe"

	"golang.org/x/sys/unix"
)

func mouseEvents(t *testing.T, e MouseEvent) []inputEvent {
	t.Helper()
	fds := []int{0, 0}
	if err := unix.Pipe(fds); err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fds[0])
	defer unix.Close(fds[1])
	c := &linuxController{fd: -1, mouse: &linuxMouse{fd: fds[1]}}
	if err := c.SendMouse(e); err != nil {
		t.Fatal(err)
	}
	data := make([]byte, 4096)
	n, err := unix.Read(fds[0], data)
	if err != nil {
		t.Fatal(err)
	}
	size, offset := int(unsafe.Sizeof(inputEvent{})), int(unsafe.Sizeof(unix.Timeval{}))
	var events []inputEvent
	for i := 0; i < n; i += size {
		e := inputEvent{Type: binary.NativeEndian.Uint16(data[i+offset:]), Code: binary.NativeEndian.Uint16(data[i+offset+2:]), Value: int32(binary.NativeEndian.Uint32(data[i+offset+4:]))}
		if e.Type != unix.EV_SYN {
			events = append(events, e)
		}
	}
	return events
}

func TestLinuxMouseButtonsBalanced(t *testing.T) {
	for name, code := range linuxMouseButtons {
		for _, op := range []string{"click", "double_click"} {
			events := mouseEvents(t, MouseEvent{Op: op, Button: name})
			want := 2
			if op == "double_click" {
				want = 4
			}
			if len(events) != want {
				t.Fatalf("%s: %v", op, events)
			}
			for i, e := range events {
				if e.Type != unix.EV_KEY || e.Code != code || e.Value != int32(1-i%2) {
					t.Fatalf("evento inválido: %+v", e)
				}
			}
		}
	}
}

func TestLinuxMouseMovementAndScrollSigns(t *testing.T) {
	for _, tc := range []struct {
		op     string
		x, y   int
		cx, cy uint16
	}{
		{"move", -12, 34, 0, 1}, {"scroll", 2, -3, 6, 8},
	} {
		events := mouseEvents(t, MouseEvent{Op: tc.op, X: tc.x, Y: tc.y})
		if len(events) != 2 || events[0].Type != unix.EV_REL || events[0].Code != tc.cx || events[0].Value != int32(tc.x) || events[1].Code != tc.cy || events[1].Value != int32(tc.y) {
			t.Fatalf("%s: %v", tc.op, events)
		}
	}
}

func TestLinuxInvalidMouseNeverOpensDevice(t *testing.T) {
	c := &linuxController{fd: -1}
	if c.SendMouse(MouseEvent{Op: "move"}) == nil || c.mouse != nil {
		t.Fatal("evento inválido abriu uinput")
	}
}

func TestMouseUinputHardwareSmoke(t *testing.T) {
	if os.Getenv("DECKPILOT_TEST_UINPUT") != "1" {
		t.Skip("opt-in: apenas cria o mouse virtual, SEM mover/clicar")
	}
	c := &linuxController{fd: -1}
	if err := c.openMouse(); err != nil {
		t.Fatal(err)
	}
	if err := c.Close(); err != nil {
		t.Fatal(err)
	}
	if err := c.Close(); err != nil {
		t.Fatal(err)
	}
}
