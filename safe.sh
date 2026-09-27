#!/bin/bash
# Universal - যেখানে চালাবে সেখানেই কাজ করবে
PROJECT_DIR="$(pwd)"
LOCK_FILE="$PROJECT_DIR/.surakkha.lock"
STAGING_DIR="$PROJECT_DIR/.staging"
mkdir -p "$STAGING_DIR" "$PROJECT_DIR/versions"
case "$1" in
  status)
    echo "🔒 === সুরক্ষা [$PROJECT_DIR] ==="
    if [ -f "$LOCK_FILE" ]; then cat "$LOCK_FILE"; else echo "⚠️ LOCK নাই"; fi
    echo ""; echo "📦 STAGING:"; ls -lh "$STAGING_DIR" 2>/dev/null | tail -5
    echo ""; echo "📁 FINAL:"; ls -lh "$PROJECT_DIR/versions" 2>/dev/null | tail -5
    ;;
  lock) FILE=$2; SUM=$(md5sum "$PROJECT_DIR/$FILE" | cut -d' ' -f1); echo "$FILE:$SUM:LOCKED:$(date +%Y%m%d_%H%M%S)" >> "$LOCK_FILE"; chmod 444 "$PROJECT_DIR/$FILE"; echo "🔒 LOCKED: $FILE" ;;
  unlock) FILE=$2; chmod 644 "$PROJECT_DIR/$FILE"; echo "🔓 UNLOCKED: $FILE" ;;
  stage) FILE=$2; cp "$PROJECT_DIR/$FILE" "$STAGING_DIR/${FILE}.staging_$(date +%s)"; echo "📦 STAGED: $FILE" ;;
  confirm)
    FILE=$2; LATEST=$(ls -t "$STAGING_DIR/${FILE}.staging_"* 2>/dev/null | head -1)
    [ -z "$LATEST" ] && echo "❌ Staging নাই" && exit 1
    read -p "✅ নির্ভুল? yes লিখো: " ans
    if [ "$ans" = "yes" ]; then cp "$LATEST" "$PROJECT_DIR/$FILE"; cp "$PROJECT_DIR/$FILE" "$PROJECT_DIR/versions/${FILE%.html}_FINAL_$(date +%Y%m%d_%H%M%S).html"; SUM=$(md5sum "$PROJECT_DIR/$FILE" | cut -d' ' -f1); echo "$FILE:$SUM:CONFIRMED:$(date +%Y%m%d_%H%M%S)" >> "$LOCK_FILE"; chmod 444 "$PROJECT_DIR/$FILE"; echo "🔒✅ CONFIRMED!"; else echo "❌ Cancelled"; fi ;;
  *) echo "Usage: bash safe.sh lock file.html | unlock | status | stage | confirm" ;;
esac
