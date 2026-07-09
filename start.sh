#!/bin/bash

# Navigate to the deployment directory explicitly
cd /var/www/bytebox-backend

# 1. Start Xvfb (Virtual Framebuffer) in the background if it isn't running.
# This assigns an isolated desktop display (:99) in system memory for Chromium.
if ! pgrep -x "Xvfb" > /dev/null
then
    echo "[Bytebox] Initializing Virtual Framebuffer (Display :99)..."
    Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -noreset &
    sleep 2 # Allow a brief window for the buffer to initialize
fi

# 2. Export the virtual display variable to the local shell context
export DISPLAY=:99

# 3. Launch the application via PM2 using the virtual display context
echo "[Bytebox] Launching Node.js backend cluster under PM2 tracking..."
pm2 start server.js --name "bytebox-backend" --update-env

# Display current status check
pm2 status "bytebox-backend"