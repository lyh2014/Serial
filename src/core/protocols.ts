import { ProtocolParserId, SearchMatch, TextEncoding } from '../types/serial';

/**
 * Parse a hex string such as "AA 55 01 02" or "0xAA,0x55" into bytes.
 */
export function parseHexString(input: string): Uint8Array {
  const cleaned = input
    .replace(/0x/gi, ' ')
    .replace(/[,;:\-\r\n\t]+/g, ' ')
    .trim();
  if (!cleaned) return new Uint8Array(0);

  const tokens = cleaned.split(/\s+/);
  const bytes: number[] = [];

  for (const token of tokens) {
    if (!/^[0-9a-fA-F]+$/.test(token)) {
      throw new Error(`无效的十六进制字符: "${token}"`);
    }
    if (token.length <= 2) {
      bytes.push(parseInt(token, 16) & 0xff);
    } else {
      // Split continuous hex string like "AA5501" into byte pairs
      const padded = token.length % 2 === 1 ? '0' + token : token;
      for (let i = 0; i < padded.length; i += 2) {
        bytes.push(parseInt(padded.slice(i, i + 2), 16) & 0xff);
      }
    }
  }
  return new Uint8Array(bytes);
}

export function bytesToHexString(bytes: Uint8Array, separator = ' '): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    parts.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return parts.join(separator);
}

/**
 * Format bytes into side-by-side hex + ASCII dump matching classic serial terminal output.
 */
export function formatHexDump(bytes: Uint8Array, bytesPerLine = 16): string {
  if (bytes.length === 0) return '';
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
    const slice = bytes.subarray(offset, offset + bytesPerLine);
    const hexParts: string[] = [];
    let ascii = '';
    for (let i = 0; i < bytesPerLine; i++) {
      if (i < slice.length) {
        const b = slice[i];
        hexParts.push(b.toString(16).padStart(2, '0'));
        ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
      } else {
        hexParts.push('  ');
      }
    }
    lines.push(`${hexParts.join(' ')}  |${ascii}|`);
  }
  return lines.join('\n');
}

export function computeAdd8(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xff;
  }
  return sum;
}

export function computeCrc16Modbus(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x0001) !== 0) {
        crc = ((crc >> 1) ^ 0xa001) & 0xffff;
      } else {
        crc = (crc >> 1) & 0xffff;
      }
    }
  }
  return crc;
}

export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function decodeTextEncoding(bytes: Uint8Array, encoding: TextEncoding): string {
  if (bytes.length === 0) return '';
  try {
    switch (encoding) {
      case 'ASCII': {
        let out = '';
        for (let i = 0; i < bytes.length; i++) {
          const b = bytes[i];
          if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) {
            out += String.fromCharCode(b);
          } else {
            out += '.';
          }
        }
        return out;
      }
      case 'GB2312':
        return new TextDecoder('gbk', { fatal: false }).decode(bytes);
      case 'BIG5':
        return new TextDecoder('big5', { fatal: false }).decode(bytes);
      case 'SHIFT_JIS':
        return new TextDecoder('shift_jis', { fatal: false }).decode(bytes);
      case 'UNICODE':
        return new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
      case 'UTF-8':
      default:
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

export interface DecodedProtocolResult {
  protocolName: string;
  valid: boolean;
  channels: Record<string, number>;
  decodedSummary?: string;
}

/**
 * FireWater protocol (VOFA+ CSV style):
 * Supports "1.23, 4.56, -0.78" or "samples: 1.23, 4.56, -0.78" or "CH:1.2,3.4"
 */
export function decodeFireWaterLine(line: string): DecodedProtocolResult | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let prefix = 'CH';
  let payload = trimmed;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1 && colonIdx < 24) {
    const candidatePrefix = trimmed.slice(0, colonIdx).trim();
    const afterColon = trimmed.slice(colonIdx + 1).trim();
    if (/^[A-Za-z0-9_\-\s]+$/.test(candidatePrefix) && /^-?\d/.test(afterColon)) {
      prefix = candidatePrefix.replace(/\s+/g, '_') || 'CH';
      payload = afterColon;
    }
  }

  const parts = payload.split(',').map((s) => s.trim());
  if (parts.length === 0) return null;

  const channels: Record<string, number> = {};
  for (let i = 0; i < parts.length; i++) {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(parts[i])) {
      return null;
    }
    const val = Number(parts[i]);
    if (!Number.isFinite(val)) return null;
    const chName = prefix === 'CH' ? `CH${i}` : `${prefix}_${i}`;
    channels[chName] = val;
  }

  return {
    protocolName: 'FireWater',
    valid: true,
    channels,
    decodedSummary: `FireWater [${Object.keys(channels).length}CH]`,
  };
}

/**
 * Key=Value / Telemetry Log protocol:
 * Supports "temp=25.4, hum=61.2, vbus=3.31" or "current_sense: axis X zero = 1640 LSB"
 */
export function decodeKeyValueLine(line: string): DecodedProtocolResult | null {
  const channels: Record<string, number> = {};
  // Match named pairs like temp=24.5, axis_X: -12.3, kp=1.5
  const regex = /([A-Za-z_][A-Za-z0-9_.\-]{0,20})\s*[:=]\s*([+-]?(?:\d+\.?\d*|\.\d+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const key = match[1];
    const num = Number(match[2]);
    // Avoid matching log timestamp prefixes like 00:00:00
    if (Number.isFinite(num) && !/^\d+$/.test(key)) {
      channels[key] = num;
    }
  }

  const keys = Object.keys(channels);
  if (keys.length === 0) return null;

  return {
    protocolName: 'KeyValue',
    valid: true,
    channels,
    decodedSummary: keys.map((k) => `${k}=${channels[k]}`).join(' · '),
  };
}

/**
 * JustFloat (VOFA+ IEEE-754 little-endian binary stream):
 * Each frame ends with 4-byte tail 0x00 0x00 0x80 0x7F.
 */
export function decodeJustFloatStream(buffer: Uint8Array): {
  frames: DecodedProtocolResult[];
  remainder: Uint8Array;
} {
  const frames: DecodedProtocolResult[] = [];
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let frameStart = 0;

  for (let i = 0; i <= buffer.length - 4; i++) {
    if (
      buffer[i] === 0x00 &&
      buffer[i + 1] === 0x00 &&
      buffer[i + 2] === 0x80 &&
      buffer[i + 3] === 0x7f
    ) {
      const payloadLen = i - frameStart;
      if (payloadLen > 0 && payloadLen % 4 === 0 && payloadLen <= 64) {
        const channelCount = payloadLen / 4;
        const channels: Record<string, number> = {};
        for (let c = 0; c < channelCount; c++) {
          const val = view.getFloat32(frameStart + c * 4, true);
          channels[`JF${c}`] = Number.isFinite(val) ? Number(val.toFixed(4)) : 0;
        }
        frames.push({
          protocolName: 'JustFloat',
          valid: true,
          channels,
          decodedSummary: `JustFloat [${channelCount}x float32]`,
        });
      }
      frameStart = i + 4;
      i += 3;
    }
  }

  return {
    frames,
    remainder: buffer.slice(frameStart),
  };
}

/**
 * Custom AA 55 binary telemetry frame:
 * [0xAA][0x55][CMD][LEN][int16_le ch0][int16_le ch1]...[ADD8 checksum over bytes 0..end-1]
 */
export function decodeBinaryTelemetryFrame(buffer: Uint8Array): {
  frames: DecodedProtocolResult[];
  remainder: Uint8Array;
} {
  const frames: DecodedProtocolResult[] = [];
  let i = 0;

  while (i <= buffer.length - 5) {
    if (buffer[i] === 0xaa && buffer[i + 1] === 0x55) {
      const cmd = buffer[i + 2];
      const len = buffer[i + 3];
      const totalLen = 4 + len + 1;
      if (len > 64) {
        i += 2;
        continue;
      }
      if (i + totalLen > buffer.length) {
        break; // wait for remaining bytes
      }

      const slice = buffer.subarray(i, i + totalLen);
      const expectedChecksum = computeAdd8(slice.subarray(0, totalLen - 1));
      const actualChecksum = slice[totalLen - 1];
      const valid = expectedChecksum === actualChecksum;

      const view = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
      const channels: Record<string, number> = {};
      const pairCount = Math.floor(len / 2);
      for (let c = 0; c < pairCount; c++) {
        channels[`BIN_CH${c}`] = view.getInt16(4 + c * 2, true);
      }

      frames.push({
        protocolName: 'AA55-Frame',
        valid,
        channels: valid ? channels : {},
        decodedSummary: `AA55 CMD=0x${cmd.toString(16).padStart(2, '0').toUpperCase()} LEN=${len} ${
          valid ? 'CRC:OK' : `CRC:ERR(${actualChecksum.toString(16)}!=${expectedChecksum.toString(16)})`
        }`,
      });

      i += totalLen;
    } else {
      i++;
    }
  }

  return {
    frames,
    remainder: buffer.slice(i),
  };
}

/**
 * Modbus RTU response/frame decoder with CRC16-MODBUS verification.
 * E.g. Read Holding Registers Response: [addr][0x03][byteCount][hi][lo]...[crcLo][crcHi]
 */
export function decodeModbusRtuFrame(bytes: Uint8Array): DecodedProtocolResult | null {
  if (bytes.length < 5) return null;
  const payload = bytes.subarray(0, bytes.length - 2);
  const crcCalc = computeCrc16Modbus(payload);
  const crcFrame = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
  const valid = crcCalc === crcFrame;

  const addr = bytes[0];
  const fn = bytes[1];
  const channels: Record<string, number> = {};

  if ((fn === 0x03 || fn === 0x04) && bytes.length >= 5) {
    const byteCount = bytes[2];
    if (bytes.length === 5 + byteCount) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let r = 0; r < Math.floor(byteCount / 2); r++) {
        channels[`REG_${r}`] = view.getInt16(3 + r * 2, false);
      }
    }
  }

  return {
    protocolName: 'Modbus-RTU',
    valid,
    channels: valid ? channels : {},
    decodedSummary: `Modbus Slave=${addr} Fn=0x${fn.toString(16).padStart(2, '0')} ${
      valid ? 'CRC16:OK' : 'CRC16:ERR'
    }${Object.keys(channels).length ? ` [${Object.entries(channels).map(([k, v]) => `${k}=${v}`).join(', ')}]` : ''}`,
  };
}

export function parseProtocolPacket(
  protocolId: ProtocolParserId,
  textLine: string,
  rawBytes: Uint8Array
): DecodedProtocolResult | null {
  if (protocolId === 'raw') return null;

  if (protocolId === 'firewater') {
    return decodeFireWaterLine(textLine);
  }
  if (protocolId === 'keyvalue') {
    return decodeKeyValueLine(textLine);
  }
  if (protocolId === 'justfloat') {
    const res = decodeJustFloatStream(rawBytes);
    return res.frames[0] ?? null;
  }
  if (protocolId === 'binary-aa55') {
    const res = decodeBinaryTelemetryFrame(rawBytes);
    return res.frames[0] ?? null;
  }
  if (protocolId === 'modbus-rtu') {
    return decodeModbusRtuFrame(rawBytes);
  }

  // 'auto': try binary protocols first if non-printable bytes dominate, then text protocols
  const jf = decodeJustFloatStream(rawBytes);
  if (jf.frames.length > 0) return jf.frames[0];

  const aa55 = decodeBinaryTelemetryFrame(rawBytes);
  if (aa55.frames.length > 0) return aa55.frames[0];

  const fw = decodeFireWaterLine(textLine);
  if (fw) return fw;

  const kv = decodeKeyValueLine(textLine);
  if (kv) return kv;

  return null;
}

/**
 * Search log entries for Ctrl+F find bar (plain text, case sensitivity, and regex).
 */
export function findLogMatches(
  entries: { id: string; searchableText: string }[],
  query: string,
  options: { caseSensitive: boolean; regex: boolean }
): { matches: SearchMatch[]; error?: string } {
  if (!query) return { matches: [] };

  let matcher: RegExp;
  try {
    const flags = options.caseSensitive ? 'g' : 'gi';
    const pattern = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matcher = new RegExp(pattern, flags);
  } catch (err) {
    return {
      matches: [],
      error: err instanceof Error ? err.message : '正则表达式语法错误',
    };
  }

  const matches: SearchMatch[] = [];
  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    matcher.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = matcher.exec(entry.searchableText)) !== null) {
      if (m[0].length === 0) {
        matcher.lastIndex++;
        continue;
      }
      matches.push({
        entryId: entry.id,
        entryIndex: idx,
        start: m.index,
        end: m.index + m[0].length,
      });
      if (matches.length >= 2000) {
        return { matches };
      }
    }
  }

  return { matches };
}
