# PlayNxt Web Admin Dockerfile
# Multi-stage build for production

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install since no lock file)
RUN npm install

# Copy source
COPY . .

# Build-time args for Vite environment variables
ARG VITE_API_URL=https://playnxt-api-zcsqynnnpa-uc.a.run.app
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN=playnxt-1a2c6.firebaseapp.com
ARG VITE_FIREBASE_PROJECT_ID=playnxt-1a2c6
ARG VITE_FIREBASE_STORAGE_BUCKET=playnxt-1a2c6.firebasestorage.app
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=167253232570
ARG VITE_FIREBASE_APP_ID=1:167253232570:web:e8ec55caa92c4faf422b83

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
