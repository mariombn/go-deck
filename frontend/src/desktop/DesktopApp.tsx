import {useCallback, useEffect, useState} from 'react';
import {ButtonConfig, DeckConfig, OBSConfig, Page} from '../types';
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

// newPageId gera um id de página no frontend. Exceção consciente à regra
// "ids só no Go": uma ação 'navigate' precisa referenciar uma página recém-
// criada antes de salvar. O backend preserva ids não-vazios e únicos.
function newPageId(): string {
  const a = new Uint8Array(3);
  crypto.getRandomValues(a);
  return 'page_' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function DesktopApp() {
  const [config, setConfig] = useState<DeckConfig | null>(null);
  const [activePageId, setActivePageId] = useState<string>('');
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
      setActivePageId(cfg.pages[0]?.id ?? '');
      await refreshNetwork();
    })();
  }, [refreshNetwork]);

  if (!config) {
    return <div className="flex h-full items-center justify-center bg-slate-900 text-slate-400">Carregando…</div>;
  }

  const pages = config.pages ?? [];
  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];
  if (!activePage) {
    return <div className="flex h-full items-center justify-center bg-slate-900 text-slate-400">Sem páginas.</div>;
  }

  // replacePage troca a página ativa por uma nova versão (imutável) e marca sujo.
  const replaceActivePage = (next: Page) => {
    setConfig({...config, pages: pages.map((p) => (p.id === activePage.id ? next : p))});
    setDirty(true);
  };

  // --- gerência de páginas ---
  const addPage = () => {
    const page: Page = {id: newPageId(), name: `Grid ${pages.length + 1}`, grid: {rows: 3, cols: 5}, buttons: []};
    setConfig({...config, pages: [...pages, page]});
    setActivePageId(page.id);
    setDirty(true);
  };

  const renameActivePage = (name: string) => replaceActivePage({...activePage, name});

  const deleteActivePage = () => {
    if (pages.length <= 1) return;
    if (!window.confirm(`Excluir o grid "${activePage.name}" e seus botões?`)) return;
    const remaining = pages.filter((p) => p.id !== activePage.id);
    setConfig({...config, pages: remaining});
    setActivePageId(remaining[0].id);
    setDirty(true);
  };

  // --- edição do grid da página ativa ---
  const applyGrid = (rows: number, cols: number) => {
    rows = Math.max(1, Math.min(MAX_DIM, rows || 1));
    cols = Math.max(1, Math.min(MAX_DIM, cols || 1));
    const orphans = activePage.buttons.filter((b) => b.position.row >= rows || b.position.col >= cols);
    if (orphans.length > 0) {
      const ok = window.confirm(
        `${orphans.length} botão(ões) ficam fora do novo grid e serão removidos. Continuar?`
      );
      if (!ok) return;
    }
    replaceActivePage({
      ...activePage,
      grid: {rows, cols},
      buttons: activePage.buttons.filter((b) => b.position.row < rows && b.position.col < cols),
    });
  };

  // --- CRUD de botões (na página ativa) ---
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
    const buttons = editing?.isNew
      ? [...activePage.buttons, button]
      : activePage.buttons.map((b) => (b.id === button.id ? button : b));
    replaceActivePage({...activePage, buttons});
    setEditing(null);
  };

  const deleteButton = () => {
    if (!editing) return;
    replaceActivePage({...activePage, buttons: activePage.buttons.filter((b) => b.id !== editing.draft.id)});
    setEditing(null);
  };

  const setOBS = (obs: OBSConfig) => {
    setConfig({...config, integrations: {...config.integrations, obs}});
    setDirty(true);
  };

  // --- persistência ---
  const save = async () => {
    const saved = (await App.SaveConfig(config as any)) as unknown as DeckConfig;
    setConfig(saved);
    // Mantém a página ativa se ainda existir; senão volta à primeira.
    if (!saved.pages.some((p) => p.id === activePageId)) {
      setActivePageId(saved.pages[0]?.id ?? '');
    }
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
        {/* Abas laterais de grids (páginas) */}
        <nav className="w-44 shrink-0 overflow-auto border-r border-slate-800 p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Grids</h2>
          <div className="space-y-1">
            {pages.map((p) =>
              p.id === activePage.id ? (
                <div key={p.id} className="rounded-lg bg-indigo-600/20 p-2 ring-1 ring-indigo-500">
                  <input
                    value={p.name}
                    onChange={(e) => renameActivePage(e.target.value)}
                    placeholder="Nome do grid"
                    className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-500"
                  />
                  <button
                    onClick={deleteActivePage}
                    disabled={pages.length <= 1}
                    className="mt-1 text-xs text-red-400 hover:underline disabled:opacity-30"
                  >
                    excluir
                  </button>
                </div>
              ) : (
                <button
                  key={p.id}
                  onClick={() => setActivePageId(p.id)}
                  className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
                >
                  {p.name || '(sem nome)'}
                </button>
              )
            )}
          </div>
          <button
            onClick={addPage}
            className="mt-2 w-full rounded-lg border border-dashed border-slate-600 px-2 py-2 text-xs text-slate-300 hover:border-indigo-500 hover:text-indigo-300"
          >
            + Novo grid
          </button>
        </nav>

        {/* Editor do grid ativo */}
        <section className="flex-1 overflow-auto p-6">
          <div className="mb-4 flex items-center gap-4">
            <label className="text-sm text-slate-400">
              Linhas
              <input
                type="number"
                min={1}
                max={MAX_DIM}
                value={activePage.grid.rows}
                onChange={(e) => applyGrid(parseInt(e.target.value, 10), activePage.grid.cols)}
                className="ml-2 w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1"
              />
            </label>
            <label className="text-sm text-slate-400">
              Colunas
              <input
                type="number"
                min={1}
                max={MAX_DIM}
                value={activePage.grid.cols}
                onChange={(e) => applyGrid(activePage.grid.rows, parseInt(e.target.value, 10))}
                className="ml-2 w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1"
              />
            </label>
            <span className="text-xs text-slate-500">Clique numa célula para adicionar/editar um botão.</span>
          </div>

          <div className="mx-auto max-w-3xl">
            <DeckGrid page={activePage} mode="desktop" onCellClick={openCell} />
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
          pages={pages.map((p) => ({id: p.id, name: p.name}))}
          onSave={saveButton}
          onDelete={deleteButton}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
