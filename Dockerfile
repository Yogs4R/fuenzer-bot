FROM node:20-bookworm-slim

# Install system dependencies: ffmpeg for media/stickers and certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy project source code
COPY . .

# Default port for Express webhook
EXPOSE 3000

CMD ["node", "src/index.js"]
