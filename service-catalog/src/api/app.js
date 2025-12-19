import express from "express";
import { z } from "zod";

// ----------------------
// Validation (client payload)
// ----------------------
const NonEmptyString = z.string().trim().min(1);

const ContractSchema = z.object({
  role: z.string().optional(),
  protocol: z.string().optional(),
  url: z.string().optional(),
}).passthrough();

const DependencySchema = z.object({
  name: NonEmptyString,
  role: z.string().optional(),
  protocol: z.string().optional(),
}).passthrough();

const EventSchema = z.object({
  name: NonEmptyString,
  description: z.string().optional(),
}).passthrough();

// NOTE: metadata is intentionally omitted (server-owned)
const ServiceInputSchema = z.object({
  name: NonEmptyString,

  domain: z.string().optional(),
  team: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  vision: z.string().optional(),

  contracts: z.array(ContractSchema).optional(),

  dependencies: z.object({
    critical: z.array(DependencySchema).optional(),
    "non-critical": z.array(DependencySchema).optional(),
  }).optional(),

  events: z.object({
    producing: z.array(EventSchema).optional(),
    consuming: z.array(EventSchema).optional(),
  }).optional(),
}).strict();

// What we store/return (includes server metadata)
const ServiceStoredSchema = ServiceInputSchema.extend({
  metadata: z.object({
    createdAt: z.string(),  // ISO yyyy-mm-dd
    updatedAt: z.string(),  // ISO yyyy-mm-dd
    version: z.string(),    // server-controlled
  }),
});

// ----------------------
// In-memory store
// ----------------------
const store = new Map(); // name -> stored service

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Simple server-side versioning: v1, v2, v3...
function bumpVersion(prevVersion) {
  if (!prevVersion) return "v1";
  const m = /^v(\d+)$/.exec(prevVersion);
  if (!m) return "v1";
  return `v${Number(m[1]) + 1}`;
}

function rejectIfMetadataProvided(body) {
  if (body && typeof body === "object" && "metadata" in body) {
    return {
      ok: false,
      message: "Do not send 'metadata' in the request body. Metadata is server-generated."
    };
  }
  return null;
}

// ----------------------
// App
// ----------------------
export const app = express();
app.use(express.json({ limit: "1mb" }));

// handy for tests: reset store between tests
export function __resetStoreForTests() {
  store.clear();
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/services", (_req, res) => {
  res.json(Array.from(store.values()));
});

app.get("/services/:name", (req, res) => {
  const svc = store.get(req.params.name);
  if (!svc) return res.status(404).json({ ok: false, message: "Not found" });
  res.json(svc);
});

app.post("/services", (req, res) => {
  const metaErr = rejectIfMetadataProvided(req.body);
  if (metaErr) return res.status(400).json(metaErr);

  const parsed = ServiceInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Validation failed",
      issues: parsed.error.issues,
    });
  }

  const input = parsed.data;

  if (store.has(input.name)) {
    return res.status(409).json({
      ok: false,
      message: `Service '${input.name}' already exists`,
    });
  }

  const now = todayISO();
  const stored = {
    ...input,
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: "v1",
    },
  };

  const check = ServiceStoredSchema.safeParse(stored);
  if (!check.success) {
    return res.status(500).json({ ok: false, message: "Internal schema error" });
  }

  store.set(input.name, stored);
  res.status(201).json({ ok: true, service: stored });
});

app.put("/services/:name", (req, res) => {
  const nameFromUrl = req.params.name;

  const metaErr = rejectIfMetadataProvided(req.body);
  if (metaErr) return res.status(400).json(metaErr);

  const parsed = ServiceInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Validation failed",
      issues: parsed.error.issues,
    });
  }

  const input = parsed.data;

  if (input.name !== nameFromUrl) {
    return res.status(400).json({
      ok: false,
      message: "Service name in URL must match body.name",
    });
  }

  const existing = store.get(nameFromUrl);
  if (!existing) {
    return res.status(404).json({
      ok: false,
      message: `Service '${nameFromUrl}' not found`,
    });
  }

  const now = todayISO();
  const stored = {
    ...input,
    metadata: {
      createdAt: existing.metadata.createdAt,
      updatedAt: now,
      version: bumpVersion(existing.metadata.version),
    },
  };

  const check = ServiceStoredSchema.safeParse(stored);
  if (!check.success) {
    return res.status(500).json({ ok: false, message: "Internal schema error" });
  }

  store.set(nameFromUrl, stored);
  res.json({ ok: true, service: stored });
});

app.delete("/services/:name", (req, res) => {
  const existed = store.delete(req.params.name);
  if (!existed) return res.status(404).json({ ok: false, message: "Not found" });
  res.json({ ok: true });
});