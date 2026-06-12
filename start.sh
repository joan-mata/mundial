#!/bin/sh
npx prisma migrate deploy
exec node_modules/.bin/next start
