import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import Select from './Select';

function Harness() {
  const [value, setValue] = useState('a');
  return <><Select aria-label="Destino" value={value} onChange={setValue} className="bg-slate-900">
    <option value="a">Alfa</option><option value="b">Beta</option><option value="c">Cena</option>
  </Select><span data-testid="value">{value}</span><button>Fora</button></>;
}

it('usa popup escuro próprio em portal, sem select nativo', () => {
  const {container} = render(<Harness />);
  expect(container.querySelector('select')).toBeNull();
  fireEvent.click(screen.getByRole('combobox'));
  const popup = screen.getByRole('listbox');
  expect(popup).toHaveClass('bg-slate-900', 'text-slate-100');
  expect(container.contains(popup)).toBe(false);
  fireEvent.mouseDown(screen.getByRole('option', {name: 'Beta'}));
  fireEvent.click(screen.getByRole('option', {name: 'Beta'}));
  expect(screen.getByTestId('value')).toHaveTextContent('b');
  expect(screen.queryByRole('listbox')).toBeNull();
});

it('permite teclado, busca por prefixo e Escape sem alterar seleção', () => {
  render(<Harness />);
  const control = screen.getByRole('combobox');
  fireEvent.keyDown(control, {key: 'ArrowDown'});
  fireEvent.keyDown(control, {key: 'End'});
  fireEvent.keyDown(control, {key: 'Enter'});
  expect(screen.getByTestId('value')).toHaveTextContent('c');
  fireEvent.keyDown(control, {key: 'b'});
  fireEvent.keyDown(control, {key: 'Enter'});
  expect(screen.getByTestId('value')).toHaveTextContent('b');
  fireEvent.click(control);
  fireEvent.keyDown(control, {key: 'Home'});
  fireEvent.keyDown(control, {key: 'Escape'});
  expect(screen.getByTestId('value')).toHaveTextContent('b');
  expect(control).toHaveAttribute('aria-expanded', 'false');
});

it('ignora rolagem interna de outro input, mas fecha ao rolar um ancestral', () => {
  render(<div data-testid="ancestor"><Harness /><input aria-label="Rótulo longo" /></div>);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.scroll(screen.getByLabelText('Rótulo longo'));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.scroll(screen.getByTestId('ancestor'));
  expect(screen.queryByRole('listbox')).toBeNull();
});

it('fecha ao clicar fora e não abre quando desabilitado', () => {
  const {rerender} = render(<Harness />);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.pointerDown(screen.getByText('Fora'));
  expect(screen.queryByRole('listbox')).toBeNull();
  rerender(<Select aria-label="Desabilitado" value="a" onChange={() => {}} disabled><option value="a">Alfa</option></Select>);
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByRole('listbox')).toBeNull();
});
