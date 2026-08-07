# Do you actually need a print server?

Probably not. Try the options in this order — the first one that works is the
one to keep. Only the last costs money.

## 0. Print straight from the Mac (try this first)

Your plotter has a PostScript interpreter in it. It does not need a driver on
the Mac; it needs something to hand it PostScript over the network. The Mac can
do that itself.

```bash
git clone https://github.com/1983rjg-beep/Ryan.git designjet
cd designjet
./scripts/setup-direct-on-mac.sh <plotter-ip> 24      # or 44
./scripts/test-print.sh A3 DesignJet
```

Or by hand, with no repo at all:

**System Settings ▸ Printers & Scanners ▸ Add Printer ▸ IP**

| Field | Value |
|---|---|
| Address | your plotter's IP |
| Protocol | **HP Jetdirect – Socket** |
| Queue | leave empty |
| Use | **Generic PostScript Printer** |

That prints today, with nothing else running. The script above does the same
thing but installs the proper PPD first, so you get A0–A4, ANSI, ARCH and roll
sizes in the print dialog instead of just Letter and A4.

**Cost:** nothing. **Downside:** the Mac does the PDF-to-PostScript conversion,
so the print dialog is busy for a few seconds to a minute on a really heavy
drawing. And Apple has been narrowing PPD support with each release, so this
path may not survive forever.

Ruling this out takes five minutes. Do it before anything else.

## 1. Use the Intel mini you already have

If the direct path fails, the Intel mini can be a print server as-is. It
already has working drivers — the slow part of your current workflow is the
*file copy*, not the printing, and sharing the queue removes exactly that.

On the Intel mini: **System Settings ▸ General ▸ Sharing ▸ Printer Sharing**,
on, and tick the DesignJet queue.

On the M4: the shared queue appears under **Add Printer ▸ Default**. Add it.
The M4 sends the job over the network; the Intel mini does the driver work.

**Cost:** nothing. **Downside:** the Intel mini has to stay powered on, and it
is doing an old machine's job with an old machine's power draw.

## 2. Any always-on Linux box

`bootstrap.sh` targets Debian, not a Pi specifically. A NAS that runs Docker, a
retired laptop, a mini PC, a home server you already have — all fine. It needs
Ethernet and to be on when you want to print.

## 3. Buy a Raspberry Pi

Only if none of the above applies. A Pi 4 or 5 with 2 GB is plenty; roughly £50
all in with a case and PSU, about 3 W idle.

## So what does the server actually buy you?

Worth being clear, because for a single Mac the honest answer is "not much":

- **The Mac is free instantly.** It hands over a PDF and stops thinking about
  it. Conversion happens on the server. Matters on very large drawings.
- **The queue survives the Mac sleeping.** Send a plot, shut the lid, walk away.
- **Everything else on the network can print too** — other Macs, an iPad, a
  Windows machine — with no per-device setup.
- **Insulation from Apple.** The server owns the PPD, so when macOS narrows
  driver support further, nothing on the Mac has to change.

If none of those matter to you, stop at option 0.
