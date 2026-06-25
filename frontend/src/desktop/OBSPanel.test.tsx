// Testes de componente do OBSPanel (Vitest + Testing Library).
//
// i18n real inicia em inglês — consultamos por textos em inglês.
//
// O binding Wails App.TestOBS é mockado via vi.mock do módulo gerado, para
// controlarmos resolve/reject e checar o feedback de UI.

import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {vi} from 'vitest';
import type {OBSConfig} from '../types';
import type {default as OBSPanelType} from './OBSPanel';

// Caminho relativo igual ao usado pelo componente ('../../wailsjs/go/main/App').
// vi.fn na linha 0.34 do Vitest usa a forma <Args extends any[], Return>.
const testOBSMock = vi.fn<[OBSConfig], Promise<void>>();
vi.mock('../../wailsjs/go/main/App', () => ({
  TestOBS: (c: OBSConfig) => testOBSMock(c),
}));

let OBSPanel: typeof OBSPanelType;
beforeAll(async () => {
  await import('../lib/i18n');
  OBSPanel = (await import('./OBSPanel')).default;
});

const baseConfig: OBSConfig = {enabled: true, host: '127.0.0.1', port: 4455, password: 'segredo'};

// renderControlled monta um OBSPanel controlado e reflete o onChange no value,
// expondo o estado num data-testid.
function renderControlled(initial: OBSConfig) {
  function Harness() {
    const [obs, setObs] = useState<OBSConfig>(initial);
    return (
      <div>
        <OBSPanel value={obs} onChange={setObs} />
        <div data-testid="obs-state">{JSON.stringify(obs)}</div>
      </div>
    );
  }
  return render(<Harness />);
}

beforeEach(() => {
  testOBSMock.mockReset();
});

describe('OBSPanel', () => {
  it('renderiza o título e os campos da conexão', () => {
    render(<OBSPanel value={baseConfig} onChange={() => {}} />);
    expect(screen.getByText('OBS Studio')).toBeInTheDocument();
    expect(screen.getByDisplayValue('127.0.0.1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4455')).toBeInTheDocument();
  });

  it('marca/desmarca a integração via checkbox (onChange.enabled)', async () => {
    const user = userEvent.setup();
    renderControlled(baseConfig);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    await user.click(checkbox);

    expect(screen.getByTestId('obs-state')).toHaveTextContent('"enabled":false');
  });

  it('desabilita os campos e o botão de teste quando a integração está off', () => {
    render(<OBSPanel value={{...baseConfig, enabled: false}} onChange={() => {}} />);
    expect(screen.getByDisplayValue('127.0.0.1')).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Test connection'})).toBeDisabled();
  });

  it('propaga edição do host pelo onChange', async () => {
    const user = userEvent.setup();
    renderControlled(baseConfig);

    const host = screen.getByDisplayValue('127.0.0.1');
    await user.clear(host);
    await user.type(host, '192.168.0.10');

    expect(screen.getByTestId('obs-state')).toHaveTextContent('"host":"192.168.0.10"');
  });

  it('mostra "Connected ✓" quando o teste resolve', async () => {
    const user = userEvent.setup();
    testOBSMock.mockResolvedValue(undefined);
    render(<OBSPanel value={baseConfig} onChange={() => {}} />);

    await user.click(screen.getByRole('button', {name: 'Test connection'}));

    await waitFor(() => expect(screen.getByText('Connected ✓')).toBeInTheDocument());
    expect(testOBSMock).toHaveBeenCalledWith(baseConfig);
  });

  it('mostra a mensagem de erro quando o teste rejeita', async () => {
    const user = userEvent.setup();
    testOBSMock.mockRejectedValue('connection refused');
    render(<OBSPanel value={baseConfig} onChange={() => {}} />);

    await user.click(screen.getByRole('button', {name: 'Test connection'}));

    await waitFor(() => expect(screen.getByText('connection refused')).toBeInTheDocument());
  });

  it('exibe "Testing…" e desabilita o botão enquanto o teste está em andamento', async () => {
    const user = userEvent.setup();
    // Promise controlada manualmente para observar o estado intermediário.
    let resolveFn: () => void = () => {};
    testOBSMock.mockReturnValue(
      new Promise<void>((res) => {
        resolveFn = res;
      }),
    );
    render(<OBSPanel value={baseConfig} onChange={() => {}} />);

    await user.click(screen.getByRole('button', {name: 'Test connection'}));

    // Durante o teste: botão vira "Testing…" e fica desabilitado.
    const testingBtn = await screen.findByRole('button', {name: 'Testing…'});
    expect(testingBtn).toBeDisabled();

    // Conclui o teste e o botão volta ao normal.
    resolveFn();
    await waitFor(() => expect(screen.getByRole('button', {name: 'Test connection'})).toBeInTheDocument());
  });
});
