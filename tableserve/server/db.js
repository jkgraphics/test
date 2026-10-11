// SQLite persistence layer (Node's built-in node:sqlite, no native build needed).
// All money values are stored as integers in minor units (paise / cents).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  platform_role TEXT CHECK (platform_role IN ('super_admin','platform_admin')),
  platform_perms TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_company_id INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_annual INTEGER NOT NULL DEFAULT 0,
  max_branches INTEGER NOT NULL DEFAULT 1,
  max_tables INTEGER NOT NULL DEFAULT 10,
  max_staff INTEGER NOT NULL DEFAULT 5,
  trial_days INTEGER NOT NULL DEFAULT 14,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  opening_hours TEXT NOT NULL DEFAULT '',
  brand_color TEXT NOT NULL DEFAULT '#d9480f',
  currency TEXT NOT NULL DEFAULT 'INR',
  languages TEXT NOT NULL DEFAULT '["en","hi"]',
  ordering_mode TEXT NOT NULL DEFAULT 'ordering' CHECK (ordering_mode IN ('menu_only','ordering')),
  taxes TEXT NOT NULL DEFAULT '[]',
  service_charge_pct REAL NOT NULL DEFAULT 0,
  payment_settings TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  plan_id INTEGER REFERENCES plans(id),
  billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','annual')),
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial','active','expired','suspended')),
  trial_ends_at TEXT,
  current_period_end TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  opening_hours TEXT NOT NULL DEFAULT '',
  ordering_paused INTEGER NOT NULL DEFAULT 0,
  pause_message TEXT NOT NULL DEFAULT '',
  self_start_sessions INTEGER NOT NULL DEFAULT 0,
  default_prep_minutes INTEGER NOT NULL DEFAULT 15,
  max_cashier_discount_pct REAL NOT NULL DEFAULT 10,
  order_seq INTEGER NOT NULL DEFAULT 0,
  bill_seq INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);

CREATE TABLE IF NOT EXISTS company_members (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','kitchen','waiter','cashier')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS member_branches (
  member_id INTEGER NOT NULL REFERENCES company_members(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, branch_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL,
  branch_ids TEXT NOT NULL DEFAULT '[]',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by INTEGER REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_hi TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_categories_branch ON categories(branch_id);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_hi TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_hi TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price >= 0),
  image_url TEXT,
  portion_size TEXT NOT NULL DEFAULT '',
  diet TEXT NOT NULL DEFAULT 'veg' CHECK (diet IN ('veg','nonveg','egg','vegan')),
  ingredients TEXT NOT NULL DEFAULT '',
  allergens TEXT NOT NULL DEFAULT '[]',
  spice_level INTEGER NOT NULL DEFAULT 0 CHECK (spice_level BETWEEN 0 AND 3),
  taste_notes TEXT NOT NULL DEFAULT '',
  options TEXT NOT NULL DEFAULT '[]',
  is_popular INTEGER NOT NULL DEFAULT 0,
  is_special INTEGER NOT NULL DEFAULT 0,
  is_combo INTEGER NOT NULL DEFAULT 0,
  combo_details TEXT NOT NULL DEFAULT '',
  prep_minutes INTEGER,
  in_stock INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_branch ON menu_items(branch_id);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  section TEXT NOT NULL DEFAULT '',
  qr_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','bill_requested','cleaning')),
  current_session_id INTEGER,
  assigned_waiter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (branch_id, number)
);

CREATE TABLE IF NOT EXISTS dining_sessions (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  join_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  guest_count INTEGER,
  opened_by INTEGER REFERENCES users(id),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_by INTEGER REFERENCES users(id),
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_table ON dining_sessions(table_id, status);

-- Each customer phone that is authorised for a dining session.
CREATE TABLE IF NOT EXISTS session_devices (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES dining_sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  joined_via TEXT NOT NULL CHECK (joined_via IN ('code','staff','self_start')),
  approved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pending "let me order at this table" requests that staff approve or deny.
CREATE TABLE IF NOT EXISTS join_requests (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  poll_token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired')),
  session_id INTEGER,
  device_token TEXT,
  handled_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS code_attempts (
  id INTEGER PRIMARY KEY,
  table_id INTEGER NOT NULL,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES tables(id),
  session_id INTEGER NOT NULL REFERENCES dining_sessions(id),
  order_no INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('customer','staff')),
  device_id INTEGER REFERENCES session_devices(id),
  placed_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','preparing','ready','served','cancelled')),
  subtotal INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  prep_minutes INTEGER,
  cancel_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  accepted_at TEXT, preparing_at TEXT, ready_at TEXT, served_at TEXT, cancelled_at TEXT,
  UNIQUE (session_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);

-- Item rows snapshot name and price at submission time so later menu edits never change them.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER,
  name TEXT NOT NULL,
  name_hi TEXT NOT NULL DEFAULT '',
  diet TEXT NOT NULL DEFAULT 'veg',
  unit_price INTEGER NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  qty INTEGER NOT NULL CHECK (qty > 0),
  line_total INTEGER NOT NULL,
  instructions TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES dining_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('waiter','water','bill')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  handled_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  handled_at TEXT
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL UNIQUE REFERENCES dining_sessions(id),
  table_id INTEGER NOT NULL,
  bill_no INTEGER NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('percent','flat')),
  discount_value REAL NOT NULL DEFAULT 0,
  discount_reason TEXT NOT NULL DEFAULT '',
  discount_by INTEGER REFERENCES users(id),
  -- Cached totals, always recomputed server-side from accepted orders before use.
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  service_charge INTEGER NOT NULL DEFAULT 0,
  taxes TEXT NOT NULL DEFAULT '[]',
  tax_total INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  paid INTEGER NOT NULL DEFAULT 0,
  refunded INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT
);

-- Restaurant sales payments (diners paying restaurants). Platform subscription payments live elsewhere.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL,
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  method TEXT NOT NULL CHECK (method IN ('cash','upi','online','card')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  reference TEXT NOT NULL DEFAULT '',
  provider TEXT,
  provider_mode TEXT CHECK (provider_mode IN ('test','live')),
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT,
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('customer','staff')),
  recorded_by INTEGER REFERENCES users(id),
  confirmed_by INTEGER REFERENCES users(id),
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);

CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL,
  payment_id INTEGER NOT NULL REFERENCES payments(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('pending','processed','failed')),
  provider_refund_id TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  verified INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, event_id)
);

-- Platform subscription billing (restaurant pays TableServe). Kept fully separate from payments.
CREATE TABLE IF NOT EXISTS subscription_payments (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id),
  period TEXT NOT NULL CHECK (period IN ('monthly','annual')),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','refunded')),
  reference TEXT NOT NULL DEFAULT '',
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  assigned_to INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  from_platform INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  company_id INTEGER,
  branch_id INTEGER,
  actor_user_id INTEGER,
  actor_label TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id INTEGER,
  details TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id, created_at);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return wrap(db);
}

// Small convenience wrapper: get/all/run with positional or named params, plus transactions.
function wrap(raw) {
  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = raw.prepare(sql); cache.set(sql, s); }
    return s;
  };
  const norm = (row) => (row ? { ...row } : row);
  let depth = 0;
  return {
    raw,
    get: (sql, ...p) => norm(stmt(sql).get(...p)),
    all: (sql, ...p) => stmt(sql).all(...p).map(norm),
    run: (sql, ...p) => {
      const r = stmt(sql).run(...p);
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
    },
    exec: (sql) => raw.exec(sql),
    // Synchronous transaction. node:sqlite is synchronous, so a transaction is atomic with
    // respect to all other requests in this process.
    tx(fn) {
      if (depth > 0) return fn();
      depth++;
      raw.exec('BEGIN IMMEDIATE');
      try {
        const out = fn();
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close: () => raw.close(),
  };
}
