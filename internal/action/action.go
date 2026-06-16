// Package action define o modelo polimórfico de ações executáveis por um
// botão do deck. O design (interface Action + factory a partir de uma Spec
// serializável) permite adicionar tipos novos sem refatorar o resto. Hoje
// existem: keypress (combo de teclas), launch (abrir programa), url (abrir
// link) e sequence (lista de ações executadas em ordem).
package action

import (
	"fmt"

	"go-deck/internal/input"
	"go-deck/internal/launch"
	"go-deck/internal/obs"
)

// maxSequenceDepth limita o aninhamento de sequence dentro de sequence. Como
// a Spec vem de um config.json estático, basta um teto simples para evitar
// recursão patológica (ou ciclos montados à mão no arquivo).
const maxSequenceDepth = 10

// Operações do OBS (campo obsOp). scene/toggle_mute/hotkey exigem um target;
// os toggles de gravação/transmissão não.
const (
	ObsOpScene        = "scene"
	ObsOpToggleRecord = "toggle_record"
	ObsOpToggleStream = "toggle_stream"
	ObsOpToggleMute   = "toggle_mute"
	ObsOpHotkey       = "hotkey"
)

// ExecContext reúne as capacidades de SO que uma ação pode precisar ao
// executar. É repassado inalterado às sub-ações de um sequence. Crescer o
// vocabulário de ações = adicionar um campo aqui, sem mexer na assinatura de
// Execute.
type ExecContext struct {
	Input    input.InputController
	Launcher launch.Launcher
	OBS      obs.Controller
}

// Action é qualquer ação que um botão pode executar.
type Action interface {
	Execute(ctx ExecContext) error
}

// Spec é a forma serializável (JSON) de uma ação, como aparece no
// config.json. É traduzida para uma Action concreta por Build(). Os campos
// são um superconjunto chato: cada tipo usa só os seus (os demais ficam
// ausentes via omitempty).
//
//	{ "type": "keypress", "keys": ["ctrl","shift","m"] }
//	{ "type": "launch", "path": "C:\\Windows\\notepad.exe", "args": ["x.txt"] }
//	{ "type": "url", "url": "https://example.com" }
//	{ "type": "sequence", "steps": [ {...}, {...} ] }
//	{ "type": "obs", "obsOp": "scene", "target": "Cena 1" }
//	{ "type": "discord", "discordOp": "mute", "keys": ["ctrl","shift","m"] }
type Spec struct {
	Type  string   `json:"type"`
	Keys  []string `json:"keys,omitempty"`
	Path  string   `json:"path,omitempty"`
	Args  []string `json:"args,omitempty"`
	URL   string   `json:"url,omitempty"`
	Steps []Spec   `json:"steps,omitempty"`
	// OBS
	ObsOp  string `json:"obsOp,omitempty"`
	Target string `json:"target,omitempty"`
	// Discord (executado como keypress; o op é só rótulo/UI)
	DiscordOp string `json:"discordOp,omitempty"`
}

// Build converte a Spec na Action concreta correspondente, validando os
// campos do tipo. Erros de validação aqui viram a mensagem do ack ao celular.
func (s Spec) Build() (Action, error) {
	return s.build(0)
}

func (s Spec) build(depth int) (Action, error) {
	switch s.Type {
	case "keypress":
		if len(s.Keys) == 0 {
			return nil, fmt.Errorf("keypress sem teclas")
		}
		return KeypressAction{Keys: s.Keys}, nil

	case "launch":
		if s.Path == "" {
			return nil, fmt.Errorf("launch sem caminho do programa")
		}
		return LaunchAction{Path: s.Path, Args: s.Args}, nil

	case "url":
		if s.URL == "" {
			return nil, fmt.Errorf("url vazia")
		}
		return URLAction{URL: s.URL}, nil

	case "sequence":
		if depth >= maxSequenceDepth {
			return nil, fmt.Errorf("sequence aninhado demais (máximo %d níveis)", maxSequenceDepth)
		}
		if len(s.Steps) == 0 {
			return nil, fmt.Errorf("sequence sem passos")
		}
		steps := make([]Action, 0, len(s.Steps))
		for i, step := range s.Steps {
			a, err := step.build(depth + 1)
			if err != nil {
				return nil, fmt.Errorf("passo %d: %w", i+1, err)
			}
			steps = append(steps, a)
		}
		return SequenceAction{Steps: steps}, nil

	case "obs":
		switch s.ObsOp {
		case ObsOpScene, ObsOpToggleMute, ObsOpHotkey:
			if s.Target == "" {
				return nil, fmt.Errorf("OBS %q sem alvo (cena/fonte/hotkey)", s.ObsOp)
			}
		case ObsOpToggleRecord, ObsOpToggleStream:
			// não precisam de alvo
		case "":
			return nil, fmt.Errorf("OBS sem operação")
		default:
			return nil, fmt.Errorf("operação OBS desconhecida: %q", s.ObsOp)
		}
		return OBSAction{Op: s.ObsOp, Target: s.Target}, nil

	case "discord":
		// Por baixo é um keypress: dispara o keybind global configurado no
		// Discord. O discordOp é só rótulo/UI; o que executa são as teclas.
		if len(s.Keys) == 0 {
			return nil, fmt.Errorf("discord sem teclas (configure o keybind global no Discord e capture-o)")
		}
		return KeypressAction{Keys: s.Keys}, nil

	default:
		return nil, fmt.Errorf("tipo de ação desconhecido: %q", s.Type)
	}
}

// KeypressAction dispara um combo simultâneo de teclas.
type KeypressAction struct {
	Keys []string
}

func (k KeypressAction) Execute(ctx ExecContext) error {
	return ctx.Input.SendKeys(k.Keys)
}

// LaunchAction abre um programa (fire-and-forget), sem shell.
type LaunchAction struct {
	Path string
	Args []string
}

func (l LaunchAction) Execute(ctx ExecContext) error {
	return ctx.Launcher.Launch(l.Path, l.Args)
}

// URLAction abre uma URL no aplicativo padrão do SO.
type URLAction struct {
	URL string
}

func (u URLAction) Execute(ctx ExecContext) error {
	return ctx.Launcher.OpenURL(u.URL)
}

// SequenceAction executa uma lista de ações em ordem, abortando no primeiro
// erro (para não deixar uma macro pela metade num estado inesperado).
type SequenceAction struct {
	Steps []Action
}

func (seq SequenceAction) Execute(ctx ExecContext) error {
	for i, a := range seq.Steps {
		if err := a.Execute(ctx); err != nil {
			return fmt.Errorf("passo %d: %w", i+1, err)
		}
	}
	return nil
}

// OBSAction controla o OBS Studio via obs-websocket (ctx.OBS). Op define a
// operação; Target o alvo (cena/fonte/hotkey) quando aplicável.
type OBSAction struct {
	Op     string
	Target string
}

func (o OBSAction) Execute(ctx ExecContext) error {
	if ctx.OBS == nil {
		return fmt.Errorf("OBS não disponível")
	}
	switch o.Op {
	case ObsOpScene:
		return ctx.OBS.SetScene(o.Target)
	case ObsOpToggleRecord:
		return ctx.OBS.ToggleRecord()
	case ObsOpToggleStream:
		return ctx.OBS.ToggleStream()
	case ObsOpToggleMute:
		return ctx.OBS.ToggleMute(o.Target)
	case ObsOpHotkey:
		return ctx.OBS.TriggerHotkey(o.Target)
	default:
		return fmt.Errorf("operação OBS desconhecida: %q", o.Op)
	}
}
