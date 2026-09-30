#!/bin/sh
# Run on your-server after DNS for albums.your.domain resolves to the service entrance.
set -eu
cd /home/your-user/album-ledger
python3 - <<'PY'
import socket
try:
    actual={r[4][0] for r in socket.getaddrinfo('albums.your.domain',80,type=socket.SOCK_STREAM)}
    expected={r[4][0] for r in socket.getaddrinfo('file.your.domain',80,type=socket.SOCK_STREAM)}
except OSError:raise SystemExit('域名尚未解析，暂不申请证书')
if not actual.intersection(expected):raise SystemExit('域名入口与现有服务不一致，请检查 DNS')
PY
sudo certbot certonly --non-interactive --webroot -w /var/www/album-ledger-acme -d albums.your.domain --cert-name albums.your.domain --keep-until-expiring
sudo cp /etc/nginx/sites-available/album-ledger /etc/nginx/sites-available/album-ledger.before-https
sudo install -m 644 deploy/nginx.conf.template /etc/nginx/sites-available/album-ledger
if ! sudo nginx -t; then
    sudo mv /etc/nginx/sites-available/album-ledger.before-https /etc/nginx/sites-available/album-ledger
    exit 1
fi
sudo systemctl reload nginx
printf 'HTTPS configured. Verify https://albums.your.domain before daily use.\n'
