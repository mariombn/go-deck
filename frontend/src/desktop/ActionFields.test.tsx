// Testes de comportamento do ActionFields: troca de tipo de ação, composição
// da Spec via onChange e validações de UI (isActionValid). Em pt-BR.
//
// Estratégia de i18n: inicializamos o i18n REAL (import de '../lib/i18n') e
// consultamos os textos em inglês (idioma default 'en'). Isso evita stubar o
// react-i18next e exercita a composição real de rótulos. O KeyCapture é
// stubado por um input leve que expõe um callback simples para setar as teclas
// — assim conseguimos disparar onChange({keys}) sem simular eventos de teclado.

import {render, screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../lib/i18n';
import ActionFields, {emptyAction, isActionValid} from './ActionFields';
import {Action} from '../types';

// Stub do KeyCapture: um botão que injeta um combo fixo e mostra o valor atual.
// Mantém o ActionFields desacoplado da captura real de teclado. Usamos
// React.createElement (e não JSX) dentro do factory do vi.mock.
vi.mock('./KeyCapture', async () => {
  const React = await import('react');
  return {
    default: ({value, onChange}: {value: string[]; onChange: (k: string[]) => void}) =>
      React.createElement('div', null, [
        React.createElement('span', {key: 'v', 'data-testid': 'kc-value'}, value.join('+')),
        React.createElement(
          'button',
          {key: 'b', type: 'button', onClick: () => onChange(['ctrl', 'm'])},
          'set-combo',
        ),
      ]),
  };
});

// Helper: renderiza ActionFields controlado, capturando o último valor emitido.
function setup(initial: Action, extra: Partial<React.ComponentProps<typeof ActionFields>> = {}) {
  const onChange = vi.fn();
  let current = initial;
  const utils = render(<ActionFields value={current} onChange={onChange} {...extra} />);
  const rerenderWith = (a: Action) => {
    current = a;
    utils.rerender(<ActionFields value={current} onChange={onChange} {...extra} />);
  };
  return {onChange, rerenderWith, ...utils};
}

describe('ActionFields — seletor de tipo', () => {
  it('lista todos os 7 tipos quando allowSequence é true (default)', () => {
    setup(emptyAction('keypress'));
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const valores = Array.from(select.options).map((o) => o.value);
    expect(valores).toEqual(['keypress', 'launch', 'url', 'obs', 'discord', 'navigate', 'sequence']);
  });

  it('omite sequence e navigate quando allowSequence é false (passo de sequência)', () => {
    setup(emptyAction('keypress'), {allowSequence: false});
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const valores = Array.from(select.options).map((o) => o.value);
    expect(valores).not.toContain('sequence');
    expect(valores).not.toContain('navigate');
    expect(valores).toEqual(['keypress', 'launch', 'url', 'obs', 'discord']);
  });

  it('trocar o tipo emite uma ação em branco do novo tipo', async () => {
    const {onChange} = setup(emptyAction('keypress'));
    fireEvent.change(screen.getByRole('combobox'), {target: {value: 'url'}});
    expect(onChange).toHaveBeenCalledWith({type: 'url', url: ''});
  });
});

describe('ActionFields — campos por tipo', () => {
  it('keypress: mostra o KeyCapture e o campo de hold; compõe keys + holdMs', async () => {
    const {onChange, rerenderWith} = setup(emptyAction('keypress'));
    // Definir combo via stub do KeyCapture.
    fireEvent.click(screen.getByText('set-combo'));
    expect(onChange).toHaveBeenLastCalledWith({type: 'keypress', keys: ['ctrl', 'm'], holdMs: 0});

    // Hold em segundos -> milissegundos arredondados.
    rerenderWith({type: 'keypress', keys: ['ctrl', 'm'], holdMs: 0});
    const hold = screen.getByRole('spinbutton');
    fireEvent.change(hold, {target: {value: '1.5'}});
    expect(onChange).toHaveBeenLastCalledWith({type: 'keypress', keys: ['ctrl', 'm'], holdMs: 1500});
  });

  it('keypress: hold acima do máximo (5s) é limitado a 5000ms', () => {
    const {onChange} = setup({type: 'keypress', keys: ['a'], holdMs: 0});
    fireEvent.change(screen.getByRole('spinbutton'), {target: {value: '99'}});
    expect(onChange).toHaveBeenLastCalledWith({type: 'keypress', keys: ['a'], holdMs: 5000});
  });

  it('launch: edita path e converte o textarea de args em array (uma linha por arg)', () => {
    const {onChange, rerenderWith} = setup(emptyAction('launch'));
    const inputs = screen.getAllByRole('textbox');
    // O primeiro textbox é o path (input), o segundo é o textarea de args.
    fireEvent.change(inputs[0], {target: {value: 'C:\\app.exe'}});
    expect(onChange).toHaveBeenLastCalledWith({type: 'launch', path: 'C:\\app.exe', args: []});

    rerenderWith({type: 'launch', path: 'C:\\app.exe', args: []});
    const textarea = screen.getAllByRole('textbox')[1];
    fireEvent.change(textarea, {target: {value: 'arquivo.txt\n  --flag  \n\n'}});
    // Linhas vazias somem; espaços são aparados.
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'launch',
      path: 'C:\\app.exe',
      args: ['arquivo.txt', '--flag'],
    });
  });

  it('url: emite uma ação url limpa ao digitar', async () => {
    const {onChange} = setup(emptyAction('url'));
    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(onChange).toHaveBeenLastCalledWith({type: 'url', url: 'x'});
  });

  it('obs: operação "scene" exige alvo; emite obsOp + target', () => {
    const {onChange, rerenderWith} = setup(emptyAction('obs'));
    // Default é scene, então o campo de alvo aparece.
    const target = screen.getByRole('textbox');
    fireEvent.change(target, {target: {value: 'Cena 1'}});
    expect(onChange).toHaveBeenLastCalledWith({type: 'obs', obsOp: 'scene', target: 'Cena 1'});

    // Há 2 comboboxes: [0] = tipo da ação, [1] = operação OBS.
    rerenderWith({type: 'obs', obsOp: 'scene', target: 'Cena 1'});
    const opSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(opSelect, {target: {value: 'toggle_record'}});
    expect(onChange).toHaveBeenLastCalledWith({type: 'obs', obsOp: 'toggle_record', target: 'Cena 1'});
  });

  it('obs: toggle_record não renderiza campo de alvo', () => {
    setup({type: 'obs', obsOp: 'toggle_record', target: ''});
    // Só há o combobox de operação; nenhum textbox de alvo.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('discord: tem o seletor de op e o KeyCapture; compõe discordOp + keys', () => {
    const {onChange} = setup(emptyAction('discord'));
    fireEvent.click(screen.getByText('set-combo'));
    expect(onChange).toHaveBeenLastCalledWith({type: 'discord', discordOp: 'mute', keys: ['ctrl', 'm']});
  });

  it('navigate: lista as páginas recebidas e emite targetPage selecionado', () => {
    const pages = [
      {id: 'p1', name: 'Principal'},
      {id: 'p2', name: 'Cenas'},
    ];
    const {onChange} = setup(emptyAction('navigate'), {pages});
    // Há 2 comboboxes: [0] = tipo da ação, [1] = página alvo.
    const select = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    // Opção placeholder + 2 páginas.
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'p1', 'p2']);
    expect(screen.getByText('Cenas')).toBeInTheDocument();
    fireEvent.change(select, {target: {value: 'p2'}});
    expect(onChange).toHaveBeenLastCalledWith({type: 'navigate', targetPage: 'p2'});
  });

  it('sequence: adiciona, reordena e remove passos', () => {
    const {onChange, rerenderWith} = setup(emptyAction('sequence'));
    // Adiciona o 1º passo (keypress em branco).
    fireEvent.click(screen.getByText('+ Add step'));
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'sequence',
      steps: [{type: 'keypress', keys: [], holdMs: 0}],
    });

    // Com dois passos, testa reordenar e remover.
    const dois: Action = {
      type: 'sequence',
      steps: [
        {type: 'url', url: 'a'},
        {type: 'url', url: 'b'},
      ],
    };
    rerenderWith(dois);
    // Mover o 1º passo para baixo inverte a ordem (cada passo tem seu botão).
    fireEvent.click(screen.getAllByTitle('Move down')[0]);
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'sequence',
      steps: [
        {type: 'url', url: 'b'},
        {type: 'url', url: 'a'},
      ],
    });

    rerenderWith(dois);
    // Remover o 1º deixa só o segundo.
    fireEvent.click(screen.getAllByTitle('Remove step')[0]);
    expect(onChange).toHaveBeenLastCalledWith({type: 'sequence', steps: [{type: 'url', url: 'b'}]});
  });

  it('sequence: passos usam ActionFields sem a opção sequence (sem aninhamento na UI)', () => {
    setup({type: 'sequence', steps: [{type: 'url', url: ''}]});
    // Comboboxes: [0] = tipo da ação raiz (oferece "sequence"); os demais são os
    // seletores de tipo de cada passo, que NÃO podem oferecer "sequence".
    const combos = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const stepCombos = combos.slice(1);
    expect(stepCombos.length).toBeGreaterThan(0);
    for (const c of stepCombos) {
      const valores = Array.from(c.options).map((o) => o.value);
      expect(valores).not.toContain('sequence');
    }
  });
});

describe('emptyAction / isActionValid', () => {
  it('emptyAction devolve a forma certa por tipo', () => {
    expect(emptyAction('keypress')).toEqual({type: 'keypress', keys: [], holdMs: 0});
    expect(emptyAction('launch')).toEqual({type: 'launch', path: '', args: []});
    expect(emptyAction('url')).toEqual({type: 'url', url: ''});
    expect(emptyAction('obs')).toEqual({type: 'obs', obsOp: 'scene', target: ''});
    expect(emptyAction('discord')).toEqual({type: 'discord', discordOp: 'mute', keys: []});
    expect(emptyAction('navigate')).toEqual({type: 'navigate', targetPage: ''});
    expect(emptyAction('sequence')).toEqual({type: 'sequence', steps: []});
  });

  it('isActionValid espelha as regras do backend', () => {
    expect(isActionValid({type: 'keypress', keys: [], holdMs: 0})).toBe(false);
    expect(isActionValid({type: 'keypress', keys: ['a'], holdMs: 0})).toBe(true);
    expect(isActionValid({type: 'keypress', keys: ['a'], holdMs: 6000})).toBe(false);
    expect(isActionValid({type: 'launch', path: '   '})).toBe(false);
    expect(isActionValid({type: 'launch', path: '/bin/x'})).toBe(true);
    expect(isActionValid({type: 'url', url: ''})).toBe(false);
    expect(isActionValid({type: 'obs', obsOp: 'scene', target: ''})).toBe(false);
    expect(isActionValid({type: 'obs', obsOp: 'toggle_record'})).toBe(true);
    expect(isActionValid({type: 'discord', discordOp: 'mute', keys: []})).toBe(false);
    expect(isActionValid({type: 'navigate', targetPage: ''})).toBe(false);
    expect(isActionValid({type: 'sequence', steps: []})).toBe(false);
    expect(isActionValid({type: 'sequence', steps: [{type: 'url', url: 'x'}]})).toBe(true);
    expect(isActionValid({type: 'sequence', steps: [{type: 'url', url: ''}]})).toBe(false);
  });
});
