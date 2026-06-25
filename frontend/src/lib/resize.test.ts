import {describe, it, expect} from 'vitest'
import {resizeImageToDataURL} from './appearance'

// Cobertura do ramo SVG de resizeImageToDataURL (passthrough via FileReader).
//
// LIMITAÇÃO: o ramo raster (PNG/JPG/...) usa <canvas>.getContext('2d'), que o
// jsdom NÃO implementa (retorna null) — e ainda depende de Image.onload, que o
// jsdom também não dispara. Logo o caminho raster não é exercitável aqui; só
// validamos o ramo SVG (que é texto puro lido pelo FileReader) e o tratamento
// de erro de leitura. O ramo raster fica coberto por testes de integração/E2E.

function svgFile(content = '<svg xmlns="http://www.w3.org/2000/svg"/>'): File {
  return new File([content], 'icon.svg', {type: 'image/svg+xml'})
}

describe('resizeImageToDataURL - ramo SVG', () => {
  it('devolve uma data URL para SVG (passthrough, sem canvas)', async () => {
    const out = await resizeImageToDataURL(svgFile())
    expect(out.startsWith('data:')).toBe(true)
    expect(out).toContain('image/svg+xml')
  })

  it('preserva o conteúdo do SVG (base64 decodifica de volta)', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'
    const out = await resizeImageToDataURL(svgFile(svg))
    // data:image/svg+xml;base64,XXXX -> decodifica o payload.
    const base64 = out.split(',')[1]
    const decoded = atob(base64)
    expect(decoded).toBe(svg)
  })

  it('ignora o parâmetro max no ramo SVG (não redimensiona)', async () => {
    // Passar um max minúsculo não deve afetar o SVG (não passa pelo canvas).
    const out = await resizeImageToDataURL(svgFile(), 1)
    expect(out.startsWith('data:image/svg+xml')).toBe(true)
  })
})
