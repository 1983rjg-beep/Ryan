#!/usr/bin/env bash
#
# Interrogate the DesignJet over the network before we build a queue around it.
# Answers three questions:
#   1. Is it reachable, and is the JetDirect port actually listening?
#   2. Does it really have the PostScript interpreter (T1200ps vs base T1200)?
#   3. What does it call itself, so we can sanity-check the model?
#
# Safe to run any time -- it sends one tiny PostScript query job and reads the
# reply back off the same socket. Nothing is printed on paper.
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
[[ -f "$HERE/config.env" ]] && source "$HERE/config.env"

IP="${1:-${PLOTTER_IP:-}}"
PORT="${PLOTTER_PORT:-9100}"

if [[ -z "$IP" ]]; then
    echo "usage: $0 <plotter-ip>   (or set PLOTTER_IP in config.env)" >&2
    exit 2
fi

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m[ ok ]\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m[warn]\033[0m %s\n' "$*"; }
fail()  { printf '  \033[31m[fail]\033[0m %s\n' "$*"; }

need_nc() {
    command -v nc >/dev/null || {
        fail "netcat is not installed (apt install netcat-openbsd)"; exit 1; }
}

bold "DesignJet probe -> $IP"

# --- 1. reachability ------------------------------------------------------
if ping -c 2 -W 2 "$IP" >/dev/null 2>&1; then
    ok "host responds to ping"
else
    warn "no ping response (some DesignJets have ICMP disabled -- continuing)"
fi

need_nc
declare -A PORTS=(
    [9100]="JetDirect / raw print (this is the one that matters)"
    [631]="IPP"
    [80]="Embedded Web Server"
    [443]="Embedded Web Server (TLS)"
    [161]="SNMP"
)
OPEN_9100=0
for p in 9100 631 80 443 161; do
    if nc -z -w 3 "$IP" "$p" 2>/dev/null; then
        ok "port $p open  -- ${PORTS[$p]}"
        [[ "$p" == "9100" ]] && OPEN_9100=1
    else
        warn "port $p closed/filtered -- ${PORTS[$p]}"
    fi
done

if [[ "$OPEN_9100" -eq 0 ]]; then
    fail "port 9100 is not reachable. Check the plotter's front panel:"
    echo "        Setup > Connectivity > Advanced > Enable raw TCP/IP (JetDirect)"
    echo "      and confirm its IP under Setup > Connectivity > Gigabit Ethernet."
    exit 1
fi

# --- 2. identity via SNMP -------------------------------------------------
if command -v snmpget >/dev/null 2>&1; then
    for oid in \
        "1.3.6.1.2.1.1.1.0:system description" \
        "1.3.6.1.2.1.25.3.2.1.3.1:printer model" \
        "1.3.6.1.2.1.43.5.1.1.17.1:serial number"
    do
        o="${oid%%:*}"; label="${oid#*:}"
        val=$(snmpget -v1 -c public -Ovq -t 2 -r 1 "$IP" "$o" 2>/dev/null \
              | tr -d '"' | tr -s ' ')
        [[ -n "$val" ]] && ok "$label: $val"
    done
else
    warn "snmpget not installed -- skipping SNMP identity (apt install snmp)"
fi

# --- 3. PostScript interrogation -----------------------------------------
# A PostScript interpreter will execute this and write the answer back down
# the socket. A non-PS (HP-GL/2 only) plotter will either ignore it or spit
# out an error, and we will see no PRODUCT= line.
bold "Querying the PostScript interpreter"

PSQ=$(mktemp); trap 'rm -f "$PSQ" "$PSOUT"' EXIT
PSOUT=$(mktemp)

# UEL + PJL header so the plotter switches languages cleanly, then the query.
printf '\033%%-12345X@PJL ENTER LANGUAGE = POSTSCRIPT\n' > "$PSQ"
cat >> "$PSQ" <<'PSEOF'
%!PS-Adobe-3.0
/o (%stdout) (w) file def
/W { o exch writestring o flushfile } def
(PRODUCT=) W product W (\n) W
(VERSION=) W version W (\n) W
(REVISION=) W revision 16 string cvs W (\n) W
(LEVEL=) W languagelevel 8 string cvs W (\n) W
PSEOF
printf '\004' >> "$PSQ"     # ^D: end-of-job for the PS interpreter
printf '\033%%-12345X' >> "$PSQ"

nc -w 8 "$IP" "$PORT" < "$PSQ" > "$PSOUT" 2>/dev/null

if grep -q 'PRODUCT=' "$PSOUT"; then
    ok "PostScript interpreter responded:"
    sed 's/^/        /' "$PSOUT" | grep -E 'PRODUCT|VERSION|REVISION|LEVEL|SERIAL'
    echo
    bold "Verdict: PostScript confirmed. Use the T1200ps PPD (the fast path)."
    exit 0
else
    warn "no PostScript reply on the socket."
    if [[ -s "$PSOUT" ]]; then
        echo "      Raw reply was:"; sed 's/^/        /' "$PSOUT" | head -20
    fi
    cat <<'EOM'

      This is not conclusive on its own -- some DesignJet firmware refuses to
      write back to the socket even when PostScript is present. Confirm on the
      front panel instead:

          Setup > Information > Show printer information

      If it lists "PostScript" or "Adobe PostScript 3", you are on the fast
      path -- carry on with ./scripts/add-queue.sh.

      If it does NOT, the plotter is HP-GL/2 only and the server has to RIP
      every job before sending it. See docs/troubleshooting.md, section
      "No PostScript on board".
EOM
    exit 3
fi
