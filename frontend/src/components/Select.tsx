import {Children, isValidElement, ReactNode, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

interface Props {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
}

// Popup próprio: o menu nativo do WebKitGTK pode ignorar o fundo escuro de
// <option>. O portal também evita corte dentro de modais com overflow.
export default function Select({value, onChange, children, className = '', id, disabled, ...aria}: Props) {
  const options = Children.toArray(children).filter(isValidElement).map((child) => {
    const props = child.props as {value: string; children: ReactNode};
    return {value: String(props.value), label: props.children};
  });
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({text: '', time: 0});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({left: 0, top: 0, width: 160, maxHeight: 240});
  const selected = options.findIndex((option) => option.value === value);
  const show = () => { if (!disabled) { setActive(Math.max(0, selected)); setOpen(true); } };
  const choose = (index: number) => {
    if (!options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 12;
    const height = Math.min(240, Math.max(80, below >= 120 ? below : rect.top - 12));
    setPosition({left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: below >= 120 ? rect.bottom + 4 : Math.max(8, rect.top - height - 4), width, maxHeight: height});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    // Só a rolagem de um ancestral muda a âncora. Um input longo pode
    // rolar internamente ao perder foco; isso não deve fechar o popup.
    const scroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && trigger.current && target.contains(trigger.current)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({block: 'nearest'}); }, [active, open, listId]);

  return <>
    <button
      ref={trigger} type="button" id={id} {...aria} disabled={disabled}
      role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open ? `${listId}-${active}` : undefined}
      className={`inline-flex min-w-0 items-center justify-between gap-2 text-left text-slate-100 disabled:opacity-40 ${className}`}
      onClick={() => open ? setOpen(false) : show()}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        const key = event.key;
        if (key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } return; }
        if (key === 'Tab') { setOpen(false); return; }
        if (key === 'Enter' || key === ' ') { event.preventDefault(); open ? choose(active) : show(); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
          event.preventDefault();
          if (!open) { show(); if (key === 'Home') setActive(0); if (key === 'End') setActive(options.length-1); }
          else setActive((current) => key === 'Home' ? 0 : key === 'End' ? options.length-1 : (current + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
          return;
        }
        if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          const text = (now - search.current.time < 700 ? search.current.text : '') + key.toLocaleLowerCase();
          search.current = {text, time: now};
          const index = options.findIndex((option) => String(option.label).toLocaleLowerCase().startsWith(text));
          if (index >= 0) { setOpen(true); setActive(index); }
        }
      }}
    >
      <span className="min-w-0 truncate">{options[selected]?.label ?? value}</span>
      <span aria-hidden="true" className="shrink-0 text-slate-400">▾</span>
    </button>
    {open && createPortal(
      <div ref={menu} id={listId} role="listbox" aria-label={aria['aria-label']}
        className="fixed z-[100] overflow-y-auto rounded-lg border border-slate-600 bg-slate-900 p-1 text-sm text-slate-100 shadow-2xl"
        style={position} onMouseDown={(event) => { if (event.target !== event.currentTarget) event.preventDefault(); }}>
        {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value}
          data-value={option.value}
          className={`cursor-pointer break-words rounded px-3 py-2 ${index === active ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-100 hover:bg-slate-700'}`}
          onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>{option.label}</div>)}
      </div>, document.body)}
  </>;
}
