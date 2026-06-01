import express from 'express';
const router = express.Router();
import ServiceNameValidator from '../lib/validation/servicename-validator,middleware.js';
import MongoDb from '../lib/storage/Mongodb.js';

const storage = new MongoDb();

router.get('/teams', (request, response) => {
    storage.listTeams()
        .then((teams) => response.json(teams))
        .catch((err) => {
            console.error(err);
            response.status(500).json({ error: 'Failed to load teams' });
        });
});

router.get('/pillars', (request, response) => {
    storage.getPillars()
        .then((pillars) => response.json(pillars))
        .catch((err) => {
            console.error(err);
            response.status(500).json({ error: 'Failed to load pillars' });
        });
});

router.get('/domains', (request, response) => {
    response.json(new ServiceNameValidator().domains);
});

export default router;
