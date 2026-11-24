import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {vi, beforeEach, it, expect} from 'vitest';
import '../lib/i18n';
import * as App from '../../wailsjs/go/main/App';
import {hardwareImages} from '../lib/hardwareImages';
import HardwarePanel from './HardwarePanel';
import {DeckConfig} from '../types';
import {chooseSelect} from '../test/select';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetHardwareInfo: vi.fn(), SetHardwareEnabled: vi.fn(), SelectHardwarePage: vi.fn(), SetHardwareImages: vi.fn(),
}));
vi.mock('../lib/hardwareImages', () => ({hardwareImages: vi.fn()}));

const config: DeckConfig = {
  server: {port: 8754}, integrations: {obs: {enabled: false, host: 'localhost', port: 4455, password: ''}},
  pages: [
    {id: 'home', name: 'Principal', grid: {rows: 3, cols: 5}, buttons: []},
    {id: 'other', name: 'Outra', grid: {rows: 4, cols: 6}, buttons: []},
  ],
};
const state = {supported: true, enabled: true, connected: true, path: '/dev/hidraw12', pageId: 'home', revision: 3, error: '', actionError: ''};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(App.GetHardwareInfo).mockResolvedValue(state as any);
  vi.mocked(App.SetHardwareEnabled).mockResolvedValue();
  vi.mocked(App.SelectHardwarePage).mockResolvedValue();
  vi.mocked(App.SetHardwareImages).mockResolvedValue();
  vi.mocked(hardwareImages).mockResolvedValue({key: 'data:image/jpeg;base64,teste'});
});

it('mostra conexão e envia as imagens com a revisão atual', async () => {
  render(<HardwarePanel config={config} />);
  expect(await screen.findByText('Connected')).toBeInTheDocument();
  await waitFor(() => expect(App.SetHardwareImages).toHaveBeenCalledWith(3, {key: 'data:image/jpeg;base64,teste'}));
  expect(screen.getByLabelText('Hardware page')).toHaveTextContent('Principal');
});

it('permite liberar USB, escolher página e voltar ao início', async () => {
  render(<HardwarePanel config={config} />);
  fireEvent.click(await screen.findByRole('checkbox'));
  expect(App.SetHardwareEnabled).toHaveBeenCalledWith(false);
  chooseSelect(screen.getByLabelText('Hardware page'), 'other');
  expect(App.SelectHardwarePage).toHaveBeenCalledWith('other');
  fireEvent.click(screen.getByText('Home'));
  expect(App.SelectHardwarePage).toHaveBeenLastCalledWith('home');
});

it('avisa sobre recorte e mostra falha de execução', async () => {
  vi.mocked(App.GetHardwareInfo).mockResolvedValue({...state, pageId: 'other', actionError: 'sem acesso a uinput'} as any);
  render(<HardwarePanel config={config} />);
  expect(await screen.findByText(/first 3 rows and 5 columns/)).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('sem acesso a uinput');
});

it('não renderiza nem converte imagens em plataformas sem suporte', async () => {
  vi.mocked(App.GetHardwareInfo).mockResolvedValue({...state, supported: false} as any);
  const {container} = render(<HardwarePanel config={config} />);
  await waitFor(() => expect(App.GetHardwareInfo).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
  expect(hardwareImages).not.toHaveBeenCalled();
});

it('descarta renderização antiga após uma nova configuração', async () => {
  let finish!: (value: Record<string, string>) => void;
  vi.mocked(hardwareImages).mockImplementationOnce(() => new Promise<Record<string, string>>((resolve) => { finish = resolve; }));
  const {rerender} = render(<HardwarePanel config={config} />);
  await waitFor(() => expect(hardwareImages).toHaveBeenCalledTimes(1));
  rerender(<HardwarePanel config={{...config, language: 'en'}} />);
  await waitFor(() => expect(App.SetHardwareImages).toHaveBeenCalledTimes(1));
  finish({old: 'antiga'});
  await Promise.resolve();
  expect(App.SetHardwareImages).toHaveBeenCalledTimes(1);
});
