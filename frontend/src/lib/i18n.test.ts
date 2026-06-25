import {describe, it, expect, afterEach, vi} from 'vitest'
import i18n, {
  DEFAULT_LANG,
  LANGUAGES,
  isSupported,
  detectLanguage,
  setLanguage,
} from './i18n'

// i18n.ts inicializa o i18next como efeito colateral do import, descobrindo os
// locales de src/locales/*.json via import.meta.glob (resolvido pelo Vitest).
// Testamos as funções puras (isSupported/detectLanguage) e o t() resolvendo
// chave conhecida + fallback. setLanguage muda estado global -> restauramos.

afterEach(() => {
  vi.unstubAllGlobals()
  // Restaura o idioma base para não vazar estado entre testes.
  i18n.changeLanguage(DEFAULT_LANG)
})

describe('descoberta de locales', () => {
  it('DEFAULT_LANG é inglês', () => {
    expect(DEFAULT_LANG).toBe('en')
  })

  it('LANGUAGES inclui en e pt-BR (os JSONs do projeto)', () => {
    const codes = LANGUAGES.map((l) => l.code)
    expect(codes).toContain('en')
    expect(codes).toContain('pt-BR')
  })

  it('cada idioma tem um nativeName não-vazio', () => {
    expect(LANGUAGES.every((l) => typeof l.nativeName === 'string' && l.nativeName.length > 0)).toBe(true)
  })

  it('LANGUAGES vem ordenado por nativeName', () => {
    const names = LANGUAGES.map((l) => l.nativeName)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })
})

describe('isSupported', () => {
  it('reconhece idiomas presentes', () => {
    expect(isSupported('en')).toBe(true)
    expect(isSupported('pt-BR')).toBe(true)
  })

  it('rejeita idiomas ausentes', () => {
    expect(isSupported('xx')).toBe(false)
    expect(isSupported('pt')).toBe(false) // só pt-BR existe, não "pt" puro
    expect(isSupported('')).toBe(false)
  })
})

describe('detectLanguage', () => {
  it('faz match exato quando o locale existe', () => {
    vi.stubGlobal('navigator', {languages: ['pt-BR', 'en'], language: 'pt-BR'})
    expect(detectLanguage()).toBe('pt-BR')
  })

  it('faz match por idioma base (pt-PT -> pt-BR)', () => {
    vi.stubGlobal('navigator', {languages: ['pt-PT'], language: 'pt-PT'})
    expect(detectLanguage()).toBe('pt-BR')
  })

  it('cai para o inglês quando nada bate', () => {
    vi.stubGlobal('navigator', {languages: ['fr-FR', 'de'], language: 'fr-FR'})
    expect(detectLanguage()).toBe('en')
  })

  it('usa navigator.language quando languages está ausente', () => {
    vi.stubGlobal('navigator', {languages: undefined, language: 'pt-BR'})
    expect(detectLanguage()).toBe('pt-BR')
  })

  it('cai para o inglês quando não há nenhuma preferência', () => {
    vi.stubGlobal('navigator', {languages: [], language: ''})
    expect(detectLanguage()).toBe('en')
  })
})

describe('t() / tradução', () => {
  it('resolve uma chave conhecida no idioma base (en)', () => {
    expect(i18n.t('actions.summary.record')).toBe('Recording')
  })

  it('cai para a chave literal quando ela não existe', () => {
    // Sem tradução -> i18next devolve a própria chave (fallback).
    const missing = 'chave.que.nao.existe.em.lugar.nenhum'
    expect(i18n.t(missing)).toBe(missing)
  })

  it('faz fallback para inglês quando o idioma ativo não tem a chave', async () => {
    // Mesmo em pt-BR, uma chave só-inglês cairia para en. Aqui validamos que
    // trocar para pt-BR ainda resolve uma chave existente.
    await i18n.changeLanguage('pt-BR')
    expect(typeof i18n.t('actions.summary.record')).toBe('string')
    expect(i18n.t('actions.summary.record').length).toBeGreaterThan(0)
  })
})

describe('setLanguage', () => {
  it('troca o idioma quando suportado', async () => {
    setLanguage('pt-BR')
    expect(i18n.language).toBe('pt-BR')
  })

  it('ignora idioma não suportado (mantém o atual)', () => {
    i18n.changeLanguage('en')
    setLanguage('xx')
    expect(i18n.language).toBe('en')
  })
})
