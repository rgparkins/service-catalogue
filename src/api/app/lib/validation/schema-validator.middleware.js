import fs from 'fs';
import Ajv from 'ajv';
import _ from 'underscore';
import mappings from '../mappings.js';
import ServiceNameValidator from './servicename-validator,middleware.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const draft6 = require('ajv/lib/refs/json-schema-draft-06.json');

const ajv = new Ajv({allErrors: true});
const serviceNameValidator = new ServiceNameValidator();

ajv.addMetaSchema(draft6);

class SchemaValidatorMiddleware {

    constructor(basePath, next) {
        this.next = next;
        this.schemas = this._loadSchemas(`${basePath}/schemas`);
        this.schemas[0].latest = true;

        this.decommissioned_schemas = this._loadSchemas(`${basePath}/decommissioned-schemas`);
    }

    fetchSchema(version)
    {
        if (version === 'latest') {
            return this.schemas[0].content;
        }

        let result = _.find(this.schemas, { version: version})

        if (result) {
            return result.content;
        }

        return undefined;
    }

    validateAgainstVersion(json, version, cb) {
        let schema = _.find(this.schemas, { version: version});

        let valid = schema.ajv(json);

        if (valid) {
            if (serviceNameValidator.validateServiceName(json.name)) {
                cb(true);
            } else {
                cb(false, {
                    "error": "Please use a valid domain for your service",
                    "domains": serviceNameValidator.domains
                });
            }
        } else {
            cb(false, schema.ajv.errors);
        }
    }

    validate(json, cb) {
        let isValid = false;
        let isValidWithLatest = false;
        let schemaVersion;

        for (let i = 0; i < this.schemas.length; i++) {
            let valid = this.schemas[i].ajv(json);

            if (valid) {
                isValid = true;
                schemaVersion = this.schemas[i].name
                if (this.schemas[i].latest){
                    isValidWithLatest = true;
                }
                break;
            }
        }

        if (isValid) {
            if (serviceNameValidator.validateServiceName(json.name)) {
                cb(true, schemaVersion, isValidWithLatest);
            } else {
                cb(false, false, {
                    "error": "Please use a valid domain for your service",
                    "domains": serviceNameValidator.domains
                });
            }
        } else {
            this.schemas[0].ajv(json);

            cb(false, false, this.schemas[0].ajv.errors)
        }
    }

    _loadSchemas(dir) {
        let self = this;
        let tmpSchemas = fs.readdirSync(dir);

        return _.map(tmpSchemas, f => {
            let content = self._populateTeam(JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));

            return {
                name: f,
                latest: false,
                content: content,
                ajv: ajv.compile(content),
                version: content.version,
                orderedVersion: parseInt(content.version.replace(/\./g, ''))
            }
        }).sort((a, b) => {
            return b.orderedVersion - a.orderedVersion
        });
    }

    _populateTeam(data) {
        if (data.properties.team) {
            data.properties.team.enum = mappings.getDistinctTeams();
        }
        return data;
    }
}

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let validator = new SchemaValidatorMiddleware(process.env.SCHEMA_BASE_PATH || __dirname + "/../../schemas");

export default validator;