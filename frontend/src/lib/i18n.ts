// Configuração de i18n (internacionalização) do app.
//
// Auto-descoberta: cada arquivo em frontend/src/locales/*.json é um idioma
// completo. Largar um `es.json` novo adiciona o espanhol ao app SEM tocar em
// mais nada — o seletor o exibe sozinho. O mesmo conjunto de arquivos é lido
// pelo Go (embed.FS) para traduzir as mensagens de erro, então "um arquivo =
// um idioma" cobre UI e backend de uma vez.
//
// O nome exibido vem do campo `_meta.nativeName` dentro do próprio JSON; o
// código do idioma vem do nome do arquivo (es.json -> "es"; pt-BR.json ->
// "pt-BR"). Chaves faltando caem para o inglês (fallbackLng), então traduções
// parciais já são utilizáveis.
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';

// import.meta.glob com eager: o Vite resolve em build e embute todos os JSONs.
const modules = import.meta.glob('../locales/*.json', {eager: true});

export interface LangMeta {
  code: string;
  nativeName: string;
  englishName?: string;
}

export const DEFAULT_LANG = 'en';

const resources: Record<string, {translation: Record<string, unknown>}> = {};
export const LANGUAGES: LangMeta[] = [];

for (const path in modules) {
  const code = path.split('/').pop()!.replace(/\.json$/, '');
  const data = ((modules[path] as {default?: unknown}).default ?? modules[path]) as Record<string, any>;
  resources[code] = {translation: data};
  const meta = (data._meta ?? {}) as {nativeName?: string; englishName?: string};
  LANGUAGES.push({code, nativeName: meta.nativeName ?? code, englishName: meta.englishName});
}
LANGUAGES.sort((a, b) => a.nativeName.localeCompare(b.nativeName));

// isSupported permite ao chamador validar uma preferência salva antes de aplicá-la.
export function isSupported(lang: string): boolean {
  return !!resources[lang];
}

// detectLanguage escolhe o melhor idioma disponível para o locale do SO/navegador,
// caindo para inglês. Usado SÓ na 1ª vez (quando não há preferência salva). Tenta
// match exato (pt-BR) e depois por idioma base (pt-* -> pt-BR).
export function detectLanguage(): string {
  const navs = ((navigator.languages as string[]) ?? [navigator.language]).filter(Boolean);
  for (const l of navs) {
    if (resources[l]) return l;
    const base = l.split('-')[0];
    const hit = LANGUAGES.find((x) => x.code === base || x.code.split('-')[0] === base);
    if (hit) return hit.code;
  }
  return DEFAULT_LANG;
}

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  // _meta não é uma chave de tradução; mantida nos recursos só para a lista de
  // idiomas. Não precisa de tratamento especial (nunca é referenciada por t()).
  interpolation: {escapeValue: false}, // React já escapa; nossos textos são confiáveis
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: import.meta.env.DEV
    ? (lngs, _ns, key) => console.warn(`[i18n] chave faltando: "${key}" (${lngs.join(',')})`)
    : undefined,
});

// Mantém o atributo <html lang> coerente com o idioma ativo (acessibilidade/SEO).
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
});

// setLanguage troca o idioma ativo no cliente (a persistência/broadcast é feita
// por quem chama: o desktop via App.SetLanguage; o celular segue o config).
export function setLanguage(lang: string): void {
  if (isSupported(lang)) i18n.changeLanguage(lang);
}

export default i18n;
