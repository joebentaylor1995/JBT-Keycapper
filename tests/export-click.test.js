import test from 'node:test';
import assert from 'node:assert/strict';
import { clickFrames } from '../src/export-click.js';

test('full-click export starts at rest, holds fully down and returns to rest', () => {
  const frames = clickFrames(3.4);
  assert.equal(frames.length, 90);
  assert.ok(frames.slice(0, 12).every(frame => frame === 0));
  assert.ok(frames.slice(18, 30).every(frame => frame === 32));
  assert.equal(frames.at(-1), 0);
  assert.ok(frames.every(frame => frame >= 0 && frame <= 32));
});
test('export respects reduced travel', () => {
  assert.equal(Math.max(...clickFrames(1.7)), 16);
});
