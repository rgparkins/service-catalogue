import fs from 'fs';
import express from 'express';
const router = express.Router();
import validator from '../lib/schema-validator.js';
import mappings from '../lib/mappings.js';
import _ from 'underscore';
import MongoDb from '../lib/storage/Mongodb.js';

let storage = new MongoDb();

const _fetch_services = async (req, map) => {
    let filter = null;

    let result = await storage.getAllMetadata(global.ServiceStatus.LIVE);

    if (req.query.team) {
        result = result.filter(doc => {
            return req.query.team === doc.service.metadata.team;
        });
    }

    if (req.query.pillar) {
        result = result.filter(doc => {
            return mappings.isTeamInPillar(req.query.pillar, doc.service.metadata.team);
        });
    }

    if (req.query.repo) {
        result = result.filter(doc => doc.service.metadata.repo.split('/').pop() === req.query.repo);
    }

    if (req.query.depends_on) {
        let check = (dependencies) => {
            return _.findIndex(dependencies, d => {
                return d.name.toLowerCase().indexOf(req.query.depends_on.toLowerCase()) >= 0;
            }) !== -1;
        }

        result = result.filter(doc => {
            let critical_dependencies = doc.service.metadata.dependencies.critical || [];
            let noncritical_dependencies = doc.service.metadata.dependencies["non-critical"] || [];

            return check(critical_dependencies) || check(noncritical_dependencies);
        });
    }

    return map(result);
};

router.get('/', async (req, res) => {
    try {
        let result = await _fetch_services(req, data => {
            return _.map(data, d => {
                return d.service.name;
            })
        })

        res.json(result);
    } catch (err) {
        console.log(err);
        res.status(500)
            .send(err);
    }
});

router.get('/metadata', async (req, res) => {
    try {
        let result = await _fetch_services(req, data => {
            return data;
        })

        res.json(result);
    } catch (err) {
        res.status(500)
            .send(err);
    }
});

router.get('/info', async (req, res) => {
    try {
        let result = await _fetch_services(req, data => {
            return data;
        })

        res.json(result.map(d => d.service.metadata));
    } catch (err) {
        res.status(500)
            .send(err);
    }
});

router.get('/metadata/:serviceName/history', async (req, res) => {
    try {
        let result = await storage.getMetadataHistory(req.params.serviceName);

        if (result) {
            res.json(result);
        } else {
            res.status(404)
                .send('Not found');
        }
    } catch (err) {
        console.log(err);
        res.status(500)
            .send(err);
    }
});

router.get('/metadata/:serviceName', async (req, res) => {
    try {
        let result = await storage.getMetadata(req.params.serviceName);

        if (result && result.service.status === global.ServiceStatus.LIVE) {
            res.json(result);
        } else {
            res.status(404)
                .send('Not found');
        }
    } catch (err) {
        console.log(err);

        res.status(500)
            .send(err);
    }
});

router.post('/metadata/:serviceName', (req, res) => {
    if (req.params.serviceName != req.body.name) {
        res.status(400)
            .send({error: `Service name does not match ${req.params.serviceName} vs ${req.body.name} (body)`});
        return;
    }

    validator.validate(req.body, async (success, schema_version, err) => {
        try {
            if (success) {
                let hosts = []

                try {
                    hosts = global.cache.get(req.params.serviceName.replace('.', '-'));
                } catch (e) {
                    console.log(e);
                }

                let oldDocument = await storage.putMetadata(req.params.serviceName, schema_version, req.body, hosts);

                if (oldDocument) {
                    await storage.addHistoricalDocument(oldDocument);
                }

                res.set('location', req.originalUrl);

                if (err) { //latest schema validated against
                    res.status(201)
                        .send("Created");
                } else {
                    res.status(202)
                        .send("Accepted");
                }
            } else {
                res.status(400)
                    .send(err);
            }
        } catch (err) {
            console.log(err);
            res.status(500)
                .send(err);
        }
    })
});

router.delete('/metadata/:serviceName', async (req, res) => {
    try {
        let result = await storage.deleteServiceMetadata(req.params.serviceName);

        if (result) {
            res.status(200)
                .send('OK');
        } else {
            res.status(404)
                .send('Not found');
        }
    } catch (err) {
        console.log(err);

        res.status(500)
            .send(err);
    }
});

router.get('/decommissioned/:serviceName', async (req, res) => {
    try {
        let result = await storage.getDecommissionedMetadata(req.params.serviceName);

        if (result) {
            res.json(result);
        } else {
            res.status(404)
                .send('Not found');
        }
    } catch (err) {
        console.log(err);

        res.status(500)
            .send(err);
    }
});

router.get('/decommissioned', async (req, res) => {
    let result = await storage.getAllMetadata(global.ServiceStatus.DECOMISSIONED);

    if (result) {
        res.json(result);
    } else {
        res.json([]);
    }
});

export default router;
