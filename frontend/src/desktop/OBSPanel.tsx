import {useState} from 'react';
import {OBSConfig} from '../types';
import * as App from '../../wailsjs/go/main/App';

interface Props {
  value: OBSConfig;
  onChange: (obs: OBSConfig) => void;
}

// TestOBS é gerado nos bindings do Wails (App.TestOBS). O cast evita acoplar
// o build do frontend isolado à regeneração dos bindings.
const testOBS = (c: OBSConfig): Promise<void> =>
  (App as unknown as {TestOBS: (c: OBSConfig) => Promise<void>}).TestOBS(c);

// OBSPanel edita a conexão do obs-websocket e oferece um teste de conexão.
// As mudanças marcam a config como suja (via onChange); a persistência é a
// mesma do resto (botão "Salvar configuração").
export default function OBSPanel({value, onChange}: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ok: boolean; text: string} | null>(null);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      await testOBS(value);
      setResult({ok: true, text: 'Conectado ✓'});
    } catch (e) {
      setResult({ok: false, text: String(e)});
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">OBS Studio</h2>

      <label className="mb-3 flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({...value, enabled: e.target.checked})}
          className="h-4 w-4"
        />
        Habilitar integração
      </label>

      <div className={value.enabled ? 'space-y-2' : 'space-y-2 opacity-40'}>
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-slate-400">
            Host
            <input
              value={value.host}
              disabled={!value.enabled}
              onChange={(e) => onChange({...value, host: e.target.value})}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            />
          </label>
          <label className="w-24 text-xs text-slate-400">
            Porta
            <input
              type="number"
              value={value.port}
              disabled={!value.enabled}
              onChange={(e) => onChange({...value, port: parseInt(e.target.value, 10) || 0})}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-400">
          Senha (obs-websocket)
          <input
            type="password"
            value={value.password}
            disabled={!value.enabled}
            onChange={(e) => onChange({...value, password: e.target.value})}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
          />
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={test}
            disabled={!value.enabled || testing}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600 disabled:opacity-40"
          >
            {testing ? 'Testando…' : 'Testar conexão'}
          </button>
          {result && (
            <span className={`text-xs ${result.ok ? 'text-green-400' : 'text-red-300'}`}>
              {result.text}
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Ative em <i>OBS → Ferramentas → Configurações do WebSocket Server</i>. A senha fica no
        config.json em texto puro.
      </p>
    </div>
  );
}
