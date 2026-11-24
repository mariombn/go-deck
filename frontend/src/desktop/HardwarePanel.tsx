import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import * as App from '../../wailsjs/go/main/App';
import {DeckConfig} from '../types';
import {hardwareImages} from '../lib/hardwareImages';
import Select from '../components/Select';

interface HardwareInfo {
  supported: boolean;
  enabled: boolean;
  connected: boolean;
  path: string;
  pageId: string;
  revision: number;
  error: string;
  actionError: string;
}

// Recebe somente a configuração persistida: o hardware nunca executa um
// rascunho ainda não salvo no editor. Seu estado de navegação é independente.
export default function HardwarePanel({config}: {config: DeckConfig}) {
  const {t} = useTranslation();
  const [info, setInfo] = useState<HardwareInfo | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try {
        const state = await App.GetHardwareInfo();
        if (!stopped) setInfo(state);
      } catch (err) { if (!stopped) setError(String(err)); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const state = await App.GetHardwareInfo();
        if (!state.supported) return;
        const images = await hardwareImages(config);
        if (!stopped) { await App.SetHardwareImages(state.revision, images); setError(''); }
      } catch (err) { if (!stopped) setError(String(err)); }
    })();
    return () => { stopped = true; };
  }, [config]);

  if (!info?.supported) return null;
  const page = config.pages.find((p) => p.id === info.pageId);
  const report = (err: unknown) => setError(String(err));
  return (
    <div className="border-b border-slate-800 px-6 py-2 text-xs text-slate-300">
      <div className="flex flex-wrap items-center gap-3">
        <strong>Rise Mode Vision 2</strong>
        <span className={info.connected ? 'text-green-400' : 'text-slate-400'}>
          {t(info.connected ? 'hardware.connected' : info.enabled ? 'hardware.waiting' : 'hardware.disabled')}
        </span>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={info.enabled} onChange={(e) => { void App.SetHardwareEnabled(e.target.checked).catch(report); }} />
          {t('hardware.enable')}
        </label>
        <label className="flex items-center gap-2">
          {t('hardware.page')}
          <Select aria-label={t('hardware.page')} value={info.pageId} onChange={(id) => { void App.SelectHardwarePage(id).catch(report); }} className="rounded bg-slate-800 px-2 py-1">
            {config.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <button onClick={() => { void App.SelectHardwarePage(config.pages[0].id).catch(report); }} className="rounded bg-slate-800 px-2 py-1">{t('hardware.home')}</button>
        <span className="text-slate-500">{t('hardware.hint')}</span>
      </div>
      {page && (page.grid.rows > 3 || page.grid.cols > 5) && <p className="mt-1 text-amber-400">{t('hardware.cropWarning')}</p>}
      {(error || info.error || info.actionError) && <p role="alert" className="mt-1 text-red-400">{error || info.error || info.actionError}</p>}
    </div>
  );
}
