import {useEffect, useState} from 'react';
import {SPECIAL_KEYS, comboLabel, eventToCombo} from '../lib/keys';

interface Props {
  value: string[];
  onChange: (keys: string[]) => void;
}

// KeyCapture implementa o modo híbrido (decisão 4b/i+): captura ao vivo do
// combo pelo teclado + botões fixos para as teclas que o navegador não
// enxerga (Win e mídia).
export default function KeyCapture({value, onChange}: Props) {
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const combo = eventToCombo(e);
      if (combo) {
        onChange(combo);
        setCapturing(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm">
          {capturing ? (
            <span className="animate-pulse text-indigo-400">aperte o combo…</span>
          ) : (
            <span className="text-slate-200">{comboLabel(value)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCapturing((v) => !v)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            capturing ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {capturing ? 'Cancelar' : 'Capturar'}
        </button>
      </div>

      <div>
        <p className="mb-1 text-xs text-slate-500">Teclas especiais (clique para definir):</p>
        <div className="flex flex-wrap gap-1.5">
          {SPECIAL_KEYS.map((k) => (
            <button
              key={k.name}
              type="button"
              onClick={() => onChange([k.name])}
              className="rounded-md bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
