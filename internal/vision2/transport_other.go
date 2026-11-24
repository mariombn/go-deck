//go:build !linux

package vision2

import "fmt"

const supported = false

type candidate struct{ path, identity string }

func findDevices() ([]candidate, error) { return nil, nil }
func openDevice(candidate) (*device, error) {
	return nil, fmt.Errorf("Vision 2 disponível apenas no Linux")
}
func wouldBlock(error) bool { return false }
