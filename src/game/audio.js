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
    },
  };
}
