// The film engine. Every moving part is a single Web Animation that spans the whole film,
// so the film can pause, jump to any chapter, or be recorded frame by frame for the video.
(function () {
  'use strict';

  var EASE = {
    inout: 'cubic-bezier(.45,0,.25,1)',
    out: 'cubic-bezier(.15,.7,.35,1)',
    in: 'cubic-bezier(.55,0,.9,.45)',
    pop: 'cubic-bezier(.34,1.56,.64,1)',
    soft: 'ease-in-out',
    linear: 'linear',
    step: 'steps(1, end)'
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function now() {
    var t = document.timeline && document.timeline.currentTime;
    return t == null ? performance.now() : t;
  }

  // A small seeded random generator, so confetti and sparkles land the same way every time.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function Film(seconds) {
    this.duration = seconds;
    this.animations = [];
    this.sounds = [];
    this.drawers = [];
    this.spans = [];
    this.time = 0;
    this.playing = false;
    this.startedAt = 0;
    this.raf = 0;
    this.handlers = {};
  }

  // keys: [[seconds, value, easing into this key], ...]. Values hold before the first key and after the last.
  Film.prototype.track = function (el, prop, keys) {
    var D = this.duration;
    var list = keys.slice().sort(function (a, b) { return a[0] - b[0]; });
    var frames = list.map(function (k) {
      var f = { offset: clamp(k[0] / D, 0, 1) };
      f[prop] = k[1];
      return f;
    });
    for (var i = 1; i < list.length; i++) frames[i - 1].easing = EASE[list[i][2]] || list[i][2] || EASE.inout;
    if (frames[0].offset > 0) {
      var first = { offset: 0, easing: 'linear' };
      first[prop] = list[0][1];
      frames.unshift(first);
    }
    if (frames[frames.length - 1].offset < 1) {
      var last = { offset: 1 };
      last[prop] = list[list.length - 1][1];
      frames.push(last);
    }
    var a = el.animate(frames, { duration: D * 1000, fill: 'both' });
    a.pause();
    a.currentTime = this.time * 1000;
    this.animations.push(a);
    return a;
  };

  // Shows an element between two times, fading in and out.
  Film.prototype.show = function (el, t0, t1, fade) {
    var f = fade == null ? 0.35 : fade;
    var keys = [[t0 - f, 0], [t0, 1, 'linear']];
    if (t1 != null) keys.push([t1, 1, 'linear'], [t1 + f, 0, 'linear']);
    return this.track(el, 'opacity', keys);
  };

  // A sound effect by name, played by sound.js at this time.
  Film.prototype.sfx = function (t, name, arg) { this.sounds.push({ t: t, name: name, arg: arg }); };
  // Something drawn by script on every frame (counters, typing, confetti).
  Film.prototype.draw = function (fn) { this.drawers.push(fn); };
  // Only lay out a scene while it's on screen.
  Film.prototype.span = function (el, t0, t1) { this.spans.push({ el: el, t0: t0, t1: t1 }); };

  Film.prototype.on = function (name, fn) { (this.handlers[name] = this.handlers[name] || []).push(fn); };
  Film.prototype.emit = function (name, arg) { (this.handlers[name] || []).forEach(function (fn) { fn(arg); }); };

  Film.prototype.render = function (t) {
    this.spans.forEach(function (s) {
      var on = t >= s.t0 && t < s.t1;
      if (s.on !== on) { s.on = on; s.el.style.display = on ? '' : 'none'; }
    });
    this.drawers.forEach(function (fn) { fn(t); });
    this.emit('tick', t);
  };

  Film.prototype.current = function () {
    return this.playing ? clamp((now() - this.startedAt) / 1000, 0, this.duration) : this.time;
  };

  Film.prototype.play = function () {
    if (this.playing) return;
    if (this.time >= this.duration - 0.05) this.seek(0);
    this.startedAt = now() - this.time * 1000;
    var st = this.startedAt;
    this.animations.forEach(function (a) { a.startTime = st; });
    this.playing = true;
    this.emit('play', this.time);
    this.loop();
  };

  Film.prototype.loop = function () {
    var self = this;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(function step() {
      if (!self.playing) return;
      var t = self.current();
      if (t >= self.duration) {
        self.pause(self.duration);
        self.emit('end');
        return;
      }
      self.render(t);
      self.raf = requestAnimationFrame(step);
    });
  };

  Film.prototype.pause = function (at) {
    var t = at == null ? this.current() : at;
    var was = this.playing;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.time = clamp(t, 0, this.duration);
    var ms = this.time * 1000;
    this.animations.forEach(function (a) { a.pause(); a.currentTime = ms; });
    this.render(this.time);
    if (was) this.emit('pause', this.time);
  };

  Film.prototype.seek = function (t) {
    var was = this.playing;
    if (was) { this.playing = false; cancelAnimationFrame(this.raf); }
    this.time = clamp(t, 0, this.duration);
    var ms = this.time * 1000;
    this.animations.forEach(function (a) { a.pause(); a.currentTime = ms; });
    this.render(this.time);
    this.emit('seek', this.time);
    if (was) this.play();
  };

  // ---------------------------------------------------------------------------------------
  // Confetti: each burst is worked out from the film time, so it can be rewound too
  // ---------------------------------------------------------------------------------------
  var PARTY = ['#f6d36b', '#eab84e', '#fff1c1', '#b15cf0', '#f15bb5', '#29b6f6', '#8bd346', '#ff7b54'];
  var GOLD = ['#f6d36b', '#eab84e', '#fff1c1', '#ffd98a'];

  function Confetti(canvas, width, height) {
    this.canvas = canvas;
    this.ctx = canvas.getContext ? canvas.getContext('2d') : null;
    this.W = width;
    this.H = height;
    this.bursts = [];
    this.scale = 1;
  }

  // A burst from (x, y) in scene units, aimed at `angle` (radians) with `spread`.
  Confetti.prototype.burst = function (t, x, y, angle, spread, speed, count, gold, small, seed) {
    var r = rng(seed || Math.round(t * 1000 + x));
    var pieces = [];
    for (var i = 0; i < count; i++) {
      var a = angle + (r() - 0.5) * spread;
      var v = speed * (0.45 + r() * 0.75);
      var colors = gold ? GOLD : PARTY;
      pieces.push({
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: small ? 2.5 + r() * 3 : 6 + r() * 5, h: small ? 2.5 + r() * 3 : 8 + r() * 7,
        rot: r() * 6.283, spin: (r() - 0.5) * 10, flip: r() * 6.283, flipSpeed: 5 + r() * 7,
        sway: r() * 6.283, color: colors[(r() * colors.length) | 0], round: r() < 0.22,
        life: small ? 1.6 + r() * 0.8 : 3.2 + r() * 1.4
      });
    }
    this.bursts.push({ t: t, x: x, y: y, pieces: pieces });
  };

  // Gentle rain from the top edge between two times.
  Confetti.prototype.rain = function (t0, t1, perSecond, seed) {
    var r = rng(seed || 7);
    for (var t = t0; t < t1; t += 1 / perSecond) {
      this.burst(t, r() * this.W, -14, Math.PI / 2, 0.5, 70, 1, false, false, (r() * 1e9) | 0);
    }
  };

  Confetti.prototype.size = function (scale) {
    if (!this.ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.scale = scale * dpr;
    this.canvas.width = Math.round(this.W * this.scale);
    this.canvas.height = Math.round(this.H * this.scale);
  };

  Confetti.prototype.draw = function (t) {
    var ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    var DRAG = 2.3, DRAG_Y = 2.0, G = 620;
    for (var b = 0; b < this.bursts.length; b++) {
      var burst = this.bursts[b];
      var age = t - burst.t;
      if (age < 0 || age > 4.8) continue;
      for (var i = 0; i < burst.pieces.length; i++) {
        var p = burst.pieces[i];
        if (age > p.life) continue;
        var ex = (1 - Math.exp(-DRAG * age)) / DRAG;
        var term = G / DRAG_Y;
        var ey = (1 - Math.exp(-DRAG_Y * age)) / DRAG_Y;
        var x = burst.x + p.vx * ex + Math.sin(p.sway + age * 3) * 9;
        var y = burst.y + term * age + (p.vy - term) * ey;
        if (y > this.H + 20) continue;
        ctx.globalAlpha = clamp((p.life - age) / 0.6, 0, 1);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + p.spin * age);
        ctx.scale(1, Math.cos(p.flip + p.flipSpeed * age));
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, 6.283);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  };

  window.FilmKit = { Film: Film, Confetti: Confetti, rng: rng, clamp: clamp, EASE: EASE };
})();
