#!/usr/bin/env bash
#
# Autonomify Enclave Deployment Script
# One-click deployment to AWS Nitro Enclave
#
# Usage: ./deploy.sh [EC2_IP] [KEY_PATH]
#   EC2_IP: IP address of the EC2 instance (default: 35.159.224.254)
#   KEY_PATH: Path to SSH key 
#

set -e

EC2_IP="${1:-35.159.224.254}"
KEY_PATH="${2:-$HOME/uburu-routing-key.pem}"
GHCR_IMAGE="ghcr.io/acgodson/autonomify/enclave:latest"
ENCLAVE_NAME="enclave"
ENCLAVE_MEMORY=1560
ENCLAVE_CPUS=2
HTTP_PORT=8001

SSH_CMD="ssh -i $KEY_PATH -o StrictHostKeyChecking=no ec2-user@$EC2_IP"

echo "========================================"
echo "  Autonomify Enclave Deployment"
echo "========================================"
echo "EC2 IP: $EC2_IP"
echo "Image: $GHCR_IMAGE"
echo ""

# Step 1: Check connectivity
echo "[1/7] Checking EC2 connectivity..."
$SSH_CMD "echo 'Connected to EC2'"

# Step 2: Stop existing enclave if running
echo "[2/7] Stopping existing enclave..."
$SSH_CMD "nitro-cli describe-enclaves | jq -r '.[].EnclaveID' | xargs -I {} nitro-cli terminate-enclave --enclave-id {} 2>/dev/null || true"

# Step 3: Stop existing proxy
echo "[3/7] Stopping existing proxy..."
$SSH_CMD "sudo pkill -f 'http-proxy.py' 2>/dev/null || true"

# Step 4: Pull latest Docker image
echo "[4/7] Pulling latest Docker image..."
$SSH_CMD "docker pull $GHCR_IMAGE"

# Step 5: Build enclave image (.eif)
echo "[5/7] Building enclave image..."
$SSH_CMD "nitro-cli build-enclave --docker-uri $GHCR_IMAGE --output-file /tmp/$ENCLAVE_NAME.eif"

# Step 6: Run enclave
echo "[6/7] Starting enclave..."
ENCLAVE_OUTPUT=$($SSH_CMD "nitro-cli run-enclave --eif-path /tmp/$ENCLAVE_NAME.eif --cpu-count $ENCLAVE_CPUS --memory $ENCLAVE_MEMORY --debug-mode")
echo "$ENCLAVE_OUTPUT"

# Extract CID from output
ENCLAVE_CID=$(echo "$ENCLAVE_OUTPUT" | jq -r '.EnclaveCID')
echo "Enclave started with CID: $ENCLAVE_CID"

# Step 7: Deploy and start HTTP proxy
echo "[7/7] Deploying HTTP proxy..."
scp -i $KEY_PATH -o StrictHostKeyChecking=no "$(dirname $0)/http-proxy.py" ec2-user@$EC2_IP:~/http-proxy.py
$SSH_CMD "chmod +x ~/http-proxy.py"
$SSH_CMD "sudo nohup python3 ~/http-proxy.py $ENCLAVE_CID > /tmp/proxy.log 2>&1 &"

# Wait for proxy to start
sleep 2

# Verify deployment
echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
$SSH_CMD "nitro-cli describe-enclaves"
echo ""
echo "Enclave CID: $ENCLAVE_CID"
echo "HTTP Proxy: http://$EC2_IP:$HTTP_PORT"
echo ""
echo "Test with:"
echo "  curl -X POST http://$EC2_IP:$HTTP_PORT -H 'Content-Type: application/json' -d '{\"type\":\"HEALTH_CHECK\"}'"
echo ""
