// Tipos compartilhados entre desktop e celular, espelhando o modelo de dados
// do backend Go (config.DeckConfig) e o protocolo WebSocket.

export type KeypressAction = { type: 'keypress'; keys: string[] };
export type LaunchAction = { type: 'launch'; path: string; args?: string[] };
export type UrlAction = { type: 'url'; url: string };

// OBS Studio (obs-websocket). Operações scene/toggle_mute/hotkey usam target;
// os toggles de gravação/transmissão não.
export type ObsOp = 'scene' | 'toggle_record' | 'toggle_stream' | 'toggle_mute' | 'hotkey';
export type ObsAction = { type: 'obs'; obsOp: ObsOp; target?: string };

// Discord: por baixo é keypress (dispara o keybind global do Discord). O
// discordOp é só rótulo/UI.
export type DiscordOp = 'mute' | 'deafen';
export type DiscordAction = { type: 'discord'; discordOp: DiscordOp; keys: string[] };

// Passos de um sequence: qualquer ação que não seja outro sequence (o editor
// não expõe aninhamento, embora o backend aceite-o vindo do config.json).
export type StepAction = KeypressAction | LaunchAction | UrlAction | ObsAction | DiscordAction;
export type SequenceAction = { type: 'sequence'; steps: StepAction[] };

// Navegação entre grids (páginas). É resolvida no cliente: o celular troca a
// página exibida e NÃO envia press ao PC. targetPage é o id da página alvo.
export type NavigateAction = { type: 'navigate'; targetPage: string };

export type Action = StepAction | SequenceAction | NavigateAction;
export type ActionType = Action['type'];

export interface Position {
  row: number;
  col: number;
}

export interface ButtonConfig {
  id: string;
  label: string;
  position: Position;
  action: Action;
}

export interface Grid {
  rows: number;
  cols: number;
}

// Page é um grid independente ("área"), com tamanho e botões próprios.
export interface Page {
  id: string;
  name: string;
  grid: Grid;
  buttons: ButtonConfig[];
}

export interface ServerConfig {
  port: number;
}

export interface OBSConfig {
  enabled: boolean;
  host: string;
  port: number;
  password: string;
}

export interface Integrations {
  obs: OBSConfig;
}

export interface DeckConfig {
  pages: Page[];
  server: ServerConfig;
  integrations: Integrations;
}

// --- Mensagens WebSocket ---

export type ServerMessage =
  | { type: 'config'; payload: DeckConfig }
  | { type: 'ack'; buttonId: string; ok: boolean; error?: string };

export type ClientMessage = { type: 'press'; buttonId: string };
