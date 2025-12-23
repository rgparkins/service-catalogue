'use strict';

const apickli = require('apickli');
const {Before} = require('cucumber');
const MongoClient = require('mongodb').MongoClient;

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
});