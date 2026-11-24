// Package vision2 controla o Rise Mode Vision 2 (USB 0a00:1002).
// O protocolo foi observado no plugin local do OpenDeck; não depende dele.
package vision2

import (
	"bytes"
	"fmt"
	"image/jpeg"
)

const (
	Rows       = 3
	Cols       = 5
	KeyCount   = Rows * Cols
	KeySize    = 112
	reportSize = 1024
)

// Os eventos começam no alto à esquerda; os slots LCD começam embaixo.
var lcdSlots = [KeyCount]byte{11, 12, 13, 14, 15, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5}

func commandReport(command string, data ...byte) []byte {
	r := make([]byte, reportSize+1) // byte 0: report ID
	copy(r[1:], "CRT")
	copy(r[6:], command)
	copy(r[6+len(command):], data)
	return r
}

func keyEvent(report []byte) (position int, pressed bool, ok bool) {
	if len(report) < 11 || string(report[:3]) != "ACK" || string(report[5:7]) != "OK" {
		return 0, false, false
	}
	position = int(report[9]) - 1
	if position < 0 || position >= KeyCount || report[10] > 1 {
		return 0, false, false
	}
	return position, report[10] == 1, true
}

type transport interface {
	Read([]byte) (int, error)
	Write([]byte) (int, error)
	Close() error
}

type device struct {
	transport
	pressed [KeyCount]bool
}

func (d *device) write(report []byte) error {
	n, err := d.Write(report)
	if err != nil {
		return err
	}
	if n != len(report) {
		return fmt.Errorf("escrita USB incompleta: %d/%d", n, len(report))
	}
	return nil
}

func (d *device) command(command string, data ...byte) error {
	return d.write(commandReport(command, data...))
}

func (d *device) initialise() error {
	for _, command := range []string{"DIS", "CONNECT"} {
		if err := d.command(command); err != nil {
			return err
		}
	}
	if err := d.command("CLE", 0, 0, 0, 255); err != nil {
		return err
	}
	if err := d.command("STP"); err != nil {
		return err
	}
	return d.command("LIG", 0, 0, 80)
}

func validJPEG(data []byte) bool {
	if len(data) == 0 || len(data) > 65535 {
		return false
	}
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(data))
	return err == nil && cfg.Width == KeySize && cfg.Height == KeySize
}

func (d *device) setImage(position int, image []byte) error {
	if position < 0 || position >= KeyCount {
		return fmt.Errorf("posição LCD inválida")
	}
	if len(image) == 0 {
		if err := d.command("CLE", 0, 0, 0, lcdSlots[position]); err != nil {
			return err
		}
	} else {
		if !validJPEG(image) {
			return fmt.Errorf("LCD requer JPEG 112x112 de até 65535 bytes")
		}
		if err := d.command("BAT", 0, 0, byte(len(image)>>8), byte(len(image)), lcdSlots[position]); err != nil {
			return err
		}
		for offset := 0; offset < len(image); offset += reportSize {
			report := make([]byte, reportSize+1)
			copy(report[1:], image[offset:min(offset+reportSize, len(image))])
			if err := d.write(report); err != nil {
				return err
			}
		}
	}
	return d.command("STP")
}
