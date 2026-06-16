// Vocabulário de teclas e helpers de captura/exibição, alinhados ao keymap
// do backend Go (internal/input/keymap.go).

export const MODIFIERS = ['ctrl', 'shift', 'alt', 'win'] as const;

// Teclas que o navegador NÃO captura de forma confiável via keydown
// (a tecla Windows e as de mídia). Ficam disponíveis como botões fixos no
// editor — o "fallback" do modo de captura híbrido.
export const SPECIAL_KEYS: { name: string; label: string }[] = [
  { name: 'win', label: '⊞ Win' },
  { name: 'mute', label: '🔇 Mute' },
  { name: 'voldown', label: '🔉 Vol-' },
  { name: 'volup', label: '🔊 Vol+' },
  { name: 'playpause', label: '⏯ Play' },
  { name: 'prevtrack', label: '⏮ Prev' },
  { name: 'nexttrack', label: '⏭ Next' },
];

function isModifier(name: string): boolean {
  return (MODIFIERS as readonly string[]).includes(name);
}

// codeToName traduz KeyboardEvent.code para o nome usado no config.json.
function codeToName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code.toLowerCase();
  switch (code) {
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'Enter': return 'enter';
    case 'Escape': return 'esc';
    case 'Tab': return 'tab';
    case 'Space': return 'space';
    case 'Backspace': return 'backspace';
    case 'Delete': return 'delete';
    case 'Insert': return 'insert';
    case 'Home': return 'home';
    case 'End': return 'end';
    case 'PageUp': return 'pageup';
    case 'PageDown': return 'pagedown';
    default: return null;
  }
}

// eventToCombo monta o combo a partir de um keydown. Devolve null enquanto
// só há modificadores pressionados (esperando a tecla principal).
export function eventToCombo(e: KeyboardEvent): string[] | null {
  const main = codeToName(e.code);
  if (!main || isModifier(main)) return null;

  const combo: string[] = [];
  if (e.ctrlKey) combo.push('ctrl');
  if (e.shiftKey) combo.push('shift');
  if (e.altKey) combo.push('alt');
  if (e.metaKey) combo.push('win');
  combo.push(main);
  return combo;
}

// keyLabel devolve o rótulo amigável de uma única tecla.
export function keyLabel(name: string): string {
  const special = SPECIAL_KEYS.find((k) => k.name === name);
  if (special) return special.label.replace(/^[^\s]+\s/, '');
  const map: Record<string, string> = {
    ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', win: 'Win',
    enter: 'Enter', esc: 'Esc', tab: 'Tab', space: 'Space',
    backspace: 'Backspace', delete: 'Del', insert: 'Ins',
    home: 'Home', end: 'End', pageup: 'PgUp', pagedown: 'PgDn',
    up: '↑', down: '↓', left: '←', right: '→',
    mute: 'Mute', volup: 'Vol+', voldown: 'Vol-',
    playpause: 'Play/Pause', nexttrack: 'Next', prevtrack: 'Prev',
  };
  return map[name] ?? name.toUpperCase();
}

// comboLabel formata um combo inteiro: ["ctrl","shift","m"] -> "Ctrl + Shift + M".
export function comboLabel(keys: string[]): string {
  if (!keys || keys.length === 0) return '—';
  return keys.map(keyLabel).join(' + ');
}
