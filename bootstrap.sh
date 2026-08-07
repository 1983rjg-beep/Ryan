#!/usr/bin/env bash
#
# One-shot setup for the DesignJet print server.
#
#   sudo apt update && ./bootstrap.sh
#
# Target: Raspberry Pi OS (Bookworm/Trixie) or any Debian/Ubuntu box.
# Safe to re-run -- every step is idempotent.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARK_BEGIN="# >>> designjet-print-server >>>"
MARK_END="# <<< designjet-print-server <<<"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\033[31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f "$HERE/config.env" ]] || {
    cp "$HERE/config.env.example" "$HERE/config.env"
    die "Created config.env from the example. Edit it (at minimum PLOTTER_IP) and re-run."
}
# shellcheck source=/dev/null
source "$HERE/config.env"
: "${PLOTTER_IP:?PLOTTER_IP is not set in config.env}"

command -v apt-get >/dev/null || die "This installer expects Debian/Ubuntu/Raspberry Pi OS."
[[ $EUID -eq 0 ]] && die "Run as your normal user, not root -- the script calls sudo where needed."

# --- packages -------------------------------------------------------------
say "Installing packages"
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
    cups cups-client cups-ppdc cups-filters cups-ipp-utils \
    ghostscript poppler-utils \
    avahi-daemon avahi-utils \
    python3 netcat-openbsd snmp curl

# cups-browsed hunts for other CUPS servers on the LAN and creates duplicate
# local queues for them. On a machine whose whole job is to *be* the print
# server that just produces phantom printers on your Mac.
if systemctl list-unit-files | grep -q '^cups-browsed'; then
    say "Disabling cups-browsed (it creates duplicate phantom queues)"
    sudo systemctl disable --now cups-browsed 2>/dev/null || true
fi

# --- cupsd tuning ---------------------------------------------------------
say "Configuring cupsd"

# Listen on the LAN and share queues. cupsctl is the supported way to do this;
# hand-editing Listen/Location blocks tends to get clobbered on upgrade.
sudo cupsctl --remote-admin --remote-any --share-printers

CUPSD=/etc/cups/cupsd.conf
sudo cp -n "$CUPSD" "$CUPSD.orig-$(date +%Y%m%d)" 2>/dev/null || true

# Replace our managed block rather than appending a new one each run.
sudo python3 - "$CUPSD" "$MARK_BEGIN" "$MARK_END" <<'PY'
import re, sys
path, begin, end = sys.argv[1], sys.argv[2], sys.argv[3]
body = f"""{begin}
# Plots are big. Do not cap the upload size.
MaxRequestSize 0
# Keep more history than the default so a failed 3-hour plot is still
# diagnosable the next morning.
MaxJobs 200
PreserveJobHistory Yes
PreserveJobFiles No
# Pairs with 'printer-error-policy=retry-job' on the queue: the T1200's
# JetDirect card refuses connections while it is waking or busy, and without
# these a job would fail instead of waiting its turn.
JobRetryInterval 30
JobRetryLimit 20
{end}"""
src = open(path).read()
pat = re.compile(re.escape(begin) + r".*?" + re.escape(end), re.S)
src = pat.sub(body, src) if pat.search(src) else src.rstrip() + "\n\n" + body + "\n"
open(path, "w").write(src)
PY

# --- permissions ----------------------------------------------------------
say "Granting $USER printer-admin rights"
sudo usermod -aG lpadmin "$USER"
info "(you may need to log out and back in for group membership to take effect)"

sudo systemctl enable --now cups avahi-daemon
sudo systemctl restart cups

# --- firewall -------------------------------------------------------------
if command -v ufw >/dev/null && sudo ufw status 2>/dev/null | grep -q '^Status: active'; then
    say "Opening firewall ports (ufw is active)"
    sudo ufw allow 631/tcp  comment 'CUPS/IPP'   >/dev/null
    sudo ufw allow 5353/udp comment 'mDNS/Bonjour' >/dev/null
fi

# --- plotter ---------------------------------------------------------------
say "Probing the plotter at $PLOTTER_IP"
if ! "$HERE/scripts/probe-plotter.sh"; then
    info "Probe was not fully conclusive -- see the notes above."
    read -r -p "    Continue and build the queue anyway? [Y/n] " reply
    [[ "${reply:-Y}" =~ ^[Yy]?$ ]] || die "Stopped at your request."
fi

say "Creating the print queue"
"$HERE/scripts/add-queue.sh"

say "Publishing over Bonjour"
"$HERE/scripts/make-airprint-service.sh"

# --- watchdog --------------------------------------------------------------
say "Installing the queue watchdog"
sudo install -m 755 "$HERE/scripts/healthcheck.sh" /usr/local/bin/designjet-healthcheck
sudo install -m 644 "$HERE/systemd/designjet-healthcheck.service" /etc/systemd/system/
sudo install -m 644 "$HERE/systemd/designjet-healthcheck.timer"   /etc/systemd/system/
sudo mkdir -p /etc/designjet
sudo install -m 644 "$HERE/config.env" /etc/designjet/config.env
sudo systemctl daemon-reload
sudo systemctl enable --now designjet-healthcheck.timer

# --- done ------------------------------------------------------------------
IP_ADDR="$(hostname -I | awk '{print $1}')"
HOSTNAME_SHORT="$(hostname -s)"

cat <<EOM

$(printf '\033[1m%s\033[0m' "Print server is up.")

    Queue        ${QUEUE_NAME:-DesignJet-T1200}
    Plotter      ${PLOTTER_IP}:${PLOTTER_PORT:-9100}  (raw TCP / JetDirect)
    Web UI       http://${IP_ADDR}:631/
    IPP URL      ipp://${HOSTNAME_SHORT}.local:631/printers/${QUEUE_NAME:-DesignJet-T1200}

Next, on the Mac mini M4:

    System Settings > Printers & Scanners > Add Printer
    The plotter should be listed under "Default". Pick it, leave
    "Use" set to the suggested driverless option, and click Add.

    If it does not appear, run this in Terminal on the Mac instead:

        lpadmin -p DesignJet -E \\
          -v ipp://${HOSTNAME_SHORT}.local:631/printers/${QUEUE_NAME:-DesignJet-T1200} \\
          -m everywhere -o printer-is-shared=false

Then send a test plot from here with:

    ./scripts/test-print.sh

EOM
