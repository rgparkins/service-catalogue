import express from 'express';
import crypto from 'crypto';
import MongoDb from '../lib/storage/Mongodb.js';
import { KeycloakAdminClient } from '../lib/auth/keycloak-admin.js';

const router = express.Router();
const storage = new MongoDb();

const generateApiKey = () => crypto.randomBytes(32).toString('hex');
const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

function validateTenantId(tenantId) {
  // Keep it URL-safe and consistent with existing routes.
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(tenantId);
}

// Public self-serve tenant creation + tenant-admin user creation in Keycloak.
// Sends a Keycloak "update password" email (requires Keycloak SMTP configuration).
router.post('/signup', async (req, res) => {
  const tenantId = String(req.body?.tenantId || '').trim();
  const companyName = String(req.body?.companyName || '').trim() || tenantId;
  const billingEmail = normalizeEmail(req.body?.billingEmail);
  const adminEmail = normalizeEmail(req.body?.adminEmail);
  const adminName = String(req.body?.adminName || '').trim() || null;

  if (!tenantId || !adminEmail) {
    return res.status(400).json({ error: 'tenantId and adminEmail are required' });
  }
  if (!validateTenantId(tenantId)) {
    return res.status(400).json({ error: 'Invalid tenantId (use letters/numbers/_/-; 3-64 chars)' });
  }
  if (!adminEmail.includes('@')) {
    return res.status(400).json({ error: 'Invalid adminEmail' });
  }

  try {
    const existing = await storage.getAccount(tenantId);
    if (existing) return res.status(409).json({ error: `Account '${tenantId}' already exists` });

    // Create tenant account (default plan: free)
    const rawKey = generateApiKey();
    await storage.createAccount({
      tenantId,
      companyName,
      billingEmail: billingEmail || adminEmail,
      apiKeyHash: hashKey(rawKey),
      plan: 'free',
      createdAt: new Date(),
      apiKeyRotatedAt: new Date(),
      active: true,
    });

    // Create Keycloak user and add to tenant-admin group
    const requireKeycloak = String(process.env.PUBLIC_SIGNUP_REQUIRE_KEYCLOAK || '').toLowerCase() === 'true';
    let kc;
    try {
      kc = new KeycloakAdminClient();
    } catch (kcErr) {
      if (requireKeycloak) throw kcErr;
      return res.status(201).json({
        tenantId,
        adminEmail,
        message:
          'Tenant created, but user setup email could not be sent (Keycloak admin is not configured).',
      });
    }

    const { id: userId } = await kc.createUser({
      email: adminEmail,
      name: adminName,
      username: adminEmail,
      requiredActions: ['UPDATE_PASSWORD'],
    });

    const groupName = `tenant:${tenantId}:admin`;
    const { id: groupId } = await kc.findOrCreateGroup(groupName);
    await kc.addUserToGroup(userId, groupId);

    // Trigger password setup email (Keycloak SMTP must be configured)
    const clientId = process.env.KEYCLOAK_WEB_CLIENT_ID || 'service-catalogue-web';
    const redirectUri = process.env.PUBLIC_APP_URL
      ? `${process.env.PUBLIC_APP_URL.replace(/\/+$/, '')}/tenants`
      : undefined;

    try {
      await kc.executeActionsEmail(userId, { clientId, redirectUri, lifespanSeconds: 60 * 60 });
      return res.status(201).json({
        tenantId,
        adminEmail,
        message: 'Tenant created. Check your email to set your password.',
      });
    } catch (emailErr) {
      // Tenant and user are created, but email delivery failed (common if SMTP not configured).
      console.error(emailErr);
      return res.status(201).json({
        tenantId,
        adminEmail,
        message:
          'Tenant created, but password-setup email could not be sent (Keycloak SMTP may be unconfigured).',
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create tenant' });
  }
});

export default router;
