import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopToolbar } from './components/TopToolbar';
import { SerialSidebar } from './components/SerialSidebar';
import { TerminalPane } from './components/TerminalPane';
import { WaveformView } from './components/WaveformView';
import { PluginsView } from './components/PluginsView';
import { CommandsView } from './components/CommandsView';
import { DocsView } from './components/DocsView';
import { SettingsModal } from './components/SettingsModal';
import {
  AppSettings,
  ExtendedCommand,
  LogEntry,
  MainViewMode,
  ModemSignals,
  ScriptPlugin,
  SerialConnectionConfig,
  WaveformChannel,
} from './types/serial';
import {
  bytesToHexString,
  decodeTextEncoding,
  encodeText,
  formatHexDump,
  parseHexString,
  parseProtocolPacket,
} from './core/protocols';
import { DEFAULT_PLUGINS, runRxPlugin, runTxPlugin } from './core/pluginEngine';
import {
  buildSimulatedEchoReply,
  createNextSimulatedPacket,
  createSeedLogEntries,
  DEFAULT_EXTENDED_COMMANDS,
} from './core/simulator';

const WAVEFORM_COLORS = ['#F59E0B', '#38BDF8', '#10B981', '#A78BFA', '#FB7185', '#FACC15'];

function formatNowTimestamp(): string {
  const d = new Date();
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function unescapeControlChars(input: string): string {
  return input.replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

function createInitialWaveformChannels(): WaveformChannel[] {
  const defs = [
    { id: 'Coil_X_mA', name: 'Coil_X_mA', color: WAVEFORM_COLORS[0], paneId: 'pane-0' },
    { id: 'Coil_Y_mA', name: 'Coil_Y_mA', color: WAVEFORM_COLORS[1], paneId: 'pane-0' },
    { id: 'Coil_Z_mA', name: 'Coil_Z_mA', color: WAVEFORM_COLORS[2], paneId: 'pane-0' },
  ];
  return defs.map((d, chIdx) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 180; i++) {
      const t = i * 0.14;
      const val =
        chIdx === 0
          ? Math.sin(t) * 380 + Math.cos(t * 3.1) * 45
          : chIdx === 1
            ? Math.cos(t * 0.9) * 310 + Math.sin(t * 2.4) * 30
            : Math.sin(t * 0.5 + 1.1) * 240;
      pts.push({ x: i, y: Number(val.toFixed(2)) });
    }
    const ys = pts.map((p) => p.y);
    return {
      ...d,
      visible: true,
      latestValue: ys[ys.length - 1],
      minValue: Math.min(...ys),
      maxValue: Math.max(...ys),
      points: pts,
    };
  });
}

export default function App() {
  const [activeView, setActiveView] = useState<MainViewMode>('terminal');
  const [docsSection, setDocsSection] = useState('basics');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('serialpulse_settings_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      encoding: 'UTF-8',
      fontSize: 13,
      maxLogLines: 3000,
      alwaysOnTopHint: false,
      txEchoColor: '#F59E0B',
      rxTextColor: '#D5DEE8',
      waveformBufferSize: 800,
      showWaveformGrid: true,
      autoTimestampFormat: 'HH:mm:ss.SSS',
    };
  });

  const [config, setConfig] = useState<SerialConnectionConfig>({
    portName: 'COM17',
    transport: 'sim-nrf',
    baudRate: 115200,
    customBaudRate: false,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    dtr: true,
    rts: false,
    tcpHost: '127.0.0.1',
    tcpPort: 9000,
    protocolParser: 'auto',
  });

  const [isConnected, setIsConnected] = useState(false);
  const [modemSignals, setModemSignals] = useState<ModemSignals>({
    ri: false,
    dsr: false,
    cts: false,
  });

  // Receive & Send Sidebar Flags
  const [saveToFile, setSaveToFile] = useState(false);
  const [hexDisplay, setHexDisplay] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoFrameBreak, setAutoFrameBreak] = useState(true);
  const [frameBreakMs, setFrameBreakMs] = useState(20);
  const [rxScriptEnabled, setRxScriptEnabled] = useState(false);
  const [selectedRxPluginId, setSelectedRxPluginId] = useState('rx-zephyr-plot');
  const [hexSend, setHexSend] = useState(false);
  const [txScriptEnabled, setTxScriptEnabled] = useState(false);
  const [selectedTxPluginId, setSelectedTxPluginId] = useState('tx-add8');
  const [timerSendEnabled, setTimerSendEnabled] = useState(false);
  const [timerSendSec, setTimerSendSec] = useState(1.0);
  const [showTxInLog, setShowTxInLog] = useState(true);
  const [terminalMode, setTerminalMode] = useState(true);
  const [autoTogglePort, setAutoTogglePort] = useState(false);
  const [autoReconnect, setAutoReconnect] = useState(true);

  const [txInput, setTxInput] = useState('AT+INFO?');

  // Plugins state
  const [plugins, setPlugins] = useState<ScriptPlugin[]>(() => {
    try {
      const saved = localStorage.getItem('serialpulse_plugins_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PLUGINS;
  });
  const [editingPluginId, setEditingPluginId] = useState<string>(DEFAULT_PLUGINS[1].id);

  // Extended commands state
  const [extendedCommands, setExtendedCommands] = useState<ExtendedCommand[]>(() => {
    try {
      const saved = localStorage.getItem('serialpulse_commands_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_EXTENDED_COMMANDS;
  });

  // Logs & Counters
  const [logs, setLogs] = useState<LogEntry[]>(() => createSeedLogEntries());
  const [txByteCount, setTxByteCount] = useState(4);
  const [rxByteCount, setRxByteCount] = useState(19801);
  const [rxFrameCount, setRxFrameCount] = useState(94);

  // Waveform state
  const [channels, setChannels] = useState<WaveformChannel[]>(() => createInitialWaveformChannels());
  const sampleCursorRef = useRef(180);

  // Batch execution state
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [activeBatchStepId, setActiveBatchStepId] = useState<string | null>(null);
  const batchStopRef = useRef(false);

  // Web Serial refs
  const webSerialPortRef = useRef<{
    close: () => Promise<void>;
    writable?: WritableStream<Uint8Array>;
    readable?: ReadableStream<Uint8Array>;
  } | null>(null);
  const webSerialReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const simTickRef = useRef(0);

  // Persist user preferences, plugins, commands
  useEffect(() => {
    try {
      localStorage.setItem('serialpulse_settings_v1', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('serialpulse_plugins_v1', JSON.stringify(plugins));
    } catch {
      // ignore
    }
  }, [plugins]);

  useEffect(() => {
    try {
      localStorage.setItem('serialpulse_commands_v1', JSON.stringify(extendedCommands));
    } catch {
      // ignore
    }
  }, [extendedCommands]);

  const rxPlugins = useMemo(() => plugins.filter((p) => p.type === 'rx'), [plugins]);
  const txPlugins = useMemo(() => plugins.filter((p) => p.type === 'tx'), [plugins]);

  const activeRxPlugin = useMemo(
    () => (rxScriptEnabled ? plugins.find((p) => p.id === selectedRxPluginId) ?? null : null),
    [rxScriptEnabled, plugins, selectedRxPluginId]
  );

  const activeTxPlugin = useMemo(
    () => (txScriptEnabled ? plugins.find((p) => p.id === selectedTxPluginId) ?? null : null),
    [txScriptEnabled, plugins, selectedTxPluginId]
  );

  const appendWaveformSamples = useCallback(
    (pointsByChannel: Record<string, number>) => {
      const entries = Object.entries(pointsByChannel);
      if (entries.length === 0) return;
      const sampleX = sampleCursorRef.current++;

      setChannels((prev) => {
        const next = [...prev];
        for (const [name, rawVal] of entries) {
          if (!Number.isFinite(rawVal)) continue;
          const idx = next.findIndex((c) => c.name === name);
          if (idx === -1) {
            const color = WAVEFORM_COLORS[next.length % WAVEFORM_COLORS.length];
            next.push({
              id: name,
              name,
              color,
              visible: true,
              paneId: 'pane-0',
              latestValue: rawVal,
              minValue: rawVal,
              maxValue: rawVal,
              points: [{ x: sampleX, y: rawVal }],
            });
          } else {
            const ch = next[idx];
            const updatedPts = [...ch.points, { x: sampleX, y: rawVal }].slice(
              -settings.waveformBufferSize
            );
            next[idx] = {
              ...ch,
              latestValue: rawVal,
              minValue: Math.min(ch.minValue, rawVal),
              maxValue: Math.max(ch.maxValue, rawVal),
              points: updatedPts,
            };
          }
        }
        return next;
      });
    },
    [settings.waveformBufferSize]
  );

  const appendSystemLog = useCallback(
    (text: string, direction: 'sys' | 'err' = 'sys') => {
      const bytes = encodeText(text);
      setLogs((prev) => [
        ...prev.slice(-(settings.maxLogLines - 1)),
        {
          id: `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: formatNowTimestamp(),
          direction,
          rawBytes: bytes,
          text,
          hexDump: formatHexDump(bytes),
        },
      ]);
    },
    [settings.maxLogLines]
  );

  const handleIncomingPacket = useCallback(
    (rawBytes: Uint8Array) => {
      if (rawBytes.length === 0) return;

      setRxByteCount((c) => c + rawBytes.length);
      setRxFrameCount((c) => c + 1);

      if (isPaused) return;

      let decodedText = decodeTextEncoding(rawBytes, settings.encoding).replace(/\r?\n$/, '');
      let protocolTag: string | undefined;
      let decodedSummary: string | undefined;

      // 1. Run active RX JS plugin if enabled
      if (activeRxPlugin) {
        const res = runRxPlugin(activeRxPlugin, rawBytes, decodedText);
        if (res.error) {
          decodedSummary = `脚本错误: ${res.error}`;
        } else {
          if (res.writtenText.length > 0) {
            decodedText = res.writtenText.join('\n');
          }
          if (res.protocolTag) {
            protocolTag = res.protocolTag;
          }
          if (res.waveformPoints.length > 0) {
            const map: Record<string, number> = {};
            res.waveformPoints.forEach((pt) => {
              map[pt.channel] = pt.value;
            });
            appendWaveformSamples(map);
          }
        }
      }

      // 2. Run built-in multi-protocol parser
      const parsed = parseProtocolPacket(config.protocolParser, decodedText, rawBytes);
      if (parsed) {
        protocolTag = protocolTag ?? parsed.protocolName;
        decodedSummary = parsed.decodedSummary ?? decodedSummary;
        if (Object.keys(parsed.channels).length > 0) {
          appendWaveformSamples(parsed.channels);
        }
      }

      // If pure binary packet with non-printable chars (e.g. JustFloat / Modbus), show concise hex preview in text mode
      const hasControlBytes = rawBytes.some((b) => b < 0x09 || (b > 0x0d && b < 0x20));
      const displayText =
        hasControlBytes && decodedText.replace(/[^\x20-\x7e]/g, '').length < rawBytes.length / 2
          ? `[BIN ${rawBytes.length}B] ${bytesToHexString(rawBytes)}`
          : decodedText;

      const entry: LogEntry = {
        id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: formatNowTimestamp(),
        direction: 'rx',
        rawBytes,
        text: displayText,
        hexDump: formatHexDump(rawBytes),
        protocolTag,
        decodedSummary,
      };

      setLogs((prev) => [...prev.slice(-(settings.maxLogLines - 1)), entry]);
    },
    [
      isPaused,
      settings.encoding,
      settings.maxLogLines,
      activeRxPlugin,
      config.protocolParser,
      appendWaveformSamples,
    ]
  );

  const disconnectPort = useCallback(async () => {
    try {
      await webSerialReaderRef.current?.cancel();
      webSerialReaderRef.current = null;
      await webSerialPortRef.current?.close();
      webSerialPortRef.current = null;
      if (window.desktopBridge && (config.transport === 'tcp-client' || config.transport === 'udp')) {
        await window.desktopBridge.netDisconnect();
      }
    } catch {
      // ignore close errors
    }
    setIsConnected(false);
    setModemSignals({ ri: false, dsr: false, cts: false });
    appendSystemLog(`[系统] 已关闭端口 ${config.portName}`);
  }, [appendSystemLog, config.portName, config.transport]);

  const handleToggleConnect = useCallback(async () => {
    if (isConnected) {
      await disconnectPort();
      return;
    }

    if (config.transport === 'web-serial') {
      const nav = navigator as Navigator & {
        serial?: {
          requestPort: () => Promise<{
            open: (opts: {
              baudRate: number;
              dataBits: number;
              parity: string;
              stopBits: number;
            }) => Promise<void>;
            close: () => Promise<void>;
            readable?: ReadableStream<Uint8Array>;
            writable?: WritableStream<Uint8Array>;
          }>;
        };
      };
      if (!nav.serial) {
        appendSystemLog(
          '[提示] 当前浏览器或预览沙箱不支持 Web Serial API，请切换到 Chromium/Edge 桌面端或使用内置 COM17 / FireWater / JustFloat / Modbus 仿真端口。',
          'err'
        );
        return;
      }
      try {
        const port = await nav.serial.requestPort();
        await port.open({
          baudRate: config.baudRate,
          dataBits: config.dataBits,
          parity: config.parity,
          stopBits: config.stopBits,
        });
        webSerialPortRef.current = port;
        setIsConnected(true);
        setModemSignals({ ri: false, dsr: true, cts: true });
        appendSystemLog(`[系统] 已通过 Web Serial 连接实体端口 (${config.baudRate} bps)`);

        if (port.readable) {
          const reader = port.readable.getReader();
          webSerialReaderRef.current = reader;
          (async () => {
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) handleIncomingPacket(value);
              }
            } catch (err) {
              appendSystemLog(
                `[串口断开] ${err instanceof Error ? err.message : String(err)}`,
                'err'
              );
            } finally {
              setIsConnected(false);
            }
          })();
        }
      } catch (err) {
        appendSystemLog(
          `[连接取消] ${err instanceof Error ? err.message : '未选择物理串口'}`,
          'err'
        );
      }
      return;
    }

    // Real native TCP / UDP sockets when running inside Windows Electron .exe
    if (window.desktopBridge && (config.transport === 'tcp-client' || config.transport === 'udp')) {
      const res = await window.desktopBridge.netConnect({
        mode: config.transport,
        host: config.tcpHost,
        port: config.tcpPort,
      });
      if (res.ok) {
        setIsConnected(true);
        setModemSignals({ ri: false, dsr: true, cts: true });
      } else {
        appendSystemLog(`[网络错误] ${res.error ?? '无法建立连接'}`, 'err');
      }
      return;
    }

    // Simulated COM / TCP / UDP port
    setIsConnected(true);
    setModemSignals({ ri: false, dsr: true, cts: true });
    appendSystemLog(
      `[系统] 已打开 ${config.portName} (${config.baudRate}, ${config.dataBits}${config.parity[0].toUpperCase()}${config.stopBits}) · 解析模式: ${config.protocolParser}`
    );
  }, [isConnected, disconnectPort, config, appendSystemLog, handleIncomingPacket]);

  // Subscribe to Electron native TCP/UDP incoming data and status events
  useEffect(() => {
    if (!window.desktopBridge) return;
    const unsubData = window.desktopBridge.onNetData((bytes) => {
      handleIncomingPacket(bytes);
    });
    const unsubStatus = window.desktopBridge.onNetStatus((status) => {
      appendSystemLog(`[网络] ${status.message}`, status.connected ? 'sys' : 'err');
      if (!status.connected) {
        setIsConnected(false);
        setModemSignals({ ri: false, dsr: false, cts: false });
      }
    });
    return () => {
      unsubData();
      unsubStatus();
    };
  }, [handleIncomingPacket, appendSystemLog]);

  // Sync window always-on-top state in Electron desktop app
  useEffect(() => {
    window.desktopBridge?.setAlwaysOnTop(settings.alwaysOnTopHint);
  }, [settings.alwaysOnTopHint]);

  // Streaming simulation loop when connected on simulated ports
  useEffect(() => {
    const isNativeDesktopNet =
      Boolean(window.desktopBridge) &&
      (config.transport === 'tcp-client' || config.transport === 'udp');
    if (!isConnected || config.transport === 'web-serial' || isNativeDesktopNet) return;
    const intervalMs = config.transport === 'sim-pid' || config.transport === 'sim-justfloat' ? 75 : 160;
    const timer = window.setInterval(() => {
      simTickRef.current += 1;
      const pkt = createNextSimulatedPacket(config.transport, simTickRef.current);
      handleIncomingPacket(pkt.bytes);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isConnected, config.transport, handleIncomingPacket]);

  const sendPayload = useCallback(
    async (rawPayload: string, overrideHex?: boolean) => {
      const useHex = overrideHex !== undefined ? overrideHex : hexSend;
      let bytes: Uint8Array;
      try {
        bytes = useHex ? parseHexString(rawPayload) : encodeText(unescapeControlChars(rawPayload));
      } catch (err) {
        appendSystemLog(
          `[发送格式错误] ${err instanceof Error ? err.message : String(err)}`,
          'err'
        );
        return;
      }

      if (bytes.length === 0) return;

      // Apply active TX JS Plugin if enabled
      let txTag: string | undefined;
      if (activeTxPlugin) {
        const res = runTxPlugin(activeTxPlugin, bytes);
        if (res.error) {
          appendSystemLog(`[TX脚本错误] ${res.error}`, 'err');
        } else {
          bytes = res.outputBytes;
          txTag = activeTxPlugin.name;
        }
      }

      // Write to Web Serial if connected physically
      if (isConnected && config.transport === 'web-serial' && webSerialPortRef.current?.writable) {
        try {
          const writer = webSerialPortRef.current.writable.getWriter();
          await writer.write(bytes);
          writer.releaseLock();
        } catch (err) {
          appendSystemLog(
            `[写入失败] ${err instanceof Error ? err.message : String(err)}`,
            'err'
          );
        }
      }

      // Write to native Electron TCP/UDP socket if connected
      const isNativeDesktopNet =
        Boolean(window.desktopBridge) &&
        (config.transport === 'tcp-client' || config.transport === 'udp');
      if (isConnected && isNativeDesktopNet && window.desktopBridge) {
        const netRes = await window.desktopBridge.netSend(Array.from(bytes));
        if (!netRes.ok) {
          appendSystemLog(`[网络发送失败] ${netRes.error ?? '未连接'}`, 'err');
        }
      }

      setTxByteCount((c) => c + bytes.length);

      const txText = useHex
        ? bytesToHexString(bytes)
        : decodeTextEncoding(bytes, settings.encoding).replace(/\r?\n$/, '');

      setLogs((prev) => [
        ...prev.slice(-(settings.maxLogLines - 1)),
        {
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: formatNowTimestamp(),
          direction: 'tx',
          rawBytes: bytes,
          text: txText,
          hexDump: formatHexDump(bytes),
          protocolTag: txTag,
          decodedSummary: txTag ? `TX插件:${txTag}` : undefined,
        },
      ]);

      // Simulated device echo reply when connected to a virtual port
      if (isConnected && config.transport !== 'web-serial' && !isNativeDesktopNet) {
        const reply = buildSimulatedEchoReply(bytes, txText);
        if (reply) {
          setTimeout(() => handleIncomingPacket(reply), 45);
        }
      }
    },
    [
      hexSend,
      activeTxPlugin,
      isConnected,
      config.transport,
      settings.encoding,
      settings.maxLogLines,
      appendSystemLog,
      handleIncomingPacket,
    ]
  );

  // Timed Send loop
  useEffect(() => {
    if (!timerSendEnabled || !isConnected) return;
    const ms = Math.max(100, Math.round(timerSendSec * 1000));
    const id = window.setInterval(() => {
      if (txInput.trim()) {
        sendPayload(txInput);
      }
    }, ms);
    return () => window.clearInterval(id);
  }, [timerSendEnabled, isConnected, timerSendSec, txInput, sendPayload]);

  const handleSaveData = useCallback(() => {
    const content = logs
      .map((l) => (hexDisplay ? l.hexDump : `${l.direction === 'tx' ? `[TX ${l.timestamp}] ` : ''}${l.text}`))
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial_log_${config.portName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs, hexDisplay, config.portName]);

  const handleClearData = useCallback(() => {
    setLogs([]);
  }, []);

  const handleSendFileBytes = useCallback(
    (fileName: string, bytes: Uint8Array) => {
      appendSystemLog(`[文件发送] ${fileName} (${bytes.length} 字节)`);
      setTxByteCount((c) => c + bytes.length);
      setLogs((prev) => [
        ...prev.slice(-(settings.maxLogLines - 1)),
        {
          id: `tx-file-${Date.now()}`,
          timestamp: formatNowTimestamp(),
          direction: 'tx',
          rawBytes: bytes,
          text: `[FILE ${fileName}] ${bytes.length} bytes`,
          hexDump: formatHexDump(bytes.subarray(0, 256)),
        },
      ]);
    },
    [appendSystemLog, settings.maxLogLines]
  );

  const handleStartBatch = useCallback(async () => {
    if (extendedCommands.length === 0) return;
    batchStopRef.current = false;
    setIsBatchRunning(true);
    for (const cmd of extendedCommands) {
      if (batchStopRef.current) break;
      setActiveBatchStepId(cmd.id);
      await sendPayload(cmd.payload, cmd.isHex);
      await new Promise((r) => setTimeout(r, cmd.delayMs));
    }
    setActiveBatchStepId(null);
    setIsBatchRunning(false);
  }, [extendedCommands, sendPayload]);

  const handleStopBatch = useCallback(() => {
    batchStopRef.current = true;
    setIsBatchRunning(false);
    setActiveBatchStepId(null);
  }, []);

  // Global view switching & Ctrl+Shift+T shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setSettings((s) => ({ ...s, alwaysOnTopHint: !s.alwaysOnTopHint }));
      } else if (e.altKey && e.key === '1') {
        setActiveView('terminal');
      } else if (e.altKey && e.key === '2') {
        setActiveView('waveform');
      } else if (e.altKey && e.key === '3') {
        setActiveView('plugins');
      } else if (e.altKey && e.key === '4') {
        setActiveView('commands');
      } else if (e.altKey && e.key === '5') {
        setActiveView('docs');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activePluginCount =
    (rxScriptEnabled ? 1 : 0) + (txScriptEnabled ? 1 : 0);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0E14] text-[#E6EDF5] overflow-hidden">
      <TopToolbar
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenSettings={() => setSettingsOpen(true)}
        isConnected={isConnected}
        portLabel={config.portName}
        baudRate={config.baudRate}
        alwaysOnTop={settings.alwaysOnTopHint}
        onToggleAlwaysOnTop={() =>
          setSettings((s) => ({ ...s, alwaysOnTopHint: !s.alwaysOnTopHint }))
        }
        activePluginCount={activePluginCount}
      />

      <main className="flex-1 min-h-0 flex overflow-hidden">
        {activeView === 'terminal' && (
          <>
            <SerialSidebar
              config={config}
              onChangeConfig={(patch) => setConfig((prev) => ({ ...prev, ...patch }))}
              isConnected={isConnected}
              onToggleConnect={handleToggleConnect}
              modemSignals={modemSignals}
              saveToFile={saveToFile}
              onToggleSaveToFile={(v) => {
                setSaveToFile(v);
                if (v) handleSaveData();
              }}
              hexDisplay={hexDisplay}
              onToggleHexDisplay={setHexDisplay}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused((p) => !p)}
              autoFrameBreak={autoFrameBreak}
              onToggleAutoFrameBreak={setAutoFrameBreak}
              frameBreakMs={frameBreakMs}
              onChangeFrameBreakMs={setFrameBreakMs}
              rxScriptEnabled={rxScriptEnabled}
              onToggleRxScript={setRxScriptEnabled}
              selectedRxPluginId={selectedRxPluginId}
              onSelectRxPlugin={setSelectedRxPluginId}
              rxPlugins={rxPlugins}
              onEditPlugin={(id) => {
                setEditingPluginId(id);
                setActiveView('plugins');
              }}
              onSaveData={handleSaveData}
              onClearData={handleClearData}
              hexSend={hexSend}
              onToggleHexSend={setHexSend}
              txScriptEnabled={txScriptEnabled}
              onToggleTxScript={setTxScriptEnabled}
              selectedTxPluginId={selectedTxPluginId}
              onSelectTxPlugin={setSelectedTxPluginId}
              txPlugins={txPlugins}
              timerSendEnabled={timerSendEnabled}
              onToggleTimerSend={setTimerSendEnabled}
              timerSendSec={timerSendSec}
              onChangeTimerSendSec={setTimerSendSec}
              showTxInLog={showTxInLog}
              onToggleShowTxInLog={setShowTxInLog}
              txEchoColor={settings.txEchoColor}
              onChangeTxEchoColor={(c) => setSettings((s) => ({ ...s, txEchoColor: c }))}
              terminalMode={terminalMode}
              onToggleTerminalMode={setTerminalMode}
              autoTogglePort={autoTogglePort}
              onToggleAutoTogglePort={setAutoTogglePort}
              autoReconnect={autoReconnect}
              onToggleAutoReconnect={setAutoReconnect}
              onSendFileBytes={handleSendFileBytes}
              onOpenExtendedCommands={() => setActiveView('commands')}
              onOpenDocsSection={(sec) => {
                setDocsSection(sec);
                setActiveView('docs');
              }}
            />

            <TerminalPane
              logs={logs}
              hexDisplay={hexDisplay}
              showTxInLog={showTxInLog}
              txEchoColor={settings.txEchoColor}
              fontSize={settings.fontSize}
              terminalMode={terminalMode}
              hexSend={hexSend}
              rxScriptActiveName={activeRxPlugin?.name ?? null}
              txScriptActiveName={activeTxPlugin?.name ?? null}
              isConnected={isConnected}
              portLabel={config.portName}
              encoding={settings.encoding}
              txByteCount={txByteCount}
              rxByteCount={rxByteCount}
              rxFrameCount={rxFrameCount}
              onResetCounters={() => {
                setTxByteCount(0);
                setRxByteCount(0);
                setRxFrameCount(0);
              }}
              txInput={txInput}
              onChangeTxInput={setTxInput}
              onSendPayload={sendPayload}
              onClearLogs={handleClearData}
              onSaveLogs={handleSaveData}
              extendedCommands={extendedCommands}
            />
          </>
        )}

        {activeView === 'waveform' && (
          <WaveformView
            channels={channels}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused((p) => !p)}
            onClearWaveform={() => {
              setChannels([]);
              sampleCursorRef.current = 0;
            }}
            onToggleChannelVisible={(channelId) =>
              setChannels((prev) =>
                prev.map((c) => (c.id === channelId ? { ...c, visible: !c.visible } : c))
              )
            }
            onAssignChannelPane={(channelId, paneId) =>
              setChannels((prev) =>
                prev.map((c) => (c.id === channelId ? { ...c, paneId } : c))
              )
            }
            onImportCsvPoints={(rows) => {
              rows.forEach((r) => appendWaveformSamples(r));
            }}
            onInjectTestWave={() => {
              for (let i = 0; i < 40; i++) {
                const t = (sampleCursorRef.current + i) * 0.16;
                appendWaveformSamples({
                  Coil_X_mA: Number((Math.sin(t) * 420).toFixed(2)),
                  Coil_Y_mA: Number((Math.cos(t * 0.8) * 340).toFixed(2)),
                  Coil_Z_mA: Number((Math.sin(t * 1.4) * 260).toFixed(2)),
                });
              }
            }}
            onOpenWaveformDocs={() => {
              setDocsSection('waveform');
              setActiveView('docs');
            }}
            showGrid={settings.showWaveformGrid}
          />
        )}

        {activeView === 'plugins' && (
          <PluginsView
            plugins={plugins}
            selectedPluginId={editingPluginId}
            onSelectPlugin={setEditingPluginId}
            onUpdatePlugin={(id, patch) => {
              setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
              const target = plugins.find((p) => p.id === id);
              if (target && patch.enabled !== undefined) {
                if (target.type === 'rx') {
                  setSelectedRxPluginId(id);
                  setRxScriptEnabled(patch.enabled);
                } else {
                  setSelectedTxPluginId(id);
                  setTxScriptEnabled(patch.enabled);
                }
              }
            }}
            onCreatePlugin={(type) => {
              const id = `custom-${type}-${Date.now()}`;
              const newPlugin: ScriptPlugin = {
                id,
                name: type === 'rx' ? `自定义RX解析_${plugins.length + 1}` : `自定义TX校验_${plugins.length + 1}`,
                type,
                description: type === 'rx' ? '自定义接收数据解析与波形提取脚本' : '自定义发送数据组帧/校验脚本',
                enabled: true,
                code:
                  type === 'rx'
                    ? `// 使用 receive.text / receive.bytes 处理收到的数据\nreceive.write('[PLUGIN] ' + receive.text);`
                    : `// 使用 send.bytes 修改要发送的字节\nsend.write(send.bytes);`,
              };
              setPlugins((prev) => [...prev, newPlugin]);
              setEditingPluginId(id);
            }}
            onDeletePlugin={(id) => {
              setPlugins((prev) => prev.filter((p) => p.id !== id));
              if (editingPluginId === id) {
                setEditingPluginId(plugins[0]?.id ?? '');
              }
            }}
            onImportPlugins={(imported) => {
              setPlugins((prev) => {
                const map = new Map(prev.map((p) => [p.id, p]));
                imported.forEach((p) => {
                  if (p.id && p.name && p.code) map.set(p.id, p);
                });
                return Array.from(map.values());
              });
            }}
            onActivateInTerminal={(plugin) => {
              if (plugin.type === 'rx') {
                setSelectedRxPluginId(plugin.id);
                setRxScriptEnabled(true);
              } else {
                setSelectedTxPluginId(plugin.id);
                setTxScriptEnabled(true);
              }
              setActiveView('terminal');
            }}
          />
        )}

        {activeView === 'commands' && (
          <CommandsView
            commands={extendedCommands}
            onAddCommand={(cmd) =>
              setExtendedCommands((prev) => [
                ...prev.slice(0, 599),
                { ...cmd, id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
              ])
            }
            onDeleteCommand={(id) =>
              setExtendedCommands((prev) => prev.filter((c) => c.id !== id))
            }
            onSendCommand={(cmd) => {
              sendPayload(cmd.payload, cmd.isHex);
            }}
            isBatchRunning={isBatchRunning}
            activeBatchStepId={activeBatchStepId}
            onStartBatch={handleStartBatch}
            onStopBatch={handleStopBatch}
          />
        )}

        {activeView === 'docs' && (
          <DocsView initialSection={docsSection} onNavigateView={setActiveView} />
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChangeSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
      />
    </div>
  );
}
