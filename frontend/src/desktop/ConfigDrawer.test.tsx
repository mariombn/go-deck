// Testes de comportamento do ConfigDrawer: painel lateral com idioma, abas
// (mobile/QR e OBS), QR/rede e seletor de IP. Em pt-BR.
//
// i18n real (en). O OBSPanel é renderizado de verdade (componente filho), então
// mockamos o binding App.TestOBS para não depender de I/O. Esc/backdrop fecham.

import {render, screen, fireEvent} from '@testing-library/react';
import '../lib/i18n';
import ConfigDrawer from './ConfigDrawer';
import {OBSConfig} from '../types';

vi.mock('../../wailsjs/go/main/App', () => ({
  TestOBS: vi.fn(async () => undefined),
}));

const obs: OBSConfig = {enabled: false, host: 'localhost', port: 4455, password: ''};

const network = {
  ips: ['192.168.0.10', '10.0.0.5'],
  activeIP: '192.168.0.10',
  port: 8754,
  url: 'http://192.168.0.10:8754/?t=abc',
  error: '',
};

function setup(over: Partial<React.ComponentProps<typeof ConfigDrawer>> = {}) {
  const onClose = vi.fn();
  const onChangeIP = vi.fn();
  const onChangeOBS = vi.fn();
  const onChangeLanguage = vi.fn();
  const utils = render(
    <ConfigDrawer
      open={true}
      onClose={onClose}
      network={network}
      qr="data:image/png;base64,QR"
      onChangeIP={onChangeIP}
      obs={obs}
      onChangeOBS={onChangeOBS}
      language="en"
      onChangeLanguage={onChangeLanguage}
      {...over}
    />,
  );
  return {onClose, onChangeIP, onChangeOBS, onChangeLanguage, ...utils};
}

describe('ConfigDrawer — idioma', () => {
  it('lista os idiomas disponíveis e emite a troca', () => {
    const {onChangeLanguage} = setup();
    const select = screen.getByLabelText('Language') as HTMLSelectElement;
    const codigos = Array.from(select.options).map((o) => o.value);
    // Pelo menos en e pt-BR (locales presentes no projeto).
    expect(codigos).toContain('en');
    expect(codigos).toContain('pt-BR');
    fireEvent.change(select, {target: {value: 'pt-BR'}});
    expect(onChangeLanguage).toHaveBeenCalledWith('pt-BR');
  });
});

describe('ConfigDrawer — aba mobile/QR', () => {
  it('exibe o QR e a URL de acesso', () => {
    setup();
    const qr = screen.getByAltText('QR Code') as HTMLImageElement;
    expect(qr.src).toContain('data:image/png;base64,QR');
    expect(screen.getByText('http://192.168.0.10:8754/?t=abc')).toBeInTheDocument();
  });

  it('com múltiplos IPs, troca o IP ativo', () => {
    const {onChangeIP} = setup();
    const select = screen.getByDisplayValue('192.168.0.10') as HTMLSelectElement;
    fireEvent.change(select, {target: {value: '10.0.0.5'}});
    expect(onChangeIP).toHaveBeenCalledWith('10.0.0.5');
  });

  it('mostra a mensagem de erro de rede em vez do QR', () => {
    setup({network: {...network, error: 'sem interface de rede'}});
    expect(screen.getByText('sem interface de rede')).toBeInTheDocument();
    expect(screen.queryByAltText('QR Code')).toBeNull();
  });
});

describe('ConfigDrawer — abas e OBS', () => {
  it('alterna para a aba OBS e mostra o painel do OBS', () => {
    setup();
    // Aba inicial é mobile: o aviso de segurança aparece.
    expect(screen.getByText(/token-protected/)).toBeInTheDocument();
    // Clica na aba OBS.
    fireEvent.click(screen.getByRole('button', {name: 'OBS'}));
    expect(screen.getByText('Enable integration')).toBeInTheDocument();
  });
});

describe('ConfigDrawer — fechar', () => {
  it('o X fecha o drawer', () => {
    const {onClose} = setup();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape fecha o drawer quando aberto', () => {
    const {onClose} = setup();
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape NÃO fecha quando o drawer está fechado', () => {
    const {onClose} = setup({open: false});
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).not.toHaveBeenCalled();
  });
});
