import express from 'express';
const router = express.Router();
import validator from '../lib/schema-validator.js';
import MongoDb from '../lib/storage/Mongodb.js';
import { requireApiKey } from '../lib/auth/apikey.middleware.js';
import { createFixedWindowRateLimiter } from '../lib/rate-limit.js';
import { getPlanLimits } from '../lib/plan-limits.js';

const storage = new MongoDb();

// Optional tenant identification for usage logging.
// In dev-mode (no ADMIN_API_KEY), requireApiKey sets a default tenant or uses X-Tenant-Id.
// In prod-mode, it enforces Bearer API key for tenant-specific stats on validate endpoints.
router.use(requireApiKey);

const validateLimiter = createFixedWindowRateLimiter({
    windowMs: 60_000,
    max: (req) => {
        const override = process.env.RATE_LIMIT_VALIDATE_PER_MINUTE;
        if (override) return parseInt(override, 10);
        return getPlanLimits(req).validatePerMinute;
    },
    keyFn: (req) => req.tenant?.tenantId || req.ip || 'anonymous',
});

router.get('/schemas', async (req, res) => {
    try {
        const schemas = await validator.listSchemas();
        res.json(schemas);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to list schemas' });
    }
});

router.post('/schemas', async (req, res) => {
    try {
        const content = req.body;
        const version = content?.version;
        if (!version) {
            return res.status(400).json({ error: 'Schema must include a version field' });
        }

        const name = req.body?.name || `schema-${version}.json`;
        await storage.upsertSchema({
            status: 'draft',
            version,
            name,
            content,
            createdAt: new Date()
        });

        await validator.reloadFromDb();
        res.status(201).json({ version });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create schema' });
    }
});

router.put('/schemas/:version', async (req, res) => {
    try {
        const version = req.params.version;
        const existing = await storage.getSchema(version);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (existing.status === 'live' || existing.status === 'superseded') {
            return res.status(409).json({ error: `Schema '${version}' is ${existing.status} and cannot be edited` });
        }

        const content = req.body;
        if (content?.version && content.version !== version) {
            return res.status(400).json({ error: 'Schema version cannot be changed' });
        }

        await storage.updateSchema(version, {
            name: req.body?.name || existing.name || `schema-${version}.json`,
            content
        });
        await validator.reloadFromDb();
        res.status(200).json({ version });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update schema' });
    }
});

router.delete('/schemas/:version', async (req, res) => {
    try {
        const version = req.params.version;
        const existing = await storage.getSchema(version);
        if (!existing) return res.status(404).json({ error: 'Not found' });
        if (existing.status === 'live' || existing.status === 'superseded') {
            return res.status(409).json({ error: `Schema '${version}' is ${existing.status} and cannot be removed` });
        }
        const inUse = await storage.isSchemaInUse({ version: existing.version, name: existing.name });
        if (inUse) {
            return res.status(409).json({ error: `Schema '${version}' is referenced by submitted metadata and cannot be removed` });
        }
        const deleted = await storage.deleteSchema(version);
        await validator.reloadFromDb();
        res.status(200).json({ deleted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete schema' });
    }
});

router.post('/schemas/:version/live', async (req, res) => {
    try {
        const version = req.params.version;
        const existing = await storage.getSchema(version);
        if (!existing) return res.status(404).json({ error: 'Not found' });

        // Mark any currently live schema as superseded
        const all = await storage.listSchemas();
        await Promise.all(
            (all || [])
                .filter((s) => s.status === 'live' && s.version !== version)
                .map((s) => storage.updateSchema(s.version, { status: 'superseded' }))
        );

        await storage.updateSchema(version, { status: 'live' });
        await validator.reloadFromDb();
        res.status(200).json({ version, status: 'live' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to set schema live' });
    }
});

router.get('/schema/:version?', (req, res) => {
    let content = validator.fetchSchema(req.params.version || 'latest');

    if (content){
        res.json(content);
    } else {
        res.status(404)
            .send('Not Found');
    }
});

router.post('/validate/:version', validateLimiter, (req, res) => {
    if (validator.fetchSchema(req.params.version)) {
        validator.validateAgainstVersion(req.body, req.params.version, (success, result) => {
            if (success) {
                res.status(200)
                    .send('OK')
            } else {
                res.status(400)
                    .json(result);
            }

        })
    } else {
        res.status(404).send('Not found');
    }
});

router.post('/validate', validateLimiter, (req, res) => {
    validator.validate(req.body, (success, version, result) => {
        if (success) {
            if (result) {
                res.status(200)
                    .send('OK')
            } else {
                res.status(202)
                    .send('Accepted')
            }
        } else {
            res.status(400)
                .json(result);
        }
    })
});

export default router;
