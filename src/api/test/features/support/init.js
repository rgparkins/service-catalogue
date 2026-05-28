'use strict';

const apickli = require('apickli');
const {Before} = require('cucumber');
const MongoClient = require('mongodb').MongoClient;
const crypto = require('crypto');

let config = {
    connection_string: process.env.MONGODB_ATLAS_URI,
    db: 'serviceCatalogue'
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
    }
}

Before(async function() {
    this.apickli = new apickli.Apickli('http', process.env.SERVICE_UNDER_TEST_HOSTNAME);
    this.apickli.addRequestHeader('Cache-Control', 'no-cache');

    let db = await loadDB();

    await db.collection('service').deleteMany({});
    await db.collection('service_history').deleteMany({});
    await db.collection('accounts').deleteMany({});
    await db.collection('usage_events').deleteMany({});

    const defaultRawKey = 'default-tenant-api-key';
    const defaultKeyHash = crypto.createHash('sha256').update(defaultRawKey).digest('hex');
    await db.collection('accounts').insertOne({
        tenantId: 'default',
        companyName: 'Default',
        billingEmail: 'default@example.com',
        apiKeyHash: defaultKeyHash,
        plan: 'pro',
        createdAt: new Date(),
        active: true
    });

    // apickli's addRequestHeader appends values; set directly so scenarios can override cleanly.
    this.apickli.headers['Authorization'] = `Bearer ${defaultRawKey}`;
});
