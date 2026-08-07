#!/usr/bin/env bash
#
# Keep the queue alive.
#
# Older DesignJets drop TCP connections while they wake, swap ink, or chew
# through a big plot. CUPS reacts by marking the queue "disabled" -- and once
# disabled it stays that way, so the next morning your Mac shows jobs queued
# and nothing comes out. This runs on a timer, notices that state, and clears
# it once the plotter is answering again.
#
set -uo pipefail

CONF=/etc/designjet/config.env
# shellcheck source=/dev/null
[[ -f "$CONF" ]] && source "$CONF"

QUEUE_NAME="${QUEUE_NAME:-DesignJet-T1200}"
PLOTTER_IP="${PLOTTER_IP:-}"
PLOTTER_PORT="${PLOTTER_PORT:-9100}"

log() { logger -t designjet-healthcheck -- "$*"; [[ -t 1 ]] && echo "$*"; }

lpstat -p "$QUEUE_NAME" >/dev/null 2>&1 || {
    log "queue '$QUEUE_NAME' does not exist -- nothing to do"
    exit 0
}

STATE="$(lpstat -p "$QUEUE_NAME" 2>/dev/null | head -1)"

case "$STATE" in
    *"is idle"*|*"now printing"*)
        exit 0
        ;;
esac

# Queue is stopped/disabled. Only re-enable once the plotter is actually
# answering -- flapping it back on while the plotter is off just burns
# through the retry limit and re-fails every queued job.
if [[ -z "$PLOTTER_IP" ]]; then
    log "queue is down but PLOTTER_IP is unset; cannot verify plotter. State: $STATE"
    exit 1
fi

if nc -z -w 4 "$PLOTTER_IP" "$PLOTTER_PORT" 2>/dev/null; then
    log "queue was down ($STATE) but plotter is answering on ${PLOTTER_IP}:${PLOTTER_PORT} -- re-enabling"
    cupsenable "$QUEUE_NAME" && cupsaccept "$QUEUE_NAME"
    log "queue '$QUEUE_NAME' re-enabled; $(lpstat -o "$QUEUE_NAME" 2>/dev/null | wc -l) job(s) pending"
else
    log "queue is down and plotter is unreachable at ${PLOTTER_IP}:${PLOTTER_PORT} -- leaving it stopped"
fi
