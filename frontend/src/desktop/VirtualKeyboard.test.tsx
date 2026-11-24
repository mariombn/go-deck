import {fireEvent, render, screen, within} from '@testing-library/react';
import '../lib/i18n';
import KeyCapture from './KeyCapture';

it('abre pelo ícone de teclado e monta um combo sem usar teclado físico', () => {
  const change = vi.fn();
  render(<KeyCapture value={[]} onChange={change} />);
  fireEvent.click(screen.getByRole('button', {name: 'Virtual keyboard'}));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.click(dialog.getByRole('button', {name: 'Ctrl Esq'}));
  fireEvent.click(dialog.getByRole('button', {name: 'C'}));
  fireEvent.click(dialog.getByRole('button', {name: 'Apply keys'}));
  expect(change).toHaveBeenCalledWith(['lctrl', 'c']);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('reconhece Ctrl/Alt genéricos antigos sem adicionar o mesmo modificador duas vezes', () => {
  const change = vi.fn();
  render(<KeyCapture value={['ctrl', 'c']} onChange={change} />);
  fireEvent.click(screen.getByRole('button', {name: 'Virtual keyboard'}));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByRole('button', {name: 'Ctrl Esq'})).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(dialog.getByRole('button', {name: 'Ctrl Esq'}));
  fireEvent.click(dialog.getByText('Apply keys'));
  expect(change).toHaveBeenCalledWith(['c']);
});

it('monta sequência de combinações, repete teclas e muda a ordem', () => {
  const change = vi.fn(), sequence = vi.fn();
  render(<KeyCapture value={[]} onChange={change} onSequenceChange={sequence} />);
  fireEvent.click(screen.getByRole('button', {name: 'Virtual keyboard'}));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.click(dialog.getByRole('button', {name: 'Ordered sequence'}));
  fireEvent.click(dialog.getByRole('button', {name: 'A'}));
  fireEvent.click(dialog.getByText('+ Add combination to sequence'));
  fireEvent.click(dialog.getByRole('button', {name: 'A'}));
  fireEvent.click(dialog.getByText('+ Add combination to sequence'));
  fireEvent.click(dialog.getByRole('button', {name: 'B'}));
  fireEvent.click(dialog.getByText('+ Add combination to sequence'));
  fireEvent.click(dialog.getByLabelText('Move step 3 earlier'));
  fireEvent.click(dialog.getByText('Apply keys'));
  expect(sequence).toHaveBeenCalledWith([['a'], ['b'], ['a']]);
  expect(change).not.toHaveBeenCalled();
});

it('inclui combinação atual ao aplicar sequência e não aplica ao cancelar', () => {
  const sequence = vi.fn();
  render(<KeyCapture value={[]} sequence={[['ctrl', 'c']]} onChange={() => {}} onSequenceChange={sequence} />);
  fireEvent.click(screen.getByRole('button', {name: 'Virtual keyboard'}));
  let dialog = within(screen.getByRole('dialog'));
  fireEvent.click(dialog.getByRole('button', {name: 'Ctrl Esq'}));
  fireEvent.click(dialog.getByRole('button', {name: 'V'}));
  fireEvent.click(dialog.getByText('Apply keys'));
  expect(sequence).toHaveBeenCalledWith([['ctrl', 'c'], ['lctrl', 'v']]);
  sequence.mockClear();
  fireEvent.click(screen.getByRole('button', {name: 'Virtual keyboard'}));
  dialog = within(screen.getByRole('dialog'));
  fireEvent.keyDown(dialog.getByText('Virtual keyboard'), {key: 'Escape'});
  expect(sequence).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});
