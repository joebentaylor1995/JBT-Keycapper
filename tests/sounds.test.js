import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { choosePair, soundNumbers, KeySounds } from '../src/sounds.js';

test('every selectable number has both audio files', () => {
  assert.equal(soundNumbers.length, 64);
  for (const number of soundNumbers) for (const direction of ['down', 'up']) {
    assert.ok(statSync(new URL(`../public/sounds/${number}-${direction}.mp3`, import.meta.url)).size > 0);
  }
});
test('fixed selection stays fixed; random selection avoids immediate repeats', () => {
  assert.equal(choosePair('57424', 1), 57424);
  for (const previous of soundNumbers) for (const r of [0, 0.5, 0.99999]) {
    const result = choosePair('random', previous, () => r);
    assert.ok(soundNumbers.includes(result));
    assert.notEqual(result, previous);
  }
  assert.throws(() => choosePair('55', 1));
});
test('only down plays on press; matching up waits for explicit release', () => {
  const played = [];
  const sounds = new KeySounds('/');
  sounds.context = { currentTime: 10, createBufferSource: () => ({
    connect() {}, disconnect() {}, stop() {}, start(time) { played.push([this.buffer, time]); },
  }) };
  sounds.gain = {};
  const buffers = ['17-down', '17-up'];
  sounds.playDown(17, buffers);
  assert.deepEqual(played, [['17-down', 10]]);
  sounds.selection = '23';
  sounds.context.currentTime = 15;
  sounds.playUp(buffers);
  assert.deepEqual(played, [['17-down', 10], ['17-up', 15]]);
  assert.equal(sounds.previous, 17);
  sounds.stop();
  assert.equal(sounds.sources.size, 0);
});
