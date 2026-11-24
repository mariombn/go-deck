import {beforeEach, afterEach, it, expect, vi} from 'vitest';
import {hardwareButtonImage, hardwareImages} from './hardwareImages';
import {ButtonConfig, DeckConfig} from '../types';

const ctx = {
  translate: vi.fn(), rotate: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn(),
  measureText: vi.fn((text: string) => ({width: Array.from(text).length * 8})),
  font: '', fillStyle: '', textAlign: '', textBaseline: '',
};
const button: ButtonConfig = {id: 'key', label: 'Teste', icon: '🎵', color: '#ffffff', position: {row: 0, col: 0}, action: {type: 'keypress', keys: ['mute']}};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,teste');
});
afterEach(() => { vi.restoreAllMocks(); });

it('gera JPEG 112x112 girado em 180° e preserva emoji/contraste', async () => {
  expect(await hardwareButtonImage(button)).toBe('data:image/jpeg;base64,teste');
  expect(ctx.translate).toHaveBeenCalledWith(112, 112);
  expect(ctx.rotate).toHaveBeenCalledWith(Math.PI);
  expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 112, 112);
  expect(ctx.fillText).toHaveBeenCalledWith('🎵', 56, 38, 100);
  expect(ctx.fillStyle).toBe('#0f172a');
  expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.88);
});

it('oculta rótulo no LCD e centraliza emoji em tamanho maior', async () => {
  await hardwareButtonImage({...button, hideLabel: true});
  expect(ctx.fillText).toHaveBeenCalledTimes(1);
  expect(ctx.fillText).toHaveBeenCalledWith('🎵', 56, 56, 100);
  expect(ctx.font).toBe('76px sans-serif');
});

it('limita rótulos longos e mostra reticências', async () => {
  await hardwareButtonImage({...button, icon: '', label: 'a'.repeat(300)});
  expect(ctx.fillText).toHaveBeenCalledTimes(4);
  expect(ctx.fillText.mock.calls[3][0]).toContain('…');
});

it('converte todas as páginas, omitindo posições fora do hardware', async () => {
  const config = {pages: [
    {buttons: [button, {...button, id: 'fora', position: {row: 3, col: 0}}]},
    {buttons: [{...button, id: 'outro'}]},
  ]} as DeckConfig;
  const result = await hardwareImages(config);
  expect(Object.keys(result)).toEqual(['key', 'outro']);
});
