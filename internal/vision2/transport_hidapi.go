//go:build cgo && (darwin || windows)

package vision2

import (
	"errors"
	"fmt"

	"github.com/sstallion/go-hid"
)

const supported = true

func isVision2Interface(info *hid.DeviceInfo) bool {
	return info.Path != "" && info.BusType == hid.BusUSB && info.InterfaceNbr == 0
}

func findDevices() ([]candidate, error) {
	if err := hid.Init(); err != nil {
		return nil, fmt.Errorf("inicializando HID: %w", err)
	}
	var found []candidate
	seen := make(map[string]bool)
	err := hid.Enumerate(0x0a00, 0x1002, func(info *hid.DeviceInfo) error {
		if isVision2Interface(info) && !seen[info.Path] {
			found = append(found, candidate{path: info.Path})
			seen[info.Path] = true
		}
		return nil
	})
	return found, err
}

type hidTransport struct{ *hid.Device }

func openDevice(c candidate) (*device, error) {
	handle, err := hid.OpenPath(c.path)
	if err != nil {
		return nil, fmt.Errorf("abrindo Vision 2 em %s: %w", c.path, err)
	}
	d := &device{transport: hidTransport{handle}}
	if err := d.initialise(); err != nil {
		d.Close()
		return nil, fmt.Errorf("inicializando Vision 2 em %s: %w", c.path, err)
	}
	return d, nil
}

func (t hidTransport) Read(report []byte) (int, error) {
	// HIDAPI normaliza o byte de ID quando o dispositivo não numera os
	// reports. Timeout zero mantém o mesmo polling não bloqueante do hidraw.
	return t.ReadWithTimeout(report, 0)
}

func wouldBlock(err error) bool { return errors.Is(err, hid.ErrTimeout) }
