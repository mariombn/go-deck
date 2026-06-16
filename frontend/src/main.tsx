import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'

// Overlay de diagnóstico: garante que QUALQUER erro de runtime apareça na
// tela (em vez de um webview em branco), facilitando o debug na POC.
function showError(label: string, err: unknown) {
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)
    const pre = document.createElement('pre')
    pre.style.cssText =
        'position:fixed;inset:0;z-index:99999;margin:0;padding:16px;overflow:auto;' +
        'background:#7f1d1d;color:#fff;font:12px/1.5 monospace;white-space:pre-wrap'
    pre.textContent = `[${label}]\n${msg}`
    document.body.appendChild(pre)
}

window.addEventListener('error', (e) => showError('window.error', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => showError('promise', e.reason))

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
