// Administration API for owners and restaurant admins: company profile, branches, menus, tables,
// QR codes, staff, reports, audit log and support.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { h } from './common.js';
import { HttpError, bad, conflict, forbidden, notFound, json, str, int, num, oneOf, bool, email as vEmail, randomToken, sha256 } from '../util.js';
import { ROLE_LABELS } from '../auth.js';
import { esc } from '../receipt.js';

const DIETS = ['veg', 'nonveg', 'egg', 'vegan'];
const ALLERGENS = ['gluten', 'dairy', 'nuts', 'peanuts', 'soy', 'egg', 'fish', 'shellfish', 'sesame', 'mustard', 'celery', 'sulphites'];

export default function manageRoutes({ db, hub, auth, services, config, cipher, gateway }) {
  const r = Router();
  r.use(auth.requireMember);
  const perm = auth.requirePerm;
  const audit = (req, action, entity, entity_id, details = {}, branch_id = null) =>
    services.audit({ company_id: req.member.company_id, branch_id, actor: req.user, action, entity, entity_id, details, ip: req.ip });

  // ---------------------------------------------------------------- company profile & settings
  function companyView(c) {
    const ps = json(c.payment_settings, {});
    return {
      id: c.id, name: c.name, slug: c.slug, logo_url: c.logo_url, description: c.description, phone: c.phone, email: c.email,
      address: c.address, opening_hours: c.opening_hours, brand_color: c.brand_color, currency: c.currency,
      languages: json(c.languages, ['en']), ordering_mode: c.ordering_mode, taxes: json(c.taxes, []),
      service_charge_pct: c.service_charge_pct,
      payment_settings: {
        cash: ps.cash !== false, pay_at_counter: ps.pay_at_counter !== false, upi: !!ps.upi, upi_vpa: ps.upi_vpa || '', upi_payee: ps.upi_payee || '',
        online: !!ps.online, online_provider: ps.online_provider || 'test', razorpay_key_id: ps.razorpay_key_id || '',
        razorpay_key_secret_set: !!ps.razorpay_key_secret_enc, razorpay_webhook_secret_set: !!ps.razorpay_webhook_secret_enc,
        webhook_url: `${config.appUrl}/api/webhooks/razorpay/${c.id}`,
        test_payments_allowed: config.allowTestPayments,
        effective_online: gateway.companyGateway(c)?.provider || null,
      },
    };
  }

  r.get('/company', perm('reports.view'), (req, res) => res.json({ company: companyView(req.company) }));

  r.put('/company', perm('company.manage'), h((req, res) => {
    const b = req.body || {};
    const c = req.company;
    const taxes = Array.isArray(b.taxes) ? b.taxes.slice(0, 5).map((t, i) => ({
      name: str(t?.name, `Tax ${i + 1} name`, { required: true, max: 30 }),
      rate: num(t?.rate, `Tax ${i + 1} rate`, { min: 0, max: 50, required: true }),
    })) : json(c.taxes, []);
    const langs = Array.isArray(b.languages) ? b.languages.filter((l) => ['en', 'hi'].includes(l)) : json(c.languages, ['en']);
    if (!langs.length) throw bad('Choose at least one language');
    const color = b.brand_color ?? c.brand_color;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw bad('Brand colour must be a hex colour like #d9480f');
    db.run(`UPDATE companies SET name=?, logo_url=?, description=?, phone=?, email=?, address=?, opening_hours=?, brand_color=?, currency=?,
              languages=?, ordering_mode=?, taxes=?, service_charge_pct=? WHERE id=?`,
      str(b.name ?? c.name, 'Name', { required: true, max: 80 }), imageUrl(b.logo_url ?? c.logo_url),
      str(b.description ?? c.description, 'Description', { max: 600 }), str(b.phone ?? c.phone, 'Phone', { max: 30 }),
      str(b.email ?? c.email, 'Email', { max: 160 }), str(b.address ?? c.address, 'Address', { max: 300 }),
      str(b.opening_hours ?? c.opening_hours, 'Opening hours', { max: 300 }), color,
      oneOf(b.currency ?? c.currency, 'Currency', ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']), JSON.stringify(langs),
      oneOf(b.ordering_mode ?? c.ordering_mode, 'Ordering mode', ['menu_only', 'ordering']), JSON.stringify(taxes),
      num(b.service_charge_pct ?? c.service_charge_pct, 'Service charge', { min: 0, max: 30 }), c.id);
    audit(req, 'company.update', 'company', c.id, { fields: Object.keys(b) });
    for (const br of db.all('SELECT id FROM branches WHERE company_id = ?', c.id)) services.emitMenu(br.id, 'company');
    res.json({ company: companyView(db.get('SELECT * FROM companies WHERE id = ?', c.id)) });
  }));

  r.put('/company/payments', perm('company.manage'), h((req, res) => {
    const b = req.body || {};
    const c = req.company;
    const ps = json(c.payment_settings, {});
    const next = {
      ...ps,
      cash: bool(b.cash), pay_at_counter: bool(b.pay_at_counter), upi: bool(b.upi),
      upi_vpa: str(b.upi_vpa, 'UPI ID', { max: 80 }), upi_payee: str(b.upi_payee, 'UPI payee name', { max: 80 }),
      online: bool(b.online), online_provider: oneOf(b.online_provider, 'Provider', ['test', 'razorpay'], { fallback: 'test' }),
      razorpay_key_id: str(b.razorpay_key_id, 'Razorpay Key ID', { max: 60 }),
    };
    if (next.upi && !/^[\w.-]+@[\w.-]+$/.test(next.upi_vpa)) throw bad('Enter a valid UPI ID such as restaurant@okbank');
    if (next.razorpay_key_id && !/^rzp_(test|live)_\w+$/.test(next.razorpay_key_id)) throw bad('Razorpay Key ID should start with rzp_test_ or rzp_live_');
    // Secrets are write-only: blank keeps the stored value; they are never sent back to the browser.
    if (b.razorpay_key_secret) next.razorpay_key_secret_enc = cipher.encrypt(str(b.razorpay_key_secret, 'Key secret', { max: 200 }));
    if (b.razorpay_webhook_secret) next.razorpay_webhook_secret_enc = cipher.encrypt(str(b.razorpay_webhook_secret, 'Webhook secret', { max: 200 }));
    if (bool(b.clear_razorpay)) { delete next.razorpay_key_secret_enc; delete next.razorpay_webhook_secret_enc; next.razorpay_key_id = ''; }
    if (next.online && next.online_provider === 'razorpay' && !(next.razorpay_key_id && next.razorpay_key_secret_enc && next.razorpay_webhook_secret_enc)) {
      throw bad('Razorpay needs a Key ID, Key Secret and Webhook Secret');
    }
    db.run('UPDATE companies SET payment_settings = ? WHERE id = ?', JSON.stringify(next), c.id);
    audit(req, 'company.payment_settings', 'company', c.id, { cash: next.cash, upi: next.upi, online: next.online, provider: next.online_provider, secrets_changed: !!(b.razorpay_key_secret || b.razorpay_webhook_secret) });
    res.json({ company: companyView(db.get('SELECT * FROM companies WHERE id = ?', c.id)) });
  }));

  // Image upload (logo / dish photos) as a base64 data URL; stored on local disk.
  r.post('/uploads', perm('menu.manage'), h((req, res) => {
    const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.data || ''));
    if (!m) throw bad('Upload a PNG, JPEG, WEBP or GIF image');
    const buf = Buffer.from(m[3], 'base64');
    if (buf.length > 2.5 * 1024 * 1024) throw bad('Image must be smaller than 2.5 MB');
    const ext = { png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif' }[m[2]];
    const name = `c${req.member.company_id}-${randomToken(10)}.${ext}`;
    fs.writeFileSync(path.join(config.uploadDir, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  }));

  // ---------------------------------------------------------------- branches
  const branchFields = (b, cur = {}) => ({
    name: str(b.name ?? cur.name, 'Branch name', { required: true, max: 80 }),
    address: str(b.address ?? cur.address, 'Address', { max: 300 }),
    phone: str(b.phone ?? cur.phone, 'Phone', { max: 30 }),
    opening_hours: str(b.opening_hours ?? cur.opening_hours, 'Opening hours', { max: 300 }),
    self_start_sessions: bool(b.self_start_sessions ?? cur.self_start_sessions) ? 1 : 0,
    default_prep_minutes: int(b.default_prep_minutes ?? cur.default_prep_minutes ?? 15, 'Default preparation time', { min: 1, max: 240 }),
    max_cashier_discount_pct: num(b.max_cashier_discount_pct ?? cur.max_cashier_discount_pct ?? 10, 'Cashier discount limit', { min: 0, max: 100 }),
  });

  r.get('/branches', perm('reports.view'), h((req, res) => {
    const rows = db.all('SELECT * FROM branches WHERE company_id = ? ORDER BY id', req.member.company_id)
      .filter((b) => req.member.branch_ids.includes(b.id))
      .map((b) => ({ ...b, tables: db.get('SELECT COUNT(*) n FROM tables WHERE branch_id = ? AND active = 1', b.id).n, items: db.get('SELECT COUNT(*) n FROM menu_items WHERE branch_id = ? AND active = 1', b.id).n }));
    res.json({ branches: rows });
  }));

  r.post('/branches', perm('branches.create'), h((req, res) => {
    services.assertPlanLimit(req.company, 'branches');
    const f = branchFields(req.body || {});
    const id = db.run(`INSERT INTO branches (company_id, name, address, phone, opening_hours, self_start_sessions, default_prep_minutes, max_cashier_discount_pct)
      VALUES (?,?,?,?,?,?,?,?)`, req.member.company_id, f.name, f.address, f.phone, f.opening_hours, f.self_start_sessions, f.default_prep_minutes, f.max_cashier_discount_pct).lastId;
    const from = int(req.body?.copy_menu_from, 'Copy menu from', { min: 1 });
    if (from) copyMenu(req, auth.assertBranch(req.member, from).id, id);
    audit(req, 'branch.create', 'branch', id, { name: f.name }, id);
    res.status(201).json({ branch: db.get('SELECT * FROM branches WHERE id = ?', id) });
  }));

  r.put('/branches/:id', perm('branches.settings'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.id);
    const f = branchFields(req.body || {}, b);
    db.run(`UPDATE branches SET name=?, address=?, phone=?, opening_hours=?, self_start_sessions=?, default_prep_minutes=?, max_cashier_discount_pct=? WHERE id=?`,
      f.name, f.address, f.phone, f.opening_hours, f.self_start_sessions, f.default_prep_minutes, f.max_cashier_discount_pct, b.id);
    audit(req, 'branch.update', 'branch', b.id, f, b.id);
    services.emitMenu(b.id, 'branch');
    res.json({ branch: db.get('SELECT * FROM branches WHERE id = ?', b.id) });
  }));

  r.post('/branches/:id/active', perm('branches.create'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.id);
    const active = bool(req.body?.active);
    if (active && !b.active) services.assertPlanLimit(req.company, 'branches');
    db.run('UPDATE branches SET active = ? WHERE id = ?', active ? 1 : 0, b.id);
    audit(req, active ? 'branch.activate' : 'branch.deactivate', 'branch', b.id, {}, b.id);
    res.json({ ok: true });
  }));

  function copyMenu(req, fromId, toId) {
    db.tx(() => {
      const catMap = new Map();
      for (const c of db.all('SELECT * FROM categories WHERE branch_id = ?', fromId)) {
        catMap.set(c.id, db.run('INSERT INTO categories (company_id, branch_id, name, name_hi, sort, active) VALUES (?,?,?,?,?,?)',
          req.member.company_id, toId, c.name, c.name_hi, c.sort, c.active).lastId);
      }
      for (const i of db.all('SELECT * FROM menu_items WHERE branch_id = ?', fromId)) {
        db.run(`INSERT INTO menu_items (company_id, branch_id, category_id, name, name_hi, description, description_hi, price, image_url, portion_size, diet,
          ingredients, allergens, spice_level, taste_notes, options, is_popular, is_special, is_combo, combo_details, prep_minutes, in_stock, active, sort)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        req.member.company_id, toId, catMap.get(i.category_id) ?? null, i.name, i.name_hi, i.description, i.description_hi, i.price, i.image_url, i.portion_size, i.diet,
        i.ingredients, i.allergens, i.spice_level, i.taste_notes, i.options, i.is_popular, i.is_special, i.is_combo, i.combo_details, i.prep_minutes, i.in_stock, i.active, i.sort);
      }
    });
  }

  r.post('/branches/:id/copy-menu', perm('menu.manage'), h((req, res) => {
    const to = auth.assertBranch(req.member, req.params.id);
    const from = auth.assertBranch(req.member, req.body?.from_branch_id);
    if (from.id === to.id) throw bad('Choose a different branch');
    copyMenu(req, from.id, to.id);
    audit(req, 'menu.copy', 'branch', to.id, { from: from.id }, to.id);
    services.emitMenu(to.id);
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- menu
  r.post('/branches/:bid/categories', perm('menu.manage'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    const id = db.run('INSERT INTO categories (company_id, branch_id, name, name_hi, sort) VALUES (?,?,?,?,?)', b.company_id, b.id,
      str(req.body?.name, 'Category name', { required: true, max: 60 }), str(req.body?.name_hi, 'Hindi name', { max: 60 }), int(req.body?.sort, 'Sort', { fallback: 0 })).lastId;
    services.emitMenu(b.id);
    res.status(201).json({ category: db.get('SELECT * FROM categories WHERE id = ?', id) });
  }));

  r.put('/categories/:id', perm('menu.manage'), h((req, res) => {
    const c = auth.scoped(req.member, 'categories', req.params.id, 'Category');
    db.run('UPDATE categories SET name=?, name_hi=?, sort=?, active=? WHERE id=?',
      str(req.body?.name ?? c.name, 'Category name', { required: true, max: 60 }), str(req.body?.name_hi ?? c.name_hi, 'Hindi name', { max: 60 }),
      int(req.body?.sort ?? c.sort, 'Sort', { fallback: 0 }), bool(req.body?.active ?? c.active) ? 1 : 0, c.id);
    services.emitMenu(c.branch_id);
    res.json({ category: db.get('SELECT * FROM categories WHERE id = ?', c.id) });
  }));

  r.delete('/categories/:id', perm('menu.manage'), h((req, res) => {
    const c = auth.scoped(req.member, 'categories', req.params.id, 'Category');
    if (db.get('SELECT COUNT(*) n FROM menu_items WHERE category_id = ?', c.id).n) throw conflict('Move or delete the dishes in this category first');
    db.run('DELETE FROM categories WHERE id = ?', c.id);
    services.emitMenu(c.branch_id);
    res.json({ ok: true });
  }));

  function parseOptions(raw) {
    if (!Array.isArray(raw)) return [];
    if (raw.length > 8) throw bad('At most 8 option groups per dish');
    return raw.map((g, gi) => {
      const choices = Array.isArray(g?.choices) ? g.choices : [];
      if (!choices.length) throw bad(`Option group ${gi + 1} needs at least one choice`);
      if (choices.length > 20) throw bad('At most 20 choices per option group');
      const type = oneOf(g.type, 'Option type', ['single', 'multi'], { fallback: 'single' });
      return {
        id: str(g.id, 'Group id', { max: 40 }) || `g${gi + 1}`,
        name: str(g.name, `Option group ${gi + 1} name`, { required: true, max: 40 }),
        name_hi: str(g.name_hi, 'Hindi name', { max: 40 }),
        type,
        required: bool(g.required),
        max: type === 'multi' ? int(g.max, 'Max choices', { min: 1, max: 20, fallback: null }) : 1,
        choices: choices.map((c, ci) => ({
          id: str(c.id, 'Choice id', { max: 40 }) || `c${ci + 1}`,
          name: str(c.name, `Choice ${ci + 1} name`, { required: true, max: 40 }),
          name_hi: str(c.name_hi, 'Hindi name', { max: 40 }),
          price: Math.round(num(c.price ?? 0, 'Extra price', { min: -100000, max: 100000 }) * 100),
          in_stock: c.in_stock !== false,
        })),
      };
    });
  }

  function itemFields(b, cur = {}) {
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const pick = (k, d) => (has(k) ? b[k] : cur[k] ?? d);
    const allergens = has('allergens') ? (Array.isArray(b.allergens) ? b.allergens.filter((a) => ALLERGENS.includes(a)) : []) : json(cur.allergens, []);
    return {
      category_id: pick('category_id', null) ? Number(pick('category_id')) : null,
      name: str(pick('name'), 'Dish name', { required: true, max: 80 }),
      name_hi: str(pick('name_hi', ''), 'Hindi name', { max: 80 }),
      description: str(pick('description', ''), 'Description', { max: 500 }),
      description_hi: str(pick('description_hi', ''), 'Hindi description', { max: 500 }),
      // Prices arrive in major units (₹) from the admin form and are stored in paise.
      price: has('price') ? Math.round(num(b.price, 'Price', { min: 0, max: 1000000, required: true }) * 100) : cur.price,
      image_url: imageUrl(pick('image_url', '')),
      portion_size: str(pick('portion_size', ''), 'Portion size', { max: 60 }),
      diet: oneOf(pick('diet', 'veg'), 'Diet', DIETS),
      ingredients: str(pick('ingredients', ''), 'Ingredients', { max: 500 }),
      allergens: JSON.stringify(allergens),
      spice_level: int(pick('spice_level', 0), 'Spice level', { min: 0, max: 3, fallback: 0 }),
      taste_notes: str(pick('taste_notes', ''), 'Taste notes', { max: 200 }),
      options: has('options') ? JSON.stringify(parseOptions(b.options)) : cur.options ?? '[]',
      is_popular: bool(pick('is_popular', 0)) ? 1 : 0,
      is_special: bool(pick('is_special', 0)) ? 1 : 0,
      is_combo: bool(pick('is_combo', 0)) ? 1 : 0,
      combo_details: str(pick('combo_details', ''), 'Combo details', { max: 300 }),
      prep_minutes: int(pick('prep_minutes', null), 'Preparation time', { min: 1, max: 240 }),
      in_stock: bool(pick('in_stock', 1)) ? 1 : 0,
      active: bool(pick('active', 1)) ? 1 : 0,
      sort: int(pick('sort', 0), 'Sort', { fallback: 0 }),
    };
  }

  function imageUrl(v) {
    const u = str(v, 'Image URL', { max: 6000 });
    if (!u) return null;
    if (!/^(https:\/\/|\/uploads\/|data:image\/(svg\+xml|png|jpeg|webp);)/.test(u)) throw bad('Image must be an uploaded file or an https:// link');
    return u;
  }

  const ITEM_COLS = ['category_id', 'name', 'name_hi', 'description', 'description_hi', 'price', 'image_url', 'portion_size', 'diet', 'ingredients', 'allergens',
    'spice_level', 'taste_notes', 'options', 'is_popular', 'is_special', 'is_combo', 'combo_details', 'prep_minutes', 'in_stock', 'active', 'sort'];

  function checkCategory(branchId, catId) {
    if (catId && !db.get('SELECT id FROM categories WHERE id = ? AND branch_id = ?', catId, branchId)) throw bad('Category does not belong to this branch');
  }

  r.post('/branches/:bid/items', perm('menu.manage'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    const f = itemFields(req.body || {});
    checkCategory(b.id, f.category_id);
    const id = db.run(`INSERT INTO menu_items (company_id, branch_id, ${ITEM_COLS.join(',')}) VALUES (?,?,${ITEM_COLS.map(() => '?').join(',')})`,
      b.company_id, b.id, ...ITEM_COLS.map((k) => f[k])).lastId;
    audit(req, 'menu.item_create', 'menu_item', id, { name: f.name, price: f.price }, b.id);
    services.emitMenu(b.id);
    res.status(201).json({ item: db.get('SELECT * FROM menu_items WHERE id = ?', id) });
  }));

  r.put('/items/:id', perm('menu.manage'), h((req, res) => {
    const it = auth.scoped(req.member, 'menu_items', req.params.id, 'Dish');
    const f = itemFields(req.body || {}, it);
    checkCategory(it.branch_id, f.category_id);
    db.run(`UPDATE menu_items SET ${ITEM_COLS.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, ...ITEM_COLS.map((k) => f[k]), it.id);
    if (f.price !== it.price) audit(req, 'menu.price_change', 'menu_item', it.id, { name: f.name, from: it.price, to: f.price }, it.branch_id);
    services.emitMenu(it.branch_id);
    res.json({ item: db.get('SELECT * FROM menu_items WHERE id = ?', it.id) });
  }));

  r.delete('/items/:id', perm('menu.manage'), h((req, res) => {
    const it = auth.scoped(req.member, 'menu_items', req.params.id, 'Dish');
    // Soft-delete: past orders keep their frozen snapshot either way.
    db.run(`UPDATE menu_items SET active = 0, updated_at = datetime('now') WHERE id = ?`, it.id);
    audit(req, 'menu.item_remove', 'menu_item', it.id, { name: it.name }, it.branch_id);
    services.emitMenu(it.branch_id);
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- tables & QR codes
  r.get('/branches/:bid/tables', perm('tables.manage'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    res.json({ tables: db.all('SELECT * FROM tables WHERE branch_id = ? ORDER BY active DESC, CAST(number AS INTEGER), number', b.id).map(services.tableView) });
  }));

  r.post('/branches/:bid/tables', perm('tables.manage'), h((req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    services.assertPlanLimit(req.company, 'tables');
    const number = str(req.body?.number, 'Table number', { required: true, max: 20 });
    if (db.get('SELECT id FROM tables WHERE branch_id = ? AND number = ?', b.id, number)) throw conflict(`Table ${number} already exists in this branch`);
    const id = db.run('INSERT INTO tables (company_id, branch_id, number, capacity, section, qr_token) VALUES (?,?,?,?,?,?)',
      b.company_id, b.id, number, int(req.body?.capacity, 'Seats', { min: 1, max: 50, fallback: 4 }), str(req.body?.section, 'Section', { max: 40 }), randomToken(12)).lastId;
    audit(req, 'table.create', 'table', id, { number }, b.id);
    services.emitTable(id);
    res.status(201).json({ table: services.tableView(db.get('SELECT * FROM tables WHERE id = ?', id)) });
  }));

  r.put('/tables/:id', perm('tables.manage'), h((req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    const number = str(req.body?.number ?? t.number, 'Table number', { required: true, max: 20 });
    if (number !== t.number && db.get('SELECT id FROM tables WHERE branch_id = ? AND number = ?', t.branch_id, number)) throw conflict(`Table ${number} already exists`);
    let waiter = req.body?.assigned_waiter_id ? Number(req.body.assigned_waiter_id) : null;
    if (waiter) {
      const m = auth.loadMember(waiter, req.member.company_id);
      if (!m || !m.branch_ids.includes(t.branch_id)) throw bad('That staff member does not work at this branch');
    }
    const active = req.body?.active == null ? t.active : bool(req.body.active) ? 1 : 0;
    if (!active && t.current_session_id) throw conflict('Close the table session before deactivating the table');
    if (active && !t.active) services.assertPlanLimit(req.company, 'tables');
    // NOTE: qr_token is never changed by edits, so printed QR codes keep working.
    db.run('UPDATE tables SET number=?, capacity=?, section=?, assigned_waiter_id=?, active=? WHERE id=?', number,
      int(req.body?.capacity ?? t.capacity, 'Seats', { min: 1, max: 50 }), str(req.body?.section ?? t.section, 'Section', { max: 40 }), waiter, active, t.id);
    audit(req, 'table.update', 'table', t.id, { number, active }, t.branch_id);
    services.emitTable(t.id);
    res.json({ table: services.tableView(db.get('SELECT * FROM tables WHERE id = ?', t.id)) });
  }));

  // Rotating a QR is an explicit, audited action (e.g. a code was photographed and abused).
  r.post('/tables/:id/rotate-qr', perm('tables.manage'), h((req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    db.run('UPDATE tables SET qr_token = ? WHERE id = ?', randomToken(12), t.id);
    audit(req, 'table.rotate_qr', 'table', t.id, { number: t.number }, t.branch_id);
    res.json({ table: services.tableView(db.get('SELECT * FROM tables WHERE id = ?', t.id)) });
  }));

  r.get('/tables/:id/qr.:fmt(svg|png)', perm('tables.manage'), h(async (req, res) => {
    const t = auth.scoped(req.member, 'tables', req.params.id, 'Table');
    const url = services.tableUrl(t);
    if (req.params.fmt === 'png') {
      const buf = await QRCode.toBuffer(url, { type: 'png', width: 800, margin: 2, errorCorrectionLevel: 'M' });
      res.set('Content-Disposition', `attachment; filename="table-${t.number}-qr.png"`).type('png').send(buf);
    } else {
      res.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }));
    }
  }));

  // Printable sheet of table tents for a whole branch.
  r.get('/branches/:bid/qr-sheet', perm('tables.manage'), h(async (req, res) => {
    const b = auth.assertBranch(req.member, req.params.bid);
    const c = req.company;
    const only = req.query.table ? Number(req.query.table) : null;
    const tables = db.all('SELECT * FROM tables WHERE branch_id = ? AND active = 1 ORDER BY CAST(number AS INTEGER), number', b.id).filter((t) => !only || t.id === only);
    const cards = await Promise.all(tables.map(async (t) => `<div class="card"><div class="brand">${esc(c.name)}</div><div class="br">${esc(b.name)}</div>
      ${await QRCode.toString(services.tableUrl(t), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })}
      <div class="tn">Table ${esc(t.number)}</div><div class="hint">Scan to view the menu &amp; order<br>मेन्यू देखने और ऑर्डर करने के लिए स्कैन करें</div></div>`));
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>QR codes – ${esc(b.name)}</title><style>
      body{font-family:system-ui,sans-serif;margin:16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
      .card{border:2px solid ${esc(c.brand_color)};border-radius:16px;padding:16px;text-align:center;break-inside:avoid}
      .brand{font-weight:800;font-size:20px;color:${esc(c.brand_color)}}.br{color:#555;font-size:13px}.tn{font-size:28px;font-weight:800;margin-top:4px}
      .hint{font-size:12px;color:#555}svg{width:180px;height:180px}@media print{.no{display:none}}</style></head><body>
      <p class="no"><button onclick="print()">Print</button> ${tables.length} table(s)</p><div class="grid">${cards.join('')}</div></body></html>`);
  }));

  // ---------------------------------------------------------------- staff & invitations
  r.get('/staff', perm('staff.manage'), h((req, res) => {
    const m = req.member;
    const rows = db.all(`SELECT cm.id, cm.role, cm.status, cm.created_at, u.id AS user_id, u.name, u.email, u.phone FROM company_members cm
       JOIN users u ON u.id = cm.user_id WHERE cm.company_id = ? ORDER BY cm.role, u.name`, m.company_id)
      .map((x) => ({ ...x, role_label: ROLE_LABELS[x.role], branch_ids: x.role === 'owner' ? 'all' : db.all('SELECT branch_id FROM member_branches WHERE member_id = ?', x.id).map((b) => b.branch_id) }))
      // Admins only see staff who work in at least one of their branches.
      .filter((x) => m.role === 'owner' || x.branch_ids === 'all' || x.branch_ids.some((b) => m.branch_ids.includes(b)));
    const invites = db.all(`SELECT id, email, role, branch_ids, expires_at, created_at FROM invitations WHERE company_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ? ORDER BY id DESC`,
      m.company_id, new Date().toISOString()).map((i) => ({ ...i, branch_ids: json(i.branch_ids, []) }));
    res.json({ staff: rows, invitations: invites });
  }));

  function validateAssignment(req, role, branchIds) {
    const m = req.member;
    if (role === 'owner') throw forbidden('Ownership cannot be assigned through invitations');
    if (role === 'admin' && !auth.can(m, 'staff.manage_admins')) throw forbidden('Only the owner can add restaurant admins');
    if (!Array.isArray(branchIds) || !branchIds.length) throw bad('Assign at least one branch');
    const ids = [...new Set(branchIds.map(Number))];
    for (const id of ids) auth.assertBranch(m, id);
    return ids;
  }

  r.post('/invitations', perm('staff.manage'), h((req, res) => {
    const role = oneOf(req.body?.role, 'Role', ['admin', 'kitchen', 'waiter', 'cashier']);
    const branchIds = validateAssignment(req, role, req.body?.branch_ids);
    const em = vEmail(req.body?.email);
    const existingMember = db.get(`SELECT cm.id FROM company_members cm JOIN users u ON u.id = cm.user_id WHERE cm.company_id = ? AND u.email = ? AND cm.status='active'`, req.member.company_id, em);
    if (existingMember) throw conflict('This person is already on your team');
    services.assertPlanLimit(req.company, 'staff');
    const token = randomToken(24);
    db.run(`INSERT INTO invitations (company_id, email, role, branch_ids, token_hash, invited_by, expires_at) VALUES (?,?,?,?,?,?,?)`,
      req.member.company_id, em, role, JSON.stringify(branchIds), sha256(token), req.user.id, new Date(Date.now() + 7 * 864e5).toISOString());
    audit(req, 'staff.invite', 'invitation', null, { email: em, role, branch_ids: branchIds });
    // Email delivery needs an SMTP provider (see README); the link is returned so it can be shared directly.
    res.status(201).json({ invite_url: `${config.appUrl}/invite/${token}`, email_sent: false });
  }));

  r.delete('/invitations/:id', perm('staff.manage'), h((req, res) => {
    const inv = db.get('SELECT * FROM invitations WHERE id = ? AND company_id = ?', Number(req.params.id), req.member.company_id);
    if (!inv) throw notFound('Invitation');
    db.run(`UPDATE invitations SET revoked_at = datetime('now') WHERE id = ?`, inv.id);
    audit(req, 'staff.invite_revoke', 'invitation', inv.id, { email: inv.email });
    res.json({ ok: true });
  }));

  r.put('/staff/:id', perm('staff.manage'), h((req, res) => {
    const target = db.get('SELECT * FROM company_members WHERE id = ? AND company_id = ?', Number(req.params.id), req.member.company_id);
    if (!target) throw notFound('Staff member');
    if (target.role === 'owner') throw forbidden('The owner account cannot be changed here');
    if (target.user_id === req.user.id) throw forbidden('You cannot change your own access');
    const targetBranches = db.all('SELECT branch_id FROM member_branches WHERE member_id = ?', target.id).map((x) => x.branch_id);
    if (req.member.role !== 'owner') {
      if (target.role === 'admin') throw forbidden('Only the owner can change restaurant admins');
      if (!targetBranches.every((b) => req.member.branch_ids.includes(b))) throw forbidden('This person also works at branches you do not manage');
    }
    const role = oneOf(req.body?.role ?? target.role, 'Role', ['admin', 'kitchen', 'waiter', 'cashier']);
    const branchIds = validateAssignment(req, role, req.body?.branch_ids ?? targetBranches);
    const status = oneOf(req.body?.status ?? target.status, 'Status', ['active', 'disabled']);
    db.tx(() => {
      db.run('UPDATE company_members SET role = ?, status = ? WHERE id = ?', role, status, target.id);
      db.run('DELETE FROM member_branches WHERE member_id = ?', target.id);
      for (const b of branchIds) db.run('INSERT INTO member_branches (member_id, branch_id) VALUES (?,?)', target.id, b);
    });
    audit(req, status === 'disabled' && target.status !== 'disabled' ? 'staff.disable' : 'staff.update', 'member', target.id, { role, branch_ids: branchIds, status });
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- reports
  function reportScope(req) {
    const m = req.member;
    let branchIds = m.branch_ids;
    if (req.query.branch_id) branchIds = [auth.assertBranch(m, req.query.branch_id).id];
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : new Date(to.getTime() - 29 * 864e5);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw bad('Invalid date range');
    const group = ['day', 'week', 'month'].includes(req.query.group) ? req.query.group : 'day';
    return { branchIds, from: from.toISOString(), to: to.toISOString(), group };
  }

  const inList = (ids) => (ids.length ? ids.map(Number).join(',') : '0');
  const bucket = (group, col) => ({
    day: `substr(${col},1,10)`,
    week: `strftime('%Y-W%W', ${col})`,
    month: `substr(${col},1,7)`,
  }[group]);

  function buildReport(req) {
    const { branchIds, from, to, group } = reportScope(req);
    const cid = req.member.company_id;
    const B = inList(branchIds);
    const paidCond = `p.company_id = ${cid} AND p.branch_id IN (${B}) AND p.status IN ('paid','refunded') AND p.confirmed_at BETWEEN ? AND ?`;
    const series = db.all(`SELECT ${bucket(group, 'p.confirmed_at')} AS period, SUM(p.amount) AS revenue, COUNT(DISTINCT p.bill_id) AS bills
      FROM payments p WHERE ${paidCond} GROUP BY period ORDER BY period`, from, to);
    const refundSeries = db.all(`SELECT ${bucket(group, 'r.created_at')} AS period, SUM(r.amount) AS refunds FROM refunds r JOIN payments p ON p.id = r.payment_id
      WHERE r.company_id = ${cid} AND p.branch_id IN (${B}) AND r.created_at BETWEEN ? AND ? GROUP BY period`, from, to);
    const refundMap = Object.fromEntries(refundSeries.map((x) => [x.period, x.refunds]));
    const paid = db.get(`SELECT COALESCE(SUM(p.amount),0) total, COUNT(*) n FROM payments p WHERE ${paidCond}`, from, to);
    const testPaid = db.get(`SELECT COALESCE(SUM(p.amount),0) total FROM payments p WHERE ${paidCond} AND p.provider_mode = 'test'`, from, to).total;
    const byMethod = db.all(`SELECT p.method, COALESCE(SUM(p.amount),0) total, COUNT(*) n FROM payments p WHERE ${paidCond} GROUP BY p.method`, from, to);
    const refunds = db.get(`SELECT COALESCE(SUM(r.amount),0) total, COUNT(*) n FROM refunds r JOIN payments p ON p.id = r.payment_id
      WHERE r.company_id = ${cid} AND p.branch_id IN (${B}) AND r.created_at BETWEEN ? AND ?`, from, to);
    const outstanding = db.all(`SELECT b.id, b.bill_no, b.total, b.paid, b.branch_id, b.created_at, t.number AS table_number, br.name AS branch_name
      FROM bills b JOIN tables t ON t.id = b.table_id JOIN branches br ON br.id = b.branch_id
      WHERE b.company_id = ${cid} AND b.branch_id IN (${B}) AND b.status = 'open' AND b.total > b.paid ORDER BY b.id DESC LIMIT 100`);
    const orders = db.get(`SELECT COUNT(*) n, SUM(status='cancelled') cancelled, SUM(CASE WHEN status != 'cancelled' THEN subtotal ELSE 0 END) gross
      FROM orders WHERE company_id = ${cid} AND branch_id IN (${B}) AND created_at BETWEEN ? AND ?`, from, to);
    const settled = db.get(`SELECT COUNT(*) n, COALESCE(SUM(total),0) total FROM bills WHERE company_id = ${cid} AND branch_id IN (${B}) AND status='paid' AND paid_at BETWEEN ? AND ?`, from, to);
    const best = db.all(`SELECT oi.name, SUM(oi.qty) qty, SUM(oi.line_total) revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.company_id = ${cid} AND o.branch_id IN (${B}) AND o.status IN ('accepted','preparing','ready','served') AND o.created_at BETWEEN ? AND ?
      GROUP BY oi.name ORDER BY qty DESC, revenue DESC LIMIT 10`, from, to);
    const branches = db.all(`SELECT br.id, br.name,
        (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.branch_id = br.id AND p.status IN ('paid','refunded') AND p.confirmed_at BETWEEN ? AND ?) AS revenue,
        (SELECT COUNT(*) FROM orders o WHERE o.branch_id = br.id AND o.status != 'cancelled' AND o.created_at BETWEEN ? AND ?) AS orders,
        (SELECT COUNT(*) FROM bills b WHERE b.branch_id = br.id AND b.status = 'paid' AND b.paid_at BETWEEN ? AND ?) AS bills,
        (SELECT COALESCE(SUM(r.amount),0) FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.branch_id = br.id AND r.created_at BETWEEN ? AND ?) AS refunds
      FROM branches br WHERE br.company_id = ${cid} AND br.id IN (${B}) ORDER BY revenue DESC`, from, to, from, to, from, to, from, to);
    return {
      range: { from, to, group },
      currency: req.company.currency,
      summary: {
        paid_revenue: paid.total, payments: paid.n, test_mode_revenue: testPaid, refunds: refunds.total, refund_count: refunds.n,
        net_revenue: paid.total - refunds.total, outstanding: outstanding.reduce((s, b) => s + (b.total - b.paid), 0), outstanding_bills: outstanding.length,
        orders: orders.n || 0, cancelled_orders: orders.cancelled || 0, settled_bills: settled.n,
        average_bill_value: settled.n ? Math.round(settled.total / settled.n) : 0,
      },
      series: series.map((s) => ({ ...s, refunds: refundMap[s.period] || 0 })),
      by_method: byMethod,
      best_sellers: best,
      branches,
      outstanding,
    };
  }

  r.get('/reports', perm('reports.view'), h((req, res) => res.json(buildReport(req))));

  r.get('/reports/export.csv', perm('reports.view'), h((req, res) => {
    const rep = buildReport(req);
    const cur = (v) => (v / 100).toFixed(2);
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      [`TableServe report`, req.company.name, `${rep.range.from.slice(0, 10)} to ${rep.range.to.slice(0, 10)}`, rep.currency].map(q).join(','),
      '', 'Summary',
      ...Object.entries(rep.summary).map(([k, v]) => [q(k), /revenue|refunds$|outstanding$|value/.test(k) ? cur(v) : v].join(',')),
      '', `Sales by ${rep.range.group}`, 'period,revenue,bills,refunds',
      ...rep.series.map((s) => [q(s.period), cur(s.revenue), s.bills, cur(s.refunds)].join(',')),
      '', 'Branch comparison', 'branch,revenue,orders,paid_bills,refunds',
      ...rep.branches.map((b) => [q(b.name), cur(b.revenue), b.orders, b.bills, cur(b.refunds)].join(',')),
      '', 'Best sellers', 'dish,quantity,revenue',
      ...rep.best_sellers.map((b) => [q(b.name), b.qty, cur(b.revenue)].join(',')),
      '', 'Outstanding bills', 'bill_no,branch,table,total,paid,created_at',
      ...rep.outstanding.map((b) => [b.bill_no, q(b.branch_name), q(b.table_number), cur(b.total), cur(b.paid), q(b.created_at)].join(',')),
    ];
    res.set('Content-Disposition', `attachment; filename="tableserve-report-${rep.range.from.slice(0, 10)}-${rep.range.to.slice(0, 10)}.csv"`);
    res.type('text/csv').send(lines.join('\n'));
  }));

  r.get('/audit', perm('audit.view'), h((req, res) => {
    const m = req.member;
    const B = inList(m.branch_ids);
    const rows = db.all(`SELECT a.*, u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.company_id = ? AND (a.branch_id IS NULL ${m.role === 'owner' ? 'OR 1' : ''} OR a.branch_id IN (${B}))
      ORDER BY a.id DESC LIMIT ?`, m.company_id, int(req.query.limit, 'Limit', { min: 1, max: 500, fallback: 200 }));
    res.json({ entries: rows.map((x) => ({ ...x, details: json(x.details, {}) })) });
  }));

  // ---------------------------------------------------------------- support & subscription
  r.get('/subscription', perm('company.manage'), h((req, res) => {
    const c = services.refreshSubscription(req.company);
    res.json({
      status: c.subscription_status, company_status: c.status, trial_ends_at: c.trial_ends_at, current_period_end: c.current_period_end,
      billing_period: c.billing_period, plan: services.planFor(c),
      plans: db.all('SELECT * FROM plans WHERE active = 1 ORDER BY price_monthly'),
      usage: {
        branches: db.get('SELECT COUNT(*) n FROM branches WHERE company_id = ? AND active = 1', c.id).n,
        tables: db.get('SELECT COUNT(*) n FROM tables WHERE company_id = ? AND active = 1', c.id).n,
        staff: db.get(`SELECT COUNT(*) n FROM company_members WHERE company_id = ? AND status='active'`, c.id).n,
      },
      payments: db.all('SELECT * FROM subscription_payments WHERE company_id = ? ORDER BY id DESC', c.id),
    });
  }));

  r.get('/support', perm('support.use'), h((req, res) => {
    const tickets = db.all('SELECT * FROM support_tickets WHERE company_id = ? ORDER BY id DESC', req.member.company_id);
    res.json({ tickets: tickets.map((t) => ({ ...t, messages: db.all(`SELECT m.*, u.name AS author FROM support_messages m LEFT JOIN users u ON u.id = m.author_id WHERE ticket_id = ? ORDER BY m.id`, t.id) })) });
  }));

  r.post('/support', perm('support.use'), h((req, res) => {
    const subject = str(req.body?.subject, 'Subject', { required: true, max: 120 });
    const body = str(req.body?.body, 'Message', { required: true, max: 4000 });
    const id = db.tx(() => {
      const tid = db.run('INSERT INTO support_tickets (company_id, created_by, subject, priority) VALUES (?,?,?,?)', req.member.company_id, req.user.id, subject,
        oneOf(req.body?.priority, 'Priority', ['low', 'normal', 'high'], { fallback: 'normal' })).lastId;
      db.run('INSERT INTO support_messages (ticket_id, author_id, body) VALUES (?,?,?)', tid, req.user.id, body);
      return tid;
    });
    res.status(201).json({ id });
  }));

  r.post('/support/:id/reply', perm('support.use'), h((req, res) => {
    const t = db.get('SELECT * FROM support_tickets WHERE id = ? AND company_id = ?', Number(req.params.id), req.member.company_id);
    if (!t) throw notFound('Ticket');
    db.run('INSERT INTO support_messages (ticket_id, author_id, body) VALUES (?,?,?)', t.id, req.user.id, str(req.body?.body, 'Message', { required: true, max: 4000 }));
    db.run(`UPDATE support_tickets SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), status = CASE WHEN status='resolved' THEN 'open' ELSE status END WHERE id = ?`, t.id);
    res.json({ ok: true });
  }));

  return r;
}
