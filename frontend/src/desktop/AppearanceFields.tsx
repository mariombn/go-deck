import {useEffect, useState} from 'react';
import EmojiPicker, {EmojiStyle} from 'emoji-picker-react';
import {isImageIcon, resizeImageToDataURL} from '../lib/appearance';
import * as App from '../../wailsjs/go/main/App';

interface Props {
  icon: string | undefined;
  color: string | undefined;
  onChange: (patch: {icon?: string; color?: string}) => void;
}

// AppEntry espelha appicon.AppEntry do Go (ícone é data URL PNG, vazio se a
// extração falhou para aquele app).
type AppEntry = {name: string; path: string; icon: string};

// Paleta de cores de fundo sugeridas (Tailwind 500/600-ish).
const PRESET_COLORS = [
  '#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d',
  '#d97706', '#dc2626', '#db2777', '#7c3aed', '#475569',
];

// 'app' é uma *fonte* de ícone (extrai do SO) que produz uma imagem data URL —
// por isso, ao reabrir o editor, um ícone de app reaparece na aba 'image'
// (isImageIcon não distingue a origem). Os dois são a mesma coisa.
type IconMode = 'none' | 'emoji' | 'image' | 'app';

// AppearanceFields edita a cor de fundo e o ícone (emoji ou imagem) do botão.
export default function AppearanceFields({icon, color, onChange}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imgErr, setImgErr] = useState('');

  const mode: IconMode = isImageIcon(icon) ? 'image' : icon ? 'emoji' : 'none';

  const setMode = (m: IconMode) => {
    setPickerOpen(false);
    setImgErr('');
    if (m === 'none') onChange({icon: ''});
    // emoji/image só definem o icon quando o usuário escolher de fato. 'app'
    // não limpa: é só um seletor que vai gravar uma imagem ao escolher.
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

  // --- Aba "App": ícones de aplicativos instalados no SO ---
  const [apps, setApps] = useState<AppEntry[] | null>(null);
  const [appQuery, setAppQuery] = useState('');
  const [appBusy, setAppBusy] = useState(false);
  const [appErr, setAppErr] = useState('');

  // Lista carregada sob demanda na 1ª vez que a aba é aberta (a extração de
  // todos os ícones pode levar alguns segundos).
  useEffect(() => {
    if (tab !== 'app' || apps !== null) return;
    setAppBusy(true);
    setAppErr('');
    App.ListInstalledApps()
      .then((list) => setApps((list as AppEntry[]) ?? []))
      .catch((e) => setAppErr(String(e)))
      .finally(() => setAppBusy(false));
  }, [tab, apps]);

  // Seletor de arquivo nativo: aponta para um executável/.app e extrai o ícone.
  const pickFromSystem = async () => {
    setAppErr('');
    try {
      const data = await App.PickAppIcon();
      if (data) onChange({icon: data});
    } catch (e) {
      setAppErr(String(e));
    }
  };

  const q = appQuery.trim().toLowerCase();
  const filteredApps = (apps ?? []).filter((a) => a.name.toLowerCase().includes(q));

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
          {(['none', 'emoji', 'image', 'app'] as IconMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === m ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {m === 'none' ? 'Nenhum' : m === 'emoji' ? 'Emoji' : m === 'image' ? 'Imagem' : 'App'}
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

        {tab === 'app' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {isImageIcon(icon) && (
                <img src={icon} alt="" className="h-10 w-10 rounded object-contain ring-1 ring-slate-700" />
              )}
              <button
                type="button"
                onClick={pickFromSystem}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
              >
                Escolher do sistema…
              </button>
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

            {/* Busca + galeria de apps instalados */}
            <input
              value={appQuery}
              onChange={(e) => setAppQuery(e.target.value)}
              placeholder="Filtrar aplicativos…"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />

            {appBusy && <p className="text-xs text-slate-400">Carregando aplicativos…</p>}
            {appErr && <p className="text-xs text-red-300">{appErr}</p>}
            {!appBusy && !appErr && apps !== null && filteredApps.length === 0 && (
              <p className="text-xs text-slate-500">
                {apps.length === 0 ? 'Nenhum aplicativo encontrado.' : 'Nada corresponde ao filtro.'}
              </p>
            )}

            {filteredApps.length > 0 && (
              <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2">
                {filteredApps.map((a) => (
                  <button
                    key={a.path}
                    type="button"
                    onClick={() => a.icon && onChange({icon: a.icon})}
                    disabled={!a.icon}
                    title={a.name}
                    className={`flex flex-col items-center gap-1 rounded-md p-1.5 text-center ${
                      a.icon ? 'hover:bg-slate-700' : 'cursor-not-allowed opacity-40'
                    } ${icon && a.icon === icon ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    {a.icon ? (
                      <img src={a.icon} alt="" className="h-8 w-8 object-contain" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center text-slate-600">▢</span>
                    )}
                    <span className="line-clamp-2 w-full truncate text-[10px] leading-tight text-slate-400">
                      {a.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">Ícone redimensionado para 128px e embutido na config.</p>
          </div>
        )}
      </div>
    </div>
  );
}
