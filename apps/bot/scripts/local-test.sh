#!/usr/bin/env bash
# Lokal sinov: serverni ishga tushiradi, berilgan buyruqni bajaradi va to'xtatadi.
set -u
source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null
cd "$(dirname "$0")/.."
export PORT=3101 DELIVERY_FEE=30000 FREE_DELIVERY_FROM=1500000 EXPRESS_DELIVERY_FEE=20000
export SHOP_PHONE="+998 90 123 45 67" SHOP_ADDRESS="Toshkent, Chilonzor" SHOP_LAT=41.28 SHOP_LNG=69.2
export SHOP_HOURS="10:00 – 20:00" SHOP_ADMIN_CONTACT=mella_admin NEXT_PUBLIC_SITE_URL=https://mella.uz
export SHOP_INSTAGRAM=https://www.instagram.com/mella_uz/
node dist/index.js > /tmp/mella-bot.log 2>&1 &
PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3101/health && break; sleep 0.3; done
bash -c "$1"
kill $PID 2>/dev/null
wait $PID 2>/dev/null
echo "----- server log (tail) -----"
tail -n "${2:-5}" /tmp/mella-bot.log | cut -c1-260
