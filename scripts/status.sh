#!/bin/bash
LOG="$HOME/notes-to-pdf/logs/notes-to-pdf.log"
LAUNCHD_LOG="$HOME/notes-to-pdf/logs/launchd-out.log"
STATE="$HOME/notes-to-pdf/state/notes-state.json"
OUTPUT="$HOME/Downloads/Notes to PDF"

echo "========================================"
echo "  Notes to PDF — Status"
echo "========================================"
echo ""

# Service status
if launchctl list | grep -q "com.user.notes-to-pdf"; then
  echo "  Service: RUNNING (auto-starts on login)"
else
  echo "  Service: NOT LOADED"
fi

# PDF count
if [ -d "$OUTPUT" ]; then
  PDF_COUNT=$(find "$OUTPUT" -name "*.pdf" 2>/dev/null | wc -l | tr -d ' ')
  FOLDER_COUNT=$(find "$OUTPUT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  echo "  PDFs: $PDF_COUNT files across $FOLDER_COUNT folders"
  echo "  Output: $OUTPUT"
else
  echo "  Output folder not found"
fi

# State file
if [ -f "$STATE" ]; then
  NOTE_COUNT=$(python3 -c "import json; d=json.load(open('$STATE')); print(len(d))" 2>/dev/null || echo "?")
  echo "  Tracked notes: $NOTE_COUNT"
fi

echo ""
echo "--- Useful commands ---"
echo "  Orphan report : node ~/notes-to-pdf/scripts/orphan-report.js"
echo "  Force sync    : node ~/notes-to-pdf/src/index.js"
echo "  Watch log     : tail -f ~/notes-to-pdf/logs/notes-to-pdf.log"
echo ""
echo "--- Recent log entries ---"
if [ -f "$LOG" ]; then
  tail -20 "$LOG"
else
  echo "  (no log file yet)"
fi
echo ""
