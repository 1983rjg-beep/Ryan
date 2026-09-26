# Wonderlicious golden ticket page

Colgrain Parent Council's prize page for the Wonderlicious golden ticket event. Winners type in
their name, ticket number and reference code, and say whether they found the ticket in a
chocolate bar or a Magic Mix bag. Their Wonderlicious bar or bag then drops in, tears open and a
golden ticket rises out, followed by a 3-2-1 countdown, confetti and a fanfare. That takes 10
seconds, and then they see their prize and how to collect it.

It is a handful of plain files: no server, no database, and nothing to pay for.

## What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | The prize page winners use. |
| `core.js` | Code the prize page and the builder share. |
| `prizes.js` | The prize list, scrambled. **The one here is a demo** with four made-up prizes. |
| `assets/` | The bar and bag artwork, the Parent Council logo and the fonts. |
| `admin.html` | The prize builder. Use it on your own computer. You don't need to upload it. |
| `vendor/qrcode.js` | Draws the QR codes on printed tickets ([MIT licence](https://github.com/kazuhikoarase/qrcode-generator)). |
| `tests/` | Automated checks, for whoever maintains this. |

## Try it now

Double-click `index.html` to open it in your browser. The demo buttons fill in a sample ticket
so you can watch the reveal.

## Setting up the prizes

Do this **before** the tickets go into the bars and bags.

1. **Open `admin.html`** (double-click it). Colgrain's details are already filled in; check
   them, especially the claim-by date.
2. **Step 2: ticket codes.** Press *Make codes* (75 tickets), then *Download the spreadsheet*.
   Keep two copies somewhere private. It is the only record of which code belongs to which
   ticket.
3. **Step 3: add the prizes.** Type a prize next to every ticket in the spreadsheet, save it as
   CSV (Excel: *File › Save As › CSV UTF-8*; Google Sheets: *File › Download › CSV*) and load it
   back in. The builder lists anything missing, row by row.
4. **Print the tickets** (step 2). See *Printing on gold paper* below.
5. **Step 5: build.** Press *Build prizes.js*, then *Download prizes.js*.

The spreadsheet has a *Given out* column for you: tick off each prize as you hand it over.

## Printing on gold paper

The tickets print 10 to an A4 sheet, each 9 × 5 cm, so 75 tickets take 8 sheets.

- Leave *Print a gold background* **off**: the paper is already gold. The ink is Wonderlicious
  purple, with a black QR code.
- Print at 100% scale (*Actual size*, not *Fit to page*). Many laser printers need thick or
  glossy paper fed through the manual tray, with the paper type set to match.
- **Print one test sheet on plain paper, then one on gold.** On the gold sheet, check that the
  toner has stuck (rub it with a thumb) and that a phone camera reads the QR codes under
  normal room light. Shiny paper can cause glare. If a code won't scan, the ticket number,
  reference and web address are printed too.
- Cut along the dashed lines.

## Putting it online (one.com)

The page must be on an `https://` address. one.com includes a free SSL certificate and turns
on `https://` automatically when your domain uses one.com's name servers. The page moves anyone
who types `http://` over to `https://` by itself.

1. Log in to one.com and open **Hosting settings › File Manager**.
2. In the top folder (the one holding your site's own files), create a folder called
   `wonderlicious`.
3. Upload into it: `index.html`, `core.js`, your built `prizes.js` and the whole `assets`
   folder. Don't upload `admin.html` or the spreadsheet.
4. Visit `https://colgrainparentcouncil.co.uk/wonderlicious/` and check three real tickets.

**Keep that address working until the last prize is claimed.** Every printed ticket points at
it. If the website is rebuilt, keep the `wonderlicious` folder exactly as it is.

## Rules that save arguments later

- **The ticket is the proof, not the website.** The page shows what a code has won; it can't
  know whether a prize has already been handed over. Only give out a prize in exchange for the
  physical golden ticket, and tick it off.
- **Never make new codes after printing.** New codes won't match the printed tickets.
- **Never upload the spreadsheet** or share it in a group chat.
- **If a code "doesn't work"**, look the ticket up in your spreadsheet. The page already treats
  O and 0, and I, L and 1, as the same, and ignores spaces, dashes and capitals.

## Changing something later

Fix the prize or wording in your spreadsheet or in the builder, build again, and upload the new
`prizes.js`. The codes don't change, so printed tickets keep working.

## Privacy

Nothing typed into the prize page is sent anywhere: a winner's name stays on their own phone.
The page loads nothing from other websites. Emails about prizes reach the Parent Council as
ordinary emails from parents.

## How the prize list stays secret

`prizes.js` is public: anyone can open it. So every prize in it is encrypted (AES-GCM) with a
key made from that ticket's number and reference code (PBKDF2, 150,000 rounds). Reading the page
source reveals neither the codes nor who won what, and guessing a code means trying hundreds of
millions of combinations, each deliberately slow. That protects the surprise. The physical
ticket protects the prize.

## For developers

- Unit tests (Node 18+): `node --test golden-ticket/tests/*.test.js`
- The animation timeline is `fullSequence()` in `index.html`; `REVEAL_MS` sets the 10 seconds.
  `ITEMS` sets where the bar and the bag sit in the scene. Every sound is synthesised with the
  Web Audio API, so there are no audio files.
- People whose devices ask to reduce motion get a calm 3-second version with no shaking,
  flashing or confetti. Repeat views of the same ticket get a Skip button; Escape also skips.
- Printed QR codes open `index.html#t=<number>&r=<code>`, which fills in the form and then
  clears the address bar.
- Fonts are served from `assets/fonts` (licences in `assets/fonts/LICENSE.md`).
