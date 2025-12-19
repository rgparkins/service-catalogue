import request from "supertest";
import { app, __resetStoreForTests } from "../api/app.js";

describe("Service Catalog API", () => {
  beforeEach(() => {
    __resetStoreForTests();
  });

  test("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test("POST /services creates service and server generates metadata", async () => {
    const payload = {
      name: "learner-profile-service",
      domain: "learning",
      team: "core-platform",
      events: { producing: [{ name: "LearnerProfileUpdated" }] }
    };

    const res = await request(app).post("/services").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.service.name).toBe(payload.name);

    // metadata created by server, not client
    expect(res.body.service.metadata).toBeDefined();
    expect(res.body.service.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.service.metadata.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.service.metadata.version).toBe("v1");
  });

  test("POST /services rejects client-provided metadata", async () => {
    const res = await request(app).post("/services").send({
      name: "bad-service",
      metadata: { createdAt: "2020-01-01" }
    });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/Do not send 'metadata'/);
  });

  test("POST /services enforces unique name", async () => {
    const payload = { name: "dup-service" };

    const first = await request(app).post("/services").send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post("/services").send(payload);
    expect(second.status).toBe(409);
  });

  test("PUT /services/:name replaces and bumps version; keeps createdAt", async () => {
    // create
    const create = await request(app).post("/services").send({
      name: "customer-service",
      domain: "customers"
    });
    expect(create.status).toBe(201);

    const createdAt = create.body.service.metadata.createdAt;
    const v1 = create.body.service.metadata.version;
    expect(v1).toBe("v1");

    // replace
    const put = await request(app).put("/services/customer-service").send({
      name: "customer-service",
      domain: "customers",
      team: "data-platform",
      dependencies: { critical: [{ name: "auth-service" }] }
    });

    expect(put.status).toBe(200);
    expect(put.body.ok).toBe(true);
    expect(put.body.service.team).toBe("data-platform");

    // createdAt stable, updatedAt present, version bumped
    expect(put.body.service.metadata.createdAt).toBe(createdAt);
    expect(put.body.service.metadata.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(put.body.service.metadata.version).toBe("v2");
  });

  test("PUT rejects URL/body name mismatch", async () => {
    // create
    await request(app).post("/services").send({ name: "a" });

    const res = await request(app).put("/services/a").send({ name: "b" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/URL must match body\.name/);
  });

  test("GET /services lists stored services", async () => {
    await request(app).post("/services").send({ name: "s1" });
    await request(app).post("/services").send({ name: "s2" });

    const res = await request(app).get("/services");
    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.name).sort()).toEqual(["s1", "s2"]);
  });
});