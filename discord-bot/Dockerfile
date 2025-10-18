FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm i .

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

CMD ["npm", "start"]