// Tipos compartilhados entre desktop e celular, espelhando o modelo de dados
// do backend Go (config.DeckConfig) e o protocolo WebSocket.

export type KeypressAction = { type: 'keypress'; keys: string[] };
export type LaunchAction = { type: 'launch'; path: string; args?: string[] };
export type UrlAction = { type: 'url'; url: string };

// Passos de um sequence: qualquer ação que não seja outro sequence (o editor
// não expõe aninhamento, embora o backend aceite-o vindo do config.json).
export type StepAction = KeypressAction | LaunchAction | UrlAction;
export type SequenceAction = { type: 'sequence'; steps: StepAction[] };

export type Action = StepAction | SequenceAction;
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

export interface ServerConfig {
  port: number;
}

export interface DeckConfig {
  grid: Grid;
  server: ServerConfig;
  buttons: ButtonConfig[];
}

// --- Mensagens WebSocket ---

export type ServerMessage =
  | { type: 'config'; payload: DeckConfig }
  | { type: 'ack'; buttonId: string; ok: boolean; error?: string };

export type ClientMessage = { type: 'press'; buttonId: string };
