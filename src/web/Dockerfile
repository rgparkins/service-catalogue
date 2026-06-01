# Development Dockerfile for Vite-based web app
FROM node:22-alpine

# Install dependencies needed for building
RUN apk add --no-cache git curl bash

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy remaining files
COPY . .

EXPOSE 5173

# Start Vite dev server, binding to 0.0.0.0 so it's accessible from host
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
