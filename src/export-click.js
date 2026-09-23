import { KeyMotion } from './motion.js';
import { choosePair } from './sounds.js';

export function clickFrames(travel) {
  const motion = new KeyMotion(); motion.travel = travel;
  return Array.from({ length: 90 }, (_, i) => {
    if (i === 12) motion.press();
    if (i === 30) motion.release();
    return Math.max(0, Math.min(32, Math.round(motion.step(1 / 60) / 3.4 * 32)));
  });
}

export async function exportClick({ frames, sounds, travel }) {
  if (!globalThis.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    throw new Error('Video export is unavailable in this browser. Use Chrome, Edge or Safari.');
  const mimeType = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('No supported video export format in this browser.');
  const number = choosePair(sounds.selection, sounds.previous);
  const muted = sounds.muted, volume = sounds.volume;
  const buffers = muted ? null : await sounds.prepare(number);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1200;
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(frames[0], 0, 0);
  const stream = canvas.captureStream(60), sources = [];
  let gain, destination, timer, rejectRecording;
  const cancel = () => { if (document.hidden) rejectRecording?.(new Error('Export cancelled because the tab was hidden. Please keep it visible and try again.')); };
  document.addEventListener('visibilitychange', cancel);
  try {
    if (buffers) {
      destination = sounds.context.createMediaStreamDestination();
      gain = sounds.context.createGain(); gain.gain.value = volume; gain.connect(destination);
      stream.addTrack(destination.stream.getAudioTracks()[0]);
    }
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12000000 });
    const chunks = [], poses = clickFrames(travel);
    await new Promise((resolve, reject) => {
      rejectRecording = reject;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('Video encoding failed. Please try again.'));
      recorder.onstop = resolve;
      recorder.onstart = () => {
        const start = performance.now();
        if (buffers) {
          const audioStart = sounds.context.currentTime;
          buffers.forEach((buffer, i) => {
            const source = sounds.context.createBufferSource(); source.buffer = buffer;
            source.connect(gain); source.start(audioStart + (i === 0 ? .2 : .5)); sources.push(source);
          });
        }
        const duration = Math.max(1.5, buffers ? .5 + buffers[1].duration + .1 : 0);
        const draw = () => {
          const elapsed = (performance.now() - start) / 1000;
          context.drawImage(frames[poses[Math.min(89, Math.floor(elapsed * 60))]], 0, 0);
          if (elapsed >= duration) { recorder.stop(); return; }
          timer = setTimeout(draw, 1000 / 60);
        };
        draw();
      };
      recorder.start();
    }).finally(() => { if (recorder.state !== 'inactive') recorder.stop(); });
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
    const link = document.createElement('a'); link.href = url;
    link.download = `JBT-Keycapper-full-click-${muted ? 'silent' : `pair-${number}`}.${extension}`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return muted ? 'Full click exported without sound.' : `Full click exported with sound pair ${number}.`;
  } finally {
    clearTimeout(timer); document.removeEventListener('visibilitychange', cancel);
    sources.forEach(source => { try { source.stop(); } catch {} source.disconnect(); });
    gain?.disconnect(); destination?.disconnect(); stream.getTracks().forEach(track => track.stop());
  }
}
