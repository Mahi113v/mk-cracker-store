
FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build frontend
RUN npm run build

# Runtime configuration
ENV NODE_ENV=production

# Start application
EXPOSE 3000

CMD ["node", "server/server.js"]
