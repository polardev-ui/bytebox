#!/bin/bash

cd /var/www/bytebox-backend

# Start Xvfb if not running
if ! pgrep -x "Xvfb" > /dev/null; then
    echo "[ByteBox] Starting virtual framebuffer..."
    Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -noreset &
    sleep 2
fi

export DISPLAY=:99

echo "[ByteBox] Starting server..."
pm2 start server.js --name "bytebox" --update-env

pm2 status "bytebox"