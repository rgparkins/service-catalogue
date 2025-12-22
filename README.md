# Service Catalogue

A lightweight in-memory service catalogue API and tooling for managing metadata about microservices — service names, domains, dependencies, published/consumed events, and more.

This project includes:
	•	A Node.js/Express API for CRUD operations on services
	•	A RESTful interface supporting creation, replacement (PUT), listing, and deletion
	•	Metadata (created/updated/version) entirely managed by the server

Data is stored in memory by default — ideal for local development, demos, prototyping, and integration into visualisation tools (e.g., frontend graph UI).

⸻

🚀 Features
	•	REST API
	•	POST /services — Create a service (server assigns metadata)
	•	PUT /services/:name — Replace service by name
	•	GET /services — List all services
	•	GET /services/:name — Retrieve a single service
	•	DELETE /services/:name — Remove a service
	•	Automatic server-generated metadata
	•	createdAt, updatedAt, and semantic version (v1, v2, …)
	•	Input validation
	•	Rejects requests with invalid shape or client-provided metadata
	•	Uses Zod for robust runtime validation

⸻

🧱 Getting Started

Prerequisites
	•	Node.js (v16+ recommended)
	•	npm

Install

git clone https://github.com/rgparkins/service-catalogue.git
cd service-catalogue/service-catalog
npm install


⸻

🏃‍♂️ Run Locally

npm run dev

or

node server.js

By default, the API will listen on http://localhost:3000.

⸻

🧠 API Endpoints

Health check

GET /health

Returns:

{ "ok": true }


⸻

Create a service

POST /services

Body (JSON) — no metadata (server generates that):

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


⸻

Replace an existing service

PUT /services/learner-profile-service

Body must match the same service shape (except metadata).

The server will:
	•	update updatedAt
	•	bump the version (e.g., v1 → v2)
	•	keep createdAt unchanged

⸻

List all services

GET /services

Get a single service

GET /services/:name

Delete a service

DELETE /services/:name


⸻

🧪 Testing

This project includes Supertest + Jest unit tests that exercise core endpoints.

To run tests:

npm test

Tests cover:
	•	creating services
	•	enforcing unique names
	•	PUT replace behavior
	•	rejection of metadata from clients
	•	list/query endpoints

⸻

🧩 Schema Validation

Input validation uses Zod schemas defined in schema.js:
	•	ServiceInputSchema — accepted input shape
	•	ServiceStoredSchema — stored shape including server metadata

Any invalid request returns detailed errors.

⸻

🧠 Metadata Rules

Metadata is fully managed by the server:

Field	Meaning
createdAt	Date service was first created (ISO date)
updatedAt	Last update date (ISO date)
version	Semantic increment (v1, v2, v3…)

Clients must not include metadata in POST/PUT — requests with metadata will be rejected.

⸻

🧪 In-Memory Storage (Default)
	•	Data lives in the running process (no DB).
	•	Restarting the server resets data.
	•	Useful for:
	•	prototyping
	•	demos
	•	local integration with graph UIs

To add persistence later, you can swap the in-memory map with JSON file storage or a lightweight database (SQLite / MongoDB).

⸻

🛠 Extending

Suggestions
	•	Add query filtering (by domain, team, events)
	•	Add pagination to listing
	•	Add shareable service graph export
	•	Add API docs (OpenAPI/Swagger)
	•	Persist data to disk/db
	•	Add auth & RBAC

⸻

💬 Why a Service Catalogue?

A service catalogue helps you:
	•	visualise service dependencies & events
	•	centralise responsibility and metadata (team, domain, owner)
	•	generate architecture diagrams
	•	enforce governance and metadata consistency

This aligns with industry best practice for microservices and service ownership documentation (e.g., GitHub’s use of service-owner mappings) — centralising info improves clarity and reliability.  ￼

⸻

📦 License

This project is open source — feel free to reuse and adapt.