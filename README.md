# DesignJet T1200 print server

Print from an Apple Silicon Mac to an HP DesignJet T1200ps, with no HP driver
on the Mac and no file shuffling to an old Intel machine.

## The problem, and why this fixes it

macOS on Apple Silicon has no working HP DesignJet driver. The usual workaround
is to keep an old Intel Mac around, copy the file over, and print from there —
which works, but the copy is slow and it is a manual step every single time.

The thing worth noticing is that the driver was never really the point. The
T1200**ps** has an Adobe PostScript 3 interpreter built into it. It can rasterise
its own jobs. All anything else has to do is hand it PostScript over the network.

So this puts a small Linux box (a Raspberry Pi) between the Mac and the plotter:

```
  Mac mini M4                Raspberry Pi                    DesignJet T1200ps
  ───────────                ────────────                    ─────────────────
  prints a PDF   ──IPP──▶    CUPS spools it                       
  (no driver,                converts PDF ▸ PostScript  ──9100──▶  own RIP
   driverless IPP)           advertises over Bonjour              puts ink down
```

The Mac sees a normal, driverless printer discovered over Bonjour — the same
mechanism any modern network printer uses. It sends a PDF and is free again as
soon as the spool finishes, typically a few seconds. Everything slow after that
happens on the Pi and the plotter, not on your desk.

The Intel mini is no longer in the loop and can be switched off.

## Before you build anything: you may not need this

The same observation that makes the server work — the plotter rasterises its own
jobs — means the Mac can often talk to it **directly**, with no server at all:

```bash
./scripts/setup-direct-on-mac.sh <plotter-ip> 24    # run this ON the Mac
./scripts/test-print.sh A3 DesignJet
```

That costs nothing and takes five minutes. If it works, you are finished.
Failing that, the Intel mini can share its queue as-is, which removes the file
copy without new hardware.

Read [docs/do-you-need-a-server.md](docs/do-you-need-a-server.md) first — it
lays the options out cheapest-first and is honest about what the server does and
does not buy you. Build the rest of this only if you want the Mac freed up
instantly on large plots, a queue that survives the Mac sleeping, or other
devices printing without setup.

## What you need

- A Raspberry Pi (4 or 5, 2 GB+) or any always-on Linux box, on Ethernet
- The DesignJet on the same LAN, with a fixed IP
- About ten minutes

A Pi 3 works but is noticeably slower converting large PDFs. Whatever you use,
put it on wired Ethernet — pushing a 200 MB plot over Wi-Fi twice is exactly the
delay you are trying to get rid of.

## Setup

On the Pi:

```bash
git clone https://github.com/1983rjg-beep/Ryan.git designjet-server
cd designjet-server
cp config.env.example config.env
nano config.env          # set PLOTTER_IP and PLOTTER_WIDTH_IN at minimum
./bootstrap.sh
```

`bootstrap.sh` installs CUPS and Avahi, tunes them for large-format work,
probes the plotter to confirm PostScript is really there, generates a PPD for
your carriage width, creates the queue, publishes it over Bonjour, and installs
a watchdog. It is safe to re-run.

Then on the Mac: **System Settings ▸ Printers & Scanners ▸ Add Printer**. The
plotter appears under **Default**. Add it, leave the driver selection at the
suggested driverless option.

Details and the manual fallback are in [docs/macos-client.md](docs/macos-client.md).

## Checking it works

```bash
./scripts/test-print.sh          # A3 test plot: ruler, margin frame, colour bar
./scripts/test-print.sh A1       # or on a bigger sheet
```

Measure the ruler on the printed sheet. If it is not exactly 200 mm, something
in the chain is scaling the job — see
[docs/troubleshooting.md](docs/troubleshooting.md#prints-come-out-the-wrong-size).

## What's here

| Path | |
|---|---|
| `bootstrap.sh` | One-shot installer. Start here. |
| `config.env.example` | Every setting, commented. Copy to `config.env`. |
| `scripts/probe-plotter.sh` | Interrogates the plotter: ports, SNMP identity, PostScript. |
| `scripts/make-ppd.py` | Generates the CUPS PPD for a 24 in or 44 in T1200ps. |
| `scripts/add-queue.sh` | Creates/rebuilds the queue. Re-run after editing config. |
| `scripts/make-airprint-service.sh` | Writes the Avahi record that makes the Mac see it driverlessly. |
| `scripts/setup-direct-on-mac.sh` | Server-free path: run on the Mac to print straight to the plotter. |
| `scripts/test-print.sh` | Calibration plot. Runs on the server or the Mac. |
| `scripts/healthcheck.sh` | Watchdog — re-enables the queue after a plotter timeout. |
| `cups/ppd/prebuilt/` | Pre-generated PPDs, so the Mac path needs no Python. |
| `docs/do-you-need-a-server.md` | Cheapest-first options. Read before building. |
| `docs/macos-client.md` | Mac-side setup, roll printing, custom sizes. |
| `docs/troubleshooting.md` | Symptom-first fault finding. |

## Notes on design choices

**Why a PPD at all, rather than pure driverless passthrough?** The plotter is
not an IPP Everywhere device — it predates that entirely. Something has to
describe its media and margins. The PPD lives on the Pi, so the Mac still
never sees a driver.

**Why `retry-job` instead of the CUPS default?** The T1200's JetDirect card
refuses TCP connections while it is waking or busy. CUPS' default reaction is
to disable the whole queue, permanently, on the first such failure. That is the
single most common way this setup appears to "randomly stop working". The queue
policy plus the watchdog timer between them make it wait rather than give up.

**Why disable `cups-browsed`?** It discovers other CUPS servers on the LAN and
mirrors their queues locally. On a machine whose entire job is to be the print
server, that just manufactures duplicate printers in the Mac's printer list.

**A note on the PPD's margins.** It declares 5 mm unprintable border on all
sides, matching the plotter's "small margins" setting. If your plotter is set to
normal margins the printable area is smaller than the PPD claims and edge content
will clip. Make the two agree — the front panel is the easier end to change.
