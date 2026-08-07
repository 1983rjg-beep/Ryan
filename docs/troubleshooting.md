# Troubleshooting

Organised by what you actually see. Run everything on the Pi unless noted.

## First moves, in order

```bash
lpstat -p -d                       # is the queue idle, or stopped?
lpstat -o                          # anything stuck in the spool?
./scripts/probe-plotter.sh         # is the plotter reachable and speaking PS?
journalctl -u cups -n 100 --no-pager
```

Turn up CUPS logging while chasing something:

```bash
sudo cupsctl --debug-logging
# ... reproduce ...
sudo tail -f /var/log/cups/error_log
sudo cupsctl --no-debug-logging    # turn it off again, it is noisy
```

---

## The queue says "stopped" / jobs sit there forever

The usual one. CUPS disables a queue when the printer refuses a connection, and
does not re-enable it by itself.

```bash
cupsenable DesignJet-T1200
lpstat -p DesignJet-T1200
```

The watchdog does this for you every two minutes once the plotter answers again:

```bash
systemctl status designjet-healthcheck.timer
journalctl -t designjet-healthcheck -n 30
```

If it keeps happening, the plotter is dropping connections. Common causes:

- **Sleep.** Front panel ▸ Setup ▸ Sleep mode. Set it long, or off.
- **JetDirect card wedged.** Power-cycle the plotter properly — front panel
  off, then the switch at the back, wait 30 seconds.
- **DHCP moved it.** Confirm the plotter's IP still matches `PLOTTER_IP`, and
  give it a DHCP reservation so this stops happening.

## Nothing comes out and no error appears

Check the job actually reached the plotter:

```bash
lpstat -W completed -o | head
tail -50 /var/log/cups/page_log
```

If CUPS thinks it sent the job but nothing printed, the plotter is probably
holding it. Check its front panel and its Embedded Web Server at
`http://<PLOTTER_IP>/` — look for a job queue, a "waiting for paper" prompt, or
a media mismatch. The T1200 silently parks jobs when the loaded roll does not
match the requested size.

## Prints come out the wrong size

Run `./scripts/test-print.sh` and measure the 200 mm ruler.

**Ruler is short by a few percent** — something is scaling to fit. In order of
likelihood:

1. macOS print dialog: **Scale** is not 100%, or "Scale to fit" is ticked.
2. The custom paper size on the Mac has macOS' default margins instead of 5 mm,
   so the artwork is being shrunk to fit inside them.
3. Plotter front panel: Setup ▸ Printing preferences ▸ Paper ▸ Resize. Set to
   **Off** / **Actual size**.

**Ruler is right but content is clipped at the edges** — the margin settings
disagree. The generated PPD declares 5 mm all round. Set the plotter to match:
front panel ▸ Setup ▸ Printing preferences ▸ Paper ▸ Margins ▸ **Small**.

Or change the PPD instead — edit `MARGIN_MM` at the top of
`scripts/make-ppd.py`, then `./scripts/add-queue.sh` and re-add the printer on
the Mac so it picks up the new PPD.

## The printer does not show up on the Mac

```bash
avahi-browse -rt _ipp._tcp                 # on the Pi: are we advertising?
lpstat -p DesignJet-T1200                  # does the queue exist and is it shared?
```

```bash
dns-sd -B _ipp._tcp                        # on the Mac: does it see us?
```

If the Pi advertises but the Mac sees nothing, mDNS is not crossing your
network — common with VLANs, guest networks, and some mesh Wi-Fi. Add the queue
by URL instead; see [macos-client.md](macos-client.md#if-it-does-not-appear).

If nothing is advertised at all:

```bash
sudo systemctl status avahi-daemon
sudo ./scripts/make-airprint-service.sh
```

## Huge PDFs take minutes on the Pi

The PDF-to-PostScript conversion is the cost. Options, best first:

1. **Use a Pi 4 or 5** if you are on a Pi 3. This is mostly single-core speed.
2. **Switch the converter.** Poppler and Ghostscript have very different
   performance profiles depending on the drawing. Edit
   `*cupsPdftopsRenderer` in `scripts/make-ppd.py` — try `pdftops`
   (poppler, keeps vectors, usually faster on CAD) or `gs` (Ghostscript, more
   robust on unusual PDFs). Re-run `./scripts/add-queue.sh` after changing it.
3. **Print as PostScript from the Mac**, skipping the conversion entirely.

Remember this happens after your Mac is already free. It delays the print, not
your work.

## Spool fills the SD card

Large plots are large. Check headroom:

```bash
df -h /var/spool/cups
du -sh /var/spool/cups
```

`bootstrap.sh` sets `PreserveJobFiles No` so completed jobs are not retained.
If you are still tight, move the spool to a USB SSD — which also spares the SD
card a lot of write wear:

```bash
sudo systemctl stop cups
sudo rsync -a /var/spool/cups/ /mnt/ssd/cups-spool/
sudo mv /var/spool/cups /var/spool/cups.old
sudo ln -s /mnt/ssd/cups-spool /var/spool/cups
sudo systemctl start cups
```

## Colours look wrong

The plotter is doing its own colour management here, so the controls are on the
plotter, not the Pi. Front panel ▸ Setup ▸ Printing preferences ▸ Colour.

Confirm the paper type set on the plotter matches what is actually loaded —
this affects ink limits more than any software setting. Then run a printhead
alignment and colour calibration from the front panel; on a machine of this age
that fixes most complaints.

## No PostScript on board

If `probe-plotter.sh` finds no PostScript and the front panel
(Setup ▸ Information) does not list it, you have a base T1200 rather than a
T1200ps, and this whole approach does not apply — the plotter cannot rasterise
its own jobs, so the Pi has to produce HP-GL/2 instead.

That is a different build: CUPS with HPLIP or a Foomatic HP-GL/2 driver in place
of the PostScript PPD, and it needs testing against the actual machine. Say the
word and it can be added here.

Worth ruling out first: the PostScript upgrade on these was sometimes a licence
rather than hardware, so check the plotter's Embedded Web Server at
`http://<PLOTTER_IP>/` under Setup ▸ Firmware/upgrades before concluding it is
absent.
