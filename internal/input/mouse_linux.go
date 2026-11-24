//go:build linux

package input

import (
	"encoding/binary"
	"fmt"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

func platformKeyExists(name string) bool {
	_, ok := linuxKeys[strings.ToLower(strings.TrimSpace(name))]
	return ok
}

type linuxMouse struct{ fd int }

var linuxMouseButtons = map[string]uint16{"left": 0x110, "right": 0x111, "middle": 0x112, "back": 0x113, "forward": 0x114}

func (c *linuxController) openMouse() error {
	if c.mouse != nil {
		return nil
	}
	fd, err := unix.Open("/dev/uinput", unix.O_WRONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return fmt.Errorf("acesso a /dev/uinput para mouse: %w; ver build/linux/70-deckpilot.rules", err)
	}
	ok := false
	defer func() {
		if !ok {
			unix.Close(fd)
		}
	}()
	for _, kind := range []int{unix.EV_KEY, unix.EV_REL} {
		if err := unix.IoctlSetInt(fd, 0x40045564, kind); err != nil {
			return err
		}
	}
	for _, button := range linuxMouseButtons {
		if err := unix.IoctlSetInt(fd, 0x40045565, int(button)); err != nil {
			return err
		}
	}
	for _, axis := range []int{0, 1, 6, 8} { // REL_X, REL_Y, REL_HWHEEL, REL_WHEEL
		if err := unix.IoctlSetInt(fd, 0x40045566, axis); err != nil {
			return err
		}
	}
	dev := make([]byte, 1116)
	copy(dev, "DeckPilot virtual mouse")
	binary.NativeEndian.PutUint16(dev[80:], unix.BUS_USB)
	binary.NativeEndian.PutUint16(dev[82:], 0x1209)
	binary.NativeEndian.PutUint16(dev[84:], 0xdec1)
	binary.NativeEndian.PutUint16(dev[86:], 1)
	if _, err := unix.Write(fd, dev); err != nil {
		return err
	}
	if err := unix.IoctlSetInt(fd, 0x5501, 0); err != nil {
		return err
	}
	c.mouse = &linuxMouse{fd: fd}
	ok = true
	time.Sleep(250 * time.Millisecond)
	return nil
}

func (c *linuxController) SendMouse(e MouseEvent) error {
	if err := ValidateMouse(e); err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.openMouse(); err != nil {
		return err
	}
	return sendLinuxMouse(c.mouse.fd, e)
}

func sendLinuxMouse(fd int, e MouseEvent) error {
	switch e.Op {
	case "move":
		return writeEvdev(fd, inputEvent{Type: unix.EV_REL, Code: 0, Value: int32(e.X)}, inputEvent{Type: unix.EV_REL, Code: 1, Value: int32(e.Y)})
	case "scroll":
		return writeEvdev(fd, inputEvent{Type: unix.EV_REL, Code: 6, Value: int32(e.X)}, inputEvent{Type: unix.EV_REL, Code: 8, Value: int32(e.Y)})
	default:
		click := func() (result error) {
			code := linuxMouseButtons[e.Button]
			// Tenta soltar o botão mesmo que a escrita DOWN falhe parcialmente.
			defer func() {
				if err := writeEvdev(fd, inputEvent{Type: unix.EV_KEY, Code: code}); result == nil {
					result = err
				}
			}()
			if err := writeEvdev(fd, inputEvent{Type: unix.EV_KEY, Code: code, Value: 1}); err != nil {
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
