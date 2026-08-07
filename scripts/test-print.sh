#!/usr/bin/env bash
#
# Send a small calibration plot through the whole chain.
#
# It draws a 200 mm ruler, a margin frame and a colour bar, so one sheet tells
# you three things: that the pipeline works end to end, that nothing is being
# scaled (measure the ruler with a real ruler), and that the margins in the
# PPD match what the plotter actually reserves.
#
# Uses A3 by default to avoid burning a metre of roll on a smoke test.
#
# Runs on the print server or directly on the Mac:
#     ./scripts/test-print.sh [media] [queue-name]
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# config.env only exists on the print server; the Mac passes the queue in.
# shellcheck source=/dev/null
[[ -f "$HERE/config.env" ]] && source "$HERE/config.env"

MEDIA="${1:-A3}"
QUEUE_NAME="${2:-${QUEUE_NAME:-DesignJet-T1200}}"

# Portable across GNU and BSD/macOS mktemp -- no --suffix, it is GNU-only.
PS="$(mktemp "${TMPDIR:-/tmp}/designjet-test.XXXXXX")"
trap 'rm -f "$PS"' EXIT

cat > "$PS" <<'PSEOF'
%!PS-Adobe-3.0
%%Title: DesignJet print server test plot
%%Pages: 1
%%EndComments
/mm { 72 mul 25.4 div } def
/Helvetica findfont 14 scalefont setfont

% --- margin frame: 5 mm in from every edge -------------------------------
0 setgray 0.5 setlinewidth
clippath pathbbox        % llx lly urx ury of the imageable area
/ury exch def /urx exch def /lly exch def /llx exch def
newpath
  llx 2 add lly 2 add moveto
  urx 2 sub lly 2 add lineto
  urx 2 sub ury 2 sub lineto
  llx 2 add ury 2 sub lineto
closepath stroke

% --- title ----------------------------------------------------------------
llx 12 add ury 30 sub moveto
(DesignJet T1200ps -- print server test plot) show
llx 12 add ury 48 sub moveto
/Helvetica findfont 9 scalefont setfont
(The frame sits 2 pt inside the driver's imageable area. If it is clipped,) show
llx 12 add ury 60 sub moveto
(the front-panel margin setting disagrees with the PPD. See docs/troubleshooting.md) show

% --- 200 mm ruler: measure it. It must read exactly 200 mm ---------------
/Helvetica findfont 9 scalefont setfont
llx 20 add lly 60 add translate
0 setgray 0.4 setlinewidth
newpath 0 0 moveto 200 mm 0 rlineto stroke
0 1 20 {
  /i exch def
  newpath
    i 10 mul mm 0 moveto
    0 i 5 mod 0 eq { 8 } { 4 } ifelse rlineto
  stroke
  i 5 mod 0 eq {
    i 10 mul mm 2 sub 12 moveto
    i 10 mul 20 string cvs show
  } if
} for
0 -14 moveto (This line is 200 mm long. Measure it: if it is not, something is scaling the job.) show

% --- colour bar -----------------------------------------------------------
0 40 translate
/sw 24 def
[ [1 0 0 0] [0 1 0 0] [0 0 1 0] [0 0 0 1]
  [0 0 0 0.25] [0 0 0 0.5] [0 0 0 0.75] [0 0 0 1] ]
{ /c exch def
  c 0 get c 1 get c 2 get c 3 get setcmykcolor
  newpath 0 0 sw 20 rectfill
  sw 0 translate
} forall

showpage
%%EOF
PSEOF

echo "==> Sending test plot to '$QUEUE_NAME' on $MEDIA"
JOB=$(lp -d "$QUEUE_NAME" -o "PageSize=$MEDIA" -o InputSlot=Sheet \
         -t "print-server-test" "$PS" | sed 's/.*request id is //')
echo "    Job: $JOB"
echo
echo "==> Queue state"
lpstat -o "$QUEUE_NAME" | sed 's/^/    /' || echo "    (queue empty -- already sent to the plotter)"
echo
echo "Watch progress with:   watch -n2 lpstat -o"
echo "Read the server log:   journalctl -u cups -f"
echo "Cancel it with:        cancel $JOB"
