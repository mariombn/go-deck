import {ButtonConfig} from '../types';
import {comboLabel} from '../lib/keys';

interface Props {
  button: ButtonConfig | null;
  mode: 'mobile' | 'desktop';
  flash?: 'ok' | 'err' | null;
  onClick?: () => void;
}

// DeckButton renderiza uma célula do grid (tanto no editor desktop quanto no
// celular). Célula vazia: no desktop vira um alvo "+" para criar botão; no
// celular fica inerte.
export default function DeckButton({button, mode, flash, onClick}: Props) {
  const base =
    'aspect-square rounded-2xl flex flex-col items-center justify-center p-2 text-center select-none transition';

  if (!button) {
    if (mode === 'desktop') {
      return (
        <button
          onClick={onClick}
          className={`${base} border-2 border-dashed border-slate-700 text-slate-600 hover:border-indigo-500 hover:text-indigo-400`}
        >
          <span className="text-2xl leading-none">+</span>
        </button>
      );
    }
    return <div className={`${base} border border-slate-800/60`} />;
  }

  const flashClass =
    flash === 'ok'
      ? 'ring-4 ring-green-400 bg-green-600'
      : flash === 'err'
      ? 'ring-4 ring-red-400 bg-red-600'
      : 'bg-slate-700 hover:bg-slate-600 active:scale-95';

  return (
    <button
      onClick={onClick}
      className={`${base} ${flashClass} shadow-md`}
    >
      <span className="text-base font-semibold leading-tight text-white line-clamp-2">
        {button.label || '(sem nome)'}
      </span>
      <span className="mt-1 text-[10px] font-mono text-slate-300/80 line-clamp-1">
        {comboLabel(button.action.keys)}
      </span>
    </button>
  );
}
