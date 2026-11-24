//go:build !windows && !darwin && !linux

package input

import "go-deck/internal/i18n"

func platformKeyExists(name string) bool           { _, ok := lookup(name); return ok }
func (otherController) SendMouse(MouseEvent) error { return i18n.New("errors.mouse.unavailable", nil) }
