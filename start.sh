#!/bin/bash

# Shortly - Quick Start Script

set -e

echo "=========================================="
echo "Shortly - URL Shortener"
echo "=========================================="
echo ""

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo "Error: Docker Compose is not installed."
    echo "Please install Docker Compose first."
    exit 1
fi

echo "Using: $COMPOSE_CMD"
echo ""

# Load environment if .env exists
if [ -f .env ]; then
    echo "Found .env file, using custom configuration..."
    ENV_FLAG="--env-file .env"
else
    echo "No .env file found, using default configuration..."
    ENV_FLAG=""
fi

echo ""
echo "Starting Shortly..."
echo ""

# Start services
$COMPOSE_CMD $ENV_FLAG up --build -d

echo ""
echo "=========================================="
echo "Shortly is starting..."
echo "=========================================="
echo ""
echo "Please wait 30-60 seconds for all services to be healthy."
echo ""
echo "Access URLs:"
echo "  Frontend:  http://localhost:8082"
echo "  Backend:   http://localhost:8080/api/health"
echo ""
echo "To view logs:"
echo "  $COMPOSE_CMD logs -f"
echo ""
echo "To stop:"
echo "  $COMPOSE_CMD down"
echo ""
