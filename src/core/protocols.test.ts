import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHexString,
  bytesToHexString,
  formatHexDump,
  computeAdd8,
  computeCrc16Modbus,
  decodeFireWaterLine,
  decodeKeyValueLine,
  decodeJustFloatStream,
  decodeBinaryTelemetryFrame,
  decodeModbusRtuFrame,
  findLogMatches,
} from './protocols';

test('parseHexString handles spaced, prefixed, and continuous hex strings', () => {
  assert.deepEqual(Array.from(parseHexString('AA 55 01 0f')), [0xaa, 0x55, 0x01, 0x0f]);
  assert.deepEqual(Array.from(parseHexString('0xAA,0x55,0xFF')), [0xaa, 0x55, 0xff]);
  assert.deepEqual(Array.from(parseHexString('AA5502')), [0xaa, 0x55, 0x02]);
  assert.throws(() => parseHexString('AA ZZ'));
});

test('formatHexDump aligns hex bytes with ASCII printable column', () => {
  const bytes = new Uint8Array([0x41, 0x42, 0x00, 0x7e]);
  const dump = formatHexDump(bytes, 4);
  assert.equal(dump, '41 42 00 7e  |AB.~|');
});

test('checksums ADD8 and CRC16-Modbus match known reference vectors', () => {
  const modbusReq = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x03]);
  assert.equal(computeCrc16Modbus(modbusReq), 0xcb05); // low byte 05, high byte CB
  assert.equal(computeAdd8(new Uint8Array([0xaa, 0x55, 0x01, 0x02])), 0x02);
});

test('decodeFireWaterLine parses CSV and prefixed CSV channels', () => {
  const res1 = decodeFireWaterLine('12.5, -3.4, 0.08');
  assert.ok(res1);
  assert.deepEqual(res1.channels, { CH0: 12.5, CH1: -3.4, CH2: 0.08 });

  const res2 = decodeFireWaterLine('pid: 500, 482.3, 17.7');
  assert.ok(res2);
  assert.deepEqual(res2.channels, { pid_0: 500, pid_1: 482.3, pid_2: 17.7 });

  assert.equal(decodeFireWaterLine('hello world'), null);
});

test('decodeKeyValueLine extracts named telemetry variables without timestamps', () => {
  const res = decodeKeyValueLine('[00:00:01.200] temp=25.4, hum=60.5, axis_X: -120');
  assert.ok(res);
  assert.deepEqual(res.channels, { temp: 25.4, hum: 60.5, axis_X: -120 });
});

test('decodeJustFloatStream extracts IEEE-754 float32 frames and retains remainder', () => {
  const buf = new Uint8Array(14);
  const view = new DataView(buf.buffer);
  view.setFloat32(0, 1.5, true);
  view.setFloat32(4, -2.25, true);
  buf[8] = 0x00;
  buf[9] = 0x00;
  buf[10] = 0x80;
  buf[11] = 0x7f;
  buf[12] = 0xaa;
  buf[13] = 0xbb;

  const { frames, remainder } = decodeJustFloatStream(buf);
  assert.equal(frames.length, 1);
  assert.deepEqual(frames[0].channels, { JF0: 1.5, JF1: -2.25 });
  assert.equal(bytesToHexString(remainder), 'aa bb');
});

test('decodeBinaryTelemetryFrame verifies ADD8 checksum and extracts int16 channels', () => {
  const frame = new Uint8Array(9);
  const view = new DataView(frame.buffer);
  frame[0] = 0xaa;
  frame[1] = 0x55;
  frame[2] = 0x01;
  frame[3] = 0x04;
  view.setInt16(4, 1234, true);
  view.setInt16(6, -567, true);
  frame[8] = computeAdd8(frame.subarray(0, 8));

  const { frames, remainder } = decodeBinaryTelemetryFrame(frame);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].valid, true);
  assert.deepEqual(frames[0].channels, { BIN_CH0: 1234, BIN_CH1: -567 });
  assert.equal(remainder.length, 0);
});

test('decodeModbusRtuFrame validates CRC16 and decodes holding registers', () => {
  const frame = new Uint8Array(9);
  const view = new DataView(frame.buffer);
  frame[0] = 0x01;
  frame[1] = 0x03;
  frame[2] = 0x04;
  view.setInt16(3, 254, false);
  view.setInt16(5, 612, false);
  const crc = computeCrc16Modbus(frame.subarray(0, 7));
  frame[7] = crc & 0xff;
  frame[8] = (crc >> 8) & 0xff;

  const res = decodeModbusRtuFrame(frame);
  assert.ok(res);
  assert.equal(res.valid, true);
  assert.deepEqual(res.channels, { REG_0: 254, REG_1: 612 });
});

test('findLogMatches supports plain, case-sensitive, and regex searches', () => {
  const entries = [
    { id: '1', searchableText: '<inf> current_sense: axis X = 1640' },
    { id: '2', searchableText: '<inf> mmc5983: Sensor 0 initialized' },
  ];

  const plain = findLogMatches(entries, 'AXIS', { caseSensitive: false, regex: false });
  assert.equal(plain.matches.length, 1);
  assert.equal(plain.matches[0].entryId, '1');

  const strictCase = findLogMatches(entries, 'AXIS', { caseSensitive: true, regex: false });
  assert.equal(strictCase.matches.length, 0);

  const regex = findLogMatches(entries, 'Sensor\\s+\\d+', { caseSensitive: false, regex: true });
  assert.equal(regex.matches.length, 1);
  assert.equal(regex.matches[0].entryId, '2');

  const badRegex = findLogMatches(entries, '[unclosed', { caseSensitive: false, regex: true });
  assert.ok(badRegex.error);
});
