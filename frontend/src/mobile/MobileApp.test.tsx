// Testes de componente do MobileApp (Vitest + Testing Library).
//
// i18n real inicia em inglês — consultamos por textos em inglês.
//
// Mocks de I/O:
//  - WebSocket global: classe fake (FakeWS) com onopen/onmessage/onclose/send,
//    instalada via vi.stubGlobal. Cada instância registra-se em FakeWS.last
//    para o teste empurrar mensagens do servidor (open/config/ack).
//  - nosleep.js: stub (enable/disable) — não há vídeo real no jsdom.
//
// Importamos o componente dinamicamente (em renderMobile) para que os
// mocks/stubs do WebSocket valham antes do efeito de conexão.
const w = window as unknown as Record<string, unknown>;

// jsdom não tem ResizeObserver, usado por useFitGridWidth no MobileApp. Stub
// mínimo (não medimos layout aqui; o grid usa width=undefined, tudo bem).
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
w.ResizeObserver = FakeResizeObserver;

import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import type {DeckConfig, ButtonConfig} from '../types';

// --- Mock do nosleep.js (sem vídeo no jsdom) ---
vi.mock('nosleep.js', () => ({
  default: class {
    enable() {
      return Promise.resolve();
    }
    disable() {}
  },
}));

// --- Fake WebSocket ---
// Implementa só o necessário: readyState, send, close e os handlers que o
// MobileApp atribui. FakeWS.last aponta para a instância mais recente.
class FakeWS {
  static OPEN = 1;
  static last: FakeWS | null = null;
  static instances: FakeWS[] = [];

  url: string;
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((ev: {data: string}) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWS.last = this;
    FakeWS.instances.push(this);
  }

  // Helpers de teste (não fazem parte da API real do WebSocket).
  fireOpen() {
    this.readyState = FakeWS.OPEN;
    this.onopen?.();
  }
  fireMessage(payload: unknown) {
    this.onmessage?.({data: JSON.stringify(payload)});
  }
  fireClose() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

// WebSocket.OPEN é lido em MobileApp.press; o stub global precisa expô-lo.
beforeEach(() => {
  FakeWS.last = null;
  FakeWS.instances = [];
  vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket);
  vi.useFakeTimers({shouldAdvanceTime: true});
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Import dinâmico após os mocks/stubs (o módulo lê WebSocket no efeito e o
// preâmbulo do HMR precisa estar instalado antes do transform rodar).
async function renderMobile() {
  await import('../lib/i18n');
  const React = await import('react');
  const {default: MobileApp} = await import('./MobileApp');
  // Import dinâmico (após os mocks/stubs) para que o WebSocket fake valha antes
  // do efeito de conexão do MobileApp.
  return render(React.createElement(MobileApp));
}

// Helper: empurra um config pelo WS fake.
function sendConfig(cfg: DeckConfig) {
  const ws = FakeWS.last!;
  act(() => {
    ws.fireOpen();
    ws.fireMessage({type: 'config', payload: cfg});
  });
}

function button(over: Partial<ButtonConfig>): ButtonConfig {
  return {
    id: 'b1',
    label: 'Botão',
    position: {row: 0, col: 0},
    action: {type: 'keypress', keys: ['a']},
    ...over,
  };
}

function makeConfig(over: Partial<DeckConfig> = {}): DeckConfig {
  return {
    pages: [
      {
        id: 'p1',
        name: 'Principal',
        grid: {rows: 1, cols: 1},
        buttons: [button({id: 'b1', label: 'Mutar'})],
      },
    ],
    server: {port: 8754},
    integrations: {obs: {enabled: false, host: '', port: 4455, password: ''}},
    language: 'en',
    ...over,
  };
}

describe('MobileApp', () => {
  it('abre o WebSocket na rota /ws ao montar e mostra "Connecting…"', async () => {
    await renderMobile();
    expect(FakeWS.last).not.toBeNull();
    expect(FakeWS.last!.url).toContain('/ws');
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('inclui o token de pareamento (?t=) na URL quando presente na location', async () => {
    const original = window.location.search;
    Object.defineProperty(window, 'location', {
      value: {...window.location, search: '?t=abc123', host: window.location.host, protocol: 'http:'},
      writable: true,
    });
    await renderMobile();
    expect(FakeWS.last!.url).toContain('t=abc123');
    Object.defineProperty(window, 'location', {
      value: {...window.location, search: original},
      writable: true,
    });
  });

  it('mostra a tela de espera enquanto não há config', async () => {
    await renderMobile();
    expect(screen.getByText('Waiting for configuration…')).toBeInTheDocument();
  });

  it('renderiza o grid e marca "Connected" ao receber config', async () => {
    await renderMobile();
    sendConfig(makeConfig());

    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.getByRole('button', {name: 'Mutar'})).toBeInTheDocument();
  });

  it('envia {type:"press"} ao tocar num botão de ação normal', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    await renderMobile();
    sendConfig(makeConfig());

    await user.click(await screen.findByRole('button', {name: 'Mutar'}));

    const sent = FakeWS.last!.sent.map((s) => JSON.parse(s));
    expect(sent).toContainEqual({type: 'press', buttonId: 'b1'});
  });

  it('NÃO envia press para ação navigate; troca a página localmente', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const cfg = makeConfig({
      pages: [
        {
          id: 'p1',
          name: 'Principal',
          grid: {rows: 1, cols: 1},
          buttons: [button({id: 'nav', label: 'Ir', action: {type: 'navigate', targetPage: 'p2'}})],
        },
        {
          id: 'p2',
          name: 'Cenas',
          grid: {rows: 1, cols: 1},
          buttons: [button({id: 'b2', label: 'Cena 1'})],
        },
      ],
    });
    await renderMobile();
    sendConfig(cfg);

    await user.click(await screen.findByRole('button', {name: 'Ir'}));

    // Nenhum press foi enviado.
    expect(FakeWS.last!.sent).toHaveLength(0);
    // A página 2 passou a ser exibida (botão "Cena 1" aparece; "Ir" some).
    expect(await screen.findByRole('button', {name: 'Cena 1'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Ir'})).not.toBeInTheDocument();
  });

  it('mostra toast quando o navigate aponta para página inexistente', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const cfg = makeConfig({
      pages: [
        {
          id: 'p1',
          name: 'Principal',
          grid: {rows: 1, cols: 1},
          buttons: [button({id: 'nav', label: 'Ir', action: {type: 'navigate', targetPage: 'inexistente'}})],
        },
        // 2ª página só para o cabeçalho Home/nome aparecer não é necessário aqui.
      ],
    });
    await renderMobile();
    sendConfig(cfg);

    await user.click(await screen.findByRole('button', {name: 'Ir'}));
    expect(await screen.findByText('target grid not found')).toBeInTheDocument();
  });

  it('exibe o botão Home e o nome da página quando há mais de uma página', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    const cfg = makeConfig({
      pages: [
        {
          id: 'p1',
          name: 'Principal',
          grid: {rows: 1, cols: 1},
          buttons: [button({id: 'nav', label: 'Ir', action: {type: 'navigate', targetPage: 'p2'}})],
        },
        {
          id: 'p2',
          name: 'Cenas',
          grid: {rows: 1, cols: 1},
          buttons: [button({id: 'b2', label: 'Cena 1'})],
        },
      ],
    });
    await renderMobile();
    sendConfig(cfg);

    // Navega para p2.
    await user.click(await screen.findByRole('button', {name: 'Ir'}));
    await screen.findByRole('button', {name: 'Cena 1'});

    // Botão Home aparece e está habilitado fora da 1ª página.
    const home = screen.getByRole('button', {name: '⌂ Home'});
    expect(home).toBeEnabled();
    expect(screen.getByText('Cenas')).toBeInTheDocument();

    // Clicar em Home volta para a 1ª página.
    await user.click(home);
    expect(await screen.findByRole('button', {name: 'Ir'})).toBeInTheDocument();
  });

  it('faz flash de erro e mostra toast quando o ack vem com ok:false', async () => {
    await renderMobile();
    sendConfig(makeConfig());
    await screen.findByRole('button', {name: 'Mutar'});

    act(() => {
      FakeWS.last!.fireMessage({type: 'ack', buttonId: 'b1', ok: false, error: 'falha xyz'});
    });

    expect(await screen.findByText('falha xyz')).toBeInTheDocument();
  });

  it('reconecta (status "Reconnecting…") quando o socket fecha', async () => {
    await renderMobile();
    sendConfig(makeConfig());
    await screen.findByText('Connected');

    act(() => {
      FakeWS.last!.fireClose();
    });
    expect(await screen.findByText('Reconnecting…')).toBeInTheDocument();

    // Após o backoff, uma nova conexão é criada.
    const before = FakeWS.instances.length;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeWS.instances.length).toBeGreaterThan(before);
  });

  it('alterna o keep-awake (aria-pressed) ao clicar no botão de tela', async () => {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    await renderMobile();
    sendConfig(makeConfig());
    await screen.findByRole('button', {name: 'Mutar'});

    // Botão de keep-awake: rótulo "🌙 Screen" quando desligado.
    const awakeBtn = screen.getByRole('button', {name: '🌙 Screen'});
    expect(awakeBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(awakeBtn);
    expect(screen.getByRole('button', {name: '🔆 Screen on'})).toHaveAttribute('aria-pressed', 'true');
  });
});
