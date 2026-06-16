import {useEffect, useRef, useState, useCallback} from 'react';
import {DeckConfig, ServerMessage} from '../types';
import DeckGrid from '../components/DeckGrid';

type ConnStatus = 'connecting' | 'connected' | 'reconnecting';

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
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [flash, setFlash] = useState<Record<string, 'ok' | 'err'>>({});
  const [toast, setToast] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const portrait = useOrientation();

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
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
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

  return (
    <div className="flex min-h-full flex-col bg-slate-900 text-slate-100">
      <StatusBar status={status} />
      <main className="flex flex-1 items-center justify-center p-4">
        {config ? (
          <div className="w-full max-w-2xl">
            <DeckGrid
              config={config}
              mode="mobile"
              transpose={portrait}
              flash={flash}
              onCellClick={(_r, _c, button) => button && press(button.id)}
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
