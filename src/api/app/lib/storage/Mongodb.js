import mongodb from 'mongodb';
const { MongoClient } = mongodb;
import { ErrorHandler } from '../../helpers/error.js';

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
}

export default MongoDb;
