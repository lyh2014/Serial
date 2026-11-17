import { ScriptPlugin } from '../types/serial';
import { bytesToHexString, computeAdd8, computeCrc16Modbus, decodeTextEncoding, encodeText } from './protocols';

export interface RxScriptExecutionResult {
  writtenText: string[];
  writtenBytes: Uint8Array[];
  waveformPoints: { channel: string; value: number }[];
  protocolTag?: string;
  error?: string;
}

export interface TxScriptExecutionResult {
  outputBytes: Uint8Array;
  error?: string;
}

const SCRIPT_UTILS = {
  toHex: (bytes: Uint8Array) => bytesToHexString(bytes),
  add8: (bytes: Uint8Array) => computeAdd8(bytes),
  crc16: (bytes: Uint8Array) => computeCrc16Modbus(bytes),
  toBytes: (str: string) => encodeText(str),
  toText: (bytes: Uint8Array) => decodeTextEncoding(bytes, 'UTF-8'),
};

export function runRxPlugin(
  plugin: ScriptPlugin,
  inputBytes: Uint8Array,
  inputText: string
): RxScriptExecutionResult {
  const writtenText: string[] = [];
  const writtenBytes: Uint8Array[] = [];
  const waveformPoints: { channel: string; value: number }[] = [];
  let protocolTag: string | undefined;

  const receiveApi = {
    bytes: new Uint8Array(inputBytes),
    text: inputText,
    write: (data: string | Uint8Array | number[]) => {
      if (typeof data === 'string') {
        writtenText.push(data);
      } else if (data instanceof Uint8Array) {
        writtenBytes.push(data);
      } else if (Array.isArray(data)) {
        writtenBytes.push(new Uint8Array(data));
      }
    },
  };

  const waveformApi = {
    push: (channel: string, value: number) => {
      if (typeof channel === 'string' && typeof value === 'number' && Number.isFinite(value)) {
        waveformPoints.push({ channel, value });
      }
    },
  };

  const protocolApi = {
    tag: (name: string) => {
      if (typeof name === 'string') protocolTag = name;
    },
  };

  try {
    const fn = new Function(
      'receive',
      'waveform',
      'protocol',
      'utils',
      `"use strict";\n${plugin.code}`
    );
    fn(receiveApi, waveformApi, protocolApi, SCRIPT_UTILS);
    return { writtenText, writtenBytes, waveformPoints, protocolTag };
  } catch (err) {
    return {
      writtenText: [inputText],
      writtenBytes: [],
      waveformPoints: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function runTxPlugin(plugin: ScriptPlugin, inputBytes: Uint8Array): TxScriptExecutionResult {
  let outputBytes: Uint8Array = inputBytes;

  const sendApi = {
    bytes: new Uint8Array(inputBytes),
    text: decodeTextEncoding(inputBytes, 'UTF-8'),
    write: (data: string | Uint8Array | number[]) => {
      if (typeof data === 'string') {
        outputBytes = encodeText(data);
      } else if (data instanceof Uint8Array) {
        outputBytes = data;
      } else if (Array.isArray(data)) {
        outputBytes = new Uint8Array(data);
      }
    },
  };

  try {
    const fn = new Function('send', 'utils', `"use strict";\n${plugin.code}`);
    fn(sendApi, SCRIPT_UTILS);
    return { outputBytes };
  } catch (err) {
    return {
      outputBytes: inputBytes,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const DEFAULT_PLUGINS: ScriptPlugin[] = [
  {
    id: 'rx-add-timestamp',
    name: 'Add Timestamp',
    type: 'rx',
    description: '为每条接收数据包添加高精度本地毫秒时间戳前缀，并直通写入显示终端。',
    enabled: false,
    builtIn: true,
    code: `// receive.text 为当前接收字符串，receive.bytes 为原始字节
const now = new Date();
const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
receive.write('[' + ts + '] ' + receive.text);`,
  },
  {
    id: 'rx-zephyr-plot',
    name: 'Zephyr Current & Mag Extractor',
    type: 'rx',
    description: '自动从嵌入式日志中提取电流/磁力计数值并推送至实时波形通道。',
    enabled: true,
    builtIn: true,
    code: `// 解析类似 "axis X zero = 1640 LSB" 或 "coil_I: 1.24, 0.85, -0.42"
const mAxis = receive.text.match(/axis\\s+([XYZ])\\s+\\w+\\s*=\\s*(-?\\d+(?:\\.\\d+)?)/i);
if (mAxis) {
  waveform.push('Axis_' + mAxis[1].toUpperCase(), Number(mAxis[2]));
  protocol.tag('Zephyr-Sensor');
}
const mCoil = receive.text.match(/coil_curr:\\s*(-?\\d+(?:\\.\\d+)?),\\s*(-?\\d+(?:\\.\\d+)?),\\s*(-?\\d+(?:\\.\\d+)?)/i);
if (mCoil) {
  waveform.push('Coil_X_mA', Number(mCoil[1]));
  waveform.push('Coil_Y_mA', Number(mCoil[2]));
  waveform.push('Coil_Z_mA', Number(mCoil[3]));
  protocol.tag('CurrentSense');
}
receive.write(receive.text);`,
  },
  {
    id: 'rx-json-telemetry',
    name: 'JSON Telemetry Parser',
    type: 'rx',
    description: '解析 JSON 格式上报数据（如 {"vbus":12.4,"temp":38.2}），自动映射波形曲线。',
    enabled: false,
    builtIn: true,
    code: `try {
  const obj = JSON.parse(receive.text.trim());
  Object.entries(obj).forEach(([k, v]) => {
    if (typeof v === 'number') waveform.push(k, v);
  });
  protocol.tag('JSON-Telemetry');
  receive.write('[JSON] ' + JSON.stringify(obj));
} catch (_) {
  receive.write(receive.text);
}`,
  },
  {
    id: 'tx-add8',
    name: 'ADD8',
    type: 'tx',
    description: '在发送数据包末尾自动追加 1 字节累加和校验 (SUM & 0xFF)。',
    enabled: false,
    builtIn: true,
    code: `const sum = utils.add8(send.bytes);
const out = new Uint8Array(send.bytes.length + 1);
out.set(send.bytes, 0);
out[send.bytes.length] = sum;
send.write(out);`,
  },
  {
    id: 'tx-crc16-modbus',
    name: 'CRC16-Modbus',
    type: 'tx',
    description: '在发送帧末尾追加 2 字节 Modbus CRC-16（低字节在前，高字节在后）。',
    enabled: false,
    builtIn: true,
    code: `const crc = utils.crc16(send.bytes);
const out = new Uint8Array(send.bytes.length + 2);
out.set(send.bytes, 0);
out[send.bytes.length] = crc & 0xff;
out[send.bytes.length + 1] = (crc >> 8) & 0xff;
send.write(out);`,
  },
  {
    id: 'tx-aa55-wrap',
    name: 'AA 55 Frame Wrap',
    type: 'tx',
    description: '自动封装 [0xAA, 0x55, CMD=0x01, LEN] 帧头与 ADD8 帧尾校验。',
    enabled: false,
    builtIn: true,
    code: `const body = send.bytes;
const frame = new Uint8Array(4 + body.length + 1);
frame[0] = 0xAA;
frame[1] = 0x55;
frame[2] = 0x01;
frame[3] = body.length;
frame.set(body, 4);
frame[4 + body.length] = utils.add8(frame.subarray(0, 4 + body.length));
send.write(frame);`,
  },
];
