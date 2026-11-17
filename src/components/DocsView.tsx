import React, { useState } from 'react';
import { MainViewMode } from '../types/serial';

interface DocsViewProps {
  initialSection?: string;
  onNavigateView: (view: MainViewMode) => void;
}

const SECTIONS = [
  { id: 'welcome', label: '欢迎' },
  { id: 'basics', label: '基础功能' },
  { id: 'protocols', label: '多协议解析' },
  { id: 'waveform', label: '波形绘制' },
  { id: 'plugins', label: '脚本插件' },
  { id: 'shortcuts', label: '常用快捷键' },
];

export const DocsView: React.FC<DocsViewProps> = ({ initialSection = 'basics', onNavigateView }) => {
  const [activeSection, setActiveSection] = useState(initialSection);

  const jumpTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`doc-sec-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section aria-label="使用说明与协议参考文档" className="flex-1 min-w-0 flex bg-[#0B0E14] overflow-hidden">
      {/* Left vertical navigation matching Screenshots 3 & 4 */}
      <nav aria-label="文档目录" className="w-48 shrink-0 bg-[#111620] border-r border-[#232B3B] p-4 space-y-1">
        {SECTIONS.map((sec) => {
          const active = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => jumpTo(sec.id)}
              className={`w-full text-right px-3 py-2.5 text-sm border-b transition-colors cursor-pointer ${
                active
                  ? 'border-[#F59E0B] text-[#E6EDF5] font-semibold'
                  : 'border-[#1E2636] text-[#8B95A7] hover:text-[#CBD5E1]'
              }`}
            >
              {sec.label}
            </button>
          );
        })}
      </nav>

      {/* Right Scrollable Documentation Content */}
      <div className="flex-1 overflow-y-auto px-10 py-8 space-y-10 text-sm text-[#CBD5E1] leading-relaxed max-w-4xl">
        <div id="doc-sec-welcome" className="space-y-2 pb-6 border-b border-[#232B3B]">
          <h1 className="text-xl font-bold text-[#E6EDF5]">SerialPulse 串口调试与波形分析工作台</h1>
          <p className="text-[#94A3B8]">
            集成了串口（支持 Web Serial 实体硬件与内置协议仿真器）、TCP/UDP 调试、多协议帧解码、实时多视图示波器以及可扩展 JavaScript 插件引擎。
          </p>
        </div>

        <div id="doc-sec-basics" className="space-y-3 pb-6 border-b border-[#232B3B]">
          <h2 className="text-base font-semibold text-[#E6EDF5]">基础功能</h2>
          <ul className="list-disc pl-5 space-y-2 text-[#CBD5E1]">
            <li>显示从串口接收到的数据，支持字符串与十六进制（Hex + ASCII 对照列）两种显示方式。</li>
            <li>支持多种文本编码（ASCII、GB2312、UNICODE、UTF-8、BIG5、SHIFT_JIS），可在右上角设置窗口切换。</li>
            <li>支持标准波特率与自定义波特率输入，支持 DTR / RTS 控制与 RI / DSR / CTS 状态指示。</li>
            <li>
              <strong className="text-[#E6EDF5]">自动断帧：</strong>收到数据包后超过设定毫秒无新字节即自动换行断帧，方便观察分帧。
            </li>
            <li>
              <strong className="text-[#E6EDF5]">扩展命令：</strong>可创建和保存多达 600 条扩展命令，并支持一键顺序执行整个命令队列。
            </li>
            <li>
              <strong className="text-[#E6EDF5]">窗口置顶：</strong>快捷键 <code className="font-mono text-[#38BDF8]">Ctrl + Shift + T</code> 开启/关闭置顶状态提示。
            </li>
          </ul>
        </div>

        <div id="doc-sec-protocols" className="space-y-3 pb-6 border-b border-[#232B3B]">
          <h2 className="text-base font-semibold text-[#E6EDF5]">多协议解析</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-[#38BDF8]">FireWater (CSV)：</strong>
              识别如 <code className="font-mono text-[#F59E0B]">1.23, 4.56, -0.78</code> 或 <code className="font-mono text-[#F59E0B]">pid: 500, 482.3, 17.7</code> 的文本波形流。
            </li>
            <li>
              <strong className="text-[#38BDF8]">JustFloat (IEEE-754)：</strong>
              解析以 <code className="font-mono text-[#F59E0B]">00 00 80 7F</code> 结尾的小端序 32 位浮点二进制数据流。
            </li>
            <li>
              <strong className="text-[#38BDF8]">Key=Value 遥测：</strong>
              自动提取 <code className="font-mono text-[#F59E0B]">temp=25.4, hum=60.5</code> 等带名变量并映射到波形通道。
            </li>
            <li>
              <strong className="text-[#38BDF8]">AA 55 二进制帧 &amp; Modbus RTU：</strong>
              自动校验 ADD8 / CRC16-MODBUS，并在终端中显示校验结果与寄存器/通道值。
            </li>
          </ul>
        </div>

        <div id="doc-sec-waveform" className="space-y-3 pb-6 border-b border-[#232B3B]">
          <h2 className="text-base font-semibold text-[#E6EDF5]">波形绘制</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>当接收到符合波形协议的数据或由 JS 脚本调用 <code className="font-mono text-[#38BDF8]">waveform.push()</code> 时，将实时绘制波形曲线。</li>
            <li>支持在同一个窗口创建单视图、左右分栏、上下分栏与 2×2 四宫格视图，拖动顶部通道名称即可切换所在视图。</li>
            <li>鼠标悬停显示高精度十字光标与各通道实时采样坐标，滚轮可缩放纵轴刻度。</li>
            <li>支持导出与导入标准 CSV 波形数据文件。</li>
          </ul>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigateView('waveform')}
              className="px-4 py-1.5 rounded-full border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-xs text-[#E6EDF5] cursor-pointer"
            >
              前往实时波形窗口
            </button>
          </div>
        </div>

        <div id="doc-sec-plugins" className="space-y-3 pb-6 border-b border-[#232B3B]">
          <h2 className="text-base font-semibold text-[#E6EDF5]">脚本插件扩展机制</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>脚本功能分为接收（RX）和发送（TX）两种，可通过侧边栏复选框随时开启或关闭。</li>
            <li>开启脚本功能后，终端区域会显示醒目的红色边框提示，表明脚本正在实时拦截处理数据。</li>
            <li>
              接收脚本每次收到数据包时执行，调用 <code className="font-mono text-[#38BDF8]">receive.write()</code> 将处理结果发送到终端，调用 <code className="font-mono text-[#38BDF8]">waveform.push(name, val)</code> 推送波形点。
            </li>
            <li>
              发送脚本每次发送数据时执行，可调用 <code className="font-mono text-[#38BDF8]">utils.crc16()</code> / <code className="font-mono text-[#38BDF8]">utils.add8()</code> 添加校验并由 <code className="font-mono text-[#38BDF8]">send.write()</code> 输出。
            </li>
          </ul>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigateView('plugins')}
              className="px-4 py-1.5 rounded-full border border-[#283244] bg-[#161C28] hover:border-[#38BDF8] text-xs text-[#E6EDF5] cursor-pointer"
            >
              打开脚本 API 编辑器
            </button>
          </div>
        </div>

        <div id="doc-sec-shortcuts" className="space-y-3">
          <h2 className="text-base font-semibold text-[#E6EDF5]">常用快捷键</h2>
          <div className="border border-[#232B3B] rounded overflow-hidden">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-[#1E2636]">
                <tr>
                  <td className="py-2.5 px-4 font-mono text-[#38BDF8] w-48">Ctrl + F</td>
                  <td className="py-2.5 px-4">在右侧串口数据窗口打开查找栏（支持大小写与正则表达式）</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-mono text-[#38BDF8]">Ctrl + C / Ctrl + A</td>
                  <td className="py-2.5 px-4">复制终端选中内容 / 全选终端日志</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-mono text-[#38BDF8]">Ctrl + L</td>
                  <td className="py-2.5 px-4">快速清空当前终端显示缓冲区</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-mono text-[#38BDF8]">Ctrl + S</td>
                  <td className="py-2.5 px-4">导出并保存当前串口接收日志</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-mono text-[#38BDF8]">Ctrl + Enter</td>
                  <td className="py-2.5 px-4">发送输入框中的指令数据（终端模式下直接 Enter 发送）</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-mono text-[#38BDF8]">Ctrl + Shift + T</td>
                  <td className="py-2.5 px-4">切换窗口置顶状态</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
