import {useState} from 'react';
import {Action, ButtonConfig} from '../types';
import ActionFields, {isActionValid} from './ActionFields';

interface Props {
  draft: ButtonConfig;
  isNew: boolean;
  onSave: (button: ButtonConfig) => void;
  onDelete: () => void;
  onCancel: () => void;
}

// ButtonEditor é o modal de criação/edição de um botão (label + ação). A
// ação pode ser de qualquer tipo (keypress, launch, url, sequence) via
// ActionFields.
export default function ButtonEditor({draft, isNew, onSave, onDelete, onCancel}: Props) {
  const [label, setLabel] = useState(draft.label);
  const [action, setAction] = useState<Action>(draft.action);

  const save = () => {
    onSave({...draft, label: label.trim(), action});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold">
          {isNew ? 'Novo botão' : 'Editar botão'}
          <span className="ml-2 text-xs font-normal text-slate-500">
            linha {draft.position.row} · coluna {draft.position.col}
          </span>
        </h2>

        <label className="mb-1 block text-sm text-slate-400">Rótulo</label>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex.: Mute Mic"
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
        />

        <ActionFields value={action} onChange={setAction} />

        <div className="mt-6 flex items-center justify-between">
          {!isNew ? (
            <button
              onClick={onDelete}
              className="rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={!isActionValid(action)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-40"
            >
              Salvar botão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
