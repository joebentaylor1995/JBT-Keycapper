import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import validator from 'gltf-validator';
import sharp from 'sharp';

const bytes = readFileSync(new URL('../public/keycap-switch.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());

test('embedded maps stay within the web texture budget', async () => {
  const binaryStart = 28 + jsonLength;
  for (const image of gltf.images) {
    const view = gltf.bufferViews[image.bufferView];
    const offset = binaryStart + view.byteOffset;
    const metadata = await sharp(bytes.subarray(offset, offset + view.byteLength)).metadata();
    assert.ok(metadata.width <= 1024 && metadata.height <= 1024);
  }
  assert.ok(bytes.length < 6_000_000);
});

test('GLB passes Khronos validation without warnings or errors', async () => {
  const result = await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(result.issues.numErrors, 0);
  assert.equal(result.issues.numWarnings, 0);
});

test('cap and stem are independently addressable with embedded assets', () => {
  const cap = gltf.nodes.find((n) => n.extras?.interactionRole === 'keycap');
  const stem = gltf.nodes.find((n) => n.extras?.interactionRole === 'stem');
  const shellIndex = gltf.nodes.findIndex((n) => n.extras?.interactionRole === 'shell');
  assert.ok(cap?.children.includes(shellIndex));
  assert.ok(stem && Number.isInteger(stem.mesh));
  assert.ok(!cap.children.includes(gltf.nodes.indexOf(stem)));
  assert.ok(gltf.images.every((image) => image.bufferView !== undefined));
  assert.ok(gltf.buffers.every((buffer) => !buffer.uri));
});
