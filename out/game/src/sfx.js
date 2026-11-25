// Tiny synthesized kitchen sounds with WebAudio (no sound files): blips for picking and placing, a
// noise burst for the knife and the grill, a bell for the pass and a cash jingle for a served plate.

let audio = null;

/** Audio may only start after a user gesture; call this from one. */
export function unlockAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!audio && Context) audio = new Context();
  if (audio && audio.state === 'suspended') audio.resume();
}

function tone(freq, duration, type = 'square', volume = 0.05, slide = 0, delay = 0) {
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration, cutoff, volume = 0.08) {
  const length = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start();
}

const SOUNDS = {
  pick: () => tone(540, 0.06, 'triangle', 0.06, 120),
  place: () => tone(300, 0.08, 'square', 0.04, -90),
  close: () => { tone(400, 0.07, 'square', 0.04); tone(600, 0.1, 'square', 0.04, 0, 0.06); },
  plate: () => tone(880, 0.1, 'triangle', 0.05, 220),
  chop: () => noise(0.05, 2400, 0.12),
  sizzle: () => noise(0.35, 5200, 0.05),
  trash: () => noise(0.12, 600, 0.1),
  ready: () => tone(990, 0.08, 'triangle', 0.05),
  burn: () => tone(220, 0.25, 'sawtooth', 0.04, -80),
  bell: () => { tone(1568, 0.5, 'sine', 0.08); tone(2093, 0.4, 'sine', 0.04); },
  serve: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.09, 'square', 0.035, 0, i * 0.07)),
  order: () => { tone(740, 0.05, 'triangle', 0.04); tone(990, 0.07, 'triangle', 0.04, 0, 0.06); },
  miss: () => tone(180, 0.35, 'sawtooth', 0.05, -90),
  deny: () => tone(130, 0.08, 'square', 0.035),
  whistle: () => tone(1200, 0.6, 'sine', 0.06, 300),
};

/** Plays the sounds for a step's rule events (silently skipped until audio is unlocked). */
export function playEvents(events) {
  if (!audio) return;
  for (const event of events) SOUNDS[event.type]?.();
}
