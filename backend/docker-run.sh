#!/bin/bash

# Script to build and run Docker container with volume mount for development
# This allows code changes to sync automatically (hot reload)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE_NAME="voicebot-backend"
CONTAINER_NAME="voicebot-backend"
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
    echo "   Creating .env from env.example..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "   Please edit .env file with your Azure SQL credentials"
    else
        echo "   Please create .env file manually"
    fi
    echo ""
fi

echo "🚀 Starting container: $CONTAINER_NAME"
echo "   Port: $PORT"
echo "   Volume mount: $(pwd) -> /usr/app (for hot reload)"
echo ""

# Run container with volume mount for development
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:8000 \
    -v "$(pwd):/usr/app" \
    -v /usr/app/venv \
    -v /usr/app/__pycache__ \
    --env-file .env \
    -e ENVIRONMENT=development \
    -e PORT=8000 \
    --restart unless-stopped \
    $IMAGE_NAME:latest

echo "✅ Container started successfully!"
echo ""
echo "📋 Container info:"
echo "   Name: $CONTAINER_NAME"
echo "   Image: $IMAGE_NAME:latest"
echo "   Port: http://localhost:$PORT"
echo ""
echo "📝 Useful commands:"
echo "   View logs:    docker logs -f $CONTAINER_NAME"
echo "   Stop:         docker stop $CONTAINER_NAME"
echo "   Start:        docker start $CONTAINER_NAME"
echo "   Remove:       docker rm -f $CONTAINER_NAME"
echo "   Shell access: docker exec -it $CONTAINER_NAME /bin/bash"
echo ""
echo "🔄 Code changes will automatically reload (hot reload enabled)"
echo ""

# Show logs
echo "📜 Showing logs (Ctrl+C to exit)..."
docker logs -f $CONTAINER_NAME

