import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import path from 'path';
import cors from 'cors';

import indexRouter from './routes/index.js';
import referenceRouter from './routes/reference.js';
import metadataRouter from './routes/schema.js';
import serviceRouter from './routes/service.js';
import accountsRouter from './routes/accounts.js';
import adminRouter from './routes/admin.js';
import uiRouter from './routes/ui.js';
import publicRouter from './routes/public.js';
import rulesetsRouter from './routes/rulesets.js';
import { handleError } from './helpers/error.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', indexRouter);
app.use('/services', serviceRouter);
app.use('/metadata', metadataRouter);
app.use('/reference', referenceRouter);
app.use('/accounts', accountsRouter);
app.use('/admin', adminRouter);
app.use('/ui', uiRouter);
app.use('/public', publicRouter);
app.use('/rulesets', rulesetsRouter);

app.use('/openapi', express.static(path.join(__dirname, 'swagger.yml')));

app.use((err, req, res, next) => {
    handleError(err, res);
});

global.db_connection = null;

global.ServiceStatus = {
    LIVE: "live",
    DECOMISSIONED: "decommissioned"
}
export default app;
