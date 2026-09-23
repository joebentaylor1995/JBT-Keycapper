import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

test('all 33 Blender poses are present at matching dimensions', async () => {
  const directory=new URL('../public/rendered/frames/',import.meta.url);
  const files=readdirSync(directory).filter(f=>f.endsWith('.webp')).sort();
  assert.equal(files.length,33);
  for(let i=0;i<33;i++){
    assert.equal(files[i],`${String(i+1).padStart(4,'0')}.webp`);
    const metadata=await sharp(readFileSync(new URL(files[i],directory))).metadata();
    assert.equal(metadata.width,1200);assert.equal(metadata.height,1200);
  }
});
test('hover, press, release and demonstration videos are packaged',()=>{
  for(const name of ['hover','press','release','demo']){
    const buffer=readFileSync(new URL(`../public/rendered/${name}.mp4`,import.meta.url));
    assert.equal(buffer.toString('ascii',4,8),'ftyp');assert.ok(buffer.length>1000);
  }
});
