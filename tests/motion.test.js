import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyMotion } from '../src/motion.js';
const advance = (m, seconds, hz = 120) => { for (let i = 0; i < seconds * hz; i++) m.step(1 / hz); };
test('hover settles at the shallow depth and releases', () => {
  const m = new KeyMotion(); m.hovered = true; advance(m, 1);
  assert.ok(Math.abs(m.depth - .45) < .002);
  m.hovered = false; advance(m, 1); assert.equal(m.depth, 0);
});
test('press remains down until released, then returns within limits', () => {
  const m = new KeyMotion(); m.press(); let peak = 0;
  for (let i = 0; i < 240; i++) { m.step(1 / 120); peak = Math.max(peak, m.depth); assert.ok(m.depth >= 0 && m.depth <= m.travel); }
  assert.equal(m.depth, m.travel); m.release(); advance(m, 2);
  assert.equal(peak, 3.4); assert.equal(m.depth, 0); assert.equal(m.count, 1);
});
test('rapid repeated clicks do not accumulate displacement', () => {
  const m = new KeyMotion();
  for (let i = 0; i < 20; i++) { m.press(); advance(m, .05); m.release(); advance(m, .05); }
  advance(m, 2); assert.equal(m.depth, 0); assert.equal(m.count, 20);
});
test('returns fully before resuming hover', () => {
  const m = new KeyMotion(); m.hovered = true; advance(m, 1); m.press();
  advance(m, .2); m.release();
  let reachedTop = false;
  for (let i = 0; i < 240; i++) { m.step(1 / 120); if (m.depth === 0) reachedTop = true; }
  assert.ok(reachedTop); assert.ok(Math.abs(m.depth - .45) < .002);
});
test('reduced motion suppresses hover but preserves deliberate pressing', () => {
  const m = new KeyMotion(); m.reduced = true; m.hovered = true; advance(m, 1); assert.equal(m.depth, 0);
  m.press(); advance(m, .1); assert.equal(m.depth, m.travel); m.release(); advance(m, 2); assert.equal(m.depth, 0);
});
test('motion is stable at both 30 and 120 frames per second', () => {
  for (const hz of [30, 120]) { const m = new KeyMotion(); m.press(); advance(m, 2, hz); assert.equal(m.depth, m.travel); m.release(); advance(m, 2, hz); assert.equal(m.depth, 0); }
});
test('repeat keydown is ignored and a quick release reverses immediately', () => {
  const m = new KeyMotion(); m.press(); m.press(); m.step(.02);
  const depth = m.depth; m.release(); m.step(.02);
  assert.equal(m.count, 1); assert.ok(m.depth < depth);
});
