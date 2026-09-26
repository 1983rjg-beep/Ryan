# Golden Ticket prize page

A page for the school website where golden ticket winners type in their name, ticket
number and reference code. They watch a 10-second reveal (the chocolate bar drops in, the
wrapper tears off, the ticket rises out, 3-2-1, confetti and a fanfare) and then see their
prize and how to collect it: from school, delivered locally, or their choice.

It runs as three plain files, needs no server or database, and costs nothing to host.

## What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | The prize page winners use. |
| `core.js` | Code the prize page and the builder share. |
| `prizes.js` | Your prize list, scrambled. **The one here is a demo** with four made-up prizes. |
| `admin.html` | The prize builder. Use it on your own computer. You don't need to upload it. |
| `vendor/qrcode.js` | Draws the QR codes on printed tickets ([MIT licence](https://github.com/kazuhikoarase/qrcode-generator)). |
| `tests/` | Automated checks, for whoever maintains this. |

## Try it now

Double-click `index.html` to open it in your browser. The green demo bar at the top fills in a
sample ticket for you, so you can see the reveal and each way of collecting a prize.

## Setting it up for your sale

Allow about half an hour, and do it **before** the tickets go into the bars.

1. **Open `admin.html`** (double-click it) in Chrome, Edge, Firefox or Safari.
2. **Step 1: about your sale.** School name, who's organising, a contact email, and the web
   address where the prize page will live (see *Putting it online*). The address is only
   needed for the QR codes.
3. **Step 2: ticket codes.** Choose how many golden tickets (75), press *Make codes*, then
   *Download the spreadsheet*. Keep two copies somewhere private. This spreadsheet is the only
   record of which code belongs to which ticket.
4. **Print the tickets** from the same step: 10 per A4 page, each with its number, reference
   code and a QR code. Print at 100% scale with *Background graphics* switched on, or untick
   the gold background and print on gold card. Cut along the dashed lines.
5. **Step 3: add the prizes.** Open the spreadsheet in Excel, Numbers or Google Sheets and type
   a prize next to every ticket. Save it as CSV (Excel: *File › Save As › CSV UTF-8*; Google
   Sheets: *File › Download › CSV*) and load it back in. The builder tells you about anything
   missing, row by row.
6. **Step 4: how winners get their prizes.** Write what collecting from school looks like, and
   how delivery works.
7. **Step 5: build.** Press *Build prizes.js*, then *Download prizes.js*.
8. **Upload** `index.html`, `core.js` and your new `prizes.js` together.
9. **Test before the tickets go into the bars.** Scan three printed tickets with a phone and
   check each one shows the right prize.

The spreadsheet has a *Given out* column for you: tick off each prize as you hand it over.

## Putting it online (one.com)

The page needs `index.html`, `core.js` and `prizes.js` together in one folder, on an
`https://` address. one.com includes a free SSL certificate and turns on `https://`
automatically when your domain uses one.com's name servers. The page moves anyone who
types `http://` over to `https://` by itself.

1. Log in to one.com and open **Hosting settings › File Manager**.
2. In the top folder (the one holding your site's own files), create a folder called
   `golden-ticket`.
3. Open it and upload `index.html`, `core.js` and your built `prizes.js`. Don't upload
   `admin.html` or the spreadsheet.
4. Visit `https://yourdomain/golden-ticket/` and check a ticket.
5. Put that address into step 1 of the builder **before printing**, so the QR codes point at it.

**Keep that address working until the last prize is delivered.** Every printed ticket points
at it. If the website is rebuilt, moved to another platform, or its web space is cleared
before then, the links on the tickets break. Either carry the `golden-ticket` folder across
unchanged, or do the rebuild after the last delivery.

If you ever host it somewhere that can't take files (Wix, Squarespace, Google Sites), make a
free Netlify account, drag a folder holding just the three files onto *Netlify Drop*, and
link to the address it gives you.

Shorter addresses make QR codes that scan more easily.

## Rules that save arguments later

- **The ticket is the proof, not the website.** The page shows what a code has won; it can't
  know whether a prize has already been handed over. Only give out a prize in exchange for
  the physical golden ticket, including on the doorstep for deliveries, and tick it off.
- **Never make new codes after printing.** New codes won't match the printed tickets.
- **Never upload the spreadsheet** or share it in a group chat.
- **If a code "doesn't work"**, look the ticket up in your spreadsheet. The page already treats
  O and 0, and I, L and 1, as the same, and ignores spaces, dashes and capitals.

## Changing something later

Fix the prize or wording in your spreadsheet or in the builder, build again, and upload the
new `prizes.js`. The codes don't change, so printed tickets keep working. The builder
remembers your step 1 and step 4 answers on this computer.

## Privacy

Nothing typed into the prize page is sent anywhere: a winner's name stays on their own phone.
Delivery requests reach you as ordinary emails from parents.

## How the prize list stays secret

`prizes.js` is public: anyone can open it. So every prize in it is encrypted (AES-GCM) with a
key made from that ticket's number and reference code (PBKDF2, 150,000 rounds). Reading the
page source reveals neither the codes nor who won what, and guessing a code means trying
hundreds of millions of combinations, each deliberately slow. That protects the surprise.
The physical ticket protects the prize.

## For developers

- Unit tests (Node 18+): `node --test golden-ticket/tests/*.test.js`
- The animation timeline is `fullSequence()` in `index.html`; `REVEAL_MS` sets the 10 seconds.
  Every sound is synthesised with the Web Audio API, so there are no audio files.
- People who have asked their device to reduce motion get a calm 3-second version with no
  shaking, flashing or confetti. Repeat views of the same ticket get a Skip button; Escape
  also skips.
- Printed QR codes open `index.html#t=<number>&r=<code>`, which fills in the form and then
  clears the address bar.
