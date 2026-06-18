import {useState} from 'react';
import EmojiPicker, {EmojiStyle} from 'emoji-picker-react';
import {isImageIcon, resizeImageToDataURL} from '../lib/appearance';

interface Props {
  icon: string | undefined;
  color: string | undefined;
  onChange: (patch: {icon?: string; color?: string}) => void;
}

// Paleta de cores de fundo sugeridas (Tailwind 500/600-ish).
const PRESET_COLORS = [
  '#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d',
  '#d97706', '#dc2626', '#db2777', '#7c3aed', '#475569',
];

type IconMode = 'none' | 'emoji' | 'image';

// AppearanceFields edita a cor de fundo e o ícone (emoji ou imagem) do botão.
export default function AppearanceFields({icon, color, onChange}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imgErr, setImgErr] = useState('');

  const mode: IconMode = isImageIcon(icon) ? 'image' : icon ? 'emoji' : 'none';

  const setMode = (m: IconMode) => {
    setPickerOpen(false);
    setImgErr('');
    if (m === 'none') onChange({icon: ''});
    // emoji/image só definem o icon quando o usuário escolher de fato.
    else if (m === 'emoji' && mode !== 'emoji') onChange({icon: ''});
    else if (m === 'image' && mode !== 'image') onChange({icon: ''});
    setTab(m);
  };
  const [tab, setTab] = useState<IconMode>(mode);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImgErr('');
    try {
      onChange({icon: await resizeImageToDataURL(file)});
    } catch (e) {
      setImgErr(String(e));
    }
  };

  return (
    <div className="space-y-4">
      {/* Cor de fundo */}
      <div>
        <label className="mb-1 block text-sm text-slate-400">Cor de fundo</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({color: c})}
              style={{backgroundColor: c}}
              className={`h-6 w-6 rounded-md ${color === c ? 'ring-2 ring-white' : ''}`}
              title={c}
            />
          ))}
          <input
            type="color"
            value={color || '#475569'}
            onChange={(e) => onChange({color: e.target.value})}
            className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-transparent"
            title="Cor personalizada"
          />
          <button
            type="button"
            onClick={() => onChange({color: ''})}
            className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            padrão
          </button>
        </div>
      </div>

      {/* Ícone */}
      <div>
        <label className="mb-1 block text-sm text-slate-400">Ícone</label>
        <div className="mb-2 flex gap-1">
          {(['none', 'emoji', 'image'] as IconMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === m ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {m === 'none' ? 'Nenhum' : m === 'emoji' ? 'Emoji' : 'Imagem'}
            </button>
          ))}
        </div>

        {tab === 'emoji' && (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm hover:border-indigo-500"
            >
              <span className="text-xl leading-none">{!isImageIcon(icon) && icon ? icon : '🙂'}</span>
              Escolher emoji
            </button>
            {pickerOpen && (
              // Overlay flutuante por cima do modal (evita empurrar a altura e
              // gerar barra de rolagem). Fecha no backdrop, no X ou ao escolher.
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                onClick={() => setPickerOpen(false)}
              >
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="absolute -right-3 -top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-sm shadow-lg hover:bg-slate-600"
                    title="Fechar"
                  >
                    ✕
                  </button>
                  <EmojiPicker
                    emojiStyle={EmojiStyle.NATIVE}
                    onEmojiClick={(e) => {
                      onChange({icon: e.emoji});
                      setPickerOpen(false);
                    }}
                    width={320}
                    height={420}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'image' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {isImageIcon(icon) && (
                <img src={icon} alt="" className="h-10 w-10 rounded object-contain ring-1 ring-slate-700" />
              )}
              <label className="cursor-pointer rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">
                {isImageIcon(icon) ? 'Trocar imagem' : 'Enviar imagem'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              {isImageIcon(icon) && (
                <button
                  type="button"
                  onClick={() => onChange({icon: ''})}
                  className="text-xs text-red-400 hover:underline"
                >
                  remover
                </button>
              )}
            </div>
            {imgErr && <p className="text-xs text-red-300">{imgErr}</p>}
            <p className="text-xs text-slate-500">A imagem é redimensionada para 128px e embutida na config.</p>
          </div>
        )}
      </div>
    </div>
  );
}
