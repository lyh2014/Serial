export type TransportType = 'sim-nrf' | 'sim-pid' | 'sim-justfloat' | 'sim-modbus' | 'web-serial' | 'tcp-client' | 'tcp-server' | 'udp';

export type TextEncoding = 'UTF-8' | 'ASCII' | 'GB2312' | 'UNICODE' | 'BIG5' | 'SHIFT_JIS';

export type ParityType = 'none' | 'even' | 'odd' | 'mark' | 'space';
export type StopBitsType = 1 | 1.5 | 2;
export type DataBitsType = 5 | 6 | 7 | 8;

export type ProtocolParserId =
  | 'auto'
  | 'firewater'
  | 'justfloat'
  | 'keyvalue'
  | 'binary-aa55'
  | 'modbus-rtu'
  | 'raw';

export interface SerialConnectionConfig {
  portName: string;
  transport: TransportType;
  baudRate: number;
  customBaudRate: boolean;
  dataBits: DataBitsType;
  parity: ParityType;
  stopBits: StopBitsType;
  dtr: boolean;
  rts: boolean;
  tcpHost: string;
  tcpPort: number;
  protocolParser: ProtocolParserId;
}

export interface ModemSignals {
  ri: boolean;
  dsr: boolean;
  cts: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  direction: 'rx' | 'tx' | 'sys' | 'err';
  rawBytes: Uint8Array;
  text: string;
  hexDump: string;
  protocolTag?: string;
  decodedSummary?: string;
}

export interface WaveformChannel {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  unit?: string;
  paneId: string;
  latestValue: number;
  minValue: number;
  maxValue: number;
  points: { x: number; y: number }[];
}

export type WaveformLayoutMode = 'single' | 'split-h' | 'split-v' | 'grid-2x2';

export interface ScriptPlugin {
  id: string;
  name: string;
  type: 'rx' | 'tx';
  description: string;
  enabled: boolean;
  builtIn?: boolean;
  code: string;
  lastError?: string | null;
}

export interface ExtendedCommand {
  id: string;
  name: string;
  payload: string;
  isHex: boolean;
  delayMs: number;
  group: string;
}

export interface SearchMatch {
  entryId: string;
  entryIndex: number;
  start: number;
  end: number;
}

export interface AppSettings {
  encoding: TextEncoding;
  fontSize: number;
  maxLogLines: number;
  alwaysOnTopHint: boolean;
  txEchoColor: string;
  rxTextColor: string;
  waveformBufferSize: number;
  showWaveformGrid: boolean;
  autoTimestampFormat: 'HH:mm:ss.SSS' | 'elapsed';
}

export type MainViewMode = 'terminal' | 'waveform' | 'plugins' | 'docs' | 'commands';
