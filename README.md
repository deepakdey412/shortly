# Shortly

Shortly is a URL shortener built with Spring Boot backend, React frontend, and Redis for caching and distributed rate-limit state. It demonstrates request flow, redirects, caching, rate limiting, click analytics, scheduled cleanup, and containerized deployment.

## Features

- Create short URLs from long URLs
- Optional custom aliases
- Optional expiration times
- Redirect short URLs to original URLs
- Track click counts and analytics
- Per-client/IP rate limiting
- Redis-backed caching
- Scheduled cleanup of expired URLs

## Architecture

- **Frontend**: React 18 + Vite
- **Backend**: Spring Boot 4.1.0 (Java 17)
- **Cache & State**: Redis 7
- **Deployment**: Docker Compose

### Data Storage

The application uses in-memory Java collections as the main store:

- `urlMappings` stores short code → `UrlData`
- `clickAnalytics` stores short code → list of `ClickEvent`
- Redis stores:
  - Cached `shortCode → originalUrl` entries
  - Serialized `RateLimitData` for rate limiting

## Project Structure

```
shortly/
├── backend/
│   ├── src/main/java/com/deepax/shortly/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── models/
│   │   └── services/
│   ├── src/main/resources/application.yaml
│   ├── Dockerfile
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Ports 8080 (backend), 8082 (frontend), and 6379 (Redis) available

### Running on EC2 or Local Machine

From the project root:

```bash
docker compose up --build
```

Access the application:

- **Frontend UI**: http://localhost:8082
- **Backend API**: http://localhost:8080/api/health
- **Backend Docs**: http://localhost:8080/api/

### Stopping the Application

```bash
docker compose down
```

To remove volumes and force a clean rebuild:

```bash
docker compose down -v
docker compose up --build --force-recreate
```

## Environment Configuration

### Environment Variables

The application can be configured using environment variables:

**Backend (application.yaml overrides):**

- `REDIS_HOST` - Redis hostname (default: `localhost`, Docker: `redis`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `SHORTLY_BASE_URL` - Base URL for generated short links (default: `http://localhost:8080`)
- `SHORTLY_CORS_ALLOWED_ORIGINS` - Comma-separated CORS origins (default: `http://localhost:4200,http://localhost:8082`)

**Example for EC2 deployment:**

Create a `.env` file in the project root:

```env
SHORTLY_BASE_URL=http://your-ec2-public-ip:8080
SHORTLY_CORS_ALLOWED_ORIGINS=http://your-ec2-public-ip:8082
```

Then run:

```bash
docker compose --env-file .env up --build
```

### Docker Compose Configuration

The `docker-compose.yml` uses proper Docker networking:

- All services communicate via the `shortly-network` bridge network
- Backend connects to Redis using service name `redis` (not `localhost`)
- Frontend proxies API requests to backend using service name `backend`
- Health checks ensure services start in the correct order

## API Endpoints

### Create Short URL

```http
POST /api/shorten
Content-Type: application/json

{
  "originalUrl": "https://example.com/very/long/url",
  "customAlias": "optional-code",
  "expiresAt": "2026-12-31T23:59:59"
}
```

### Redirect to Original URL

```http
GET /api/{shortCode}
```

### Get Basic Stats

```http
GET /api/stats/{shortCode}
```

### Get Analytics

```http
GET /api/analytics/{shortCode}
```

### Delete Short URL

```http
DELETE /api/{shortCode}
```

### Health Check

```http
GET /api/health
```

## Development

### Backend Development

```bash
cd backend
./mvnw spring-boot:run
```

Backend runs at: http://localhost:8080

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs at: http://localhost:5173 with API proxy to backend.

## Configuration

Main backend configuration is in `backend/src/main/resources/application.yaml`:

**Shortly Settings:**

- `shortly.base-url` - Base URL for short links
- `shortly.short-code.length` - Length of generated codes (default: 6)
- `shortly.short-code.max-attempts` - Max generation attempts (default: 10)
- `shortly.cache.ttl-minutes` - Redis cache TTL (default: 30)
- `shortly.rate-limit.requests-per-minute` - Rate limit per minute (default: 2)
- `shortly.rate-limit.requests-per-hour` - Rate limit per hour (default: 10)
- `shortly.cleanup.interval-minutes` - Cleanup interval (default: 1)

**Redis Configuration:**

- `spring.data.redis.host` - Redis host (env: `REDIS_HOST`)
- `spring.data.redis.port` - Redis port (env: `REDIS_PORT`)

## Core Components

### Backend Services

**UrlShortenerController**
- HTTP endpoints for URL operations
- Request validation and error handling

**UrlShortenerService**
- Short code generation (Base62)
- URL storage and retrieval
- Click tracking
- Redis caching
- Expiration cleanup

**RateLimitService**
- Per-client/IP rate limiting
- Redis-backed state sharing
- Fallback to in-memory storage

**WebConfig**
- CORS configuration
- Configurable allowed origins

**RedisConfig**
- RedisTemplate configuration
- JSON serialization with LocalDateTime support

### Frontend Components

**App.jsx**
- Main React component
- URL shortening form
- Stats retrieval form
- Error handling and loading states

## Click Analytics

The application tracks detailed click events:

- Timestamp
- IP address
- User agent
- Referrer
- Optional country/city (placeholders)

Analytics endpoints provide:

- Total clicks
- Recent click events
- Clicks by referrer
- Clicks by hour
- Clicks by day

## Rate Limiting

Rate limiting is applied per client IP:

- Minute-based window (default: 2 requests/minute)
- Hour-based window (default: 10 requests/hour)
- Redis-backed for multi-instance support
- Automatic window reset
- Fallback to in-memory if Redis unavailable

**Rate limit response:**

```json
{
  "error": "Rate limit exceeded",
  "remainingRequests": 0,
  "timeUntilReset": 45
}
```

## Redis Usage

### URL Cache

**Key format:** `url:{shortCode}`  
**Value:** Original URL string  
**TTL:** Configurable (default: 30 minutes)

Purpose:
- Fast redirect lookups
- Reduced load on main storage
- Automatic cleanup of cold entries

### Rate Limit State

**Key format:** `ratelimit:{clientIp}`  
**Value:** Serialized `RateLimitData`  
**TTL:** 1 hour

Purpose:
- Share rate limit state across app instances
- Distributed rate limiting
- Automatic cleanup

## Scheduled Cleanup

A Spring scheduled task runs periodically to:

- Find expired URLs
- Mark them as inactive
- Remove corresponding Redis cache entries

**Configuration:** `shortly.cleanup.interval-minutes` (default: 1 minute)

## Deployment Notes

### Docker Networking

The application uses proper Docker service-to-service communication:

- ✅ Backend → Redis: Uses service name `redis`
- ✅ Frontend → Backend: Nginx proxies to service name `backend`
- ❌ Do NOT use `localhost` or `127.0.0.1` for container-to-container communication

### CORS Configuration

CORS is configured for the frontend origin. For EC2 deployment:

1. Set the environment variable:
   ```bash
   export SHORTLY_CORS_ALLOWED_ORIGINS=http://your-ec2-ip:8082
   ```

2. Or update `docker-compose.yml` directly:
   ```yaml
   environment:
     SHORTLY_CORS_ALLOWED_ORIGINS: http://your-ec2-ip:8082
   ```

### Base URL Configuration

For EC2 deployment, set the base URL to your EC2 public IP:

```bash
export SHORTLY_BASE_URL=http://your-ec2-public-ip:8080
```

This ensures generated short URLs point to the correct public endpoint.

## Current Limitations

This project is designed for learning and demonstration:

- Main storage is in-memory (data lost on restart)
- No persistent database
- Simplified rate limiting (not fully atomic)
- No authentication or ownership model
- Delete only marks URLs inactive, no audit history
- Analytics stored in memory only

## Next Steps for Production

To evolve this into a production-ready system:

1. Add persistent database (PostgreSQL, MongoDB)
2. Use Redis atomic operations (Lua scripts) for rate limiting
3. Add authentication and URL ownership
4. Implement proper analytics persistence
5. Add comprehensive tests
6. Support custom domains
7. Add monitoring and observability
8. Implement URL validation and security checks
9. Add admin dashboard

## License

This project is for educational purposes.

## Author

Built by DeepAX
