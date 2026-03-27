#!/bin/sh
set -eu

node scripts/init-db.js
exec npm run start
