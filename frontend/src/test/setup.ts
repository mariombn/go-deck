// Setup global dos testes (Vitest). Carrega os matchers do jest-dom
// (toBeInTheDocument, toHaveTextContent, etc.) e limpa o DOM entre testes.
import '@testing-library/jest-dom/vitest'
import {cleanup} from '@testing-library/react'
import {afterEach} from 'vitest'

afterEach(() => {
  cleanup()
})
