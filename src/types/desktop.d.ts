export interface DesktopBridge {
  isElectron: boolean;
  platform: string;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  netConnect: (opts: {
    mode: 'tcp-client' | 'udp';
    host: string;
    port: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  netSend: (bytes: number[]) => Promise<{ ok: boolean; error?: string }>;
  netDisconnect: () => Promise<{ ok: boolean }>;
  onNetData: (callback: (bytes: Uint8Array) => void) => () => void;
  onNetStatus: (callback: (status: { connected: boolean; message: string }) => void) => () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

export {};
