import {useCallback, useEffect, useState} from 'react';
import {ButtonConfig, DeckConfig, OBSConfig, Page} from '../types';
import DeckGrid from '../components/DeckGrid';
import ButtonEditor from './ButtonEditor';
import ConfigDrawer from './ConfigDrawer';
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
  // Drawer de configuração (engrenagem do header): QR/rede + OBS, sob demanda.
  const [configOpen, setConfigOpen] = useState(false);
  // Orientação do preview do grid: 'paisagem' = canônico (como hoje); 'retrato'
  // = transposto (como o celular renderiza em portrait). Estado efêmero e global
  // (vale pra qualquer página ativa), só de visualização — não vai pro config
  // nem pro WS, e reseta pra paisagem ao recarregar. As células continuam
  // editáveis nas duas orientações (DeckGrid mapeia a célula exibida de volta
  // pra posição canônica).
  const [orientation, setOrientation] = useState<'paisagem' | 'retrato'>('paisagem');
  // Drag-and-drop de reordenação das abas de grid. dragIndex = aba sendo
  // arrastada; overIndex = posição onde a linha de inserção aparece.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

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

  // reorderPages move a aba `from` para a posição de inserção `to` (antes do
  // item que estava em `to`). A página ativa é rastreada por id, então a
  // seleção não muda. A 1ª página é o Home/inicial do celular — reordenar
  // muda qual grid é o Home, de propósito. Marca dirty; persiste no Salvar.
  const reorderPages = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    const dest = from < to ? to - 1 : to;
    next.splice(dest, 0, moved);
    setConfig({...config, pages: next});
    setDirty(true);
  };

  const resetDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

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
            onClick={() => setConfigOpen(true)}
            aria-label="Configurações"
            title="Configurações"
            className="rounded-lg px-2 py-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
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
            {pages.map((p, i) => {
              const isActive = p.id === activePage.id;
              const dragging = dragIndex !== null;
              const showLine = dragging && overIndex === i && dragIndex !== i;
              return (
                <div
                  key={p.id}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    e.preventDefault(); // habilita o drop
                    setOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) reorderPages(dragIndex, i);
                    resetDrag();
                  }}
                  onDragEnd={resetDrag}
                  className={`flex items-start gap-1 rounded-lg border-t-2 ${
                    showLine ? 'border-indigo-400' : 'border-transparent'
                  } ${dragIndex === i ? 'opacity-40' : ''}`}
                >
                  {/* Alça: única origem do arrasto, pra não atrapalhar o clique/
                      seleção no input de nome do card ativo. */}
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(i);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(i));
                    }}
                    title="Arrastar para reordenar"
                    className="mt-2 shrink-0 cursor-grab select-none px-0.5 text-slate-500 hover:text-slate-300 active:cursor-grabbing"
                    aria-label="Reordenar grid"
                  >
                    <svg viewBox="0 0 8 16" className="h-4 w-2 fill-current" aria-hidden="true">
                      <circle cx="2" cy="3" r="1" />
                      <circle cx="6" cy="3" r="1" />
                      <circle cx="2" cy="8" r="1" />
                      <circle cx="6" cy="8" r="1" />
                      <circle cx="2" cy="13" r="1" />
                      <circle cx="6" cy="13" r="1" />
                    </svg>
                  </span>

                  <div className="min-w-0 flex-1">
                    {isActive ? (
                      <div className="rounded-lg bg-indigo-600/20 p-2 ring-1 ring-indigo-500">
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
                        onClick={() => setActivePageId(p.id)}
                        className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
                      >
                        {p.name || '(sem nome)'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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

            {/* Toggle de orientação: alterna o preview do grid entre paisagem
                (canônico) e retrato (transposto, como o celular em portrait). */}
            <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-slate-700 text-sm">
              {(['paisagem', 'retrato'] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`px-3 py-1 ${
                    orientation === o
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title={o === 'retrato' ? 'Pré-visualizar como o celular em pé' : 'Pré-visualizar como o celular deitado'}
                >
                  {o === 'paisagem' ? '🖥️ Paisagem' : '📱 Retrato'}
                </button>
              ))}
            </div>
          </div>

          <div className={`mx-auto ${orientation === 'retrato' ? 'max-w-xs' : 'max-w-3xl'}`}>
            <DeckGrid
              page={activePage}
              mode="desktop"
              transpose={orientation === 'retrato'}
              onCellClick={openCell}
            />
          </div>
        </section>
      </div>

      <ConfigDrawer
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        network={network}
        qr={qr}
        onChangeIP={changeIP}
        obs={config.integrations?.obs ?? {enabled: false, host: 'localhost', port: 4455, password: ''}}
        onChangeOBS={setOBS}
      />

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
