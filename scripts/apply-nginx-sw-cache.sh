#!/bin/bash
# Fixes push notifications: nginx was caching sw.js 7 days while worker-*.js changes every deploy.
set -euo pipefail
CONF="/etc/nginx/sites-enabled/openhrm.conf"
SNIPPET="/var/www/openhrm/frontend/docs/nginx-sw-cache.conf.snippet"
MARKER="PWA SERVICE WORKER"

if grep -q "$MARKER" "$CONF" 2>/dev/null; then
  echo "Nginx SW cache rules already present."
else
  echo "Insert SW cache rules into $CONF (requires sudo)."
  sudo cp "$CONF" "${CONF}.bak.$(date +%s)"
  sudo sed -i "/# STATIC FILE CACHE/i\\
    ##################################################\\
    # PWA SERVICE WORKER — never long-cache (worker hash changes each deploy)\\
    ##################################################\\
\\
$(sed 's/^/    /' "$SNIPPET" | grep -v '^[[:space:]]*#')\\
" "$CONF"
fi

sudo nginx -t
sudo systemctl reload nginx
echo "Done. Purge Cloudflare cache for /sw.js and /worker-*.js if using Cloudflare."
