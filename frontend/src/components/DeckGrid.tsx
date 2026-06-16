import {ButtonConfig, DeckConfig} from '../types';
import DeckButton from './DeckButton';

interface Props {
  config: DeckConfig;
  mode: 'mobile' | 'desktop';
  // transpose: no celular em portrait, o grid NxM é renderizado como MxN
  // (decisão 10). O modelo de dados permanece intacto; só a renderização troca.
  transpose?: boolean;
  flash?: Record<string, 'ok' | 'err'>;
  onCellClick?: (row: number, col: number, button: ButtonConfig | null) => void;
}

export default function DeckGrid({config, mode, transpose, flash, onCellClick}: Props) {
  const {rows, cols} = config.grid;
  const buttons = config.buttons ?? [];
  const displayRows = transpose ? cols : rows;
  const displayCols = transpose ? rows : cols;

  const cells = [];
  for (let dr = 0; dr < displayRows; dr++) {
    for (let dc = 0; dc < displayCols; dc++) {
      // Mapeia a célula exibida para a posição canônica (r,c).
      const r = transpose ? dc : dr;
      const c = transpose ? dr : dc;
      const button = buttons.find((b) => b.position.row === r && b.position.col === c) ?? null;
      cells.push(
        <DeckButton
          key={`${r}-${c}`}
          button={button}
          mode={mode}
          flash={button ? flash?.[button.id] ?? null : null}
          onClick={onCellClick ? () => onCellClick(r, c, button) : undefined}
        />
      );
    }
  }

  return (
    <div
      className="grid w-full gap-3"
      style={{
        gridTemplateColumns: `repeat(${displayCols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${displayRows}, minmax(0, 1fr))`,
      }}
    >
      {cells}
    </div>
  );
}
