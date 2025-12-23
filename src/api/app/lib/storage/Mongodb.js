import mongodb from 'mongodb';
const { MongoClient } = mongodb;
import { ErrorHandler } from '../../helpers/error.js';

let config = {
    connection_string: process.env.MONGODB_ATLAS_URI,
    db: 'serviceCatalogue'
};

let generateDoc = (serviceName, version, metadata, hosts) => {
    return {
        service: {
            name: serviceName,
            validated_against: version,
            metadata: metadata,
            updated: new Date(),
            status: global.ServiceStatus.LIVE,
            hosts: hosts
        }
    };
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
    this.putMetadata = async (serviceName, schema_version, data, hosts) => {
        let db = await loadDB();

        let result = await db.collection("service").findOneAndReplace(
            {"service.name": {$eq: serviceName}},
            generateDoc(serviceName, schema_version, data, hosts),
            {upsert: true, returnNewDocument: false, projection: { _id: 0}}
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

    this.deleteServiceMetadata = async (serviceName) => {
        let db = await loadDB();

        let result = await db.collection("service").findOneAndUpdate(
            { "service.name": serviceName
            }, {
                $set: {"service.status": "decommissioned"} }
            )
            .catch(err => {
                console.log(err);
                global.db_connection = null;
                throw new ErrorHandler(500, err);
            });

        return result.value;
    }

    this.getMetadata = async (serviceName) => {
        let db = await loadDB();

        return await db.collection("service").findOne({
            "service.name": serviceName
        }, {
            projection: {
                _id: 0
            }
        })
            .catch(err => {
                console.log(err);
                global.db_connection = null;
                throw new ErrorHandler(500, err);
            });
    }

    this.getMetadataHistory = async (serviceName) => {
        let db = await loadDB();

        let current = await db.collection('service').findOne(
            {"service.name": serviceName},
            { projection: { _id: 0 }}
        );

        if (current) {
            let data = await db.collection('service_history').find(
                {"service.name": serviceName})
                .sort({_id: -1})
                .project({_id: 0})
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

    this.getAllMetadata = async (status) => {
        let db = await loadDB();

        return await db.collection("service").find({ "service.status": status })
            .project( { _id: 0})
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
}

export default MongoDb;