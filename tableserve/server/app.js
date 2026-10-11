import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createHub } from './realtime.js';
import { createAuth } from './auth.js';
import { createServices } from './services.js';
import { createGateway } from './gateway.js';
import { HttpError, makeCipher } from './util.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import staffRoutes from './routes/staff.js';
import manageRoutes from './routes/manage.js';
import platformRoutes from './routes/platform.js';
import paymentRoutes from './routes/payments.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  const production = env.NODE_ENV === 'production';
  const cfg = {
    port,
    production,
    appUrl: (env.APP_URL || `http://localhost:${port}`).replace(/\/$/, ''),
    databaseFile: env.DATABASE_FILE || path.join(ROOT, 'data', 'tableserve.db'),
    uploadDir: env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : production,
    dataEncryptionKey: env.DATA_ENCRYPTION_KEY || '',
    testGatewaySecret: env.TEST_GATEWAY_SECRET || '',
    allowTestPayments: env.ALLOW_TEST_PAYMENTS ? env.ALLOW_TEST_PAYMENTS === 'true' : !production,
    trustProxy: env.TRUST_PROXY === 'true',
  };
  if (production && (!cfg.dataEncryptionKey || cfg.dataEncryptionKey.length < 32)) {
    throw new Error('DATA_ENCRYPTION_KEY (32+ characters) is required in production');
  }
  if (!cfg.dataEncryptionKey) {
    cfg.dataEncryptionKey = 'dev-only-insecure-key-change-me-0000000000';
    console.warn('[tableserve] DATA_ENCRYPTION_KEY not set – using an insecure development key.');
  }
  if (!cfg.testGatewaySecret) cfg.testGatewaySecret = `dev-test-gateway-${cfg.dataEncryptionKey}`;
  return cfg;
}

function parseCookies(req, _res, next) {
  req.cookies = {};
  const h = req.headers.cookie;
  if (h) {
    for (const part of h.split(';')) {
      const i = part.indexOf('=');
      if (i > 0) {
        try { req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore */ }
      }
    }
  }
  next();
}

// Cookie-authenticated mutations must carry a custom header. Browsers cannot attach it to a
// cross-site form post, and cross-origin fetches with it require a CORS preflight we never grant.
function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/api/webhooks/') || req.path.startsWith('/pay/')) return next();
  if (req.get('x-requested-with') !== 'TableServe') return next(new HttpError(403, 'Missing request header'));
  next();
}

export function createApp({ config = loadConfig(), db } = {}) {
  db = db || openDb(config.databaseFile);
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const hub = createHub();
  const cipher = makeCipher(config.dataEncryptionKey);
  const auth = createAuth(db, config);
  const services = createServices({ db, hub, config });
  const gateway = createGateway({ db, config, cipher });
  const ctx = { db, hub, auth, services, gateway, config, cipher };

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  // Webhooks need the exact raw bytes for signature verification.
  app.use('/api/webhooks', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(parseCookies);
  app.use(auth.loadUser);
  app.use(csrfGuard);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/public', publicRoutes(ctx));
  app.use('/api/staff', staffRoutes(ctx));
  app.use('/api/manage', manageRoutes(ctx));
  app.use('/api/platform', platformRoutes(ctx));
  app.use(paymentRoutes(ctx));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  // Static assets & pages
  const pub = path.join(ROOT, 'public');
  app.use('/vendor/preact', express.static(path.join(ROOT, 'node_modules/preact'), { maxAge: '7d' }));
  app.use('/vendor/htm', express.static(path.join(ROOT, 'node_modules/htm'), { maxAge: '7d' }));
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '1d', fallthrough: false }));
  app.use(express.static(pub, { index: false, maxAge: 0 }));
  app.get('/t/:qr', (_req, res) => res.sendFile(path.join(pub, 'customer.html')));
  app.get(['/app', '/app/*'], (_req, res) => res.sendFile(path.join(pub, 'app.html')));
  app.get(['/login', '/register', '/invite/:token'], (_req, res) => res.sendFile(path.join(pub, 'app.html')));
  app.get('/', (_req, res) => res.sendFile(path.join(pub, 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    if (req.path.startsWith('/api/') || req.path.startsWith('/pay/')) {
      res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message, ...(err.extra || {}) });
    } else {
      res.status(status).send(status === 404 ? 'Not found' : 'Error');
    }
  });

  return { app, ...ctx };
}
