import React, { useRef } from 'react';
import {
  Pause,
  Play,
  Pencil,
  HelpCircle,
  Star,
  Download,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import {
  DataBitsType,
  ModemSignals,
  ParityType,
  ProtocolParserId,
  ScriptPlugin,
  SerialConnectionConfig,
  StopBitsType,
  TransportType,
} from '../types/serial';

interface SerialSidebarProps {
  config: SerialConnectionConfig;
  onChangeConfig: (patch: Partial<SerialConnectionConfig>) => void;
  isConnected: boolean;
  onToggleConnect: () => void;
  modemSignals: ModemSignals;

  // Receive settings
  saveToFile: boolean;
  onToggleSaveToFile: (v: boolean) => void;
  hexDisplay: boolean;
  onToggleHexDisplay: (v: boolean) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  autoFrameBreak: boolean;
  onToggleAutoFrameBreak: (v: boolean) => void;
  frameBreakMs: number;
  onChangeFrameBreakMs: (ms: number) => void;
  rxScriptEnabled: boolean;
  onToggleRxScript: (v: boolean) => void;
  selectedRxPluginId: string;
  onSelectRxPlugin: (id: string) => void;
  rxPlugins: ScriptPlugin[];
  onEditPlugin: (id: string) => void;
  onSaveData: () => void;
  onClearData: () => void;

  // Send settings
  hexSend: boolean;
  onToggleHexSend: (v: boolean) => void;
  txScriptEnabled: boolean;
  onToggleTxScript: (v: boolean) => void;
  selectedTxPluginId: string;
  onSelectTxPlugin: (id: string) => void;
  txPlugins: ScriptPlugin[];
  timerSendEnabled: boolean;
  onToggleTimerSend: (v: boolean) => void;
  timerSendSec: number;
  onChangeTimerSendSec: (sec: number) => void;
  showTxInLog: boolean;
  onToggleShowTxInLog: (v: boolean) => void;
  txEchoColor: string;
  onChangeTxEchoColor: (color: string) => void;
  terminalMode: boolean;
  onToggleTerminalMode: (v: boolean) => void;
  autoTogglePort: boolean;
  onToggleAutoTogglePort: (v: boolean) => void;
  autoReconnect: boolean;
  onToggleAutoReconnect: (v: boolean) => void;

  onSendFileBytes: (fileName: string, bytes: Uint8Array) => void;
  onOpenExtendedCommands: () => void;
  onOpenDocsSection: (section: string) => void;
}

const PORT_PRESETS: { value: TransportType; portName: string; label: string }[] = [
  { value: 'sim-nrf', portName: 'COM17', label: 'COM17 · nRF54L 传感器日志' },
  { value: 'sim-pid', portName: 'COM4', label: 'COM4 · PID 闭环 (FireWater)' },
  { value: 'sim-justfloat', portName: 'COM9', label: 'COM9 · 三相电流 (JustFloat)' },
  { value: 'sim-modbus', portName: 'TCP:8080', label: 'TCP:8080 · Modbus RTU 仪表' },
  { value: 'tcp-client', portName: 'TCP Client', label: 'TCP Client · 127.0.0.1:9000' },
  { value: 'udp', portName: 'UDP Socket', label: 'UDP · 127.0.0.1:9001' },
  { value: 'web-serial', portName: 'Web Serial', label: 'Web Serial · 实体硬件串口' },
];

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 2000000];

const PROTOCOLS: { id: ProtocolParserId; label: string }[] = [
  { id: 'auto', label: 'Auto 自动多协议解析' },
  { id: 'firewater', label: 'FireWater (CSV 波形)' },
  { id: 'justfloat', label: 'JustFloat (IEEE754 浮点)' },
  { id: 'keyvalue', label: 'Key=Value 键值对' },
  { id: 'binary-aa55', label: 'AA 55 二进制遥测帧' },
  { id: 'modbus-rtu', label: 'Modbus RTU 协议帧' },
  { id: 'raw', label: 'Raw 原始透传' },
];

export const SerialSidebar: React.FC<SerialSidebarProps> = ({
  config,
  onChangeConfig,
  isConnected,
  onToggleConnect,
  modemSignals,
  saveToFile,
  onToggleSaveToFile,
  hexDisplay,
  onToggleHexDisplay,
  isPaused,
  onTogglePause,
  autoFrameBreak,
  onToggleAutoFrameBreak,
  frameBreakMs,
  onChangeFrameBreakMs,
  rxScriptEnabled,
  onToggleRxScript,
  selectedRxPluginId,
  onSelectRxPlugin,
  rxPlugins,
  onEditPlugin,
  onSaveData,
  onClearData,
  hexSend,
  onToggleHexSend,
  txScriptEnabled,
  onToggleTxScript,
  selectedTxPluginId,
  onSelectTxPlugin,
  txPlugins,
  timerSendEnabled,
  onToggleTimerSend,
  timerSendSec,
  onChangeTimerSendSec,
  showTxInLog,
  onToggleShowTxInLog,
  txEchoColor,
  onChangeTxEchoColor,
  terminalMode,
  onToggleTerminalMode,
  autoTogglePort,
  onToggleAutoTogglePort,
  autoReconnect,
  onToggleAutoReconnect,
  onSendFileBytes,
  onOpenExtendedCommands,
  onOpenDocsSection,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePortSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = PORT_PRESETS.find((p) => p.value === e.target.value);
    if (selected) {
      onChangeConfig({
        transport: selected.value,
        portName: selected.portName,
      });
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    onSendFileBytes(file.name, new Uint8Array(buf));
    e.target.value = '';
  };

  return (
    <aside
      aria-label="串口参数与收发控制"
      className="w-[276px] shrink-0 bg-[#111620] border-r border-[#232B3B] flex flex-col overflow-y-auto select-none text-xs text-[#CBD5E1]"
    >
      {/* Port Config Section */}
      <div className="p-3 space-y-2 border-b border-[#232B3B]">
        <div className="grid grid-cols-[76px_1fr] items-center gap-2">
          <label htmlFor="serial-port-select" className="text-[#8B95A7] whitespace-nowrap">
            端口名：
          </label>
          <select
            id="serial-port-select"
            value={config.transport}
            onChange={handlePortSelect}
            disabled={isConnected}
            className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8] disabled:opacity-60 min-w-0"
          >
            {PORT_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {(config.transport === 'tcp-client' || config.transport === 'udp') && (
          <div className="grid grid-cols-[76px_1fr_58px] items-center gap-1.5">
            <span className="text-[#8B95A7] whitespace-nowrap">地址：</span>
            <input
              type="text"
              aria-label="TCP或UDP主机地址"
              value={config.tcpHost}
              onChange={(e) => onChangeConfig({ tcpHost: e.target.value })}
              className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8] min-w-0"
            />
            <input
              type="number"
              aria-label="端口号"
              value={config.tcpPort}
              onChange={(e) => onChangeConfig({ tcpPort: Number(e.target.value) || 9000 })}
              className="h-7 px-1.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] text-center focus:outline-none focus:border-[#38BDF8]"
            />
          </div>
        )}

        <div className="grid grid-cols-[76px_1fr] items-center gap-2">
          <div className="flex items-center justify-between pr-0.5">
            <label htmlFor="serial-baud" className="text-[#8B95A7] whitespace-nowrap">
              波特率：
            </label>
            <button
              type="button"
              onClick={() => onChangeConfig({ customBaudRate: !config.customBaudRate })}
              title="切换自定义波特率输入"
              aria-label="切换自定义波特率输入"
              className={`p-0.5 rounded hover:bg-[#1E2736] cursor-pointer shrink-0 ${
                config.customBaudRate ? 'text-[#38BDF8]' : 'text-[#64748B]'
              }`}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          {config.customBaudRate ? (
            <input
              id="serial-baud"
              type="number"
              min={110}
              max={12000000}
              value={config.baudRate}
              onChange={(e) => onChangeConfig({ baudRate: Number(e.target.value) || 115200 })}
              className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8] min-w-0"
            />
          ) : (
            <select
              id="serial-baud"
              value={config.baudRate}
              onChange={(e) => onChangeConfig({ baudRate: Number(e.target.value) })}
              className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8] min-w-0"
            >
              {BAUD_RATES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-[76px_1fr] items-center gap-2">
          <label htmlFor="serial-databits" className="text-[#8B95A7] whitespace-nowrap">
            数据位：
          </label>
          <select
            id="serial-databits"
            value={config.dataBits}
            onChange={(e) => onChangeConfig({ dataBits: Number(e.target.value) as DataBitsType })}
            className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8] min-w-0"
          >
            {[8, 7, 6, 5].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[76px_1fr] items-center gap-2">
          <label htmlFor="serial-parity" className="text-[#8B95A7] whitespace-nowrap">
            校验位：
          </label>
          <select
            id="serial-parity"
            value={config.parity}
            onChange={(e) => onChangeConfig({ parity: e.target.value as ParityType })}
            className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8] min-w-0"
          >
            <option value="none">None</option>
            <option value="odd">Odd</option>
            <option value="even">Even</option>
            <option value="mark">Mark</option>
            <option value="space">Space</option>
          </select>
        </div>

        <div className="grid grid-cols-[76px_1fr] items-center gap-2">
          <label htmlFor="serial-stopbits" className="text-[#8B95A7] whitespace-nowrap">
            停止位：
          </label>
          <select
            id="serial-stopbits"
            value={config.stopBits}
            onChange={(e) => onChangeConfig({ stopBits: Number(e.target.value) as StopBitsType })}
            className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] focus:outline-none focus:border-[#38BDF8] min-w-0"
          >
            <option value={1}>1</option>
            <option value={1.5}>1.5</option>
            <option value={2}>2</option>
          </select>
        </div>

        <div className="grid grid-cols-[76px_1fr] items-center gap-2">
          <label htmlFor="serial-protocol" className="text-[#8B95A7] whitespace-nowrap">
            协议帧：
          </label>
          <select
            id="serial-protocol"
            value={config.protocolParser}
            onChange={(e) =>
              onChangeConfig({ protocolParser: e.target.value as ProtocolParserId })
            }
            className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-[#38BDF8] font-medium text-[11px] focus:outline-none focus:border-[#38BDF8]"
          >
            {PROTOCOLS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* RI DSR CTS DTR RTS Row */}
        <div className="grid grid-cols-5 gap-1 pt-0.5">
          <div
            title="Ring Indicator"
            className={`h-6 rounded border text-[10px] font-mono flex items-center justify-center ${
              modemSignals.ri
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-[#151B26] border-[#232B3B] text-[#64748B]'
            }`}
          >
            RI
          </div>
          <div
            title="Data Set Ready"
            className={`h-6 rounded border text-[10px] font-mono flex items-center justify-center ${
              modemSignals.dsr
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-[#151B26] border-[#232B3B] text-[#64748B]'
            }`}
          >
            DSR
          </div>
          <div
            title="Clear To Send"
            className={`h-6 rounded border text-[10px] font-mono flex items-center justify-center ${
              modemSignals.cts
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-[#151B26] border-[#232B3B] text-[#64748B]'
            }`}
          >
            CTS
          </div>
          <button
            type="button"
            onClick={() => onChangeConfig({ dtr: !config.dtr })}
            aria-pressed={config.dtr}
            className={`h-6 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
              config.dtr
                ? 'bg-[#0EA5E9]/20 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#161C28] border-[#283244] text-[#94A3B8] hover:text-white'
            }`}
          >
            DTR
          </button>
          <button
            type="button"
            onClick={() => onChangeConfig({ rts: !config.rts })}
            aria-pressed={config.rts}
            className={`h-6 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
              config.rts
                ? 'bg-[#0EA5E9]/20 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#161C28] border-[#283244] text-[#94A3B8] hover:text-white'
            }`}
          >
            RTS
          </button>
        </div>

        {/* Primary Connect CTA */}
        <button
          type="button"
          onClick={onToggleConnect}
          className={`w-full h-8 rounded font-semibold text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
            isConnected
              ? 'bg-rose-500/15 border border-rose-500/50 text-rose-300 hover:bg-rose-500/25'
              : 'bg-[#0EA5E9] hover:bg-[#0284C7] text-slate-950 border border-[#38BDF8]'
          }`}
        >
          {isConnected ? '关闭端口' : '打开'}
        </button>
      </div>

      {/* Receive Settings Section */}
      <div className="p-3 space-y-2 border-b border-[#232B3B]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#94A3B8]">接收设置：</span>
          <button
            type="button"
            onClick={() => onOpenDocsSection('basics')}
            aria-label="查看接收设置说明"
            title="查看接收设置说明"
            className="text-[#64748B] hover:text-[#38BDF8] cursor-pointer"
          >
            <Star className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToFile}
                onChange={(e) => onToggleSaveToFile(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
              />
              <span>将接收保存到文件</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hexDisplay}
                onChange={(e) => onToggleHexDisplay(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
              />
              <span>十六进制显示</span>
            </label>
          </div>

          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? '继续接收显示' : '暂停接收显示'}
            aria-pressed={isPaused}
            title={isPaused ? '继续显示 (Space)' : '暂停显示 (Space)'}
            className={`w-11 h-10 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isPaused
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-[#161C28] border-[#283244] text-[#E6EDF5] hover:border-[#38BDF8]'
            }`}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoFrameBreak}
              onChange={(e) => onToggleAutoFrameBreak(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
            />
            <span>自动断帧</span>
          </label>
          <input
            type="number"
            aria-label="自动断帧超时毫秒"
            min={5}
            max={5000}
            value={frameBreakMs}
            onChange={(e) => onChangeFrameBreakMs(Number(e.target.value) || 20)}
            className="w-16 h-6 px-1.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] text-center focus:outline-none focus:border-[#38BDF8]"
          />
          <span className="text-[11px] text-[#8B95A7] font-mono">ms</span>
          <button
            type="button"
            onClick={() => onOpenDocsSection('basics')}
            aria-label="自动断帧说明"
            title="收到数据包后超过设定毫秒无新字节即自动换行断帧"
            className="ml-auto p-1 rounded border border-[#283244] bg-[#161C28] text-[#8B95A7] hover:text-[#38BDF8] cursor-pointer"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </div>

        {/* RX Script Plugin Row */}
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={rxScriptEnabled}
              onChange={(e) => onToggleRxScript(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
            />
            <span>脚本</span>
          </label>
          <select
            aria-label="选择接收脚本插件"
            value={selectedRxPluginId}
            onChange={(e) => onSelectRxPlugin(e.target.value)}
            className="flex-1 min-w-0 h-6 px-1.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] text-[11px] focus:outline-none focus:border-[#38BDF8]"
          >
            {rxPlugins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onEditPlugin(selectedRxPluginId)}
            aria-label="编辑接收脚本"
            title="在脚本编辑器中打开"
            className="p-1 rounded border border-[#283244] bg-[#161C28] text-[#8B95A7] hover:text-[#38BDF8] cursor-pointer shrink-0"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onSaveData}
            className="h-7 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#38BDF8] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>保存数据</span>
          </button>
          <button
            type="button"
            onClick={onClearData}
            className="h-7 rounded border border-[#283244] bg-[#161C28] hover:border-rose-400/60 text-[#CBD5E1] hover:text-rose-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空数据</span>
          </button>
        </div>
      </div>

      {/* Send Settings Section */}
      <div className="p-3 space-y-2">
        <div className="text-[11px] font-semibold text-[#94A3B8]">发送设置：</div>

        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFilePicked}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-[#CBD5E1] hover:text-[#38BDF8] transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#8B95A7]" />
            <span>发送文件</span>
          </button>

          <button
            type="button"
            onClick={onOpenExtendedCommands}
            className="text-[#38BDF8] hover:underline font-medium cursor-pointer"
          >
            扩展命令
          </button>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hexSend}
            onChange={(e) => onToggleHexSend(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
          />
          <span>十六进制发送</span>
        </label>

        {/* TX Script Plugin Row */}
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={txScriptEnabled}
              onChange={(e) => onToggleTxScript(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
            />
            <span>脚本</span>
          </label>
          <select
            aria-label="选择发送脚本插件"
            value={selectedTxPluginId}
            onChange={(e) => onSelectTxPlugin(e.target.value)}
            className="flex-1 min-w-0 h-6 px-1.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] text-[11px] focus:outline-none focus:border-[#38BDF8]"
          >
            {txPlugins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onEditPlugin(selectedTxPluginId)}
            aria-label="编辑发送脚本"
            title="在脚本编辑器中打开"
            className="p-1 rounded border border-[#283244] bg-[#161C28] text-[#8B95A7] hover:text-[#38BDF8] cursor-pointer shrink-0"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        {/* Timed Send */}
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={timerSendEnabled}
              onChange={(e) => onToggleTimerSend(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
            />
            <span>定时发送</span>
          </label>
          <input
            type="number"
            aria-label="定时发送周期秒数"
            min={0.1}
            max={3600}
            step={0.1}
            value={timerSendSec}
            onChange={(e) => onChangeTimerSendSec(Math.max(0.1, Number(e.target.value) || 1))}
            className="w-16 h-6 px-1.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono text-[11px] text-center focus:outline-none focus:border-[#38BDF8]"
          />
          <span className="text-[11px] text-[#8B95A7]">秒</span>
        </div>

        {/* Show TX string + color */}
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showTxInLog}
              onChange={(e) => onToggleShowTxInLog(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
            />
            <span>显示发送字符串</span>
          </label>
          <input
            type="color"
            aria-label="发送字符串颜色"
            value={txEchoColor}
            onChange={(e) => onChangeTxEchoColor(e.target.value)}
            className="w-10 h-5 rounded border border-[#283244] bg-[#161C28] cursor-pointer p-0.5"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={terminalMode}
            onChange={(e) => onToggleTerminalMode(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
          />
          <span>终端模式</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoTogglePort}
            onChange={(e) => onToggleAutoTogglePort(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
          />
          <span>自动开关串口</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoReconnect}
            onChange={(e) => onToggleAutoReconnect(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#334155] bg-[#161C28]"
          />
          <span>自动重连</span>
        </label>
      </div>
    </aside>
  );
};
