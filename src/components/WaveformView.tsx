import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Pause,
  Play,
  Eraser,
  Crosshair,
  LayoutGrid,
  Download,
  Upload,
  HelpCircle,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { WaveformChannel, WaveformLayoutMode } from '../types/serial';

interface WaveformViewProps {
  channels: WaveformChannel[];
  isPaused: boolean;
  onTogglePause: () => void;
  onClearWaveform: () => void;
  onToggleChannelVisible: (channelId: string) => void;
  onAssignChannelPane: (channelId: string, paneId: string) => void;
  onImportCsvPoints: (rows: Record<string, number>[]) => void;
  onInjectTestWave: () => void;
  onOpenWaveformDocs: () => void;
  showGrid: boolean;
}

const LAYOUT_PANES: Record<WaveformLayoutMode, { id: string; label: string }[]> = {
  single: [{ id: 'pane-0', label: '主视图' }],
  'split-h': [
    { id: 'pane-0', label: '左视图' },
    { id: 'pane-1', label: '右视图' },
  ],
  'split-v': [
    { id: 'pane-0', label: '上视图' },
    { id: 'pane-1', label: '下视图' },
  ],
  'grid-2x2': [
    { id: 'pane-0', label: '视图 1' },
    { id: 'pane-1', label: '视图 2' },
    { id: 'pane-2', label: '视图 3' },
    { id: 'pane-3', label: '视图 4' },
  ],
};

interface OscilloscopeCanvasProps {
  paneId: string;
  paneLabel: string;
  channels: WaveformChannel[];
  showGrid: boolean;
  autoScaleToken: number;
  xWindow: number;
  onDropChannel: (channelId: string, paneId: string) => void;
}

const OscilloscopeCanvas: React.FC<OscilloscopeCanvasProps> = ({
  paneId,
  paneLabel,
  channels,
  showGrid,
  autoScaleToken,
  xWindow,
  onDropChannel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    xPx: number;
    yPx: number;
    sampleIdx: number;
    values: { name: string; color: string; value: number }[];
  } | null>(null);
  const [yRange, setYRange] = useState<{ min: number; max: number }>({ min: -1000, max: 1000 });
  const [dragOver, setDragOver] = useState(false);

  const visibleChannels = useMemo(() => channels.filter((c) => c.visible), [channels]);

  // Auto-scale Y range whenever user triggers fit or on initial real data out-of-bounds
  useEffect(() => {
    if (visibleChannels.length === 0) return;
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const ch of visibleChannels) {
      const slice = ch.points.slice(-xWindow);
      for (const pt of slice) {
        if (pt.y < minVal) minVal = pt.y;
        if (pt.y > maxVal) maxVal = pt.y;
      }
    }
    if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
      const span = Math.max(10, maxVal - minVal);
      const pad = span * 0.15;
      setYRange({
        min: Math.floor(minVal - pad),
        max: Math.ceil(maxVal + pad),
      });
    }
  }, [autoScaleToken, xWindow]);

  // Expand automatically if values exceed default +/-1000 cleanly
  useEffect(() => {
    if (visibleChannels.length === 0) return;
    let needsExpand = false;
    let minVal = yRange.min;
    let maxVal = yRange.max;
    for (const ch of visibleChannels) {
      if (ch.points.length === 0) continue;
      const latest = ch.points[ch.points.length - 1].y;
      if (latest > maxVal) {
        maxVal = Math.ceil(latest * 1.2);
        needsExpand = true;
      }
      if (latest < minVal) {
        minVal = Math.floor(latest * 1.2);
        needsExpand = true;
      }
    }
    if (needsExpand) setYRange({ min: minVal, max: maxVal });
  }, [visibleChannels, yRange.min, yRange.max]);

  // Draw HiDPI oscilloscope canvas matching Screenshot 2's dotted crosshair grid
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(200, Math.floor(rect.width));
    const height = Math.max(160, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0B0E14';
    ctx.fillRect(0, 0, width, height);

    const padL = 56;
    const padR = 16;
    const padT = 18;
    const padB = 26;
    const plotW = Math.max(60, width - padL - padR);
    const plotH = Math.max(60, height - padT - padB);

    const rows = 12;
    const cols = 11;
    const yMin = yRange.min;
    const yMax = yRange.max === yRange.min ? yRange.min + 100 : yRange.max;

    // Grid & Crosshair markers matching Screenshot 2
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let r = 0; r <= rows; r++) {
      const y = padT + (plotH * r) / rows;
      const val = yMax - ((yMax - yMin) * r) / rows;

      if (showGrid) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.setLineDash([1, 5]);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = '#64748B';
      ctx.fillText(Math.round(val).toString(), padL - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let c = 0; c <= cols; c++) {
      const x = padL + (plotW * c) / cols;
      const sampleLabel = Math.round((xWindow * c) / cols);

      if (showGrid) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.setLineDash([1, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = '#64748B';
      ctx.fillText(sampleLabel.toString(), x, padT + plotH + 6);
    }

    // '+' Crosshair intersections like Screenshot 2
    if (showGrid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.38)';
      ctx.lineWidth = 1;
      for (let r = 0; r <= rows; r++) {
        const y = padT + (plotH * r) / rows;
        for (let c = 1; c < cols; c++) {
          const x = padL + (plotW * c) / cols;
          ctx.beginPath();
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
          ctx.stroke();
        }
      }
    }

    // Zero baseline emphasis
    if (yMin < 0 && yMax > 0) {
      const yZero = padT + ((yMax - 0) / (yMax - yMin)) * plotH;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, yZero);
      ctx.lineTo(padL + plotW, yZero);
      ctx.stroke();
    }

    // Clip plot region and render waveform traces
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();

    for (const ch of visibleChannels) {
      const pts = ch.points.slice(-xWindow);
      if (pts.length < 2) continue;

      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < pts.length; i++) {
        const x = padL + (i / Math.max(1, xWindow - 1)) * plotW;
        const y = padT + ((yMax - pts[i].y) / (yMax - yMin)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Crosshair hover guide
    if (hoverInfo) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverInfo.xPx, padT);
      ctx.lineTo(hoverInfo.xPx, padT + plotH);
      ctx.moveTo(padL, hoverInfo.yPx);
      ctx.lineTo(padL + plotW, hoverInfo.yPx);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
    ctx.restore();
  }, [visibleChannels, showGrid, yRange, xWindow, hoverInfo]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;
    const padL = 56;
    const padR = 16;
    const plotW = Math.max(60, rect.width - padL - padR);
    const ratio = Math.max(0, Math.min(1, (xPx - padL) / plotW));
    const idx = Math.round(ratio * (xWindow - 1));

    const values = visibleChannels
      .map((ch) => {
        const pts = ch.points.slice(-xWindow);
        const pt = pts[Math.min(pts.length - 1, idx)];
        return pt ? { name: ch.name, color: ch.color, value: pt.y } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    setHoverInfo({ xPx, yPx, sampleIdx: idx, values });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    setYRange((prev) => {
      const mid = (prev.max + prev.min) / 2;
      const half = Math.max(5, ((prev.max - prev.min) / 2) * factor);
      return { min: Math.round(mid - half), max: Math.round(mid + half) };
    });
  };

  return (
    <div
      ref={containerRef}
      data-testid={`waveform-pane-${paneId}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const channelId = e.dataTransfer.getData('text/channel-id');
        if (channelId) onDropChannel(channelId, paneId);
      }}
      onWheel={handleWheel}
      className={`relative flex-1 min-h-[220px] min-w-[240px] bg-[#0B0E14] border rounded overflow-hidden ${
        dragOver ? 'border-[#38BDF8] ring-1 ring-[#38BDF8]/40' : 'border-[#232B3B]'
      }`}
    >
      {/* Pane label & active channels */}
      <div className="absolute top-2 left-16 right-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 pointer-events-none text-[11px] font-mono">
        <span className="text-[#64748B] whitespace-nowrap shrink-0">{paneLabel}</span>
        {visibleChannels.map((ch) => (
          <span key={ch.id} className="flex items-center gap-1.5 whitespace-nowrap shrink-0" style={{ color: ch.color }}>
            <span className="w-2 h-0.5 inline-block" style={{ backgroundColor: ch.color }} />
            <span>{ch.name}:</span>
            <span className="tabular-nums font-semibold">
              {Number.isFinite(ch.latestValue) ? ch.latestValue.toFixed(2) : '0.00'}
            </span>
          </span>
        ))}
      </div>

      {/* Crosshair HUD */}
      {hoverInfo && hoverInfo.values.length > 0 && (
        <div className="absolute bottom-8 right-4 z-10 px-2.5 py-1.5 rounded bg-[#111620]/90 border border-[#283244] text-[11px] font-mono tabular-nums pointer-events-none space-y-0.5">
          <div className="text-[#8B95A7]">Sample #{hoverInfo.sampleIdx}</div>
          {hoverInfo.values.map((v) => (
            <div key={v.name} className="flex items-center justify-between gap-4">
              <span style={{ color: v.color }}>{v.name}</span>
              <span className="text-[#E6EDF5]">{v.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <canvas
        ref={canvasRef}
        data-testid={`waveform-canvas-${paneId}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverInfo(null)}
        className="w-full h-full block cursor-crosshair"
      />
    </div>
  );
};

export const WaveformView: React.FC<WaveformViewProps> = ({
  channels,
  isPaused,
  onTogglePause,
  onClearWaveform,
  onToggleChannelVisible,
  onAssignChannelPane,
  onImportCsvPoints,
  onInjectTestWave,
  onOpenWaveformDocs,
  showGrid,
}) => {
  const [layoutMode, setLayoutMode] = useState<WaveformLayoutMode>('single');
  const [xWindow, setXWindow] = useState(800);
  const [autoScaleToken, setAutoScaleToken] = useState(0);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const csvImportRef = useRef<HTMLInputElement>(null);

  const panes = LAYOUT_PANES[layoutMode];

  const handleExportCsv = () => {
    if (channels.length === 0) return;
    const maxLen = Math.max(...channels.map((c) => c.points.length));
    const header = ['index', ...channels.map((c) => c.name)].join(',');
    const rows: string[] = [header];
    for (let i = 0; i < maxLen; i++) {
      const cols = [String(i), ...channels.map((c) => String(c.points[i]?.y ?? ''))];
      rows.push(cols.join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waveform_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map((h) => h.trim());
    const parsedRows: Record<string, number>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',');
      const row: Record<string, number> = {};
      headers.forEach((h, idx) => {
        if (h.toLowerCase() === 'index') return;
        const num = Number(vals[idx]);
        if (Number.isFinite(num)) row[h] = num;
      });
      if (Object.keys(row).length > 0) parsedRows.push(row);
    }
    onImportCsvPoints(parsedRows);
    e.target.value = '';
  };

  const gridClass =
    layoutMode === 'single'
      ? 'grid-cols-1 grid-rows-1'
      : layoutMode === 'split-h'
        ? 'grid-cols-2 grid-rows-1'
        : layoutMode === 'split-v'
          ? 'grid-cols-1 grid-rows-2'
          : 'grid-cols-2 grid-rows-2';

  return (
    <section aria-label="实时数据波形工作区" className="flex-1 min-w-0 flex flex-col bg-[#0B0E14] relative">
      {/* Top Channel Bar + Floating Controls (matches Screenshot 2 & 3) */}
      <div className="h-10 px-3 bg-[#111620] border-b border-[#232B3B] flex items-center justify-between gap-3 shrink-0">
        {/* Draggable Channel Chips */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-[11px] text-[#8B95A7] shrink-0">通道 (可拖拽至视图):</span>
          {channels.length === 0 ? (
            <span className="text-[11px] text-[#64748B]">等待协议数据输入...</span>
          ) : (
            channels.map((ch) => (
              <div
                key={ch.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/channel-id', ch.id);
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono cursor-grab active:cursor-grabbing shrink-0 ${
                  ch.visible
                    ? 'bg-[#161C28] border-[#2D394E] text-[#E6EDF5]'
                    : 'bg-[#0F141D] border-[#1F2735] text-[#64748B] opacity-70'
                }`}
              >
                <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: ch.color }} />
                <span>{ch.name}</span>
                <span className="tabular-nums text-[#94A3B8]">
                  {ch.latestValue.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleChannelVisible(ch.id)}
                  aria-label={ch.visible ? `隐藏通道 ${ch.name}` : `显示通道 ${ch.name}`}
                  className="ml-0.5 text-[#8B95A7] hover:text-white cursor-pointer"
                >
                  {ch.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Top-right 7-button oscilloscope toolbar matching Screenshot 2 */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          <button
            type="button"
            onClick={() => {
              setChannelMenuOpen((v) => !v);
              setLayoutMenuOpen(false);
            }}
            aria-label="添加或管理波形通道"
            title="通道管理与测试信号注入"
            className="h-7 px-2.5 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#E6EDF5] flex items-center gap-1 text-xs cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
            <Plus className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? '继续绘制波形' : '暂停绘制波形'}
            aria-pressed={isPaused}
            title={isPaused ? '继续绘制' : '暂停绘制'}
            className={`h-7 w-8 rounded border flex items-center justify-center cursor-pointer ${
              isPaused
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-[#161C28] border-[#283244] hover:border-[#38BDF8] text-[#E6EDF5]'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onClearWaveform}
            aria-label="清空波形数据"
            title="清空波形"
            className="h-7 w-8 rounded border border-[#283244] bg-[#161C28] hover:border-rose-400/60 text-[#CBD5E1] hover:text-rose-300 flex items-center justify-center cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setAutoScaleToken((n) => n + 1)}
            aria-label="自适应缩放纵轴"
            title="自适应 Y 轴刻度"
            className="h-7 w-8 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] flex items-center justify-center cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setLayoutMenuOpen((v) => !v);
              setChannelMenuOpen(false);
            }}
            aria-label="切换多视图布局"
            title="多视图分屏布局"
            className="h-7 px-2 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] flex items-center gap-1 text-xs cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            aria-label="导出波形 CSV"
            title="导出 CSV 数据"
            className="h-7 w-8 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] flex items-center justify-center cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <input
            ref={csvImportRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportCsv}
          />
          <button
            type="button"
            onClick={() => csvImportRef.current?.click()}
            aria-label="导入波形 CSV"
            title="导入 CSV 波形数据"
            className="h-7 w-8 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] flex items-center justify-center cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenWaveformDocs}
            aria-label="查看波形绘制帮助"
            title="波形使用说明"
            className="h-7 w-8 rounded border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-[#CBD5E1] flex items-center justify-center cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Channel / Signal Popover */}
          {channelMenuOpen && (
            <div className="absolute right-0 top-9 z-30 w-64 p-3 rounded-md bg-[#161C28] border border-[#2E3A4F] shadow-2xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#E6EDF5]">通道与采样窗口</span>
                <button
                  type="button"
                  onClick={onInjectTestWave}
                  className="text-[11px] text-[#38BDF8] hover:underline cursor-pointer"
                >
                  + 注入模拟波形
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#8B95A7] flex justify-between">
                  <span>X轴显示点数</span>
                  <span className="font-mono text-[#E6EDF5]">{xWindow} pts</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={1500}
                  step={50}
                  value={xWindow}
                  onChange={(e) => setXWindow(Number(e.target.value))}
                  className="w-full accent-[#0EA5E9]"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1 border-t border-[#232B3B]">
                {channels.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer truncate">
                      <input
                        type="checkbox"
                        checked={ch.visible}
                        onChange={() => onToggleChannelVisible(ch.id)}
                      />
                      <span style={{ color: ch.color }} className="font-mono truncate">
                        {ch.name}
                      </span>
                    </label>
                    <select
                      aria-label={`分配 ${ch.name} 视图`}
                      value={ch.paneId}
                      onChange={(e) => onAssignChannelPane(ch.id, e.target.value)}
                      className="h-5 px-1 rounded bg-[#0B0E14] border border-[#283244] text-[10px] text-[#CBD5E1]"
                    >
                      {panes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layout Selector Popover */}
          {layoutMenuOpen && (
            <div className="absolute right-20 top-9 z-30 w-44 p-1.5 rounded-md bg-[#161C28] border border-[#2E3A4F] shadow-2xl space-y-1 text-xs">
              {(
                [
                  { id: 'single', label: '单视图模式' },
                  { id: 'split-h', label: '左右双视图' },
                  { id: 'split-v', label: '上下双视图' },
                  { id: 'grid-2x2', label: '四宫格视图 (2×2)' },
                ] as { id: WaveformLayoutMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setLayoutMode(opt.id);
                    setLayoutMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded cursor-pointer ${
                    layoutMode === opt.id
                      ? 'bg-[#0EA5E9]/20 text-[#38BDF8]'
                      : 'text-[#CBD5E1] hover:bg-[#1E2736]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Multi-View Oscilloscope Grid */}
      <div className={`flex-1 p-2 grid gap-2 ${gridClass} min-h-0`}>
        {panes.map((pane) => {
          const paneChannels =
            layoutMode === 'single'
              ? channels
              : channels.filter(
                  (c) => c.paneId === pane.id || (!panes.some((p) => p.id === c.paneId) && pane.id === 'pane-0')
                );
          return (
            <OscilloscopeCanvas
              key={pane.id}
              paneId={pane.id}
              paneLabel={pane.label}
              channels={paneChannels}
              showGrid={showGrid}
              autoScaleToken={autoScaleToken}
              xWindow={xWindow}
              onDropChannel={onAssignChannelPane}
            />
          );
        })}
      </div>
    </section>
  );
};
