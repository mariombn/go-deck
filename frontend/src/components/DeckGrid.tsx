import {useRef, useState} from 'react';
import {ButtonConfig, Page, Position} from '../types';
import DeckButton from './DeckButton';

interface Props {
  page: Page;
  mode: 'mobile' | 'desktop';
  // transpose: no celular em portrait, o grid NxM é renderizado como MxN
  // (decisão 10). O modelo de dados permanece intacto; só a renderização troca.
  transpose?: boolean;
  flash?: Record<string, 'ok' | 'err'>;
  onCellClick?: (row: number, col: number, button: ButtonConfig | null) => void;
  onMoveButton?: (from: Position, to: Position) => void;
}

export default function DeckGrid({page, mode, transpose, flash, onCellClick, onMoveButton}: Props) {
  const source = useRef<{pageId: string; position: Position} | null>(null);
  const blockClickUntil = useRef(0);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const finish = () => { source.current = null; setDragFrom(null); setDragOver(null); blockClickUntil.current = Date.now()+150; };
  const {rows, cols} = page.grid;
  const buttons = page.buttons ?? [];
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
        <div key={`${r}-${c}`} data-position={`${r}-${c}`}
          className={`min-w-0 rounded-2xl ${dragFrom === `${r}-${c}` ? 'opacity-40' : ''} ${dragOver === `${r}-${c}` ? 'ring-2 ring-cyan-400' : ''}`}
          draggable={mode === 'desktop' && !!button && !!onMoveButton}
          onDragStart={(event) => {
            if (mode !== 'desktop' || !button || !onMoveButton) { event.preventDefault(); return; }
            source.current = {pageId: page.id, position: {row: r, col: c}};
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-go-deck-cell', JSON.stringify(source.current));
            setDragFrom(`${r}-${c}`);
          }}
          onDragOver={(event) => {
            if (!onMoveButton || source.current?.pageId !== page.id) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(`${r}-${c}`);
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(event) => {
            if (!onMoveButton || source.current?.pageId !== page.id) return;
            event.preventDefault(); event.stopPropagation();
            onMoveButton(source.current.position, {row: r, col: c}); finish();
          }}
          onDragEnd={finish}>
          <DeckButton
            button={button}
            mode={mode}
            flash={button ? flash?.[button.id] ?? null : null}
            onClick={onCellClick ? () => { if (Date.now() >= blockClickUntil.current && !source.current) onCellClick(r, c, button); } : undefined}
          />
        </div>
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
