import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Play,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Code2,
} from 'lucide-react';
import { ScriptPlugin } from '../types/serial';
import { runRxPlugin, runTxPlugin } from '../core/pluginEngine';
import { bytesToHexString, encodeText, parseHexString } from '../core/protocols';

interface PluginsViewProps {
  plugins: ScriptPlugin[];
  selectedPluginId: string;
  onSelectPlugin: (id: string) => void;
  onUpdatePlugin: (id: string, patch: Partial<ScriptPlugin>) => void;
  onCreatePlugin: (type: 'rx' | 'tx') => void;
  onDeletePlugin: (id: string) => void;
  onImportPlugins: (imported: ScriptPlugin[]) => void;
  onActivateInTerminal: (plugin: ScriptPlugin) => void;
}

export const PluginsView: React.FC<PluginsViewProps> = ({
  plugins,
  selectedPluginId,
  onSelectPlugin,
  onUpdatePlugin,
  onCreatePlugin,
  onDeletePlugin,
  onImportPlugins,
  onActivateInTerminal,
}) => {
  const activePlugin = useMemo(
    () => plugins.find((p) => p.id === selectedPluginId) ?? plugins[0],
    [plugins, selectedPluginId]
  );

  const [sandboxInput, setSandboxInput] = useState(
    '[00:00:01.200] <inf> current_sense: coil_curr: 215.4, -108.2, 44.0'
  );
  const [sandboxIsHex, setSandboxIsHex] = useState(false);
  const [testOutput, setTestOutput] = useState<{
    ok: boolean;
    lines: string[];
    waveform: { channel: string; value: number }[];
    hexOut?: string;
    error?: string;
  } | null>(null);

  const importRef = useRef<HTMLInputElement>(null);

  const handleRunTest = () => {
    if (!activePlugin) return;
    try {
      const bytes = sandboxIsHex ? parseHexString(sandboxInput) : encodeText(sandboxInput);
      if (activePlugin.type === 'rx') {
        const res = runRxPlugin(activePlugin, bytes, sandboxInput);
        setTestOutput({
          ok: !res.error,
          lines: res.writtenText,
          waveform: res.waveformPoints,
          hexOut: res.writtenBytes.map((b) => bytesToHexString(b)).join(' | '),
          error: res.error,
        });
      } else {
        const res = runTxPlugin(activePlugin, bytes);
        setTestOutput({
          ok: !res.error,
          lines: [],
          waveform: [],
          hexOut: bytesToHexString(res.outputBytes),
          error: res.error,
        });
      }
    } catch (err) {
      setTestOutput({
        ok: false,
        lines: [],
        waveform: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleExportPlugins = () => {
    const blob = new Blob([JSON.stringify(plugins, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serialpulse-plugins.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (Array.isArray(parsed)) {
        onImportPlugins(parsed);
      }
    } catch {
      // Ignore malformed import
    }
    e.target.value = '';
  };

  const insertSnippet = (snippet: string) => {
    if (!activePlugin) return;
    onUpdatePlugin(activePlugin.id, {
      code: `${activePlugin.code.trimEnd()}\n${snippet}`,
    });
  };

  return (
    <section aria-label="JS 脚本插件扩展工作区" className="flex-1 min-w-0 flex bg-[#0B0E14] overflow-hidden">
      {/* Left Plugin List */}
      <aside className="w-72 shrink-0 bg-[#111620] border-r border-[#232B3B] flex flex-col">
        <div className="p-3 border-b border-[#232B3B] space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#E6EDF5]">插件列表 ({plugins.length})</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExportPlugins}
                title="导出全部插件 JSON"
                aria-label="导出插件配置"
                className="p-1.5 rounded bg-[#161C28] border border-[#283244] text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                title="导入插件 JSON"
                aria-label="导入插件配置"
                className="p-1.5 rounded bg-[#161C28] border border-[#283244] text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onCreatePlugin('rx')}
              className="h-7 rounded bg-[#161C28] border border-[#283244] hover:border-[#38BDF8] text-[#38BDF8] text-[11px] flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>新建 RX 插件</span>
            </button>
            <button
              type="button"
              onClick={() => onCreatePlugin('tx')}
              className="h-7 rounded bg-[#161C28] border border-[#283244] hover:border-[#F59E0B] text-[#F59E0B] text-[11px] flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>新建 TX 插件</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {plugins.map((plugin) => {
            const selected = plugin.id === activePlugin?.id;
            return (
              <div
                key={plugin.id}
                className={`p-2.5 rounded border transition-colors ${
                  selected
                    ? 'bg-[#172030] border-[#38BDF8]/60'
                    : 'bg-[#131924] border-[#202837] hover:border-[#324057]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectPlugin(plugin.id)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-semibold ${
                          plugin.type === 'rx' ? 'text-[#38BDF8]' : 'text-[#F59E0B]'
                        }`}
                      >
                        {plugin.type.toUpperCase()}
                      </span>
                      <span className="text-xs font-medium text-[#E6EDF5] truncate">
                        {plugin.name}
                      </span>
                    </div>
                  </button>

                  <input
                    type="checkbox"
                    aria-label={`启用插件 ${plugin.name}`}
                    checked={plugin.enabled}
                    onChange={(e) => onUpdatePlugin(plugin.id, { enabled: e.target.checked })}
                    className="w-3.5 h-3.5 cursor-pointer shrink-0"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#8B95A7] line-clamp-2">{plugin.description}</p>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right Code Editor + Sandbox Tester */}
      {activePlugin ? (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Plugin Header */}
          <div className="px-4 py-3 bg-[#0F141D] border-b border-[#232B3B] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Code2 className="w-4 h-4 text-[#38BDF8] shrink-0" />
              <input
                type="text"
                aria-label="插件名称"
                value={activePlugin.name}
                onChange={(e) => onUpdatePlugin(activePlugin.id, { name: e.target.value })}
                className="w-64 h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-xs font-semibold text-[#E6EDF5] focus:outline-none focus:border-[#38BDF8]"
              />
              <select
                aria-label="插件类型"
                value={activePlugin.type}
                onChange={(e) =>
                  onUpdatePlugin(activePlugin.id, { type: e.target.value as 'rx' | 'tx' })
                }
                className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-xs font-mono text-[#CBD5E1]"
              >
                <option value="rx">RX 接收解析</option>
                <option value="tx">TX 发送预处理</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onActivateInTerminal(activePlugin)}
                className="h-7 px-3 rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-slate-950 font-semibold text-xs cursor-pointer"
              >
                设为终端当前脚本
              </button>

              {!activePlugin.builtIn && (
                <button
                  type="button"
                  onClick={() => onDeletePlugin(activePlugin.id)}
                  aria-label="删除插件"
                  className="h-7 px-2.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除</span>
                </button>
              )}
            </div>
          </div>

          {/* API Snippet Bar */}
          <div className="px-4 py-1.5 bg-[#111620] border-b border-[#232B3B] flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
            <span className="text-[#8B95A7] shrink-0">快捷 API:</span>
            {activePlugin.type === 'rx' ? (
              <>
                <button
                  type="button"
                  onClick={() => insertSnippet("receive.write(receive.text);")}
                  className="px-2 py-0.5 rounded bg-[#161C28] border border-[#283244] text-[#CBD5E1] hover:border-[#38BDF8] font-mono cursor-pointer shrink-0"
                >
                  receive.write()
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("waveform.push('CH0', 0);")}
                  className="px-2 py-0.5 rounded bg-[#161C28] border border-[#283244] text-[#CBD5E1] hover:border-[#38BDF8] font-mono cursor-pointer shrink-0"
                >
                  waveform.push()
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("protocol.tag('CustomProto');")}
                  className="px-2 py-0.5 rounded bg-[#161C28] border border-[#283244] text-[#CBD5E1] hover:border-[#38BDF8] font-mono cursor-pointer shrink-0"
                >
                  protocol.tag()
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => insertSnippet("send.write(send.bytes);")}
                  className="px-2 py-0.5 rounded bg-[#161C28] border border-[#283244] text-[#CBD5E1] hover:border-[#38BDF8] font-mono cursor-pointer shrink-0"
                >
                  send.write()
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("const crc = utils.crc16(send.bytes);")}
                  className="px-2 py-0.5 rounded bg-[#161C28] border border-[#283244] text-[#CBD5E1] hover:border-[#38BDF8] font-mono cursor-pointer shrink-0"
                >
                  utils.crc16()
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("const sum = utils.add8(send.bytes);")}
                  className="px-2 py-0.5 rounded bg-[#161C28] border border-[#283244] text-[#CBD5E1] hover:border-[#38BDF8] font-mono cursor-pointer shrink-0"
                >
                  utils.add8()
                </button>
              </>
            )}
          </div>

          {/* Code Editor */}
          <div className="flex-1 min-h-0 flex flex-col p-3 gap-3 overflow-y-auto">
            <textarea
              aria-label="插件 JavaScript 代码编辑器"
              spellCheck={false}
              value={activePlugin.code}
              onChange={(e) => onUpdatePlugin(activePlugin.id, { code: e.target.value })}
              className="flex-1 min-h-[220px] w-full p-3 rounded bg-[#0E131B] border border-[#283244] font-mono text-xs leading-relaxed text-[#E6EDF5] focus:outline-none focus:border-[#38BDF8] resize-none"
            />

            {/* Live Sandbox Runner */}
            <div className="p-3 rounded bg-[#111620] border border-[#232B3B] space-y-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#E6EDF5]">沙箱即时测试</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#CBD5E1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sandboxIsHex}
                      onChange={(e) => setSandboxIsHex(e.target.checked)}
                    />
                    <span>输入按 HEX 解析</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRunTest}
                    className="h-7 px-3 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>运行测试</span>
                  </button>
                </div>
              </div>

              <input
                type="text"
                aria-label="沙箱测试输入数据"
                value={sandboxInput}
                onChange={(e) => setSandboxInput(e.target.value)}
                placeholder="输入测试帧数据或日志文本..."
                className="w-full h-8 px-2.5 rounded bg-[#0B0E14] border border-[#283244] font-mono text-xs text-[#E6EDF5] focus:outline-none focus:border-[#38BDF8]"
              />

              {testOutput && (
                <div className="p-2.5 rounded bg-[#0B0E14] border border-[#232B3B] font-mono text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5">
                    {testOutput.ok ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">执行成功</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-rose-400">{testOutput.error}</span>
                      </>
                    )}
                  </div>
                  {testOutput.lines.length > 0 && (
                    <div className="text-[#CBD5E1]">
                      终端输出: {testOutput.lines.join(' | ')}
                    </div>
                  )}
                  {testOutput.hexOut && (
                    <div className="text-[#F59E0B]">HEX 输出: {testOutput.hexOut}</div>
                  )}
                  {testOutput.waveform.length > 0 && (
                    <div className="text-[#38BDF8]">
                      波形提取:{' '}
                      {testOutput.waveform.map((w) => `${w.channel}=${w.value}`).join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
