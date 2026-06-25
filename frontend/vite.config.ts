/// <reference types="vitest" />
import {defineConfig} from 'vitest/config'
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
//
// Em modo teste o Fast Refresh do @vitejs/plugin-react é DESLIGADO: ele injeta
// um "preamble" de HMR que só existe no browser real; sob jsdom o Vitest falha
// com "@vitejs/plugin-react can't detect preamble" ao coletar qualquer .tsx.
// Como teste não usa HMR, desligar resolve na raiz (sem gambiarra por arquivo).
export default defineConfig(({mode}) => ({
  plugins: [react(mode === 'test' ? {fastRefresh: false} : {}), stripCrossorigin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  // Configuração do Vitest. jsdom dá um DOM aos testes de componente; o
  // setup carrega os matchers do jest-dom. `globals` deixa describe/it/expect
  // disponíveis sem import (estilo Jest), casando com o tsconfig de teste.
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts'],
    },
  },
}))
