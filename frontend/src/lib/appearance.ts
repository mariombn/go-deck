// Helpers de aparência dos botões (cor de fundo + ícone), compartilhados
// entre desktop e celular.

// isImageIcon distingue imagem (data URL base64) de emoji (qualquer outra
// string). Imagens sempre começam com "data:".
export function isImageIcon(icon: string | undefined): boolean {
  return !!icon && icon.startsWith('data:');
}

// textColorFor escolhe texto preto ou branco conforme a luminância do fundo,
// garantindo legibilidade em cores claras. Aceita hex (#rgb ou #rrggbb).
export function textColorFor(bg: string | undefined): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return '#fff';
  // Luminância relativa (aprox. ITU-R BT.601).
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum > 0.6 ? '#0f172a' : '#fff'; // slate-900 vs branco
}

// resizeImageToDataURL lê um arquivo de imagem e devolve uma data URL. Raster
// (PNG/JPG/…) é redimensionado num canvas para caber em max×max (mantendo a
// proporção) e exportado como PNG, mantendo o config.json enxuto. SVG passa
// direto (é texto, já pequeno e escalável).
export function resizeImageToDataURL(file: File, max = 128): Promise<string> {
  if (file.type === 'image/svg+xml') {
    return readAsDataURL(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas indisponível'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('imagem inválida'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

function hexToRgb(hex: string | undefined): {r: number; g: number; b: number} | null {
  if (!hex) return null;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
}
