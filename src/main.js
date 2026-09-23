import './style.css';
import './sound-controls.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { KeyMotion } from './motion.js';
import { KeySounds, soundNumbers, choosePair } from './sounds.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const stage = canvas.parentElement;
const motion = new KeyMotion();
const sounds = new KeySounds(import.meta.env.BASE_URL);
let heldPress = null;
for (const number of soundNumbers) $('sound-pair').add(new Option(`Pair ${number}`, String(number)));
$('sound-pair').addEventListener('change', () => { sounds.selection = $('sound-pair').value; });
$('sound-volume').addEventListener('input', () => {
  sounds.setVolume(Number($('sound-volume').value) / 100);
  $('sound-volume-value').textContent = `${$('sound-volume').value}%`;
});
$('sound-mute').addEventListener('change', () => {
  sounds.muted = $('sound-mute').checked; sounds.setVolume(sounds.volume);
});
const defaults = { travel: 3.4, hover: 0.45, tilt: 6, transmission: 90, frost: 28 };
const settings = { ...defaults };
const pointer = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let renderer, scene, camera, pivot, cap, stem, shell, housing;
let capY = 0, stemY = 0, inside = false, ready = false;
let capMeshes = [], lastTime = 0, status = '', uiTime = 0;

function fail(message) {
  ready = false;
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error-message').textContent = message;
  $('load-state').textContent = 'Preview unavailable';
  $('press').disabled = true;
}
$('retry').addEventListener('click', () => location.reload());

function updateReduced() {
  motion.reduced = reducedQuery.matches;
  $('reduced-note').hidden = !motion.reduced;
}
updateReduced();
reducedQuery.addEventListener('change', updateReduced);

async function press(owner) {
  if (!ready || heldPress) return;
  const number = choosePair(sounds.selection, sounds.previous);
  const session = { owner, number, buffers: null };
  heldPress = session;
  motion.press();
  canvas.dataset.held = 'true';
  $('press-count').textContent = `${motion.count} ${motion.count === 1 ? 'press' : 'presses'}`;
  try {
    if (!sounds.muted) {
      const buffers = await sounds.prepare(number);
      // A quick release, blur or reset must not trigger delayed audio.
      if (heldPress !== session || document.hidden) return;
      session.buffers = buffers;
      sounds.playDown(number, buffers);
      $('sound-status').textContent = `Pair ${number} · down`;
      canvas.dataset.soundPair = String(number);
    } else $('sound-status').textContent = 'Sound muted';
  } catch (error) {
    $('sound-status').textContent = 'Audio unavailable. The key still works.';
    console.warn(error.message);
  }
}
function release(owner) {
  if (!heldPress || (owner !== undefined && heldPress.owner !== owner)) return;
  const session = heldPress;
  heldPress = null;
  motion.release();
  canvas.dataset.held = 'false';
  if (session.buffers) {
    sounds.playUp(session.buffers);
    $('sound-status').textContent = `Pair ${session.number} · up`;
  }
}
function pointerPress(event) {
  if (event.button !== 0 || heldPress || !ready) return;
  if (event.currentTarget === canvas) {
    readPointer(event);
    if (!hitKey()) return;
  }
  event.preventDefault();
  event.currentTarget.focus({ preventScroll: true });
  event.currentTarget.setPointerCapture(event.pointerId);
  press(`pointer:${event.pointerId}`);
}
$('press').addEventListener('pointerdown', pointerPress);
for (const target of [canvas, $('press')]) {
  target.addEventListener('lostpointercapture', (event) => release(`pointer:${event.pointerId}`));
}
window.addEventListener('pointerup', (event) => release(`pointer:${event.pointerId}`));
window.addEventListener('pointercancel', (event) => release(`pointer:${event.pointerId}`));
window.addEventListener('blur', () => { inside = false; release(); });

function readPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
}
function hitKey() {
  if (!ready) return false;
  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(capMeshes, false).length > 0;
}
canvas.addEventListener('pointermove', (event) => {
  readPointer(event);
  inside = event.pointerType !== 'touch';
});
canvas.addEventListener('pointerleave', () => { inside = false; pointer.set(0, 0); });
canvas.addEventListener('pointercancel', () => { inside = false; pointer.set(0, 0); });
canvas.addEventListener('pointerdown', pointerPress);
document.addEventListener('keydown', (event) => {
  if ((event.code === 'Space' || event.code === 'Enter') &&
      [document.body, canvas, $('press')].includes(event.target)) {
    event.preventDefault(); if (!event.repeat) press(`key:${event.code}`);
  }
});
document.addEventListener('keyup', (event) => {
  if (heldPress?.owner === `key:${event.code}`) { event.preventDefault(); release(`key:${event.code}`); }
});

const format = {
  travel: (v) => `${v.toFixed(1)} mm`, hover: (v) => `${v.toFixed(2)} mm`,
  tilt: (v) => `${v}°`, transmission: (v) => `${v}%`, frost: (v) => `${v}%`,
};
function applySettings() {
  motion.travel = settings.travel;
  motion.hoverDepth = settings.hover;
  motion.depth = Math.min(motion.depth, motion.travel);
  motion.startDepth = Math.min(motion.startDepth, motion.travel);
  if (shell) {
    shell.material.transmission = settings.transmission / 100;
    // Baked roughness contains the 0.25–0.35 microfrost range.
    shell.material.roughness = settings.frost / 30;
  }
  for (const id of Object.keys(defaults)) {
    $(id + '-value').textContent = format[id](settings[id]);
    $(id).value = settings[id];
  }
}
for (const id of Object.keys(defaults)) $(id).addEventListener('input', () => {
  settings[id] = Number($(id).value); applySettings();
});
$('reset').addEventListener('click', () => {
  Object.assign(settings, defaults);
  for (const id of Object.keys(defaults)) $(id).value = defaults[id];
  motion.reset(); pointer.set(0, 0); inside = false;
  heldPress = null; canvas.dataset.held = 'false'; sounds.stop();
  $('press-count').textContent = '0 presses';
  applySettings();
});

async function makeStudio() {
  const hdr = await new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}environment/studio_small_09_1k.hdr`);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(hdr);
  scene.environment = target.texture;
  scene.environmentIntensity = 0.8;
  scene.environmentRotation.y = 0.65;
  scene.background = hdr;
  scene.backgroundRotation.y = 0.65;
  scene.backgroundBlurriness = 0.8;
  scene.backgroundIntensity = 0.06;
  pmrem.dispose();
}

function resize() {
  if (!renderer || !camera) return;
  const { width, height } = stage.getBoundingClientRect();
  const aspect = width / height;
  const halfHeight = 0.0185 * Math.max(1, 1 / aspect);
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(width, height, false);
}

function animate(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
  lastTime = time;
  if (!ready) return;
  motion.hovered = inside && hitKey();
  canvas.classList.toggle('over-key', motion.hovered);
  const depth = motion.step(dt);
  cap.position.y = capY - depth / 1000;
  stem.position.y = stemY - depth / 1000;
  const tilt = motion.reduced || !inside ? 0 : THREE.MathUtils.degToRad(settings.tilt);
  const follow = 1 - Math.exp(-8 * dt);
  pivot.rotation.y += (pointer.x * tilt - pivot.rotation.y) * follow;
  pivot.rotation.x += (-pointer.y * tilt * 0.65 - pivot.rotation.x) * follow;
  renderer.render(scene, camera);
  if (time - uiTime > 45) {
    uiTime = time;
    $('depth').innerHTML = `${depth.toFixed(2)} <small>mm</small>`;
    $('travel-meter').style.transform = `scaleX(${depth / settings.travel})`;
    if (status !== motion.state) { status = motion.state; $('motion-state').textContent = status; }
    canvas.dataset.depth = depth.toFixed(4);
    canvas.dataset.state = motion.state;
  }
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.transmissionResolutionScale = 1;
    renderer.setClearColor(0x191919);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-0.025, 0.025, 0.0185, -0.0185, 0.001, 2);
    const az = THREE.MathUtils.degToRad(43);
    camera.position.set(Math.sin(az) * 0.07, Math.tan(Math.PI / 6) * 0.07, Math.cos(az) * 0.07);
    camera.lookAt(0, 0, 0); camera.rotateZ(THREE.MathUtils.degToRad(-20));
    await makeStudio();
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-0.04, 0.06, 0.04);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.radius = 4;
    keyLight.shadow.blurSamples = 8;
    Object.assign(keyLight.shadow.camera, { left: -0.03, right: 0.03, top: 0.035, bottom: -0.035, near: 0.005, far: 0.2 });
    keyLight.shadow.bias = -0.00005;
    keyLight.shadow.normalBias = 0.000015;
    keyLight.shadow.camera.updateProjectionMatrix();
    scene.add(keyLight, keyLight.target);
    RectAreaLightUniformsLib.init();
    for (const [position, size, intensity] of [
      [[-0.045, 0.0415, 0.012], 0.045, 5],
      [[0.028, 0.0275, -0.020], 0.032, 8],
      [[-0.035, 0.0075, 0.026], 0.045, 1.2],
      [[0.010, -0.0065, 0.029], 0.035, 0.7],
    ]) {
      const light = new THREE.RectAreaLight(0xffffff, intensity, size, size);
      light.position.set(...position); light.lookAt(0, 0, 0); scene.add(light);
    }
    let assetBytes = 0;
    const model = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}keycap-switch.glb`, (event) => {
      if (event.total) assetBytes = event.total;
    });
    model.scene.traverse((o) => {
      const role = o.userData.interactionRole;
      if (role === 'keycap') cap = o;
      if (role === 'stem') stem = o;
      if (role === 'shell') shell = o;
      if (o.name.startsWith('Switch') && o.material?.name === 'Graphite • satin nylon') housing = o;
    });
    if (!cap || !stem || !shell) throw new Error('The GLB is missing its keycap, shell or stem interaction nodes.');
    capY = cap.position.y; stemY = stem.position.y;
    cap.traverse((o) => { if (o.isMesh) capMeshes.push(o); });
    // Nested transmission is not composited by the transmission pass. The cap's
    // inner mounting boss and stem are solid nylon; the outer shell transmits.
    model.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        for (const property of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
          if (o.material[property]) o.material[property].anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        }
      }
      if (o.isMesh && o !== shell && o.material?.transmission) o.material.transmission = 0;
      if (o.material?.name === 'Cobalt blue • molded polymer') {
        o.material.map = null;
        o.material.color.setRGB(0.002, 0.035, 0.15);
      }
    });
    shell.material.thickness = 0.00015;
    shell.material.color.setRGB(1, 1, 1);
    shell.material.specularIntensity = 1;
    shell.material.specularColor.setRGB(0.22, 0.65, 1);
    shell.material.side = THREE.FrontSide;
    shell.material.attenuationDistance = 0.025;
    shell.material.attenuationColor.setRGB(0.1, 0.45, 1);
    shell.material.envMapIntensity = 1;
    // Stock screen-space transmission applies a wide, resolution-dependent blur
    // even when an insert is directly beneath a thin skin. Keep surface roughness
    // for highlights, but use a smaller scattering footprint for this thin shell.
    shell.material.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec3 vPolymerPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPolymerPosition = position;');
      shader.fragmentShader = 'varying vec3 vPolymerPosition;\n' + shader.fragmentShader;
      const transmission = THREE.ShaderChunk.transmission_pars_fragment.replace(
        'applyIorToRoughness( roughness, ior );',
        'applyIorToRoughness( roughness * mix(1.65, 0.4, smoothstep(0.0185, 0.020, vPolymerPosition.y)), ior );',
      );
      shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_pars_fragment>', transmission);
    };
    shell.material.customProgramCacheKey = () => 'thin-frosted-polymer-v1';
    shell.material.needsUpdate = true;
    pivot = new THREE.Group(); scene.add(pivot);
    model.scene.position.y = -0.0105;
    pivot.add(model.scene);
    // A subtle studio floor catches a real shadow under the pins and housing.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x202126, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = new THREE.Box3().setFromObject(pivot).min.y - 0.0002;
    floor.receiveShadow = true;
    scene.add(floor);
    applySettings(); resize();
    new ResizeObserver(resize).observe(stage);
    ready = true;
    $('press').disabled = false;
    $('loading').hidden = true;
    $('load-state').textContent = 'Live preview';
    $('asset-detail').textContent = assetBytes ? `${(assetBytes / 1e6).toFixed(1)} MB GLB` : 'GLB loaded';
    canvas.dataset.ready = 'true';
    renderer.setAnimationLoop(animate);
    // Read-only diagnostics used by the browser tests and useful to integrators.
    window.keycapPreview = Object.freeze({
      snapshot: () => ({ ready, depth: motion.depth, state: motion.state, count: motion.count,
        hovered: motion.hovered, reduced: motion.reduced, capY: cap.position.y, restCapY: capY,
        stemY: stem.position.y, restStemY: stemY, housingY: housing?.position.y,
        tilt: { x: pivot.rotation.x, y: pivot.rotation.y }, settings: { ...settings },
        triangles: renderer.info.render.triangles }),
      screenPoint: () => {
        scene.updateMatrixWorld(true);
        const center = new THREE.Box3().setFromObject(shell).getCenter(new THREE.Vector3()).project(camera);
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + (center.x + 1) * rect.width / 2, y: rect.top + (1 - center.y) * rect.height / 2 };
      },
    });
  } catch (error) {
    console.error(error);
    fail(`Use a local web server to open this preview and check that WebGL is enabled. ${error.message}`);
  }
}
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault(); renderer?.setAnimationLoop(null);
  fail('The graphics context was interrupted. Reload the preview to reconnect.');
});
document.addEventListener('visibilitychange', () => {
  lastTime = 0;
  if (document.hidden) { inside = false; release(); sounds.stop(); }
});
init();
