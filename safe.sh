#!/bin/bash
PROJECT_DIR="/storage/emulated/0/ProyojonX"
LOCK_FILE="$PROJECT_DIR/.surakkha.lock"
STAGING_DIR="$PROJECT_DIR/.staging"
mkdir -p "$STAGING_DIR" "$PROJECT_DIR/versions"
case "$1" in
  status)
    echo "🔒 === সুরক্ষা স্ট্যাটাস ==="
    if [ -f "$LOCK_FILE" ]; then cat "$LOCK_FILE"; else echo "⚠️ LOCK নাই - খোলা"; fi
    echo ""; echo "📦 STAGING:"; ls -lh "$STAGING_DIR" 2>/dev/null | tail -10
    echo ""; echo "📁 FINAL Versions:"; ls -lh "$PROJECT_DIR/versions" 2>/dev/null | tail -10
    ;;
  lock)
    FILE=$2; FULL="$PROJECT_DIR/$FILE"
    SUM=$(md5sum "$FULL" | cut -d' ' -f1)
    echo "$FILE:$SUM:LOCKED:$(date +%Y%m%d_%H%M%S)" >> "$LOCK_FILE"
    chmod 444 "$FULL"
    echo "🔒 LOCKED: $FILE - আমি চাইলেও নষ্ট করতে পারবো না!"
    ;;
  unlock)
    FILE=$2; chmod 644 "$PROJECT_DIR/$FILE"
    echo "🔓 UNLOCKED: $FILE"
    ;;
  stage)
    FILE=$2; cp "$PROJECT_DIR/$FILE" "$STAGING_DIR/${FILE}.staging_$(date +%s)"
    echo "📦 STAGED: $FILE - Preview দেখো"
    ;;
  confirm)
    FILE=$2; LATEST=$(ls -t "$STAGING_DIR/${FILE}.staging_"* 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then echo "❌ Staging নাই"; exit 1; fi
    read -p "✅ নির্ভুল কনফার্ম? yes লিখো: " ans
    if [ "$ans" = "yes" ]; then
      cp "$LATEST" "$PROJECT_DIR/$FILE"
      cp "$PROJECT_DIR/$FILE" "$PROJECT_DIR/versions/${FILE%.html}_FINAL_$(date +%Y%m%d_%H%M%S).html"
      SUM=$(md5sum "$PROJECT_DIR/$FILE" | cut -d' ' -f1)
      echo "$FILE:$SUM:CONFIRMED:$(date +%Y%m%d_%H%M%S)" >> "$LOCK_FILE"
      chmod 444 "$PROJECT_DIR/$FILE"
      echo "🔒✅ CONFIRMED & LOCKED - versions/ এ FINAL সেভ!"
    else echo "❌ Cancelled"; fi
    ;;
  *) echo "Usage: ./safe.sh lock file.html | unlock file.html | status | stage file.html | confirm file.html" ;;
esac
