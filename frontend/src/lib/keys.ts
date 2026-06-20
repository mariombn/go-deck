// Vocabulário de teclas e helpers de captura/exibição, alinhados ao keymap
// do backend Go (internal/input/keymap.go).

export const MODIFIERS = [
  'ctrl', 'shift', 'alt', 'win',
  'lctrl', 'rctrl', 'lalt', 'ralt',
] as const;

// modifierCodeToName traduz o KeyboardEvent.code de uma tecla modificadora
// para o nome do config.json, preservando o lado (esquerda x direita) de
// Ctrl/Alt. Shift e Win permanecem genéricos. Retorna null se não for um
// modificador conhecido.
export function modifierCodeToName(code: string): string | null {
  switch (code) {
    case 'ControlLeft': return 'lctrl';
    case 'ControlRight': return 'rctrl';
    case 'AltLeft': return 'lalt';
    case 'AltRight': return 'ralt';
    case 'ShiftLeft':
    case 'ShiftRight': return 'shift';
    case 'MetaLeft':
    case 'MetaRight':
    case 'OSLeft':
    case 'OSRight': return 'win';
    default: return null;
  }
}

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

// Ordem canônica de exibição/serialização dos modificadores num combo.
const MOD_ORDER = ['ctrl', 'lctrl', 'rctrl', 'shift', 'alt', 'lalt', 'ralt', 'win'];

// eventToCombo monta o combo a partir do keydown da tecla principal, usando o
// conjunto de modificadores rastreado pela captura (com o lado de Ctrl/Alt já
// resolvido). Devolve null se o evento não for uma tecla principal conhecida.
//
// O estado booleano do evento (ctrlKey/altKey/…) serve de reconciliação: se
// algum keydown de modificador escapou ao rastreio, ao menos a variante
// genérica entra no combo.
export function eventToCombo(e: KeyboardEvent, pressed: Set<string>): string[] | null {
  const main = codeToName(e.code);
  if (!main || isModifier(main)) return null;

  const mods = new Set(pressed);
  if (e.ctrlKey && !mods.has('lctrl') && !mods.has('rctrl')) mods.add('ctrl');
  if (e.altKey && !mods.has('lalt') && !mods.has('ralt')) mods.add('alt');
  if (e.shiftKey) mods.add('shift');
  if (e.metaKey) mods.add('win');

  const combo = MOD_ORDER.filter((m) => mods.has(m));
  combo.push(main);
  return combo;
}

// keyLabel devolve o rótulo amigável de uma única tecla.
export function keyLabel(name: string): string {
  const special = SPECIAL_KEYS.find((k) => k.name === name);
  if (special) return special.label.replace(/^[^\s]+\s/, '');
  const map: Record<string, string> = {
    ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', win: 'Win',
    lctrl: 'Ctrl Esq', rctrl: 'Ctrl Dir', lalt: 'Alt Esq', ralt: 'AltGr',
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
