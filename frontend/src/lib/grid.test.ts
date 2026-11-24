import {moveButton} from './grid';
import {Page} from '../types';

function page(): Page {
  return {id: 'page', name: 'Deck', grid: {rows: 2, cols: 3}, buttons: [
    {id: '', label: 'Novo', hideLabel: true, icon: '🎵', position: {row: 0, col: 0}, action: {type: 'keypress', keys: ['a']}},
    {id: 'mouse', label: 'Mouse', position: {row: 1, col: 2}, action: {type: 'mouse', mouseOp: 'click', mouseButton: 'left'}},
  ]};
}

it('move para célula vazia sem perder ação/aparência nem alterar o original', () => {
  const original = page();
  const moved = moveButton(original, {row: 0, col: 0}, {row: 0, col: 1});
  expect(moved.buttons).toHaveLength(2);
  expect(moved.buttons[0]).toEqual({...original.buttons[0], position: {row: 0, col: 1}});
  expect(original.buttons[0].position).toEqual({row: 0, col: 0});
});

it('troca com uma ação existente, inclusive quando o botão novo ainda não tem ID', () => {
  const original = page();
  const moved = moveButton(original, {row: 0, col: 0}, {row: 1, col: 2});
  expect(moved.buttons[0].position).toEqual({row: 1, col: 2});
  expect(moved.buttons[1]).toEqual({...original.buttons[1], position: {row: 0, col: 0}});
});

it('ignora origem vazia, mesma célula e coordenadas fora do grid', () => {
  const original = page();
  expect(moveButton(original, {row: 0, col: 0}, {row: 0, col: 0})).toBe(original);
  expect(moveButton(original, {row: 0, col: 1}, {row: 0, col: 0})).toBe(original);
  expect(moveButton(original, {row: 0, col: 0}, {row: 3, col: 0})).toBe(original);
  expect(moveButton(original, {row: 0, col: 0}, {row: -1, col: 0})).toBe(original);
});
