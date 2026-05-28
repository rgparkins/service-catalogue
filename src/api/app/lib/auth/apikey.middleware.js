import crypto from 'crypto';
import MongoDb from '../storage/Mongodb.js';

const storage = new MongoDb();
const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

// Protects service routes — requires a valid tenant API key.
// If ADMIN_API_KEY is not set (dev mode), bypasses auth and uses a default tenant.
export const requireApiKey = async (req, res, next) => {
    if (!process.env.ADMIN_API_KEY) {
        req.tenant = { tenantId: null, companyName: 'Default' };
        return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing API key' });
    }

    try {
        const account = await storage.getAccountByKeyHash(hashKey(authHeader.slice(7)));
        if (!account || !account.active) {
            return res.status(401).json({ error: 'Invalid or inactive API key' });
        }

        req.tenant = account;

        res.on('finish', () => {
            storage.recordUsage(account.tenantId, req.path, req.method, res.statusCode)
                .catch(console.error);
        });

        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Protects admin routes (account management).
// Requires the ADMIN_API_KEY env var in the Authorization header.
export const requireAdminKey = (req, res, next) => {
    if (!process.env.ADMIN_API_KEY) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing admin key' });
    }

    if (authHeader.slice(7) !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ error: 'Invalid admin key' });
    }

    next();
};
