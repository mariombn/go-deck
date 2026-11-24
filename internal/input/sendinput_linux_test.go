//go:build linux

package input

import (
	"encoding/binary"
	"os"
	"testing"
	"unsafe"

	"golang.org/x/sys/unix"
)

// Usa um pipe no lugar de /dev/uinput: os testes normais nunca digitam no SO.
func recordedKeys(t *testing.T, keys []string, hold int) [][2]int {
	t.Helper()
	fds := []int{0, 0}
	if err := unix.Pipe(fds); err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fds[0])
	defer unix.Close(fds[1])
	c := &linuxController{fd: fds[1]}
	if err := c.SendKeys(keys, hold); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 4096)
	n, err := unix.Read(fds[0], buf)
	if err != nil {
		t.Fatal(err)
	}
	size := int(unsafe.Sizeof(inputEvent{}))
	offset := int(unsafe.Sizeof(unix.Timeval{}))
	if n%size != 0 {
		t.Fatal("eventos desalinhados")
	}
	var events [][2]int
	for i := 0; i < n; i += size {
		kind := binary.NativeEndian.Uint16(buf[i+offset:])
		if kind == unix.EV_SYN {
			continue
		}
		if kind != unix.EV_KEY {
			t.Fatal(kind)
		}
		events = append(events, [2]int{int(binary.NativeEndian.Uint16(buf[i+offset+2:])), int(binary.NativeEndian.Uint32(buf[i+offset+4:]))})
	}
	return events
}

func TestLinuxSendKeysTapAndHold(t *testing.T) {
	for _, tc := range []struct {
		hold int
		want [][2]int
	}{
		{0, [][2]int{{29, 1}, {30, 1}, {30, 0}, {48, 1}, {48, 0}, {29, 0}}},
		{1, [][2]int{{29, 1}, {30, 1}, {48, 1}, {48, 0}, {30, 0}, {29, 0}}},
	} {
		got := recordedKeys(t, []string{"a", " CTRL ", "b"}, tc.hold)
		if len(got) != len(tc.want) {
			t.Fatal(got)
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Fatalf("hold %d: %v != %v", tc.hold, got, tc.want)
			}
		}
	}
}

func TestLinuxValidatesBeforeOpening(t *testing.T) {
	c := &linuxController{fd: -1}
	for _, keys := range [][]string{nil, {"ctrl", "não-existe"}, {"cmd"}, {"opt"}} {
		if c.SendKeys(keys, 0) == nil {
			t.Fatalf("combo inválido aceito: %v", keys)
		}
		if c.fd != -1 {
			t.Fatal("abriu uinput antes de validar")
		}
	}
}

func TestLinuxKeyVocabulary(t *testing.T) {
	for name := range keymap {
		if _, ok := linuxKeys[name]; !ok {
			t.Errorf("tecla sem suporte Linux: %s", name)
		}
	}
	if linuxKeys["lctrl"] == linuxKeys["rctrl"] || linuxKeys["lalt"] == linuxKeys["ralt"] {
		t.Fatal("perdeu lado dos modificadores")
	}
	for _, name := range []string{"mute", "playpause", "prevtrack", "nexttrack"} {
		if linuxKeys[name] == 0 {
			t.Fatal(name)
		}
	}
}

func TestUinputHardwareSmoke(t *testing.T) {
	if os.Getenv("DECKPILOT_TEST_UINPUT") != "1" {
		t.Skip("defina DECKPILOT_TEST_UINPUT=1 para criar um teclado virtual sem enviar teclas")
	}
	c := &linuxController{fd: -1}
	if err := c.open(); err != nil {
		t.Fatal(err)
	}
	if err := c.Close(); err != nil {
		t.Fatal(err)
	}
	if err := c.Close(); err != nil {
		t.Fatal(err)
	}
}
