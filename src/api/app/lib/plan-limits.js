const DEFAULTS = {
  free: {
    validatePerMinute: 30,
    servicesWritePerMinute: 10,
  },
  pro: {
    validatePerMinute: 300,
    servicesWritePerMinute: 60,
  },
  enterprise: {
    validatePerMinute: 1000,
    servicesWritePerMinute: 300,
  },
};

function normalizePlan(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'enterprise') return 'enterprise';
  if (p === 'pro' || p === 'company') return 'pro';
  return 'free';
}

// Small in-memory cache: tenantId -> { plan, until }
const planCache = new Map();
const PLAN_CACHE_TTL_MS = 60_000;

export function getTenantPlan(req) {
  const tenantId = req.tenant?.tenantId;
  const planFromAuth = req.tenant?.plan;

  if (!tenantId) return normalizePlan(planFromAuth);

  const cached = planCache.get(tenantId);
  const now = Date.now();
  if (cached && cached.until > now) return cached.plan;

  const plan = normalizePlan(planFromAuth);
  planCache.set(tenantId, { plan, until: now + PLAN_CACHE_TTL_MS });
  return plan;
}

export function getPlanLimits(req) {
  const plan = getTenantPlan(req);
  return DEFAULTS[plan] || DEFAULTS.free;
}

