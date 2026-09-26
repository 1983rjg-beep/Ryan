// Run with:  node --test golden-ticket/tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const GT = require('../core.js');

const FAST = 1000; // PBKDF2 iterations for tests only; real files use GT.ITERATIONS.

const sample = [
  { number: '1', reference: 'K7RX4P', prize: 'Family cinema trip', details: 'Four tickets', collection: 'school', emoji: '🎬', donor: 'The Picture House', star: true },
  { number: '2', reference: 'M8RZQ3', prize: 'Chocolate hamper', collection: 'delivery' },
  { number: '3', reference: 'B2N7HW', prize: 'Pizza for four', collection: '' }
];

test('ticket numbers are read the way people type them', () => {
  for (const typed of ['42', '042', ' 42 ', '#42', 'No. 042', 'no42', 'Ticket no. 42', 'o42']) {
    assert.equal(GT.canonNumber(typed), '42', typed);
  }
  assert.equal(GT.canonNumber('0'), '0');
  assert.equal(GT.canonNumber(''), '');
});

test('reference codes ignore case, spaces, dashes and O/0, I/L/1 mix-ups', () => {
  assert.equal(GT.canonRef('k7r-x4p'), 'K7RX4P');
  assert.equal(GT.canonRef(' K7R X4P '), 'K7RX4P');
  assert.equal(GT.canonRef('BOX'), GT.canonRef('B0X'));
  assert.equal(GT.canonRef('lil'), '111');
  assert.equal(GT.displayRef('k7rx4p'), 'K7R-X4P');
  assert.equal(GT.displayRef('GOLD-2026'), 'GOLD-2026');
});

test('generated codes are unique, unambiguous and start with a letter', () => {
  const tickets = GT.makeTickets(300, 1);
  assert.equal(tickets.length, 300);
  assert.equal(tickets[0].number, '1');
  assert.equal(tickets[299].number, '300');
  assert.equal(new Set(tickets.map((t) => t.reference)).size, 300);
  for (const t of tickets) {
    assert.match(t.reference, /^[A-HJKMNP-Z][A-HJKMNP-Z2-9]{5}$/);
  }
});

test('a built prize file opens only with the right number and code', async () => {
  const data = await GT.buildPrizeFile({ tickets: sample, settings: { defaultCollection: 'either' }, iterations: FAST });
  assert.equal(data.count, 3);
  assert.deepEqual(Object.keys(data.tickets).sort(), ['1', '2', '3']);

  const raw = JSON.stringify(data);
  assert.ok(!raw.includes('K7RX4P'), 'codes must not appear in the file');
  assert.ok(!raw.includes('cinema'), 'prizes must not appear in the file');

  const ok = await GT.openTicket(data, 'No. 01', 'k7r x4p');
  assert.equal(ok.status, 'ok');
  assert.equal(ok.prize.prize, 'Family cinema trip');
  assert.equal(ok.prize.reference, 'K7R-X4P');
  assert.equal(ok.prize.star, true);
  assert.equal(ok.prize.emoji, '🎬');

  assert.equal((await GT.openTicket(data, '3', 'B2N7HW')).prize.collection, 'either', 'blank collection uses the default');
  assert.equal((await GT.openTicket(data, '1', 'K7RX4Q')).status, 'wrong-reference');
  assert.equal((await GT.openTicket(data, '2', 'K7RX4P')).status, 'wrong-reference', 'codes are tied to their own ticket');
  assert.equal((await GT.openTicket(data, '99', 'K7RX4P')).status, 'no-ticket');
  assert.equal((await GT.openTicket(data, '', '')).status, 'no-ticket');
  assert.deepEqual(await GT.checkPrizeFile(data, sample), []);
});

test('building refuses duplicate ticket numbers', async () => {
  const dupes = [sample[0], { ...sample[1], number: '001' }];
  await assert.rejects(GT.buildPrizeFile({ tickets: dupes, iterations: FAST }), /appears twice/);
});

test('the saved prizes.js loads back to the same data', async () => {
  const data = await GT.buildPrizeFile({ tickets: sample, settings: { schoolName: 'Test \u2028 School' }, iterations: FAST });
  const sandbox = { window: {} };
  vm.runInNewContext(GT.prizeFileSource(data), sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.GOLDEN_TICKET_DATA)), JSON.parse(JSON.stringify(data)));
});

test('tables are read from CSV, semicolon CSV and pasted spreadsheet rows', () => {
  const csv = '\uFEFFTicket number,Reference,Prize\r\n1,K7RX4P,"Tea for two, with cake"\r\n2,M8RZQ3,"Say ""cheese""\nphoto"\r\n';
  assert.deepEqual(GT.parseTable(csv), [
    ['Ticket number', 'Reference', 'Prize'],
    ['1', 'K7RX4P', 'Tea for two, with cake'],
    ['2', 'M8RZQ3', 'Say "cheese"\nphoto']
  ]);
  assert.deepEqual(GT.parseTable('Ticket number;Reference;Prize\n1;K7RX4P;Kite\n\n'), [
    ['Ticket number', 'Reference', 'Prize'],
    ['1', 'K7RX4P', 'Kite']
  ]);
  assert.deepEqual(GT.parseTable('Ticket number\tReference\tPrize\n1\tK7RX4P\tKite, red'), [
    ['Ticket number', 'Reference', 'Prize'],
    ['1', 'K7RX4P', 'Kite, red']
  ]);
});

test('the template spreadsheet round-trips once prizes are filled in', () => {
  const tickets = GT.makeTickets(3, 1);
  const rows = GT.parseTable(GT.templateCsv(tickets));
  assert.deepEqual(rows[0], GT.TEMPLATE_HEADERS);
  rows[1][2] = 'Kite';
  rows[2][2] = 'Board game';
  rows[2][4] = 'Delivery please';
  rows[2][7] = 'yes';
  rows[3][2] = 'Book token';
  rows[3][4] = 'Either';
  const sheet = GT.readPrizeSheet(GT.toCsv(rows));
  assert.deepEqual(sheet.problems, []);
  assert.equal(sheet.tickets.length, 3);
  assert.equal(sheet.tickets[0].reference, tickets[0].reference);
  assert.equal(sheet.tickets[1].collection, 'delivery');
  assert.equal(sheet.tickets[1].star, true);
  assert.equal(sheet.tickets[2].collection, 'either');
  assert.equal(sheet.tickets[0].collection, '');
});

test('spreadsheet problems are reported against the right rows', () => {
  const text = [
    'No.,Ref,Prize name,Collection (school / delivery / either),Notes',
    '1,K7RX4P,Kite,school,',
    '01,M8RZQ3,Duplicate,school,',
    '2,,No code,school,',
    '3,1.23E+45,Mangled,school,',
    '4,B2N7HW,,school,',
    '5,AB,Short code,by owl,',
    ',,,,just a note'
  ].join('\n');
  const sheet = GT.readPrizeSheet(text);
  const byRow = (row) => sheet.problems.filter((p) => p.row === row).map((p) => p.level);
  assert.deepEqual(byRow(3), ['error'], 'duplicate number');
  assert.deepEqual(byRow(4), ['error'], 'missing code');
  assert.deepEqual(byRow(5), ['error'], 'Excel turned the code into a number');
  assert.deepEqual(byRow(6), ['error'], 'missing prize');
  assert.deepEqual(byRow(7), ['warning', 'warning'], 'short code and unknown collection');
  assert.deepEqual(sheet.tickets.map((t) => t.number), ['1', '5']);
  assert.equal(sheet.tickets[1].collection, '');
  assert.deepEqual(sheet.codes.map((t) => t.number), ['1', '4', '5'], 'a ticket with no prize yet can still be printed');
});

test('a sheet without the key columns explains what is missing', () => {
  const sheet = GT.readPrizeSheet('Name,Colour\nKite,Red');
  assert.equal(sheet.tickets.length, 0);
  assert.match(sheet.problems[0].message, /Ticket number/);
});
