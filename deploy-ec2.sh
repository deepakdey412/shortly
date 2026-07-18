#!/bin/bash

# Shortly EC2 Deployment Script
# This script helps configure and deploy Shortly on an EC2 instance

set -e

echo "=========================================="
echo "Shortly EC2 Deployment Configuration"
echo "=========================================="
echo ""

# Get EC2 public IP
echo "Detecting EC2 public IP..."
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)

if [ -z "$EC2_IP" ]; then
    echo "Could not detect EC2 public IP automatically."
    read -p "Enter your EC2 public IP or domain: " EC2_IP
fi

echo "EC2 IP/Domain: $EC2_IP"
echo ""

# Create .env file
echo "Creating .env file..."
cat > .env << EOF
# Shortly Environment Configuration
# Generated: $(date)

# Base URL for generated short links
SHORTLY_BASE_URL=http://$EC2_IP:8080

# CORS allowed origins (comma-separated)
SHORTLY_CORS_ALLOWED_ORIGINS=http://$EC2_IP:8082

# Redis connection
REDIS_HOST=redis
REDIS_PORT=6379
EOF

echo ".env file created successfully!"
echo ""

# Show configuration
echo "Configuration:"
cat .env
echo ""

# Ask to start services
read -p "Do you want to start the services now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building and starting services..."
    echo ""
    
    # Check if docker compose is available
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        echo "Error: Neither 'docker-compose' nor 'docker compose' found."
        echo "Please install Docker Compose first."
        exit 1
    fi
    
    # Start services
    $COMPOSE_CMD --env-file .env up --build -d
    
    echo ""
    echo "Services started!"
    echo ""
    echo "Waiting for services to be healthy (this may take 1-2 minutes)..."
    sleep 10
    
    echo ""
    echo "=========================================="
    echo "Deployment Status"
    echo "=========================================="
    $COMPOSE_CMD ps
    
    echo ""
    echo "=========================================="
    echo "Access URLs"
    echo "=========================================="
    echo "Frontend:  http://$EC2_IP:8082"
    echo "Backend:   http://$EC2_IP:8080/api/health"
    echo ""
    echo "To view logs: $COMPOSE_CMD logs -f"
    echo "To stop:      $COMPOSE_CMD down"
    echo ""
    
    # Test backend health
    echo "Testing backend health..."
    sleep 5
    if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
        echo "✓ Backend is healthy!"
    else
        echo "⚠ Backend might still be starting. Check logs with: $COMPOSE_CMD logs backend"
    fi
    
else
    echo ""
    echo "Configuration complete. To start services later, run:"
    echo "docker compose --env-file .env up --build -d"
fi

echo ""
echo "=========================================="
echo "Important: Configure AWS Security Group"
echo "=========================================="
echo "Make sure your EC2 security group allows:"
echo "  - Port 8080 (Backend API)"
echo "  - Port 8082 (Frontend)"
echo ""
echo "Deployment script completed!"
