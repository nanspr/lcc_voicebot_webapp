#!/bin/bash

# Script to build and run Docker container for production (no volume mount)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE_NAME="voicebot-backend"
CONTAINER_NAME="voicebot-backend-prod"
PORT="${PORT:-8000}"

echo "🔨 Building Docker image: $IMAGE_NAME"
docker build -t $IMAGE_NAME:latest .

# Stop and remove existing container if it exists
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "🛑 Stopping existing container: $CONTAINER_NAME"
    docker stop $CONTAINER_NAME > /dev/null 2>&1 || true
    docker rm $CONTAINER_NAME > /dev/null 2>&1 || true
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "   Please create .env file from env.example"
    exit 1
fi

echo "🚀 Starting production container: $CONTAINER_NAME"
echo "   Port: $PORT"
echo "   Mode: Production (no volume mount, using workers)"
echo ""

# Run container without volume mount (production)
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:8000 \
    --env-file .env \
    -e ENVIRONMENT=production \
    -e PORT=8000 \
    --restart unless-stopped \
    $IMAGE_NAME:latest

echo "✅ Container started successfully!"
echo ""
echo "📋 Container info:"
echo "   Name: $CONTAINER_NAME"
echo "   Image: $IMAGE_NAME:latest"
echo "   Port: http://localhost:$PORT"
echo "   Mode: Production"
echo ""
echo "📝 Useful commands:"
echo "   View logs:    docker logs -f $CONTAINER_NAME"
echo "   Stop:         docker stop $CONTAINER_NAME"
echo "   Start:        docker start $CONTAINER_NAME"
echo "   Remove:       docker rm -f $CONTAINER_NAME"
echo ""

# Show logs
echo "📜 Showing logs (Ctrl+C to exit)..."
docker logs -f $CONTAINER_NAME

