export const soundNumbers = [...Array.from({ length: 54 }, (_, i) => i + 1), 56, 57, 58, 3640, 3675, 3676, 57416, 57419, 57421, 57424];

export function choosePair(selection, previous, random = Math.random) {
  if (selection !== 'random') {
    const number = Number(selection);
    if (!soundNumbers.includes(number)) throw new Error('Unknown sound pair');
    return number;
  }
  const choices = soundNumbers.filter((n) => n !== previous);
  return choices[Math.floor(random() * choices.length)];
}

export class KeySounds {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.selection = 'random'; this.previous = null; this.volume = 0.65;
    this.muted = false; this.buffers = new Map(); this.sources = new Set();
  }
  async prepare(number) {
    // Create/resume directly from a user gesture to satisfy autoplay restrictions.
    this.context ??= new AudioContext();
    this.gain ??= this.context.createGain();
    if (!this.connected) { this.gain.connect(this.context.destination); this.connected = true; }
    this.setVolume(this.volume);
    await this.context.resume();
    if (!this.buffers.has(number)) {
      const pair = Promise.all(['down', 'up'].map(async (direction) => {
        const response = await fetch(`${this.baseUrl}sounds/${number}-${direction}.mp3`);
        if (!response.ok) throw new Error(`Could not load sound ${number}-${direction}`);
        return this.context.decodeAudioData(await response.arrayBuffer());
      })).catch((error) => { this.buffers.delete(number); throw error; });
      this.buffers.set(number, pair);
    }
    return this.buffers.get(number);
  }
  setVolume(volume) {
    this.volume = volume;
    if (this.gain) this.gain.gain.setValueAtTime(this.muted ? 0 : volume, this.context.currentTime);
  }
  playDown(number, buffers) {
    this.previous = number;
    this.play(buffers[0]);
  }
  playUp(buffers) { this.play(buffers[1]); }
  play(buffer) {
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.connect(this.gain);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    source.start(this.context.currentTime);
  }
  stop() {
    for (const source of this.sources) source.stop();
    this.sources.clear();
  }
}
