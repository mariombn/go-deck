// Testes do DeckGrid: quantidade de células (linhas×colunas), posicionamento
// dos botões, repasse do clique com (row,col,button), transpose e guardas
// defensivas para grid/botões ausentes.

import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Inicializa o i18n (DeckGrid renderiza DeckButton, que usa useTranslation).
import '../lib/i18n';
import {ButtonConfig, Page} from '../types';
import DeckGrid from './DeckGrid';

function botao(id: string, row: number, col: number, label: string): ButtonConfig {
  return {
    id,
    label,
    position: {row, col},
    action: {type: 'keypress', keys: ['a']},
  };
}

function pagina(over: Partial<Page> = {}): Page {
  return {
    id: 'p1',
    name: 'Principal',
    grid: {rows: 2, cols: 3},
    buttons: [],
    ...over,
  };
}

// Conta só as células-botão (no mobile, células vazias são <div>, não <button>).
function botoes(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

describe('DeckGrid', () => {
  it('renderiza linhas×colunas células (desktop: vazias viram alvos "+")', () => {
    const {container} = render(<DeckGrid page={pagina({grid: {rows: 2, cols: 3}})} mode="desktop" />);
    // 2*3 = 6 células, todas botões "+" no desktop quando não há botões.
    expect(botoes(container)).toHaveLength(6);
  });

  it('aplica o template de grid conforme rows/cols', () => {
    const {container} = render(<DeckGrid page={pagina({grid: {rows: 2, cols: 4}})} mode="desktop" />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(grid.style.gridTemplateRows).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('posiciona o botão na célula correta', () => {
    const page = pagina({
      grid: {rows: 1, cols: 2},
      buttons: [botao('b1', 0, 1, 'Direita')],
    });
    render(<DeckGrid page={page} mode="mobile" />);
    // No mobile só há 1 botão (a outra célula é div vazia).
    expect(screen.getByText('Direita')).toBeInTheDocument();
  });

  it('repassa o clique com (row, col, button)', async () => {
    const onCellClick = vi.fn();
    const b = botao('b1', 0, 1, 'Alvo');
    const page = pagina({grid: {rows: 1, cols: 2}, buttons: [b]});
    render(<DeckGrid page={page} mode="mobile" onCellClick={onCellClick} />);
    await userEvent.click(screen.getByText('Alvo'));
    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick).toHaveBeenCalledWith(0, 1, b);
  });

  it('clique numa célula vazia (desktop) repassa button null com a posição', async () => {
    const onCellClick = vi.fn();
    const page = pagina({grid: {rows: 1, cols: 2}, buttons: []});
    const {container} = render(<DeckGrid page={page} mode="desktop" onCellClick={onCellClick} />);
    const cells = botoes(container);
    // Segunda célula = (row 0, col 1).
    await userEvent.click(cells[1]);
    expect(onCellClick).toHaveBeenCalledWith(0, 1, null);
  });

  it('transpose troca linhas por colunas no template (NxM -> MxN)', () => {
    const {container} = render(
      <DeckGrid page={pagina({grid: {rows: 2, cols: 3}})} mode="mobile" transpose />,
    );
    const grid = container.firstElementChild as HTMLElement;
    // displayCols = rows (2), displayRows = cols (3).
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(grid.style.gridTemplateRows).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('transpose mantém a posição canônica do botão ao clicar', async () => {
    const onCellClick = vi.fn();
    const b = botao('b1', 0, 2, 'Canto');
    const page = pagina({grid: {rows: 1, cols: 3}, buttons: [b]});
    render(<DeckGrid page={page} mode="mobile" transpose onCellClick={onCellClick} />);
    await userEvent.click(screen.getByText('Canto'));
    // A posição reportada é a canônica (0,2), não a exibida.
    expect(onCellClick).toHaveBeenCalledWith(0, 2, b);
  });

  it('aplica flash por id de botão', () => {
    const b = botao('b1', 0, 0, 'Flash');
    const page = pagina({grid: {rows: 1, cols: 1}, buttons: [b]});
    const {container} = render(<DeckGrid page={page} mode="mobile" flash={{b1: 'ok'}} />);
    const btn = container.querySelector('button')!;
    // flash "ok" injeta as classes ring-green/bg-green.
    expect(btn.className).toMatch(/bg-green-600/);
  });

  describe('guardas defensivas', () => {
    it('grid vazio (0x0) não renderiza célula alguma', () => {
      const {container} = render(<DeckGrid page={pagina({grid: {rows: 0, cols: 0}})} mode="desktop" />);
      expect(botoes(container)).toHaveLength(0);
    });

    it('buttons ausente (undefined) é tratado como lista vazia (?? [])', () => {
      // Simula config vindo do backend sem o campo buttons.
      const page = {...pagina({grid: {rows: 1, cols: 2}}), buttons: undefined} as unknown as Page;
      const {container} = render(<DeckGrid page={page} mode="desktop" />);
      // Não estoura; ainda renderiza as 2 células vazias.
      expect(botoes(container)).toHaveLength(2);
    });
  });
});
