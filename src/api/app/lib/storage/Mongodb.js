import mongodb from 'mongodb';
const { MongoClient } = mongodb;
import { ErrorHandler } from '../../helpers/error.js';
import crypto from 'crypto';

let config = {
    connection_string: process.env.MONGODB_ATLAS_URI,
    db: 'serviceCatalogue'
};

let generateDoc = (tenantId, serviceName, version, metadata, hosts) => {
    const doc = {
        service: {
            name: serviceName,
            validated_against: version,
            metadata: metadata,
            updated: new Date(),
            status: global.ServiceStatus.LIVE,
            hosts: hosts
        }
    };
    if (tenantId) doc.tenantId = tenantId;
    return doc;
};

const loadDB = async () => {
    try {
        if (global.db_connection) {
            return global.db_connection;
        }

        const client = await MongoClient.connect(config.connection_string);

        global.db_connection = client.db(config.db);

        return global.db_connection;
    } catch (err) {
        console.log(err);
        global.db_connection = null;
        throw new ErrorHandler(500, err);
    }
}

function MongoDb() {
    const tenantFilter = (tenantId) => tenantId ? { tenantId } : {};

    const DEFAULT_PILLARS = {
        Account: ["Newton", "Einstein", "Curie", "Darwin", "Fermi"],
        Data: ["Data Science", "Data Insights", "Data Platforms", "Data Governance"],
    };

    const ensureTeamsSeeded = async () => {
        const db = await loadDB();
        const existing = await db.collection('teams').countDocuments({}).catch(err => {
            global.db_connection = null;
            throw new ErrorHandler(500, err);
        });
        if (existing > 0) return;

        const docs = [];
        Object.keys(DEFAULT_PILLARS).forEach((pillar) => {
            DEFAULT_PILLARS[pillar].forEach((name) => docs.push({ name, pillar }));
        });
        if (docs.length === 0) return;
        await db.collection('teams').insertMany(docs).catch(err => {
            global.db_connection = null;
            throw new ErrorHandler(500, err);
        });
    };

    this.putMetadata = async (serviceName, schema_version, data, hosts, tenantId) => {
        let db = await loadDB();

        let result = await db.collection("service").findOneAndReplace(
            { ...tenantFilter(tenantId), "service.name": { $eq: serviceName } },
            generateDoc(tenantId, serviceName, schema_version, data, hosts),
            { upsert: true, returnNewDocument: false, projection: { _id: 0 } }
        )
            .catch(err => {
                console.log(err);
                global.db_connection = null;
                throw new ErrorHandler(500, err);
            });

        return result.value;
    }

    this.addHistoricalDocument = async (data) => {
        let db = await loadDB();

        return await db.collection("service_history")
            .insert(data)
            .catch(err => {
                console.log(err);
                global.db_connection = null;
                throw new ErrorHandler(500, err);
            });
    };

    this.deleteServiceMetadata = async (serviceName, tenantId) => {
        let db = await loadDB();

        let result = await db.collection("service").findOneAndUpdate(
            { ...tenantFilter(tenantId), "service.name": serviceName },
            { $set: { "service.status": "decommissioned" } }
        )
            .catch(err => {
                console.log(err);
                global.db_connection = null;
                throw new ErrorHandler(500, err);
            });

        return result.value;
    }

    this.getMetadata = async (serviceName, tenantId) => {
        let db = await loadDB();

        return await db.collection("service").findOne(
            { ...tenantFilter(tenantId), "service.name": serviceName },
            { projection: { _id: 0 } }
        )
            .catch(err => {
                console.log(err);
                global.db_connection = null;
                throw new ErrorHandler(500, err);
            });
    }

    this.getMetadataHistory = async (serviceName, tenantId) => {
        let db = await loadDB();

        let current = await db.collection('service').findOne(
            { ...tenantFilter(tenantId), "service.name": serviceName },
            { projection: { _id: 0 } }
        );

        if (current) {
            let data = await db.collection('service_history').find(
                { ...tenantFilter(tenantId), "service.name": serviceName })
                .sort({ _id: -1 })
                .project({ _id: 0 })
                .toArray()
                .catch(err => {
                    console.log(err);
                    global.db_connection = null;
                    throw new ErrorHandler(500, err);
                });

            return [current].concat(data);
        }

        return null;
    }

    this.getAllMetadata = async (status, tenantId) => {
        let db = await loadDB();

        return await db.collection("service").find({ ...tenantFilter(tenantId), "service.status": status })
            .project({ _id: 0 })
            .toArray()
            .catch(err => {
                console.log(err);
                global.db_connection = null;
                throw new ErrorHandler(500, err);
            });
    }

    this.health = async () => {
        await loadDB();
    };

    // --- Reference data (teams/pillars) ---

    this.listTeams = async () => {
        await ensureTeamsSeeded();
        const db = await loadDB();
        return await db.collection('teams').find({})
            .project({ _id: 0 })
            .sort({ pillar: 1, name: 1 })
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.getPillars = async () => {
        const teams = await this.listTeams();
        return teams.reduce((acc, t) => {
            acc[t.pillar] = acc[t.pillar] || [];
            acc[t.pillar].push(t.name);
            return acc;
        }, {});
    };

    this.isTeamInPillar = async (pillar, team) => {
        await ensureTeamsSeeded();
        const db = await loadDB();
        const row = await db.collection('teams').findOne({ pillar, name: team }, { projection: { _id: 0 } })
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return !!row;
    };

    // --- Account management ---

    this.createAccount = async (account) => {
        let db = await loadDB();
        return await db.collection("accounts").insertOne(account)
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.getAccountByKeyHash = async (apiKeyHash) => {
        let db = await loadDB();
        return await db.collection("accounts").findOne(
            { apiKeyHash },
            { projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.getAccount = async (tenantId) => {
        let db = await loadDB();
        return await db.collection("accounts").findOne(
            { tenantId },
            { projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.getAllAccounts = async () => {
        let db = await loadDB();
        return await db.collection("accounts").find({})
            .project({ _id: 0 })
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.countActiveTenants = async () => {
        let db = await loadDB();
        return await db.collection("accounts").countDocuments({ active: true })
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.listActiveTenants = async ({ skip = 0, limit = 50 } = {}) => {
        let db = await loadDB();
        return await db.collection("accounts").find({ active: true })
            .project({ _id: 0, tenantId: 1, companyName: 1 })
            .sort({ tenantId: 1 })
            .skip(skip)
            .limit(limit)
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    // --- Schema storage (versioned) ---

    const schemaTypeFilter = (schemaType) => {
        if (schemaType === 'active') {
            return { $or: [{ schemaType: 'active' }, { schemaType: { $exists: false } }] };
        }
        return { schemaType };
    };

    this.upsertSchema = async ({ version, name, schemaType = 'active', status = 'draft', content, createdAt = new Date() }) => {
        let db = await loadDB();
	        await db.collection("schemas").updateOne(
	            { version, ...schemaTypeFilter(schemaType) },
	            {
	                $set: { name, content, status, schemaType },
	                $setOnInsert: { createdAt, version }
	            },
	            { upsert: true }
	        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
	    };

    this.getSchema = async (version, schemaType = 'active') => {
        let db = await loadDB();
        return await db.collection("schemas").findOne(
            { version, ...schemaTypeFilter(schemaType) },
            { projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.listSchemas = async ({ schemaType = 'active', status = null, includeContent = false } = {}) => {
        let db = await loadDB();
        const query = { ...schemaTypeFilter(schemaType), ...(status ? { status } : {}) };
        const projection = includeContent
            ? { _id: 0, version: 1, createdAt: 1, name: 1, status: 1, content: 1 }
            : { _id: 0, version: 1, createdAt: 1, name: 1, status: 1 };

        return await db.collection("schemas").find(query)
            .project(projection)
            .sort({ createdAt: -1 })
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.updateSchema = async (version, updates) => {
        let db = await loadDB();
        const result = await db.collection("schemas").findOneAndUpdate(
            { version, ...schemaTypeFilter('active') },
            { $set: updates },
            { returnOriginal: false, projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.value;
    };

    this.deleteSchema = async (version) => {
        let db = await loadDB();
        const result = await db.collection("schemas").deleteOne({ version, ...schemaTypeFilter('active') })
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.deletedCount > 0;
    };

    this.isSchemaInUse = async ({ version, name }) => {
        let db = await loadDB();
        const candidates = [version, name].filter(Boolean);
        if (candidates.length === 0) return false;

        const query = { "service.validated_against": { $in: candidates } };
        const [currentCount, historyCount] = await Promise.all([
            db.collection("service").countDocuments(query),
            db.collection("service_history").countDocuments(query),
        ]).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });

        return (currentCount + historyCount) > 0;
    };

    this.updateAccount = async (tenantId, updates) => {
        let db = await loadDB();
        let result = await db.collection("accounts").findOneAndUpdate(
            { tenantId },
            { $set: updates },
            { returnOriginal: false, projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.value;
    };

    this.migrateToTenant = async (tenantId) => {
        let db = await loadDB();
        // Assign tenantId to all service documents that don't have one
        const result = await db.collection("service").updateMany(
            { tenantId: { $exists: false } },
            { $set: { tenantId } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        await db.collection("service_history").updateMany(
            { tenantId: { $exists: false } },
            { $set: { tenantId } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.result;
    };

    // --- Usage tracking ---

    this.recordUsage = async (tenantId, endpoint, method, statusCode, durationMs = null) => {
        let db = await loadDB();
        return await db.collection("usage_events").insertOne({
            tenantId,
            endpoint,
            method,
            statusCode,
            durationMs,
            timestamp: new Date()
        }).catch(console.error);
    };

    this.getUsage = async (tenantId, from, to, { endpointPrefix = null, method = null } = {}) => {
        let db = await loadDB();
        const query = {
            tenantId,
            timestamp: { $gte: from, $lte: to }
        };
        if (endpointPrefix) query.endpoint = { $regex: `^${String(endpointPrefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
        if (method) query.method = method;

        const events = await db.collection("usage_events").find(query).toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });

        const total = events.length;
        const byMethod = events.reduce((acc, e) => {
            acc[e.method] = (acc[e.method] || 0) + 1;
            return acc;
        }, {});
        const byEndpoint = events.reduce((acc, e) => {
            acc[e.endpoint] = (acc[e.endpoint] || 0) + 1;
            return acc;
        }, {});

        const durations = events
            .map((e) => e.durationMs)
            .filter((v) => typeof v === 'number' && Number.isFinite(v))
            .sort((a, b) => a - b);

        const pct = (p) => {
            if (durations.length === 0) return null;
            const idx = Math.min(durations.length - 1, Math.floor(p * (durations.length - 1)));
            return durations[idx];
        };

        const duration = durations.length
            ? {
                count: durations.length,
                avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
                p50Ms: pct(0.5),
                p95Ms: pct(0.95),
                maxMs: durations[durations.length - 1],
              }
            : { count: 0, avgMs: null, p50Ms: null, p95Ms: null, maxMs: null };

        return { total, byMethod, byEndpoint, duration };
    };

    this.getUsageTimeseries = async (tenantId, from, to, { endpointPrefix = null, bucket = 'hour' } = {}) => {
        let db = await loadDB();
        const match = {
            tenantId,
            timestamp: { $gte: from, $lte: to }
        };
        if (endpointPrefix) match.endpoint = { $regex: `^${String(endpointPrefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };

        const minuteInterval =
            bucket === 'minute1' ? 1 :
            bucket === 'minute5' ? 5 :
            bucket === 'minute15' ? 15 :
            bucket === 'minute30' ? 30 :
            null;

        const groupId = {
            y: { $year: '$timestamp' },
            m: { $month: '$timestamp' },
            d: { $dayOfMonth: '$timestamp' },
        };
        if (bucket === 'hour' || minuteInterval) groupId.h = { $hour: '$timestamp' };
        if (minuteInterval) {
            const minuteExpr = { $minute: '$timestamp' };
            groupId.min = minuteInterval === 1
                ? minuteExpr
                : { $subtract: [minuteExpr, { $mod: [minuteExpr, minuteInterval] }] };
        }

        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: groupId,
                    count: { $sum: 1 },
                    avgMs: { $avg: '$durationMs' },
                }
            },
            {
                $sort: {
                    '_id.y': 1,
                    '_id.m': 1,
                    '_id.d': 1,
                    ...(bucket === 'day' ? {} : { '_id.h': 1 }),
                    ...(minuteInterval ? { '_id.min': 1 } : {}),
                }
            }
        ];

        const rows = await db.collection('usage_events').aggregate(pipeline).toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });

        const series = rows.map((r) => {
            const dt =
                bucket === 'day'
                    ? new Date(Date.UTC(r._id.y, r._id.m - 1, r._id.d))
                    : minuteInterval
                        ? new Date(Date.UTC(r._id.y, r._id.m - 1, r._id.d, r._id.h || 0, r._id.min || 0))
                        : new Date(Date.UTC(r._id.y, r._id.m - 1, r._id.d, r._id.h || 0));
            return {
                t: dt.toISOString(),
                count: r.count,
                avgMs: r.avgMs !== null && r.avgMs !== undefined ? Math.round(r.avgMs) : null,
            };
        });

        return series;
    };

    // --- User management (single collection) ---

    // Users are keyed by email; Keycloak subject (`sub`) is attached once the user logs in.
    this.upsertUser = async ({ sub = null, email, name = null, createdAt = new Date(), lastSeenAt = new Date() }) => {
        let db = await loadDB();
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized) throw new ErrorHandler(400, 'email is required');

        const $set = { email: normalized, name: name || null, lastSeenAt };
        if (sub) $set.sub = sub;

        const result = await db.collection("users").findOneAndUpdate(
            { email: normalized },
            { $set, $setOnInsert: { createdAt } },
            { upsert: true, returnOriginal: false, projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.value;
    };

    this.listUsers = async () => {
        let db = await loadDB();
        return await db.collection("users").find({})
            .project({ _id: 0 })
            .sort({ createdAt: -1 })
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    // Tenant access is stored on the user document (single users collection).
    // Each user document has `tenantAccess: [{ tenantId, role, createdAt, updatedAt }]`.
    this.assignUserToTenant = async ({ email, tenantId, role }) => {
        let db = await loadDB();
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized) throw new ErrorHandler(400, 'email is required');
        if (!tenantId) throw new ErrorHandler(400, 'tenantId is required');

        // Ensure base user exists.
        await this.upsertUser({ email: normalized });

        const now = new Date();
        const updated = await db.collection("users").updateOne(
            { email: normalized, "tenantAccess.tenantId": tenantId },
            { $set: { "tenantAccess.$.role": role, "tenantAccess.$.updatedAt": now } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });

        if (updated.matchedCount === 0) {
            await db.collection("users").updateOne(
                { email: normalized },
                { $push: { tenantAccess: { tenantId, role, createdAt: now, updatedAt: now } } }
            ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        }
    };

    this.listTenantUsers = async (tenantId) => {
        let db = await loadDB();
        const rows = await db.collection("users").aggregate([
            { $match: { "tenantAccess.tenantId": tenantId } },
            {
                $project: {
                    _id: 0,
                    email: 1,
                    sub: 1,
                    name: 1,
                    tenantAccess: {
                        $filter: {
                            input: "$tenantAccess",
                            as: "ta",
                            cond: { $eq: ["$$ta.tenantId", tenantId] }
                        }
                    }
                }
            }
        ]).toArray().catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });

        return rows.map((u) => {
            const access = (u.tenantAccess && u.tenantAccess[0]) || null;
            return {
                email: u.email,
                sub: u.sub,
                name: u.name,
                tenantId,
                role: access?.role || null,
                createdAt: access?.createdAt || null,
            };
        });
    };

    this.createInvite = async ({ tenantId, email, role, invitedBySub }) => {
        let db = await loadDB();
        const token = crypto.randomBytes(24).toString('hex');
        const invite = {
            tenantId,
            email: String(email).toLowerCase(),
            role,
            token,
            status: 'pending',
            invitedBySub,
            createdAt: new Date()
        };
        await db.collection("invites").insertOne(invite)
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return { tenantId, email: invite.email, role, token, status: invite.status, createdAt: invite.createdAt };
    };

    this.listInvitesForEmail = async (email) => {
        let db = await loadDB();
        return await db.collection("invites").find({ email: String(email).toLowerCase(), status: 'pending' })
            .project({ _id: 0 })
            .sort({ createdAt: -1 })
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.getInviteByToken = async (token) => {
        let db = await loadDB();
        return await db.collection("invites").findOne({ token, status: 'pending' }, { projection: { _id: 0 } })
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.acceptInviteByEmail = async ({ token, email, keycloakUserId = null }) => {
        let db = await loadDB();
        const invite = await db.collection("invites").findOneAndUpdate(
            { token, status: 'pending', email: String(email).trim().toLowerCase() },
            { $set: { status: 'accepted', acceptedAt: new Date(), acceptedByEmail: String(email).trim().toLowerCase(), keycloakUserId } },
            { returnOriginal: false, projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return invite.value;
    };

    this.listInvitesForTenant = async (tenantId) => {
        let db = await loadDB();
        return await db.collection("invites").find({ tenantId, status: 'pending' })
            .project({ _id: 0 })
            .sort({ createdAt: -1 })
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.listUserTenantsByEmail = async (email) => {
        let db = await loadDB();
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized) return [];
        const user = await db.collection("users").findOne(
            { email: normalized },
            { projection: { _id: 0, tenantAccess: 1 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        const access = Array.isArray(user?.tenantAccess) ? user.tenantAccess : [];
        return access
            .map((a) => ({ tenantId: a.tenantId, role: a.role, createdAt: a.createdAt, updatedAt: a.updatedAt }))
            .sort((a, b) => String(a.tenantId).localeCompare(String(b.tenantId)));
    };

    this.acceptInvite = async ({ token, sub, email }) => {
        let db = await loadDB();
        const invite = await db.collection("invites").findOneAndUpdate(
            { token, status: 'pending', ...(email ? { email: String(email).toLowerCase() } : {}) },
            { $set: { status: 'accepted', acceptedAt: new Date(), acceptedBySub: sub } },
            { returnOriginal: false, projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return invite.value;
    };

    this.createRegistration = async ({ tenantId, email, name = null, role = 'admin' }) => {
        let db = await loadDB();
        const token = crypto.randomBytes(24).toString('hex');
        const reg = {
            token,
            tenantId,
            email: String(email).trim().toLowerCase(),
            name: name || null,
            role,
            status: 'pending',
            createdAt: new Date(),
        };
        await db.collection("registrations").insertOne(reg)
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return { token, tenantId, email: reg.email, name: reg.name, role: reg.role, status: reg.status, createdAt: reg.createdAt };
    };

    this.getRegistration = async (token) => {
        let db = await loadDB();
        return await db.collection("registrations").findOne({ token }, { projection: { _id: 0 } })
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.completeRegistration = async ({ token, keycloakUserId }) => {
        let db = await loadDB();
        const result = await db.collection("registrations").findOneAndUpdate(
            { token, status: 'pending' },
            { $set: { status: 'completed', completedAt: new Date(), keycloakUserId: keycloakUserId || null } },
            { returnOriginal: false, projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.value;
    };

    this.attachSubToEmailTenants = async ({ sub, email }) => {
        let db = await loadDB();
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized || !sub) return 0;
        const result = await db.collection("users").updateOne(
            { email: normalized },
            { $set: { sub, updatedAt: new Date() } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.modifiedCount || 0;
    };

    // --- Rulesets (per-tenant field/regex checks) ---

    this.listRulesets = async (tenantId, { includeDisabled = true } = {}) => {
        let db = await loadDB();
        const query = { tenantId, ...(includeDisabled ? {} : { enabled: true }) };
        return await db.collection("rulesets").find(query)
            .project({ _id: 0 })
            .sort({ createdAt: -1 })
            .toArray()
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
    };

    this.createRuleset = async ({ tenantId, name, field, pattern, enabled = true, description = '' }) => {
        let db = await loadDB();
        const doc = {
            tenantId,
            id: crypto.randomBytes(12).toString('hex'),
            name,
            field,
            pattern,
            enabled: !!enabled,
            description: description || '',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection("rulesets").insertOne(doc)
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        const { tenantId: _t, ...rest } = doc;
        return rest;
    };

    this.updateRuleset = async (tenantId, id, updates) => {
        let db = await loadDB();
        const allowed = ['name', 'field', 'pattern', 'enabled', 'description'];
        const $set = Object.fromEntries(Object.entries(updates || {}).filter(([k]) => allowed.includes(k)));
        $set.updatedAt = new Date();
        const result = await db.collection("rulesets").findOneAndUpdate(
            { tenantId, id },
            { $set },
            { returnOriginal: false, projection: { _id: 0 } }
        ).catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.value;
    };

    this.deleteRuleset = async (tenantId, id) => {
        let db = await loadDB();
        const result = await db.collection("rulesets").deleteOne({ tenantId, id })
            .catch(err => { global.db_connection = null; throw new ErrorHandler(500, err); });
        return result.deletedCount > 0;
    };
}

export default MongoDb;
