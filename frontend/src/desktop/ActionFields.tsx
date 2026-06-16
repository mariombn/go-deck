import {Action, ActionType, DiscordOp, ObsOp, StepAction} from '../types';
import KeyCapture from './KeyCapture';

// Rótulos amigáveis dos tipos de ação. STEP_TYPES exclui 'sequence' porque o
// editor não expõe sequence-dentro-de-sequence (o backend até aceita, mas a
// UI fica plana — ver CLAUDE.md/kanban).
export const ACTION_TYPES: {value: ActionType; label: string}[] = [
  {value: 'keypress', label: 'Atalho de teclas'},
  {value: 'launch', label: 'Abrir programa'},
  {value: 'url', label: 'Abrir URL'},
  {value: 'obs', label: 'OBS Studio'},
  {value: 'discord', label: 'Discord'},
  {value: 'navigate', label: 'Ir para outro grid'},
  {value: 'sequence', label: 'Sequência'},
];
// Passos de sequence excluem 'sequence' (sem aninhamento na UI) e 'navigate'
// (navegação é client-side, não se mistura com ações executadas no PC).
export const STEP_TYPES = ACTION_TYPES.filter((t) => t.value !== 'sequence' && t.value !== 'navigate');

// Operações do OBS. targetLabel presente => a operação exige um alvo
// (cena/fonte/hotkey); ausente => não precisa (toggles).
export const OBS_OPS: {value: ObsOp; label: string; targetLabel?: string}[] = [
  {value: 'scene', label: 'Trocar de cena', targetLabel: 'Nome da cena'},
  {value: 'toggle_record', label: 'Gravação (liga/desliga)'},
  {value: 'toggle_stream', label: 'Transmissão (liga/desliga)'},
  {value: 'toggle_mute', label: 'Mudo da fonte (liga/desliga)', targetLabel: 'Nome da fonte de áudio'},
  {value: 'hotkey', label: 'Disparar hotkey', targetLabel: 'Nome da hotkey do OBS'},
];

const DISCORD_OPS: {value: DiscordOp; label: string}[] = [
  {value: 'mute', label: 'Alternar mudo (mute)'},
  {value: 'deafen', label: 'Alternar surdo (deafen)'},
];

const obsNeedsTarget = (op: ObsOp) => !!OBS_OPS.find((o) => o.value === op)?.targetLabel;

// emptyAction devolve uma ação "em branco" do tipo pedido (ao trocar o tipo
// no dropdown, recomeçamos com os campos do novo tipo).
export function emptyAction(type: ActionType): Action {
  switch (type) {
    case 'keypress':
      return {type: 'keypress', keys: []};
    case 'launch':
      return {type: 'launch', path: '', args: []};
    case 'url':
      return {type: 'url', url: ''};
    case 'obs':
      return {type: 'obs', obsOp: 'scene', target: ''};
    case 'discord':
      return {type: 'discord', discordOp: 'mute', keys: []};
    case 'navigate':
      return {type: 'navigate', targetPage: ''};
    case 'sequence':
      return {type: 'sequence', steps: []};
  }
}

// isActionValid espelha as validações do Build() no backend, para habilitar/
// desabilitar o botão "Salvar".
export function isActionValid(a: Action): boolean {
  switch (a.type) {
    case 'keypress':
      return a.keys.length > 0;
    case 'launch':
      return a.path.trim() !== '';
    case 'url':
      return a.url.trim() !== '';
    case 'obs':
      return !obsNeedsTarget(a.obsOp) || (a.target ?? '').trim() !== '';
    case 'discord':
      return a.keys.length > 0;
    case 'navigate':
      return a.targetPage !== '';
    case 'sequence':
      return a.steps.length > 0 && a.steps.every(isActionValid);
  }
}

// argsToText/textToArgs convertem o array de argumentos <-> textarea (um
// argumento por linha; sem shell, cada linha é um argv separado).
const argsToText = (args?: string[]) => (args ?? []).join('\n');
const textToArgs = (text: string) =>
  text.split('\n').map((l) => l.trim()).filter((l) => l !== '');

interface FieldsProps {
  value: Action;
  onChange: (a: Action) => void;
  // allowSequence=false nos passos de um sequence (sem aninhamento na UI,
  // que também esconde 'navigate').
  allowSequence?: boolean;
  // Lista de páginas (id+nome) para o destino de uma ação 'navigate'.
  pages?: {id: string; name: string}[];
}

// ActionFields renderiza o seletor de tipo + os campos do tipo selecionado.
// É reutilizado no nível do botão e em cada passo de um sequence.
export default function ActionFields({value, onChange, allowSequence = true, pages = []}: FieldsProps) {
  const types = allowSequence ? ACTION_TYPES : STEP_TYPES;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-slate-400">Tipo de ação</label>
        <select
          value={value.type}
          onChange={(e) => onChange(emptyAction(e.target.value as ActionType))}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {value.type === 'keypress' && (
        <KeyCapture value={value.keys} onChange={(keys) => onChange({type: 'keypress', keys})} />
      )}

      {value.type === 'launch' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Caminho do programa</label>
            <input
              value={value.path}
              onChange={(e) => onChange({...value, path: e.target.value})}
              placeholder="Ex.: C:\Windows\notepad.exe"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">
              Argumentos <span className="text-slate-500">(um por linha, opcional)</span>
            </label>
            <textarea
              value={argsToText(value.args)}
              onChange={(e) => onChange({...value, args: textToArgs(e.target.value)})}
              rows={2}
              placeholder={'arquivo.txt\n--flag'}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {value.type === 'url' && (
        <div>
          <label className="mb-1 block text-sm text-slate-400">URL</label>
          <input
            value={value.url}
            onChange={(e) => onChange({type: 'url', url: e.target.value})}
            placeholder="https://exemplo.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {value.type === 'obs' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Operação</label>
            <select
              value={value.obsOp}
              onChange={(e) => onChange({...value, obsOp: e.target.value as ObsOp})}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
            >
              {OBS_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {obsNeedsTarget(value.obsOp) && (
            <div>
              <label className="mb-1 block text-sm text-slate-400">
                {OBS_OPS.find((o) => o.value === value.obsOp)?.targetLabel}
              </label>
              <input
                value={value.target ?? ''}
                onChange={(e) => onChange({...value, target: e.target.value})}
                placeholder="Exatamente como aparece no OBS"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <p className="text-xs text-slate-500">
            Requer o obs-websocket habilitado no OBS e a conexão configurada no painel lateral.
          </p>
        </div>
      )}

      {value.type === 'discord' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Ação</label>
            <select
              value={value.discordOp}
              onChange={(e) => onChange({...value, discordOp: e.target.value as DiscordOp})}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
            >
              {DISCORD_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Tecla do keybind</label>
            <KeyCapture value={value.keys} onChange={(keys) => onChange({...value, keys})} />
          </div>
          <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-300">
            O Discord não expõe controle por rede: configure este atalho como <b>keybind global</b> nas
            Configurações → Atalhos de Teclado do Discord e capture aqui a mesma tecla.
          </p>
        </div>
      )}

      {value.type === 'navigate' && (
        <div>
          <label className="mb-1 block text-sm text-slate-400">Grid de destino</label>
          <select
            value={value.targetPage}
            onChange={(e) => onChange({type: 'navigate', targetPage: e.target.value})}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="">— selecione —</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Ao tocar no celular, troca para este grid (não envia nada ao PC).
          </p>
        </div>
      )}

      {value.type === 'sequence' && (
        <SequenceFields value={value.steps} onChange={(steps) => onChange({type: 'sequence', steps})} />
      )}
    </div>
  );
}

interface SequenceProps {
  value: StepAction[];
  onChange: (steps: StepAction[]) => void;
}

// SequenceFields edita a lista de passos: adicionar, remover e reordenar
// (setas ↑↓ — drag-and-drop é outro item do kanban). Cada passo é um
// ActionFields sem a opção 'sequence'.
function SequenceFields({value, onChange}: SequenceProps) {
  const update = (i: number, a: Action) => {
    const next = value.slice();
    next[i] = a as StepAction;
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...value, emptyAction('keypress') as StepAction]);

  return (
    <div className="space-y-3">
      <span className="block text-sm text-slate-400">Passos (executados em ordem)</span>
      {value.length === 0 && (
        <p className="text-xs text-slate-500">Nenhum passo ainda. Adicione o primeiro abaixo.</p>
      )}
      {value.map((step, i) => (
        <div key={i} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Passo {i + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                title="Mover para cima"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                title="Mover para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                title="Remover passo"
              >
                ✕
              </button>
            </div>
          </div>
          <ActionFields value={step} onChange={(a) => update(i, a)} allowSequence={false} />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full rounded-lg border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-indigo-300"
      >
        + Adicionar passo
      </button>
    </div>
  );
}
