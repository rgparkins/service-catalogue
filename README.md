# Service Catalogue

A Node.js/Express API and web UI for managing metadata about microservices — service names, domains, dependencies, published/consumed events, and more.

## Project Structure

- **src/api/**: Node.js/Express API (main backend)
- **src/web/**: React frontend for visualising the catalogue
- **test.sh**: End-to-end test runner using Docker

## Features

- REST API for CRUD operations on services
- Versioned JSON schema validation
- MongoDB-backed storage (via Docker)
- Automated tests (run in Docker)
- Web UI for graph visualisation

⸻

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) (required for running tests and local development)
- Node.js (v16+ recommended) and npm (for frontend development only)

### Clone the repo

```sh
git clone https://github.com/rgparkins/service-catalogue.git
cd service-catalogue
```

### Run the API and MongoDB with Docker Compose

```sh
docker-compose up --build
```

The API will be available at http://localhost:3000

### Run the Web UI (optional)

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

## API Endpoints

See the OpenAPI/Swagger docs in `src/api/app/swagger.yml` for full details.

### Health check

`GET /health`

Returns: `{ "ok": true }`

### Create a service

`POST /services`

Body (JSON) — no metadata (server generates that):

```json
{
  "name": "learner-profile-service",
  "domain": "learning",
  "team": "core-platform",
  "events": {
    "producing": [{ "name": "LearnerProfileUpdated" }],
    "consuming": [{ "name": "UserAuthenticated" }]
  },
  "dependencies": {
    "critical": [{ "name": "auth-service" }]
  }
}
```

### Replace an existing service

`PUT /services/:name`

Body must match the same service shape (except metadata).

The server will:
- update `updatedAt`
- bump the version (e.g., v1 → v2)
- keep `createdAt` unchanged

### List all services

`GET /services`

### Get a single service

`GET /services/:name`

### Delete a service

`DELETE /services/:name`

⸻

## Schema Validation

Input validation uses JSON Schema (see `src/api/app/schemas/`) and custom middleware.

Any invalid request returns detailed errors.

⸻

## Metadata Rules

Metadata is fully managed by the server:

| Field      | Meaning                                 |
|------------|-----------------------------------------|
| createdAt  | Date service was first created (ISO)    |
| updatedAt  | Last update date (ISO)                  |
| version    | Semantic increment (v1, v2, v3…)        |

Clients must not include metadata in POST/PUT — requests with metadata will be rejected.

⸻

## Storage

By default, data is stored in MongoDB (via Docker). For local development and testing, MongoDB runs in a container. Data is not persisted between runs unless you mount a volume.

⸻

## Extending

Suggestions:
- Add query filtering (by domain, team, events)
- Add pagination to listing
- Add shareable service graph export
- Add API docs (OpenAPI/Swagger)
- Add authentication & RBAC

⸻

## Why a Service Catalogue?

A service catalogue helps you:
- Visualise service dependencies & events
- Centralise responsibility and metadata (team, domain, owner)
- Generate architecture diagrams
- Enforce governance and metadata consistency

This aligns with industry best practice for microservices and service ownership documentation (e.g., GitHub’s use of service-owner mappings) — centralising info improves clarity and reliability.

⸻

## License

This project is open source — feel free to reuse and adapt.