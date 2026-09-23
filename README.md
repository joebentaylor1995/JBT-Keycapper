# JBT Keycapper

The default preview uses real Blender Cycles renders of the approved smooth blue keycap and matte charcoal switch. The camera, original materials and studio lighting are baked into the rendered images, so the browser does not approximate the plastic shader. The earlier interactive 3D version remains at `webgl.html` for comparison.

## Blender-rendered playback

Blender MCP created an animated copy of the existing scene, saved separately as `keycap-rendered-animation.blend`. Both the Keycap parent and switch stem move through 3.4 mm while the housing stays fixed. The source scene was restored after saving the animation copy. There are 33 evenly spaced poses rendered at 1200 × 1200, 128 Cycles samples, GPU rendering and denoising.

`public/rendered/hover.mp4`, `press.mp4`, `release.mp4` and `demo.mp4` are H.264 MP4 videos at 60 fps, with no embedded audio. Hover covers rest to 0.45 mm; press continues from hover to full travel; release returns from full travel to rest. The demo combines these with a held-down pause.

For the interactive page, `src/rendered.js` draws the matching compressed WebP frames on a 2D canvas, choosing the pose from the spring motion's current depth. This deliberately avoids video seeking/keyframe delays: the user can hold indefinitely, release halfway down or press again during the return without a clip boundary jump. It is rendered-image playback, not realtime WebGL. The MP4s are provided for ordinary video use.

Pointer tilt is a small screen-space effect, not a changing 3D camera. Lighting and material sliders are unavailable because these properties are baked into the renders. All 33 frames preload before interaction; 1200px decoded frames can use approximately 190 MB of image memory. No Three.js code loads on the default rendered page.

## Run

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4173. Use a web server, not a `file://` URL.

```sh
npm test
npm run build
```

The `dist/` directory is a self-contained static website: upload its contents to any static host, or run `python3 -m http.server 4173 --directory dist`. No CDN, API key or external HDRI is required.

## Interactions

**Export full click** downloads a 1200 × 1200 video containing rest, press, a short hold, release and return to rest. It uses the current travel, sound pair, volume and mute settings. Random selection chooses one matched pair for the whole export. Encoding runs locally in the browser, with MP4 preferred and WebM as fallback; keep the tab visible until complete. The export uses the fixed Blender camera without pointer tilt.

- Pointer movement gently tilts the rendered image (3° default); reduced-motion preferences disable this.
- Hover over the keycap to depress it by 0.45 mm.
- Hold the mouse/touch on the cap or **Press key** button, or hold Space/Enter with the canvas focused, for a 3.4 mm stroke. The cap stays down until release, returns fully, then resumes hover if the pointer remains over it. Pointer capture handles releases outside the button; window blur and cancelled touches release safely.
- The keycap's three child meshes and the blue stem move together; the housing and contacts stay fixed.
- The animation is runtime-driven in `src/motion.js`, not a baked GLB animation clip. Repeated clicks cannot accumulate a transform offset.
- Touch and keyboard work without hover. Reduced-motion preferences disable hover movement and pointer tilt.
- Sliders adjust travel, hover depth and screen tilt. Reset restores defaults. The legacy WebGL page additionally has transmission and roughness controls.
- The Sound dropdown selects any of the 64 supplied Flurples Cardboard recording pairs, or randomises the number per press without immediately repeating it. Down and up always use the same number, even if selection changes while held. Down plays on input down; up plays only on input release. Volume and mute controls are included; hover is silent. Sound files are bundled in `public/sounds/`. On the first uncached pair, audio waits for decoding; if release happens before loading finishes, late sounds are suppressed.

## Legacy WebGL integration

Use GLTFLoader to load the GLB. Find the parent with `userData.interactionRole === 'keycap'` and the stem with role `stem`. Save both resting positions once. On each frame, assign `restY - depthInMillimetres / 1000` to their local Y positions. Do not translate the entire model to press the key.

`src/main.js` contains the studio environment, camera, pointer raycasting and physical-material settings. The exported GLB includes transmission, IOR, specular and packed normal/roughness textures. Blender's mixed shaders and subsurface scattering are approximated by glTF physical materials; a WebGL render is not pixel-identical to Cycles. Preview-only material sliders do not modify the downloaded GLB.

The exported shell is a continuous hollow mesh with embedded inserts and no side grooves. The original Blender material setup remains intact. The read-only `window.keycapPreview.snapshot()` provides motion diagnostics.

## Browser appearance refinement

The preview uses ACES filmic tone mapping, a bundled 1K HDR studio environment for lighting/reflections and a dim blurred background, area fill lights, PCF-filtered dynamic shadows, and a studio floor that receives the assembly's shadow. The full-resolution transmission pass has a thin-shell scattering adjustment: the top uses a narrower blur footprint than the walls so the embedded graphic stays legible. The mask follows the key in local coordinates.

The shell and inserts have six newly baked 1024px colour, roughness and tangent-normal maps from Blender Cycles. The existing housing maps are 512px. Blender's built-in glTF exporter produced the model, followed by JPEG colour compression and lossless PNG normal/roughness compression using `scripts/optimize-glb.mjs`. Every embedded material texture is at most 1024px. The resulting GLB is approximately 5.7 MB. This is file compression, not KTX2 GPU compression. The script also repairs zero tangents at isolated degenerate UV poles. Original Blender meshes, materials and UVs are preserved.

Use the preview project to retain its shader, environment and shadows when integrating. The standalone GLB includes the baked portable PBR materials, but not the environment, custom transmission adjustment or runtime animation. Realtime refraction and opaque shadow-map silhouettes remain approximations of Cycles; the browser does not reproduce translucent caustics or multiple scattering exactly.

HDRI: [Studio Small 09](https://polyhaven.com/a/studio_small_09), Poly Haven, CC0. Bundled locally in `public/environment/`; no external network requests are needed at runtime.

Primary API references: [MeshPhysicalMaterial](https://threejs.org/docs/#MeshPhysicalMaterial), [GLTFLoader](https://threejs.org/docs/#GLTFLoader).
