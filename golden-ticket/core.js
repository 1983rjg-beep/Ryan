/*
 * Golden Ticket: code shared by the prize page (index.html) and the prize builder (admin.html).
 *
 * How the prize list stays private
 * --------------------------------
 * prizes.js is public: anyone can open it. So it holds no readable codes or prizes.
 * Each prize is encrypted (AES-GCM) with a key made from that ticket's number and
 * reference code (PBKDF2-SHA-256). The page can open a prize only when someone types
 * the right pair, and reading the page source gives nothing away.
 *
 * This protects the surprise, not the prize. The physical golden ticket is the real
 * proof of winning: only hand a prize over in exchange for the ticket itself.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldenTicket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var FORMAT = 1;
  var ITERATIONS = 150000;
  // Characters that can't be misread on a printed ticket: no 0/O and no 1/I/L.
  var LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  var SYMBOLS = LETTERS + '23456789';
  var COLLECTION_METHODS = ['school', 'delivery', 'either'];

  var cryptoApi = root.crypto;
  var subtle = cryptoApi && cryptoApi.subtle;
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();

  function isSupported() {
    return !!(subtle && cryptoApi.getRandomValues);
  }

  // ---- Ticket numbers and reference codes -------------------------------------------------

  // Upper-case, drop spaces and dashes, and read O as 0 and I/L as 1, so a child typing
  // "k7r x4p" or "K7R-X4P" gets the same answer. Both pages use this, so it stays consistent.
  function squash(value) {
    return String(value == null ? '' : value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1');
  }

  function canonRef(value) {
    return squash(value);
  }

  // "No. 042", "#42", "042" and "42" are all ticket 42.
  function canonNumber(value) {
    var text = String(value == null ? '' : value).trim()
      .replace(/^(?:ticket\s*)?(?:no\.?|num(?:ber)?\.?|#)\s*(?=[0-9oO])/i, '');
    var s = squash(text);
    return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s;
  }

  // Six-character codes read more easily as two groups: K7RX4P -> K7R-X4P.
  function displayRef(value) {
    var s = String(value == null ? '' : value).trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(s) ? s.slice(0, 3) + '-' + s.slice(3) : s;
  }

  function randomIndex(size) {
    // Rejection sampling, so every character is equally likely.
    var limit = Math.floor(256 / size) * size;
    var byte = new Uint8Array(1);
    do { cryptoApi.getRandomValues(byte); } while (byte[0] >= limit);
    return byte[0] % size;
  }

  // Codes start with a letter so spreadsheets never mistake them for numbers or dates.
  function makeCode() {
    var code = LETTERS[randomIndex(LETTERS.length)];
    for (var i = 1; i < 6; i++) code += SYMBOLS[randomIndex(SYMBOLS.length)];
    return code;
  }

  function makeTickets(count, firstNumber) {
    var used = {};
    var tickets = [];
    for (var i = 0; i < count; i++) {
      var code;
      do { code = makeCode(); } while (used[code]);
      used[code] = true;
      tickets.push({ number: String(firstNumber + i), reference: code });
    }
    return tickets;
  }

  // ---- Encryption -------------------------------------------------------------------------

  function toBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function fromBase64(text) {
    var s = atob(text);
    var bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }

  async function ticketKey(number, reference, kdf) {
    var secret = encoder.encode('golden-ticket|' + number + '|' + reference);
    var base = await subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(kdf.salt), iterations: kdf.iterations },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function seal(record, number, reference, kdf) {
    var key = await ticketKey(number, reference, kdf);
    var iv = cryptoApi.getRandomValues(new Uint8Array(12));
    var sealed = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoder.encode(JSON.stringify(record)));
    return { iv: toBase64(iv), box: toBase64(new Uint8Array(sealed)) };
  }

  // Resolves to { status: 'ok', prize } | { status: 'no-ticket' } | { status: 'wrong-reference' }.
  async function openTicket(data, numberInput, referenceInput) {
    var number = canonNumber(numberInput);
    var entry = number && Object.prototype.hasOwnProperty.call(data.tickets, number) ? data.tickets[number] : null;
    if (!entry) return { status: 'no-ticket', number: number };
    try {
      var key = await ticketKey(number, canonRef(referenceInput), data.kdf);
      var plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(entry.iv) }, key, fromBase64(entry.box));
      return { status: 'ok', number: number, prize: JSON.parse(decoder.decode(plain)) };
    } catch (err) {
      return { status: 'wrong-reference', number: number };
    }
  }

  // tickets: [{ number, reference, prize, details, collection, emoji, donor, star }]
  async function buildPrizeFile(options) {
    var settings = options.settings || {};
    var fallback = COLLECTION_METHODS.indexOf(settings.defaultCollection) > -1 ? settings.defaultCollection : 'school';
    var kdf = {
      hash: 'SHA-256',
      iterations: options.iterations || ITERATIONS,
      salt: toBase64(cryptoApi.getRandomValues(new Uint8Array(16)))
    };
    var sealed = {};
    for (var i = 0; i < options.tickets.length; i++) {
      var t = options.tickets[i];
      var number = canonNumber(t.number);
      if (!number) throw new Error('A ticket has no number.');
      if (sealed[number]) throw new Error('Ticket ' + t.number + ' appears twice.');
      var record = {
        number: String(t.number).trim(),
        reference: displayRef(t.reference),
        prize: String(t.prize || '').trim(),
        details: String(t.details || '').trim(),
        collection: COLLECTION_METHODS.indexOf(t.collection) > -1 ? t.collection : fallback,
        emoji: String(t.emoji || '').trim(),
        donor: String(t.donor || '').trim(),
        star: !!t.star,
        example: !!t.example
      };
      sealed[number] = await seal(record, number, canonRef(t.reference), kdf);
      if (options.onProgress) options.onProgress(i + 1, options.tickets.length);
    }
    return {
      format: FORMAT,
      demo: !!options.demo,
      built: new Date().toISOString(),
      kdf: kdf,
      settings: settings,
      count: options.tickets.filter(function (t) { return !t.example; }).length,
      tickets: sealed
    };
  }

  // Opens every ticket with its own code, so a bad build is caught before anything is printed.
  async function checkPrizeFile(data, tickets, onProgress) {
    var failed = [];
    for (var i = 0; i < tickets.length; i++) {
      var result = await openTicket(data, tickets[i].number, tickets[i].reference);
      if (result.status !== 'ok' || result.prize.prize !== String(tickets[i].prize || '').trim()) {
        failed.push(tickets[i].number);
      }
      if (onProgress) onProgress(i + 1, tickets.length);
    }
    return failed;
  }

  function prizeFileSource(data) {
    var json = JSON.stringify(data, null, 1)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    return '/* Golden Ticket prize file, built with admin.html on ' + data.built.slice(0, 10) + '.\n' +
      ' * Every prize is encrypted and opens only with its own ticket number and reference code.\n' +
      ' * To change anything, rebuild this file with admin.html. Editing it by hand will break it. */\n' +
      'window.GOLDEN_TICKET_DATA = ' + json + ';\n';
  }

  // ---- Spreadsheets -----------------------------------------------------------------------

  var TEMPLATE_HEADERS = ['Ticket number', 'Reference', 'Prize', 'Details', 'Collection', 'Emoji', 'Donated by', 'Star prize', 'Given out'];

  var COLUMN_NAMES = {
    number: ['ticketnumber', 'ticketno', 'ticket', 'number', 'no', 'num'],
    reference: ['reference', 'referencecode', 'ref', 'refcode', 'code', 'winningreference'],
    prize: ['prize', 'prizename', 'prizetitle'],
    details: ['details', 'prizedetails', 'description', 'moreinfo'],
    collection: ['collection', 'collectionmethod', 'howtocollect', 'collect'],
    emoji: ['emoji', 'icon'],
    donor: ['donatedby', 'donor', 'kindlydonatedby', 'sponsor', 'sponsoredby'],
    star: ['starprize', 'star', 'topprize', 'grandprize'],
    example: ['exampleticket', 'example', 'sampleticket', 'sample']
  };

  // Matches a header such as "Collection (school / delivery / either)" to a field name.
  function columnFor(header) {
    var h = String(header == null ? '' : header).toLowerCase().replace(/[^a-z]/g, '');
    if (!h) return null;
    var best = null;
    var bestScore = 0;
    Object.keys(COLUMN_NAMES).forEach(function (field) {
      COLUMN_NAMES[field].forEach(function (alias) {
        var score = h === alias ? 1000 : (alias.length >= 5 && h.indexOf(alias) === 0 ? alias.length : 0);
        if (score > bestScore) { best = field; bestScore = score; }
      });
    });
    return best;
  }

  // Reads CSV (comma or semicolon) or rows pasted straight from Excel / Google Sheets (tabs).
  function parseTable(text) {
    text = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    var firstLine = text.split(/\r?\n/, 1)[0] || '';
    var count = function (ch) { return firstLine.split(ch).length - 1; };
    var delimiter = count('\t') > 0 ? '\t' : (count(';') > count(',') ? ';' : ',');

    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
        } else {
          field += c;
        }
      } else if (c === '"' && field === '') {
        quoted = true;
      } else if (c === delimiter) {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c !== '\r') {
        field += c;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ''; });
    });
  }

  function toCsv(rows) {
    return '\uFEFF' + rows.map(function (row) {
      return row.map(function (value) {
        var s = String(value == null ? '' : value);
        return /[",\r\n]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n') + '\r\n';
  }

  function templateCsv(tickets) {
    var rows = [TEMPLATE_HEADERS];
    (tickets || []).forEach(function (t) {
      rows.push([t.number, t.reference, '', '', '', '', '', '', '']);
    });
    return toCsv(rows);
  }

  function readCollection(value) {
    var v = String(value || '').trim().toLowerCase();
    if (!v) return '';
    if (/either|both|any|choice|choose/.test(v)) return 'either';
    if (/deliver|door|drop/.test(v)) return 'delivery';
    if (/school|collect|pick|office|class/.test(v)) return 'school';
    return null;
  }

  function readYes(value) {
    return /^\s*(y|yes|true|1|x|star|★|⭐)/i.test(String(value || ''));
  }

  // Turns a filled-in spreadsheet into tickets, plus a list of problems for the builder to show.
  // `codes` lists every usable number + reference pair, prize or not, so tickets can be printed
  // before the prizes are known.
  function readPrizeSheet(text) {
    var problems = [];
    var tickets = [];
    var codes = [];
    var addProblem = function (level, row, message) { problems.push({ level: level, row: row, message: message }); };

    if (/\uFFFD/.test(text)) {
      addProblem('warning', 0, 'Some characters (like £ signs or emoji) did not come through. In Excel, save with "CSV UTF-8" instead of plain "CSV".');
    }
    var table = parseTable(text);
    if (!table.length) {
      addProblem('error', 0, 'The spreadsheet is empty.');
      return { tickets: tickets, codes: codes, problems: problems };
    }

    var columns = {};
    table[0].forEach(function (cell, index) {
      var field = columnFor(cell);
      if (field && !(field in columns)) columns[field] = index;
    });
    if (!('number' in columns) || !('reference' in columns) || !('prize' in columns)) {
      addProblem('error', 1, 'Could not find the "Ticket number", "Reference" and "Prize" columns. Keep the first row of the spreadsheet as the column names.');
      return { tickets: tickets, codes: codes, problems: problems };
    }

    var numbersSeen = {};
    var refsSeen = {};
    for (var r = 1; r < table.length; r++) {
      var cells = table[r];
      var line = r + 1;
      var cell = function (field) {
        return field in columns ? String(cells[columns[field]] == null ? '' : cells[columns[field]]).trim() : '';
      };
      var number = cell('number');
      var reference = cell('reference');
      var prize = cell('prize');
      if (!number && !reference && !prize) continue;

      if (!number) { addProblem('error', line, 'Row ' + line + ' has no ticket number.'); continue; }
      var label = 'Ticket ' + number;
      var n = canonNumber(number);
      if (numbersSeen[n]) {
        addProblem('error', line, label + ' is listed twice (rows ' + numbersSeen[n] + ' and ' + line + ').');
        continue;
      }
      numbersSeen[n] = line;
      if (!reference) { addProblem('error', line, label + ' has no reference code.'); continue; }
      if (/^\d+(\.\d+)?e\+?\d+$/i.test(reference)) {
        addProblem('error', line, label + ': the spreadsheet turned the reference into a number (' + reference + '). Type it again from the printed ticket.');
        continue;
      }
      var ref = canonRef(reference);
      if (ref.length < 4) {
        addProblem('warning', line, label + ': the reference "' + reference + '" is very short, so it would be easy to guess.');
      }
      if (refsSeen[ref]) {
        addProblem('warning', line, label + ' has the same reference code as ticket ' + refsSeen[ref] + '. Check it is not a copy-and-paste slip.');
      } else {
        refsSeen[ref] = number;
      }
      var example = readYes(cell('example'));
      if (!example) codes.push({ number: number, reference: reference });
      if (!prize) { addProblem('error', line, label + ' has no prize yet.'); continue; }
      if (prize.length > 60) {
        addProblem('warning', line, label + ': long prize names are hard to read on a phone. Move the extra words into "Details".');
      }

      var collectionText = cell('collection');
      var collection = readCollection(collectionText);
      if (collection === null) {
        addProblem('warning', line, label + ': "' + collectionText + '" is not school, delivery or either, so the default will be used.');
        collection = '';
      }
      tickets.push({
        row: line,
        number: number,
        reference: reference,
        prize: prize,
        details: cell('details'),
        collection: collection,
        emoji: cell('emoji').slice(0, 16),
        donor: cell('donor'),
        star: readYes(cell('star')),
        example: example
      });
    }
    if (!tickets.length && !problems.some(function (p) { return p.level === 'error'; })) {
      addProblem('error', 0, 'No tickets found under the column names.');
    }
    return { tickets: tickets, codes: codes, problems: problems };
  }

  return {
    FORMAT: FORMAT,
    ITERATIONS: ITERATIONS,
    COLLECTION_METHODS: COLLECTION_METHODS,
    TEMPLATE_HEADERS: TEMPLATE_HEADERS,
    isSupported: isSupported,
    canonRef: canonRef,
    canonNumber: canonNumber,
    displayRef: displayRef,
    makeCode: makeCode,
    makeTickets: makeTickets,
    openTicket: openTicket,
    buildPrizeFile: buildPrizeFile,
    checkPrizeFile: checkPrizeFile,
    prizeFileSource: prizeFileSource,
    parseTable: parseTable,
    toCsv: toCsv,
    templateCsv: templateCsv,
    readPrizeSheet: readPrizeSheet
  };
});
