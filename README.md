# My Travelroad — Kerala Tourism Platform

My Travelroad is a modern tourism platform and destination management portal designed specifically for Kerala, featuring verified local destinations, rich media, and administrative oversight.

---

## Technology Stack

- **Frontend & Admin**: Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI, Lucide Icons
- **Backend Service**: Express.js, Node.js 20+, TypeScript
- **Database**: PostgreSQL with PostGIS extension, managed via Prisma ORM
- **Security & Middleware**: Helmet, CORS, Cookie Parser, Zod validation
- **Observability**: Pino structured JSON logging with sensitive data redaction and UUIDv4 request correlation
- **Testing**: Vitest, Supertest, TSX

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- PostgreSQL >= 15 with PostGIS extension enabled
- npm >= 10.x

### 2. Environment Configuration
Copy `.env.example` to `.env` and provide your database credentials:
```bash
cp .env.example .env
```

Key environment variables:
- `NODE_ENV`: Application environment (`development`, `test`, `production`)
- `PORT`: Express server port (default: `4000`, separate from Next.js port `3000`)
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/mytravelroad?schema=public`)
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins (default: `http://localhost:3000`)
- `LOG_LEVEL`: Active Pino log level (`info`, `debug`, `warn`, `error`)

### 3. Database Migration & Setup
Generate Prisma client and apply migrations:
```bash
npm run db:generate
npm run db:migrate
```

### 4. Running the Applications

#### Express Backend Server
Start the standalone Express backend server:
```bash
# Development with hot-reload
npm run server:dev

# Production start
npm run server:start
```
The server binds to port `4000` (or your configured `PORT`) and handles:
- Liveness probe: `GET /health`
- Database readiness probe: `GET /health/ready`
- Versioned API gateway: `/api/v1`

#### Next.js Frontend & Admin
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Health & Readiness Probes

- **Process Liveness**: `GET /health` returns HTTP 200 with process uptime.
- **Database Readiness**: `GET /health/ready` executes a safe `SELECT 1` query. Returns HTTP 200 when connected, or HTTP 503 if disconnected. Stack traces, error details, and credentials are never exposed in failure responses.

---

## Testing

Run unit and integration test suites:
```bash
# Run backend foundation Vitest suites
npm test

# Run database & spatial PostGIS unit tests
npm run test:db

# Run Next.js linter
npm run lint

# Build production bundles
npm run build
```

---

## Graceful Shutdown Lifecycle
The backend server traps `SIGTERM` and `SIGINT` signals to guarantee clean termination:
1. Stops accepting new HTTP connections.
2. Permits in-flight requests up to 10 seconds to finish processing.
3. Closes all Prisma connection pools cleanly via `prisma.$disconnect()`.
4. Logs completion and exits cleanly with status code 0.
