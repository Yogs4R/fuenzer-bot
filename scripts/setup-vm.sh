#!/usr/bin/env bash
# ==============================================================================
# Fuenzer Bot — Linux Cloud VM Automated Setup Script
# Tested on: Ubuntu 22.04 / 24.04 LTS & Debian 12
# Usage:
#   chmod +x scripts/setup-vm.sh && ./scripts/setup-vm.sh
# or remotely via curl:
#   curl -fsSL https://raw.githubusercontent.com/Yogs4R/fuenzer-bot/main/scripts/setup-vm.sh | bash
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}    Fuenzer Bot — Cloud VM Automated Provisioning   ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Setup Swap Memory (4GB) - Essential for 1GB RAM VMs (e2-micro)
echo -e "\n${YELLOW}[1/6] Checking and setting up 4GB Swap Memory...${NC}"
if [ $(swapon --show | wc -l) -le 1 ]; then
    echo "Creating 4GB swapfile..."
    if sudo fallocate -l 4G /swapfile 2>/dev/null; then
        echo "Swapfile allocated via fallocate."
    else
        echo "fallocate failed, creating via dd..."
        sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
    fi
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    echo -e "${GREEN}4GB Swap successfully configured and activated.${NC}"
else
    echo -e "${GREEN}Swap is already active: $(free -h | awk '/Swap:/ {print $2}')${NC}"
fi

# 2. Update OS repositories
echo -e "\n${YELLOW}[2/6] Updating OS package lists...${NC}"
sudo apt update -y && sudo apt upgrade -y

# 3. Install essential system dependencies (ffmpeg, build tools, curl, git)
echo -e "\n${YELLOW}[3/6] Installing base system dependencies (git, curl, build-essential, ffmpeg)...${NC}"
sudo apt install -y git curl build-essential ffmpeg ca-certificates

# 4. Install Node.js 22 LTS via NodeSource
echo -e "\n${YELLOW}[4/6] Installing Node.js 22 LTS...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 22 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}Node.js is already installed: $(node -v)${NC}"
fi

# 5. Install PM2 Process Manager globally
echo -e "\n${YELLOW}[5/6] Installing PM2 process manager globally...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo -e "${GREEN}PM2 is already installed: $(pm2 -v)${NC}"
fi

# 6. Configure UFW Firewall (SSH + Express Webhook Port 3000)
echo -e "\n${YELLOW}[6/6] Configuring firewall rules (UFW: Open SSH 22 & Webhook 3000)...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow ssh || true
    sudo ufw allow 3000/tcp || true
    sudo ufw reload || true
    echo -e "${GREEN}Firewall configured successfully.${NC}"
else
    echo -e "${YELLOW}UFW not found, skipping firewall configuration.${NC}"
fi

# Summary & Verification
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}        ✅ VM Environment Setup Complete!            ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Installed Versions & Resources:"
echo -e " - Node.js:  $(node -v)"
echo -e " - NPM:      $(npm -v)"
echo -e " - PM2:      v$(pm2 -v)"
echo -e " - FFmpeg:   $(ffmpeg -version | head -n 1 | awk '{print $3}')"
echo -e " - Memory:   $(free -h | awk '/Mem:/ {print $2}') (Swap: $(free -h | awk '/Swap:/ {print $2}'))"

echo -e "\n${BLUE}Next Steps to Launch Fuenzer Bot:${NC}"
echo -e " 1. Clone repository (if not cloned yet):"
echo -e "    git clone https://github.com/Yogs4R/fuenzer-bot.git ~/fuenzer-bot"
echo -e " 2. Navigate to directory & install project packages:"
echo -e "    cd ~/fuenzer-bot && npm install"
echo -e " 3. Setup your environment file:"
echo -e "    cp .env.example .env && nano .env"
echo -e " 4. Start and persist bot process with PM2:"
echo -e "    pm2 start src/index.js --name fuenzerbot"
echo -e "    pm2 save"
echo -e "    pm2 startup"
echo -e "${BLUE}====================================================${NC}\n"
