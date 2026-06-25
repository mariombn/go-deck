// Testes de comportamento do ButtonEditor: edita label/ação/aparência, compõe
// os sub-editores (ActionFields + AppearanceFields + preview DeckButton) e
// salva/cancela/exclui. Em pt-BR.
//
// i18n real (en). Mocks: KeyCapture (combo fixo), emoji-picker-react (leve),
// e os bindings Wails usados pelo AppearanceFields (ListInstalledApps/PickAppIcon).

import {render, screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../lib/i18n';
import ButtonEditor from './ButtonEditor';
import {ButtonConfig} from '../types';

vi.mock('./KeyCapture', () => ({
  default: ({value, onChange}: {value: string[]; onChange: (k: string[]) => void}) => (
    <div>
      <span data-testid="kc-value">{value.join('+')}</span>
      <button type="button" onClick={() => onChange(['ctrl', 'shift', 'm'])}>
        set-combo
      </button>
    </div>
  ),
}));

vi.mock('emoji-picker-react', () => ({
  EmojiStyle: {NATIVE: 'native'},
  default: ({onEmojiClick}: {onEmojiClick: (e: {emoji: string}) => void}) => (
    <button type="button" onClick={() => onEmojiClick({emoji: '🎮'})}>
      pick-emoji
    </button>
  ),
}));

vi.mock('../../wailsjs/go/main/App', () => ({
  ListInstalledApps: vi.fn(async () => []),
  PickAppIcon: vi.fn(async () => ''),
}));

const baseDraft = (over: Partial<ButtonConfig> = {}): ButtonConfig => ({
  id: 'b1',
  label: 'Antigo',
  position: {row: 0, col: 1},
  action: {type: 'keypress', keys: ['a'], holdMs: 0},
  ...over,
});

function setup(over: Partial<React.ComponentProps<typeof ButtonEditor>> = {}) {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onCancel = vi.fn();
  const draft = over.draft ?? baseDraft();
  const utils = render(
    <ButtonEditor
      draft={draft}
      isNew={false}
      pages={[{id: 'b1page', name: 'Principal'}]}
      onSave={onSave}
      onDelete={onDelete}
      onCancel={onCancel}
      {...over}
    />,
  );
  return {onSave, onDelete, onCancel, ...utils};
}

describe('ButtonEditor — composição e salvar', () => {
  it('mostra o título de edição e a posição (linha/coluna)', () => {
    setup();
    expect(screen.getByText('Edit button')).toBeInTheDocument();
    expect(screen.getByText(/row 0/)).toBeInTheDocument();
    expect(screen.getByText(/column 1/)).toBeInTheDocument();
  });

  it('salva label (aparado) + ação + aparência compostos', async () => {
    const {onSave} = setup({draft: baseDraft({label: 'Antigo', icon: undefined, color: undefined})});

    const labelInput = screen.getByPlaceholderText('E.g.: Mute Mic');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, '  Novo Rotulo  ');

    // Trocar a ação via KeyCapture stub.
    fireEvent.click(screen.getByText('set-combo'));

    // Escolher uma cor de fundo.
    fireEvent.click(screen.getByTitle('#dc2626'));

    fireEvent.click(screen.getByText('Save button'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as ButtonConfig;
    expect(saved.id).toBe('b1');
    expect(saved.label).toBe('Novo Rotulo'); // trim aplicado
    expect(saved.action).toEqual({type: 'keypress', keys: ['ctrl', 'shift', 'm'], holdMs: 0});
    expect(saved.color).toBe('#dc2626');
  });

  it('icon/color vazios viram undefined no save', () => {
    const {onSave} = setup({draft: baseDraft({label: 'X', icon: '', color: ''})});
    fireEvent.click(screen.getByText('Save button'));
    const saved = onSave.mock.calls[0][0] as ButtonConfig;
    expect(saved.icon).toBeUndefined();
    expect(saved.color).toBeUndefined();
  });

  it('botão Salvar fica desabilitado quando a ação é inválida', () => {
    setup({draft: baseDraft({action: {type: 'keypress', keys: []}})});
    expect(screen.getByText('Save button')).toBeDisabled();
  });

  it('botão Salvar habilita ao corrigir a ação (define um combo)', () => {
    setup({draft: baseDraft({action: {type: 'keypress', keys: []}})});
    expect(screen.getByText('Save button')).toBeDisabled();
    fireEvent.click(screen.getByText('set-combo'));
    expect(screen.getByText('Save button')).toBeEnabled();
  });
});

describe('ButtonEditor — cancelar / excluir', () => {
  it('cancelar chama onCancel', () => {
    const {onCancel} = setup();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('excluir aparece só quando não é novo e chama onDelete', () => {
    const {onDelete} = setup({isNew: false});
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('novo botão não mostra o Delete e usa o título de criação', () => {
    setup({isNew: true});
    expect(screen.getByText('New button')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).toBeNull();
  });
});

describe('ButtonEditor — preview', () => {
  it('o preview (DeckButton desktop) reflete o label digitado', async () => {
    setup({draft: baseDraft({label: ''})});
    const labelInput = screen.getByPlaceholderText('E.g.: Mute Mic');
    await userEvent.type(labelInput, 'Preview!');
    // O preview compartilha o DeckButton; o texto aparece na árvore.
    expect(screen.getAllByText('Preview!').length).toBeGreaterThan(0);
  });
});
