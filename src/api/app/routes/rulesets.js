import express from 'express';
import MongoDb from '../lib/storage/Mongodb.js';
import { requireApiKey } from '../lib/auth/apikey.middleware.js';

const router = express.Router();
const storage = new MongoDb();

router.use(requireApiKey);

const normalizeString = (v) => String(v || '').trim();

router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenant?.tenantId ?? null;
    const rulesets = await storage.listRulesets(tenantId);
    res.status(200).json({ tenantId, rulesets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list rulesets' });
  }
});

router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenant?.tenantId ?? null;
    const name = normalizeString(req.body?.name);
    const field = normalizeString(req.body?.field);
    const pattern = normalizeString(req.body?.pattern);
    const enabled = req.body?.enabled !== undefined ? !!req.body.enabled : true;
    const description = normalizeString(req.body?.description);

    if (!name || !field || !pattern) {
      return res.status(400).json({ error: 'name, field, and pattern are required' });
    }

    try {
      // Validate regex is compilable
      // eslint-disable-next-line no-new
      new RegExp(pattern);
    } catch {
      return res.status(400).json({ error: 'Invalid regex pattern' });
    }

    const created = await storage.createRuleset({ tenantId, name, field, pattern, enabled, description });
    res.status(201).json({ tenantId, ruleset: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create ruleset' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.tenant?.tenantId ?? null;
    const id = normalizeString(req.params.id);
    if (!id) return res.status(400).json({ error: 'Missing id' });

    if (req.body?.pattern !== undefined) {
      try {
        // eslint-disable-next-line no-new
        new RegExp(String(req.body.pattern));
      } catch {
        return res.status(400).json({ error: 'Invalid regex pattern' });
      }
    }

    const updated = await storage.updateRuleset(tenantId, id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ tenantId, ruleset: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ruleset' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenant?.tenantId ?? null;
    const id = normalizeString(req.params.id);
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const ok = await storage.deleteRuleset(tenantId, id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ tenantId, deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete ruleset' });
  }
});

export default router;

