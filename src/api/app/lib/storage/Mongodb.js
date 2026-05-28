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

    this.recordUsage = async (tenantId, endpoint, method, statusCode) => {
        let db = await loadDB();
        return await db.collection("usage_events").insertOne({
            tenantId,
            endpoint,
            method,
            statusCode,
            timestamp: new Date()
        }).catch(console.error);
    };

    this.getUsage = async (tenantId, from, to) => {
        let db = await loadDB();
        const events = await db.collection("usage_events").find({
            tenantId,
            timestamp: { $gte: from, $lte: to }
        }).toArray()
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

        return { total, byMethod, byEndpoint };
    };
}

export default MongoDb;