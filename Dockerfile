# Use lightweight official Node LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy backend package files first to leverage Docker layer caching
COPY backend/package*.json ./backend/

# Install production dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev || npm install --omit=dev

# Return to application root
WORKDIR /app

# Copy backend source code and frontend web dashboard
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose server port
EXPOSE 5000

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start backend server & live dashboard
WORKDIR /app/backend
CMD ["node", "src/server.js"]
