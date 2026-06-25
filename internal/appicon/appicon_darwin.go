//go:build darwin

package appicon

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>
#include <stdlib.h>
#include <string.h>

// iconPNG rasteriza o ícone do arquivo em `path` num quadrado size×size e
// devolve os bytes PNG (malloc'd; o chamador libera). *outLen recebe o
// tamanho; retorna NULL em falha.
static unsigned char* iconPNG(const char* path, int size, int* outLen) {
    @autoreleasepool {
        NSString* p = [NSString stringWithUTF8String:path];
        NSImage* icon = [[NSWorkspace sharedWorkspace] iconForFile:p];
        if (icon == nil) return NULL;

        NSBitmapImageRep* rep = [[NSBitmapImageRep alloc]
            initWithBitmapDataPlanes:NULL pixelsWide:size pixelsHigh:size
            bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO
            colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
        if (rep == nil) return NULL;

        NSGraphicsContext* ctx = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
        [NSGraphicsContext saveGraphicsState];
        [NSGraphicsContext setCurrentContext:ctx];
        [icon drawInRect:NSMakeRect(0, 0, size, size)
                fromRect:NSZeroRect
               operation:NSCompositingOperationCopy
                fraction:1.0];
        [NSGraphicsContext restoreGraphicsState];

        NSData* png = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
        if (png == nil) return NULL;
        int len = (int)[png length];
        unsigned char* buf = (unsigned char*)malloc(len);
        if (buf == NULL) return NULL;
        memcpy(buf, [png bytes], len);
        *outLen = len;
        return buf;
    }
}
*/
import "C"

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unsafe"

	"go-deck/internal/i18n"
)

// darwinProvider extrai ícones via Cocoa (NSWorkspace) sob CGO — coerente com
// sendinput_darwin.go. NSWorkspace cobre apps que guardam o ícone em
// Assets.car (sem .icns), o que uma leitura crua do bundle perderia.
type darwinProvider struct{}

func newProvider() Provider { return darwinProvider{} }

func (darwinProvider) Extract(path string) (string, error) {
	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))

	var n C.int
	buf := C.iconPNG(cpath, 128, &n)
	if buf == nil || n <= 0 {
		return "", i18n.New("errors.appicon.iconUnavailable", map[string]any{"path": path})
	}
	defer C.free(unsafe.Pointer(buf))

	data := C.GoBytes(unsafe.Pointer(buf), n)
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data), nil
}

func (p darwinProvider) List() ([]AppEntry, error) {
	dirs := []string{"/Applications", "/Applications/Utilities", "/System/Applications"}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		dirs = append(dirs, filepath.Join(home, "Applications"))
	}

	entries := []AppEntry{}
	seen := map[string]bool{}
	for _, dir := range dirs {
		des, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, de := range des {
			if !strings.HasSuffix(de.Name(), ".app") {
				continue
			}
			name := strings.TrimSuffix(de.Name(), ".app")
			low := strings.ToLower(name)
			if seen[low] {
				continue
			}
			seen[low] = true
			full := filepath.Join(dir, de.Name())
			icon, _ := p.Extract(full) // erro ⇒ ícone vazio, app ainda listado
			entries = append(entries, AppEntry{Name: name, Path: full, Icon: icon})
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return entries, nil
}
