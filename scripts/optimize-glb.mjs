import fs from 'node:fs';
import sharp from 'sharp';

const path = new URL('../public/keycap-switch.glb', import.meta.url);
const input = fs.readFileSync(path);
const jsonLength = input.readUInt32LE(12);
const gltf = JSON.parse(input.subarray(20, 20 + jsonLength));
const bin = Buffer.from(input.subarray(28 + jsonLength));
let repaired = 0;
// Smart-unwrapped bevel poles can have a zero tangent in Blender's export.
// Supply an orthogonal unit tangent at these isolated UV degeneracies.
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  const tangent = gltf.accessors[primitive.attributes.TANGENT];
  const normal = gltf.accessors[primitive.attributes.NORMAL];
  if (!tangent || !normal) continue;
  const tv = gltf.bufferViews[tangent.bufferView], nv = gltf.bufferViews[normal.bufferView];
  for (let i = 0; i < tangent.count; i++) {
    const at = (tv.byteOffset || 0) + (tangent.byteOffset || 0) + i * (tv.byteStride || 16);
    const t = [0, 4, 8].map((offset) => bin.readFloatLE(at + offset));
    if (Math.hypot(...t) > 0.5) continue;
    const an = (nv.byteOffset || 0) + (normal.byteOffset || 0) + i * (nv.byteStride || 12);
    const [x,y,z] = [0,4,8].map((offset) => bin.readFloatLE(an + offset));
    const fallback = Math.abs(z) < 0.9 ? [y,-x,0] : [0,z,-y];
    const length = Math.hypot(...fallback);
    fallback.forEach((value, axis) => bin.writeFloatLE(value / length, at + axis * 4));
    bin.writeFloatLE(1, at + 12);
    repaired++;
  }
}
const colorImages = new Set(gltf.materials.flatMap((m) => {
  const index = m.pbrMetallicRoughness?.baseColorTexture?.index;
  return index === undefined ? [] : [gltf.textures[index].source];
}));
const replacements = new Map();
const imageReport = [];
for (const [index, image] of gltf.images.entries()) {
  const view = gltf.bufferViews[image.bufferView];
  const source = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  let pipeline = sharp(source).resize({ width:1024, height:1024, fit:'inside', withoutEnlargement:true });
  const isColor = colorImages.has(index);
  pipeline = isColor ? pipeline.jpeg({ quality:92, chromaSubsampling:'4:4:4' }) : pipeline.png({ compressionLevel:9 });
  const result = await pipeline.toBuffer({ resolveWithObject:true });
  image.mimeType = isColor ? 'image/jpeg' : 'image/png';
  replacements.set(image.bufferView, result.data);
  imageReport.push({ name:image.name, width:result.info.width, height:result.info.height, bytes:result.data.length, mimeType:image.mimeType });
}
let offset = 0;
const chunks = [];
gltf.bufferViews.forEach((view, index) => {
  const data = replacements.get(index) || bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const padding = Buffer.alloc((4 - data.length % 4) % 4);
  view.byteOffset = offset; view.byteLength = data.length;
  chunks.push(data, padding); offset += data.length + padding.length;
});
gltf.buffers[0].byteLength = offset;
const json = Buffer.from(JSON.stringify(gltf));
const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonPadded.length + offset, 8);
header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(offset, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, jsonPadded, binHeader, ...chunks]);
fs.writeFileSync(path, output);
fs.writeFileSync(new URL('../../keycap-switch.glb', import.meta.url), output);
console.log(JSON.stringify({ before:input.length, after:output.length, repairedTangents:repaired, images:imageReport },null,2));
