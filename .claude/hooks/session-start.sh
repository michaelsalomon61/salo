#!/bin/bash
# Startschritt für Cloud-Sitzungen von Claude Code: installiert die Abhängigkeiten,
# damit Typprüfung, Tests und Build sofort laufen. Lokal tut das Skript nichts.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Nur installieren, wenn sich seit der letzten erfolgreichen Installation etwas geändert hat.
# Die Prüfsummen liegen in node_modules und verschwinden mit den Paketen.
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  # Alte Prüfsummen zuerst löschen, damit eine fehlgeschlagene Installation beim nächsten Start wiederholt wird.
  rm -f "$hashes"

  npm install --no-audit --no-fund

  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi
