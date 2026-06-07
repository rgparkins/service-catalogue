import express from 'express';
import crypto from 'crypto';
import MongoDb from '../lib/storage/Mongodb.js';
import { KeycloakAdminClient } from '../lib/auth/keycloak-admin.js';
import { publish } from '../lib/messaging/publisher.js';

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
// New flow:
// 1) Create tenant + user profile in platform DB
// 2) Send registration link email
// 3) User completes registration, then we create the Keycloak user + group membership
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

    await storage.upsertUser({ email: adminEmail, name: adminName });

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

    const reg = await storage.createRegistration({ tenantId, email: adminEmail, name: adminName, role: 'tenant-admin' });
    const base = process.env.PUBLIC_APP_URL ? process.env.PUBLIC_APP_URL.replace(/\/+$/, '') : 'http://localhost:5173';
    const registrationLink = `${base}/register/complete?token=${encodeURIComponent(reg.token)}`;

    await publish('registration.created', {
      tenantId,
      email: adminEmail,
      name: adminName,
      registrationLink,
      token: reg.token,
    });

    return res.status(201).json({
      tenantId,
      adminEmail,
      message: 'Tenant created. Check your email to complete registration.',
      ...(String(process.env.EXPOSE_REGISTRATION_LINK || '').toLowerCase() === 'true'
        ? { registrationLink, registrationToken: reg.token }
        : {}),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create tenant' });
  }
});

router.get('/registration/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    const reg = await storage.getRegistration(token);
    if (!reg) return res.status(404).json({ error: 'Not found' });
    if (reg.status !== 'pending') return res.status(409).json({ error: `Registration is ${reg.status}` });
    return res.status(200).json({ tenantId: reg.tenantId, email: reg.email, name: reg.name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load registration' });
  }
});

router.post('/registration/:token/complete', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    const password = String(req.body?.password || '');
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const reg = await storage.getRegistration(token);
    if (!reg) return res.status(404).json({ error: 'Not found' });
    if (reg.status !== 'pending') return res.status(409).json({ error: `Registration is ${reg.status}` });

    const kc = new KeycloakAdminClient();
    const { id: userId } = await kc.createUser({
      email: reg.email,
      name: reg.name,
      username: reg.email,
      requiredActions: [],
    });
    await kc.setUserPassword(userId, password, { temporary: false });

    const groupName = `tenant:${reg.tenantId}:admin`;
    const { id: groupId } = await kc.findOrCreateGroup(groupName);
    await kc.addUserToGroup(userId, groupId);

    await storage.assignUserToTenant({ tenantId: reg.tenantId, email: reg.email, role: reg.role || 'tenant-admin' });
    await storage.completeRegistration({ token, keycloakUserId: userId });

    return res.status(200).json({ message: 'Registration complete. You can now log in.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to complete registration', reason: String(err?.message || err) });
  }
});

// Invite-based onboarding:
// 1) user gets invite token link
// 2) user sets password (Keycloak user created/updated)
// 3) invite is marked accepted and tenant role is recorded for claim on first login
router.get('/invites/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    const inv = await storage.getInviteByToken(token);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ tenantId: inv.tenantId, email: inv.email, role: inv.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load invite' });
  }
});

router.post('/invites/:token/complete', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || null;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const inv = await storage.getInviteByToken(token);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    // Ensure a platform user profile exists
    await storage.upsertUser({ email: inv.email, name: name || inv.name || null });

    // Create/update Keycloak user and set password
    const kc = new KeycloakAdminClient();
    const { id: userId } = await kc.createUser({
      email: inv.email,
      name: name || inv.name || null,
      username: inv.email,
      requiredActions: [],
    });
    await kc.setUserPassword(userId, password, { temporary: false });

    // Tenant-admins get group membership for UI authorization
    if ((inv.role || '') === 'tenant-admin') {
      const groupName = `tenant:${inv.tenantId}:admin`;
      const { id: groupId } = await kc.findOrCreateGroup(groupName);
      await kc.addUserToGroup(userId, groupId);
    }

    // Record tenant role for claim on first login (maps by email -> sub later)
    await storage.assignUserToTenant({ tenantId: inv.tenantId, email: inv.email, role: inv.role || 'tenant-user' });

    const accepted = await storage.acceptInviteByEmail({ token, email: inv.email, keycloakUserId: userId });
    if (!accepted) return res.status(404).json({ error: 'Invite not found' });

    return res.status(200).json({ message: 'Invite accepted. You can now log in.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to complete invite', reason: String(err?.message || err) });
  }
});

export default router;
