import {ButtonConfig, DeckConfig} from '../types';
import {isImageIcon, textColorFor} from './appearance';

const SIZE = 112;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => reject(new Error('Tempo esgotado ao ler ícone')), 3000);
    image.onload = () => { window.clearTimeout(timeout); resolve(image); };
    image.onerror = () => { window.clearTimeout(timeout); reject(new Error('Ícone inválido')); };
    image.src = source;
  });
}

// O canvas usa as mesmas fontes/emoji do webview, sem ImageMagick, CDN ou
// dependências nativas. O firmware exige JPEG 112x112 girado em 180 graus.
export async function hardwareButtonImage(button: ButtonConfig): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.translate(SIZE, SIZE);
  ctx.rotate(Math.PI);
  ctx.fillStyle = button.color || '#1e293b';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = textColorFor(button.color);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hasIcon = !!button.icon;
  const iconOnly = button.hideLabel || !button.label.trim();
  if (hasIcon) {
    if (isImageIcon(button.icon)) {
      try {
        const image = await loadImage(button.icon!);
        const iconSize = iconOnly ? 100 : 64;
        const scale = Math.min(iconSize / image.width, iconSize / image.height);
        if (Number.isFinite(scale)) ctx.drawImage(image, (SIZE-image.width*scale)/2, 6+(iconSize-image.height*scale)/2, image.width*scale, image.height*scale);
      } catch {
        // Um ícone corrompido não deve impedir as outras teclas de aparecer.
      }
    } else {
      ctx.font = `${iconOnly ? 76 : 46}px sans-serif`;
      ctx.fillText(button.icon!, SIZE/2, iconOnly ? 56 : 38, 100);
    }
  }
  if (button.hideLabel) return canvas.toDataURL('image/jpeg', 0.88);
  ctx.font = `bold ${hasIcon ? 14 : 17}px sans-serif`;
  // Quebra por caracteres para também aceitar rótulos sem espaços. Limita
  // linhas e adiciona reticências, sem cortar caracteres Unicode ao meio.
  const lines: string[] = [];
  let line = '';
  for (const char of Array.from(button.label.replace(/\s+/g, ' ').trim())) {
    if (ctx.measureText(line+char).width > 98 && line) { lines.push(line.trim()); line = ''; }
    line += char;
  }
  if (line) lines.push(line.trim());
  const maxLines = hasIcon ? 2 : 4;
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines-1];
    while (last && ctx.measureText(last+'…').width > 98) last = Array.from(last).slice(0,-1).join('');
    lines[maxLines-1] = last+'…';
  }
  const step = hasIcon ? 17 : 21;
  const top = hasIcon ? 81 : SIZE/2-(lines.length-1)*step/2;
  lines.forEach((text, index) => ctx.fillText(text, SIZE/2, top+index*step, 100));
  return canvas.toDataURL('image/jpeg', 0.88);
}

export async function hardwareImages(config: DeckConfig): Promise<Record<string, string>> {
  if (document.fonts) await document.fonts.ready;
  const images: Record<string, string> = {};
  // Sequencial para não carregar centenas de imagens simultaneamente.
  for (const page of config.pages ?? []) {
    for (const button of page.buttons ?? []) {
      if (button.position.row < 3 && button.position.col < 5) images[button.id] = await hardwareButtonImage(button);
    }
  }
  return images;
}
