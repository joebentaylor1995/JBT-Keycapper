import './style.css';
import './sound-controls.css';
import { KeyMotion } from './motion.js';
import { KeySounds, soundNumbers, choosePair } from './sounds.js';
import { exportClick } from './export-click.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview'), stage = canvas.parentElement;
const context = canvas.getContext('2d', { alpha: false });
const motion = new KeyMotion();
const sounds = new KeySounds(import.meta.env.BASE_URL);
const frames = [];
const defaults = { travel:3.4, hover:0.45, tilt:3 };
const settings = { ...defaults };
let ready = false, held = null, inside = false, lastTime = 0, lastFrame = -1;
let pointer = {x:0, y:0}, tilt = {x:0, y:0};
let square = {x:0,y:0,size:1};
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function reducedChanged() { motion.reduced = reduced.matches; $('reduced-note').hidden = !motion.reduced; }
reducedChanged(); reduced.addEventListener('change', reducedChanged);

for (const n of soundNumbers) $('sound-pair').add(new Option(`Pair ${n}`, String(n)));
$('sound-pair').addEventListener('change', () => {
  sounds.selection = $('sound-pair').value;
  if(sounds.selection!=='random') sounds.prepare(Number(sounds.selection)).catch(()=>{});
});
$('sound-volume').addEventListener('input', () => {
  sounds.setVolume(Number($('sound-volume').value)/100);
  $('sound-volume-value').textContent = `${$('sound-volume').value}%`;
});
$('sound-mute').addEventListener('change', () => { sounds.muted = $('sound-mute').checked; sounds.setVolume(sounds.volume); });

async function press(owner) {
  if (!ready || held) return;
  const session = { owner, number:choosePair(sounds.selection, sounds.previous), buffers:null };
  held = session; motion.press(); canvas.dataset.held = 'true';
  $('press-count').textContent = `${motion.count} ${motion.count === 1 ? 'press' : 'presses'}`;
  try {
    if (sounds.muted) { $('sound-status').textContent = 'Sound muted'; return; }
    const buffers = await sounds.prepare(session.number);
    // Warm the small recording library after the first gesture, so later random
    // presses don't wait for new downloads or decoding.
    if (!sounds.warmed) {
      sounds.warmed = true;
      for (const n of soundNumbers) sounds.prepare(n).catch(() => {});
    }
    if (held !== session || document.hidden) return;
    session.buffers = buffers; sounds.playDown(session.number, buffers);
    $('sound-status').textContent = `Pair ${session.number} · down`;
    canvas.dataset.soundPair = session.number;
  } catch { $('sound-status').textContent = 'Audio unavailable. The key still works.'; }
}
function release(owner) {
  if (!held || (owner !== undefined && held.owner !== owner)) return;
  const session = held; held = null; motion.release(); canvas.dataset.held = 'false';
  if (session.buffers) { sounds.playUp(session.buffers); $('sound-status').textContent = `Pair ${session.number} · up`; }
}
function readPointer(event) {
  const r = canvas.getBoundingClientRect();
  pointer = {x:((event.clientX-r.left)/r.width)*2-1, y:((event.clientY-r.top)/r.height)*2-1};
  const x = ((event.clientX-r.left)/r.width*canvas.width-square.x)/square.size;
  const y = ((event.clientY-r.top)/r.height*canvas.height-square.y)/square.size;
  // Camera-projected cap silhouette in the Blender render.
  const polygon = [[.15,.61],[.16,.35],[.33,.12],[.66,.14],[.82,.34],[.59,.64]];
  let hit = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,yi]=polygon[i], [xj,yj]=polygon[j];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) hit=!hit;
  }
  return hit;
}
canvas.addEventListener('pointermove', (e) => { inside = readPointer(e) && e.pointerType !== 'touch'; });
canvas.addEventListener('pointerleave', () => { inside=false; pointer={x:0,y:0}; });
function down(e) {
  if (e.button!==0 || held || !ready) return;
  if (e.currentTarget===canvas && !readPointer(e)) return;
  e.preventDefault(); e.currentTarget.focus({preventScroll:true});
  e.currentTarget.setPointerCapture(e.pointerId); press(`pointer:${e.pointerId}`);
}
for (const target of [canvas,$('press')]) {
  target.addEventListener('pointerdown',down);
  target.addEventListener('lostpointercapture',(e)=>release(`pointer:${e.pointerId}`));
}
window.addEventListener('pointerup',(e)=>release(`pointer:${e.pointerId}`));
window.addEventListener('pointercancel',(e)=>{inside=false;release(`pointer:${e.pointerId}`);});
window.addEventListener('blur',()=>{inside=false;release();});
document.addEventListener('keydown',(e)=>{
  if (['Space','Enter'].includes(e.code) && [document.body,canvas,$('press')].includes(e.target)) {
    e.preventDefault(); if (!e.repeat) press(`key:${e.code}`);
  }
});
document.addEventListener('keyup',(e)=>{if(held?.owner===`key:${e.code}`){e.preventDefault();release(`key:${e.code}`);}});
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden){inside=false;release();sounds.stop();}});

function applySettings() {
  motion.travel=settings.travel; motion.hoverDepth=settings.hover;
  motion.depth=Math.min(motion.depth,motion.travel);
  motion.startDepth=Math.min(motion.startDepth,motion.travel);
  for (const id of Object.keys(defaults)) {
    $(id).value=settings[id];
    $(id+'-value').textContent=id==='tilt'?`${settings[id]}°`:`${settings[id].toFixed(id==='hover'?2:1)} mm`;
  }
}
for (const id of Object.keys(defaults)) $(id).addEventListener('input',()=>{settings[id]=Number($(id).value);applySettings();});
$('reset').addEventListener('click',()=>{
  held=null;motion.reset();sounds.stop();canvas.dataset.held='false';
  inside=false;pointer={x:0,y:0};Object.assign(settings,defaults);applySettings();$('press-count').textContent='0 presses';
});
$('retry').addEventListener('click',()=>location.reload());
$('export-click').addEventListener('click', async () => {
  const button = $('export-click'); button.disabled = true;
  $('export-status').textContent = 'Exporting full click… Keep this tab visible.';
  try { $('export-status').textContent = await exportClick({ frames, sounds, travel: settings.travel }); }
  catch (error) { $('export-status').textContent = error.message; }
  finally { button.disabled = false; }
});
function resize() {
  const dpr=Math.min(devicePixelRatio,2), r=stage.getBoundingClientRect();
  canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
  const size=Math.min(canvas.width,canvas.height);
  square={x:(canvas.width-size)/2,y:(canvas.height-size)/2,size};lastFrame=-1;
}
function animate(time) {
  const dt=lastTime?Math.min((time-lastTime)/1000,.05):1/60;lastTime=time;
  if(ready){
    motion.hovered=inside;const depth=motion.step(dt);
    const frame=Math.max(0,Math.min(32,Math.round(depth/3.4*32)));
    if(frame!==lastFrame){
      context.fillStyle='#191919';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(frames[frame],square.x,square.y,square.size,square.size);lastFrame=frame;
    }
    const strength=motion.reduced||!inside?0:settings.tilt;
    const follow=1-Math.exp(-8*dt);
    tilt.x+=(-pointer.y*strength*.5-tilt.x)*follow;tilt.y+=(pointer.x*strength-tilt.y)*follow;
    canvas.style.transform=`perspective(1600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;
    canvas.classList.toggle('over-key',inside);
    canvas.dataset.depth=depth.toFixed(4);canvas.dataset.state=motion.state;canvas.dataset.frame=frame;
    $('depth').innerHTML=`${depth.toFixed(2)} <small>mm</small>`;
    $('motion-state').textContent=motion.state;
    $('travel-meter').style.transform=`scaleX(${depth/settings.travel})`;
  }
  requestAnimationFrame(animate);
}
async function init(){
  try{
    let loaded=0;
    await Promise.all(Array.from({length:33},async(_,i)=>{
      const image=new Image();image.src=`${import.meta.env.BASE_URL}rendered/frames/${String(i+1).padStart(4,'0')}.webp`;
      await image.decode();frames[i]=image;$('load-state').textContent=`Loading render ${++loaded}/33`;
      if(i===0){
        resize();context.fillStyle='#191919';context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,square.x,square.y,square.size,square.size);$('loading').hidden=true;
      }
    }));
    applySettings();resize();new ResizeObserver(resize).observe(stage);
    ready=true;canvas.dataset.ready='true';$('press').disabled=false;$('export-click').disabled=false;$('loading').hidden=true;
    $('load-state').textContent='Rendered in Blender';$('asset-detail').textContent='Cycles · 1200px';
    requestAnimationFrame(animate);
  }catch(error){
    $('loading').hidden=true;$('error').hidden=false;$('load-state').textContent='Render unavailable';
    $('error-message').textContent='The rendered frames could not load. Please reload the preview.';console.error(error);
  }
}
init();
