#!/bin/bash

# Autonomify - One Command Startup Script
# Usage: ./start.sh or pnpm start
# This script starts ngrok, injects the URL into .env, starts CRE simulation, and runs the app

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
CRE_DIR="$ROOT_DIR/packages/autonomify-cre/executor"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         AUTONOMIFY - Starting Up           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"

# Check dependencies
check_dependency() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}Error: $1 is not installed${NC}"
    exit 1
  fi
}

echo -e "\n${YELLOW}[1/5] Checking dependencies...${NC}"
check_dependency ngrok
check_dependency bun
check_dependency pnpm
echo -e "${GREEN}✓ All dependencies found${NC}"

# Kill any existing processes on cleanup
cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  kill $NGROK_PID 2>/dev/null || true
  kill $CRE_PID 2>/dev/null || true
  kill $APP_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start ngrok in background
echo -e "\n${YELLOW}[2/5] Starting ngrok tunnel...${NC}"
ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start and get the URL
sleep 3
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$NGROK_URL" ]; then
  echo -e "${RED}Error: Failed to get ngrok URL. Check if ngrok is authenticated.${NC}"
  echo -e "${YELLOW}Run: ngrok config add-authtoken YOUR_TOKEN${NC}"
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

echo -e "${GREEN}✓ ngrok tunnel: ${NGROK_URL}${NC}"

# Update .env.local with ngrok URL
echo -e "\n${YELLOW}[3/5] Updating app/.env with ngrok URL...${NC}"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  # Update existing NEXT_PUBLIC_APP_URL
  if grep -q "NEXT_PUBLIC_APP_URL=" "$ENV_FILE"; then
    sed -i.bak "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$NGROK_URL|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    echo "NEXT_PUBLIC_APP_URL=$NGROK_URL" >> "$ENV_FILE"
  fi
else
  # Create new .env.local from .env.example
  if [ -f "$APP_DIR/.env.example" ]; then
    cp "$APP_DIR/.env.example" "$ENV_FILE"
    sed -i.bak "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$NGROK_URL|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    echo "NEXT_PUBLIC_APP_URL=$NGROK_URL" > "$ENV_FILE"
  fi
fi
echo -e "${GREEN}✓ NEXT_PUBLIC_APP_URL set to $NGROK_URL${NC}"

# Start CRE simulation
echo -e "\n${YELLOW}[4/5] Starting CRE workflow simulation...${NC}"
cd "$CRE_DIR"
if [ -f "$HOME/bin/cre" ]; then
  ~/bin/cre workflow simulate --workflow index.ts --config config.staging.json --broadcast &
  CRE_PID=$!
  echo -e "${GREEN}✓ CRE simulation started${NC}"
else
  echo -e "${YELLOW}⚠ CRE CLI not found at ~/bin/cre - skipping CRE simulation${NC}"
  echo -e "${YELLOW}  Install CRE CLI or run manually: ~/bin/cre workflow simulate ...${NC}"
fi

# Start the app
echo -e "\n${YELLOW}[5/5] Starting Autonomify app...${NC}"
cd "$ROOT_DIR"
pnpm dev &
APP_PID=$!

echo -e "\n${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           AUTONOMIFY IS RUNNING            ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║ Local:    http://localhost:3000            ║${NC}"
echo -e "${GREEN}║ Public:   ${NGROK_URL}${NC}"
echo -e "${GREEN}║                                            ║${NC}"
echo -e "${GREEN}║ Telegram webhook URL:                      ║${NC}"
echo -e "${GREEN}║ ${NGROK_URL}/api/telegram/webhook/{agentId}${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║ Press Ctrl+C to stop all services          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"

# Wait for processes
wait
