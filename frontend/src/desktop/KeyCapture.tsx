import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SPECIAL_KEYS, comboLabel, eventToCombo, modifierCodeToName} from '../lib/keys';
import VirtualKeyboard from './VirtualKeyboard';

interface Props {
  value: string[];
  onChange: (keys: string[]) => void;
  sequence?: string[][];
  onSequenceChange?: (steps: string[][]) => void;
}

// KeyCapture implementa o modo híbrido (decisão 4b/i+): captura ao vivo do
// combo pelo teclado + botões fixos para as teclas que o navegador não
// enxerga (Win e mídia).
export default function KeyCapture({value, onChange, sequence = [], onSequenceChange}: Props) {
  const {t} = useTranslation();
  const [capturing, setCapturing] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!capturing) return;
    // Modificadores pressionados (com o lado de Ctrl/Alt resolvido). Vão se
    // acumulando a cada keydown até a tecla principal fechar o combo.
    const pressed = new Set<string>();
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const mod = modifierCodeToName(e.code);
      if (mod) {
        pressed.add(mod); // ainda esperando a tecla principal
        return;
      }
      const combo = eventToCombo(e, pressed);
      if (combo) {
        onChange(combo);
        setCapturing(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const mod = modifierCodeToName(e.code);
      if (mod) pressed.delete(mod);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [capturing, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 break-words rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm">
          {capturing ? (
            <span className="animate-pulse text-indigo-400">{t('keyCapture.capturing')}</span>
          ) : (
            <span className="text-slate-200">{sequence.length ? sequence.map(comboLabel).join(' → ') : comboLabel(value)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCapturing((v) => !v)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            capturing ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {capturing ? t('keyCapture.cancel') : t('keyCapture.capture')}
        </button>
        <button type="button" aria-label={t('virtualKeyboard.title')} title={t('virtualKeyboard.title')}
          onClick={() => { setCapturing(false); setKeyboardOpen(true); }}
          className="shrink-0 rounded-lg bg-slate-700 p-2.5 hover:bg-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M5 9h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h2m2 0h2m2 0h2M7 15h10" />
          </svg>
        </button>
      </div>
      {keyboardOpen && <VirtualKeyboard keys={value} sequence={sequence} allowSequence={!!onSequenceChange}
        onApply={(keys, steps) => steps.length && onSequenceChange ? onSequenceChange(steps) : onChange(keys)}
        onClose={() => setKeyboardOpen(false)} />}

      <div>
        <p className="mb-1 text-xs text-slate-500">{t('keyCapture.specialKeys')}</p>
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
