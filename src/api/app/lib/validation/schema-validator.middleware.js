import fs from 'fs';
import Ajv from 'ajv';
import _ from 'underscore';
import MongoDb from '../storage/Mongodb.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const draft6 = require('ajv/lib/refs/json-schema-draft-06.json');

const ajv = new Ajv({allErrors: true});

ajv.addMetaSchema(draft6);

class SchemaValidatorMiddleware {

    constructor(basePath, next) {
        this.next = next;
        this.basePath = basePath;
        this.schemas = [];
        this.decommissioned_schemas = [];
        this.storage = new MongoDb();
    }

    async init() {
        const loadFromFs = () => {
            this.schemas = this._loadSchemasFromFs(`${this.basePath}/schemas`);
            if (this.schemas[0]) this.schemas[0].latest = true;
            this.decommissioned_schemas = this._loadSchemasFromFs(`${this.basePath}/decommissioned-schemas`);
        };

        // Prefer DB; if DB isn't reachable yet (e.g. container startup), fall back to FS
        // and try to seed+reload in the background once the DB comes up.
        const loadedFromDb = await this._loadSchemasFromDb();
        if (loadedFromDb) return;

        loadFromFs();

        // Fire-and-forget best-effort seed (doesn't block startup).
        (async () => {
            try {
                await this._seedDbFromFs();
                await this._loadSchemasFromDb();
            } catch (e) {
                // keep FS-backed schemas in memory
            }
        })();
    }

    async reloadFromDb() {
        return await this._loadSchemasFromDb();
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

    async listSchemas() {
        const out = (this.schemas || []).map((s) => ({
            version: s.version,
            createdAt: s.createdAt,
            latest: !!s.latest,
            name: s.name,
            status: s.status || 'draft',
        }));
        return out;
    }

    validateAgainstVersion(json, version, cb) {
        let schema = _.find(this.schemas, { version: version});

        let valid = schema.ajv(json);

        if (valid) {
            cb(true);
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
            cb(true, schemaVersion, isValidWithLatest);
        } else {
            this.schemas[0].ajv(json);

            cb(false, false, this.schemas[0].ajv.errors)
        }
    }

    _loadSchemasFromFs(dir) {
        let self = this;
        let tmpSchemas = fs.readdirSync(dir);

        return _.map(tmpSchemas, f => {
            const fullPath = `${dir}/${f}`;
            const content = self._populateTeam(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
            const createdAt = fs.statSync(fullPath).mtime;

            return {
                name: f,
                latest: false,
                content: content,
                ajv: ajv.compile(content),
                version: content.version,
                orderedVersion: parseInt(content.version.replace(/\./g, '')),
                createdAt
            }
        }).sort((a, b) => {
            return b.orderedVersion - a.orderedVersion
        });
    }

    async _loadSchemasFromDb() {
        try {
            const [active, decommissioned] = await Promise.all([
                this.storage.listSchemas({ schemaType: 'active', includeContent: true }),
                this.storage.listSchemas({ schemaType: 'decommissioned', includeContent: true }),
            ]);

            if (!active || active.length === 0) {
                return false;
            }

            const build = (rows) =>
                rows
                    .filter((row) => row && row.content && typeof row.content === 'object')
                    .map((row) => {
                        const content = this._populateTeam(row.content);
                        return {
                            name: row.name || `schema-${row.version}.json`,
                            latest: false,
                            content,
                            ajv: ajv.compile(content),
                            version: row.version,
                            orderedVersion: parseInt(String(row.version).replace(/\./g, '')),
                            createdAt: row.createdAt ? new Date(row.createdAt) : null,
                            status: row.status || 'draft',
                        };
                    })
                    .sort((a, b) => b.orderedVersion - a.orderedVersion);

            this.schemas = build(active.filter((r) => (r.status || 'draft') !== 'superseded'));
            if (this.schemas[0]) this.schemas[0].latest = true;
            this.decommissioned_schemas = build((decommissioned || []).filter((r) => (r.status || 'draft') !== 'superseded'));
            return true;
        } catch (e) {
            console.error('[schema] failed to load schemas from db', e);
            return false;
        }
    }

    async _seedDbFromFs() {
        const seedDir = async (dir, schemaType) => {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const f of files) {
                const fullPath = `${dir}/${f}`;
                const content = this._populateTeam(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
                const createdAt = fs.statSync(fullPath).mtime;
                await this.storage.upsertSchema({
                    schemaType,
                    status: 'draft',
                    name: f,
                    version: content.version,
                    content,
                    createdAt,
                });
            }
        };

        await seedDir(`${this.basePath}/schemas`, 'active');
        await seedDir(`${this.basePath}/decommissioned-schemas`, 'decommissioned');
    }

    _populateTeam(data) {
        if (!data || !data.properties) return data;
        if (data.properties.team) {
            // Schemas historically used mappings-driven enums. Now that teams are managed
            // outside the schema, remove any enum restriction to avoid blocking valid payloads.
            if (Array.isArray(data.properties.team.enum)) {
                delete data.properties.team.enum;
            }
        }
        return data;
    }
}

export default SchemaValidatorMiddleware;
