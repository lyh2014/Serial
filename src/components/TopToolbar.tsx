import React from 'react';
import {
  Type,
  Activity,
  Puzzle,
  HelpCircle,
  ListChecks,
  Settings,
  Pin,
  Cpu,
} from 'lucide-react';
import { MainViewMode } from '../types/serial';

interface TopToolbarProps {
  activeView: MainViewMode;
  onSelectView: (view: MainViewMode) => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  portLabel: string;
  baudRate: number;
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  activePluginCount: number;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  activeView,
  onSelectView,
  onOpenSettings,
  isConnected,
  portLabel,
  baudRate,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  activePluginCount,
}) => {
  const navItems: { id: MainViewMode; label: string; icon: React.ReactNode; title: string }[] = [
    {
      id: 'terminal',
      label: '串口终端',
      icon: <Type className="w-4 h-4" />,
      title: '串口调试终端 (Alt+1)',
    },
    {
      id: 'waveform',
      label: '波形绘制',
      icon: <Activity className="w-4 h-4" />,
      title: '实时数据波形分析 (Alt+2)',
    },
    {
      id: 'plugins',
      label: '插件脚本',
      icon: <Puzzle className="w-4 h-4" />,
      title: 'JS 脚本与协议插件扩展 (Alt+3)',
    },
    {
      id: 'commands',
      label: '扩展命令',
      icon: <ListChecks className="w-4 h-4" />,
      title: '批量命令与序列队列 (Alt+4)',
    },
    {
      id: 'docs',
      label: '使用说明',
      icon: <HelpCircle className="w-4 h-4" />,
      title: '帮助文档与快捷键 (Alt+5)',
    },
  ];

  return (
    <header className="shrink-0 select-none bg-[#111620] border-b border-[#232B3B]">
      {/* Window Title Strip */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-[#1B2230] bg-[#0E131B]">
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="w-4 h-4 text-[#38BDF8] shrink-0" />
          <span className="text-xs font-semibold tracking-tight text-[#E6EDF5] whitespace-nowrap">
            SerialPulse · 串口调试助手 + TCP/UDP
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums text-[#8B95A7]">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {isConnected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className="text-emerald-400 font-medium">已连接 {portLabel}</span>
                <span className="text-[#4B566B]">·</span>
                <span>{baudRate} bps</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" aria-hidden="true" />
                <span>未连接 · {portLabel}</span>
              </>
            )}
          </span>

          <button
            type="button"
            onClick={onToggleAlwaysOnTop}
            aria-label="切换窗口置顶提示 (Ctrl+Shift+T)"
            aria-pressed={alwaysOnTop}
            title="窗口置顶模式 (Ctrl+Shift+T)"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              alwaysOnTop
                ? 'bg-[#0EA5E9]/20 text-[#38BDF8] border border-[#0EA5E9]/40'
                : 'text-[#8B95A7] hover:text-[#E6EDF5] hover:bg-[#1B2230]'
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>置顶</span>
          </button>
        </div>
      </div>

      {/* Mode Icon Toolbar (matches reference screenshots) */}
      <div className="h-10 px-2 flex items-center justify-between">
        <nav aria-label="主功能导航" className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                title={item.title}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`h-8 px-3 rounded flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                  active
                    ? 'bg-[#1D283A] text-[#38BDF8] border border-[#2E405C]'
                    : 'text-[#94A3B8] hover:text-[#E6EDF5] hover:bg-[#171E2B] border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === 'plugins' && activePluginCount > 0 && (
                  <span className="ml-0.5 text-[10px] font-mono tabular-nums text-emerald-400">
                    ({activePluginCount})
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="打开全局设置"
            title="编码、字体与显示设置"
            className="h-8 px-2.5 rounded flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#E6EDF5] hover:bg-[#171E2B] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">设置</span>
          </button>
        </div>
      </div>
    </header>
  );
};
