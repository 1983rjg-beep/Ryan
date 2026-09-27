// Sound for the film: a bouncy music-box tune and cartoon sound effects, all synthesised,
// so there are no audio files to host. The same score is rendered offline for the video.
(function () {
  'use strict';
  var rng = window.FilmKit.rng;

  // ---------------------------------------------------------------------------------------
  // Instruments (work with a live AudioContext or an OfflineAudioContext)
  // ---------------------------------------------------------------------------------------
  function Synth(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.rand = rng(99);
    var r = rng(12345);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = this.noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  }

  Synth.prototype.envelope = function (gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  Synth.prototype.hiss = function (t, dur, type, freq, q, peak, attack) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    var gain = ctx.createGain();
    this.envelope(gain, t, peak, attack || 0.002, dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.out);
    src.start(t, this.rand() * 1.5);
    src.stop(t + (attack || 0.002) + dur + 0.05);
    return filter;
  };

  Synth.prototype.tone = function (t, freq, dur, type, peak, attack) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    var gain = ctx.createGain();
    this.envelope(gain, t, peak, attack || 0.004, dur);
    osc.connect(gain);
    gain.connect(this.out);
    osc.start(t);
    osc.stop(t + (attack || 0.004) + dur + 0.05);
    return osc;
  };

  Synth.prototype.bell = function (t, freq, peak) {
    this.tone(t, freq, 1.1, 'sine', peak);
    this.tone(t, freq * 2.76, 0.45, 'sine', peak * 0.3);
    this.tone(t, freq * 5.4, 0.2, 'sine', peak * 0.12);
  };

  Synth.prototype.brass = function (t, freq, dur, peak) {
    var ctx = this.ctx;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.exponentialRampToValueAtTime(3400, t + 0.06);
    filter.frequency.exponentialRampToValueAtTime(1500, t + dur);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.03);
    gain.gain.setValueAtTime(peak * 0.8, t + dur);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    [-7, 7].forEach(function (cents) {
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.35);
    });
    filter.connect(gain);
    gain.connect(this.out);
  };

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // ---------------------------------------------------------------------------------------
  // Sound effects, by name. film.sfx(time, name, arg) puts them on the timeline.
  // ---------------------------------------------------------------------------------------
  var SFX = {
    whoosh: function (s, t) {
      var f = s.hiss(t, 0.55, 'bandpass', 400, 1.2, 0.16, 0.22);
      f.frequency.exponentialRampToValueAtTime(3200, t + 0.6);
    },
    pop: function (s, t, pitch) {
      var osc = s.tone(t, pitch || 520, 0.12, 'sine', 0.32, 0.003);
      osc.frequency.exponentialRampToValueAtTime((pitch || 520) * 2.2, t + 0.08);
    },
    boing: function (s, t) {
      var osc = s.tone(t, 180, 0.32, 'triangle', 0.22, 0.004);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.16);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    },
    coin: function (s, t) {
      s.tone(t, 1567.98, 0.09, 'square', 0.06, 0.002);
      s.tone(t + 0.08, 2093, 0.4, 'square', 0.06, 0.002);
    },
    kaching: function (s, t) {
      s.hiss(t, 0.06, 'highpass', 3000, 0.7, 0.2);
      [2637, 3136, 3951].forEach(function (f, i) { s.bell(t + 0.05 + i * 0.05, f, 0.07); });
    },
    sparkle: function (s, t, n) {
      var notes = [1318.5, 1568, 1760, 1975.5, 2349.3, 2637];
      for (var i = 0; i < (n || 6); i++) s.bell(t + i * 0.07, notes[i % notes.length], 0.05);
    },
    chime: function (s, t) {
      [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { s.bell(t + i * 0.08, f, 0.08); });
    },
    twinkle: function (s, t, freq) { s.bell(t, freq || 1760, 0.045); },
    rip: function (s, t) {
      var ctx = s.ctx;
      var src = ctx.createBufferSource();
      src.buffer = s.noise;
      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.exponentialRampToValueAtTime(4300, t + 0.34);
      var chop = ctx.createGain();
      chop.gain.value = 0.5;
      var lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 36;
      var depth = ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth);
      depth.connect(chop.gain);
      var gain = ctx.createGain();
      s.envelope(gain, t, 0.5, 0.02, 0.38);
      src.connect(filter);
      filter.connect(chop);
      chop.connect(gain);
      gain.connect(s.out);
      src.start(t, s.rand());
      src.stop(t + 0.5);
      lfo.start(t);
      lfo.stop(t + 0.5);
    },
    thud: function (s, t) {
      var osc = s.tone(t, 150, 0.28, 'sine', 0.6, 0.003);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.22);
      s.hiss(t, 0.07, 'lowpass', 900, 0.7, 0.16);
    },
    tap: function (s, t) { s.hiss(t, 0.03, 'bandpass', 2400, 1.5, 0.12); },
    beep: function (s, t) {
      s.tone(t, 1760, 0.09, 'square', 0.05, 0.003);
      s.tone(t + 0.12, 2349.3, 0.16, 'square', 0.05, 0.003);
    },
    drumroll: function (s, t, dur) {
      for (var d = 0; d < dur; d += 0.045) s.hiss(t + d, 0.06, 'bandpass', 2300 + s.rand() * 1300, 0.9, 0.035 + 0.12 * (d / dur));
    },
    crash: function (s, t) {
      s.hiss(t, 1.6, 'highpass', 5200, 0.5, 0.2, 0.004);
      s.hiss(t, 0.45, 'bandpass', 2500, 0.6, 0.12, 0.003);
    },
    fanfare: function (s, t) {
      var G4 = 392, C4 = 261.63, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
      s.brass(t, G4, 0.1, 0.1);
      s.brass(t + 0.12, C5, 0.1, 0.1);
      s.brass(t + 0.24, E5, 0.1, 0.1);
      [C4, G4, C5, E5, G5, C6].forEach(function (f, i) { s.brass(t + 0.36, f, 1.0, i === 5 ? 0.05 : 0.08); });
    },
    cheer: function (s, t) {
      [72, 76, 79, 84].forEach(function (m, i) { s.tone(t + i * 0.06, hz(m), 0.25, 'triangle', 0.08, 0.004); });
    },
    // Music notes (see score below).
    melody: function (s, t, m) {
      s.tone(t, hz(m), 0.42, 'sine', 0.07, 0.004);
      s.tone(t, hz(m) * 4, 0.07, 'sine', 0.012, 0.002);
    },
    pluck: function (s, t, chord) {
      chord.forEach(function (m) { s.tone(t, hz(m), 0.13, 'triangle', 0.022, 0.003); });
    },
    bass: function (s, t, m) { s.tone(t, hz(m), 0.3, 'triangle', 0.13, 0.006); },
    kick: function (s, t) {
      var osc = s.tone(t, 110, 0.16, 'sine', 0.22, 0.002);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    },
    shaker: function (s, t, accent) { s.hiss(t, 0.035, 'highpass', 7000, 0.7, accent ? 0.02 : 0.011); },
    ending: function (s, t) {
      [48, 55, 60, 64, 67, 72].forEach(function (m) { s.brass(t, hz(m), 1.4, 0.05); });
      [84, 88, 91, 96].forEach(function (m, i) { s.bell(t + 0.1 + i * 0.09, hz(m), 0.06); });
    }
  };

  // ---------------------------------------------------------------------------------------
  // The score: 120 beats a minute in C major, C - Am - F - G, from `start` to `end` seconds
  // ---------------------------------------------------------------------------------------
  var A = [
    [76, 79, 84, 79, 76, 0, 74, 76], [72, 76, 81, 76, 72, 0, 71, 72],
    [69, 72, 77, 72, 69, 0, 67, 69], [71, 74, 79, 74, 83, 0, 81, 79],
    [76, 79, 84, 79, 76, 0, 74, 76], [72, 76, 81, 76, 84, 0, 83, 81],
    [77, 76, 74, 72, 74, 0, 76, 77], [79, 0, 74, 0, 79, 81, 83, 0]
  ];
  var B = [
    [84, 0, 0, 83, 84, 0, 79, 0], [81, 0, 0, 79, 81, 0, 76, 0],
    [77, 0, 79, 0, 81, 0, 84, 0], [83, 0, 0, 0, 79, 0, 0, 0],
    [84, 0, 0, 83, 84, 0, 88, 0], [86, 0, 84, 0, 81, 0, 79, 0],
    [81, 0, 79, 0, 77, 0, 76, 0], [74, 0, 76, 0, 77, 0, 79, 0]
  ];
  var CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  var ROOTS = [36, 33, 29, 31];

  function score(start, end) {
    var events = [];
    var bar = 2;
    var bars = Math.floor((end - start) / bar);
    for (var b = 0; b < bars; b++) {
      var t = start + b * bar;
      var phrase = (Math.floor(b / 8) % 2 ? B : A)[b % 8];
      var c = b % 4;
      phrase.forEach(function (m, i) { if (m) events.push({ t: t + i * 0.25, name: 'melody', arg: m }); });
      [0, 1, 2, 3].forEach(function (beat) {
        var root = ROOTS[c];
        events.push({ t: t + beat * 0.5, name: 'bass', arg: beat === 1 ? root + 7 : beat === 3 ? root + 12 : root });
        events.push({ t: t + beat * 0.5 + 0.25, name: 'pluck', arg: CHORDS[c] });
        if (beat % 2 === 0) events.push({ t: t + beat * 0.5, name: 'kick' });
      });
      for (var i = 0; i < 16; i++) events.push({ t: t + i * 0.125, name: 'shaker', arg: i % 4 === 2 });
    }
    events.push({ t: start + bars * bar, name: 'ending' });
    return events;
  }

  // ---------------------------------------------------------------------------------------
  // Playing along with the film
  // ---------------------------------------------------------------------------------------
  var KEY = 'gt.sound';
  var VOLUME = 2;
  function readPref() {
    try { var v = window.localStorage.getItem(KEY); return v == null ? true : JSON.parse(v) !== false; } catch (e) { return true; }
  }
  function writePref(on) {
    try { window.localStorage.setItem(KEY, JSON.stringify(on)); } catch (e) { /* ignore */ }
  }

  function Sound(film, musicStart, musicEnd) {
    var self = this;
    this.film = film;
    this.enabled = readPref();
    this.events = film.sounds.concat(score(musicStart, musicEnd)).sort(function (a, b) { return a.t - b.t; });
    this.ctx = null;
    this.bus = null;
    this.synth = null;
    this.next = 0;
    this.from = 0;
    film.on('play', function (t) { self.start(t); });
    film.on('pause', function () { self.stop(0.25); });
    film.on('seek', function () { self.stop(0.03); });
    film.on('tick', function (t) { self.schedule(t); });
  }

  Sound.prototype.prime = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      if (!this.ctx) {
        this.ctx = new AC();
        var squash = this.ctx.createDynamicsCompressor();
        squash.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.gain.value = VOLUME;
        this.master.connect(squash);
      }
      if (this.ctx.state !== 'running' && this.ctx.resume) this.ctx.resume();
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  };

  Sound.prototype.start = function (t) {
    this.stop(0.03);
    if (!this.enabled || !this.prime()) return;
    this.bus = this.ctx.createGain();
    this.bus.connect(this.master);
    this.synth = new Synth(this.ctx, this.bus);
    this.from = t;
    this.next = 0;
    while (this.next < this.events.length && this.events[this.next].t < t) this.next++;
  };

  Sound.prototype.stop = function (fade) {
    if (!this.bus) return;
    var old = this.bus;
    this.bus = null;
    this.synth = null;
    try { old.gain.setTargetAtTime(0, this.ctx.currentTime, fade || 0.03); } catch (e) { /* ignore */ }
    setTimeout(function () { try { old.disconnect(); } catch (e) { /* ignore */ } }, 1500);
  };

  // Queue up anything due in the next third of a second.
  Sound.prototype.schedule = function (t) {
    if (!this.synth || !this.film.playing) return;
    var base = this.ctx.currentTime;
    while (this.next < this.events.length && this.events[this.next].t < t + 0.3) {
      var ev = this.events[this.next++];
      var when = base + (ev.t - t) + 0.02;
      if (when < base - 0.05) continue;
      try { SFX[ev.name](this.synth, Math.max(when, base), ev.arg); } catch (e) { /* ignore */ }
    }
  };

  Sound.prototype.setEnabled = function (on) {
    this.enabled = on;
    writePref(on);
    if (!on) this.stop(0.05);
    else if (this.film.playing) this.start(this.film.current());
  };

  // Renders the whole soundtrack to a mono WAV (base64), for making the video.
  Sound.prototype.renderWav = function (volume) {
    var rate = 44100;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var ctx = new OAC(1, Math.ceil(rate * this.film.duration), rate);
    var squash = ctx.createDynamicsCompressor();
    squash.connect(ctx.destination);
    var master = ctx.createGain();
    master.gain.value = volume || VOLUME;
    master.connect(squash);
    var synth = new Synth(ctx, master);
    this.events.forEach(function (ev) { SFX[ev.name](synth, ev.t + 0.001, ev.arg); });
    return ctx.startRendering().then(function (buffer) {
      var data = buffer.getChannelData(0);
      var bytes = new Uint8Array(44 + data.length * 2);
      var view = new DataView(bytes.buffer);
      function text(o, s) { for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); }
      text(0, 'RIFF'); view.setUint32(4, 36 + data.length * 2, true); text(8, 'WAVE');
      text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, data.length * 2, true);
      for (var i = 0; i < data.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
      var out = '';
      for (var j = 0; j < bytes.length; j += 32768) out += String.fromCharCode.apply(null, bytes.subarray(j, j + 32768));
      return btoa(out);
    });
  };

  window.FilmSound = Sound;
})();
