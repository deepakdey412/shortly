# EC2 Deployment Guide

This guide walks through deploying Shortly on an AWS EC2 instance using Docker Compose.

## Prerequisites

- AWS EC2 instance running (Ubuntu 22.04 or Amazon Linux 2023 recommended)
- Docker and Docker Compose installed on the EC2 instance
- Security group configured to allow inbound traffic on ports:
  - 22 (SSH)
  - 8080 (Backend API)
  - 8082 (Frontend)
  - 6379 (Redis - optional, only if exposing externally)

## Step 1: Install Docker and Docker Compose

### On Ubuntu/Debian:

```bash
# Update package index
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### On Amazon Linux 2023:

```bash
# Update package index
sudo yum update -y

# Install Docker
sudo yum install -y docker

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

## Step 2: Clone or Upload the Project

### Option A: Using Git (if repository is available)

```bash
git clone <your-repository-url> shortly
cd shortly
```

### Option B: Manual Upload

```bash
# On your local machine, create a tarball
tar -czf shortly.tar.gz shortly/

# Upload to EC2 (replace with your key and EC2 IP)
scp -i your-key.pem shortly.tar.gz ec2-user@your-ec2-ip:~

# On EC2, extract
tar -xzf shortly.tar.gz
cd shortly
```

## Step 3: Configure Environment Variables

Get your EC2 public IP:

```bash
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Your EC2 Public IP: $EC2_IP"
```

Create a `.env` file:

```bash
cat > .env << EOF
SHORTLY_BASE_URL=http://$EC2_IP:8080
SHORTLY_CORS_ALLOWED_ORIGINS=http://$EC2_IP:8082
REDIS_HOST=redis
REDIS_PORT=6379
EOF
```

Review the file:

```bash
cat .env
```

## Step 4: Configure EC2 Security Group

In the AWS Console, configure your EC2 instance's security group:

1. Go to EC2 → Security Groups
2. Find your instance's security group
3. Add inbound rules:
   - Type: Custom TCP, Port: 8080, Source: 0.0.0.0/0 (or your IP)
   - Type: Custom TCP, Port: 8082, Source: 0.0.0.0/0 (or your IP)

## Step 5: Build and Run

```bash
# Load environment variables and start
docker compose --env-file .env up --build -d

# Check logs
docker compose logs -f
```

Wait for all services to start (usually 1-2 minutes).

## Step 6: Verify Deployment

### Check container status:

```bash
docker compose ps
```

Expected output:
```
NAME                IMAGE               STATUS              PORTS
shortly-backend     shortly-backend     Up (healthy)        0.0.0.0:8080->8080/tcp
shortly-frontend    shortly-frontend    Up                  0.0.0.0:8082->80/tcp
shortly-redis       redis:7-alpine      Up (healthy)        6379/tcp
```

### Test backend health:

```bash
curl http://localhost:8080/api/health
```

Expected: `{"status":"UP","service":"shortly"}`

### Test from external browser:

1. Open: `http://YOUR-EC2-PUBLIC-IP:8082`
2. You should see the Shortly application
3. Create a short URL to verify full functionality

## Step 7: Monitor and Manage

### View logs:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f redis
```

### Restart services:

```bash
docker compose restart
```

### Stop services:

```bash
docker compose down
```

### Update and redeploy:

```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker compose --env-file .env up --build -d
```

## Troubleshooting

### Issue: Cannot connect to frontend

**Check:**
1. Security group allows port 8082
2. Frontend container is running: `docker compose ps`
3. Frontend logs: `docker compose logs frontend`

### Issue: Frontend shows "Failed to create short URL"

**Check:**
1. Backend is running and healthy: `docker compose ps`
2. CORS configuration: `cat .env`
3. Backend logs: `docker compose logs backend`

### Issue: Backend cannot connect to Redis

**Check:**
1. Redis container is running: `docker compose ps`
2. Network connectivity: `docker compose exec backend ping redis`
3. Redis logs: `docker compose logs redis`

### Issue: Short URLs have wrong domain

**Fix:**
Update `SHORTLY_BASE_URL` in `.env` to your EC2 public IP or domain:
```bash
SHORTLY_BASE_URL=http://your-ec2-public-ip:8080
```

Then restart:
```bash
docker compose down
docker compose --env-file .env up -d
```

## Performance Tuning

### For production workloads:

1. **Increase Redis memory limits** in `docker-compose.yml`:
   ```yaml
   redis:
     command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
   ```

2. **Add resource limits**:
   ```yaml
   backend:
     deploy:
       resources:
         limits:
           cpus: '1.0'
           memory: 1G
   ```

3. **Configure Spring Boot JVM options**:
   ```yaml
   backend:
     environment:
       JAVA_OPTS: "-Xmx512m -Xms256m"
   ```

## Security Hardening

### 1. Restrict CORS to specific origins:

```bash
# In .env, replace with your actual domain
SHORTLY_CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### 2. Don't expose Redis port externally:

The current `docker-compose.yml` does NOT expose Redis on port 6379 to the host, which is correct. Keep it that way.

### 3. Use HTTPS in production:

Consider using:
- AWS Application Load Balancer with SSL certificate
- Nginx reverse proxy with Let's Encrypt
- AWS CloudFront with custom domain

### 4. Regular updates:

```bash
# Update base images
docker compose pull
docker compose up -d
```

## Auto-start on Boot

To automatically start Shortly when EC2 boots:

### Option A: Using systemd

Create a systemd service:

```bash
sudo tee /etc/systemd/system/shortly.service > /dev/null << EOF
[Unit]
Description=Shortly URL Shortener
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ec2-user/shortly
ExecStart=/usr/local/bin/docker-compose --env-file .env up -d
ExecStop=/usr/local/bin/docker-compose down
User=ec2-user

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable shortly.service
sudo systemctl start shortly.service
```

### Option B: Using crontab

```bash
crontab -e

# Add this line:
@reboot cd /home/ec2-user/shortly && /usr/local/bin/docker-compose --env-file .env up -d
```

## Backup and Restore

### Backup (if you add persistent storage later):

```bash
# Backup volumes
docker compose down
sudo tar -czf shortly-backup-$(date +%Y%m%d).tar.gz /var/lib/docker/volumes/shortly_*

# Backup environment config
cp .env .env.backup
```

### Restore:

```bash
# Restore volumes
sudo tar -xzf shortly-backup-20260101.tar.gz -C /

# Restore environment
cp .env.backup .env

# Start services
docker compose --env-file .env up -d
```

## Cost Optimization

For AWS:

1. Use t3.micro or t3.small for development/testing
2. Use t3.medium for moderate production workloads
3. Enable EC2 Instance Savings Plans for discounts
4. Use EBS gp3 volumes instead of gp2
5. Consider AWS Fargate for container orchestration at scale

## Monitoring

### Basic monitoring:

```bash
# Check resource usage
docker stats

# Check disk usage
df -h
docker system df
```

### Set up CloudWatch Logs (optional):

Install CloudWatch agent on EC2 to send Docker logs to CloudWatch for centralized monitoring.

## Support

For issues or questions:
- Check logs: `docker compose logs -f`
- Review README.md for application details
- Check Docker Compose networking
- Verify environment variables

## Quick Commands Reference

```bash
# Start
docker compose --env-file .env up -d

# Stop
docker compose down

# Restart
docker compose restart

# View logs
docker compose logs -f

# Check status
docker compose ps

# Update and restart
docker compose --env-file .env up --build -d

# Clean everything
docker compose down -v
docker system prune -a
```
