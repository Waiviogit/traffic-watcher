#!/bin/sh
set -e

# Start vnstat daemon
vnstatd -d

# Wait for vnstat to initialize
sleep 2

# Initialize interface if not already done
INTERFACE=${NETWORK_INTERFACE:-eth0}
vnstat -i $INTERFACE --add 2>/dev/null || true

echo "Traffic Watcher starting..."
echo "Monitoring interface: $INTERFACE"

# Execute the main command
exec "$@"

