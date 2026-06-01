import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SchemaValidatorMiddleware from './validation/schema-validator.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const basePath = process.env.SCHEMA_BASE_PATH || `${__dirname}/../schemas`;

const validator = new SchemaValidatorMiddleware(basePath);
await validator.init();

export default validator;

