const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isElectron: true,
  platform: process.platform,
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('desktop:set-always-on-top', flag),
  netConnect: (opts) => ipcRenderer.invoke('desktop:net-connect', opts),
  netSend: (bytes) => ipcRenderer.invoke('desktop:net-send', bytes),
  netDisconnect: () => ipcRenderer.invoke('desktop:net-disconnect'),
  onNetData: (callback) => {
    const handler = (_event, data) => callback(new Uint8Array(data));
    ipcRenderer.on('desktop:net-data', handler);
    return () => ipcRenderer.removeListener('desktop:net-data', handler);
  },
  onNetStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('desktop:net-status', handler);
    return () => ipcRenderer.removeListener('desktop:net-status', handler);
  },
});
