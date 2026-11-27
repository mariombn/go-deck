//go:build cgo && (darwin || windows)

package vision2

import (
	"errors"
	"testing"

	"github.com/sstallion/go-hid"
)

func TestVision2HIDInterface(t *testing.T) {
	for _, tt := range []struct {
		name string
		info hid.DeviceInfo
		want bool
	}{
		{"interface USB 00", hid.DeviceInfo{Path: "device", BusType: hid.BusUSB, InterfaceNbr: 0}, true},
		{"interface USB 01", hid.DeviceInfo{Path: "device", BusType: hid.BusUSB, InterfaceNbr: 1}, false},
		{"interface desconhecida", hid.DeviceInfo{Path: "device", BusType: hid.BusUSB, InterfaceNbr: -1}, false},
		{"Bluetooth", hid.DeviceInfo{Path: "device", BusType: hid.BusBluetooth, InterfaceNbr: 0}, false},
		{"caminho vazio", hid.DeviceInfo{BusType: hid.BusUSB, InterfaceNbr: 0}, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := isVision2Interface(&tt.info); got != tt.want {
				t.Fatalf("interface selecionada = %v, esperado %v", got, tt.want)
			}
		})
	}
}

func TestVision2HIDReadTimeout(t *testing.T) {
	if !wouldBlock(hid.ErrTimeout) {
		t.Fatal("leitura ociosa deve manter a conexão")
	}
	if wouldBlock(errors.New("USB desconectado")) {
		t.Fatal("erro de leitura deve encerrar a conexão")
	}
}
