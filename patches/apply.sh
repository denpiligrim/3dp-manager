#!/usr/bin/env bash
set -euo pipefail
echo "[PATCH] Applying 3dp-manager rotation fixes..."
for i in $(seq 1 30); do
    docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^3dp-backend$" && break
    sleep 1
done
SD="$(cd "$(dirname "$0")" && pwd)"
docker cp "$SD/rotation.service.js" 3dp-backend:/app/dist/src/rotation/rotation.service.js
echo "[PATCH] Fixes applied: create-first + orphaned cleanup via API"
