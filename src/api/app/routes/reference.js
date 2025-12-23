import express from 'express';
const router = express.Router();
import mappings from '../lib/mappings.js';
import ServiceNameValidator from '../lib/validation/servicename-validator,middleware.js';

router.get('/teams', (request, response) => {
    response.json(mappings.getTeams());
});

router.get('/pillars', (request, response) => {
    response.json(mappings.getPillars());
});

router.get('/domains', (request, response) => {
    response.json(new ServiceNameValidator().domains);
});

export default router;
