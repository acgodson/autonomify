# EC2 Deployment - CRE Executor

Deploy the CRE executor on your EC2 server alongside the enclave.

## Prerequisites

- EC2 instance already running the enclave
- SSH access to the server
- Port 8080 available (or nginx for reverse proxy)

## Installation

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### 2. Copy Executor Code

From your local machine:

```bash
scp -r packages/autonomify-cre/executor user@your-ec2-ip:~/autonomify-executor
```

Or clone the repo on the server:

```bash
git clone <your-repo> && cd autonomify/packages/autonomify-cre/executor
```

### 3. Configure

Copy and edit the config file:

```bash
cd ~/autonomify-executor
cp config.example.json config.staging.json
# Edit with your Tenderly RPC, keys, etc.
```

### 4. Install Dependencies

```bash
bun install
```

### 5. Run the Executor

```bash
bun run serve.ts
```

## Production Setup

### Option A: PM2 (Recommended)

```bash
npm install -g pm2
pm2 start "bun run serve.ts" --name cre-executor
pm2 save
pm2 startup
```

### Option B: Systemd

Create `/etc/systemd/system/cre-executor.service`:

```ini
[Unit]
Description=Autonomify CRE Executor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/autonomify-executor
ExecStart=/home/ubuntu/.bun/bin/bun run serve.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cre-executor
sudo systemctl start cre-executor
```

### Nginx Reverse Proxy (Optional)

If you want HTTPS with a domain:

```nginx
# /etc/nginx/sites-available/cre-executor
server {
    listen 443 ssl;
    server_name executor.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/executor.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/executor.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cre-executor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## EC2 Security Group

Open port 8080 (or 443 if using nginx):

| Type | Port | Source |
|------|------|--------|
| Custom TCP | 8080 | 0.0.0.0/0 |

## Environment Update

Update your app's environment to point to EC2:

```env
CRE_TRIGGER_URL=http://your-ec2-ip:8080
# or with nginx:
CRE_TRIGGER_URL=https://executor.yourdomain.com
```

## Verify

```bash
curl http://your-ec2-ip:8080/health
```

## Benefits

- No ngrok dependency - persistent public endpoint
- Lower latency (same server as enclave)
- Single server to manage
- Works with Vercel deployment
