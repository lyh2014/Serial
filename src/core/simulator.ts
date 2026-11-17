import { ExtendedCommand, LogEntry, TransportType } from '../types/serial';
import { bytesToHexString, computeAdd8, computeCrc16Modbus, encodeText, formatHexDump } from './protocols';

export const NRF_BOOT_SEED_LINES: string[] = [
  '[00:00:00.152,149] <inf> current_sense: ADC ready: 3 coil-current + 3 rail inputs, oversample=4',
  '[00:00:00.152,220] <inf> sensor_app: BLE send thread started',
  '[00:00:00.153,760] <inf> current_sense: axis X zero = 1640 LSB (avg of 64 raw samples)',
  '[00:00:00.155,354] <inf> current_sense: axis Y zero = 1640 LSB (avg of 64 raw samples)',
  '[00:00:00.156,946] <inf> current_sense: axis Z zero = 1640 LSB (avg of 64 raw samples)',
  '[00:00:00.177,281] <inf> mmc5983: Sensor 0 initialized',
  '[00:00:00.177,380] <inf> mmc5983: probe[0] 4000000Hz: PROD_ID=0x30 (expect 0x30)',
  '[00:00:00.197,671] <inf> mmc5983: Sensor 1 initialized',
  '[00:00:00.197,773] <inf> mmc5983: probe[1] 4000000Hz: PROD_ID=0x30 (expect 0x30)',
  '[00:00:00.218,061] <inf> mmc5983: Sensor 2 initialized',
  '[00:00:00.218,160] <inf> mmc5983: probe[2] 4000000Hz: PROD_ID=0x30 (expect 0x30)',
  '[00:00:00.218,172] <inf> mmc5983: MMC5983 driver ready (sensors=3, max_samples=200)',
  '[00:00:00.218,253] <inf> antenna: RF0 ready: CS cs_expander.1  IRQ gpio@10a000.2',
  '[00:00:00.218,317] <inf> antenna: RF1 ready: CS cs_expander.0  IRQ gpio@10a000.3',
  '[00:00:00.218,545] <inf> antenna: RF0 cmd 0x02 param 0x73 acked',
  '[00:00:00.218,757] <inf> antenna: RF1 cmd 0x02 param 0x73 acked',
  '[00:00:00.218,765] <inf> antenna: CC1310 RF master ready (SPIM21, mode 1, 4000000 Hz, 64 bytes/frame)',
  '[00:00:00.218,776] <inf> acq_session: acq session ready (delay=2ms, activations=4)',
  '[00:00:00.218,873] <inf> led_status: LED status started (blue=cs_expander.4 run=cs_expander.3)',
  '[00:00:00.218,941] <inf> bt_sdc_hci_driver: SoftDevice Controller build revision: fc de 41 eb a2 d1 42 24 00 b5 f8 57 9f ac 9d 9e aa c9 b4 34',
  '[00:00:00.220,605] <inf> bt_hci_core: HW Platform: Nordic Semiconductor (0x0002)',
  '[00:00:00.220,623] <inf> bt_hci_core: HW Variant: nRF54Lx (0x0005)',
  '[00:00:00.220,640] <inf> bt_hci_core: Firmware: Standard Bluetooth controller (0x00) Version 252.16862 Build 1121034987',
  '[00:00:00.221,254] <inf> bt_hci_core: HCI transport: SDC',
  '[00:00:00.221,307] <inf> bt_hci_core: Identity: CA:8C:FF:9B:9D:BF (random)',
];

export function createSeedLogEntries(): LogEntry[] {
  return NRF_BOOT_SEED_LINES.map((line, index) => {
    const rawBytes = encodeText(line + '\n');
    return {
      id: `seed-${index}`,
      timestamp: `00:00:00.${String(152 + index * 3).padStart(3, '0')}`,
      direction: 'rx',
      rawBytes,
      text: line,
      hexDump: formatHexDump(rawBytes),
      protocolTag: line.includes('current_sense') ? 'Zephyr-Log' : undefined,
    };
  });
}

export function createNextSimulatedPacket(
  transport: TransportType,
  tick: number
): { bytes: Uint8Array; textHint?: string } {
  const t = tick * 0.14;

  if (transport === 'sim-pid') {
    const target = 450 * (Math.sin(tick * 0.04) >= 0 ? 1 : -1);
    const response =
      target * (1 - Math.exp(-((tick % 40) * 0.18))) +
      Math.sin(t * 2.1) * 28 +
      (Math.cos(t * 5) * 6);
    const error = target - response;
    const pwm = Math.max(-1000, Math.min(1000, error * 1.65));
    const line = `pid: ${target.toFixed(1)}, ${response.toFixed(1)}, ${error.toFixed(1)}, ${pwm.toFixed(1)}\n`;
    return { bytes: encodeText(line), textHint: line.trimEnd() };
  }

  if (transport === 'sim-justfloat') {
    // 3 IEEE-754 float32 channels + 0x00 0x00 0x80 0x7F tail
    const ia = Math.sin(t) * 620 + Math.sin(t * 3) * 45;
    const ib = Math.sin(t - (2 * Math.PI) / 3) * 620 + Math.sin(t * 3) * 45;
    const ic = Math.sin(t + (2 * Math.PI) / 3) * 620 + Math.sin(t * 3) * 45;
    const buf = new Uint8Array(16);
    const view = new DataView(buf.buffer);
    view.setFloat32(0, ia, true);
    view.setFloat32(4, ib, true);
    view.setFloat32(8, ic, true);
    buf[12] = 0x00;
    buf[13] = 0x00;
    buf[14] = 0x80;
    buf[15] = 0x7f;
    return { bytes: buf };
  }

  if (transport === 'sim-modbus') {
    // Simulate Modbus RTU Slave 0x01 Read Holding Registers Response (4 registers)
    const ch0 = Math.round(245 + Math.sin(t) * 35); // temp * 10
    const ch1 = Math.round(610 + Math.cos(t * 0.7) * 55); // humidity * 10
    const ch2 = Math.round(1200 + Math.sin(t * 1.5) * 180); // pressure
    const frame = new Uint8Array(11);
    const view = new DataView(frame.buffer);
    frame[0] = 0x01;
    frame[1] = 0x03;
    frame[2] = 0x06;
    view.setInt16(3, ch0, false);
    view.setInt16(5, ch1, false);
    view.setInt16(7, ch2, false);
    const crc = computeCrc16Modbus(frame.subarray(0, 9));
    frame[9] = crc & 0xff;
    frame[10] = (crc >> 8) & 0xff;
    return { bytes: frame };
  }

  // Default: sim-nrf / tcp / udp mixed Zephyr sensor telemetry
  const elapsedSec = (1 + tick * 0.05).toFixed(3);
  const cx = (Math.sin(t) * 380 + Math.cos(t * 3.1) * 45).toFixed(2);
  const cy = (Math.cos(t * 0.9) * 310 + Math.sin(t * 2.4) * 30).toFixed(2);
  const cz = (Math.sin(t * 0.5 + 1.1) * 240).toFixed(2);

  if (tick % 12 === 0) {
    const line = `[00:00:${elapsedSec.padStart(6, '0').replace('.', ',')}] <inf> mmc5983: sample[${tick}] B_x=${cx} B_y=${cy} B_z=${cz} uT\n`;
    return { bytes: encodeText(line), textHint: line.trimEnd() };
  }

  const line = `[00:00:${elapsedSec.padStart(6, '0').replace('.', ',')}] <inf> current_sense: Coil_X_mA=${cx} Coil_Y_mA=${cy} Coil_Z_mA=${cz}\n`;
  return { bytes: encodeText(line), textHint: line.trimEnd() };
}

export function buildSimulatedEchoReply(txBytes: Uint8Array, txText: string): Uint8Array | null {
  const trimmed = txText.trim();
  if (!trimmed) return null;

  // Respond to AT or Modbus polls or AA55 commands
  if (/^AT$/i.test(trimmed)) {
    return encodeText('OK\r\n');
  }
  if (/^AT\+INFO\??$/i.test(trimmed)) {
    return encodeText('DEVICE: nRF54L15-DK · FW: 2.4.1 · VBUS: 3.308V\r\n');
  }
  if (/^PING$/i.test(trimmed)) {
    return encodeText('PONG\r\n');
  }

  // If AA 55 binary command, reply with ACK frame
  if (txBytes.length >= 4 && txBytes[0] === 0xaa && txBytes[1] === 0x55) {
    const ack = new Uint8Array([0xaa, 0x55, txBytes[2] | 0x80, 0x02, 0x00, 0x01, 0x00]);
    ack[6] = computeAdd8(ack.subarray(0, 6));
    return ack;
  }

  return encodeText(`[ACK ${bytesToHexString(txBytes.subarray(0, 8))}] len=${txBytes.length}\n`);
}

export const DEFAULT_EXTENDED_COMMANDS: ExtendedCommand[] = [
  { id: 'cmd-1', name: 'AT 心跳检测', payload: 'AT\\r\\n', isHex: false, delayMs: 200, group: '通用调试' },
  { id: 'cmd-2', name: '读取设备信息', payload: 'AT+INFO?\\r\\n', isHex: false, delayMs: 300, group: '通用调试' },
  { id: 'cmd-3', name: 'Modbus 读保持寄存器 (01 03)', payload: '01 03 00 00 00 03 05 CB', isHex: true, delayMs: 500, group: 'Modbus RTU' },
  { id: 'cmd-4', name: 'AA55 启动采样帧', payload: 'AA 55 02 02 01 00 04', isHex: true, delayMs: 300, group: '二进制帧' },
  { id: 'cmd-5', name: 'AA55 停止采样帧', payload: 'AA 55 02 02 00 00 03', isHex: true, delayMs: 300, group: '二进制帧' },
  { id: 'cmd-6', name: 'PID 目标阶跃测试', payload: 'SET_TARGET=500\\n', isHex: false, delayMs: 400, group: '运动控制' },
];
