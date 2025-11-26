#!/bin/bash
# KOauth Deployment Script
# Rebuilds and restarts the Docker containers

set -e

echo "🚀 Starting KOauth deployment..."

# Pull latest changes
echo "📥 Pulling latest changes from git..."
git pull

# Rebuild the Docker image
echo "🔨 Building Docker image..."
docker-compose build app

# Restart the containers
echo "🔄 Restarting containers..."
docker-compose up -d app

# Show logs
echo "📋 Showing recent logs..."
docker-compose logs --tail=50 app

echo "✅ Deployment complete!"
echo "🌐 Your app should now be available at https://auth.tillmaessen.de"
