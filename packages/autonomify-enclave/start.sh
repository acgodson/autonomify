#!/bin/sh
set -e

echo "Enclave Starting..."

# Enable loopback (may fail in Docker, that's ok)
ip link set dev lo up 2>/dev/null || echo "Warning: Could not set loopback (expected in Docker)"

echo "Starting Node.js server..."
node --max-old-space-size=1536 --stack-size=2048 --trace-warnings /app/dist/index.js &
NODE_PID=$!

echo "Node.js PID: $NODE_PID"

# Give Node.js time to start
sleep 2

# Check if Node.js is still running
if ! kill -0 $NODE_PID 2>/dev/null; then
  echo "ERROR: Node.js failed to start"
  exit 1
fi

echo "Starting vsock bridge..."
python3 /app/vsock-bridge.py &
PYTHON_PID=$!

echo "Python PID: $PYTHON_PID"

# Monitor both processes
while true; do
  if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "ERROR: Node.js process died"
    exit 1
  fi
  
  if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "ERROR: Python process died"
    exit 1
  fi
  
  sleep 5
done
