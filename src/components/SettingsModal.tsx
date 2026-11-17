import React from 'react';
import { X } from 'lucide-react';
import { AppSettings, TextEncoding } from '../types/serial';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChangeSettings: (patch: Partial<AppSettings>) => void;
}

const ENCODINGS: TextEncoding[] = ['UTF-8', 'ASCII', 'GB2312', 'UNICODE', 'BIG5', 'SHIFT_JIS'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  onChangeSettings,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-[#111620] border border-[#283244] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#232B3B] flex items-center justify-between">
          <h2 id="settings-modal-title" className="text-sm font-semibold text-[#E6EDF5]">
            工作台全局设置
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置窗口"
            className="p-1 rounded text-[#8B95A7] hover:text-white hover:bg-[#1E2736] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs text-[#CBD5E1]">
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <label htmlFor="setting-encoding" className="text-[#8B95A7]">
              字符编码格式：
            </label>
            <select
              id="setting-encoding"
              value={settings.encoding}
              onChange={(e) => onChangeSettings({ encoding: e.target.value as TextEncoding })}
              className="h-8 px-2.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono focus:outline-none focus:border-[#38BDF8]"
            >
              {ENCODINGS.map((enc) => (
                <option key={enc} value={enc}>
                  {enc}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <label htmlFor="setting-fontsize" className="text-[#8B95A7]">
              终端字体大小：
            </label>
            <div className="flex items-center gap-3">
              <input
                id="setting-fontsize"
                type="range"
                min={11}
                max={18}
                value={settings.fontSize}
                onChange={(e) => onChangeSettings({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-[#0EA5E9]"
              />
              <span className="w-12 text-right font-mono tabular-nums text-[#E6EDF5]">
                {settings.fontSize}px
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <label htmlFor="setting-maxlines" className="text-[#8B95A7]">
              最大日志缓存：
            </label>
            <select
              id="setting-maxlines"
              value={settings.maxLogLines}
              onChange={(e) => onChangeSettings({ maxLogLines: Number(e.target.value) })}
              className="h-8 px-2.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono focus:outline-none focus:border-[#38BDF8]"
            >
              <option value={1000}>1,000 行</option>
              <option value={3000}>3,000 行</option>
              <option value={8000}>8,000 行</option>
              <option value={20000}>20,000 行</option>
            </select>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <label htmlFor="setting-wavebuf" className="text-[#8B95A7]">
              波形采样缓冲：
            </label>
            <select
              id="setting-wavebuf"
              value={settings.waveformBufferSize}
              onChange={(e) => onChangeSettings({ waveformBufferSize: Number(e.target.value) })}
              className="h-8 px-2.5 rounded bg-[#161C28] border border-[#283244] text-[#E6EDF5] font-mono focus:outline-none focus:border-[#38BDF8]"
            >
              <option value={400}>400 点</option>
              <option value={800}>800 点</option>
              <option value={1500}>1,500 点</option>
              <option value={3000}>3,000 点</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showWaveformGrid}
              onChange={(e) => onChangeSettings({ showWaveformGrid: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span>波形画布显示点阵与十字坐标刻度</span>
          </label>
        </div>

        <div className="px-4 py-3 border-t border-[#232B3B] bg-[#0E131B] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded bg-[#0EA5E9] hover:bg-[#0284C7] text-slate-950 font-semibold text-xs cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
