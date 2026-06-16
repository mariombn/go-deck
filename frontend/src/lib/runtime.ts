// Detecção de runtime: o app é um único bundle. Quando roda dentro do webview
// do Wails (desktop), o runtime injeta window.runtime/window.go. No navegador
// do celular esses objetos não existem — então mostramos só o grid.

export const isDesktop: boolean =
  typeof (window as any).runtime !== 'undefined' ||
  typeof (window as any).go !== 'undefined';
