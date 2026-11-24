package vision2

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"go-deck/internal/action"
	"go-deck/internal/config"
)

type fakeTransport struct {
	reports [][]byte
	short   bool
	fail    bool
}

func (f *fakeTransport) Read([]byte) (int, error) { return 0, nil }
func (f *fakeTransport) Close() error             { return nil }
func (f *fakeTransport) Write(data []byte) (int, error) {
	if f.fail {
		return 0, fmt.Errorf("USB desconectado")
	}
	f.reports = append(f.reports, bytes.Clone(data))
	if f.short {
		return len(data) - 1, nil
	}
	return len(data), nil
}

func testJPEG() []byte {
	im := image.NewRGBA(image.Rect(0, 0, KeySize, KeySize))
	for y := 0; y < KeySize; y++ {
		for x := 0; x < KeySize; x++ {
			im.Set(x, y, color.RGBA{uint8(x * 2), uint8(y * 2), 100, 255})
		}
	}
	var b bytes.Buffer
	jpeg.Encode(&b, im, &jpeg.Options{Quality: 88})
	return b.Bytes()
}

func TestCommandReport(t *testing.T) {
	r := commandReport("BAT", 0, 0, 0x12, 0x34, 11)
	if len(r) != 1025 || r[0] != 0 || string(r[1:4]) != "CRT" || string(r[6:9]) != "BAT" || !bytes.Equal(r[9:14], []byte{0, 0, 0x12, 0x34, 11}) {
		t.Fatalf("report inválido: %x", r[:16])
	}
}

func TestKeyEvent(t *testing.T) {
	for pos := 0; pos < KeyCount; pos++ {
		for _, state := range []byte{0, 1} {
			r := make([]byte, 11)
			copy(r, "ACK")
			copy(r[5:], "OK")
			r[9] = byte(pos + 1)
			r[10] = state
			p, down, ok := keyEvent(r)
			if !ok || p != pos || down != (state == 1) {
				t.Fatalf("evento %d/%d", pos, state)
			}
		}
	}
	for _, r := range [][]byte{nil, []byte("ACK"), []byte("ACK00OK0000"), []byte("ACK00OK00\x10\x01"), []byte("ACK00OK00\x01\x02")} {
		if _, _, ok := keyEvent(r); ok {
			t.Fatalf("aceitou evento inválido %x", r)
		}
	}
}

func TestInitialise(t *testing.T) {
	f := &fakeTransport{}
	d := device{transport: f}
	if err := d.initialise(); err != nil {
		t.Fatal(err)
	}
	want := [][]byte{commandReport("DIS"), commandReport("CONNECT"), commandReport("CLE", 0, 0, 0, 255), commandReport("STP"), commandReport("LIG", 0, 0, 80)}
	if len(f.reports) != len(want) {
		t.Fatal(len(f.reports))
	}
	for i := range want {
		if !bytes.Equal(f.reports[i], want[i]) {
			t.Fatalf("comando %d", i)
		}
	}
}

func TestSetImageSlotsAndChunks(t *testing.T) {
	data := testJPEG()
	for position, slot := range lcdSlots {
		f := &fakeTransport{}
		d := device{transport: f}
		if err := d.setImage(position, data); err != nil {
			t.Fatal(err)
		}
		if f.reports[0][13] != slot {
			t.Fatalf("posição %d: slot %d", position, f.reports[0][13])
		}
		if int(f.reports[0][11])<<8|int(f.reports[0][12]) != len(data) {
			t.Fatal("comprimento")
		}
		var received []byte
		for _, r := range f.reports[1 : len(f.reports)-1] {
			if len(r) != 1025 || r[0] != 0 {
				t.Fatal("report de imagem inválido")
			}
			received = append(received, r[1:]...)
		}
		if !bytes.Equal(received[:len(data)], data) {
			t.Fatal("JPEG alterado")
		}
		if !bytes.Equal(f.reports[len(f.reports)-1], commandReport("STP")) {
			t.Fatal("faltou STP")
		}
		f.reports = nil
		if err := d.setImage(position, nil); err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(f.reports[0], commandReport("CLE", 0, 0, 0, slot)) {
			t.Fatal("CLE")
		}
	}
}

func TestProtocolRejectsInvalidAndShortWrites(t *testing.T) {
	f := &fakeTransport{}
	d := device{transport: f}
	for _, position := range []int{-1, 15} {
		if d.setImage(position, nil) == nil {
			t.Fatal("posição inválida aceita")
		}
	}
	if d.setImage(0, []byte("não é JPEG")) == nil {
		t.Fatal("imagem inválida aceita")
	}
	f.short = true
	if d.initialise() == nil {
		t.Fatal("escrita incompleta aceita")
	}
	f.short = false
	f.fail = true
	if d.setImage(0, testJPEG()) == nil {
		t.Fatal("erro USB ignorado")
	}
}

func managerConfig() config.DeckConfig {
	return config.DeckConfig{Pages: []config.Page{
		{ID: "home", Grid: config.Grid{Rows: 3, Cols: 5}, Buttons: []config.Button{
			{ID: "navigate", Position: config.Position{Row: 0, Col: 0}, Action: action.Spec{Type: "navigate", TargetPage: "other"}},
			{ID: "key", Position: config.Position{Row: 2, Col: 4}, Action: action.Spec{Type: "keypress", Keys: []string{"mute"}}},
		}},
		{ID: "other", Grid: config.Grid{Rows: 3, Cols: 5}},
	}}
}

func TestManagerNavigationAndQueue(t *testing.T) {
	m := New(nil)
	m.UpdateConfig(managerConfig())
	if m.Info().PageID != "home" {
		t.Fatal("página inicial")
	}
	m.onKey(14)
	if id := <-m.actions; id != "key" {
		t.Fatal(id)
	}
	m.onKey(0)
	if m.Info().PageID != "other" {
		t.Fatal("não navegou")
	}
	select {
	case <-m.actions:
		t.Fatal("navigate não deve executar no servidor")
	default:
	}
	if err := m.SelectPage("missing"); err == nil {
		t.Fatal("página inexistente aceita")
	}
	m.SelectPage("home")
	for i := 0; i < 20; i++ {
		m.onKey(14)
	}
	if m.Info().ActionError == "" {
		t.Fatal("faltou erro de fila cheia")
	}
	cfg := managerConfig()
	cfg.Pages = cfg.Pages[1:]
	m.UpdateConfig(cfg)
	if m.Info().PageID != "other" {
		t.Fatal("página removida não voltou à primeira")
	}
}

func TestManagerImagesRevisionAndValidation(t *testing.T) {
	m := New(nil)
	cfg := managerConfig()
	m.UpdateConfig(cfg)
	data := testJPEG()
	source := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(data)
	revision := m.Info().Revision
	if err := m.SetImages(revision, map[string]string{"key": source}); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(m.desiredImages()[14], data) {
		t.Fatal("mapeamento de imagem")
	}
	if err := m.SetImages(revision, map[string]string{"key": "inválida"}); err == nil {
		t.Fatal("aceitou imagem inválida")
	}
	// Erro de validação não apaga o lote válido anterior.
	if !bytes.Equal(m.desiredImages()[14], data) {
		t.Fatal("lote válido perdido")
	}
	m.UpdateConfig(cfg)
	if err := m.SetImages(revision, map[string]string{"key": source}); err != nil {
		t.Fatal(err)
	}
	if len(m.desiredImages()[14]) != 0 {
		t.Fatal("revisão antiga sobrescreveu save")
	}
	m.SelectPage("other")
	if len(m.desiredImages()[14]) != 0 {
		t.Fatal("imagem vazou entre páginas")
	}
}
