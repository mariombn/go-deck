//go:build linux

package vision2

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

const supported = true

type candidate struct{ path, identity string }

func findDevices() ([]candidate, error) {
	entries, err := os.ReadDir("/sys/class/hidraw")
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var found []candidate
	for _, entry := range entries {
		identity, err := filepath.EvalSymlinks(filepath.Join("/sys/class/hidraw", entry.Name(), "device"))
		if err != nil {
			continue
		}
		data, err := os.ReadFile(filepath.Join(identity, "uevent"))
		if err != nil || !strings.Contains("\n"+string(data), "\nHID_ID=0003:00000A00:00001002\n") {
			continue
		}
		iface, err := os.ReadFile(filepath.Join(filepath.Dir(identity), "bInterfaceNumber"))
		if err != nil || strings.TrimSpace(string(iface)) != "00" {
			continue
		}
		found = append(found, candidate{path: filepath.Join("/dev", entry.Name()), identity: identity})
	}
	return found, nil
}

type hidTransport struct{ fd int }

func openDevice(c candidate) (*device, error) {
	fd, err := unix.Open(c.path, unix.O_RDWR|unix.O_NONBLOCK|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, fmt.Errorf("abrindo %s: %w (ver build/linux/70-deckpilot.rules)", c.path, err)
	}
	// Evita duas instâncias do DeckPilot. Outros programas precisam cooperar
	// com flock; o OpenDeck deve permanecer fechado.
	if err := unix.Flock(fd, unix.LOCK_EX|unix.LOCK_NB); err != nil {
		unix.Close(fd)
		return nil, fmt.Errorf("Vision 2 já está em uso: %w", err)
	}
	d := &device{transport: &hidTransport{fd: fd}}
	if err := d.initialise(); err != nil {
		d.Close()
		return nil, err
	}
	return d, nil
}

func (t *hidTransport) Read(b []byte) (int, error) { return unix.Read(t.fd, b) }
func (t *hidTransport) Write(b []byte) (int, error) {
	// Uma imagem pode ocupar vários reports; aguarda espaço sem girar a CPU.
	for {
		n, err := unix.Write(t.fd, b)
		if errors.Is(err, unix.EINTR) {
			continue
		}
		if !errors.Is(err, unix.EAGAIN) {
			return n, err
		}
		fds := []unix.PollFd{{Fd: int32(t.fd), Events: unix.POLLOUT}}
		if n, err := unix.Poll(fds, 250); err != nil {
			return 0, err
		} else if n == 0 {
			return 0, fmt.Errorf("timeout na escrita USB")
		}
	}
}
func (t *hidTransport) Close() error { return unix.Close(t.fd) }
func wouldBlock(err error) bool      { return errors.Is(err, unix.EAGAIN) || errors.Is(err, unix.EINTR) }
