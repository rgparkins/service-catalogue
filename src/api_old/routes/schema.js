import express from 'express';
const router = express.Router();
import validator from '../lib/schema-validator.js';

router.get('/schema/:version?', (req, res) => {
    let content = validator.fetchSchema(req.params.version || 'latest');

    if (content){
        res.json(content);
    } else {
        res.status(404)
            .send('Not Found');
    }
});

router.post('/validate/:version', (req, res) => {
    if (validator.fetchSchema(req.params.version)) {
        validator.validateAgainstVersion(req.body, req.params.version, (success, result) => {
            if (success) {
                res.status(200)
                    .send('OK')
            } else {
                res.status(400)
                    .json(result);
            }
        })
    } else {
        res.status(404).send('Not found');
    }
});

router.post('/validate', (req, res) => {
    validator.validate(req.body, (success, version, result) => {
        if (success) {
            if (result) {
                res.status(200)
                    .send('OK')
            } else {
                res.status(202)
                    .send('Accepted')
            }
        } else {
            res.status(400)
                .json(result);
        }
    })
});

export default router;
