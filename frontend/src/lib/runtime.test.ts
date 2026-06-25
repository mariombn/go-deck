import {describe, it, expect, afterEach, vi} from 'vitest'

// runtime.ts calcula `isDesktop` UMA vez, no load do módulo, a partir da
// presença de window.runtime / window.go. Para exercitar os ramos, manipulamos
// esses globais e reimportamos o módulo (vi.resetModules + import dinâmico).

const w = window as unknown as {runtime?: unknown; go?: unknown}

afterEach(() => {
  delete w.runtime
  delete w.go
  vi.resetModules()
})

async function loadIsDesktop(): Promise<boolean> {
  vi.resetModules()
  const mod = await import('./runtime')
  return mod.isDesktop
}

describe('isDesktop', () => {
  it('é false no navegador puro (sem runtime nem go)', async () => {
    delete w.runtime
    delete w.go
    expect(await loadIsDesktop()).toBe(false)
  })

  it('é true quando window.runtime existe (webview do Wails)', async () => {
    w.runtime = {}
    delete w.go
    expect(await loadIsDesktop()).toBe(true)
  })

  it('é true quando window.go existe (bindings)', async () => {
    delete w.runtime
    w.go = {}
    expect(await loadIsDesktop()).toBe(true)
  })

  it('é true quando ambos existem', async () => {
    w.runtime = {}
    w.go = {}
    expect(await loadIsDesktop()).toBe(true)
  })
})
