#!/usr/bin/env bash
#
# Set up the Mac to print STRAIGHT to the plotter. No print server involved.
#
# Run this ON THE MAC MINI M4, not on a Pi:
#
#     ./scripts/setup-direct-on-mac.sh 192.168.1.50 24
#
# It installs the PPD and creates the queue. Try this before building any
# server -- if it works, you are done and you need no extra hardware.
#
# Needs no Python and no Homebrew: it copies a pre-generated PPD from the
# repo. macOS ships everything else (CUPS, lpadmin) already.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PLOTTER_IP="${1:-}"
WIDTH_IN="${2:-24}"
QUEUE_NAME="${3:-DesignJet}"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die()  { printf '\033[31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[[ -n "$PLOTTER_IP" ]] || die "usage: $0 <plotter-ip> [24|44] [queue-name]"
[[ "$WIDTH_IN" == "24" || "$WIDTH_IN" == "44" ]] || die "width must be 24 or 44"
[[ "$(uname -s)" == "Darwin" ]] || die "Run this on the Mac. For the Pi, use ./bootstrap.sh instead."

SRC="$HERE/cups/ppd/prebuilt/HP-DesignJet-T1200ps-${WIDTH_IN}in.ppd"
[[ -f "$SRC" ]] || die "missing $SRC"

# --- is the plotter actually there? ---------------------------------------
say "Checking the plotter answers on ${PLOTTER_IP}:9100"
if nc -z -w 4 "$PLOTTER_IP" 9100 2>/dev/null; then
    echo "    reachable"
else
    die "Nothing listening on ${PLOTTER_IP}:9100.
      Check the plotter's front panel:
        Setup > Connectivity > Gigabit Ethernet   (confirm the IP)
        Setup > Connectivity > Advanced           (raw TCP/IP enabled)"
fi

# --- install the PPD -------------------------------------------------------
DEST="/Library/Printers/PPDs/Contents/Resources"
say "Installing the PPD into $DEST (needs your password)"
sudo mkdir -p "$DEST"
sudo cp "$SRC" "$DEST/"
sudo chmod 644 "$DEST/$(basename "$SRC")"

# --- create the queue ------------------------------------------------------
say "Creating the '$QUEUE_NAME' queue pointing at socket://${PLOTTER_IP}:9100"
sudo lpadmin -p "$QUEUE_NAME" -E \
    -v "socket://${PLOTTER_IP}:9100" \
    -P "$DEST/$(basename "$SRC")" \
    -D "HP DesignJet T1200ps" \
    -o printer-error-policy=retry-job \
    -o printer-is-shared=false \
    -o PageSize=A1 \
    -o InputSlot=Roll \
    -o Resolution=600dpi

sudo cupsenable "$QUEUE_NAME"
sudo cupsaccept "$QUEUE_NAME"

say "Done"
lpstat -l -p "$QUEUE_NAME" 2>/dev/null | sed 's/^/    /' || true

cat <<EOM

The plotter is now in System Settings > Printers & Scanners as "$QUEUE_NAME".

Send a test plot:

    ./scripts/test-print.sh A3

Measure the 200 mm ruler on the printed sheet. If it is exactly 200 mm, you
are finished -- no print server, no Intel mini, nothing else to buy.

If this path does not work out, or you want the Mac freed up faster on very
large plots, build the Pi server instead: see README.md.
EOM
