// Sincroniza os metadados nativos do Wails com a versão do release.
// Windows e CFBundleShortVersionString exigem a parte numérica, sem sufixo.
import {readFileSync, writeFileSync} from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  throw new Error('Informe uma versão normalizada, como 0.1.0.');
}
const project = JSON.parse(readFileSync('wails.json', 'utf8'));
project.info = {...project.info, productVersion: version.split(/[+-]/)[0]};
writeFileSync('wails.json', JSON.stringify(project, null, 2) + '\n');
console.log(`Metadados nativos: ${project.info.productVersion} (release ${version}).`);
