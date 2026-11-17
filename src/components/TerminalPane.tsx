import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  X,
  Send,
  ArrowDownToLine,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { ExtendedCommand, LogEntry, SearchMatch } from '../types/serial';
import { bytesToHexString, findLogMatches } from '../core/protocols';

interface TerminalPaneProps {
  logs: LogEntry[];
  hexDisplay: boolean;
  showTxInLog: boolean;
  txEchoColor: string;
  fontSize: number;
  terminalMode: boolean;
  hexSend: boolean;
  rxScriptActiveName: string | null;
  txScriptActiveName: string | null;
  isConnected: boolean;
  portLabel: string;
  encoding: string;
  txByteCount: number;
  rxByteCount: number;
  rxFrameCount: number;
  onResetCounters: () => void;
  txInput: string;
  onChangeTxInput: (v: string) => void;
  onSendPayload: (payload: string, overrideHex?: boolean) => void;
  onClearLogs: () => void;
  onSaveLogs: () => void;
  extendedCommands: ExtendedCommand[];
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  logs,
  hexDisplay,
  showTxInLog,
  txEchoColor,
  fontSize,
  terminalMode,
  hexSend,
  rxScriptActiveName,
  txScriptActiveName,
  isConnected,
  portLabel,
  encoding,
  txByteCount,
  rxByteCount,
  rxFrameCount,
  onResetCounters,
  txInput,
  onChangeTxInput,
  onSendPayload,
  onClearLogs,
  onSaveLogs,
  extendedCommands,
}) => {
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDecodedTags, setShowDecodedTags] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [txHistory, setTxHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const findInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const visibleLogs = useMemo(() => {
    return logs.filter((entry) => (entry.direction === 'tx' ? showTxInLog : true));
  }, [logs, showTxInLog]);

  const searchableEntries = useMemo(() => {
    return visibleLogs.map((entry) => ({
      id: entry.id,
      searchableText: hexDisplay
        ? entry.hexDump || bytesToHexString(entry.rawBytes)
        : entry.text,
    }));
  }, [visibleLogs, hexDisplay]);

  const searchResult = useMemo(() => {
    if (!findOpen || !findQuery) return { matches: [] as SearchMatch[], error: undefined };
    return findLogMatches(searchableEntries, findQuery, {
      caseSensitive,
      regex: useRegex,
    });
  }, [findOpen, findQuery, searchableEntries, caseSensitive, useRegex]);

  const matchesByEntry = useMemo(() => {
    const map = new Map<string, { match: SearchMatch; globalIdx: number }[]>();
    searchResult.matches.forEach((m, idx) => {
      const arr = map.get(m.entryId) ?? [];
      arr.push({ match: m, globalIdx: idx });
      map.set(m.entryId, arr);
    });
    return map;
  }, [searchResult.matches]);

  // Clamp active match index when result set shrinks
  useEffect(() => {
    if (searchResult.matches.length === 0) {
      setActiveMatchIdx(0);
    } else if (activeMatchIdx >= searchResult.matches.length) {
      setActiveMatchIdx(0);
    }
  }, [searchResult.matches.length, activeMatchIdx]);

  // Auto-scroll to active search match
  useEffect(() => {
    if (!findOpen || searchResult.matches.length === 0) return;
    const active = searchResult.matches[activeMatchIdx];
    if (!active) return;
    const el = entryRefs.current.get(active.entryId);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeMatchIdx, findOpen, searchResult.matches]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (!autoScroll || findOpen) return;
    const el = logContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleLogs.length, autoScroll, findOpen]);

  // Global keyboard shortcuts inside Terminal view (Ctrl+F, Ctrl+L, Ctrl+S, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => {
          findInputRef.current?.focus();
          findInputRef.current?.select();
        }, 0);
      } else if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        onClearLogs();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSaveLogs();
      } else if (e.key === 'Escape' && findOpen) {
        e.preventDefault();
        setFindOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [findOpen, onClearLogs, onSaveLogs]);

  const stepMatch = (delta: number) => {
    const count = searchResult.matches.length;
    if (count === 0) return;
    setActiveMatchIdx((prev) => (prev + delta + count) % count);
  };

  const triggerCopyFeedback = (label: string) => {
    setCopiedFeedback(label);
    setTimeout(() => setCopiedFeedback(null), 1600);
  };

  const handleCopySelectionOrAll = async (mode: 'selection' | 'all' | 'hex') => {
    const selection = window.getSelection()?.toString() ?? '';
    let content = '';
    if (mode === 'selection' && selection.trim().length > 0) {
      content = selection;
    } else if (mode === 'hex') {
      content = visibleLogs
        .map((l) => l.hexDump || bytesToHexString(l.rawBytes))
        .join('\n');
    } else {
      content = visibleLogs.map((l) => (hexDisplay ? l.hexDump : l.text)).join('\n');
    }

    try {
      await navigator.clipboard.writeText(content);
      triggerCopyFeedback(
        mode === 'selection' && selection.trim().length > 0
          ? '已复制选中内容'
          : mode === 'hex'
            ? '已复制 HEX'
            : '已复制全部日志'
      );
    } catch {
      triggerCopyFeedback('复制完成');
    }
  };

  const handleSend = () => {
    if (!txInput.trim()) return;
    onSendPayload(txInput);
    setTxHistory((prev) => [txInput, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
  };

  const handleTxKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || (terminalMode && !e.shiftKey))) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp' && !e.shiftKey && txInput === '') {
      if (txHistory.length > 0) {
        e.preventDefault();
        const nextIdx = Math.min(txHistory.length - 1, historyIdx + 1);
        setHistoryIdx(nextIdx);
        onChangeTxInput(txHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown' && historyIdx >= 0) {
      e.preventDefault();
      const nextIdx = historyIdx - 1;
      setHistoryIdx(nextIdx);
      onChangeTxInput(nextIdx < 0 ? '' : txHistory[nextIdx]);
    }
  };

  const renderHighlightedText = (entryId: string, content: string) => {
    const entryMatches = matchesByEntry.get(entryId);
    if (!entryMatches || entryMatches.length === 0) {
      return content;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    entryMatches.forEach(({ match, globalIdx }, i) => {
      if (match.start > cursor) {
        nodes.push(content.slice(cursor, match.start));
      }
      const isCurrent = globalIdx === activeMatchIdx;
      nodes.push(
        <mark
          key={`${entryId}-m-${i}`}
          className={
            isCurrent
              ? 'bg-[#F59E0B] text-slate-950 rounded-xs px-0.5 font-semibold'
              : 'bg-[#0EA5E9]/35 text-[#E6EDF5] rounded-xs px-0.5'
          }
        >
          {content.slice(match.start, match.end)}
        </mark>
      );
      cursor = match.end;
    });
    if (cursor < content.length) {
      nodes.push(content.slice(cursor));
    }
    return nodes;
  };

  const selectedEntry = useMemo(
    () => visibleLogs.find((l) => l.id === selectedEntryId) ?? null,
    [visibleLogs, selectedEntryId]
  );

  const hasActiveScript = Boolean(rxScriptActiveName || txScriptActiveName);

  return (
    <section
      aria-label="串口数据接收与发送终端"
      className={`flex-1 min-w-0 flex flex-col bg-[#0B0E14] relative ${
        hasActiveScript ? 'ring-1 ring-inset ring-rose-500/45' : ''
      }`}
    >
      {/* Top Action & Shortcut Bar */}
      <div className="h-9 px-3 bg-[#0F141D] border-b border-[#232B3B] flex items-center justify-between gap-2 shrink-0 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {hasActiveScript && (
            <span className="text-[11px] font-mono text-rose-400 whitespace-nowrap truncate">
              脚本运行中: {[rxScriptActiveName && `RX:${rxScriptActiveName}`, txScriptActiveName && `TX:${txScriptActiveName}`].filter(Boolean).join(' · ')}
            </span>
          )}
          {!hasActiveScript && (
            <span className="text-[11px] text-[#8B95A7] truncate">
              快捷键: Ctrl+F 查找 · Ctrl+C 复制 · Ctrl+L 清屏 · Ctrl+S 保存
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {copiedFeedback && (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mr-1">
              <Check className="w-3.5 h-3.5" />
              {copiedFeedback}
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setFindOpen(true);
              setTimeout(() => findInputRef.current?.focus(), 0);
            }}
            aria-label="查找日志 (Ctrl+F)"
            className="h-6 px-2 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] flex items-center gap-1 text-[11px] cursor-pointer whitespace-nowrap"
          >
            <Search className="w-3 h-3 text-[#38BDF8]" />
            <span>查找</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopySelectionOrAll('selection')}
            aria-label="复制选中或全部文本 (Ctrl+C)"
            className="h-6 px-2 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] flex items-center gap-1 text-[11px] cursor-pointer whitespace-nowrap"
          >
            <Copy className="w-3 h-3" />
            <span>复制</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopySelectionOrAll('hex')}
            aria-label="复制全部十六进制数据"
            className="h-6 px-2 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] text-[11px] font-mono cursor-pointer whitespace-nowrap"
          >
            复制HEX
          </button>

          <button
            type="button"
            onClick={() => setShowDecodedTags((v) => !v)}
            aria-pressed={showDecodedTags}
            className={`h-6 px-2 rounded border flex items-center gap-1 text-[11px] cursor-pointer whitespace-nowrap ${
              showDecodedTags
                ? 'bg-[#1D283A] border-[#38BDF8]/50 text-[#38BDF8]'
                : 'bg-[#161C28] border-[#283244] text-[#8B95A7]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>协议标签</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoScroll((v) => !v)}
            aria-pressed={autoScroll}
            className={`h-6 px-2 rounded border flex items-center gap-1 text-[11px] cursor-pointer whitespace-nowrap ${
              autoScroll
                ? 'bg-[#1D283A] border-[#38BDF8]/50 text-[#38BDF8]'
                : 'bg-[#161C28] border-[#283244] text-[#8B95A7]'
            }`}
          >
            <ArrowDownToLine className="w-3 h-3" />
            <span>滚屏</span>
          </button>
        </div>
      </div>

      {/* Ctrl+F Floating Find Bar */}
      {findOpen && (
        <div
          role="search"
          aria-label="终端日志查找栏"
          className="absolute top-11 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#161C28] border border-[#38BDF8]/50 shadow-xl"
        >
          <Search className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          <input
            ref={findInputRef}
            type="text"
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              setActiveMatchIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setFindOpen(false);
              }
            }}
            placeholder="查找关键字或正则..."
            aria-label="查找关键字"
            className="w-52 h-6 px-2 rounded bg-[#0B0E14] border border-[#283244] text-xs font-mono text-[#E6EDF5] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
          />

          <button
            type="button"
            onClick={() => setCaseSensitive((v) => !v)}
            aria-pressed={caseSensitive}
            title="区分大小写"
            className={`h-6 px-1.5 rounded text-[11px] font-mono border cursor-pointer ${
              caseSensitive
                ? 'bg-[#0EA5E9]/25 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#0B0E14] border-[#283244] text-[#8B95A7]'
            }`}
          >
            Aa
          </button>

          <button
            type="button"
            onClick={() => setUseRegex((v) => !v)}
            aria-pressed={useRegex}
            title="启用正则表达式"
            className={`h-6 px-1.5 rounded text-[11px] font-mono border cursor-pointer ${
              useRegex
                ? 'bg-[#0EA5E9]/25 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#0B0E14] border-[#283244] text-[#8B95A7]'
            }`}
          >
            .*
          </button>

          <span
            data-testid="find-match-count"
            className="min-w-[54px] text-center text-[11px] font-mono tabular-nums text-[#94A3B8]"
          >
            {searchResult.error
              ? '语法错'
              : searchResult.matches.length > 0
                ? `${activeMatchIdx + 1}/${searchResult.matches.length}`
                : '0/0'}
          </span>

          <button
            type="button"
            onClick={() => stepMatch(-1)}
            aria-label="上一个匹配"
            className="p-1 rounded hover:bg-[#232B3B] text-[#CBD5E1] cursor-pointer"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => stepMatch(1)}
            aria-label="下一个匹配"
            className="p-1 rounded hover:bg-[#232B3B] text-[#CBD5E1] cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFindOpen(false)}
            aria-label="关闭查找栏"
            className="p-1 rounded hover:bg-[#232B3B] text-[#8B95A7] hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Monospace Terminal Stream */}
      <div
        ref={logContainerRef}
        data-testid="serial-log-stream"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            const range = document.createRange();
            if (logContainerRef.current) {
              range.selectNodeContents(logContainerRef.current);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          }
        }}
        style={{ fontSize: `${fontSize}px` }}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono leading-[1.6] select-text focus:outline-none"
      >
        {visibleLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#64748B] text-xs space-y-2 select-none">
            <p>暂无串口数据记录</p>
            <p className="text-[11px]">
              点击左侧 <span className="text-[#38BDF8] font-semibold">打开</span> 开始接收实时传感器、FireWater、JustFloat 或 Modbus 数据流
            </p>
          </div>
        ) : (
          visibleLogs.map((entry) => {
            const displayBody = hexDisplay
              ? entry.hexDump || bytesToHexString(entry.rawBytes)
              : entry.text;
            const isSelected = selectedEntryId === entry.id;

            let lineColor = '#D5DEE8';
            if (entry.direction === 'tx') lineColor = txEchoColor;
            else if (entry.direction === 'sys') lineColor = '#38BDF8';
            else if (entry.direction === 'err') lineColor = '#FB7185';

            return (
              <div
                key={entry.id}
                ref={(el) => {
                  if (el) entryRefs.current.set(entry.id, el);
                  else entryRefs.current.delete(entry.id);
                }}
                onClick={() => setSelectedEntryId((prev) => (prev === entry.id ? null : entry.id))}
                className={`group px-1.5 py-0.5 rounded-xs whitespace-pre-wrap break-all transition-colors ${
                  isSelected ? 'bg-[#172030]' : 'hover:bg-[#111722]'
                }`}
                style={{ color: lineColor }}
              >
                {entry.direction === 'tx' && (
                  <span className="text-[11px] opacity-80 mr-1.5 select-none">[TX {entry.timestamp}]</span>
                )}
                {renderHighlightedText(entry.id, displayBody)}
                {showDecodedTags && entry.decodedSummary && (
                  <span className="ml-2 text-[11px] text-[#38BDF8]/80 select-none">
                    [{entry.decodedSummary}]
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Selected Packet Frame Inspector (appears on click) */}
      {selectedEntry && (
        <div className="px-4 py-2 bg-[#111620] border-t border-[#232B3B] text-[11px] font-mono flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0 truncate text-[#94A3B8]">
            <span className="text-[#38BDF8] mr-2">帧详情 ({selectedEntry.rawBytes.length} B):</span>
            <span className="text-[#E6EDF5]">{bytesToHexString(selectedEntry.rawBytes)}</span>
            {selectedEntry.decodedSummary && (
              <span className="ml-3 text-emerald-400">· {selectedEntry.decodedSummary}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedEntryId(null)}
            aria-label="关闭帧详情"
            className="text-[#64748B] hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TX Command Input & Quick Extended Presets */}
      <div className="p-2.5 bg-[#0F141D] border-t border-[#232B3B] space-y-2 shrink-0">
        {extendedCommands.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[11px] text-[#64748B] shrink-0">快捷指令:</span>
            {extendedCommands.slice(0, 6).map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => onSendPayload(cmd.payload, cmd.isHex)}
                className="px-2 py-0.5 rounded bg-[#161C28] border border-[#283244] hover:border-[#38BDF8] text-[11px] text-[#CBD5E1] hover:text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                {cmd.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-stretch gap-2">
          <div className="flex-1 relative">
            <textarea
              rows={2}
              aria-label="发送数据输入框"
              value={txInput}
              onChange={(e) => onChangeTxInput(e.target.value)}
              onKeyDown={handleTxKeyDown}
              placeholder={
                hexSend
                  ? '输入十六进制字节，如: 01 03 00 00 00 03 05 CB (Ctrl+Enter 发送)'
                  : terminalMode
                    ? '终端模式: 输入 AT / PING / SET_TARGET=500 后按 Enter 直接发送...'
                    : '输入要发送的字符串或指令 (Ctrl+Enter 发送，↑/↓ 翻阅历史)...'
              }
              className="w-full h-14 px-3 py-1.5 rounded bg-[#0B0E14] border border-[#283244] text-xs font-mono text-[#E6EDF5] placeholder:text-[#556278] resize-none focus:outline-none focus:border-[#38BDF8]"
            />
            <span className="absolute right-2 bottom-1.5 text-[10px] font-mono text-[#64748B] pointer-events-none">
              {hexSend ? 'HEX' : 'ASCII'} · {txInput.length} chars
            </span>
          </div>

          <button
            type="button"
            onClick={handleSend}
            className="w-24 rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>发送</span>
          </button>
        </div>
      </div>

      {/* Bottom Status Bar matching Screenshot 1 */}
      <footer className="h-7 px-3 bg-[#111620] border-t border-[#232B3B] flex items-center justify-between text-[11px] font-mono tabular-nums text-[#8B95A7] shrink-0 select-none">
        <div className="flex items-center gap-6">
          <span>
            发送：<strong className="text-[#E6EDF5] font-medium">{txByteCount}</strong>
          </span>
          <span>
            接收：<strong className="text-[#E6EDF5] font-medium">{rxByteCount}</strong> -{' '}
            <strong className="text-[#CBD5E1] font-medium">{rxFrameCount}</strong>
          </span>
          <span className="hidden md:inline text-[#64748B]">
            {isConnected ? `${portLabel} · ${encoding}` : `就绪 · ${encoding}`}
          </span>
        </div>

        <button
          type="button"
          onClick={onResetCounters}
          className="flex items-center gap-1 text-[#38BDF8] hover:underline cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>复位计数</span>
        </button>
      </footer>
    </section>
  );
};
