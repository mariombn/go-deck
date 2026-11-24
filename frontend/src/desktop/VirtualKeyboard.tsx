import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {comboLabel, keyLabel} from '../lib/keys';

const aliases: Record<string, string> = {ctrl: 'lctrl', alt: 'lalt', opt: 'lalt', cmd: 'win'};
const canonical = (key: string) => aliases[key] ?? key;

const ROWS = [
  ['esc', ...Array.from({length: 12}, (_, index) => `f${index+1}`)],
  ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal', 'backspace'],
  ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'leftbracket', 'rightbracket', 'backslash'],
  ['capslock', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'apostrophe', 'enter'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash', 'up'],
  ['lctrl', 'win', 'lalt', 'space', 'ralt', 'rctrl', 'left', 'down', 'right'],
  ['insert', 'delete', 'home', 'end', 'pageup', 'pagedown', 'mute', 'voldown', 'volup', 'prevtrack', 'playpause', 'nexttrack'],
];

interface Props {
  keys: string[];
  sequence?: string[][];
  allowSequence: boolean;
  onApply: (keys: string[], sequence: string[][]) => void;
  onClose: () => void;
}

// Cada passo é um combo independente, não uma cadeia de modificadores que
// ficariam presos. Repetir um passo também permite repetir a mesma tecla.
export default function VirtualKeyboard({keys, sequence = [], allowSequence, onApply, onClose}: Props) {
  const {t} = useTranslation();
  const [mode, setMode] = useState<'combo' | 'sequence'>(sequence.length ? 'sequence' : 'combo');
  const [combo, setCombo] = useState<string[]>(sequence.length ? [] : [...keys]);
  const [steps, setSteps] = useState<string[][]>(sequence.map((step) => [...step]));
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => previous?.focus();
  }, []);
  const move = (index: number, offset: number) => {
    const next = [...steps], target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
  };
  const pending = mode === 'sequence' ? [...steps, ...(combo.length ? [combo] : [])] : [];
  const valid = mode === 'combo' ? combo.length > 0 : pending.length > 0 && pending.length <= 64;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={t('virtualKeyboard.title')}
      className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-4 text-slate-100 shadow-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const focusable = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
          const first = focusable[0], last = focusable[focusable.length-1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t('virtualKeyboard.title')}</h3>
        <button ref={close} type="button" aria-label={t('common.close')} onClick={onClose} className="rounded px-3 py-1 hover:bg-slate-700">✕</button>
      </div>
      {allowSequence && <div className="mb-2 flex gap-2">
        {(['combo', 'sequence'] as const).map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}
          className={`rounded-lg px-3 py-2 text-sm ${mode === item ? 'bg-indigo-600' : 'bg-slate-800'}`}>{t(`virtualKeyboard.${item}`)}</button>)}
      </div>}
      <p className="mb-3 text-xs text-slate-400">{t(mode === 'sequence' ? 'virtualKeyboard.sequenceHelp' : 'virtualKeyboard.comboHelp')}</p>
      <div className="mb-3 min-w-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm" aria-live="polite">
        <span className="text-slate-400">{t('virtualKeyboard.current')} </span>
        <span className="break-words font-mono">{comboLabel(combo)}</span>
        <button type="button" onClick={() => setCombo([])} className="ml-3 rounded px-2 py-1 text-slate-300 hover:bg-slate-700">{t('virtualKeyboard.clear')}</button>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[660px] space-y-1.5">
          {ROWS.map((row, index) => <div key={index} className="flex gap-1">
            {row.map((key) => <button key={key} type="button" aria-pressed={combo.some((value) => canonical(value) === key)}
              aria-label={keyLabel(key)} onClick={() => setCombo((current) => current.some((value) => canonical(value) === key) ? current.filter((value) => canonical(value) !== key) : [...current, key])}
              className={`min-h-[38px] min-w-[36px] rounded border px-2 py-1 text-xs ${key === 'space' ? 'flex-[4]' : 'flex-1'} ${combo.some((value) => canonical(value) === key) ? 'border-cyan-300 bg-indigo-600 text-white' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'}`}>{key === 'backspace' ? '⌫' : keyLabel(key)}</button>)}
          </div>)}
        </div>
      </div>
      {mode === 'sequence' && <div className="mt-3 space-y-2">
        <button type="button" disabled={!combo.length || steps.length >= 64} onClick={() => { setSteps([...steps, [...combo]]); setCombo([]); }}
          className="rounded-lg bg-slate-700 px-3 py-2 text-sm disabled:opacity-40">{t('virtualKeyboard.addStep')}</button>
        <ol className="max-h-44 space-y-1 overflow-y-auto">
          {steps.map((step, index) => <li key={index} className="flex items-center gap-2 rounded bg-slate-800 px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 break-words font-mono">{index+1}. {comboLabel(step)}</span>
            <button type="button" aria-label={t('virtualKeyboard.moveUp', {n: index+1})} disabled={index === 0} onClick={() => move(index, -1)} className="p-1 disabled:opacity-30">↑</button>
            <button type="button" aria-label={t('virtualKeyboard.moveDown', {n: index+1})} disabled={index === steps.length-1} onClick={() => move(index, 1)} className="p-1 disabled:opacity-30">↓</button>
            <button type="button" aria-label={t('virtualKeyboard.removeStep', {n: index+1})} onClick={() => setSteps(steps.filter((_, position) => position !== index))} className="p-1 text-red-300">✕</button>
          </li>)}
        </ol>
      </div>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 hover:bg-slate-700">{t('common.cancel')}</button>
        <button type="button" disabled={!valid} onClick={() => { onApply(mode === 'combo' ? combo : [], pending); onClose(); }} className="rounded-lg bg-indigo-600 px-4 py-2 disabled:opacity-40">{t('virtualKeyboard.apply')}</button>
      </div>
    </div>
  </div>;
}
