// The story, scene by scene. Times are in seconds from the start of the film.
(function () {
  'use strict';
  var Kit = window.FilmKit;
  var film = new Kit.Film(76);
  var root = document.getElementById('film');
  var band = document.getElementById('cap-band');
  var fx = new Kit.Confetti(document.getElementById('fx'), 480, 600);

  // ---------------------------------------------------------------------------------------
  // Building blocks
  // ---------------------------------------------------------------------------------------
  function div(parent, cls, html, css) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (html) d.innerHTML = html;
    if (css) d.style.cssText = css;
    parent.appendChild(d);
    return d;
  }
  function px(x, y) { return x + 'px ' + y + 'px'; }

  // Keys for one element and property are collected here, then made into one animation each.
  var tracks = [];
  function key(el, prop, t, value, ease) {
    var slot = el.__keys || (el.__keys = {});
    if (!slot[prop]) {
      slot[prop] = [];
      tracks.push([el, prop, slot[prop]]);
    }
    slot[prop].push([t, value, ease]);
  }
  function keys(el, prop, list) { list.forEach(function (k) { key(el, prop, k[0], k[1], k[2]); }); }
  // Tween from whatever the element was doing at t0 to `value` at t1.
  function to(el, prop, t0, t1, value, ease) {
    var list = (el.__keys && el.__keys[prop]) || [];
    var before = null;
    list.forEach(function (k) { if (k[0] <= t0 && (!before || k[0] >= before[0])) before = k; });
    if (before) key(el, prop, t0, before[1]);
    key(el, prop, t1, value, ease);
  }
  function fade(el, t0, t1, f) {
    f = f == null ? 0.3 : f;
    keys(el, 'opacity', [[t0 - f, 0], [t0, 1, 'linear']]);
    if (t1 != null) keys(el, 'opacity', [[t1, 1], [t1 + f, 0, 'linear']]);
  }
  function pop(el, t, size, dur) {
    dur = dur || 0.45;
    keys(el, 'scale', [[t, 0], [t + dur * 0.62, size || 1.12, 'out'], [t + dur, 1, 'soft']]);
    keys(el, 'opacity', [[t, 0], [t + 0.08, 1, 'linear']]);
  }
  function unpop(el, t, dur) {
    dur = dur || 0.3;
    keys(el, 'scale', [[t, 1], [t + dur, 0, 'in']]);
    keys(el, 'opacity', [[t + dur - 0.08, 1], [t + dur, 0, 'linear']]);
  }
  function scene(t0, t1) {
    var s = div(root, 'sc');
    film.span(s, t0, t1);
    return s;
  }
  // Captions take turns: each fades in only once the one before has gone.
  var capEnd = -1;
  function cap(t0, t1, html) {
    var c = div(band, 'cap', '<span>' + html + '</span>');
    var s = Math.max(t0 - 0.25, capEnd + 0.2);
    capEnd = t1;
    keys(c, 'opacity', [[s, 0], [s + 0.25, 1, 'linear'], [t1, 1], [t1 + 0.2, 0, 'linear']]);
    keys(c, 'translate', [[s, '0px 12px'], [s + 0.25, '0px 0px', 'out']]);
    return c;
  }
  function sparks(parent, t0, t1, spots, seed) {
    var r = Kit.rng(seed);
    spots.forEach(function (p, i) {
      var s = div(parent, 'spark', '', 'left:' + p[0] + 'px;top:' + p[1] + 'px;' + (p[2] ? 'width:' + p[2] + 'px;height:' + p[2] + 'px;margin:-' + p[2] / 2 + 'px 0 0 -' + p[2] / 2 + 'px' : ''));
      for (var t = t0 + r() * 0.8; t < t1 - 0.8; t += 1.2 + r() * 0.9) {
        keys(s, 'opacity', [[t, 0], [t + 0.4, 1, 'soft'], [t + 0.8, 0, 'soft']]);
        keys(s, 'scale', [[t, 0.2], [t + 0.4, 1, 'soft'], [t + 0.8, 0.2, 'soft']]);
        keys(s, 'rotate', [[t, '0deg'], [t + 0.8, '90deg', 'linear']]);
      }
    });
  }

  // A real QR code for the prize page (https://colgrainparentcouncil.co.uk/wonderlicious/),
  // made once with vendor/qrcode.js so this page needs no QR library.
  var QR_SIZE = 33;
  var QR_PATH = 'M0 0h7v1h-7zM9 0h4v1h-4zM14 0h1v1h-1zM16 0h1v1h-1zM21 0h2v1h-2zM26 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h3v1h-3zM13 1h2v1h-2zM17 1h1v1h-1zM21 1h1v1h-1zM24 1h1v1h-1zM26 1h1v1h-1zM32 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h2v1h-2zM11 2h1v1h-1zM13 2h1v1h-1zM15 2h10v1h-10zM26 2h1v1h-1zM28 2h3v1h-3zM32 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h2v1h-2zM15 3h1v1h-1zM19 3h1v1h-1zM21 3h1v1h-1zM24 3h1v1h-1zM26 3h1v1h-1zM28 3h3v1h-3zM32 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h2v1h-2zM13 4h1v1h-1zM15 4h1v1h-1zM18 4h1v1h-1zM21 4h1v1h-1zM23 4h1v1h-1zM26 4h1v1h-1zM28 4h3v1h-3zM32 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM13 5h2v1h-2zM16 5h1v1h-1zM20 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h7v1h-7zM8 7h1v1h-1zM10 7h2v1h-2zM18 7h1v1h-1zM22 7h1v1h-1zM24 7h1v1h-1zM0 8h1v1h-1zM6 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h4v1h-4zM17 8h1v1h-1zM22 8h2v1h-2zM25 8h2v1h-2zM29 8h3v1h-3zM0 9h1v1h-1zM2 9h1v1h-1zM4 9h2v1h-2zM11 9h1v1h-1zM14 9h2v1h-2zM18 9h2v1h-2zM21 9h3v1h-3zM28 9h4v1h-4zM2 10h1v1h-1zM6 10h1v1h-1zM10 10h1v1h-1zM15 10h2v1h-2zM18 10h1v1h-1zM20 10h2v1h-2zM25 10h2v1h-2zM28 10h1v1h-1zM30 10h2v1h-2zM1 11h1v1h-1zM4 11h2v1h-2zM7 11h1v1h-1zM12 11h1v1h-1zM14 11h1v1h-1zM20 11h1v1h-1zM22 11h2v1h-2zM26 11h5v1h-5zM32 11h1v1h-1zM0 12h1v1h-1zM2 12h1v1h-1zM4 12h1v1h-1zM6 12h2v1h-2zM12 12h3v1h-3zM16 12h5v1h-5zM23 12h2v1h-2zM26 12h2v1h-2zM2 13h1v1h-1zM5 13h1v1h-1zM10 13h1v1h-1zM13 13h2v1h-2zM16 13h1v1h-1zM20 13h2v1h-2zM23 13h1v1h-1zM26 13h2v1h-2zM29 13h4v1h-4zM0 14h3v1h-3zM4 14h1v1h-1zM6 14h2v1h-2zM10 14h1v1h-1zM13 14h2v1h-2zM17 14h3v1h-3zM21 14h1v1h-1zM24 14h3v1h-3zM28 14h4v1h-4zM0 15h1v1h-1zM2 15h2v1h-2zM5 15h1v1h-1zM7 15h2v1h-2zM11 15h1v1h-1zM13 15h1v1h-1zM15 15h1v1h-1zM19 15h1v1h-1zM25 15h1v1h-1zM27 15h1v1h-1zM29 15h2v1h-2zM32 15h1v1h-1zM0 16h3v1h-3zM4 16h1v1h-1zM6 16h3v1h-3zM11 16h1v1h-1zM14 16h1v1h-1zM17 16h1v1h-1zM19 16h1v1h-1zM22 16h4v1h-4zM27 16h2v1h-2zM32 16h1v1h-1zM0 17h1v1h-1zM5 17h1v1h-1zM9 17h2v1h-2zM15 17h7v1h-7zM23 17h1v1h-1zM26 17h1v1h-1zM29 17h2v1h-2zM32 17h1v1h-1zM0 18h1v1h-1zM2 18h1v1h-1zM6 18h1v1h-1zM9 18h7v1h-7zM19 18h2v1h-2zM23 18h2v1h-2zM26 18h2v1h-2zM29 18h4v1h-4zM0 19h2v1h-2zM3 19h3v1h-3zM9 19h4v1h-4zM15 19h1v1h-1zM17 19h3v1h-3zM22 19h1v1h-1zM28 19h5v1h-5zM0 20h1v1h-1zM4 20h3v1h-3zM10 20h1v1h-1zM14 20h3v1h-3zM22 20h4v1h-4zM27 20h3v1h-3zM31 20h2v1h-2zM0 21h1v1h-1zM2 21h2v1h-2zM9 21h1v1h-1zM11 21h1v1h-1zM13 21h1v1h-1zM16 21h3v1h-3zM20 21h2v1h-2zM23 21h1v1h-1zM27 21h2v1h-2zM0 22h1v1h-1zM3 22h2v1h-2zM6 22h3v1h-3zM12 22h6v1h-6zM20 22h1v1h-1zM22 22h1v1h-1zM24 22h1v1h-1zM28 22h2v1h-2zM31 22h1v1h-1zM0 23h1v1h-1zM2 23h1v1h-1zM4 23h1v1h-1zM8 23h2v1h-2zM12 23h1v1h-1zM19 23h2v1h-2zM23 23h5v1h-5zM30 23h1v1h-1zM32 23h1v1h-1zM0 24h2v1h-2zM3 24h2v1h-2zM6 24h1v1h-1zM10 24h1v1h-1zM13 24h4v1h-4zM23 24h7v1h-7zM31 24h2v1h-2zM8 25h6v1h-6zM15 25h2v1h-2zM19 25h2v1h-2zM22 25h1v1h-1zM24 25h1v1h-1zM28 25h1v1h-1zM30 25h1v1h-1zM32 25h1v1h-1zM0 26h7v1h-7zM9 26h1v1h-1zM12 26h1v1h-1zM15 26h1v1h-1zM18 26h1v1h-1zM20 26h5v1h-5zM26 26h1v1h-1zM28 26h1v1h-1zM30 26h2v1h-2zM0 27h1v1h-1zM6 27h1v1h-1zM10 27h1v1h-1zM15 27h1v1h-1zM20 27h1v1h-1zM23 27h2v1h-2zM28 27h4v1h-4zM0 28h1v1h-1zM2 28h3v1h-3zM6 28h1v1h-1zM9 28h1v1h-1zM11 28h1v1h-1zM18 28h1v1h-1zM22 28h1v1h-1zM24 28h6v1h-6zM0 29h1v1h-1zM2 29h3v1h-3zM6 29h1v1h-1zM10 29h5v1h-5zM16 29h1v1h-1zM19 29h1v1h-1zM22 29h2v1h-2zM25 29h1v1h-1zM27 29h3v1h-3zM31 29h2v1h-2zM0 30h1v1h-1zM2 30h3v1h-3zM6 30h1v1h-1zM16 30h2v1h-2zM19 30h1v1h-1zM21 30h2v1h-2zM25 30h1v1h-1zM27 30h2v1h-2zM31 30h2v1h-2zM0 31h1v1h-1zM6 31h1v1h-1zM9 31h3v1h-3zM13 31h4v1h-4zM19 31h1v1h-1zM23 31h1v1h-1zM25 31h1v1h-1zM27 31h4v1h-4zM0 32h7v1h-7zM8 32h1v1h-1zM10 32h1v1h-1zM13 32h2v1h-2zM17 32h1v1h-1zM22 32h4v1h-4zM27 32h1v1h-1zM29 32h1v1h-1zM31 32h1v1h-1z';
  var QR = '<svg viewBox="-2 -2 ' + (QR_SIZE + 4) + ' ' + (QR_SIZE + 4) + '" shape-rendering="crispEdges"><rect x="-2" y="-2" width="' + (QR_SIZE + 4) + '" height="' + (QR_SIZE + 4) + '" fill="#fff"/><path d="' + QR_PATH + '" fill="#2a0a3d"/></svg>';

  function goldTicket(parent, css) {
    return div(parent, 'tk',
      '<div class="tk-main"><p class="tk-presents">Colgrain Parent Council presents</p><p class="tk-event">Wonderlicious</p>' +
      '<p class="tk-title">Golden Ticket</p><p class="tk-refline"><span class="tk-label">Reference</span><span class="tk-ref">WIN-NER</span></p></div>' +
      '<div class="tk-stub"><span class="tk-label">No.</span><span class="tk-no">21</span><div class="tk-qr">' + QR + '</div></div>', css);
  }

  // ---------------------------------------------------------------------------------------
  // Cartoon kids (made up, not real children)
  // ---------------------------------------------------------------------------------------
  var HAIR = {
    short: { front: 'M21 58 Q18 24 52 25 Q82 27 79 58 Q76 44 66 40 Q58 47 46 42 Q32 46 21 58Z' },
    spiky: { front: 'M21 57 L23 37 L31 39 L33 26 L42 33 L48 21 L55 32 L63 24 L66 36 L75 33 L79 57 Q73 44 50 43 Q29 44 21 57Z' },
    long: {
      back: 'M20 58 Q16 22 50 23 Q84 22 80 58 L84 114 Q66 120 50 118 Q34 120 16 114Z',
      front: 'M21 56 Q22 25 50 25 Q78 25 79 56 Q72 38 56 36 Q48 44 34 42 Q26 46 21 56Z'
    },
    bunches: {
      back: 'M7 44 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M71 44 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0',
      front: 'M21 56 Q22 25 50 25 Q78 25 79 56 Q72 38 56 36 Q48 44 34 42 Q26 46 21 56Z',
      ties: true
    },
    curly: {
      back: 'M13 40 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 M22 28 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M35 23 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M50 28 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M61 40 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 M12 56 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M68 56 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0',
      front: 'M28 37 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M42 33 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M56 37 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0'
    },
    pony: {
      back: 'M74 36 Q98 40 92 76 Q88 86 82 80 Q88 56 72 46Z',
      front: 'M21 57 Q20 25 50 25 Q80 25 79 57 Q74 40 60 37 Q50 44 36 41 Q26 45 21 57Z'
    }
  };

  function kid(parent, o) {
    var h = HAIR[o.hair];
    var k = { root: div(parent, 'kid') };
    if (o.scale) k.root.style.scale = o.scale;
    k.bob = div(k.root, 'kid-bob');
    var legs = o.skirt
      ? '<rect x="37" y="146" width="11" height="40" rx="5" fill="' + o.legs + '"/><rect x="52" y="146" width="11" height="40" rx="5" fill="' + o.legs + '"/><path d="M29 136 L71 136 L79 166 Q50 172 21 166Z" fill="' + o.skirt + '"/>'
      : '<rect x="36" y="140" width="12" height="46" rx="5" fill="' + o.legs + '"/><rect x="52" y="140" width="12" height="46" rx="5" fill="' + o.legs + '"/>';
    k.body = div(k.bob, 'kid-body',
      '<svg width="100" height="200" viewBox="0 0 100 200">' +
      '<ellipse cx="50" cy="195" rx="30" ry="5" fill="rgba(0,0,0,.3)"/>' +
      (h.back ? '<path d="' + h.back + '" fill="' + o.hairColor + '"/>' : '') +
      legs +
      '<path d="M30 190 Q30 182 40 182 L48 182 L48 192 L32 192 Q30 192 30 190Z" fill="' + o.shoes + '"/>' +
      '<path d="M70 190 Q70 182 60 182 L52 182 L52 192 L68 192 Q70 192 70 190Z" fill="' + o.shoes + '"/>' +
      '<path d="M27 104 Q28 90 42 89 L58 89 Q72 90 73 104 L75 148 Q50 154 25 148Z" fill="' + o.top + '"/>' +
      '<path d="M41 89 L50 100 L59 89Z" fill="#fff"/>' +
      '<rect x="44" y="79" width="12" height="12" rx="3" fill="' + o.skin + '"/>' +
      '<circle cx="22" cy="58" r="5.5" fill="' + o.skin + '"/><circle cx="78" cy="58" r="5.5" fill="' + o.skin + '"/>' +
      '<circle cx="50" cy="56" r="28" fill="' + o.skin + '"/>' +
      '<circle cx="34" cy="67" r="5" fill="#ff7f99" opacity=".38"/><circle cx="66" cy="67" r="5" fill="#ff7f99" opacity=".38"/>' +
      '<path d="M34.5 48 Q40 44.5 45 47.5 M55 47.5 Q60 44.5 65.5 48" stroke="' + o.hairColor + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="' + h.front + '" fill="' + o.hairColor + '"/>' +
      (h.ties ? '<circle cx="25" cy="42" r="3.6" fill="#e0457b"/><circle cx="75" cy="42" r="3.6" fill="#e0457b"/>' : '') +
      '</svg>');
    k.hold = div(k.bob, 'kid-hold');
    var arm = '<svg width="16" height="54" viewBox="0 0 16 54"><rect x="2" y="0" width="12" height="40" rx="6" fill="' + o.top + '"/><circle cx="8" cy="45" r="6.5" fill="' + o.skin + '"/></svg>';
    k.armL = div(k.bob, 'kid-arm l', arm, 'rotate:10deg');
    k.armR = div(k.bob, 'kid-arm r', arm, 'rotate:-10deg');
    k.eyes = div(k.bob, 'kid-eyes',
      '<svg width="100" height="100" viewBox="0 0 100 100"><ellipse cx="40" cy="57" rx="3.5" ry="4.5" fill="#2a1a14"/><ellipse cx="60" cy="57" rx="3.5" ry="4.5" fill="#2a1a14"/>' +
      '<circle cx="41.3" cy="55.3" r="1.3" fill="#fff"/><circle cx="61.3" cy="55.3" r="1.3" fill="#fff"/></svg>');
    var mouth = function (svg, on) { return div(k.bob, 'kid-mouth', '<svg width="100" height="100" viewBox="0 0 100 100">' + svg + '</svg>', on ? '' : 'opacity:0'); };
    k.smile = mouth('<path d="M42 68 Q50 76 58 68" stroke="#7a2e2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>', true);
    k.grin = mouth('<path d="M40 66 Q50 83 60 66Z" fill="#7a2e2e"/><path d="M44.5 73 Q50 78.5 55.5 73 Q50 71.5 44.5 73Z" fill="#ef7d8e"/>');
    k.wow = mouth('<ellipse cx="50" cy="71" rx="5" ry="6.5" fill="#7a2e2e"/><ellipse cx="50" cy="74" rx="3.2" ry="2.3" fill="#ef7d8e"/>');
    key(k.armL, 'rotate', 0, '10deg');
    key(k.armR, 'rotate', 0, '-10deg');
    key(k.smile, 'opacity', 0, 1);
    key(k.grin, 'opacity', 0, 0);
    key(k.wow, 'opacity', 0, 0);
    return k;
  }

  var KIDS = {
    amy: { skin: '#f6d3b8', hair: 'bunches', hairColor: '#b5532a', top: '#e0457b', skirt: '#3a0c57', legs: '#f2e3d3', shoes: '#2a0a3d' },
    leo: { skin: '#8d5a3b', hair: 'curly', hairColor: '#1d1411', top: '#29a0d8', legs: '#2d3a55', shoes: '#f4f0e8' },
    isla: { skin: '#eab58f', hair: 'long', hairColor: '#3b2416', top: '#43b77a', legs: '#2d3a55', shoes: '#54127c' },
    sam: { skin: '#f6d3b8', hair: 'spiky', hairColor: '#d9a441', top: '#f08a2c', legs: '#2d3a55', shoes: '#2a0a3d' },
    zara: { skin: '#c98b5f', hair: 'pony', hairColor: '#1d1411', top: '#9b5de5', skirt: '#2d3a55', legs: '#2d3a55', shoes: '#e0457b' },
    helper: { skin: '#eab58f', hair: 'short', hairColor: '#6b4226', top: '#54127c', legs: '#2d3a55', shoes: '#2a0a3d' }
  };

  // Kid moves: every position is a translate of the whole kid, in scene pixels.
  function place(k, t, x, y, ease) { key(k.root, 'translate', t, px(x, y), ease); }
  function walk(k, t0, t1, x0, y0, x1, y1) {
    place(k, t0, x0, y0);
    place(k, t1, x1, y1, 'linear');
    for (var t = t0; t < t1 - 0.05; t += 0.26) {
      keys(k.bob, 'translate', [[t, '0px 0px'], [t + 0.13, '0px -6px', 'out'], [t + 0.26, '0px 0px', 'in']]);
    }
  }
  function jump(k, t, height) {
    keys(k.bob, 'translate', [[t, '0px 0px'], [t + 0.2, px(0, -(height || 34)), 'out'], [t + 0.4, '0px 0px', 'in']]);
  }
  function arms(k, t, left, right, dur) {
    to(k.armL, 'rotate', t, t + (dur || 0.25), left + 'deg', 'out');
    to(k.armR, 'rotate', t, t + (dur || 0.25), right + 'deg', 'out');
  }
  function face(k, t, which) {
    ['smile', 'grin', 'wow'].forEach(function (m) { to(k[m], 'opacity', t - 0.01, t, m === which ? 1 : 0, 'step'); });
  }
  function blink(k, times) {
    times.forEach(function (t) { keys(k.eyes, 'scale', [[t, '1 1'], [t + 0.06, '1 0.1'], [t + 0.13, '1 1']]); });
  }
  function rest(k, t) { arms(k, t, 10, -10); face(k, t, 'smile'); }

  // ---------------------------------------------------------------------------------------
  // Shared backdrop: slowly turning gold rays
  // ---------------------------------------------------------------------------------------
  var rays = div(root, 'rays');
  keys(rays, 'rotate', [[0, '0deg'], [76, '300deg', 'linear']]);
  function raysOn(t0, t1, level, at) {
    to(rays, 'opacity', t0 - 0.5, t0, level, 'soft');
    to(rays, 'opacity', t1, t1 + 0.5, 0, 'soft');
    if (at) to(rays, 'translate', t0 - 0.5, t0 - 0.49, px(at[0] - 240, at[1] - 160), 'step');
  }
  key(rays, 'opacity', 0, 0);
  key(rays, 'translate', 0, '0px 0px');

  // ---------------------------------------------------------------------------------------
  // 1. Title (0 - 5s)
  // ---------------------------------------------------------------------------------------
  var s1 = scene(0, 5.6);
  var g1 = div(s1, 'sc');
  keys(g1, 'opacity', [[4.9, 1], [5.3, 0, 'linear']]);
  keys(g1, 'translate', [[4.9, '0px 0px'], [5.3, '0px -40px', 'in']]);
  var logo = div(g1, 'abs logo-tile', '<img src="../assets/colgrain-logo.png" alt="" width="58" height="58">', 'left:205px;top:28px');
  pop(logo, 0.25, 1.18);
  fade(div(g1, 'abs eyebrow', 'Colgrain Parent Council presents', 'left:0;right:0;top:114px'), 0.75);
  var wm = div(g1, 'wordmark-lg', '', 'top:142px');
  'Wonderlicious'.split('').forEach(function (ch, i) {
    var sp = document.createElement('span');
    sp.textContent = ch;
    wm.appendChild(sp);
    var t = 1.0 + i * 0.055;
    keys(sp, 'scale', [[t, 0], [t + 0.25, 1.25, 'out'], [t + 0.42, 1, 'soft']]);
    keys(sp, 'translate', [[t, '0px -40px'], [t + 0.3, '0px 0px', 'out']]);
    keys(sp, 'opacity', [[t, 0], [t + 0.05, 1, 'linear']]);
  });
  var rib1 = div(g1, 'ribbon', 'The Golden Ticket event', 'left:50%;top:232px;translate:-50% 0');
  pop(rib1, 1.95, 1.15);
  sparks(g1, 1.6, 5.2, [[52, 150], [430, 158], [96, 226], [392, 236], [246, 104], [22, 196, 12], [462, 214, 12]], 11);
  raysOn(0.9, 4.9, 0.55);
  cap(2.9, 4.95, 'Here’s how it works…');
  film.sfx(0.25, 'pop', 620);
  film.sfx(0.75, 'whoosh');
  for (var i = 0; i < 7; i++) film.sfx(1.0 + i * 0.11, 'pop', 420 + i * 70);
  film.sfx(1.95, 'chime');
  film.sfx(2.62, 'thud');
  film.sfx(2.8, 'thud');
  film.sfx(3.3, 'sparkle', 5);

  // The bar and bag carry on into scene 2.
  var sAB = scene(0, 12.3);
  var bar = div(sAB, 'art-bar');
  var bag = div(sAB, 'art-bag');
  keys(bar, 'translate', [[2.1, px(66, 640)], [2.7, px(66, 290), 'out'], [5.0, px(66, 290)], [5.8, px(95, 119), 'inout']]);
  keys(bar, 'rotate', [[2.1, '-22deg'], [2.8, '-8deg', 'out'], [5.0, '-8deg'], [5.8, '-4deg', 'inout']]);
  keys(bar, 'scale', [[5.0, 1], [5.8, 1.15, 'inout'], [11.4, 1.15], [11.9, 0.15, 'in']]);
  keys(bar, 'opacity', [[11.7, 1], [11.9, 0, 'linear']]);
  keys(bag, 'translate', [[2.25, px(262, 640)], [2.85, px(262, 300), 'out'], [5.1, px(262, 300)], [5.9, px(250, 140), 'inout']]);
  keys(bag, 'rotate', [[2.25, '18deg'], [2.95, '7deg', 'out'], [5.1, '7deg'], [5.9, '4deg', 'inout']]);
  keys(bag, 'scale', [[5.1, 1], [5.9, 1.05, 'inout'], [11.4, 1.05], [11.9, 0.15, 'in']]);
  keys(bag, 'opacity', [[11.7, 1], [11.9, 0, 'linear']]);

  // ---------------------------------------------------------------------------------------
  // 2. What's on sale (5 - 12s)
  // ---------------------------------------------------------------------------------------
  var s2 = scene(4.9, 12.3);
  var t2 = div(s2, 'big-title', 'Two tasty treats', 'top:28px');
  pop(t2, 5.4);
  unpop(t2, 11.3);
  var lb1 = div(s2, 'abs label', 'Milk chocolate bar', 'left:60px;top:372px;width:180px');
  var lb2 = div(s2, 'abs label', 'Magic Mix sweets', 'left:246px;top:372px;width:180px');
  fade(lb1, 6.0, 11.3);
  fade(lb2, 6.2, 11.3);
  [[182, 116, 8.4], [352, 146, 8.75]].forEach(function (p) {
    var tag = div(s2, 'tag', '<div class="tag-card"><span>£2.50</span></div>');
    keys(tag, 'translate', [[p[2], px(p[0], -130)], [p[2] + 0.35, px(p[0], p[1]), 'out']]);
    keys(tag, 'rotate', [[p[2], '30deg'], [p[2] + 0.35, '-18deg', 'out'], [p[2] + 0.7, '10deg', 'soft'], [p[2] + 1.05, '-5deg', 'soft'], [p[2] + 1.4, '2deg', 'soft'], [p[2] + 1.7, '0deg', 'soft']]);
    keys(tag, 'opacity', [[p[2], 1], [11.3, 1], [11.6, 0, 'linear']]);
    film.sfx(p[2] + 0.35, 'coin');
  });
  cap(5.5, 8.2, 'Choose a <b>Wonderlicious</b> milk chocolate bar or a bag of <b>Magic Mix</b> sweets');
  cap(8.5, 11.6, 'Just <b>£2.50</b> each!');
  film.sfx(5.0, 'whoosh');
  film.sfx(5.4, 'pop', 500);

  // ---------------------------------------------------------------------------------------
  // 3. 300 bars and bags, 79 golden tickets (12 - 20s)
  // ---------------------------------------------------------------------------------------
  var s3 = scene(11.8, 20.4);
  var g3 = div(s3, 'sc');
  keys(g3, 'opacity', [[19.6, 1], [20.0, 0, 'linear']]);
  var t3a = div(g3, 'big-title', '300 bars and bags', 'top:24px');
  pop(t3a, 12.15);
  unpop(t3a, 13.95, 0.25);
  var t3b = div(g3, 'big-title', '<span class="count">0</span> golden tickets!', 'top:24px');
  pop(t3b, 14.2);
  var countEl = t3b.querySelector('.count');
  var grid = div(g3, 'abs', '', 'left:20px;top:86px;width:440px;height:330px');
  for (var r = 0; r < 15; r++) {
    var row = div(grid, 'abs', '', 'left:0;top:' + r * 22 + 'px;width:440px;height:22px');
    pop(row, 12.3 + r * 0.05, 1.1, 0.3);
    for (var c = 0; c < 20; c++) div(row, 'mini ' + ((r + c) % 2 ? 'bar' : 'bag'), '', 'left:' + (c * 22 + 11) + 'px;top:11px');
  }
  var order = [];
  for (var n = 0; n < 300; n++) order.push(n);
  var rand = Kit.rng(2026);
  for (var j = order.length - 1; j > 0; j--) {
    var s = Math.floor(rand() * (j + 1));
    var tmp = order[j]; order[j] = order[s]; order[s] = tmp;
  }
  var GOLD_START = 14.25, GOLD_STEP = 2.3 / 79;
  order.slice(0, 79).forEach(function (cell, i) {
    var g = div(grid, 'mini-gold', '', 'left:' + ((cell % 20) * 22 + 11) + 'px;top:' + (Math.floor(cell / 20) * 22 + 11) + 'px');
    pop(g, GOLD_START + i * GOLD_STEP, 1.7, 0.3);
    keys(g, 'scale', [[17.5 + (i % 5) * 0.04, 1], [17.72 + (i % 5) * 0.04, 1.4, 'out'], [18.0 + (i % 5) * 0.04, 1, 'soft']]);
  });
  var lastCount = -1;
  film.draw(function (t) {
    var shown = t < GOLD_START ? 0 : Math.min(79, Math.floor((t - GOLD_START) / GOLD_STEP) + 1);
    if (shown !== lastCount) { lastCount = shown; countEl.textContent = shown; }
  });
  raysOn(14.3, 19.6, 0.42, [240, 250]);
  cap(12.3, 13.95, 'There are <b>300</b> bars and bags…');
  cap(14.3, 17.2, '…and <b>79</b> of them have a <b>golden ticket</b> hidden inside!');
  cap(17.5, 19.8, 'That’s more than <b>1 in 4</b>!');
  for (var p3 = 0; p3 < 4; p3++) film.sfx(12.3 + p3 * 0.2, 'pop', 380 + p3 * 60);
  [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96, 3520].forEach(function (f, i) {
    film.sfx(GOLD_START + i * 0.153, 'twinkle', f);
  });
  film.sfx(16.65, 'chime');
  film.sfx(17.5, 'cheer');

  // Things kids carry. Bars and bags are the real artwork, shrunk.
  function thing(parent, kind, x, y, extra) {
    var css = 'left:' + x + 'px;top:' + y + 'px;' + (extra || '');
    if (kind === 'bar') return div(parent, 'art-bar', '', css + 'width:33px;height:66px;box-shadow:0 4px 8px rgba(0,0,0,.4)');
    if (kind === 'bag') return div(parent, 'art-bag', '', css + 'scale:.3;transform-origin:0 0');
    if (kind === 'lucky') return div(parent, 'lucky', '<span>?</span>', css);
    if (kind === 'purse') return div(parent, 'purse', '<span>' + extra + '</span>', 'left:' + x + 'px;top:' + y + 'px');
    return div(parent, 'env', '<span>' + extra + '</span>', 'left:' + x + 'px;top:' + y + 'px');
  }
  var SIZE = { bar: [33, 66], bag: [51, 57], env: [40, 27], purse: [38, 28] };

  // ---------------------------------------------------------------------------------------
  // 4. Buying in school (20 - 31s)
  // ---------------------------------------------------------------------------------------
  var s4 = scene(19.7, 31.4);
  var g4 = div(s4, 'sc');
  fade(g4, 20.1, 30.9, 0.4);
  div(g4, 'abs', '<svg width="480" height="480" viewBox="0 0 480 480" aria-hidden="true">' +
    '<rect x="0" y="330" width="480" height="150" fill="#240833"/>' +
    '<rect x="30" y="118" width="420" height="214" rx="6" fill="#4a1a6b"/>' +
    '<path d="M150 122 L240 56 L330 122Z" fill="#5a2380"/>' +
    '<circle cx="240" cy="98" r="14" fill="#fef7e5"/><path d="M240 90 V98 H246" stroke="#3a0c57" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<rect x="146" y="128" width="188" height="30" rx="6" fill="#fef7e5"/>' +
    '<text x="240" y="150" text-anchor="middle" font-family="Chewy, sans-serif" font-size="21" fill="#54127c">Colgrain Primary</text>' +
    [52, 110, 326, 384].map(function (x) {
      return [172, 246].map(function (y) {
        return '<rect x="' + x + '" y="' + y + '" width="44" height="40" rx="4" fill="#ffd978" opacity=".8"/><path d="M' + (x + 22) + ' ' + y + 'v40M' + x + ' ' + (y + 20) + 'h44" stroke="#4a1a6b" stroke-width="3"/>';
      }).join('');
    }).join('') +
    '<path d="M210 332 V262 a30 30 0 0 1 60 0 V332Z" fill="#2a0a3d"/>' +
    '</svg>');
  var cals = [['Tue', '29', 16, 14, '-6deg', 20.5], ['Wed', '30', 118, 26, '5deg', 20.8]].map(function (c) {
    var cal = div(g4, 'cal', '<div class="cal-top">' + c[0] + '</div><div class="cal-day">' + c[1] + '</div><div class="cal-month">Sept</div>', 'left:' + c[2] + 'px;top:' + c[3] + 'px;rotate:' + c[4]);
    pop(cal, c[5], 1.2);
    film.sfx(c[5], 'pop', 700);
    return cal;
  });
  var helper = kid(g4, KIDS.helper);
  helper.root.style.scale = '1.25';
  keys(helper.root, 'translate', [[20.9, px(110, 230)], [21.3, px(110, 199), 'out']]);
  keys(helper.root, 'opacity', [[20.9, 0], [21.1, 1, 'linear']]);
  blink(helper, [22.0, 25.2, 28.1, 30.3]);
  div(g4, 'table-top', '', 'left:24px;top:318px');
  div(g4, 'cloth', '', 'left:28px;top:332px');
  var banner = div(g4, 'banner', 'Wonderlicious £2.50', 'left:36px;top:340px;width:220px;height:40px;font-size:23px');
  keys(banner, 'rotate', [[20.7, '-70deg'], [21.1, '6deg', 'out'], [21.35, '-3deg', 'soft'], [21.6, '0deg', 'soft']]);
  keys(banner, 'opacity', [[20.69, 0], [20.7, 1, 'step']]);
  thing(g4, 'bar', 44, 262, 'rotate:-6deg');
  thing(g4, 'bar', 70, 258, 'rotate:4deg');
  thing(g4, 'bag', 98, 266);
  film.sfx(20.1, 'whoosh');
  film.sfx(21.1, 'boing');

  var HELPER_HAND = [233, 291];
  var FRONT = [285, 270];
  function purchase(k, b, pay, name, buys) {
    // Hold the envelope or purse in the left hand while walking up.
    var inHand = thing(k.hold, pay, 21 - SIZE[pay][0] / 2, 138 - SIZE[pay][1] / 2, name);
    key(inHand, 'opacity', 0, 1);
    key(inHand, 'opacity', b + 0.1, 0, 'step');
    var fly = thing(g4, pay, 0, 0, name);
    var rest = [FRONT[0] + 21, FRONT[1] + 138];
    var raised = [FRONT[0] - 8.6, FRONT[1] + 113.3];
    function at(p, kind) { return px(p[0] - SIZE[kind][0] / 2, p[1] - SIZE[kind][1] / 2); }
    keys(fly, 'opacity', [[b + 0.1, 0], [b + 0.1, 1, 'step'], [b + 0.95, 1], [b + 1.1, 0, 'linear']]);
    keys(fly, 'translate', [[b + 0.1, at(rest, pay)], [b + 0.35, at(raised, pay), 'out'], [b + 0.5, at(raised, pay)], [b + 0.9, at(HELPER_HAND, pay), 'inout']]);
    arms(k, b + 0.1, 70, -10);
    arms(helper, b + 0.55, 10, -70);
    film.sfx(b + 0.5, 'whoosh');
    // Paid!
    var coin = div(g4, 'coin', '£2.50', 'left:62px;top:196px');
    pop(coin, b + 1.0, 1.25, 0.4);
    keys(coin, 'translate', [[b + 1.4, '0px 0px'], [b + 2.0, '0px -40px', 'out']]);
    keys(coin, 'opacity', [[b + 1.7, 1], [b + 2.0, 0, 'linear']]);
    film.sfx(b + 1.0, 'kaching');
    // The helper hands over a bar or bag, and the kid goes off happy.
    var goods = thing(g4, buys, 0, 0);
    keys(goods, 'opacity', [[b + 1.3, 0], [b + 1.3, 1, 'step'], [b + 1.72, 1], [b + 1.72, 0, 'step']]);
    keys(goods, 'translate', [[b + 1.3, at(HELPER_HAND, buys)], [b + 1.72, at(rest, buys), 'inout']]);
    arms(k, b + 1.45, 10, -10);
    arms(helper, b + 1.75, 10, -10);
    var held = thing(k.hold, buys, 21 - SIZE[buys][0] / 2, 138 - SIZE[buys][1] / 2);
    keys(held, 'opacity', [[b + 1.72, 0], [b + 1.72, 1, 'step']]);
    film.sfx(b + 1.72, 'pop', 560);
    face(k, b + 1.8, 'grin');
    jump(k, b + 1.9, 30);
    film.sfx(b + 1.9, 'boing');
  }

  var amy4 = kid(g4, KIDS.amy);
  var leo4 = kid(g4, KIDS.leo);
  var isla4 = kid(g4, KIDS.isla);
  walk(amy4, 21.2, 22.6, 540, 270, FRONT[0], FRONT[1]);
  purchase(amy4, 22.7, 'env', 'Amy', 'bar');
  walk(leo4, 21.5, 23.0, 620, 272, 375, 272);
  walk(leo4, 25.0, 25.5, 375, 272, FRONT[0], FRONT[1]);
  purchase(leo4, 25.6, 'purse', 'Leo', 'bag');
  walk(isla4, 25.2, 26.5, 560, 272, 375, 272);
  walk(isla4, 27.9, 28.4, 375, 272, FRONT[0], FRONT[1]);
  purchase(isla4, 28.5, 'env', 'Isla', 'bar');
  [[amy4, 25.1], [leo4, 28.0]].forEach(function (p) {
    walk(p[0], p[1], p[1] + 0.6, FRONT[0], FRONT[1], FRONT[0] + 40, FRONT[1] + 60);
    keys(p[0].root, 'opacity', [[p[1] + 0.2, 1], [p[1] + 0.6, 0, 'linear']]);
  });
  blink(amy4, [21.9, 24.0]);
  blink(leo4, [22.4, 24.6, 27.0]);
  blink(isla4, [26.8, 29.9]);
  cap(20.4, 24.3, 'On sale in school on <b>Tuesday 29</b> and <b>Wednesday 30 September</b>');
  cap(24.6, 27.6, 'Send <b>£2.50 in cash</b> for each bar or bag…');
  cap(27.9, 30.8, '…in an envelope or purse with your child’s <b>name</b> on it');

  // ---------------------------------------------------------------------------------------
  // 5. A free lucky bag with every one (31 - 36.5s)
  // ---------------------------------------------------------------------------------------
  var s5 = scene(30.9, 36.9);
  var g5 = div(s5, 'sc');
  fade(g5, 31.2, 36.1, 0.35);
  var t5 = div(g5, 'big-title', 'Plus a FREE lucky bag!', 'top:30px');
  pop(t5, 31.35);
  film.sfx(31.35, 'chime');
  raysOn(31.3, 36.1, 0.4, [240, 330]);
  [[KIDS.amy, 45], [KIDS.leo, 190], [KIDS.isla, 335]].forEach(function (p, i) {
    var k = kid(g5, p[0]);
    place(k, 31, p[1], 236);
    pop(k.root, 31.5 + i * 0.12, 1.08, 0.4);
    var lucky = thing(k.hold, 'lucky', 24, 106);
    pop(lucky, 32.0 + i * 0.25, 1.35, 0.4);
    film.sfx(32.0 + i * 0.25, 'pop', 480 + i * 120);
    face(k, 32.2 + i * 0.25, 'grin');
    jump(k, 32.55 + i * 0.12, 32);
    jump(k, 33.5 + i * 0.12, 26);
    arms(k, 33.45 + i * 0.12, 150, -150, 0.2);
    arms(k, 34.3, 10, -10);
    blink(k, [34.8 + i * 0.3]);
  });
  fx.burst(32.6, 20, 470, -Math.PI / 3, 0.7, 900, 70, false, false, 51);
  fx.burst(32.6, 460, 470, -Math.PI * 2 / 3, 0.7, 900, 70, false, false, 52);
  film.sfx(32.6, 'cheer');
  film.sfx(33.5, 'boing');
  cap(31.5, 36.1, 'Every bar and bag comes with a <b>free lucky bag</b>. A prize every time!');

  // A zig-zag tear across a 110 x 221 bar, shared by the top and bottom halves.
  function tear(width, step, low, high) {
    var pts = [];
    for (var x = 0; x <= width; x += step) pts.push(x + 'px ' + ((x / step) % 2 ? low : high) + 'px');
    return {
      top: 'polygon(0px 0px, ' + width + 'px 0px, ' + pts.slice().reverse().join(', ') + ')',
      bottom: 'polygon(' + pts.join(', ') + ', ' + width + 'px 100%, 0px 100%)'
    };
  }
  // Places a golden ticket (300 x 150) by its centre.
  function tkAt(el, t, x, y, scale, rot, ease) {
    key(el, 'translate', t, px(x - 150, y - 75), ease);
    if (scale != null) key(el, 'scale', t, scale, ease);
    if (rot != null) key(el, 'rotate', t, rot + 'deg', ease);
  }

  // ---------------------------------------------------------------------------------------
  // 6. Finding a golden ticket (36.5 - 45s)
  // ---------------------------------------------------------------------------------------
  var s6 = scene(36.2, 45.1);
  var g6 = div(s6, 'sc');
  var amy6 = kid(g6, KIDS.amy);
  amy6.root.style.scale = '1.5';
  place(amy6, 36, 100, 270);
  arms(amy6, 35.8, 10, -70, 0.01);
  var glow6 = div(g6, 'glow', '', 'left:139px;top:140px');
  var tk6 = goldTicket(g6);
  var barBox = div(g6, 'abs', '', 'left:244px;top:190px;width:110px;height:221px;transform-origin:50% 100%');
  var cut = tear(110, 10, 60, 70);
  div(barBox, 'art-bar', '', 'left:0;top:0;clip-path:' + cut.bottom);
  var barTop = div(barBox, 'art-bar', '', 'left:0;top:0;box-shadow:none;clip-path:' + cut.top);
  fade(amy6.root, 36.5, 44.7, 0.35);
  fade(barBox, 36.5);
  keys(barBox, 'rotate', [[37.5, '0deg'], [37.65, '-4deg'], [37.8, '4deg'], [37.95, '-4deg'], [38.1, '4deg'], [38.25, '-3deg'], [38.4, '0deg']]);
  keys(barBox, 'translate', [[40.0, '0px 0px'], [40.5, '20px 90px', 'in']]);
  keys(barBox, 'opacity', [[40.0, 1], [40.5, 0, 'linear']]);
  keys(barTop, 'translate', [[38.5, '0px 0px'], [39.2, '80px -150px', 'out']]);
  keys(barTop, 'rotate', [[38.5, '0deg'], [39.2, '40deg', 'out']]);
  keys(barTop, 'opacity', [[38.9, 1], [39.2, 0, 'linear']]);
  keys(glow6, 'opacity', [[38.5, 0], [38.7, 1, 'out'], [40.2, 0.7], [41.0, 0, 'soft']]);
  keys(tk6, 'opacity', [[38.45, 0], [38.5, 1, 'step']]);
  tkAt(tk6, 38.5, 299, 300, 0.34, 0);
  tkAt(tk6, 39.4, 299, 168, 0.5, -6, 'out');
  tkAt(tk6, 40.2, 240, 88, 0.8, -4, 'inout');
  face(amy6, 38.6, 'wow');
  keys(amy6.eyes, 'scale', [[38.6, '1 1'], [38.75, '1.25 1.25', 'out'], [39.9, '1.25 1.25'], [40.05, '1 1']]);
  face(amy6, 40.05, 'grin');
  arms(amy6, 40.05, 150, -150, 0.22);
  jump(amy6, 40.3, 40);
  jump(amy6, 41.0, 30);
  arms(amy6, 41.8, 10, -10, 0.3);
  blink(amy6, [37.2, 42.6, 44.0]);
  sparks(g6, 39.4, 44.8, [[80, 40], [400, 34], [60, 170], [420, 160], [240, 22, 12], [150, 190, 12]], 66);
  raysOn(38.6, 44.6, 0.55, [240, 110]);
  fx.burst(40.2, 0, 470, -Math.PI / 3, 0.75, 1000, 80, false, false, 61);
  fx.burst(40.2, 480, 470, -Math.PI * 2 / 3, 0.75, 1000, 80, false, false, 62);
  fx.burst(39.4, 299, 200, -Math.PI / 2, 2.4, 420, 40, true, true, 63);

  // Leo finds one in his bag too.
  var leo6 = kid(g6, KIDS.leo);
  leo6.root.style.scale = '1.2';
  walk(leo6, 41.4, 42.0, 560, 270, 350, 270);
  fade(leo6.root, 41.4, 44.7, 0.01);
  thing(leo6.hold, 'bag', 24.5, 104);
  var tkLeo = goldTicket(g6);
  keys(tkLeo, 'opacity', [[42.35, 0], [42.4, 1, 'step'], [44.7, 1], [45.0, 0, 'linear']]);
  tkAt(tkLeo, 42.4, 400, 360, 0.1, 0);
  tkAt(tkLeo, 42.8, 400, 228, 0.3, -8, 'out');
  face(leo6, 42.5, 'grin');
  jump(leo6, 42.6, 30);
  arms(leo6, 42.6, 150, -150, 0.2);
  fx.burst(42.5, 400, 250, -Math.PI / 2, 2.2, 380, 30, true, true, 64);
  cap(36.8, 38.45, 'Open your bar or bag…');
  cap(38.75, 41.8, 'Lucky kids will find a <b>golden ticket</b> inside!');
  cap(42.1, 44.8, 'Keep it safe. You’ll need it to <b>claim your prize</b>!');
  film.sfx(36.6, 'whoosh');
  film.sfx(37.5, 'drumroll', 0.95);
  film.sfx(38.5, 'rip');
  film.sfx(38.7, 'sparkle', 6);
  film.sfx(39.5, 'whoosh');
  film.sfx(40.1, 'crash');
  film.sfx(40.1, 'chime');
  film.sfx(40.2, 'cheer');
  film.sfx(40.3, 'boing');
  film.sfx(41.4, 'whoosh');
  film.sfx(42.4, 'pop', 700);
  film.sfx(42.5, 'sparkle', 4);
  film.sfx(42.6, 'boing');

  // ---------------------------------------------------------------------------------------
  // 7. Scan the QR code to see the prize (45 - 55s)
  // ---------------------------------------------------------------------------------------
  var s7 = scene(44.9, 55.3);
  var tk7 = goldTicket(s7);
  keys(tk7, 'opacity', [[44.99, 0], [45.0, 1, 'step'], [47.9, 1], [48.4, 0, 'linear']]);
  tkAt(tk7, 45.0, 240, 88, 0.8, -4);
  tkAt(tk7, 45.6, 240, 170, 1.2, 0, 'inout');
  tkAt(tk7, 47.9, 240, 170, 1.2, 0);
  tkAt(tk7, 48.4, 200, 230, 0.9, -8, 'in');
  var phone = div(s7, 'phone');
  var screen = div(phone, 'phone-screen');
  div(phone, 'phone-notch');
  var vf = div(screen, 'vf', '<div class="vf-box"><i></i><i></i><i></i><i></i><div class="vf-line"></div></div><div class="vf-ok">✓</div><p class="vf-hint">Point your camera at the QR code</p>');
  var vfLine = vf.querySelector('.vf-line');
  var vfOk = vf.querySelector('.vf-ok');
  var app = div(screen, 'app',
    '<div class="app-head"><span class="app-logo"><img src="../assets/colgrain-logo.png" alt=""></span><span class="app-word">Wonderlicious</span></div>' +
    '<div class="app-ribbon">Found a golden ticket?</div>' +
    '<div class="app-form">' +
    '<p class="app-label">Your name</p><div class="app-input"><span class="typed"></span><i class="caret"></i></div>' +
    '<p class="app-label">Ticket number</p><div class="app-input code" style="position:relative"><span>21</span><i class="app-fill"></i></div>' +
    '<p class="app-label">Reference code</p><div class="app-input code" style="position:relative"><span>WIN-NER</span><i class="app-fill"></i></div>' +
    '<div class="app-btn">Reveal my prize<i class="tap-ring"></i></div></div>');
  var typed = app.querySelector('.typed');
  var caret = app.querySelector('.caret');
  var btn = app.querySelector('.app-btn');
  var ring = app.querySelector('.tap-ring');
  var reveal = div(screen, 'app-reveal',
    '<div class="app-rays"></div><p class="app-won">You’ve won…</p>' +
    '<div class="flip"><div class="flip-face flip-front"></div><div class="flip-face flip-back"><small>Winner</small><b>🐧</b><span>Edinburgh Zoo family pass</span></div></div>' +
    '<p class="app-prize">A family pass to Edinburgh Zoo!</p>');
  goldTicket(reveal.querySelector('.flip-front'));
  var flip = reveal.querySelector('.flip');

  // In over the ticket's QR code, scan, then up to the middle.
  keys(phone, 'translate', [[45.7, px(520, 300)], [46.3, px(296, 42), 'out'], [47.9, px(296, 42)], [48.6, px(165, 105), 'inout']]);
  keys(phone, 'rotate', [[45.7, '12deg'], [46.3, '0deg', 'out']]);
  keys(phone, 'scale', [[47.9, 1], [48.6, 1.25, 'inout']]);
  keys(phone, 'opacity', [[45.69, 0], [45.7, 1, 'step'], [54.6, 1], [54.9, 0, 'linear']]);
  keys(vfLine, 'translate', [[46.4, '0px -34px'], [46.9, '0px 34px', 'soft'], [47.4, '0px -34px', 'soft']]);
  keys(vfLine, 'opacity', [[47.45, 1], [47.5, 0, 'step']]);
  pop(vfOk, 47.55, 1.2, 0.3);
  keys(app, 'opacity', [[48.0, 0], [48.3, 1, 'linear']]);
  app.querySelectorAll('.app-fill').forEach(function (f, i) {
    keys(f, 'opacity', [[48.35 + i * 0.12, 0], [48.5 + i * 0.12, 1, 'out'], [49.2 + i * 0.12, 0, 'soft']]);
  });
  var lastTyped = -1;
  film.draw(function (t) {
    var n = Math.max(0, Math.min(3, Math.floor((t - 48.95) / 0.16)));
    if (n !== lastTyped) { lastTyped = n; typed.textContent = 'Amy'.slice(0, n); }
    caret.style.opacity = t > 48.4 && t < 50.1 && Math.floor(t * 2.5) % 2 === 0 ? 1 : 0;
  });
  keys(btn, 'scale', [[50.1, 1], [50.18, 0.9, 'out'], [50.35, 1, 'soft']]);
  keys(ring, 'scale', [[50.1, 0.3], [50.5, 1.6, 'out']]);
  keys(ring, 'opacity', [[50.1, 0], [50.12, 1, 'step'], [50.5, 0, 'linear']]);
  keys(reveal, 'opacity', [[50.45, 0], [50.65, 1, 'linear']]);
  keys(reveal.querySelector('.app-rays'), 'rotate', [[50.5, '0deg'], [55, '60deg', 'linear']]);
  keys(flip, 'rotate', [[50.8, '0deg'], [51.0, '-3deg'], [51.2, '3deg'], [51.4, '-4deg'], [51.6, '4deg'], [51.8, '-3deg'], [51.95, '0deg']]);
  keys(flip, 'scale', [[50.8, 1], [51.9, 1.08, 'soft'], [52.5, 1, 'soft']]);
  keys(flip, 'transform', [[52.0, 'perspective(500px) rotateY(0deg)'], [52.55, 'perspective(500px) rotateY(180deg)', 'inout']]);
  fade(reveal.querySelector('.app-won'), 52.3, null, 0.25);
  fade(reveal.querySelector('.app-prize'), 52.6, null, 0.25);
  fx.burst(52.3, 150, 250, -Math.PI * 0.8, 1.0, 900, 60, false, false, 71);
  fx.burst(52.3, 330, 250, -Math.PI * 0.2, 1.0, 900, 60, false, false, 72);
  fx.burst(52.4, 240, 230, -Math.PI / 2, 2.6, 520, 40, true, true, 73);
  cap(45.3, 48.4, 'Scan the <b>QR code</b> on your ticket with a phone…');
  cap(48.7, 51.8, '…type your name and tap <b>Reveal my prize</b>…');
  cap(52.1, 54.9, '…to see what you’ve won!');
  film.sfx(45.1, 'whoosh');
  film.sfx(45.8, 'whoosh');
  film.sfx(47.5, 'beep');
  film.sfx(48.0, 'whoosh');
  [48.95, 49.11, 49.27].forEach(function (t) { film.sfx(t, 'tap'); });
  film.sfx(50.1, 'tap');
  film.sfx(50.12, 'pop', 440);
  film.sfx(50.8, 'drumroll', 1.15);
  film.sfx(52.0, 'crash');
  film.sfx(52.0, 'fanfare');
  film.sfx(52.5, 'sparkle', 6);

  // ---------------------------------------------------------------------------------------
  // 8. The prizes (55 - 62s)
  // ---------------------------------------------------------------------------------------
  var s8 = scene(54.9, 62.4);
  var g8 = div(s8, 'sc');
  fade(g8, 55.2, 61.9, 0.35);
  var t8 = div(g8, 'big-title', '79 prizes to be won!', 'top:26px');
  pop(t8, 55.35);
  raysOn(55.3, 61.9, 0.35, [240, 260]);
  [['🏎️', 'LEGO Speed Champions', 1], ['🐧', 'Edinburgh Zoo family pass', 1], ['🤸', 'Monteys soft play voucher', 1],
   ['🎮', 'Roblox gift cards', 1], ['🔬', 'Science kits', 0], ['🐄', 'Board games', 0],
   ['🎯', 'Nerf pack', 0], ['🦄', 'Slime', 0], ['🍡', 'Squishies', 0]].forEach(function (p, i) {
    var tile = div(g8, 'prize' + (p[2] ? ' star' : ''), '<b>' + p[0] + '</b><span>' + p[1] + '</span>',
      'left:' + (20 + (i % 3) * 152) + 'px;top:' + (100 + Math.floor(i / 3) * 116) + 'px;rotate:' + [-3, 2, -2, 3, -1, 2, -3, 1, 3][i] + 'deg');
    pop(tile, 55.8 + i * 0.3, 1.14, 0.4);
    film.sfx(55.8 + i * 0.3, 'pop', 440 + i * 45);
  });
  cap(55.5, 58.9, '<b>79</b> prizes to be won, including…');
  cap(59.2, 61.9, '…and lots more!');
  film.sfx(55.3, 'chime');
  film.sfx(59.3, 'sparkle', 5);

  // ---------------------------------------------------------------------------------------
  // 9. Prize day (62 - 70s)
  // ---------------------------------------------------------------------------------------
  var s9 = scene(61.9, 70.4);
  var g9 = div(s9, 'sc');
  fade(g9, 62.2, 69.9, 0.35);
  div(g9, 'abs', '<svg width="480" height="480" viewBox="0 0 480 480" aria-hidden="true"><rect x="0" y="330" width="480" height="150" fill="#240833"/></svg>');
  var cal9 = div(g9, 'cal', '<div class="cal-top">Thursday</div><div class="cal-day">1</div><div class="cal-month">October</div>', 'left:28px;top:22px;width:112px;scale:1.2;transform-origin:0 0;rotate:-5deg');
  pop(cal9, 62.4, 1.2);
  var rib9 = div(g9, 'ribbon', 'Prize day!', 'left:34px;top:178px;font-size:26px;rotate:-4deg');
  pop(rib9, 62.9, 1.2);
  var note9 = div(g9, 'note', '<b>Off school that day?</b>Email us at<span class="email">secretary@colgrainparentcouncil.co.uk</span>', 'left:172px;top:30px;width:296px');
  pop(note9, 66.6, 1.08);
  var helper9 = kid(g9, KIDS.helper);
  helper9.root.style.scale = '1.25';
  place(helper9, 62, 320, 199);
  fade(helper9.root, 63.0, null, 0.3);
  div(g9, 'table-top', '', 'left:250px;top:318px;width:222px');
  div(g9, 'cloth', '', 'left:254px;top:332px;width:214px');
  var gifts = div(g9, 'gift', '<i></i>', 'left:268px;top:270px');
  var amy9 = kid(g9, KIDS.amy);
  amy9.root.style.scale = '1.1';
  walk(amy9, 63.2, 64.8, -140, 270, 165, 270);
  arms(amy9, 63.2, 10, -150, 0.2);
  var tkHand = goldTicket(amy9.armR, 'left:-142px;top:-29px;scale:.28;rotate:150deg');
  keys(tkHand, 'opacity', [[0, 1], [65.4, 0, 'step']]);
  var tkFly = goldTicket(g9);
  keys(tkFly, 'opacity', [[65.39, 0], [65.4, 1, 'step'], [65.9, 1], [66.0, 0, 'linear']]);
  tkAt(tkFly, 65.4, 261, 323, 0.28, 0);
  tkAt(tkFly, 65.9, 297, 291, 0.2, 10, 'inout');
  arms(helper9, 65.5, 70, -10);
  var giftFly = div(g9, 'gift', '<i></i>', 'left:0;top:0');
  keys(giftFly, 'opacity', [[66.1, 0], [66.1, 1, 'step'], [66.6, 1], [66.6, 0, 'step']]);
  keys(giftFly, 'translate', [[66.1, px(270, 262)], [66.6, px(182, 380), 'inout']]);
  keys(gifts, 'opacity', [[66.1, 1], [66.1, 0, 'step']]);
  arms(amy9, 65.6, 10, -10, 0.3);
  arms(helper9, 66.5, 10, -10);
  var giftHeld = div(amy9.hold, 'gift', '<i></i>', 'left:22px;top:108px');
  keys(giftHeld, 'opacity', [[66.6, 0], [66.6, 1, 'step']]);
  face(amy9, 66.7, 'grin');
  jump(amy9, 66.8, 34);
  jump(amy9, 67.6, 26);
  blink(amy9, [64.0, 68.6]);
  blink(helper9, [64.4, 68.1]);
  fx.burst(66.8, 20, 470, -Math.PI / 3, 0.7, 900, 60, false, false, 91);
  fx.burst(66.8, 460, 470, -Math.PI * 2 / 3, 0.7, 900, 60, false, false, 92);
  cap(62.5, 66.2, 'Bring your golden ticket into school on <b>Thursday 1 October</b>…');
  cap(66.5, 69.8, '…and swap it for your prize!');
  film.sfx(62.3, 'whoosh');
  film.sfx(62.4, 'pop', 600);
  film.sfx(62.9, 'chime');
  film.sfx(65.5, 'whoosh');
  film.sfx(66.6, 'pop', 520);
  film.sfx(66.7, 'cheer');
  film.sfx(66.8, 'boing');

  // ---------------------------------------------------------------------------------------
  // 10. Thank you (70 - 76s)
  // ---------------------------------------------------------------------------------------
  var s10 = scene(69.9, 76.1);
  var logo10 = div(s10, 'abs logo-tile', '<img src="../assets/colgrain-logo.png" alt="" width="58" height="58">', 'left:205px;top:30px');
  pop(logo10, 70.3, 1.18);
  var e10 = div(s10, 'big-title', 'Every penny raised goes to', 'top:122px;font-size:30px;color:#fef7e5;text-shadow:0 3px 0 rgba(0,0,0,.35)');
  fade(e10, 70.7);
  var n10 = div(s10, 'big-title', 'Colgrain Primary', 'top:162px;font-size:56px');
  pop(n10, 71.1, 1.15);
  var wm10 = div(s10, 'wordmark-lg', 'Wonderlicious', 'top:258px;font-size:40px');
  fade(wm10, 71.7);
  var url10 = div(s10, 'url', 'colgrainparentcouncil.co.uk/wonderlicious', 'top:314px');
  fade(url10, 72.1);
  var bar10 = div(s10, 'art-bar', '', 'left:22px;top:330px;rotate:-10deg;scale:.8');
  var bag10 = div(s10, 'art-bag', '', 'left:300px;top:352px;rotate:8deg;scale:.8');
  keys(bar10, 'translate', [[70.4, '0px 260px'], [71.0, '0px 0px', 'out']]);
  keys(bag10, 'translate', [[70.55, '0px 260px'], [71.15, '0px 0px', 'out']]);
  var hr = Kit.rng(10);
  for (var h = 0; h < 9; h++) {
    var heart = div(s10, 'heart', '', 'left:' + (40 + hr() * 400) + 'px;top:0');
    var t0 = 71.2 + h * 0.4;
    keys(heart, 'translate', [[t0, px(0, 470)], [t0 + 2.6, px((hr() - 0.5) * 60, 60), 'linear']]);
    keys(heart, 'opacity', [[t0, 0], [t0 + 0.3, 0.9], [t0 + 2.0, 0.9], [t0 + 2.6, 0, 'linear']]);
    keys(heart, 'scale', [[t0, 0.6], [t0 + 2.6, 1.2, 'linear']]);
  }
  raysOn(70.3, 76, 0.5, [240, 200]);
  fx.burst(71.1, 0, 470, -Math.PI / 3, 0.75, 1000, 70, false, false, 101);
  fx.burst(71.1, 480, 470, -Math.PI * 2 / 3, 0.75, 1000, 70, false, false, 102);
  fx.rain(71.5, 75.6, 14, 103);
  cap(70.6, 76, 'Thank you for supporting <b>Colgrain Primary</b>!');
  film.sfx(70.3, 'pop', 620);
  film.sfx(71.1, 'crash');
  film.sfx(71.1, 'chime');

  // ---------------------------------------------------------------------------------------
  // Make the animations, and hand the film to the player
  // ---------------------------------------------------------------------------------------
  tracks.forEach(function (t) { film.track(t[0], t[1], t[2]); });
  film.draw(function (t) { fx.draw(t); });

  window.FILM = {
    film: film,
    confetti: fx,
    musicFrom: 0.3,
    chapters: [
      [0, 'Wonderlicious'], [5.0, '£2.50 each'], [12.0, '79 golden tickets'], [20.0, 'Buying in school'],
      [31.0, 'Free lucky bag'], [36.4, 'Finding a ticket'], [45.0, 'Scan your ticket'], [55.0, 'The prizes'],
      [62.0, 'Prize day'], [70.0, 'Thank you']
    ]
  };
})();
