import {useEffect, useRef, useState, useCallback} from 'react';
import NoSleep from 'nosleep.js';
import {ButtonConfig, DeckConfig, ServerMessage} from '../types';
import DeckGrid from '../components/DeckGrid';

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

export default function MobileApp() {
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
      } else if (msg.type === 'ack') {
        flashButton(msg.buttonId, msg.ok ? 'ok' : 'err');
        if (!msg.ok) {
          setToast(msg.error || 'falha ao executar');
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

  // Toque numa célula: navigate troca de página localmente (sem press); as
  // demais ações vão ao PC pelo WS.
  const onCell = (_r: number, _c: number, button: ButtonConfig | null) => {
    if (!button) return;
    if (button.action.type === 'navigate') {
      const {targetPage} = button.action;
      const target = pages.find((p) => p.id === targetPage);
      if (target) setCurrentPageId(target.id);
      else showToast('grid de destino não encontrado');
      return;
    }
    press(button.id);
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between px-2">
        <StatusBar status={status} />
        <div className="flex items-center gap-2 px-2">
          <button
            onClick={keepAwake.toggle}
            aria-pressed={keepAwake.enabled}
            title={
              keepAwake.enabled
                ? 'Tela mantida ligada — toque para desligar'
                : 'Manter a tela sempre ligada'
            }
            className={`rounded-md px-2 py-1 text-xs ${
              keepAwake.enabled
                ? 'bg-amber-400 text-slate-900'
                : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
            }`}
          >
            {keepAwake.enabled ? '🔆 Tela ligada' : '🌙 Tela'}
          </button>
          {pages.length > 1 && currentPage && (
            <>
              <span className="text-xs text-slate-400">{currentPage.name}</span>
              <button
                onClick={() => setCurrentPageId(pages[0].id)}
                disabled={currentPage.id === pages[0].id}
                className="rounded-md bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600 disabled:opacity-30"
                title="Voltar ao primeiro grid"
              >
                ⌂ Home
              </button>
            </>
          )}
        </div>
      </div>
      <main className="flex flex-1 items-center justify-center p-4">
        {currentPage ? (
          <div className="w-full max-w-2xl">
            <DeckGrid
              page={currentPage}
              mode="mobile"
              transpose={portrait}
              flash={flash}
              onCellClick={onCell}
            />
          </div>
        ) : (
          <p className="text-slate-400">Aguardando configuração…</p>
        )}
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
  const map = {
    connecting: {color: 'bg-amber-400', text: 'Conectando…'},
    connected: {color: 'bg-green-400', text: 'Conectado'},
    reconnecting: {color: 'bg-red-400', text: 'Reconectando…'},
  }[status];
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400">
      <span className={`inline-block h-2 w-2 rounded-full ${map.color}`} />
      {map.text}
    </div>
  );
}
