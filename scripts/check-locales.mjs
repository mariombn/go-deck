// Validador dos arquivos de tradução (frontend/src/locales/*.json).
//
// Portão automático barato para PRs de tradução da comunidade (decisão P17):
// roda local (`npm run check:locales` dentro de frontend/) e pode ser plugado
// num CI futuro. Pega os erros mais comuns ANTES do merge:
//   - JSON malformado
//   - _meta.nativeName faltando
//   - chaves divergentes do en.json (faltando = erro; sobrando = aviso)
//   - placeholders {{var}} que não batem com o inglês
//
// O en.json é a referência (o único 100% garantido). Idiomas parciais são
// permitidos em runtime (fallback pro inglês), mas o check reporta o que falta
// para ajudar o contribuidor a completar.
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'frontend', 'src', 'locales');
const REF = 'en';
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

let errors = 0;
let warnings = 0;
const err = (m) => {
  errors++;
  console.error(`  ✗ ${m}`);
};
const warn = (m) => {
  warnings++;
  console.warn(`  ! ${m}`);
};

// flatten percorre o JSON aninhado em chaves pontuadas, pulando _meta no topo.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (prefix === '' && k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

// baseKey remove o sufixo de plural (plurais variam por idioma — _one/_other em
// inglês, mas outros idiomas têm _few/_many; comparar a chave base evita falsos
// positivos).
function baseKey(k) {
  for (const s of PLURAL_SUFFIXES) if (k.endsWith(s)) return k.slice(0, -s.length);
  return k;
}

function placeholders(s) {
  return new Set([...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
}

const files = readdirSync(localesDir).filter((f) => f.endsWith('.json'));
if (!files.includes(`${REF}.json`)) {
  console.error(`Referência ${REF}.json não encontrada em ${localesDir}`);
  process.exit(1);
}

// Carrega e valida JSON + _meta de cada arquivo.
const parsed = {};
for (const f of files) {
  const code = f.replace(/\.json$/, '');
  try {
    const raw = JSON.parse(readFileSync(join(localesDir, f), 'utf8'));
    parsed[code] = raw;
    if (!raw._meta || typeof raw._meta.nativeName !== 'string' || !raw._meta.nativeName.trim()) {
      console.error(`[${f}]`);
      err('_meta.nativeName ausente ou vazio (necessário para o seletor de idiomas)');
    }
  } catch (e) {
    console.error(`[${f}]`);
    err(`JSON inválido: ${e.message}`);
  }
}

const ref = flatten(parsed[REF] ?? {});
const refBaseKeys = new Set(Object.keys(ref).map(baseKey));

// Compara cada idioma (exceto a referência) contra o en.json.
for (const code of Object.keys(parsed)) {
  if (code === REF) continue;
  const flat = flatten(parsed[code]);
  const baseKeys = new Set(Object.keys(flat).map(baseKey));
  const before = errors + warnings;
  console.log(`\n[${code}.json] ${parsed[code]?._meta?.nativeName ?? ''}`);

  for (const bk of refBaseKeys) if (!baseKeys.has(bk)) err(`chave faltando: ${bk}`);
  for (const bk of baseKeys) if (!refBaseKeys.has(bk)) warn(`chave a mais (não existe no ${REF}): ${bk}`);

  // Placeholders: para cada chave presente nos dois, os {{var}} devem bater.
  for (const k of Object.keys(flat)) {
    if (!(k in ref)) continue;
    const a = placeholders(ref[k]);
    const b = placeholders(flat[k]);
    for (const p of a) if (!b.has(p)) err(`${k}: placeholder {{${p}}} faltando`);
    for (const p of b) if (!a.has(p)) warn(`${k}: placeholder {{${p}}} a mais`);
  }

  if (errors + warnings === before) console.log('  ✓ ok');
}

console.log(`\n${errors} erro(s), ${warnings} aviso(s).`);
process.exit(errors > 0 ? 1 : 0);
