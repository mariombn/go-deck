package vision2

import (
	"os"
	"testing"
)

func TestVision2HardwareSmoke(t *testing.T) {
	if os.Getenv("DECKPILOT_TEST_VISION2") != "1" {
		t.Skip("defina DECKPILOT_TEST_VISION2=1 com OpenDeck fechado; altera os LCDs")
	}
	if !supported {
		t.Fatal("Vision 2 indisponível neste build")
	}
	found, err := findDevices()
	if err != nil {
		t.Fatal(err)
	}
	if len(found) == 0 {
		t.Fatal("Vision 2 não encontrado")
	}
	d, err := openDevice(found[0])
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	t.Logf("conectado em %s", found[0].path)
	for i := 0; i < KeyCount; i++ {
		if err := d.setImage(i, testJPEG()); err != nil {
			t.Fatalf("LCD %d: %v", i+1, err)
		}
	}
	if err := d.command("CONNECT"); err != nil {
		t.Fatal(err)
	}
}
