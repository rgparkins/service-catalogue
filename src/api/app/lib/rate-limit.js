// Simple in-memory fixed-window rate limiter.
// Intended for single-instance deployments / dev. For multi-instance, move to Redis.

export function createFixedWindowRateLimiter({
  windowMs,
  max,
  keyFn,
  skipFn,
  onLimit,
} = {}) {
  if (!windowMs || !max) {
    throw new Error('createFixedWindowRateLimiter requires windowMs and max');
  }

  const hits = new Map(); // key -> { count, resetAt }

  const getKey = keyFn || ((req) => req.tenant?.tenantId || req.ip || 'anonymous');
  const shouldSkip = skipFn || (() => false);
  const onLimited =
    onLimit ||
    ((req, res, retryAfterSec) => {
      res.set('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: 'Rate limit exceeded' });
    });

  return function rateLimit(req, res, next) {
    try {
      if (shouldSkip(req)) return next();

      const now = Date.now();
      const key = String(getKey(req));
      const limit = typeof max === 'function' ? Number(max(req)) : Number(max);
      if (!Number.isFinite(limit) || limit <= 0) {
        return next();
      }

      let entry = hits.get(key);
      if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }

      entry.count += 1;
      if (entry.count > limit) {
        const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        return onLimited(req, res, retryAfterSec);
      }

      return next();
    } catch (e) {
      return next(e);
    }
  };
}
