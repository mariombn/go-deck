import {useTranslation} from 'react-i18next';
import {ButtonConfig} from '../types';
import {actionSummary} from '../lib/actions';
import {isImageIcon, textColorFor} from '../lib/appearance';

interface Props {
  button: ButtonConfig | null;
  mode: 'mobile' | 'desktop';
  flash?: 'ok' | 'err' | null;
  onClick?: () => void;
}

// DeckButton renderiza uma célula do grid (tanto no editor desktop quanto no
// celular). Célula vazia: no desktop vira um alvo "+" para criar botão; no
// celular fica inerte. Aparência: cor de fundo (com contraste automático do
// texto) e um ícone que é emoji ou imagem (data URL).
export default function DeckButton({button, mode, flash, onClick}: Props) {
  const {t} = useTranslation();
  const base =
    'aspect-square rounded-2xl flex flex-col items-center justify-center p-2 text-center select-none transition overflow-hidden';

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

  // Flash (ack ok/erro) tem prioridade visual sobre a cor custom.
  const flashClass =
    flash === 'ok'
      ? 'ring-4 ring-green-400 bg-green-600'
      : flash === 'err'
      ? 'ring-4 ring-red-400 bg-red-600'
      : button.color
      ? 'active:scale-95'
      : 'bg-slate-700 hover:bg-slate-600 active:scale-95';

  // Cor custom só quando não está em flash (para o feedback verde/vermelho
  // aparecer por cima). Texto com contraste automático.
  const useColor = !flash && !!button.color;
  const style = useColor ? {backgroundColor: button.color, color: textColorFor(button.color)} : undefined;

  const hasImage = isImageIcon(button.icon);
  // No celular, botão só-ícone (sem rótulo) deixa o ícone grande, ocupando
  // quase a célula inteira. No desktop mantém o tamanho padrão (há o resumo
  // da ação embaixo).
  const big = mode === 'mobile' && !!button.icon && !button.label?.trim();

  return (
    <button onClick={onClick} className={`${base} ${flashClass} shadow-md`} style={style}>
      {button.icon &&
        (hasImage ? (
          <img
            src={button.icon}
            alt=""
            className={big ? 'h-full w-full object-contain' : 'mb-1 h-8 w-8 object-contain'}
          />
        ) : (
          <span className={big ? 'text-6xl leading-none' : 'mb-0.5 text-2xl leading-none'}>{button.icon}</span>
        ))}
      {!big && (
        <span className="text-base font-semibold leading-tight line-clamp-2" style={useColor ? undefined : {color: '#fff'}}>
          {button.label || (button.icon ? '' : t('common.noName'))}
        </span>
      )}
      {mode === 'desktop' && (
        <span
          className={`mt-1 text-[10px] font-mono line-clamp-1 ${useColor ? 'opacity-70' : 'text-slate-300/80'}`}
          style={useColor ? {color: textColorFor(button.color)} : undefined}
        >
          {actionSummary(button.action, t)}
        </span>
      )}
    </button>
  );
}
