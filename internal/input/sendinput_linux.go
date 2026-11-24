//go:build linux

package input

import (
	"encoding/binary"
	"fmt"
	"strings"
	"sync"
	"time"
	"unsafe"

	"go-deck/internal/i18n"
	"golang.org/x/sys/unix"
)

// linuxController emula um teclado pelo kernel: funciona em X11 e Wayland,
// sem executar comandos externos nem exigir acesso aos teclados físicos.
type linuxController struct {
	mu    sync.Mutex
	fd    int
	mouse *linuxMouse
}

func newController() InputController { return &linuxController{fd: -1} }

// Códigos evdev (linux/input-event-codes.h), independentes do layout ativo.
var linuxKeys = map[string]uint16{
	"minus": 12, "equal": 13, "leftbracket": 26, "rightbracket": 27, "backslash": 43,
	"semicolon": 39, "apostrophe": 40, "comma": 51, "period": 52, "slash": 53, "grave": 41, "capslock": 58,
	"esc": 1, "1": 2, "2": 3, "3": 4, "4": 5, "5": 6, "6": 7, "7": 8, "8": 9, "9": 10, "0": 11,
	"backspace": 14, "tab": 15, "q": 16, "w": 17, "e": 18, "r": 19, "t": 20, "y": 21, "u": 22, "i": 23, "o": 24, "p": 25,
	"enter": 28, "ctrl": 29, "lctrl": 29, "a": 30, "s": 31, "d": 32, "f": 33, "g": 34, "h": 35, "j": 36, "k": 37, "l": 38,
	"shift": 42, "z": 44, "x": 45, "c": 46, "v": 47, "b": 48, "n": 49, "m": 50, "alt": 56, "lalt": 56, "space": 57,
	"f1": 59, "f2": 60, "f3": 61, "f4": 62, "f5": 63, "f6": 64, "f7": 65, "f8": 66, "f9": 67, "f10": 68, "f11": 87, "f12": 88,
	"rctrl": 97, "ralt": 100, "home": 102, "up": 103, "pageup": 104, "left": 105, "right": 106, "end": 107, "down": 108,
	"pagedown": 109, "insert": 110, "delete": 111, "mute": 113, "voldown": 114, "volup": 115, "win": 125,
	"nexttrack": 163, "playpause": 164, "prevtrack": 165,
}

func (c *linuxController) open() error {
	if c.fd >= 0 {
		return nil
	}
	fd, err := unix.Open("/dev/uinput", unix.O_WRONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return fmt.Errorf("acesso a /dev/uinput: %w; instale a regra udev de build/linux/ e entre novamente na sessão", err)
	}
	ok := false
	defer func() {
		if !ok {
			unix.Close(fd)
		}
	}()
	// UI_SET_EVBIT e UI_SET_KEYBIT recebem o valor, não um ponteiro.
	if err = unix.IoctlSetInt(fd, 0x40045564, unix.EV_KEY); err != nil {
		return err
	}
	for _, code := range linuxKeys {
		if err = unix.IoctlSetInt(fd, 0x40045565, int(code)); err != nil {
			return err
		}
	}
	// uinput_user_dev (ABI estável, também em 32 bits).
	dev := make([]byte, 1116)
	copy(dev, "DeckPilot virtual keyboard")
	binary.NativeEndian.PutUint16(dev[80:], unix.BUS_USB)
	binary.NativeEndian.PutUint16(dev[82:], 0x1209)
	binary.NativeEndian.PutUint16(dev[84:], 0xdec0)
	binary.NativeEndian.PutUint16(dev[86:], 1)
	if _, err = unix.Write(fd, dev); err != nil {
		return err
	}
	if err = unix.IoctlSetInt(fd, 0x5501, 0); err != nil {
		return err
	} // UI_DEV_CREATE
	c.fd = fd
	ok = true
	// Dá ao compositor tempo para enumerar o teclado na primeira utilização.
	time.Sleep(250 * time.Millisecond)
	return nil
}

// inputEvent acompanha o tamanho nativo de timeval (16 bytes em amd64,
// 8 em 386), como exigido pelo ABI de /dev/uinput.
type inputEvent struct {
	Time  unix.Timeval
	Type  uint16
	Code  uint16
	Value int32
}

func (c *linuxController) event(code uint16, value int32) error {
	return writeEvdev(c.fd, inputEvent{Type: unix.EV_KEY, Code: code, Value: value})
}

func writeEvdev(fd int, events ...inputEvent) error {
	events = append(events, inputEvent{Type: unix.EV_SYN, Code: 0}) // SYN_REPORT
	for _, ev := range events {
		buf := unsafe.Slice((*byte)(unsafe.Pointer(&ev)), int(unsafe.Sizeof(ev)))
		n, err := unix.Write(fd, buf)
		if err != nil {
			return err
		}
		if n != len(buf) {
			return fmt.Errorf("escrita incompleta em /dev/uinput")
		}
	}
	return nil
}

func (c *linuxController) SendKeys(keys []string, holdMs int) (result error) {
	if len(keys) == 0 {
		return i18n.New("errors.input.comboEmpty", nil)
	}
	// Valida o combo inteiro antes de criar o dispositivo ou enviar eventos.
	codes := make([]uint16, 0, len(keys))
	for _, modifier := range []bool{true, false} {
		for _, name := range keys {
			code, ok := linuxKeys[strings.ToLower(strings.TrimSpace(name))]
			if !ok {
				return i18n.New("errors.input.unknownKey", map[string]any{"key": name})
			}
			if isModifier(name) == modifier {
				codes = append(codes, code)
			}
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.open(); err != nil {
		return err
	}
	pressed := make([]uint16, 0, len(codes))
	// Mesmo em falha parcial, tenta soltar todas as teclas já pressionadas.
	defer func() {
		for i := len(pressed) - 1; i >= 0; i-- {
			if err := c.event(pressed[i], 0); result == nil {
				result = err
			}
		}
	}()
	for _, code := range codes {
		pressed = append(pressed, code)
		if err := c.event(code, 1); err != nil {
			return err
		}
		if holdMs <= 0 && !linuxModifier(code) {
			if err := c.event(code, 0); err != nil {
				return err
			}
			pressed = pressed[:len(pressed)-1]
		}
	}
	if holdMs > 0 {
		time.Sleep(time.Duration(holdMs) * time.Millisecond)
	}
	return nil
}

func linuxModifier(code uint16) bool {
	return code == 29 || code == 42 || code == 56 || code == 97 || code == 100 || code == 125
}

// Close destrói o teclado virtual no encerramento do aplicativo.
func (c *linuxController) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	var err error
	if c.fd >= 0 {
		unix.IoctlSetInt(c.fd, 0x5502, 0) // UI_DEV_DESTROY
		err = unix.Close(c.fd)
		c.fd = -1
	}
	if c.mouse != nil {
		unix.IoctlSetInt(c.mouse.fd, 0x5502, 0)
		if closeErr := unix.Close(c.mouse.fd); err == nil {
			err = closeErr
		}
		c.mouse = nil
	}
	return err
}
