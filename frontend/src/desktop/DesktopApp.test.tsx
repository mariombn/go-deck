// Testes de integração do DesktopApp: monta, carrega a config via bindings
// mockados, renderiza o grid/abas, abre o editor de botão, salva (SaveConfig),
// gerencia páginas e troca de idioma. Em pt-BR.
//
// i18n real (en). Mockamos TODO o módulo de bindings Wails (window.go.main.App)
// por vi.fn()s que resolvem Promises. Também mockamos KeyCapture, emoji-picker
// e o módulo bindings importado pelo AppearanceFields (mesmo caminho relativo).

import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../lib/i18n';
import DesktopApp from './DesktopApp';
import {DeckConfig} from '../types';

// --- Mocks dos bindings Wails (mesmo caminho relativo dos componentes desktop) ---
const getConfig = vi.fn();
const saveConfig = vi.fn();
const getNetworkInfo = vi.fn();
const getQRCode = vi.fn();
const setLanguage = vi.fn();
const setActiveIP = vi.fn();
const listInstalledApps = vi.fn(async (..._a: unknown[]) => []);
const pickAppIcon = vi.fn(async (..._a: unknown[]) => '');
const testOBS = vi.fn(async (..._a: unknown[]) => undefined);

vi.mock('../../wailsjs/go/main/App', () => ({
  GetConfig: (...a: unknown[]) => getConfig(...a),
  SaveConfig: (...a: unknown[]) => saveConfig(...a),
  GetNetworkInfo: (...a: unknown[]) => getNetworkInfo(...a),
  GetQRCode: (...a: unknown[]) => getQRCode(...a),
  SetLanguage: (...a: unknown[]) => setLanguage(...a),
  SetActiveIP: (...a: unknown[]) => setActiveIP(...a),
  ListInstalledApps: (...a: unknown[]) => listInstalledApps(...a),
  PickAppIcon: (...a: unknown[]) => pickAppIcon(...a),
  TestOBS: (...a: unknown[]) => testOBS(...a),
}));

vi.mock('./KeyCapture', () => ({
  default: ({onChange}: {onChange: (k: string[]) => void}) => (
    <button type="button" onClick={() => onChange(['ctrl', 'k'])}>
      set-combo
    </button>
  ),
}));

vi.mock('emoji-picker-react', () => ({
  EmojiStyle: {NATIVE: 'native'},
  default: () => <div />,
}));

function sampleConfig(over: Partial<DeckConfig> = {}): DeckConfig {
  return {
    language: 'en',
    server: {port: 8754},
    integrations: {obs: {enabled: false, host: 'localhost', port: 4455, password: ''}},
    pages: [
      {
        id: 'p1',
        name: 'Principal',
        grid: {rows: 1, cols: 2},
        buttons: [
          {id: 'btn1', label: 'Play', position: {row: 0, col: 0}, action: {type: 'keypress', keys: ['space']}},
        ],
      },
    ],
    ...over,
  };
}

const network = {
  ips: ['192.168.0.10'],
  activeIP: '192.168.0.10',
  port: 8754,
  url: 'http://192.168.0.10:8754/?t=abc',
  error: '',
};

beforeEach(() => {
  getConfig.mockReset().mockResolvedValue(sampleConfig());
  // SaveConfig devolve a config recebida (eco), como o backend faz.
  saveConfig.mockReset().mockImplementation(async (c: DeckConfig) => c);
  getNetworkInfo.mockReset().mockResolvedValue(network);
  getQRCode.mockReset().mockResolvedValue('data:image/png;base64,QR');
  setLanguage.mockReset().mockResolvedValue(sampleConfig());
  setActiveIP.mockReset().mockResolvedValue(network);
});

async function renderLoaded() {
  const utils = render(<DesktopApp />);
  // Espera a config carregar: a página ativa "Principal" vira um input (card
  // ativo), então buscamos pelo seu value, não por texto.
  await waitFor(() => expect(screen.getByDisplayValue('Principal')).toBeInTheDocument());
  return utils;
}

describe('DesktopApp — carregamento', () => {
  it('mostra "Loading…" e depois o grid carregado via GetConfig', async () => {
    render(<DesktopApp />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Play')).toBeInTheDocument());
    expect(getConfig).toHaveBeenCalledTimes(1);
    expect(getNetworkInfo).toHaveBeenCalled();
  });

  it('renderiza o botão existente e células vazias (alvos "+")', async () => {
    await renderLoaded();
    expect(screen.getByText('Play')).toBeInTheDocument();
    // grid 1x2 com 1 botão -> 1 célula vazia ("+").
    expect(screen.getByText('+')).toBeInTheDocument();
  });
});

describe('DesktopApp — editor de botão', () => {
  it('clicar numa célula vazia abre o editor de novo botão', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText('+'));
    expect(await screen.findByText('New button')).toBeInTheDocument();
  });

  it('clicar num botão existente abre o editor de edição', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText('Play'));
    expect(await screen.findByText('Edit button')).toBeInTheDocument();
  });

  it('salvar um novo botão fecha o editor e habilita o botão "Save configuration"', async () => {
    await renderLoaded();
    // Salvar global começa desabilitado (nada sujo).
    const saveCfgBtn = screen.getByText('Save configuration');
    expect(saveCfgBtn).toBeDisabled();

    fireEvent.click(screen.getByText('+'));
    await screen.findByText('New button');
    // Compõe uma ação válida via KeyCapture stub.
    fireEvent.click(screen.getByText('set-combo'));
    fireEvent.click(screen.getByText('Save button'));

    // Editor fechou.
    await waitFor(() => expect(screen.queryByText('New button')).toBeNull());
    // A config ficou suja -> botão de salvar habilitado.
    expect(screen.getByText('Save configuration')).toBeEnabled();
  });
});

describe('DesktopApp — persistência', () => {
  it('salvar dispara SaveConfig e mostra a confirmação', async () => {
    await renderLoaded();
    // Suja a config criando um botão.
    fireEvent.click(screen.getByText('+'));
    await screen.findByText('New button');
    fireEvent.click(screen.getByText('set-combo'));
    fireEvent.click(screen.getByText('Save button'));
    await waitFor(() => expect(screen.getByText('Save configuration')).toBeEnabled());

    fireEvent.click(screen.getByText('Save configuration'));
    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(1));
    // A config enviada inclui o novo botão (2 botões na página).
    const enviado = saveConfig.mock.calls[0][0] as DeckConfig;
    expect(enviado.pages[0].buttons.length).toBe(2);
    // Mensagem "Saved ✓" aparece.
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });
});

describe('DesktopApp — gerência de páginas', () => {
  it('adiciona uma nova página e a torna ativa', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText('+ New grid'));
    // A nova página vira ativa e ganha um input de nome (card ativo).
    await waitFor(() => expect(screen.getByDisplayValue('Grid 2')).toBeInTheDocument());
  });

  it('renomear a página ativa atualiza o nome', async () => {
    await renderLoaded();
    const nameInput = screen.getByDisplayValue('Principal');
    fireEvent.change(nameInput, {target: {value: 'Cenas'}});
    expect(screen.getByDisplayValue('Cenas')).toBeInTheDocument();
  });
});

describe('DesktopApp — config drawer e idioma', () => {
  it('abre o drawer de configuração pela engrenagem', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByLabelText('Settings'));
    // O drawer mostra o QR carregado.
    await waitFor(() => expect(screen.getByAltText('QR Code')).toBeInTheDocument());
  });

  it('trocar o idioma persiste via SetLanguage', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByLabelText('Settings'));
    const langSelect = await screen.findByLabelText('Language');
    fireEvent.change(langSelect, {target: {value: 'pt-BR'}});
    await waitFor(() => expect(setLanguage).toHaveBeenCalledWith('pt-BR'));
  });

  it('ajusta o tamanho do grid (linhas/colunas) sem órfãos', async () => {
    await renderLoaded();
    // Aumenta colunas de 2 -> 3: ganha mais uma célula vazia.
    const colsInput = screen.getByDisplayValue('2');
    fireEvent.change(colsInput, {target: {value: '3'}});
    await waitFor(() => {
      // Agora há 2 células vazias ("+").
      expect(screen.getAllByText('+').length).toBe(2);
    });
  });
});
