//go:build darwin

package input

/*
#cgo LDFLAGS: -framework ApplicationServices
#include <ApplicationServices/ApplicationServices.h>

static int mouseTrusted() {
    const void *keys[] = { kAXTrustedCheckOptionPrompt };
    const void *values[] = { kCFBooleanTrue };
    CFDictionaryRef opts = CFDictionaryCreate(kCFAllocatorDefault, keys, values, 1,
        &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
    bool trusted = AXIsProcessTrustedWithOptions(opts);
    CFRelease(opts);
    return trusted;
}

static int postMouse(int operation, int button, int x, int y, int down, int clicks) {
    CGEventRef ev;
    if (operation == 2) {
        // CoreGraphics: eixo horizontal positivo vai para a esquerda.
        ev = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitLine, 2, y, -x);
    } else {
        CGEventRef location = CGEventCreate(NULL);
        if (!location) return 0;
        CGPoint point = CGEventGetLocation(location);
        CFRelease(location);
        CGEventType type;
        if (operation == 1) {
            point.x += x; point.y += y;
            type = kCGEventMouseMoved;
        } else if (button == 0) {
            type = down ? kCGEventLeftMouseDown : kCGEventLeftMouseUp;
        } else if (button == 1) {
            type = down ? kCGEventRightMouseDown : kCGEventRightMouseUp;
        } else {
            type = down ? kCGEventOtherMouseDown : kCGEventOtherMouseUp;
        }
        ev = CGEventCreateMouseEvent(NULL, type, point, (CGMouseButton)button);
        if (ev && operation == 0) CGEventSetIntegerValueField(ev, kCGMouseEventClickState, clicks);
    }
    if (!ev) return 0;
    CGEventPost(kCGSessionEventTap, ev);
    CFRelease(ev);
    return 1;
}
*/
import "C"

import (
	"go-deck/internal/i18n"
	"sync"
	"time"
)

func platformKeyExists(name string) bool { _, ok := cgLookup(name); return ok }

var mouseMu sync.Mutex

func (darwinController) SendMouse(e MouseEvent) error {
	if err := ValidateMouse(e); err != nil {
		return err
	}
	mouseMu.Lock()
	defer mouseMu.Unlock()
	if C.mouseTrusted() == 0 {
		return i18n.New("errors.input.accessibilityDenied", nil)
	}
	post := func(op, button, x, y, down, clicks int) error {
		if C.postMouse(C.int(op), C.int(button), C.int(x), C.int(y), C.int(down), C.int(clicks)) == 0 {
			return i18n.New("errors.mouse.sendFailed", nil)
		}
		return nil
	}
	switch e.Op {
	case "move":
		return post(1, 0, e.X, e.Y, 0, 0)
	case "scroll":
		return post(2, 0, e.X, e.Y, 0, 0)
	default:
		button := map[string]int{"left": 0, "right": 1, "middle": 2, "back": 3, "forward": 4}[e.Button]
		click := func(n int) (result error) {
			defer func() {
				if err := post(0, button, 0, 0, 0, n); result == nil {
					result = err
				}
			}()
			if err := post(0, button, 0, 0, 1, n); err != nil {
				return err
			}
			if e.HoldMs > 0 {
				time.Sleep(time.Duration(e.HoldMs) * time.Millisecond)
			}
			return nil
		}
		if err := click(1); err != nil {
			return err
		}
		if e.Op == "double_click" {
			time.Sleep(60 * time.Millisecond)
			return click(2)
		}
		return nil
	}
}
