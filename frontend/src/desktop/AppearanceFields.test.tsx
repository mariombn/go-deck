// Testes de comportamento do AppearanceFields: cor de fundo, abas de ícone
// (none/emoji/image/app), upload de imagem e galeria de apps do SO. Em pt-BR.
//
// i18n real (en) por '../lib/i18n'. Mockamos:
//  - emoji-picker-react: stub leve que dispara onEmojiClick com um emoji fixo.
//  - '../lib/appearance': mantemos isImageIcon real, mas trocamos
//    resizeImageToDataURL por um vi.fn() determinístico (evita canvas/FileReader).
//  - bindings Wails: ListInstalledApps / PickAppIcon.

import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '../lib/i18n';
import AppearanceFields from './AppearanceFields';

const resizeMock = vi.fn(async (_f: File) => 'data:image/png;base64,RESIZED');

vi.mock('../lib/appearance', async () => {
  const real = await vi.importActual<typeof import('../lib/appearance')>('../lib/appearance');
  return {...real, resizeImageToDataURL: (f: File) => resizeMock(f)};
});

vi.mock('emoji-picker-react', () => ({
  EmojiStyle: {NATIVE: 'native'},
  default: ({onEmojiClick}: {onEmojiClick: (e: {emoji: string}) => void}) => (
    <button type="button" onClick={() => onEmojiClick({emoji: '😀'})}>
      pick-emoji
    </button>
  ),
}));

const listApps = vi.fn();
const pickAppIcon = vi.fn();
vi.mock('../../wailsjs/go/main/App', () => ({
  ListInstalledApps: (...a: unknown[]) => listApps(...a),
  PickAppIcon: (...a: unknown[]) => pickAppIcon(...a),
}));

const IMG = 'data:image/png;base64,AAAA';

function setup(props: Partial<React.ComponentProps<typeof AppearanceFields>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <AppearanceFields icon={undefined} color={undefined} onChange={onChange} {...props} />,
  );
  return {onChange, ...utils};
}

beforeEach(() => {
  resizeMock.mockClear();
  listApps.mockReset();
  pickAppIcon.mockReset();
});

describe('AppearanceFields — cor', () => {
  it('clicar num preset emite a cor; "default" limpa', () => {
    const {onChange} = setup();
    // Primeiro preset da paleta.
    fireEvent.click(screen.getByTitle('#4f46e5'));
    expect(onChange).toHaveBeenLastCalledWith({color: '#4f46e5'});

    fireEvent.click(screen.getByText('default'));
    expect(onChange).toHaveBeenLastCalledWith({color: ''});
  });

  it('o input de cor custom emite o valor escolhido', () => {
    const {onChange} = setup();
    const colorInput = screen.getByTitle('Custom color') as HTMLInputElement;
    fireEvent.change(colorInput, {target: {value: '#123456'}});
    expect(onChange).toHaveBeenLastCalledWith({color: '#123456'});
  });
});

describe('AppearanceFields — abas de ícone', () => {
  it('aba começa em "none" quando não há ícone', () => {
    setup();
    // Sem ícone -> nenhuma das superfícies emoji/image/app aparece de início.
    expect(screen.queryByText('Choose emoji')).toBeNull();
  });

  it('com emoji existente, a aba inicial é emoji e mostra o caractere atual', () => {
    setup({icon: '🔥'});
    const botao = screen.getByText('Choose emoji');
    expect(botao).toBeInTheDocument();
    expect(botao.textContent).toContain('🔥');
  });

  it('escolher emoji no picker emite o caractere e fecha o overlay', () => {
    const {onChange} = setup({icon: '🔥'});
    fireEvent.click(screen.getByText('Choose emoji')); // abre overlay
    fireEvent.click(screen.getByText('pick-emoji'));
    expect(onChange).toHaveBeenLastCalledWith({icon: '😀'});
    // Overlay fechou: o picker stub some.
    expect(screen.queryByText('pick-emoji')).toBeNull();
  });

  it('trocar para a aba emoji (vindo de none) limpa o ícone', () => {
    const {onChange} = setup();
    fireEvent.click(screen.getByRole('button', {name: 'Emoji'}));
    expect(onChange).toHaveBeenCalledWith({icon: ''});
  });
});

describe('AppearanceFields — upload de imagem', () => {
  it('selecionar arquivo chama resizeImageToDataURL e emite a data URL', async () => {
    const {onChange} = setup();
    fireEvent.click(screen.getByRole('button', {name: 'Image'}));
    const file = new File(['x'], 'logo.png', {type: 'image/png'});
    // O input file está escondido; pega por type.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {target: {files: [file]}});
    await waitFor(() => {
      expect(resizeMock).toHaveBeenCalledWith(file);
      expect(onChange).toHaveBeenLastCalledWith({icon: 'data:image/png;base64,RESIZED'});
    });
  });

  it('imagem existente mostra preview e botão de remover', () => {
    const {onChange} = setup({icon: IMG});
    expect(screen.getByText('Change image')).toBeInTheDocument();
    fireEvent.click(screen.getByText('remove'));
    expect(onChange).toHaveBeenLastCalledWith({icon: ''});
  });

  it('erro no resize exibe a mensagem', async () => {
    resizeMock.mockRejectedValueOnce(new Error('imagem inválida'));
    setup();
    fireEvent.click(screen.getByRole('button', {name: 'Image'}));
    const file = new File(['x'], 'bad.png', {type: 'image/png'});
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {target: {files: [file]}});
    await waitFor(() => {
      expect(screen.getByText(/imagem inválida/)).toBeInTheDocument();
    });
  });
});

describe('AppearanceFields — aba App (ícones do SO)', () => {
  it('carrega a lista de apps ao abrir a aba e filtra por nome', async () => {
    listApps.mockResolvedValue([
      {name: 'Notepad', path: 'C:\\notepad.exe', icon: IMG},
      {name: 'Calculadora', path: 'C:\\calc.exe', icon: IMG},
    ]);
    const {onChange} = setup();
    fireEvent.click(screen.getByRole('button', {name: 'App'}));

    await waitFor(() => expect(screen.getByTitle('Notepad')).toBeInTheDocument());
    expect(listApps).toHaveBeenCalledTimes(1);

    // Filtra: digitar "calc" esconde o Notepad.
    fireEvent.change(screen.getByPlaceholderText('Filter apps…'), {target: {value: 'calc'}});
    expect(screen.queryByTitle('Notepad')).toBeNull();
    expect(screen.getByTitle('Calculadora')).toBeInTheDocument();

    // Clicar num app emite o ícone dele.
    fireEvent.click(screen.getByTitle('Calculadora'));
    expect(onChange).toHaveBeenLastCalledWith({icon: IMG});
  });

  it('seletor nativo (PickAppIcon) emite o ícone retornado', async () => {
    listApps.mockResolvedValue([]);
    pickAppIcon.mockResolvedValue(IMG);
    const {onChange} = setup();
    fireEvent.click(screen.getByRole('button', {name: 'App'}));
    await waitFor(() => expect(screen.getByText('No apps found.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Choose from system…'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({icon: IMG}));
  });

  it('erro ao listar apps exibe a mensagem', async () => {
    listApps.mockRejectedValue(new Error('falha SO'));
    setup();
    fireEvent.click(screen.getByRole('button', {name: 'App'}));
    await waitFor(() => expect(screen.getByText(/falha SO/)).toBeInTheDocument());
  });
});
