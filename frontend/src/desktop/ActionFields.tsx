import {Trans, useTranslation} from 'react-i18next';
import {Action, ActionType, DiscordOp, ObsOp, StepAction} from '../types';
import KeyCapture from './KeyCapture';

// Teto da duração de "apertar e manter", em ms. Espelha o maxHoldMs do backend
// (internal/action). 0 = toque rápido.
export const MAX_HOLD_MS = 5000;

// Tipos de ação. labelKey aponta para a tradução (rótulo amigável). STEP_TYPES
// exclui 'sequence' porque o editor não expõe sequence-dentro-de-sequence (o
// backend até aceita, mas a UI fica plana — ver CLAUDE.md/kanban).
export const ACTION_TYPES: {value: ActionType; labelKey: string}[] = [
  {value: 'keypress', labelKey: 'actions.types.keypress'},
  {value: 'launch', labelKey: 'actions.types.launch'},
  {value: 'url', labelKey: 'actions.types.url'},
  {value: 'obs', labelKey: 'actions.types.obs'},
  {value: 'discord', labelKey: 'actions.types.discord'},
  {value: 'navigate', labelKey: 'actions.types.navigate'},
  {value: 'sequence', labelKey: 'actions.types.sequence'},
];
// Passos de sequence excluem 'sequence' (sem aninhamento na UI) e 'navigate'
// (navegação é client-side, não se mistura com ações executadas no PC).
export const STEP_TYPES = ACTION_TYPES.filter((t) => t.value !== 'sequence' && t.value !== 'navigate');

// Operações do OBS. targetLabelKey presente => a operação exige um alvo
// (cena/fonte/hotkey); ausente => não precisa (toggles).
export const OBS_OPS: {value: ObsOp; labelKey: string; targetLabelKey?: string}[] = [
  {value: 'scene', labelKey: 'actions.obs.ops.scene', targetLabelKey: 'actions.obs.ops.sceneTarget'},
  {value: 'toggle_record', labelKey: 'actions.obs.ops.toggleRecord'},
  {value: 'toggle_stream', labelKey: 'actions.obs.ops.toggleStream'},
  {value: 'toggle_mute', labelKey: 'actions.obs.ops.toggleMute', targetLabelKey: 'actions.obs.ops.toggleMuteTarget'},
  {value: 'hotkey', labelKey: 'actions.obs.ops.hotkey', targetLabelKey: 'actions.obs.ops.hotkeyTarget'},
];

const DISCORD_OPS: {value: DiscordOp; labelKey: string}[] = [
  {value: 'mute', labelKey: 'actions.discord.ops.mute'},
  {value: 'deafen', labelKey: 'actions.discord.ops.deafen'},
];

const obsNeedsTarget = (op: ObsOp) => !!OBS_OPS.find((o) => o.value === op)?.targetLabelKey;

// emptyAction devolve uma ação "em branco" do tipo pedido (ao trocar o tipo
// no dropdown, recomeçamos com os campos do novo tipo).
export function emptyAction(type: ActionType): Action {
  switch (type) {
    case 'keypress':
      return {type: 'keypress', keys: [], holdMs: 0};
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
    case 'keypress': {
      const hold = a.holdMs ?? 0;
      return a.keys.length > 0 && hold >= 0 && hold <= MAX_HOLD_MS;
    }
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
  const {t} = useTranslation();
  const types = allowSequence ? ACTION_TYPES : STEP_TYPES;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-slate-400">{t('actions.typeLabel')}</label>
        <select
          value={value.type}
          onChange={(e) => onChange(emptyAction(e.target.value as ActionType))}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
        >
          {types.map((ty) => (
            <option key={ty.value} value={ty.value}>
              {t(ty.labelKey)}
            </option>
          ))}
        </select>
      </div>

      {value.type === 'keypress' && (
        <div className="space-y-3">
          <KeyCapture value={value.keys} onChange={(keys) => onChange({...value, keys})} />
          <div>
            <label className="mb-1 block text-sm text-slate-400">
              {t('actions.keypress.holdLabel')} <span className="text-slate-500">{t('actions.keypress.holdHint')}</span>
            </label>
            <input
              type="number"
              min={0}
              max={MAX_HOLD_MS / 1000}
              step={0.1}
              value={(value.holdMs ?? 0) / 1000}
              onChange={(e) => {
                const secs = parseFloat(e.target.value);
                const ms = Number.isFinite(secs) ? Math.round(secs * 1000) : 0;
                const clamped = Math.min(MAX_HOLD_MS, Math.max(0, ms));
                onChange({...value, holdMs: clamped});
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t('actions.keypress.holdHelp', {max: MAX_HOLD_MS / 1000})}
            </p>
          </div>
        </div>
      )}

      {value.type === 'launch' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">{t('actions.launch.pathLabel')}</label>
            <input
              value={value.path}
              onChange={(e) => onChange({...value, path: e.target.value})}
              placeholder={t('actions.launch.pathPlaceholder')}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">
              {t('actions.launch.argsLabel')} <span className="text-slate-500">{t('actions.launch.argsHint')}</span>
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
          <label className="mb-1 block text-sm text-slate-400">{t('actions.url.label')}</label>
          <input
            value={value.url}
            onChange={(e) => onChange({type: 'url', url: e.target.value})}
            placeholder={t('actions.url.placeholder')}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {value.type === 'obs' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">{t('actions.obs.opLabel')}</label>
            <select
              value={value.obsOp}
              onChange={(e) => onChange({...value, obsOp: e.target.value as ObsOp})}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
            >
              {OBS_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {obsNeedsTarget(value.obsOp) && (
            <div>
              <label className="mb-1 block text-sm text-slate-400">
                {t(OBS_OPS.find((o) => o.value === value.obsOp)!.targetLabelKey!)}
              </label>
              <input
                value={value.target ?? ''}
                onChange={(e) => onChange({...value, target: e.target.value})}
                placeholder={t('actions.obs.targetPlaceholder')}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <p className="text-xs text-slate-500">
            {t('actions.obs.help')}
          </p>
        </div>
      )}

      {value.type === 'discord' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">{t('actions.discord.opLabel')}</label>
            <select
              value={value.discordOp}
              onChange={(e) => onChange({...value, discordOp: e.target.value as DiscordOp})}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
            >
              {DISCORD_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">{t('actions.discord.keyLabel')}</label>
            <KeyCapture value={value.keys} onChange={(keys) => onChange({...value, keys})} />
          </div>
          <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-300">
            <Trans i18nKey="actions.discord.help" components={{1: <b />}} />
          </p>
        </div>
      )}

      {value.type === 'navigate' && (
        <div>
          <label className="mb-1 block text-sm text-slate-400">{t('actions.navigate.label')}</label>
          <select
            value={value.targetPage}
            onChange={(e) => onChange({type: 'navigate', targetPage: e.target.value})}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="">{t('actions.navigate.select')}</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            {t('actions.navigate.help')}
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
  const {t} = useTranslation();
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
      <span className="block text-sm text-slate-400">{t('actions.sequence.steps')}</span>
      {value.length === 0 && (
        <p className="text-xs text-slate-500">{t('actions.sequence.empty')}</p>
      )}
      {value.map((step, i) => (
        <div key={i} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{t('actions.sequence.step', {n: i + 1})}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                title={t('actions.sequence.moveUp')}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                title={t('actions.sequence.moveDown')}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                title={t('actions.sequence.removeStep')}
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
        {t('actions.sequence.addStep')}
      </button>
    </div>
  );
}
