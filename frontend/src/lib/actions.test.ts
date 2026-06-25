import {describe, it, expect} from 'vitest'
import type {TFunction} from 'i18next'
import {actionSummary} from './actions'
import type {Action} from '../types'

// Cobertura de actionSummary (resumo curto de cada tipo de ação). É função pura
// dado um `t`; usamos um `t` falso determinístico (espelhando os textos em
// inglês + pluralização de "steps") para isolar do estado global do i18next.

const t = ((key: string, opts?: Record<string, unknown>): string => {
  const count = opts?.count as number | undefined
  switch (key) {
    case 'actions.summary.steps':
      return count === 1 ? '1 step' : `${count} steps`
    case 'actions.summary.record':
      return 'Recording'
    case 'actions.summary.stream':
      return 'Streaming'
    case 'actions.summary.deafen':
      return 'Deafen'
    case 'actions.summary.mute':
      return 'Mute'
    case 'actions.summary.navigate':
      return 'Go to grid'
    default:
      return key
  }
}) as unknown as TFunction

describe('actionSummary - keypress', () => {
  it('mostra o combo sem hold', () => {
    const a: Action = {type: 'keypress', keys: ['ctrl', 'c']}
    expect(actionSummary(a, t)).toBe('Ctrl + C')
  })

  it('anexa o tempo de hold em segundos (2000ms -> 2s)', () => {
    const a: Action = {type: 'keypress', keys: ['alt', 'f4'], holdMs: 2000}
    expect(actionSummary(a, t)).toBe('Alt + F4 · 2s')
  })

  it('formata frações de segundo (500ms -> 0.5s)', () => {
    const a: Action = {type: 'keypress', keys: ['space'], holdMs: 500}
    expect(actionSummary(a, t)).toBe('Space · 0.5s')
  })

  it('ignora hold igual a zero', () => {
    const a: Action = {type: 'keypress', keys: ['enter'], holdMs: 0}
    expect(actionSummary(a, t)).toBe('Enter')
  })

  it('combo vazio cai para "—"', () => {
    const a: Action = {type: 'keypress', keys: []}
    expect(actionSummary(a, t)).toBe('—')
  })
})

describe('actionSummary - launch', () => {
  it('extrai o basename de caminho Windows', () => {
    const a: Action = {type: 'launch', path: 'C:\\Windows\\notepad.exe'}
    expect(actionSummary(a, t)).toBe('▶ notepad.exe')
  })

  it('extrai o basename de caminho Unix', () => {
    const a: Action = {type: 'launch', path: '/usr/bin/code'}
    expect(actionSummary(a, t)).toBe('▶ code')
  })

  it('mostra "—" quando o caminho está vazio', () => {
    const a: Action = {type: 'launch', path: ''}
    expect(actionSummary(a, t)).toBe('▶ —')
  })
})

describe('actionSummary - url', () => {
  it('remove o esquema http(s)://', () => {
    expect(actionSummary({type: 'url', url: 'https://example.com'}, t)).toBe('🔗 example.com')
    expect(actionSummary({type: 'url', url: 'http://foo.test/x'}, t)).toBe('🔗 foo.test/x')
  })

  it('mantém URLs sem esquema http como estão', () => {
    expect(actionSummary({type: 'url', url: 'ftp://host/file'}, t)).toBe('🔗 ftp://host/file')
  })

  it('mostra "—" quando a url está vazia', () => {
    expect(actionSummary({type: 'url', url: ''}, t)).toBe('🔗 —')
  })
})

describe('actionSummary - sequence', () => {
  it('pluraliza o número de passos', () => {
    const one: Action = {type: 'sequence', steps: [{type: 'url', url: 'https://a'}]}
    expect(actionSummary(one, t)).toBe('⛓ 1 step')
    const many: Action = {
      type: 'sequence',
      steps: [
        {type: 'url', url: 'https://a'},
        {type: 'url', url: 'https://b'},
      ],
    }
    expect(actionSummary(many, t)).toBe('⛓ 2 steps')
  })

  it('lida com zero passos', () => {
    expect(actionSummary({type: 'sequence', steps: []}, t)).toBe('⛓ 0 steps')
  })
})

describe('actionSummary - obs', () => {
  it('cena usa o target', () => {
    expect(actionSummary({type: 'obs', obsOp: 'scene', target: 'Intro'}, t)).toBe('🎬 Intro')
  })

  it('cena sem target cai para "—"', () => {
    expect(actionSummary({type: 'obs', obsOp: 'scene'}, t)).toBe('🎬 —')
  })

  it('toggle de gravação e transmissão', () => {
    expect(actionSummary({type: 'obs', obsOp: 'toggle_record'}, t)).toBe('⏺ Recording')
    expect(actionSummary({type: 'obs', obsOp: 'toggle_stream'}, t)).toBe('📡 Streaming')
  })

  it('toggle de mute usa o target', () => {
    expect(actionSummary({type: 'obs', obsOp: 'toggle_mute', target: 'Mic'}, t)).toBe('🔇 Mic')
    expect(actionSummary({type: 'obs', obsOp: 'toggle_mute'}, t)).toBe('🔇 —')
  })

  it('hotkey usa o target', () => {
    expect(actionSummary({type: 'obs', obsOp: 'hotkey', target: 'OBSBasic.Foo'}, t)).toBe('⌨ OBSBasic.Foo')
  })

  it('obsOp desconhecido cai para "OBS"', () => {
    const a = {type: 'obs', obsOp: 'unknown'} as unknown as Action
    expect(actionSummary(a, t)).toBe('OBS')
  })
})

describe('actionSummary - discord', () => {
  it('deafen vs mute', () => {
    expect(actionSummary({type: 'discord', discordOp: 'deafen', keys: ['f10']}, t)).toBe('🎧 Deafen')
    expect(actionSummary({type: 'discord', discordOp: 'mute', keys: ['f9']}, t)).toBe('🎙 Mute')
  })
})

describe('actionSummary - navigate', () => {
  it('mostra o rótulo de navegação', () => {
    expect(actionSummary({type: 'navigate', targetPage: 'p1'}, t)).toBe('➡ Go to grid')
  })
})

describe('actionSummary - tipo desconhecido', () => {
  it('devolve string vazia', () => {
    const a = {type: 'desconhecido'} as unknown as Action
    expect(actionSummary(a, t)).toBe('')
  })
})
