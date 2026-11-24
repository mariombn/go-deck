import {Page, Position} from '../types';

const same = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

// Só muda posições: preserva IDs, ação e aparência, inclusive em botões novos
// ainda sem ID. O destino ocupado troca com a origem, nunca perde uma ação.
export function moveButton(page: Page, from: Position, to: Position): Page {
  const inside = (p: Position) => Number.isInteger(p.row) && Number.isInteger(p.col) && p.row >= 0 && p.row < page.grid.rows && p.col >= 0 && p.col < page.grid.cols;
  const buttons = page.buttons ?? [];
  if (!inside(from) || !inside(to) || same(from, to) || !buttons.some((button) => same(button.position, from))) return page;
  return {...page, buttons: buttons.map((button) => same(button.position, from) ? {...button, position: {...to}} : same(button.position, to) ? {...button, position: {...from}} : button)};
}
