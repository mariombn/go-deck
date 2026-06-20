import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'

// Overlay de diagnóstico (apenas em DEV): garante que QUALQUER erro de runtime
// apareça na tela (em vez de um webview/página em branco), facilitando o debug
// — inclusive no celular, sem devtools, já que `wails dev` serve o bundle em
// modo DEV. Em produção fica desligado (só console.error) para não expor stack
// traces ao usuário final.
function showError(label: string, err: unknown) {
    if (!import.meta.env.DEV) {
        console.error(`[${label}]`, err)
        return
    }
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)
    const pre = document.createElement('pre')
    pre.style.cssText =
        'position:fixed;inset:0;z-index:99999;margin:0;padding:16px;overflow:auto;' +
        'background:#7f1d1d;color:#fff;font:12px/1.5 monospace;white-space:pre-wrap'
    pre.textContent = `[${label}]\n${msg}`
    document.body.appendChild(pre)
}

if (import.meta.env.DEV) {
    window.addEventListener('error', (e) => showError('window.error', e.error ?? e.message))
    window.addEventListener('unhandledrejection', (e) => showError('promise', e.reason))
}

try {
    const container = document.getElementById('root')
    const root = createRoot(container!)
    root.render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    )
} catch (err) {
    showError('bootstrap', err)
}
