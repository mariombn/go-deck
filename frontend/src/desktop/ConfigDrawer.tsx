import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {OBSConfig} from '../types';
import OBSPanel from './OBSPanel';
import {LANGUAGES} from '../lib/i18n';

interface NetworkInfo {
  ips: string[];
  activeIP: string;
  port: number;
  url: string;
  error: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  network: NetworkInfo | null;
  qr: string;
  onChangeIP: (ip: string) => void;
  obs: OBSConfig;
  onChangeOBS: (obs: OBSConfig) => void;
  language: string;
  onChangeLanguage: (lang: string) => void;
}

type Tab = 'mobile' | 'obs';

// ConfigDrawer é o painel de configuração que desliza da direita (overlay).
// Reúne o que antes vivia na aside fixa: acesso pelo celular (QR + rede) e a
// integração com o OBS, agora em abas. Fica sempre montado para animar a
// entrada/saída (translate-x + fade do backdrop); o estado de salvar continua
// sendo o global do header (mexer no OBS só marca a config como suja).
export default function ConfigDrawer({
  open,
  onClose,
  network,
  qr,
  onChangeIP,
  obs,
  onChangeOBS,
  language,
  onChangeLanguage,
}: Props) {
  const {t, i18n} = useTranslation();
  const [tab, setTab] = useState<Tab>('mobile');

  // Esc fecha o drawer (só quando aberto).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      {/* Backdrop: clique-fora fecha; fade controlado por opacidade. */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Painel: desliza da direita. */}
      <aside
        className={`absolute right-0 top-0 flex h-full w-96 flex-col bg-slate-900 shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{t('config.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </header>

        {/* Idioma global do app (decisão P3-A): aplica a desktop, celular e
            erros do backend. Trocar salva na hora (decisão P8). */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-5 py-3">
          <label htmlFor="lang-select" className="text-sm text-slate-400">
            {t('config.language')}
          </label>
          <select
            id="lang-select"
            value={language || i18n.language}
            onChange={(e) => onChangeLanguage(e.target.value)}
            className="ml-auto rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>

        {/* Abas */}
        <div className="flex shrink-0 border-b border-slate-800 px-5 pt-3">
          {(['mobile', 'obs'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === id
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t(`config.tabs.${id}`)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {tab === 'mobile' ? (
            <MobileTab network={network} qr={qr} onChangeIP={onChangeIP} />
          ) : (
            <OBSPanel value={obs} onChange={onChangeOBS} />
          )}
        </div>
      </aside>
    </div>
  );
}

function MobileTab({
  network,
  qr,
  onChangeIP,
}: {
  network: NetworkInfo | null;
  qr: string;
  onChangeIP: (ip: string) => void;
}) {
  const {t} = useTranslation();
  return (
    <>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('config.mobileAccess')}</h3>

      {network?.error ? (
        <div className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{network.error}</div>
      ) : (
        <>
          <div className="mb-3 flex justify-center rounded-xl bg-white p-3">
            {qr ? <img src={qr} alt="QR Code" className="h-48 w-48" /> : <div className="h-48 w-48" />}
          </div>
          <p className="mb-3 break-all text-center font-mono text-xs text-slate-300">{network?.url}</p>

          {network && (network.ips?.length ?? 0) > 1 && (
            <label className="mb-3 block text-xs text-slate-400">
              {t('config.ipLabel')}
              <select
                value={network.activeIP}
                onChange={(e) => onChangeIP(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
              >
                {(network.ips ?? []).map((ip) => (
                  <option key={ip} value={ip}>
                    {ip}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      <div className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">
        {t('config.securityNotice')}
      </div>
    </>
  );
}
