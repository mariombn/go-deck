// Helpers de exibição de ações, compartilhados entre desktop e celular.
import type {TFunction} from 'i18next';
import {Action} from '../types';
import {comboLabel} from './keys';

// basename extrai o nome do executável de um caminho Windows/Unix.
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// actionSummary devolve um rótulo curto da ação, exibido sob o nome do botão
// (no editor e no celular). Cada tipo tem sua forma resumida. Recebe `t` (de
// useTranslation) para os trechos textuais; quem chama deve estar inscrito no
// idioma ativo para re-renderizar ao trocar de idioma.
export function actionSummary(action: Action, t: TFunction): string {
  switch (action.type) {
    case 'keypress': {
      const label = comboLabel(action.keys);
      const hold = action.holdMs ?? 0;
      // Formata sem casas desnecessárias: 2000ms -> "2s", 500ms -> "0.5s".
      return hold > 0 ? `${label} · ${(hold / 1000).toString()}s` : label;
    }
    case 'launch':
      return action.path ? '▶ ' + basename(action.path) : '▶ —';
    case 'url':
      return action.url ? '🔗 ' + action.url.replace(/^https?:\/\//, '') : '🔗 —';
    case 'sequence':
      return `⛓ ${t('actions.summary.steps', {count: action.steps.length})}`;
    case 'obs':
      switch (action.obsOp) {
        case 'scene':
          return '🎬 ' + (action.target || '—');
        case 'toggle_record':
          return '⏺ ' + t('actions.summary.record');
        case 'toggle_stream':
          return '📡 ' + t('actions.summary.stream');
        case 'toggle_mute':
          return '🔇 ' + (action.target || '—');
        case 'hotkey':
          return '⌨ ' + (action.target || '—');
        default:
          return 'OBS';
      }
    case 'discord':
      return action.discordOp === 'deafen' ? '🎧 ' + t('actions.summary.deafen') : '🎙 ' + t('actions.summary.mute');
    case 'navigate':
      return '➡ ' + t('actions.summary.navigate');
    default:
      return '';
  }
}
