import {isDesktop} from './lib/runtime';
import DesktopApp from './desktop/DesktopApp';
import MobileApp from './mobile/MobileApp';

// Um único bundle, dois modos: dentro do Wails (desktop) mostramos o editor
// de configuração + QR; no navegador do celular, só o grid de botões.
function App() {
  return isDesktop ? <DesktopApp /> : <MobileApp />;
}

export default App;
