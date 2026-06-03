import express from 'express';
import MongoDb from '../lib/storage/Mongodb.js';
import { requireUser, userHasRole, userHasTenantAdmin } from '../lib/auth/keycloak.middleware.js';

const router = express.Router();
const storage = new MongoDb();

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

function pickUserProfileFromToken(user) {
  const email = user?.email ? String(user.email) : null;
  const name =
    user?.name ? String(user.name) :
    user?.preferred_username ? String(user.preferred_username) :
    null;
  return { sub: user?.sub, email, name };
}

function requireTenantAdminOrGlobal(req, res, tenantId) {
  const ok = userHasRole(req.user, 'admin') || userHasRole(req.user, 'global-admin') || userHasTenantAdmin(req.user, tenantId);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

router.get('/me', requireUser, async (req, res) => {
  try {
    const profile = pickUserProfileFromToken(req.user);
    if (!profile.sub) return res.status(400).json({ error: 'Missing subject' });

    const userDoc = await storage.upsertUser({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
    });

    if (profile.email) {
      await storage.attachSubToEmailTenants({ sub: profile.sub, email: profile.email });
    }

    const tenantAssignments = await storage.listUserTenantsByEmail(profile.email);

    return res.status(200).json({
      user: userDoc,
      roles: req.user?.realm_access?.roles || [],
      groups: req.user?.groups || [],
      tenantAssignments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
});

router.get('/users', requireUser, async (req, res) => {
  try {
    if (!userHasRole(req.user, 'admin') && !userHasRole(req.user, 'global-admin')) return res.status(403).json({ error: 'Forbidden' });
    const users = await storage.listUsers();
    return res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load users' });
  }
});

router.get('/invites', requireUser, async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    if (!email) return res.status(400).json({ error: 'Token missing email claim' });
    const invites = await storage.listInvitesForEmail(email);
    return res.status(200).json({ email, invites });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load invites' });
  }
});

router.post('/invites/:token/accept', requireUser, async (req, res) => {
  try {
    const token = String(req.params.token || '');
    const profile = pickUserProfileFromToken(req.user);
    const sub = profile.sub;
    const email = normalizeEmail(profile.email);
    if (!token) return res.status(400).json({ error: 'Missing token' });
    if (!sub) return res.status(400).json({ error: 'Missing subject' });
    if (!email) return res.status(400).json({ error: 'Token missing email claim' });

    await storage.upsertUser({ sub, email, name: profile.name });

    const pending = await storage.getInviteByToken(token);
    if (!pending) return res.status(404).json({ error: 'Invite not found' });
    if (normalizeEmail(pending.email) !== email) {
      return res.status(403).json({
        error: 'Invite email does not match your logged-in account',
        loggedInEmail: email,
      });
    }

    const invite = await storage.acceptInvite({ token, sub });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    await storage.assignUserToTenant({ email, tenantId: invite.tenantId, role: invite.role });
    return res.status(200).json({ invite });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Failed to accept invite',
      reason: String(err?.message || err),
    });
  }
});

router.get('/tenants/:tenantId/users', requireUser, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!requireTenantAdminOrGlobal(req, res, tenantId)) return;
    const users = await storage.listTenantUsers(tenantId);
    return res.status(200).json({ tenantId, users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load tenant users' });
  }
});

router.get('/tenants/:tenantId/invites', requireUser, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!requireTenantAdminOrGlobal(req, res, tenantId)) return;
    const invites = await storage.listInvitesForTenant(tenantId);
    return res.status(200).json({ tenantId, invites });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load tenant invites' });
  }
});

router.post('/tenants/:tenantId/invites', requireUser, async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    if (!requireTenantAdminOrGlobal(req, res, tenantId)) return;

    const email = normalizeEmail(req.body?.email);
    const rawRole = String(req.body?.role || 'tenant-user');
    const role =
      rawRole === 'member' ? 'tenant-user' :
      rawRole === 'admin' ? 'tenant-admin' :
      rawRole;
    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!['tenant-user', 'tenant-admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const invite = await storage.createInvite({
      tenantId,
      email,
      role,
      invitedBySub: req.user?.sub || null,
    });

    return res.status(201).json({ invite });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create invite' });
  }
});

export default router;
