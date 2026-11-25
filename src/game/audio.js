// Procedural sounds need no downloads and start only after the first user gesture.
export function createAudio() {
  let context, master, ocean, seaGain;
  const active = new Set();
  function start(volume) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio(); master = context.createGain(); master.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate), samples = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < samples.length; i++) { last = (last + (Math.random() * 2 - 1) * .02) / 1.02; samples[i] = last * 4; }
      ocean = context.createBufferSource(); ocean.buffer = buffer; ocean.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 500;
      seaGain = context.createGain(); seaGain.gain.value = .12;
      ocean.connect(filter); filter.connect(seaGain); seaGain.connect(master); ocean.start();
    }
    master.gain.value = volume;
    context.resume().catch(() => {});
  }
  function tone(frequency, duration, gain, type = 'sine') {
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(), envelope = context.createGain(), now = context.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * .35), now + duration);
    envelope.gain.setValueAtTime(gain, now); envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(envelope); envelope.connect(master); oscillator.start(); oscillator.stop(now + duration);
    active.add(oscillator); oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
  }
  function noise(duration, gain, filterFreq = 3000) {
    if (!context || context.state !== 'running') return;
    const bufferSize = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, context.currentTime + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    src.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    src.start();
  }
  return {
    start,
    volume(value) { if (master) master.gain.value = value; },
    pause() { if (context?.state === 'running') context.suspend().catch(() => {}); },
    update(distance, time, cave) { if (seaGain) seaGain.gain.value = cave ? .01 : .04 + Math.min(1, distance / 140) * (.12 + Math.sin(time * .3) * .025); },
    play(kind) {
      if (kind === 'step') tone(95, .09, .08, 'triangle');
      if (kind === 'hit') tone(180, .15, .18, 'sawtooth');
      if (kind === 'bow') tone(440, .2, .1, 'triangle');
      if (kind === 'build') { tone(160, .15, .12, 'square'); }
      if (kind === 'quest') { tone(660, .4, .12); tone(880, .6, .08); }
      if (kind === 'use') tone(320, .16, .09);
      if (kind === 'jump') { tone(260, .14, .12, 'sine'); tone(420, .12, .08, 'triangle'); }
      if (kind === 'shoot') {
        noise(0.24, 0.55, 3600);
        tone(160, 0.1, 0.45, 'sawtooth');
        tone(65, 0.22, 0.5, 'triangle');
      }
      if (kind === 'boss') {
        tone(90, 0.8, 0.45, 'sawtooth');
        tone(60, 1.2, 0.5, 'square');
        tone(45, 1.6, 0.5, 'triangle');
      }
      if (kind === 'fireball') {
        noise(0.4, 0.45, 1200);
        tone(120, 0.3, 0.3, 'sawtooth');
      }
      if (kind === 'wave') {
        tone(220, 0.35, 0.25, 'sawtooth');
        tone(330, 0.5, 0.2, 'square');
      }
    },
  };
}
