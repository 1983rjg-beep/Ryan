# Setting up the Mac mini M4

You do not install any HP software. The Mac talks to the Pi over IPP, and the
Pi deals with the plotter.

## The normal way

**System Settings ▸ Printers & Scanners ▸ Add Printer…**

Under the **Default** tab you should see something like:

```
HP DesignJet T1200ps @ raspberrypi          Bonjour Multifunction
```

Select it. In the **Use** dropdown macOS will suggest a driverless option —
one of *Generic PostScript Printer*, *AirPrint*, or *Secure AirPrint*, depending
on your macOS version. Any of those is correct; leave it alone. Click **Add**.

That is the whole client setup.

## If it does not appear

Bonjour discovery across VLANs or through some mesh Wi-Fi kit does not work.
Add the queue explicitly instead. In Terminal on the Mac:

```bash
lpadmin -p DesignJet -E \
  -v ipp://raspberrypi.local:631/printers/DesignJet-T1200 \
  -m everywhere \
  -o printer-is-shared=false
```

Substitute your Pi's hostname and your `QUEUE_NAME`. If `.local` resolution
fails, use the Pi's IP address instead.

`-m everywhere` is the important part: it tells macOS to ask the server what it
supports rather than looking for a driver.

Check it landed:

```bash
lpstat -p DesignJet -l
lpoptions -p DesignJet -l | head
```

## Printing

Print normally. A few things worth knowing:

**Paper size.** The print dialog's paper size list comes from the Pi's PPD, so
you get A0–A4, ANSI, ARCH and roll widths. Pick the one matching what is loaded.

**Roll work and long drawings.** For a drawing whose length is not a standard
size, use **Manage Custom Sizes…** at the bottom of the Paper Size dropdown.
Set the width to your roll width and the height to whatever the drawing needs.
Set all four margins to **5 mm** — if you leave the macOS defaults, macOS shrinks
the artwork to fit inside margins the plotter is already accounting for, and you
get a small drawing floating in the middle of a large sheet.

**Scale.** Leave scaling at 100%. "Scale to fit" is the usual culprit when a
1:100 site plan comes out at 1:103.

**Which app.** Anything that prints. From Preview or Acrobat, prefer **Send as
PostScript** if the option exists — it skips one conversion. It is a minor win;
the PDF path is fine.

## Speed

The Mac's job is finished once the spool transfer completes. On Ethernet that is
a few seconds even for a large drawing. What used to be "copy the file, walk
over, print from the Intel mini" is now just the print dialog.

The Pi then spends some seconds to a couple of minutes converting PDF to
PostScript, depending on the drawing's complexity, and streams it out. You do
not wait for that. Track it if you want:

```bash
lpstat -o                      # on the Mac, or on the Pi
```

## Removing the old workflow

Once you have printed successfully a few times, delete the old queue on the
Intel mini so nobody prints to it by habit, and take the Intel mini out of
service:

```bash
# on the Intel mini
lpstat -p                      # find the old queue name
lpadmin -x <old-queue-name>
```
