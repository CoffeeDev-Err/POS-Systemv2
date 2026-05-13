const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const routes = require('./routes');
const { ping } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
const devOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];
let allowedOrigins = corsOrigin === '*'
  ? '*'
  : corsOrigin.split(',').map(s => s.trim()).filter(Boolean);

if (allowedOrigins !== '*' && process.env.NODE_ENV !== 'production') {
  allowedOrigins = Array.from(new Set([...allowedOrigins, ...devOrigins]));
}

app.use(cors({
  origin: allowedOrigins,
  credentials: allowedOrigins !== '*',
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', routes);

app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`[server] listening on ${port}`);
});

if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
  ping()
    .then(() => console.log('[db] connection ok'))
    .catch(err => console.error('[db] connection failed:', err.message));
}
