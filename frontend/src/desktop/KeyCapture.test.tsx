// Testes de componente do KeyCapture (Vitest + Testing Library).
//
// Estratégia de i18n: importamos o i18n real, que inicializa em inglês
// (DEFAULT_LANG = 'en'). Assim consultamos por textos estáveis em inglês e por
// role, sem depender de mocks de tradução.

import {render, screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import type {default as KeyCaptureType} from './KeyCapture';

// Carregado dinamicamente após inicializar o i18n.
let KeyCapture: typeof KeyCaptureType;

beforeAll(async () => {
  await import('../lib/i18n');
  KeyCapture = (await import('./KeyCapture')).default;
});

// renderControlled monta um KeyCapture controlado e expõe o último combo
// reportado num data-testid.
function renderControlled(initial: string[] = []) {
  function Harness() {
    const [keys, setKeys] = useState<string[]>(initial);
    return (
      <div>
        <KeyCapture value={keys} onChange={setKeys} />
        <div data-testid="combo">{JSON.stringify(keys)}</div>
      </div>
    );
  }
  return render(<Harness />);
}

describe('KeyCapture', () => {
  it('exibe o rótulo do combo atual quando não está capturando', () => {
    render(<KeyCapture value={['ctrl', 'shift', 'm']} onChange={() => {}} />);
    // comboLabel: "Ctrl + Shift + M"
    expect(screen.getByText('Ctrl + Shift + M')).toBeInTheDocument();
  });

  it('mostra "—" quando o combo está vazio', () => {
    render(<KeyCapture value={[]} onChange={() => {}} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('entra e sai do modo de captura ao clicar no botão', async () => {
    const user = userEvent.setup();
    render(<KeyCapture value={[]} onChange={() => {}} />);

    const captureBtn = screen.getByRole('button', {name: 'Capture'});
    await user.click(captureBtn);

    // Em captura: aparece o aviso e o botão vira "Cancel".
    expect(screen.getByText('press the combo…')).toBeInTheDocument();
    const cancelBtn = screen.getByRole('button', {name: 'Cancel'});
    await user.click(cancelBtn);

    // Voltou ao normal.
    expect(screen.getByRole('button', {name: 'Capture'})).toBeInTheDocument();
  });

  it('captura uma tecla simples e reporta o combo, encerrando a captura', async () => {
    const user = userEvent.setup();
    renderControlled();

    await user.click(screen.getByRole('button', {name: 'Capture'}));

    // keydown da tecla "A" (code KeyA) na window — o listener da captura está
    // em useCapture=true na window.
    fireEvent.keyDown(window, {code: 'KeyA', key: 'a'});

    expect(screen.getByTestId('combo')).toHaveTextContent(JSON.stringify(['a']));
    // A captura encerra sozinha ao fechar o combo.
    expect(screen.getByRole('button', {name: 'Capture'})).toBeInTheDocument();
  });

  it('acumula modificador (keydown) e fecha o combo na tecla principal', async () => {
    const user = userEvent.setup();
    renderControlled();

    await user.click(screen.getByRole('button', {name: 'Capture'}));

    // Ctrl esquerdo é registrado como modificador (lctrl), sem fechar o combo.
    fireEvent.keyDown(window, {code: 'ControlLeft', key: 'Control'});
    expect(screen.getByText('press the combo…')).toBeInTheDocument();

    // Tecla principal "M" com ctrlKey verdadeiro fecha o combo.
    fireEvent.keyDown(window, {code: 'KeyM', key: 'm', ctrlKey: true});

    expect(screen.getByTestId('combo')).toHaveTextContent(JSON.stringify(['lctrl', 'm']));
  });

  it('não fecha o combo quando só um modificador é pressionado', async () => {
    const user = userEvent.setup();
    renderControlled();

    await user.click(screen.getByRole('button', {name: 'Capture'}));
    fireEvent.keyDown(window, {code: 'ShiftLeft', key: 'Shift'});

    // Continua capturando; nenhum combo reportado.
    expect(screen.getByText('press the combo…')).toBeInTheDocument();
    expect(screen.getByTestId('combo')).toHaveTextContent(JSON.stringify([]));
  });

  it('ignora keydown quando NÃO está em modo de captura', () => {
    renderControlled();
    // Sem clicar em "Capture": o listener não está registrado.
    fireEvent.keyDown(window, {code: 'KeyA', key: 'a'});
    expect(screen.getByTestId('combo')).toHaveTextContent(JSON.stringify([]));
  });

  it('define a tecla diretamente ao clicar num botão de tecla especial (Win)', async () => {
    const user = userEvent.setup();
    renderControlled();

    // SPECIAL_KEYS[0] = win, label "⊞ Win".
    await user.click(screen.getByRole('button', {name: '⊞ Win'}));
    expect(screen.getByTestId('combo')).toHaveTextContent(JSON.stringify(['win']));
  });

  it('renderiza todos os botões de teclas especiais', () => {
    render(<KeyCapture value={[]} onChange={() => {}} />);
    for (const label of ['⊞ Win', '🔇 Mute', '🔉 Vol-', '🔊 Vol+', '⏯ Play', '⏮ Prev', '⏭ Next']) {
      expect(screen.getByRole('button', {name: label})).toBeInTheDocument();
    }
  });
});
