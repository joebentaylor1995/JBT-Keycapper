import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
const [source, ffmpeg, scratch] = process.argv.slice(2);
if (!source || !ffmpeg || !scratch) throw Error('Usage: node scripts/package-rendered.mjs FRAMES FFMPEG SCRATCH');
const output = new URL('../public/rendered/', import.meta.url);
fs.mkdirSync(new URL('frames/',output),{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const framePath=(index)=>path.join(source,`${String(index+1).padStart(4,'0')}.png`);
for(let i=0;i<33;i++){
  while(!fs.existsSync(framePath(i))) await new Promise(r=>setTimeout(r,1000));
  // Render output appears before its final write completes; retry decoding until valid.
  let encoded=false;
  while(!encoded){
    try{
      await sharp(framePath(i)).webp({quality:94,effort:6}).toFile(new URL(`frames/${String(i+1).padStart(4,'0')}.webp`,output).pathname);encoded=true;
    }catch(error){console.warn(error.message);await new Promise(r=>setTimeout(r,1000));}
  }
  console.log(`Packed frame ${i+1}/33`);
}
const ease=(a,b,count)=>Array.from({length:count},(_,i)=>Math.round(a+(b-a)*(1-(1-i/(count-1))**3)));
const clips={hover:ease(0,4,10),press:ease(4,32,8),release:ease(32,0,18)};
clips.demo=[...Array(15).fill(0),...clips.hover,...Array(8).fill(4),...clips.press,...Array(24).fill(32),...clips.release,...Array(15).fill(0)];
for(const [name,indices] of Object.entries(clips)){
  const list=path.join(scratch,`${name}.txt`);
  fs.writeFileSync(list,indices.map(i=>`file '${framePath(i).replaceAll("'","'\\''")}'\nduration 0.016666667`).join('\n')+`\nfile '${framePath(indices.at(-1))}'\n`);
  execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-r','60','-c:v','libx264','-crf','17','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart',new URL(`${name}.mp4`,output).pathname]);
  console.log(`Encoded ${name}.mp4`);
}
const files=fs.readdirSync(new URL('frames/',output));
console.log(JSON.stringify({frames:files.length,frameBytes:files.reduce((n,f)=>n+fs.statSync(new URL('frames/'+f,output)).size,0)}));
