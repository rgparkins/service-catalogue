import express from 'express';
import MongoDb from '../lib/storage/Mongodb.js';
import { requireAdminKey, requireApiKey } from '../lib/auth/apikey.middleware.js';
import { requireUser, userHasRole, userHasTenantAdmin } from '../lib/auth/keycloak.middleware.js';

const router = express.Router();
const storage = new MongoDb();

router.get('/tenants/count', requireAdminKey, async (req, res) => {
  try {
    const tenantCount = await storage.countActiveTenants();
    res.status(200).json({ tenantCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load admin stats' });
  }
});

router.get('/tenants', requireAdminKey, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 24));
    const skip = (page - 1) * pageSize;

    const [total, tenants] = await Promise.all([
      storage.countActiveTenants(),
      storage.listActiveTenants({ skip, limit: pageSize }),
    ]);

    res.status(200).json({ page, pageSize, total, tenants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tenants' });
  }
});

router.get('/tenants/:tenantId/usage', requireAdminKey, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to) : now;
    const endpointPrefix = req.query.endpointPrefix ? String(req.query.endpointPrefix) : null;
    const method = req.query.method ? String(req.query.method) : null;
    const usage = await storage.getUsage(tenantId, from, to, { endpointPrefix, method });
    res.status(200).json({ tenantId, from, to, ...usage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

router.get('/tenants/:tenantId/usage/timeseries', requireAdminKey, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to) : now;
    const endpointPrefix = req.query.endpointPrefix ? String(req.query.endpointPrefix) : null;
    const bucket = ['minute1', 'minute5', 'minute15', 'minute30', 'hour', 'day'].includes(String(req.query.bucket))
      ? String(req.query.bucket)
      : 'hour';

    const series = await storage.getUsageTimeseries(tenantId, from, to, { endpointPrefix, bucket });
    res.status(200).json({ tenantId, from, to, bucket, series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load usage timeseries' });
  }
});

// Tenant-scoped usage endpoints (no admin key) — use Bearer tenant API key (or X-Tenant-Id in dev mode)
router.get('/usage', requireApiKey, async (req, res) => {
  try {
    const tenantId = req.tenant?.tenantId ?? null;
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to) : now;
    const endpointPrefix = req.query.endpointPrefix ? String(req.query.endpointPrefix) : null;
    const method = req.query.method ? String(req.query.method) : null;
    const usage = await storage.getUsage(tenantId, from, to, { endpointPrefix, method });
    res.status(200).json({ tenantId, from, to, ...usage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

router.get('/usage/timeseries', requireApiKey, async (req, res) => {
  try {
    const tenantId = req.tenant?.tenantId ?? null;
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to) : now;
    const endpointPrefix = req.query.endpointPrefix ? String(req.query.endpointPrefix) : null;
    const bucket = ['minute1', 'minute5', 'minute15', 'minute30', 'hour', 'day'].includes(String(req.query.bucket))
      ? String(req.query.bucket)
      : 'hour';
    const series = await storage.getUsageTimeseries(tenantId, from, to, { endpointPrefix, bucket });
    res.status(200).json({ tenantId, from, to, bucket, series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load usage timeseries' });
  }
});

// User-authenticated usage endpoints (Keycloak). Authorizes per-tenant admin or global-admin.
router.get('/ui/tenants/:tenantId/usage', requireUser, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const ok = userHasRole(req.user, 'global-admin') || userHasTenantAdmin(req.user, tenantId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to) : now;
    const endpointPrefix = req.query.endpointPrefix ? String(req.query.endpointPrefix) : null;
    const method = req.query.method ? String(req.query.method) : null;
    const usage = await storage.getUsage(tenantId, from, to, { endpointPrefix, method });
    res.status(200).json({ tenantId, from, to, ...usage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

router.get('/ui/tenants/:tenantId/usage/timeseries', requireUser, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const ok = userHasRole(req.user, 'global-admin') || userHasTenantAdmin(req.user, tenantId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to) : now;
    const endpointPrefix = req.query.endpointPrefix ? String(req.query.endpointPrefix) : null;
    const bucket = ['minute1', 'minute5', 'minute15', 'minute30', 'hour', 'day'].includes(String(req.query.bucket))
      ? String(req.query.bucket)
      : 'hour';

    const series = await storage.getUsageTimeseries(tenantId, from, to, { endpointPrefix, bucket });
    res.status(200).json({ tenantId, from, to, bucket, series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load usage timeseries' });
  }
});

export default router;
