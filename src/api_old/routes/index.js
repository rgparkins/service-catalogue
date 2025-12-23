import fs from 'fs';
import _ from 'underscore';
import express from 'express';
const router = express.Router();
import validator from '../lib/schema-validator.js';
import Mongodb from '../lib/storage/Mongodb.js';

let storage = new Mongodb();

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaDir = __dirname + "/../lib" ;

router.get('/', function(req, res, next) {
    res.json({
        "name": "service catalogue version: " + process.env.VERSION,
        "metadata": {
            "schemas": validator.schemas,
            "decommissioned-schemas": validator.decommissioned_schemas
        }
    });
});

router.get('/readiness', async (req, res, next) => {
    try {
        await storage.health();

        res.status(200)
            .send("OK");
    } catch (err) {
        res.status(200)
            .send(err);
    }
});

router.get('/health', async (req, res, next) => {
    await storage.health();

    res.status(200)
        .send("OK");
});

router.get('/liveness', (request, response) => {
    response.status(200)
        .send("OK");
});

router.get('/cache/hosts', (request, response) => {
    if (global.cache) {
        response.status(200)
            .send(global.cache);
    } else {
        response.status(200)
            .send('Cache not available');
    }
});

export default router;
