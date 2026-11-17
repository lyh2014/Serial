import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLUGINS, runRxPlugin, runTxPlugin } from './pluginEngine';
import { encodeText } from './protocols';

test('RX plugin extracts waveform channels and rewrites log line', () => {
  const plugin = DEFAULT_PLUGINS.find((p) => p.id === 'rx-zephyr-plot')!;
  const text = '[00:00:01.000] <inf> current_sense: coil_curr: 120.5, -45.2, 88.0';
  const res = runRxPlugin(plugin, encodeText(text), text);

  assert.equal(res.error, undefined);
  assert.equal(res.protocolTag, 'CurrentSense');
  assert.deepEqual(res.waveformPoints, [
    { channel: 'Coil_X_mA', value: 120.5 },
    { channel: 'Coil_Y_mA', value: -45.2 },
    { channel: 'Coil_Z_mA', value: 88.0 },
  ]);
  assert.deepEqual(res.writtenText, [text]);
});

test('TX ADD8 plugin appends correct checksum byte', () => {
  const plugin = DEFAULT_PLUGINS.find((p) => p.id === 'tx-add8')!;
  const input = new Uint8Array([0x01, 0x02, 0x03]);
  const res = runTxPlugin(plugin, input);

  assert.equal(res.error, undefined);
  assert.deepEqual(Array.from(res.outputBytes), [0x01, 0x02, 0x03, 0x06]);
});

test('TX CRC16-Modbus plugin appends little-endian CRC16', () => {
  const plugin = DEFAULT_PLUGINS.find((p) => p.id === 'tx-crc16-modbus')!;
  const input = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x03]);
  const res = runTxPlugin(plugin, input);

  assert.equal(res.error, undefined);
  assert.deepEqual(Array.from(res.outputBytes), [0x01, 0x03, 0x00, 0x00, 0x00, 0x03, 0x05, 0xcb]);
});

test('Broken plugin script returns error gracefully without throwing', () => {
  const broken = {
    id: 'broken',
    name: 'Broken',
    type: 'rx' as const,
    description: 'test',
    enabled: true,
    code: 'const x = nonexistentVar.foo;',
  };
  const res = runRxPlugin(broken, encodeText('abc'), 'abc');
  assert.ok(res.error);
  assert.deepEqual(res.writtenText, ['abc']);
});
