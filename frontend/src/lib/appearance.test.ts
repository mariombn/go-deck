import {describe, it, expect} from 'vitest'
import {isImageIcon, textColorFor} from './appearance'

// Teste-canário + cobertura das funções puras de aparência. Valida a toolchain
// (Vitest + jsdom) e o comportamento de contraste/distinção de ícone.

describe('isImageIcon', () => {
  it('reconhece data URL como imagem', () => {
    expect(isImageIcon('data:image/png;base64,AAAA')).toBe(true)
  })
  it('trata emoji como não-imagem', () => {
    expect(isImageIcon('🎮')).toBe(false)
  })
  it('trata undefined/vazio como não-imagem', () => {
    expect(isImageIcon(undefined)).toBe(false)
    expect(isImageIcon('')).toBe(false)
  })
})

describe('textColorFor', () => {
  it('usa texto escuro sobre fundo claro', () => {
    expect(textColorFor('#ffffff')).toBe('#0f172a')
  })
  it('usa texto branco sobre fundo escuro', () => {
    expect(textColorFor('#000000')).toBe('#fff')
  })
  it('aceita hex de 3 dígitos', () => {
    expect(textColorFor('#fff')).toBe('#0f172a')
  })
  it('cai para branco quando o hex é inválido ou ausente', () => {
    expect(textColorFor(undefined)).toBe('#fff')
    expect(textColorFor('xyz')).toBe('#fff')
  })
})
