import {useEffect, useRef, useState, useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import NoSleep from 'nosleep.js';
import {ButtonConfig, DeckConfig, ServerMessage} from '../types';
import DeckGrid from '../components/DeckGrid';
import i18n, {setLanguage} from '../lib/i18n';

type ConnStatus = 'connecting' | 'connected' | 'reconnecting';

// useKeepAwake impede o bloqueio automático da tela do celular enquanto o deck
// está aberto. A Screen Wake Lock API nativa só funciona em contexto seguro
// (HTTPS/localhost) — e o celular acessa via http://IP da LAN, que NÃO é seguro.
// Por isso usamos NoSleep.js, que recorre a um <video> invisível em loop (e à
// Wake Lock API automaticamente quando houver HTTPS no futuro).
//
// enabled = intenção do usuário; enable() precisa rodar dentro de um gesto
// (o clique no botão atende). Volta a ativar ao retornar para a aba.
function useKeepAwake(): {enabled: boolean; toggle: () => void} {
  const [enabled, setEnabled] = useState(false);
  const noSleepRef = useRef<NoSleep | null>(null);

  if (noSleepRef.current === null) {
    noSleepRef.current = new NoSleep();
  }

  useEffect(() => {
    const noSleep = noSleepRef.current!;
    if (!enabled) {
      noSleep.disable();
      return;
    }
    // enable() devolve uma Promise que pode rejeitar se não houver gesto;
    // como toggle é chamado no clique, o gesto está disponível.
    noSleep.enable().catch(() => {});
    // Ao voltar de segundo plano o vídeo pausa: reativa quando a aba reaparece.
    const onVisible = () => {
      if (document.visibilityState === 'visible') noSleep.enable().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      noSleep.disable();
    };
  }, [enabled]);

  return {enabled, toggle: () => setEnabled((v) => !v)};
}

// useOrientation devolve true quando a tela está em portrait (mais alta que
// larga), para transpor o grid no celular.
function useOrientation(): boolean {
  const [portrait, setPortrait] = useState(
    typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : true
  );
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight >= window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return portrait;
}

// useFitGridWidth mede a área disponível (ref) e devolve a largura em px que o
// grid deve ter para caber INTEIRO — em largura e altura — sem scroll. Como os
// botões são aspect-square, basta fixar a largura: cada coluna vira `cell` e a
// altura segue sozinha. cell = min(couber-na-largura, couber-na-altura), então
// em paisagem é a altura que manda (era o que faltava: o grid só olhava a
// largura). Sem piso: sempre cabe, por menor que fique (decisão do usuário).
function useFitGridWidth(
  ref: {current: HTMLElement | null},
  rows: number,
  cols: number,
  gap = 12, // px — equivalente ao gap-3 do DeckGrid
): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (W <= 0 || H <= 0 || rows <= 0 || cols <= 0) return;
      const cellW = (W - (cols - 1) * gap) / cols;
      const cellH = (H - (rows - 1) * gap) / rows;
      const cell = Math.max(0, Math.floor(Math.min(cellW, cellH)));
      setWidth(cell * cols + (cols - 1) * gap);
    };
    measure();
    // ResizeObserver cobre rotação e mudança de viewport (o elemento
    // redimensiona junto); orientationchange é reforço em alguns navegadores.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, [ref, rows, cols, gap]);
  return width;
}

export default function MobileApp() {
  const {t} = useTranslation();
  const [config, setConfig] = useState<DeckConfig | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [flash, setFlash] = useState<Record<string, 'ok' | 'err'>>({});
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const portrait = useOrientation();
  const keepAwake = useKeepAwake();

  const flashButton = useCallback((id: string, kind: 'ok' | 'err') => {
    setFlash((f) => ({...f, [id]: kind}));
    window.setTimeout(() => {
      setFlash((f) => {
        const {[id]: _, ...rest} = f;
        return rest;
      });
    }, 350);
  }, []);

  const connect = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Token de pareamento: chega na URL do QR (?t=) e é reenviado no handshake
    // do WS. Persiste na location, então sobrevive a reconexões e reloads.
    const token = new URLSearchParams(window.location.search).get('t') ?? '';
    const qs = token ? `?t=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws${qs}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setStatus('connected');
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'config') {
        setConfig(msg.payload);
        // O celular segue o idioma global do config (decisão P3-A): a config é
        // a fonte da verdade e já trafega por broadcast.
        if (msg.payload.language) setLanguage(msg.payload.language);
      } else if (msg.type === 'ack') {
        flashButton(msg.buttonId, msg.ok ? 'ok' : 'err');
        if (!msg.ok) {
          // msg.error já vem traduzido do Go; i18n.t (não-reativo) cobre o fallback.
          setToast(msg.error || i18n.t('mobile.actionFailed'));
          window.setTimeout(() => setToast(null), 2500);
        }
      }
    };
    ws.onclose = () => {
      // Reconexão com backoff exponencial (1s, 2s, 4s... teto 10s).
      setStatus('reconnecting');
      const delay = Math.min(1000 * 2 ** retryRef.current, 10000);
      retryRef.current += 1;
      timerRef.current = window.setTimeout(connect, delay);
    };
    ws.onerror = () => ws.close();
  }, [flashButton]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const press = (id: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({type: 'press', buttonId: id}));
    }
  };

  const pages = config?.pages ?? [];
  // Página atual com fallback à primeira (cobre id ausente ou página apagada
  // numa atualização de config vinda do desktop).
  const currentPage = pages.find((p) => p.id === currentPageId) ?? pages[0];

  // Dimensões exibidas já considerando a transposição em retrato (decisão 10),
  // para o auto-ajuste calcular o tamanho certo em cada orientação.
  const displayRows = currentPage ? (portrait ? currentPage.grid.cols : currentPage.grid.rows) : 0;
  const displayCols = currentPage ? (portrait ? currentPage.grid.rows : currentPage.grid.cols) : 0;
  const gridWidth = useFitGridWidth(areaRef, displayRows, displayCols);

  // Toque numa célula: navigate troca de página localmente (sem press); as
  // demais ações vão ao PC pelo WS.
  const onCell = (_r: number, _c: number, button: ButtonConfig | null) => {
    if (!button) return;
    if (button.action.type === 'navigate') {
      const {targetPage} = button.action;
      const target = pages.find((p) => p.id === targetPage);
      if (target) setCurrentPageId(target.id);
      else showToast(t('mobile.navNotFound'));
      return;
    }
    press(button.id);
  };

  return (
    // h-[100dvh] + overflow-hidden: ocupa exatamente a área VISÍVEL (descontando
    // a barra do navegador no celular) e nunca rola. É o que, junto do
    // auto-ajuste, faz o grid inteiro caber sem scroll.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-900 text-slate-100">
      <div className="flex shrink-0 items-center justify-between px-2">
        <StatusBar status={status} />
        <div className="flex items-center gap-2 px-2">
          <button
            onClick={keepAwake.toggle}
            aria-pressed={keepAwake.enabled}
            title={keepAwake.enabled ? t('mobile.keepAwakeOnTitle') : t('mobile.keepAwakeOffTitle')}
            className={`rounded-md px-2 py-1 text-xs ${
              keepAwake.enabled
                ? 'bg-amber-400 text-slate-900'
                : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
            }`}
          >
            {keepAwake.enabled ? t('mobile.keepAwakeOn') : t('mobile.keepAwakeOff')}
          </button>
          {pages.length > 1 && currentPage && (
            <>
              <span className="text-xs text-slate-400">{currentPage.name}</span>
              <button
                onClick={() => setCurrentPageId(pages[0].id)}
                disabled={currentPage.id === pages[0].id}
                className="rounded-md bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600 disabled:opacity-30"
                title={t('mobile.homeTitle')}
              >
                {t('mobile.home')}
              </button>
            </>
          )}
        </div>
      </div>
      <main className="flex min-h-0 flex-1 items-center justify-center p-3">
        {/* areaRef mede o espaço livre; o grid recebe a largura calculada para
            caber em largura E altura. min-h-0 deixa o flex encolher de fato. */}
        <div ref={areaRef} className="flex h-full w-full items-center justify-center">
          {currentPage ? (
            <div style={{width: gridWidth}}>
              <DeckGrid
                page={currentPage}
                mode="mobile"
                transpose={portrait}
                flash={flash}
                onCellClick={onCell}
              />
            </div>
          ) : (
            <p className="text-slate-400">{t('mobile.waiting')}</p>
          )}
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatusBar({status}: {status: ConnStatus}) {
  const {t} = useTranslation();
  const map = {
    connecting: {color: 'bg-amber-400', key: 'mobile.status.connecting'},
    connected: {color: 'bg-green-400', key: 'mobile.status.connected'},
    reconnecting: {color: 'bg-red-400', key: 'mobile.status.reconnecting'},
  }[status];
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400">
      <span className={`inline-block h-2 w-2 rounded-full ${map.color}`} />
      {t(map.key)}
    </div>
  );
}
