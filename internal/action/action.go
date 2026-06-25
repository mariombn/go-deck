// Package action define o modelo polimórfico de ações executáveis por um
// botão do deck. O design (interface Action + factory a partir de uma Spec
// serializável) permite adicionar tipos novos sem refatorar o resto. Hoje
// existem: keypress (combo de teclas), launch (abrir programa), url (abrir
// link) e sequence (lista de ações executadas em ordem).
package action

import (
	"go-deck/internal/i18n"
	"go-deck/internal/input"
	"go-deck/internal/launch"
	"go-deck/internal/obs"
)

// maxSequenceDepth limita o aninhamento de sequence dentro de sequence. Como
// a Spec vem de um config.json estático, basta um teto simples para evitar
// recursão patológica (ou ciclos montados à mão no arquivo).
const maxSequenceDepth = 10

// maxHoldMs é o teto da duração de um keypress "apertar e manter" (5s). Evita
// que um config editado à mão deixe uma tecla pressionada por tempo absurdo,
// travando o input do PC. 0 = toque rápido (comportamento padrão).
const maxHoldMs = 5000

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
	Type string   `json:"type"`
	Keys []string `json:"keys,omitempty"`
	// HoldMs (keypress): se > 0, "apertar e manter" o combo por esses
	// milissegundos antes de soltar. 0/ausente = toque rápido.
	HoldMs int      `json:"holdMs,omitempty"`
	Path   string   `json:"path,omitempty"`
	Args   []string `json:"args,omitempty"`
	URL    string   `json:"url,omitempty"`
	Steps  []Spec   `json:"steps,omitempty"`
	// OBS
	ObsOp  string `json:"obsOp,omitempty"`
	Target string `json:"target,omitempty"`
	// Discord (executado como keypress; o op é só rótulo/UI)
	DiscordOp string `json:"discordOp,omitempty"`
	// navigate (tratado no cliente: troca a página exibida no celular)
	TargetPage string `json:"targetPage,omitempty"`
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
			return nil, i18n.New("errors.action.keypressNoKeys", nil)
		}
		if s.HoldMs < 0 || s.HoldMs > maxHoldMs {
			return nil, i18n.New("errors.action.holdInvalid", map[string]any{"ms": s.HoldMs, "max": maxHoldMs})
		}
		return KeypressAction{Keys: s.Keys, HoldMs: s.HoldMs}, nil

	case "launch":
		if s.Path == "" {
			return nil, i18n.New("errors.action.launchNoPath", nil)
		}
		return LaunchAction{Path: s.Path, Args: s.Args}, nil

	case "url":
		if s.URL == "" {
			return nil, i18n.New("errors.action.urlEmpty", nil)
		}
		return URLAction{URL: s.URL}, nil

	case "sequence":
		if depth >= maxSequenceDepth {
			return nil, i18n.New("errors.action.sequenceTooDeep", map[string]any{"max": maxSequenceDepth})
		}
		if len(s.Steps) == 0 {
			return nil, i18n.New("errors.action.sequenceNoSteps", nil)
		}
		steps := make([]Action, 0, len(s.Steps))
		for i, step := range s.Steps {
			a, err := step.build(depth + 1)
			if err != nil {
				return nil, i18n.Wrap("errors.action.step", map[string]any{"n": i + 1}, err)
			}
			steps = append(steps, a)
		}
		return SequenceAction{Steps: steps}, nil

	case "obs":
		switch s.ObsOp {
		case ObsOpScene, ObsOpToggleMute, ObsOpHotkey:
			if s.Target == "" {
				return nil, i18n.New("errors.action.obsNoTarget", map[string]any{"op": s.ObsOp})
			}
		case ObsOpToggleRecord, ObsOpToggleStream:
			// não precisam de alvo
		case "":
			return nil, i18n.New("errors.action.obsNoOp", nil)
		default:
			return nil, i18n.New("errors.action.obsUnknownOp", map[string]any{"op": s.ObsOp})
		}
		return OBSAction{Op: s.ObsOp, Target: s.Target}, nil

	case "discord":
		// Por baixo é um keypress: dispara o keybind global configurado no
		// Discord. O discordOp é só rótulo/UI; o que executa são as teclas.
		if len(s.Keys) == 0 {
			return nil, i18n.New("errors.action.discordNoKeys", nil)
		}
		return KeypressAction{Keys: s.Keys}, nil

	case "navigate":
		// Navegação é tratada no cliente (o celular troca a página exibida e
		// não envia press). Esta Action existe só para o config round-tripar
		// e para reportar erro caso seja acionada via WS por engano.
		if s.TargetPage == "" {
			return nil, i18n.New("errors.action.navigateNoTarget", nil)
		}
		return NavigateAction{TargetPage: s.TargetPage}, nil

	default:
		return nil, i18n.New("errors.action.unknownType", map[string]any{"type": s.Type})
	}
}

// KeypressAction dispara um combo de teclas. HoldMs == 0 é um toque; > 0
// mantém o combo pressionado por essa duração (em milissegundos) antes de
// soltar.
type KeypressAction struct {
	Keys   []string
	HoldMs int
}

func (k KeypressAction) Execute(ctx ExecContext) error {
	return ctx.Input.SendKeys(k.Keys, k.HoldMs)
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
			return i18n.Wrap("errors.action.step", map[string]any{"n": i + 1}, err)
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

// NavigateAction troca a página exibida no celular. É resolvida no cliente;
// se chegar ao servidor (acionada via WS), Execute reporta erro.
type NavigateAction struct {
	TargetPage string
}

func (n NavigateAction) Execute(ExecContext) error {
	return i18n.New("errors.action.navigateViaWS", nil)
}

func (o OBSAction) Execute(ctx ExecContext) error {
	if ctx.OBS == nil {
		return i18n.New("errors.action.obsUnavailable", nil)
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
		return i18n.New("errors.action.obsUnknownOp", map[string]any{"op": o.Op})
	}
}
