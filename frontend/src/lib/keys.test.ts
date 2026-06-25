import {describe, it, expect} from 'vitest'
import {
  modifierCodeToName,
  eventToCombo,
  keyLabel,
  comboLabel,
  MODIFIERS,
  SPECIAL_KEYS,
} from './keys'

// Cobertura das funções puras do vocabulário de teclas (keys.ts), alinhadas ao
// keymap do backend Go. Foco em normalização de códigos, montagem de combos e
// rótulos de exibição.

describe('modifierCodeToName', () => {
  it('preserva o lado de Ctrl (esquerda x direita)', () => {
    expect(modifierCodeToName('ControlLeft')).toBe('lctrl')
    expect(modifierCodeToName('ControlRight')).toBe('rctrl')
  })

  it('preserva o lado de Alt (esquerda x direita)', () => {
    expect(modifierCodeToName('AltLeft')).toBe('lalt')
    expect(modifierCodeToName('AltRight')).toBe('ralt')
  })

  it('mantém Shift genérico para ambos os lados', () => {
    expect(modifierCodeToName('ShiftLeft')).toBe('shift')
    expect(modifierCodeToName('ShiftRight')).toBe('shift')
  })

  it('mapeia Meta e OS (ambos os lados) para "win"', () => {
    expect(modifierCodeToName('MetaLeft')).toBe('win')
    expect(modifierCodeToName('MetaRight')).toBe('win')
    expect(modifierCodeToName('OSLeft')).toBe('win')
    expect(modifierCodeToName('OSRight')).toBe('win')
  })

  it('devolve null para código não-modificador', () => {
    expect(modifierCodeToName('KeyA')).toBeNull()
    expect(modifierCodeToName('Digit1')).toBeNull()
    expect(modifierCodeToName('')).toBeNull()
  })
})

// Helper: cria um KeyboardEvent-like mínimo para eventToCombo (que só lê
// .code e os booleanos de modificador).
function ev(
  code: string,
  flags: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>> = {},
): KeyboardEvent {
  return {
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...flags,
  } as KeyboardEvent
}

describe('eventToCombo', () => {
  it('traduz letras (KeyA -> "a")', () => {
    expect(eventToCombo(ev('KeyA'), new Set())).toEqual(['a'])
  })

  it('traduz dígitos e numpad', () => {
    expect(eventToCombo(ev('Digit5'), new Set())).toEqual(['5'])
    expect(eventToCombo(ev('Numpad9'), new Set())).toEqual(['9'])
  })

  it('traduz teclas de função (F1..F12) em minúsculas', () => {
    expect(eventToCombo(ev('F1'), new Set())).toEqual(['f1'])
    expect(eventToCombo(ev('F12'), new Set())).toEqual(['f12'])
  })

  it('traduz teclas nomeadas (setas, enter, esc, etc.)', () => {
    expect(eventToCombo(ev('ArrowUp'), new Set())).toEqual(['up'])
    expect(eventToCombo(ev('ArrowDown'), new Set())).toEqual(['down'])
    expect(eventToCombo(ev('ArrowLeft'), new Set())).toEqual(['left'])
    expect(eventToCombo(ev('ArrowRight'), new Set())).toEqual(['right'])
    expect(eventToCombo(ev('Enter'), new Set())).toEqual(['enter'])
    expect(eventToCombo(ev('Escape'), new Set())).toEqual(['esc'])
    expect(eventToCombo(ev('Space'), new Set())).toEqual(['space'])
    expect(eventToCombo(ev('PageUp'), new Set())).toEqual(['pageup'])
    expect(eventToCombo(ev('PageDown'), new Set())).toEqual(['pagedown'])
  })

  it('devolve null se a tecla principal é desconhecida', () => {
    expect(eventToCombo(ev('F13'), new Set())).toBeNull()
    expect(eventToCombo(ev('Backquote'), new Set())).toBeNull()
  })

  it('devolve null se o evento é só um modificador (sem tecla principal)', () => {
    // codeToName('ControlLeft') é null, então main é null -> retorna null.
    expect(eventToCombo(ev('ControlLeft'), new Set())).toBeNull()
  })

  it('combina os modificadores rastreados com a tecla principal na ordem canônica', () => {
    const pressed = new Set(['shift', 'ctrl'])
    // Ordem canônica: ctrl antes de shift, independente da ordem de inserção.
    expect(eventToCombo(ev('KeyM'), pressed)).toEqual(['ctrl', 'shift', 'm'])
  })

  it('reconcilia modificadores via flags booleanas quando o rastreio escapou', () => {
    // pressed vazio, mas o evento marca ctrl/shift/alt/meta.
    const combo = eventToCombo(
      ev('KeyX', {ctrlKey: true, shiftKey: true, altKey: true, metaKey: true}),
      new Set(),
    )
    expect(combo).toEqual(['ctrl', 'shift', 'alt', 'win', 'x'])
  })

  it('não adiciona "ctrl" genérico quando o lado já está rastreado', () => {
    // lctrl já no conjunto + ctrlKey true: NÃO deve haver "ctrl" duplicado.
    const combo = eventToCombo(ev('KeyA', {ctrlKey: true}), new Set(['lctrl']))
    expect(combo).toEqual(['lctrl', 'a'])
    expect(combo).not.toContain('ctrl')
  })

  it('não adiciona "alt" genérico quando o lado já está rastreado', () => {
    const combo = eventToCombo(ev('KeyA', {altKey: true}), new Set(['ralt']))
    expect(combo).toEqual(['ralt', 'a'])
    expect(combo).not.toContain('alt')
  })

  it('preserva a ordem canônica MOD_ORDER com lados específicos', () => {
    const pressed = new Set(['win', 'lctrl', 'shift', 'ralt'])
    const combo = eventToCombo(ev('KeyZ'), pressed)
    // MOD_ORDER: ctrl, lctrl, rctrl, shift, alt, lalt, ralt, win
    expect(combo).toEqual(['lctrl', 'shift', 'ralt', 'win', 'z'])
  })
})

describe('keyLabel', () => {
  it('rotula modificadores genéricos', () => {
    expect(keyLabel('ctrl')).toBe('Ctrl')
    expect(keyLabel('shift')).toBe('Shift')
    expect(keyLabel('alt')).toBe('Alt')
    expect(keyLabel('win')).toBe('Win')
  })

  it('rotula lados específicos de Ctrl/Alt', () => {
    expect(keyLabel('lctrl')).toBe('Ctrl Esq')
    expect(keyLabel('rctrl')).toBe('Ctrl Dir')
    expect(keyLabel('lalt')).toBe('Alt Esq')
    expect(keyLabel('ralt')).toBe('AltGr')
  })

  it('rotula setas com símbolos', () => {
    expect(keyLabel('up')).toBe('↑')
    expect(keyLabel('down')).toBe('↓')
    expect(keyLabel('left')).toBe('←')
    expect(keyLabel('right')).toBe('→')
  })

  it('rotula teclas nomeadas do mapa', () => {
    expect(keyLabel('esc')).toBe('Esc')
    expect(keyLabel('pageup')).toBe('PgUp')
    expect(keyLabel('delete')).toBe('Del')
  })

  it('usa o rótulo das SPECIAL_KEYS sem o prefixo de emoji', () => {
    // 'win' aparece tanto no mapa quanto em SPECIAL_KEYS; SPECIAL_KEYS tem
    // prioridade. O label "⊞ Win" vira "Win" (remove o 1º token + espaço).
    expect(keyLabel('win')).toBe('Win')
    expect(keyLabel('mute')).toBe('Mute')
    expect(keyLabel('playpause')).toBe('Play')
    expect(keyLabel('prevtrack')).toBe('Prev')
    expect(keyLabel('nexttrack')).toBe('Next')
  })

  it('faz fallback para a tecla em maiúsculas quando desconhecida', () => {
    expect(keyLabel('a')).toBe('A')
    expect(keyLabel('f7')).toBe('F7')
    expect(keyLabel('xyz')).toBe('XYZ')
  })
})

describe('comboLabel', () => {
  it('junta as teclas com " + "', () => {
    expect(comboLabel(['ctrl', 'shift', 'm'])).toBe('Ctrl + Shift + M')
  })

  it('formata um combo simples', () => {
    expect(comboLabel(['alt', 'f4'])).toBe('Alt + F4')
  })

  it('devolve "—" para combo vazio ou ausente', () => {
    expect(comboLabel([])).toBe('—')
    expect(comboLabel(undefined as unknown as string[])).toBe('—')
  })
})

describe('constantes exportadas', () => {
  it('MODIFIERS contém os 8 modificadores esperados', () => {
    expect(MODIFIERS).toContain('ctrl')
    expect(MODIFIERS).toContain('lctrl')
    expect(MODIFIERS).toContain('win')
    expect(MODIFIERS).toHaveLength(8)
  })

  it('SPECIAL_KEYS expõe nome + label para cada tecla fixa', () => {
    const names = SPECIAL_KEYS.map((k) => k.name)
    expect(names).toContain('win')
    expect(names).toContain('mute')
    expect(SPECIAL_KEYS.every((k) => k.name && k.label)).toBe(true)
  })
})
