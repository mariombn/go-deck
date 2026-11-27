//go:build !linux && (!cgo || (!darwin && !windows))

package vision2

import "fmt"

const supported = false

func findDevices() ([]candidate, error) { return nil, nil }
func openDevice(candidate) (*device, error) {
	return nil, fmt.Errorf("Vision 2 indisponível neste build")
}
func wouldBlock(error) bool { return false }
