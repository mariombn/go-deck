import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// Remove o atributo `crossorigin` dos <script>/<link> gerados pelo Vite.
// Sob o esquema interno do Wails (wails.localhost), o WebView2 pode bloquear
// módulos marcados como crossorigin (tratados como CORS sem header ACAO),
// resultando num webview em branco. Sem crossorigin, carregam normalmente.
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin/g, '')
    },
  }
}

// Porta fixa para o Vite dev server: o servidor Go (cliente celular) faz
// reverse-proxy para cá em modo dev, então o endereço precisa ser estável.
export default defineConfig({
  plugins: [react(), stripCrossorigin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
