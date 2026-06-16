import {useCallback, useEffect, useState} from 'react';
import {ButtonConfig, DeckConfig, OBSConfig} from '../types';
import DeckGrid from '../components/DeckGrid';
import ButtonEditor from './ButtonEditor';
import OBSPanel from './OBSPanel';
import * as App from '../../wailsjs/go/main/App';

interface NetworkInfo {
  ips: string[];
  activeIP: string;
  port: number;
  url: string;
  error: string;
}

const MAX_DIM = 8;

interface Editing {
  draft: ButtonConfig;
  isNew: boolean;
}

export default function DesktopApp() {
  const [config, setConfig] = useState<DeckConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [qr, setQr] = useState<string>('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>('');

  const refreshNetwork = useCallback(async () => {
    const info = (await App.GetNetworkInfo()) as unknown as NetworkInfo;
    setNetwork(info);
    try {
      setQr(await App.GetQRCode());
    } catch {
      setQr('');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const cfg = (await App.GetConfig()) as unknown as DeckConfig;
      setConfig(cfg);
      await refreshNetwork();
    })();
  }, [refreshNetwork]);

  if (!config) {
    return <div className="flex h-full items-center justify-center bg-slate-900 text-slate-400">Carregando…</div>;
  }

  // --- edição de grid ---
  const applyGrid = (rows: number, cols: number) => {
    rows = Math.max(1, Math.min(MAX_DIM, rows || 1));
    cols = Math.max(1, Math.min(MAX_DIM, cols || 1));
    const orphans = config.buttons.filter((b) => b.position.row >= rows || b.position.col >= cols);
    if (orphans.length > 0) {
      const ok = window.confirm(
        `${orphans.length} botão(ões) ficam fora do novo grid e serão removidos. Continuar?`
      );
      if (!ok) return;
    }
    setConfig({
      ...config,
      grid: {rows, cols},
      buttons: config.buttons.filter((b) => b.position.row < rows && b.position.col < cols),
    });
    setDirty(true);
  };

  // --- CRUD de botões ---
  const openCell = (row: number, col: number, button: ButtonConfig | null) => {
    if (button) {
      setEditing({draft: button, isNew: false});
    } else {
      setEditing({
        draft: {id: '', label: '', position: {row, col}, action: {type: 'keypress', keys: []}},
        isNew: true,
      });
    }
  };

  const saveButton = (button: ButtonConfig) => {
    let buttons: ButtonConfig[];
    if (editing?.isNew) {
      buttons = [...config.buttons, button];
    } else {
      buttons = config.buttons.map((b) => (b.id === button.id ? button : b));
    }
    setConfig({...config, buttons});
    setDirty(true);
    setEditing(null);
  };

  const setOBS = (obs: OBSConfig) => {
    setConfig({...config, integrations: {...config.integrations, obs}});
    setDirty(true);
  };

  const deleteButton = () => {
    if (!editing) return;
    setConfig({...config, buttons: config.buttons.filter((b) => b.id !== editing.draft.id)});
    setDirty(true);
    setEditing(null);
  };

  // --- persistência ---
  const save = async () => {
    const saved = (await App.SaveConfig(config as any)) as unknown as DeckConfig;
    setConfig(saved);
    setDirty(false);
    setSaveMsg('Salvo ✓');
    window.setTimeout(() => setSaveMsg(''), 2000);
  };

  const changeIP = async (ip: string) => {
    const info = (await App.SetActiveIP(ip)) as unknown as NetworkInfo;
    setNetwork(info);
    try {
      setQr(await App.GetQRCode());
    } catch {
      setQr('');
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h1 className="text-lg font-bold">go-deck</h1>
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-sm text-green-400">{saveMsg}</span>}
          <button
            onClick={save}
            disabled={!dirty}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-40"
          >
            Salvar configuração
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor de grid */}
        <section className="flex-1 overflow-auto p-6">
          <div className="mb-4 flex items-center gap-4">
            <label className="text-sm text-slate-400">
              Linhas
              <input
                type="number"
                min={1}
                max={MAX_DIM}
                value={config.grid.rows}
                onChange={(e) => applyGrid(parseInt(e.target.value, 10), config.grid.cols)}
                className="ml-2 w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1"
              />
            </label>
            <label className="text-sm text-slate-400">
              Colunas
              <input
                type="number"
                min={1}
                max={MAX_DIM}
                value={config.grid.cols}
                onChange={(e) => applyGrid(config.grid.rows, parseInt(e.target.value, 10))}
                className="ml-2 w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1"
              />
            </label>
            <span className="text-xs text-slate-500">Clique numa célula para adicionar/editar um botão.</span>
          </div>

          <div className="mx-auto max-w-3xl">
            <DeckGrid config={config} mode="desktop" onCellClick={openCell} />
          </div>
        </section>

        {/* Painel de rede / QR */}
        <aside className="w-80 shrink-0 overflow-auto border-l border-slate-800 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Acesso pelo celular
          </h2>

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
                  IP da rede (troque se o QR não conectar)
                  <select
                    value={network.activeIP}
                    onChange={(e) => changeIP(e.target.value)}
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
            ⚠️ Sem autenticação: qualquer dispositivo na sua rede local que abrir esta URL pode acionar os botões
            existentes — incluindo abrir programas e URLs configurados — no seu PC.
          </div>

          <OBSPanel
            value={
              config.integrations?.obs ?? {enabled: false, host: 'localhost', port: 4455, password: ''}
            }
            onChange={setOBS}
          />
        </aside>
      </div>

      {editing && (
        <ButtonEditor
          draft={editing.draft}
          isNew={editing.isNew}
          onSave={saveButton}
          onDelete={deleteButton}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
