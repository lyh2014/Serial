import React, { useMemo, useState } from 'react';
import { Plus, Play, Square, Send, Trash2, Search } from 'lucide-react';
import { ExtendedCommand } from '../types/serial';

interface CommandsViewProps {
  commands: ExtendedCommand[];
  onAddCommand: (cmd: Omit<ExtendedCommand, 'id'>) => void;
  onDeleteCommand: (id: string) => void;
  onSendCommand: (cmd: ExtendedCommand) => void;
  isBatchRunning: boolean;
  activeBatchStepId: string | null;
  onStartBatch: () => void;
  onStopBatch: () => void;
}

export const CommandsView: React.FC<CommandsViewProps> = ({
  commands,
  onAddCommand,
  onDeleteCommand,
  onSendCommand,
  isBatchRunning,
  activeBatchStepId,
  onStartBatch,
  onStopBatch,
}) => {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [name, setName] = useState('');
  const [payload, setPayload] = useState('');
  const [isHex, setIsHex] = useState(false);
  const [delayMs, setDelayMs] = useState(300);
  const [group, setGroup] = useState('自定义');

  const groups = useMemo(() => {
    const set = new Set<string>(['ALL']);
    commands.forEach((c) => set.add(c.group));
    return Array.from(set);
  }, [commands]);

  const filtered = useMemo(() => {
    return commands.filter((c) => {
      if (groupFilter !== 'ALL' && c.group !== groupFilter) return false;
      if (
        search &&
        !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.payload.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [commands, groupFilter, search]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !payload.trim()) return;
    onAddCommand({
      name: name.trim(),
      payload: payload.trim(),
      isHex,
      delayMs: Math.max(50, delayMs),
      group: group.trim() || '自定义',
    });
    setName('');
    setPayload('');
  };

  return (
    <section aria-label="扩展命令与批量序列" className="flex-1 min-w-0 flex flex-col bg-[#0B0E14] overflow-hidden">
      {/* Top Controls */}
      <div className="px-4 py-3 bg-[#111620] border-b border-[#232B3B] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[#E6EDF5]">
            扩展命令队列 ({commands.length} / 600)
          </h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="筛选命令..."
              aria-label="筛选扩展命令"
              className="h-7 pl-8 pr-2.5 rounded bg-[#161C28] border border-[#283244] text-xs text-[#E6EDF5] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          <select
            aria-label="按分组筛选"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-7 px-2 rounded bg-[#161C28] border border-[#283244] text-xs text-[#CBD5E1]"
          >
            {groups.map((g) => (
              <option key={g} value={g}>
                {g === 'ALL' ? '全部分组' : g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {isBatchRunning ? (
            <button
              type="button"
              onClick={onStopBatch}
              className="h-8 px-3 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>停止顺序执行</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartBatch}
              disabled={commands.length === 0}
              className="h-8 px-3 rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>一键顺序执行全部</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Command Form */}
      <form
        onSubmit={handleCreate}
        className="px-4 py-2.5 bg-[#0F141D] border-b border-[#232B3B] grid grid-cols-1 md:grid-cols-[160px_120px_1fr_90px_90px_96px] gap-2 items-center shrink-0 text-xs"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="命令名称"
          aria-label="新命令名称"
          required
          className="h-7 px-2.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] focus:outline-none focus:border-[#38BDF8]"
        />
        <input
          type="text"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder="分组"
          aria-label="命令分组"
          className="h-7 px-2.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] focus:outline-none focus:border-[#38BDF8]"
        />
        <input
          type="text"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder="发送内容 (如 AT+VER? 或 AA 55 01 00)"
          aria-label="命令发送内容"
          required
          className="h-7 px-2.5 rounded bg-[#161C28] border border-[#283244] font-mono text-[#E6EDF5] focus:outline-none focus:border-[#38BDF8]"
        />
        <label className="flex items-center justify-center gap-1.5 h-7 rounded bg-[#161C28] border border-[#283244] cursor-pointer">
          <input type="checkbox" checked={isHex} onChange={(e) => setIsHex(e.target.checked)} />
          <span>HEX</span>
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={50}
            step={50}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value) || 200)}
            aria-label="步进延时毫秒"
            className="w-16 h-7 px-1.5 rounded bg-[#161C28] border border-[#283244] font-mono text-center text-[#E6EDF5]"
          />
          <span className="text-[11px] text-[#8B95A7]">ms</span>
        </div>
        <button
          type="submit"
          className="h-7 rounded bg-[#1D283A] border border-[#38BDF8]/50 text-[#38BDF8] hover:bg-[#0EA5E9]/20 font-medium flex items-center justify-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>添加</span>
        </button>
      </form>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#232B3B] text-[#8B95A7]">
              <th className="py-2 px-2 font-medium w-10">#</th>
              <th className="py-2 px-2 font-medium">名称</th>
              <th className="py-2 px-2 font-medium">分组</th>
              <th className="py-2 px-2 font-medium">格式</th>
              <th className="py-2 px-2 font-medium">指令内容</th>
              <th className="py-2 px-2 font-medium text-right">间隔</th>
              <th className="py-2 px-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A2130]">
            {filtered.map((cmd, idx) => {
              const running = activeBatchStepId === cmd.id;
              return (
                <tr
                  key={cmd.id}
                  className={running ? 'bg-[#0EA5E9]/15' : 'hover:bg-[#111620]'}
                >
                  <td className="py-2 px-2 font-mono tabular-nums text-[#64748B]">{idx + 1}</td>
                  <td className="py-2 px-2 font-medium text-[#E6EDF5]">{cmd.name}</td>
                  <td className="py-2 px-2 text-[#94A3B8]">{cmd.group}</td>
                  <td className="py-2 px-2 font-mono text-[11px] text-[#38BDF8]">
                    {cmd.isHex ? 'HEX' : 'ASCII'}
                  </td>
                  <td className="py-2 px-2 font-mono text-[#CBD5E1] max-w-md truncate">
                    {cmd.payload}
                  </td>
                  <td className="py-2 px-2 font-mono tabular-nums text-right text-[#8B95A7]">
                    {cmd.delayMs} ms
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSendCommand(cmd)}
                        aria-label={`发送命令 ${cmd.name}`}
                        className="h-6 px-2.5 rounded bg-[#161C28] border border-[#283244] hover:border-[#38BDF8] text-[#38BDF8] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>发送</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCommand(cmd.id)}
                        aria-label={`删除命令 ${cmd.name}`}
                        className="h-6 px-2 rounded border border-[#283244] hover:border-rose-500/50 text-[#8B95A7] hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
