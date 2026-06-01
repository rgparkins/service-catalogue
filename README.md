# Service Catalogue

A Node.js/Express API and web UI for managing metadata about microservices — service names, domains, dependencies, published/consumed events, and more.

## Project Structure

- **src/api/**: Node.js/Express API (main backend)
- **src/web/**: React frontend for visualising the catalogue
- **test.sh**: End-to-end test runner using Docker

## Features

- Service metadata API (per-tenant)
- Versioned JSON schema validation + schema management UI
- MongoDB-backed storage (Docker Compose)
- Usage stats (requests + latency) for service update endpoints
- Web UI: landing page, tenant pages, graph, schemas, usage, plans

⸻

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) (recommended for local development + tests)
- Node.js (for running `src/web` directly, optional if using Docker)

### Clone the repo

```sh
git clone https://github.com/rgparkins/service-catalogue.git
cd service-catalogue
```

### Run API + Mongo + Web with Docker Compose

```sh
docker compose up --build
```

Services:
- API: `http://localhost:3000`
- Web: `http://localhost:5173`

### Run the Web UI without Docker (optional)

```sh
cd src/web
npm install
npm run dev
```

The web UI will be available at http://localhost:5173

⸻

## Running Tests

All tests run in Docker containers and require Docker to be installed.

From the repository root:

```sh
./test.sh
```

This script will:
- Build the API and test containers
- Start a MongoDB container
- Run the API and test containers on a Docker network
- Print logs if tests fail

⸻

## Configuration (Env Vars)

### Web

- `SERVICE_METADATA_URL` (host env, used by `docker-compose.yml`): base URL of the API (example: `http://localhost:3000`)
  - This is passed into the web container as `VITE_SERVICE_METADATA_URL`.

### API

- `MONGODB_ATLAS_URI` (required): MongoDB connection string (Compose uses `mongodb://mongodb:27017`)
- `ADMIN_API_KEY` (optional): when set, tenant auth is enforced for `/services/*` and admin routes are protected.
- `SEED_TENANT_ID` (optional): when set, the API seeds a tenant account on startup (dev bootstrap)
  - `SEED_TENANT_COMPANY_NAME`, `SEED_TENANT_BILLING_EMAIL`, `SEED_TENANT_PLAN`, `SEED_TENANT_API_KEY`
- Rate limits (optional overrides)
  - `RATE_LIMIT_VALIDATE_PER_MINUTE`
  - `RATE_LIMIT_SERVICES_WRITE_PER_MINUTE`

Plan-based defaults live in `src/api/app/lib/plan-limits.js`.

⸻

## API Overview

### Tenant accounts (admin)

These endpoints require `Authorization: Bearer $ADMIN_API_KEY` when `ADMIN_API_KEY` is set:

- `POST /accounts` (creates tenant; returns the raw API key once)
- `POST /accounts/:tenantId/rotate` (rotates key; returns the new raw API key once)
- `GET /accounts/:tenantId` (includes `apiKeyRotatedAt`)

### Service metadata (tenant)

These endpoints are per-tenant (tenant selected via API key; in dev mode you can also send `x-tenant-id`):

- `GET /services` (list service names)
- `GET /services/metadata` (list full service docs)
- `GET /services/metadata/:serviceName` (get a single service)
- `POST /services/metadata/:serviceName` (create/update service metadata)

### Schema validation + schemas

- `POST /metadata/validate`
- `POST /metadata/validate/:version`
- `GET /metadata/schema/:version` (or `latest`)
- `GET /metadata/schemas` (list versions + created date + status)
- `POST /metadata/schemas` (create draft schema)
- `PUT /metadata/schemas/:version` (edit draft only)
- `POST /metadata/schemas/:version/live` (set live; supersedes previous live)
- `DELETE /metadata/schemas/:version` (draft only, and only if never referenced by submissions)

### Usage stats

Usage stats currently record only **service metadata update traffic** (POST/PUT to `/services/metadata/*`) and latency.

- Tenant-scoped (uses tenant API key): `GET /admin/usage` and `GET /admin/usage/timeseries`
- Admin-scoped (uses admin key): `GET /admin/tenants/:tenantId/usage` and `/timeseries`

⸻

## Rate Limiting (Plan-Aware)

Rate limiting is a simple in-memory fixed-window limiter (per API instance).

Limits are computed from the tenant plan (`req.tenant.plan`) with defaults:
- `free`
- `pro` / `company`
- `enterprise`

See `src/api/app/lib/plan-limits.js` and `src/api/app/lib/rate-limit.js`.

⸻

## Web Pages

- `/` landing page (tenant list + create tenant)
- `/tenant/:tenantId/schemas` schema list + create/edit (draft only) + make live
- `/tenant/:tenantId/graph` tenant graph view
- `/tenant/:tenantId/usage` per-tenant usage dashboard
- `/tenant/:tenantId/settings` key rotation + last rotated date
- `/plans` pricing/plans page

⸻

## Handy scripts

Exercise the validate + service metadata endpoints with a payload:

```sh
TENANT_API_KEY=... ./scripts/exercise_api.sh
```

## License

This project is open source — feel free to reuse and adapt.
