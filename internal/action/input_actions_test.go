package action

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"go-deck/internal/input"
)

type recordedInput struct {
	keys  [][]string
	holds []int
	fail  int
	mouse []input.MouseEvent
}

func (r *recordedInput) SendKeys(keys []string, hold int) error {
	r.keys = append(r.keys, append([]string{}, keys...))
	r.holds = append(r.holds, hold)
	if r.fail > 0 && len(r.keys) == r.fail {
		return errors.New("falha de teste")
	}
	return nil
}
func (r *recordedInput) SendMouse(e input.MouseEvent) error { r.mouse = append(r.mouse, e); return nil }

func TestKeySequenceOrderedAndAborts(t *testing.T) {
	spec := Spec{Type: "keypress", KeySequence: [][]string{{"ctrl", "c"}, {"tab"}, {"ctrl", "v"}}, HoldMs: 10}
	a, err := spec.Build()
	if err != nil {
		t.Fatal(err)
	}
	r := &recordedInput{}
	if err := a.Execute(ExecContext{Input: r}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(r.keys, spec.KeySequence) || !reflect.DeepEqual(r.holds, []int{10, 10, 10}) {
		t.Fatalf("ordem alterada: %+v", r)
	}
	r = &recordedInput{fail: 2}
	if err := a.Execute(ExecContext{Input: r}); err == nil || len(r.keys) != 2 {
		t.Fatal("sequência continuou após falha")
	}
}

func TestKeySequenceValidatesEntireVocabularyBeforeExecution(t *testing.T) {
	a, err := (Spec{Type: "keypress", KeySequence: [][]string{{"a"}, {"invalid-key"}}}).Build()
	if err != nil {
		t.Fatal(err)
	}
	r := &recordedInput{}
	if err := a.Execute(ExecContext{Input: r}); err == nil || len(r.keys) != 0 {
		t.Fatal("injetou tecla antes de validar toda a sequência")
	}
}

func TestKeySequenceRejectsAmbiguityEmptyAndTooMany(t *testing.T) {
	for _, spec := range []Spec{
		{Type: "keypress", Keys: []string{"a"}, KeySequence: [][]string{{"b"}}},
		{Type: "keypress", KeySequence: [][]string{{}}},
		{Type: "keypress", KeySequence: make([][]string, 65)},
	} {
		if _, err := spec.Build(); err == nil {
			t.Fatalf("spec inválida aceita: %+v", spec)
		}
	}
}

func TestMouseActionDispatchAndSequence(t *testing.T) {
	mouse := Spec{Type: "mouse", MouseOp: "click", MouseButton: "right", HoldMs: 50}
	spec := Spec{Type: "sequence", Steps: []Spec{{Type: "keypress", Keys: []string{"esc"}}, mouse}}
	a, err := spec.Build()
	if err != nil {
		t.Fatal(err)
	}
	r := &recordedInput{}
	if err := a.Execute(ExecContext{Input: r, Mouse: r}); err != nil {
		t.Fatal(err)
	}
	if len(r.mouse) != 1 || r.mouse[0].Button != "right" || r.mouse[0].HoldMs != 50 {
		t.Fatal(r.mouse)
	}
	a, _ = mouse.Build()
	if err := a.Execute(ExecContext{}); err == nil {
		t.Fatal("mouse ausente não gerou erro")
	}
}

func TestNewInputSpecsJSONRoundTrip(t *testing.T) {
	for _, spec := range []Spec{
		{Type: "keypress", KeySequence: [][]string{{"ctrl", "c"}, {"ctrl", "v"}}},
		{Type: "mouse", MouseOp: "scroll", MouseX: -2, MouseY: 5},
	} {
		data, err := json.Marshal(spec)
		if err != nil {
			t.Fatal(err)
		}
		var saved Spec
		if err := json.Unmarshal(data, &saved); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(saved, spec) {
			t.Fatalf("%s", data)
		}
		if _, err := saved.Build(); err != nil {
			t.Fatal(err)
		}
	}
}
