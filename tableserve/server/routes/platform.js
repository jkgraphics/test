// Platform (SaaS operator) API: Super Admin and Platform Admins.
import { Router } from 'express';
import { h } from './common.js';
import { bad, conflict, forbidden, notFound, str, int, num, oneOf, bool, json, email as vEmail, hashPassword, randomToken, sha256, slugify } from '../util.js';
import { PLATFORM_PERMS } from '../auth.js';

export default function platformRoutes({ db, auth, services, config }) {
  const r = Router();
  r.use(auth.requireUser);
  const P = auth.requirePlatform;
  const audit = (req, action, entity, entity_id, details = {}, company_id = null) =>
    services.audit({ company_id, actor: req.user, action: `platform.${action}`, entity, entity_id, details, ip: req.ip });

  r.get('/overview', P(), h((req, res) => {
    for (const c of db.all('SELECT * FROM companies')) services.refreshSubscription(c);
    const subs = Object.fromEntries(db.all('SELECT subscription_status s, COUNT(*) n FROM companies GROUP BY s').map((x) => [x.s, x.n]));
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    res.json({
      me: { role: req.user.platform_role, perms: req.user.platform_role === 'super_admin' ? PLATFORM_PERMS : req.user.platform_perms },
      companies: db.get('SELECT COUNT(*) n FROM companies').n,
      suspended_companies: db.get(`SELECT COUNT(*) n FROM companies WHERE status='suspended'`).n,
      active_branches: db.get('SELECT COUNT(*) n FROM branches b JOIN companies c ON c.id = b.company_id WHERE b.active = 1 AND c.status = \'active\'').n,
      subscriptions: { trial: subs.trial || 0, active: subs.active || 0, expired: subs.expired || 0, suspended: subs.suspended || 0 },
      revenue: {
        all_time: db.get(`SELECT COALESCE(SUM(amount),0) n FROM subscription_payments WHERE status='paid'`).n,
        this_month: db.get(`SELECT COALESCE(SUM(amount),0) n FROM subscription_payments WHERE status='paid' AND created_at >= ?`, monthStart.toISOString()).n,
        by_month: db.all(`SELECT substr(created_at,1,7) month, SUM(amount) amount FROM subscription_payments WHERE status='paid' GROUP BY month ORDER BY month DESC LIMIT 12`),
      },
      open_tickets: db.get(`SELECT COUNT(*) n FROM support_tickets WHERE status != 'resolved'`).n,
    });
  }));

  // ---- companies ----------------------------------------------------------------------------
  r.get('/companies', P('companies.view'), h((req, res) => {
    const rows = db.all(`SELECT c.*, p.name AS plan_name,
        (SELECT COUNT(*) FROM branches b WHERE b.company_id = c.id AND b.active = 1) AS branches,
        (SELECT COUNT(*) FROM tables t WHERE t.company_id = c.id AND t.active = 1) AS tables,
        (SELECT COUNT(*) FROM company_members m WHERE m.company_id = c.id AND m.status='active') AS staff,
        (SELECT u.email FROM company_members m JOIN users u ON u.id = m.user_id WHERE m.company_id = c.id AND m.role='owner' LIMIT 1) AS owner_email
      FROM companies c LEFT JOIN plans p ON p.id = c.plan_id ORDER BY c.id`);
    res.json({ companies: rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, status: c.status, subscription_status: services.refreshSubscription(c).subscription_status, plan_id: c.plan_id, plan_name: c.plan_name, billing_period: c.billing_period, trial_ends_at: c.trial_ends_at, current_period_end: c.current_period_end, branches: c.branches, tables: c.tables, staff: c.staff, owner_email: c.owner_email, created_at: c.created_at, is_demo: !!c.is_demo })) });
  }));

  // Onboarding: create a company and an owner invitation link.
  r.post('/companies', P('onboarding'), h((req, res) => {
    const name = str(req.body?.name, 'Company name', { required: true, max: 80 });
    const ownerEmail = vEmail(req.body?.owner_email, 'Owner email');
    const plan = db.get('SELECT * FROM plans WHERE id = ? AND active = 1', int(req.body?.plan_id, 'Plan', { required: true }));
    if (!plan) throw bad('Choose a plan');
    const token = randomToken(24);
    const cid = db.tx(() => {
      let slug = slugify(name);
      while (db.get('SELECT id FROM companies WHERE slug = ?', slug)) slug = `${slugify(name)}-${randomToken(3).toLowerCase()}`;
      const id = db.run(`INSERT INTO companies (name, slug, email, plan_id, subscription_status, trial_ends_at, taxes, payment_settings) VALUES (?,?,?,?, 'trial', ?, ?, ?)`,
        name, slug, ownerEmail, plan.id, new Date(Date.now() + plan.trial_days * 864e5).toISOString(),
        JSON.stringify([{ name: 'CGST', rate: 2.5 }, { name: 'SGST', rate: 2.5 }]), JSON.stringify({ cash: true, online: true, online_provider: 'test', pay_at_counter: true })).lastId;
      db.run('INSERT INTO branches (company_id, name) VALUES (?,?)', id, 'Main Branch');
      return id;
    });
    // Owner invitation is a special invite: accepting it grants the 'owner' role.
    db.run(`INSERT INTO invitations (company_id, email, role, branch_ids, token_hash, invited_by, expires_at) VALUES (?,?,?,?,?,?,?)`,
      cid, ownerEmail, 'owner', '[]', sha256(token), req.user.id, new Date(Date.now() + 14 * 864e5).toISOString());
    audit(req, 'company.create', 'company', cid, { name, owner_email: ownerEmail, plan: plan.name }, cid);
    res.status(201).json({ company_id: cid, owner_invite_url: `${config.appUrl}/invite/${token}` });
  }));

  r.put('/companies/:id', P('companies.manage'), h((req, res) => {
    const c = db.get('SELECT * FROM companies WHERE id = ?', Number(req.params.id));
    if (!c) throw notFound('Company');
    const b = req.body || {};
    const planId = b.plan_id != null ? int(b.plan_id, 'Plan') : c.plan_id;
    if (planId && !db.get('SELECT id FROM plans WHERE id = ?', planId)) throw bad('Unknown plan');
    const status = oneOf(b.status ?? c.status, 'Status', ['active', 'suspended']);
    const sub = oneOf(b.subscription_status ?? c.subscription_status, 'Subscription status', ['trial', 'active', 'expired', 'suspended']);
    const isoOrNull = (v, cur) => (v === undefined ? cur : v ? new Date(v).toISOString() : null);
    const trialEnds = isoOrNull(b.trial_ends_at, c.trial_ends_at);
    const periodEnd = isoOrNull(b.current_period_end, c.current_period_end);
    db.run('UPDATE companies SET plan_id=?, status=?, subscription_status=?, trial_ends_at=?, current_period_end=?, billing_period=? WHERE id=?',
      planId, status, sub, trialEnds, periodEnd, oneOf(b.billing_period ?? c.billing_period, 'Billing period', ['monthly', 'annual']), c.id);
    audit(req, 'company.update', 'company', c.id, { status, subscription_status: sub, plan_id: planId, trial_ends_at: trialEnds, current_period_end: periodEnd }, c.id);
    res.json({ ok: true });
  }));

  r.post('/companies/:id/extend-trial', P('companies.manage'), h((req, res) => {
    const c = db.get('SELECT * FROM companies WHERE id = ?', Number(req.params.id));
    if (!c) throw notFound('Company');
    const days = int(req.body?.days, 'Days', { min: 1, max: 90, required: true });
    const base = c.trial_ends_at && c.trial_ends_at > new Date().toISOString() ? new Date(c.trial_ends_at) : new Date();
    const until = new Date(base.getTime() + days * 864e5).toISOString();
    db.run(`UPDATE companies SET trial_ends_at = ?, subscription_status = 'trial' WHERE id = ?`, until, c.id);
    audit(req, 'company.extend_trial', 'company', c.id, { days, until }, c.id);
    res.json({ trial_ends_at: until });
  }));

  // Platform subscription payments (restaurant → TableServe). Separate from restaurant sales.
  r.get('/subscription-payments', P('revenue.view'), h((req, res) => {
    res.json({ payments: db.all(`SELECT sp.*, c.name AS company_name, p.name AS plan_name FROM subscription_payments sp JOIN companies c ON c.id = sp.company_id
      LEFT JOIN plans p ON p.id = sp.plan_id ORDER BY sp.id DESC LIMIT 300`) });
  }));

  r.post('/companies/:id/subscription-payments', P('companies.manage'), h((req, res) => {
    const c = db.get('SELECT * FROM companies WHERE id = ?', Number(req.params.id));
    if (!c) throw notFound('Company');
    const plan = db.get('SELECT * FROM plans WHERE id = ?', int(req.body?.plan_id ?? c.plan_id, 'Plan', { required: true }));
    if (!plan) throw bad('Unknown plan');
    const period = oneOf(req.body?.period, 'Period', ['monthly', 'annual']);
    const amount = req.body?.amount != null && req.body.amount !== '' ? Math.round(num(req.body.amount, 'Amount', { min: 0 }) * 100) : (period === 'annual' ? plan.price_annual : plan.price_monthly);
    const reference = str(req.body?.reference, 'Reference', { max: 80 });
    db.tx(() => {
      db.run('INSERT INTO subscription_payments (company_id, plan_id, period, amount, status, reference, recorded_by) VALUES (?,?,?,?,?,?,?)', c.id, plan.id, period, amount, 'paid', reference, req.user.id);
      const base = c.current_period_end && c.current_period_end > new Date().toISOString() ? new Date(c.current_period_end) : new Date();
      const end = new Date(base); end.setUTCMonth(end.getUTCMonth() + (period === 'annual' ? 12 : 1));
      db.run(`UPDATE companies SET plan_id = ?, billing_period = ?, subscription_status = CASE WHEN status='suspended' THEN subscription_status ELSE 'active' END, current_period_end = ? WHERE id = ?`, plan.id, period, end.toISOString(), c.id);
      audit(req, 'subscription.payment', 'company', c.id, { amount, period, plan: plan.name, reference, until: end.toISOString() }, c.id);
    });
    res.status(201).json({ ok: true });
  }));

  // ---- plans --------------------------------------------------------------------------------
  r.get('/plans', P(), h((req, res) => res.json({ plans: db.all('SELECT * FROM plans ORDER BY price_monthly') })));

  const planFields = (b, cur = {}) => ({
    name: str(b.name ?? cur.name, 'Plan name', { required: true, max: 40 }),
    price_monthly: b.price_monthly != null ? Math.round(num(b.price_monthly, 'Monthly price', { min: 0 }) * 100) : cur.price_monthly,
    price_annual: b.price_annual != null ? Math.round(num(b.price_annual, 'Annual price', { min: 0 }) * 100) : cur.price_annual,
    max_branches: int(b.max_branches ?? cur.max_branches, 'Max branches', { min: 1, max: 1000, required: true }),
    max_tables: int(b.max_tables ?? cur.max_tables, 'Max tables', { min: 1, max: 10000, required: true }),
    max_staff: int(b.max_staff ?? cur.max_staff, 'Max staff', { min: 1, max: 10000, required: true }),
    trial_days: int(b.trial_days ?? cur.trial_days ?? 14, 'Trial days', { min: 0, max: 90 }),
    active: bool(b.active ?? cur.active ?? 1) ? 1 : 0,
  });

  r.post('/plans', P('plans.manage'), h((req, res) => {
    const f = planFields(req.body || {});
    if (f.price_monthly == null || f.price_annual == null) throw bad('Monthly and annual prices are required');
    const id = db.run('INSERT INTO plans (name, price_monthly, price_annual, max_branches, max_tables, max_staff, trial_days, active) VALUES (?,?,?,?,?,?,?,?)',
      f.name, f.price_monthly, f.price_annual, f.max_branches, f.max_tables, f.max_staff, f.trial_days, f.active).lastId;
    audit(req, 'plan.create', 'plan', id, f);
    res.status(201).json({ plan: db.get('SELECT * FROM plans WHERE id = ?', id) });
  }));

  r.put('/plans/:id', P('plans.manage'), h((req, res) => {
    const cur = db.get('SELECT * FROM plans WHERE id = ?', Number(req.params.id));
    if (!cur) throw notFound('Plan');
    const f = planFields(req.body || {}, cur);
    db.run('UPDATE plans SET name=?, price_monthly=?, price_annual=?, max_branches=?, max_tables=?, max_staff=?, trial_days=?, active=? WHERE id=?',
      f.name, f.price_monthly, f.price_annual, f.max_branches, f.max_tables, f.max_staff, f.trial_days, f.active, cur.id);
    audit(req, 'plan.update', 'plan', cur.id, f);
    res.json({ plan: db.get('SELECT * FROM plans WHERE id = ?', cur.id) });
  }));

  // ---- support ------------------------------------------------------------------------------
  r.get('/support', P('support'), h((req, res) => {
    const rows = db.all(`SELECT t.*, c.name AS company_name, u.name AS created_by_name FROM support_tickets t LEFT JOIN companies c ON c.id = t.company_id
      LEFT JOIN users u ON u.id = t.created_by ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.updated_at DESC LIMIT 200`);
    res.json({ tickets: rows.map((t) => ({ ...t, messages: db.all('SELECT m.*, u.name AS author FROM support_messages m LEFT JOIN users u ON u.id = m.author_id WHERE ticket_id = ? ORDER BY m.id', t.id) })) });
  }));

  r.post('/support/:id/reply', P('support'), h((req, res) => {
    const t = db.get('SELECT * FROM support_tickets WHERE id = ?', Number(req.params.id));
    if (!t) throw notFound('Ticket');
    const status = oneOf(req.body?.status, 'Status', ['open', 'in_progress', 'resolved'], { fallback: t.status === 'open' ? 'in_progress' : t.status });
    if (req.body?.body) db.run('INSERT INTO support_messages (ticket_id, author_id, from_platform, body) VALUES (?,?,1,?)', t.id, req.user.id, str(req.body.body, 'Reply', { max: 4000 }));
    db.run(`UPDATE support_tickets SET status = ?, assigned_to = COALESCE(assigned_to, ?), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, status, req.user.id, t.id);
    res.json({ ok: true });
  }));

  // ---- platform admins (super admin only) ---------------------------------------------------
  r.get('/admins', P('__super__'), h((req, res) => {
    res.json({ admins: db.all(`SELECT id, email, name, platform_role, platform_perms, status FROM users WHERE platform_role IS NOT NULL ORDER BY id`).map((u) => ({ ...u, platform_perms: json(u.platform_perms, []) })), all_perms: PLATFORM_PERMS });
  }));

  r.post('/admins', P('__super__'), h((req, res) => {
    const em = vEmail(req.body?.email);
    const perms = (Array.isArray(req.body?.perms) ? req.body.perms : []).filter((p) => PLATFORM_PERMS.includes(p));
    if (db.get('SELECT id FROM users WHERE email = ?', em)) throw conflict('A user with this email already exists');
    const tempPassword = randomToken(9);
    const id = db.run(`INSERT INTO users (email, password_hash, name, platform_role, platform_perms) VALUES (?,?,?,'platform_admin',?)`,
      em, hashPassword(tempPassword), str(req.body?.name, 'Name', { required: true, max: 80 }), JSON.stringify(perms)).lastId;
    audit(req, 'admin.create', 'user', id, { email: em, perms });
    res.status(201).json({ id, temporary_password: tempPassword });
  }));

  r.put('/admins/:id', P('__super__'), h((req, res) => {
    const u = db.get(`SELECT * FROM users WHERE id = ? AND platform_role = 'platform_admin'`, Number(req.params.id));
    if (!u) throw notFound('Platform admin');
    const perms = (Array.isArray(req.body?.perms) ? req.body.perms : json(u.platform_perms, [])).filter((p) => PLATFORM_PERMS.includes(p));
    const status = oneOf(req.body?.status ?? u.status, 'Status', ['active', 'disabled']);
    db.run('UPDATE users SET platform_perms = ?, status = ? WHERE id = ?', JSON.stringify(perms), status, u.id);
    if (status === 'disabled') db.run('DELETE FROM auth_sessions WHERE user_id = ?', u.id);
    audit(req, 'admin.update', 'user', u.id, { perms, status });
    res.json({ ok: true });
  }));

  r.get('/audit', P('__super__'), h((req, res) => {
    res.json({ entries: db.all(`SELECT a.*, u.name AS actor_name, c.name AS company_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
      LEFT JOIN companies c ON c.id = a.company_id ORDER BY a.id DESC LIMIT 300`).map((x) => ({ ...x, details: json(x.details, {}) })) });
  }));

  return r;
}
