#!/usr/bin/env bash
#
# Create (or rebuild) the CUPS queue that fronts the DesignJet.
#
# Idempotent: run it again after changing config.env and it will replace the
# queue in place. Existing jobs in the spool are preserved.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$HERE/config.env"

: "${PLOTTER_IP:?set PLOTTER_IP in config.env}"
PLOTTER_PORT="${PLOTTER_PORT:-9100}"
QUEUE_NAME="${QUEUE_NAME:-DesignJet-T1200}"
QUEUE_DESC="${QUEUE_DESC:-HP DesignJet T1200ps}"
QUEUE_LOCATION="${QUEUE_LOCATION:-}"
PLOTTER_WIDTH_IN="${PLOTTER_WIDTH_IN:-24}"
DEFAULT_MEDIA="${DEFAULT_MEDIA:-A1}"
DEFAULT_SOURCE="${DEFAULT_SOURCE:-Roll}"
DEFAULT_QUALITY="${DEFAULT_QUALITY:-600dpi}"
DEFAULT_COLOR="${DEFAULT_COLOR:-CMYK}"

PPD_DIR="$HERE/cups/ppd"
PPD="$PPD_DIR/HP-DesignJet-T1200ps-${PLOTTER_WIDTH_IN}in.ppd"

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }

# --- build the PPD --------------------------------------------------------
say "Generating PPD for a ${PLOTTER_WIDTH_IN}in T1200ps"
mkdir -p "$PPD_DIR"
python3 "$HERE/scripts/make-ppd.py" --width-in "$PLOTTER_WIDTH_IN" -o "$PPD"

USE_PPD="$PPD"
if command -v cupstestppd >/dev/null 2>&1; then
    if cupstestppd -q "$PPD"; then
        say "PPD passes cupstestppd"
    else
        echo "!! Generated PPD was rejected by cupstestppd:" >&2
        cupstestppd "$PPD" >&2 || true
        echo "!! Falling back to the Generic PostScript PPD bundled with CUPS." >&2
        echo "!! You lose the roll/ARCH media presets but printing still works." >&2
        USE_PPD=""
    fi
else
    say "cupstestppd not installed -- skipping PPD validation"
fi

# --- create the queue -----------------------------------------------------
DEVICE_URI="socket://${PLOTTER_IP}:${PLOTTER_PORT}"
say "Pointing queue '$QUEUE_NAME' at $DEVICE_URI"

LPADMIN_ARGS=(-p "$QUEUE_NAME" -v "$DEVICE_URI" -D "$QUEUE_DESC" -E)
[[ -n "$QUEUE_LOCATION" ]] && LPADMIN_ARGS+=(-L "$QUEUE_LOCATION")

if [[ -n "$USE_PPD" ]]; then
    LPADMIN_ARGS+=(-P "$USE_PPD")
else
    LPADMIN_ARGS+=(-m drv:///sample.drv/generic.ppd)
fi

sudo lpadmin "${LPADMIN_ARGS[@]}"

# --- queue behaviour ------------------------------------------------------
# retry-job matters: the T1200's JetDirect card drops connections when it is
# busy or waking from sleep, and the CUPS default (stop-printer) would
# silently disable the whole queue the first time that happens.
say "Setting queue policy"
sudo lpadmin -p "$QUEUE_NAME" \
    -o printer-error-policy=retry-job \
    -o printer-is-shared=true

if [[ -n "$USE_PPD" ]]; then
    say "Setting default print options"
    sudo lpadmin -p "$QUEUE_NAME" \
        -o "PageSize=${DEFAULT_MEDIA}" \
        -o "InputSlot=${DEFAULT_SOURCE}" \
        -o "Resolution=${DEFAULT_QUALITY}" \
        -o "ColorModel=${DEFAULT_COLOR}"
fi

sudo cupsenable "$QUEUE_NAME"
sudo cupsaccept "$QUEUE_NAME"

if [[ "${SET_AS_DEFAULT:-yes}" == "yes" ]]; then
    sudo lpadmin -d "$QUEUE_NAME"
fi

say "Done. Current state:"
lpstat -l -p "$QUEUE_NAME" 2>/dev/null | sed 's/^/    /' || true
echo
echo "    IPP URL for clients:  ipp://$(hostname -f 2>/dev/null || hostname).local:631/printers/${QUEUE_NAME}"
echo "    Web UI:               http://$(hostname -I | awk '{print $1}'):631/"
echo
echo "Send a test plot with:   ./scripts/test-print.sh"
