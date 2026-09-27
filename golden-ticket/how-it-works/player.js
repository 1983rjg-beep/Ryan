// Wires the film to the page: fitting it to the screen, the controls, chapters and sharing.
(function () {
  'use strict';
  var F = window.FILM;
  var film = F.film;
  function $(id) { return document.getElementById(id); }
  var box = $('film-box');
  var stage = $('film');
  var bigPlay = $('big-play');
  var endCard = $('end-card');
  var playBtn = $('play-btn');
  var soundBtn = $('sound-btn');
  var scrub = $('scrub');
  var fill = $('scrub-fill');
  var time = $('time');
  var params = new URLSearchParams(location.search);
  var looping = params.has('loop');
  var sound = new window.FilmSound(film, F.musicFrom, film.duration - 1.7);
  var CANONICAL = 'https://colgrainparentcouncil.co.uk/wonderlicious/how-it-works/';
  var POSTER = 4.3;

  // Fit the 480 x 600 film into its box.
  function fit() {
    var s = box.clientWidth / 480;
    stage.style.transform = 'scale(' + s + ')';
    F.confetti.size(s);
    F.confetti.draw(film.current());
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
  else window.addEventListener('resize', fit);

  function clock(t) {
    t = Math.max(0, Math.floor(t));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }
  var total = clock(film.duration);

  // Chapters, as buttons and as ticks on the progress bar.
  var chapterBtns = F.chapters.map(function (c, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = c[1];
    b.addEventListener('click', function () { start(c[0]); });
    li.appendChild(b);
    $('chapters').appendChild(li);
    if (i) {
      var tick = document.createElement('i');
      tick.className = 'scrub-tick';
      tick.style.left = (c[0] / film.duration * 100) + '%';
      scrub.appendChild(tick);
    }
    return b;
  });

  var shown = -1;
  function update(t, chapter) {
    fill.style.width = (t / film.duration * 100) + '%';
    time.textContent = clock(t) + ' / ' + total;
    scrub.setAttribute('aria-valuenow', String(Math.floor(t)));
    scrub.setAttribute('aria-valuetext', clock(t));
    var idx = chapter;
    if (idx == null) F.chapters.forEach(function (c, i) { if (t >= c[0] - 0.01) idx = i; });
    if (idx !== shown) {
      shown = idx;
      chapterBtns.forEach(function (b, i) { b.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
    }
  }
  film.on('tick', function (t) { update(t); });

  function setPlaying(on) {
    playBtn.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  }
  function hideCards() {
    bigPlay.hidden = true;
    endCard.hidden = true;
  }
  film.on('play', function () { setPlaying(true); hideCards(); });
  film.on('pause', function () { setPlaying(false); });
  film.on('end', function () {
    if (looping) {
      film.seek(0);
      film.play();
      return;
    }
    endCard.hidden = false;
  });

  function start(t) {
    sound.prime(); // must happen during the tap, or phones keep the sound locked
    film.seek(t || 0);
    film.play();
  }
  bigPlay.addEventListener('click', function () { start(0); });
  $('again-btn').addEventListener('click', function () { start(0); });
  playBtn.addEventListener('click', function () {
    if (film.playing) film.pause();
    else if (!bigPlay.hidden) start(0);
    else {
      sound.prime();
      film.play();
    }
  });

  function showSound() {
    soundBtn.setAttribute('aria-pressed', sound.enabled ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', sound.enabled ? 'Sound is on' : 'Sound is off');
    $('big-play-note').textContent = sound.enabled ? 'Just over a minute, with sound' : 'Just over a minute (sound is off)';
  }
  soundBtn.addEventListener('click', function () {
    if (!sound.enabled) sound.prime();
    sound.setEnabled(!sound.enabled);
    showSound();
  });
  showSound();

  // Dragging along the progress bar.
  function seekTo(clientX) {
    var r = scrub.getBoundingClientRect();
    hideCards();
    film.seek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * film.duration);
  }
  scrub.addEventListener('pointerdown', function (e) {
    var was = film.playing;
    if (was) film.pause();
    try { scrub.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    seekTo(e.clientX);
    function move(ev) { seekTo(ev.clientX); }
    function up() {
      scrub.removeEventListener('pointermove', move);
      scrub.removeEventListener('pointerup', up);
      scrub.removeEventListener('pointercancel', up);
      if (was) {
        sound.prime();
        film.play();
      }
    }
    scrub.addEventListener('pointermove', move);
    scrub.addEventListener('pointerup', up);
    scrub.addEventListener('pointercancel', up);
  });
  scrub.addEventListener('keydown', function (e) {
    var step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, Home: -999, End: 999 }[e.key];
    if (!step) return;
    e.preventDefault();
    hideCards();
    film.seek(film.current() + step);
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('button, a, input, [role="slider"]')) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      playBtn.click();
    }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && film.playing) film.pause(); });

  // Sharing
  var here = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : CANONICAL;
  $('share-btn').addEventListener('click', function () {
    var status = $('share-status');
    if (navigator.share) {
      navigator.share({ title: 'Wonderlicious: how it works', text: 'How the Wonderlicious golden ticket event works', url: here }).catch(function () { /* cancelled */ });
      return;
    }
    var done = function () { status.textContent = 'Link copied. Paste it wherever you like.'; };
    var fail = function () { status.textContent = 'Copy this link: ' + here; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(here).then(done, fail);
    else fail();
  });

  // Recording the video (see README): ?export shows just the film and lets a script step through it.
  if (params.has('export')) {
    document.body.classList.add('is-export');
    window.EXPORT = {
      duration: film.duration,
      seek: function (t) { film.seek(t); },
      wav: function (v) { return sound.renderWav(v); }
    };
  }

  fit();
  // Before playing, show the title card as a poster.
  film.seek(POSTER);
  update(0, -1);
  if (looping) start(0);
})();
