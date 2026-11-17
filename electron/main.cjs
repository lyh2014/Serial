const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const net = require('net');
const dgram = require('dgram');

let mainWindow = null;
let activeTcpSocket = null;
let activeUdpSocket = null;
let udpTarget = { host: '127.0.0.1', port: 9001 };

function sendNetEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function closeActiveSockets() {
  if (activeTcpSocket) {
    try {
      activeTcpSocket.destroy();
    } catch (_) {
      // ignore
    }
    activeTcpSocket = null;
  }
  if (activeUdpSocket) {
    try {
      activeUdpSocket.close();
    } catch (_) {
      // ignore
    }
    activeUdpSocket = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: 'SerialPulse · 串口调试助手 + TCP/UDP',
    backgroundColor: '#0B0E14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Enable Web Serial API hardware COM port selection inside Electron
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'serial') return true;
    return false;
  });

  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial') return true;
    return false;
  });

  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    if (portList && portList.length > 0) {
      // Notify renderer of discovered COM ports and pick first available port if not specified
      sendNetEvent('desktop:serial-ports', portList.map((p) => ({
        portId: p.portId,
        portName: p.portName,
        displayName: p.displayName || p.portName,
      })));
      callback(portList[0].portId);
    } else {
      callback('');
    }
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    closeActiveSockets();
    mainWindow = null;
  });
}

ipcMain.handle('desktop:set-always-on-top', (_event, flag) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle('desktop:net-connect', async (_event, { mode, host, port }) => {
  closeActiveSockets();

  if (mode === 'tcp-client') {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      activeTcpSocket = socket;

      const onError = (err) => {
        sendNetEvent('desktop:net-status', {
          connected: false,
          message: `TCP 错误: ${err.message}`,
        });
        resolve({ ok: false, error: err.message });
      };

      socket.once('error', onError);
      socket.connect(Number(port) || 9000, host || '127.0.0.1', () => {
        socket.removeListener('error', onError);
        sendNetEvent('desktop:net-status', {
          connected: true,
          message: `已连接 TCP ${host}:${port}`,
        });
        resolve({ ok: true });
      });

      socket.on('data', (chunk) => {
        sendNetEvent('desktop:net-data', Array.from(chunk));
      });

      socket.on('error', (err) => {
        sendNetEvent('desktop:net-status', {
          connected: false,
          message: `TCP 连接异常: ${err.message}`,
        });
      });

      socket.on('close', () => {
        if (activeTcpSocket === socket) activeTcpSocket = null;
        sendNetEvent('desktop:net-status', {
          connected: false,
          message: 'TCP 连接已关闭',
        });
      });
    });
  }

  if (mode === 'udp') {
    return new Promise((resolve) => {
      const sock = dgram.createSocket('udp4');
      activeUdpSocket = sock;
      udpTarget = { host: host || '127.0.0.1', port: Number(port) || 9001 };

      sock.on('message', (msg) => {
        sendNetEvent('desktop:net-data', Array.from(msg));
      });

      sock.on('error', (err) => {
        sendNetEvent('desktop:net-status', {
          connected: false,
          message: `UDP 错误: ${err.message}`,
        });
        resolve({ ok: false, error: err.message });
      });

      sock.bind(0, () => {
        sendNetEvent('desktop:net-status', {
          connected: true,
          message: `UDP 就绪 -> ${udpTarget.host}:${udpTarget.port}`,
        });
        resolve({ ok: true });
      });
    });
  }

  return { ok: false, error: 'Unsupported network mode' };
});

ipcMain.handle('desktop:net-send', async (_event, byteArray) => {
  const buf = Buffer.from(byteArray || []);
  if (activeTcpSocket && !activeTcpSocket.destroyed) {
    return new Promise((resolve) => {
      activeTcpSocket.write(buf, (err) => {
        resolve(err ? { ok: false, error: err.message } : { ok: true });
      });
    });
  }
  if (activeUdpSocket) {
    return new Promise((resolve) => {
      activeUdpSocket.send(buf, udpTarget.port, udpTarget.host, (err) => {
        resolve(err ? { ok: false, error: err.message } : { ok: true });
      });
    });
  }
  return { ok: false, error: 'Socket not connected' };
});

ipcMain.handle('desktop:net-disconnect', async () => {
  closeActiveSockets();
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeActiveSockets();
  if (process.platform !== 'darwin') app.quit();
});
