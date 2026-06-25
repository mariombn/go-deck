// Testes do DeckButton: renderização de rótulo, ícone (emoji vs imagem),
// cor de fundo + contraste de texto, callback de clique e o resumo da ação
// (visível só no modo desktop).

import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Inicializa o i18n (DeckButton usa useTranslation). Idioma padrão: inglês.
import '../lib/i18n';
import {textColorFor} from '../lib/appearance';
import {ButtonConfig} from '../types';
import DeckButton from './DeckButton';

// Fábrica de botão com defaults sensatos; cada teste sobrescreve o que precisa.
function botao(over: Partial<ButtonConfig> = {}): ButtonConfig {
  return {
    id: 'b1',
    label: 'Salvar',
    position: {row: 0, col: 0},
    action: {type: 'keypress', keys: ['ctrl', 's']},
    ...over,
  };
}

// Data URL minúscula de 1x1 PNG transparente, suficiente p/ um <img>.
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYUx7zAAAAAElFTkSuQmCC';

describe('DeckButton', () => {
  it('renderiza o rótulo do botão', () => {
    render(<DeckButton button={botao({label: 'Salvar'})} mode="desktop" />);
    expect(screen.getByText('Salvar')).toBeInTheDocument();
  });

  it('mostra emoji como texto (não como imagem)', () => {
    render(<DeckButton button={botao({icon: '🎮', label: 'Jogar'})} mode="mobile" />);
    expect(screen.getByText('🎮')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('mostra ícone data URL como <img> com o src correto', () => {
    render(<DeckButton button={botao({icon: PNG_1X1})} mode="mobile" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', PNG_1X1);
  });

  it('aplica a cor de fundo e a cor de texto por contraste (fundo claro -> texto escuro)', () => {
    // Branco é claro: textColorFor devolve slate-900 (#0f172a).
    render(<DeckButton button={botao({color: '#ffffff', label: 'Claro'})} mode="desktop" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle({backgroundColor: '#ffffff'});
    expect(btn).toHaveStyle({color: textColorFor('#ffffff')});
    expect(textColorFor('#ffffff')).toBe('#0f172a');
  });

  it('aplica texto branco em fundo escuro (contraste)', () => {
    render(<DeckButton button={botao({color: '#000000', label: 'Escuro'})} mode="desktop" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle({color: '#fff'});
    expect(textColorFor('#000000')).toBe('#fff');
  });

  it('dispara o callback ao clicar', async () => {
    const onClick = vi.fn();
    render(<DeckButton button={botao()} mode="mobile" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exibe o resumo da ação no modo desktop', () => {
    render(
      <DeckButton
        button={botao({label: 'Salvar', action: {type: 'keypress', keys: ['ctrl', 's']}})}
        mode="desktop"
      />,
    );
    // comboLabel(["ctrl","s"]) -> "Ctrl + S".
    expect(screen.getByText('Ctrl + S')).toBeInTheDocument();
  });

  it('NÃO exibe o resumo da ação no modo mobile', () => {
    render(
      <DeckButton
        button={botao({label: 'Salvar', action: {type: 'keypress', keys: ['ctrl', 's']}})}
        mode="mobile"
      />,
    );
    expect(screen.queryByText('Ctrl + S')).not.toBeInTheDocument();
    // O rótulo continua aparecendo no mobile.
    expect(screen.getByText('Salvar')).toBeInTheDocument();
  });

  it('resume ação navigate no desktop usando o texto traduzido', () => {
    render(
      <DeckButton
        button={botao({label: 'Ir', action: {type: 'navigate', targetPage: 'p2'}})}
        mode="desktop"
      />,
    );
    // navigate -> "➡ Go to grid" (en.json).
    expect(screen.getByText(/Go to grid/)).toBeInTheDocument();
  });

  describe('estados vazios / sem ícone', () => {
    it('botão sem rótulo nem ícone mostra o placeholder "(no name)" no mobile', () => {
      render(<DeckButton button={botao({label: '', icon: undefined})} mode="mobile" />);
      expect(screen.getByText('(no name)')).toBeInTheDocument();
    });

    it('célula vazia (button null) no desktop vira alvo "+" clicável', async () => {
      const onClick = vi.fn();
      render(<DeckButton button={null} mode="desktop" onClick={onClick} />);
      const alvo = screen.getByRole('button');
      expect(alvo).toHaveTextContent('+');
      await userEvent.click(alvo);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('célula vazia (button null) no mobile é inerte (sem botão)', () => {
      render(<DeckButton button={null} mode="mobile" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('botão só-ícone (sem rótulo) no mobile não renderiza rótulo nem placeholder', () => {
      render(<DeckButton button={botao({label: '', icon: '🔥'})} mode="mobile" />);
      expect(screen.getByText('🔥')).toBeInTheDocument();
      expect(screen.queryByText('(no name)')).not.toBeInTheDocument();
    });
  });

  describe('flash (ack) tem prioridade sobre a cor custom', () => {
    it('em flash não aplica a cor de fundo custom via style inline', () => {
      const {container} = render(
        <DeckButton button={botao({color: '#ffffff'})} mode="mobile" flash="ok" />,
      );
      const btn = container.querySelector('button')!;
      // useColor = false quando há flash -> sem backgroundColor inline.
      expect(btn.style.backgroundColor).toBe('');
    });
  });
});
