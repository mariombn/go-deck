//go:build windows

package input

import (
	"testing"
	"unsafe"
)

// Não chama SendInput: confere só o ABI esperado pelo Win32.
func TestMouseInputLayout(t *testing.T) {
	var raw rawMouseInput
	wantSize, wantOffset := uintptr(28), uintptr(4)
	if unsafe.Sizeof(uintptr(0)) == 8 {
		wantSize, wantOffset = 40, 8
	}
	if unsafe.Sizeof(raw) != wantSize || unsafe.Offsetof(raw.mouse) != wantOffset {
		t.Fatalf("INPUT_MOUSE: tamanho=%d offset=%d", unsafe.Sizeof(raw), unsafe.Offsetof(raw.mouse))
	}
}
