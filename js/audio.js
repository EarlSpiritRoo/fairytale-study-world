/* ============================================================
   audio.js — all sound is synthesised with WebAudio, so there
   are no audio files to host.

   FN.Audio.unlock()        call from a click (browsers require it)
   FN.Audio.sfx(name)       'click' 'pop' 'sparkle' 'portal' 'start' 'chime'
   FN.Audio.setMusic(bool)  soft generative ambient loop (off by default)
   ============================================================ */
(function (FN) {
  'use strict';
  let ac = null, master = null, musicGain = null, delay = null, musicTimer = null, nextNote = 0, step = 0;
  const lastPlayed = {};
  const A = FN.Audio = { musicOn: false };

  A.unlock = () => {
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
        // a dreamy echo shared by the music
        delay = ac.createDelay(1); delay.delayTime.value = 0.42;
        const fb = ac.createGain(); fb.gain.value = 0.38; delay.connect(fb); fb.connect(delay);
        musicGain = ac.createGain(); musicGain.gain.value = 0; musicGain.connect(master); delay.connect(musicGain);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
  };

  // one soft note: frequency glide f0 -> f1, quick attack, exponential fade
  function tone(dest, type, f0, f1, t0, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  const SFX = {
    click: (t) => tone(master, 'sine', 740, 1100, t, 0.09, 0.07),
    pop: (t) => { tone(master, 'triangle', 520, 880, t, 0.1, 0.07); tone(master, 'sine', 1320, 1320, t + 0.05, 0.12, 0.04); },
    sparkle: (t) => [1568, 2093, 2637].forEach((f, i) => tone(master, 'sine', f, f, t + i * 0.05, 0.25, 0.035)),
    portal: (t) => { tone(master, 'sine', 260, 1040, t, 0.5, 0.06); tone(master, 'triangle', 390, 1560, t + 0.06, 0.5, 0.03); },
    start: (t) => [523.25, 659.25, 783.99].forEach((f, i) => tone(master, 'sine', f, f, t + i * 0.1, 0.5, 0.08)),
    chime: (t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(master, 'sine', f, f, t + i * 0.24, 1.6, 0.14); tone(master, 'sine', f * 2, f * 2, t + i * 0.24, 0.8, 0.03); }),
  };
  A.sfx = (name) => {
    if (!ac || !SFX[name]) return;
    const now = performance.now(), gap = name === 'sparkle' ? 260 : 60;      // don't machine-gun
    if (now - (lastPlayed[name] || 0) < gap) return;
    lastPlayed[name] = now;
    try { if (ac.state === 'suspended') ac.resume(); SFX[name](ac.currentTime + 0.01); } catch (e) { /* silent */ }
  };

  // ---------- ambient music: a slow pentatonic music-box over a soft pad ----------
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];   // C major pentatonic
  const CHORDS = [[130.81, 196.0], [110.0, 164.81], [87.31, 130.81], [98.0, 146.83]];             // C · Am · F · G
  let noteIdx = 4;
  function schedule() {
    if (!ac) return;
    while (nextNote < ac.currentTime + 1.6) {            // look well ahead so background tabs don't stutter
      if (step % 8 === 0) CHORDS[(step / 8) % 4 | 0].forEach((f) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, nextNote); g.gain.linearRampToValueAtTime(0.12, nextNote + 1.6); g.gain.linearRampToValueAtTime(0.0001, nextNote + 4.6);
        o.connect(g); g.connect(musicGain); o.start(nextNote); o.stop(nextNote + 4.7);
      });
      if (Math.random() < 0.72) {                        // wandering melody, leaves gaps
        noteIdx = FN.clamp(noteIdx + ((Math.random() * 5) | 0) - 2, 0, SCALE.length - 1);
        const g = ac.createGain(); g.gain.value = 1; g.connect(musicGain); g.connect(delay);
        tone(g, 'triangle', SCALE[noteIdx], SCALE[noteIdx], nextNote, 1.5, 0.11);
        tone(g, 'sine', SCALE[noteIdx] * 2, SCALE[noteIdx] * 2, nextNote, 0.6, 0.03);
      }
      nextNote += 0.56; step++;
    }
  }
  A.setMusic = (on) => {
    A.musicOn = !!on;
    try { localStorage.setItem('fablenook.music', on ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!ac) return;
    clearInterval(musicTimer); musicTimer = null;
    musicGain.gain.cancelScheduledValues(ac.currentTime);
    musicGain.gain.linearRampToValueAtTime(on ? 0.55 : 0, ac.currentTime + (on ? 1.5 : 0.4));
    if (on) { nextNote = ac.currentTime + 0.1; schedule(); musicTimer = setInterval(schedule, 400); }
  };
  A.wantsMusic = () => { try { return localStorage.getItem('fablenook.music') === '1'; } catch (e) { return false; } };
})(window.FN);
