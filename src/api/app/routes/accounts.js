import express from 'express';
import crypto from 'crypto';
import { requireAdminKey } from '../lib/auth/apikey.middleware.js';
import MongoDb from '../lib/storage/Mongodb.js';

const router = express.Router();
const storage = new MongoDb();

const generateApiKey = () => crypto.randomBytes(32).toString('hex');
const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

// Create account — returns the raw API key once (never stored)
router.post('/', requireAdminKey, async (req, res) => {
    const { tenantId, companyName, billingEmail, plan = 'pro' } = req.body;

    if (!tenantId || !companyName || !billingEmail) {
        return res.status(400).json({ error: 'tenantId, companyName, and billingEmail are required' });
    }

    try {
        const existing = await storage.getAccount(tenantId);
        if (existing) {
            return res.status(409).json({ error: `Account '${tenantId}' already exists` });
        }

        const rawKey = generateApiKey();
        await storage.createAccount({
            tenantId,
            companyName,
            billingEmail,
            apiKeyHash: hashKey(rawKey),
            plan,
            createdAt: new Date(),
            apiKeyRotatedAt: new Date(),
            active: true
        });

        res.status(201).json({ tenantId, companyName, billingEmail, plan, apiKey: rawKey });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// List all accounts (hashes never returned)
router.get('/', requireAdminKey, async (req, res) => {
    try {
        const accounts = await storage.getAllAccounts();
        res.json(accounts.map(({ apiKeyHash, ...rest }) => rest));
    } catch (err) {
        res.status(500).json({ error: 'Failed to list accounts' });
    }
});

// Get a single account
router.get('/:tenantId', requireAdminKey, async (req, res) => {
    try {
        const account = await storage.getAccount(req.params.tenantId);
        if (!account) return res.status(404).json({ error: 'Not found' });
        const { apiKeyHash, ...rest } = account;
        res.json(rest);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get account' });
    }
});

// Deactivate account (soft delete — keeps data)
router.delete('/:tenantId', requireAdminKey, async (req, res) => {
    try {
        const result = await storage.updateAccount(req.params.tenantId, { active: false });
        if (!result) return res.status(404).json({ error: 'Not found' });
        res.json({ message: `Account '${req.params.tenantId}' deactivated` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to deactivate account' });
    }
});

// Rotate API key — returns the new raw key once
router.post('/:tenantId/rotate', requireAdminKey, async (req, res) => {
    try {
        const account = await storage.getAccount(req.params.tenantId);
        if (!account) return res.status(404).json({ error: 'Not found' });

        const rawKey = generateApiKey();
        await storage.updateAccount(req.params.tenantId, { apiKeyHash: hashKey(rawKey), apiKeyRotatedAt: new Date() });

        res.json({ tenantId: req.params.tenantId, apiKey: rawKey });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rotate API key' });
    }
});

// Usage report for billing — defaults to current calendar month
router.get('/:tenantId/usage', requireAdminKey, async (req, res) => {
    try {
        const account = await storage.getAccount(req.params.tenantId);
        if (!account) return res.status(404).json({ error: 'Not found' });

        const now = new Date();
        const from = req.query.from
            ? new Date(req.query.from)
            : new Date(now.getFullYear(), now.getMonth(), 1);
        const to = req.query.to ? new Date(req.query.to) : now;

        const usage = await storage.getUsage(req.params.tenantId, from, to);
        res.json({ tenantId: req.params.tenantId, from, to, ...usage });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get usage' });
    }
});

// Migrate pre-existing service documents (no tenantId) to a tenant
router.post('/:tenantId/migrate', requireAdminKey, async (req, res) => {
    try {
        const account = await storage.getAccount(req.params.tenantId);
        if (!account) return res.status(404).json({ error: 'Account not found — create it first' });

        const result = await storage.migrateToTenant(req.params.tenantId);
        res.json({ message: 'Migration complete', modified: result.nModified });
    } catch (err) {
        res.status(500).json({ error: 'Migration failed' });
    }
});

export default router;
