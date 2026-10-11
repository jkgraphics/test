import { createApp, loadConfig } from '../server/app.js';
import { openDb } from '../server/db.js';
import { seed, DEMO_PASSWORD } from '../server/seed.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export async function startServer() {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-up-'));
  const config = loadConfig({ PORT: '0', DATABASE_FILE: ':memory:', UPLOAD_DIR: uploadDir, DATA_ENCRYPTION_KEY: 'test-key-0123456789-0123456789-0123456789', TEST_GATEWAY_SECRET: 'test-gateway-secret', ALLOW_TEST_PAYMENTS: 'true' });
  const db = openDb(':memory:');
  const demo = seed(db);
  const ctx = createApp({ config, db });
  const server = await new Promise((resolve) => { const s = ctx.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  config.appUrl = base;
  return { ...ctx, demo, base, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

// Tiny HTTP client with a cookie jar and the CSRF header the browser app sends.
export function client(base, { guestToken } = {}) {
  let cookie = '';
  const c = {
    guestToken,
    async req(method, url, body, headers = {}) {
      const res = await fetch(base + url, {
        method,
        redirect: 'manual',
        headers: {
          'X-Requested-With': 'TableServe',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(c.guestToken ? { 'X-Guest-Token': c.guestToken } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, data, headers: res.headers };
    },
    get: (u, h) => c.req('GET', u, undefined, h),
    post: (u, b = {}, h) => c.req('POST', u, b, h),
    put: (u, b = {}, h) => c.req('PUT', u, b, h),
    async login(email, password = DEMO_PASSWORD) {
      const r = await c.post('/api/auth/login', { email, password });
      if (r.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(r.data)}`);
      return c;
    },
  };
  return c;
}

// Subscribe to an SSE endpoint and collect events.
export function sse(url, headers = {}) {
  const ctrl = new AbortController();
  const events = [];
  const waiters = [];
  const ready = fetch(url, { headers, signal: ctrl.signal }).then(async (res) => {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = /^event: (.*)$/m.exec(chunk)?.[1];
            const data = /^data: (.*)$/m.exec(chunk)?.[1];
            if (ev) {
              const e = { event: ev, data: data ? JSON.parse(data) : null };
              events.push(e);
              for (const w of [...waiters]) if (w.pred(e)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(e); }
            }
          }
        }
      } catch { /* aborted */ }
      for (const w of waiters.splice(0)) w.resolve(null);
    })();
  });
  return {
    events,
    ready,
    waitFor(pred, ms = 3000) {
      const hit = events.find(pred);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); reject(new Error('Timed out waiting for SSE event')); } }, ms);
      });
    },
    close: () => ctrl.abort(),
  };
}

export const key = () => `k-${Math.random().toString(36).slice(2)}-${Date.now()}`;
