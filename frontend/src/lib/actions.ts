// Helpers de exibição de ações, compartilhados entre desktop e celular.
import {Action} from '../types';
import {comboLabel} from './keys';

// basename extrai o nome do executável de um caminho Windows/Unix.
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// actionSummary devolve um rótulo curto da ação, exibido sob o nome do botão
// (no editor e no celular). Cada tipo tem sua forma resumida.
export function actionSummary(action: Action): string {
  switch (action.type) {
    case 'keypress':
      return comboLabel(action.keys);
    case 'launch':
      return action.path ? '▶ ' + basename(action.path) : '▶ —';
    case 'url':
      return action.url ? '🔗 ' + action.url.replace(/^https?:\/\//, '') : '🔗 —';
    case 'sequence':
      return `⛓ ${action.steps.length} passo${action.steps.length === 1 ? '' : 's'}`;
    case 'obs':
      switch (action.obsOp) {
        case 'scene':
          return '🎬 ' + (action.target || '—');
        case 'toggle_record':
          return '⏺ Gravação';
        case 'toggle_stream':
          return '📡 Transmissão';
        case 'toggle_mute':
          return '🔇 ' + (action.target || '—');
        case 'hotkey':
          return '⌨ ' + (action.target || '—');
        default:
          return 'OBS';
      }
    case 'discord':
      return action.discordOp === 'deafen' ? '🎧 Deafen' : '🎙 Mute';
    default:
      return '';
  }
}
