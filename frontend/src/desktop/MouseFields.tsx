import {useTranslation} from 'react-i18next';
import {MouseAction, MouseButton, MouseOp} from '../types';
import Select from '../components/Select';

export default function MouseFields({value, onChange}: {value: MouseAction; onChange: (action: MouseAction) => void}) {
  const {t} = useTranslation();
  const click = value.mouseOp === 'click' || value.mouseOp === 'double_click';
  const scroll = value.mouseOp === 'scroll';
  const limit = scroll ? 100 : 10000;
  const field = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500';
  return <div className="space-y-3">
    <label className="block text-sm text-slate-400">{t('actions.mouse.operation')}
      <Select aria-label={t('actions.mouse.operation')} value={value.mouseOp} className={field}
        onChange={(op) => onChange(click && (op === 'click' || op === 'double_click')
          ? {...value, mouseOp: op, holdMs: 0}
          : {type: 'mouse', mouseOp: op as MouseOp, ...(op === 'click' || op === 'double_click' ? {mouseButton: 'left' as MouseButton} : {mouseX: 0, mouseY: 1})})}>
        {(['click', 'double_click', 'move', 'scroll'] as MouseOp[]).map((op) => <option key={op} value={op}>{t(`actions.mouse.ops.${op}`)}</option>)}
      </Select>
    </label>
    {click ? <>
      <label className="block text-sm text-slate-400">{t('actions.mouse.button')}
        <Select aria-label={t('actions.mouse.button')} value={value.mouseButton ?? 'left'} onChange={(button) => onChange({...value, mouseButton: button as MouseButton})} className={field}>
          {(['left', 'right', 'middle', 'back', 'forward'] as MouseButton[]).map((button) => <option key={button} value={button}>{t(`actions.mouse.buttons.${button}`)}</option>)}
        </Select>
      </label>
      {value.mouseOp === 'click' && <label className="block text-sm text-slate-400">{t('actions.keypress.holdLabel')} {t('actions.keypress.holdHint')}
        <input aria-label={t('actions.keypress.holdLabel')} type="number" min={0} max={5} step={0.1} className={field} value={(value.holdMs ?? 0)/1000}
          onChange={(event) => onChange({...value, holdMs: Math.max(0, Math.min(5000, Math.round((Number(event.target.value) || 0)*1000)))})} />
      </label>}
    </> : <>
      <div className="grid grid-cols-2 gap-2">
        {(['mouseX', 'mouseY'] as const).map((axis) => <label key={axis} className="text-sm text-slate-400">{t(`actions.mouse.${axis}`)}
          <input type="number" aria-label={t(`actions.mouse.${axis}`)} min={-limit} max={limit} step={1} value={value[axis] ?? 0} className={field}
            onChange={(event) => onChange({...value, [axis]: Math.max(-limit, Math.min(limit, Math.trunc(Number(event.target.value) || 0)))})} />
        </label>)}
      </div>
      <p className="text-xs text-slate-400">{t(scroll ? 'actions.mouse.scrollHelp' : 'actions.mouse.moveHelp')}</p>
    </>}
    <p className="text-xs text-slate-500">{t('actions.mouse.help')}</p>
  </div>;
}
