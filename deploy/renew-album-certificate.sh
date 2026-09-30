#!/bin/sh
set -eu
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/albums.your.domain ]; then
    /usr/sbin/nginx -t
    /usr/bin/systemctl reload nginx
fi
