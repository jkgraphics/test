import { Router } from 'express';
import { h, rateLimiter } from './common.js';
import { HttpError, bad, conflict, notFound, email as vEmail, str, hashPassword, verifyPassword, sha256, slugify, json, randomToken } from '../util.js';

export default function authRoutes({ db, auth, services }) {
  const r = Router();
  const loginLimiter = rateLimiter({ windowMs: 15 * 60e3, max: 10 });

  r.post('/login', h((req, res) => {
    const em = vEmail(req.body?.email);
    const pw = str(req.body?.password, 'Password', { required: true, max: 200 });
    const key = `${req.ip}|${em}`;
    if (!loginLimiter.hit(key)) throw new HttpError(429, 'Too many sign-in attempts. Please wait 15 minutes.');
    const u = db.get('SELECT * FROM users WHERE email = ?', em);
    if (!u || !verifyPassword(pw, u.password_hash)) throw new HttpError(401, 'Incorrect email or password');
    if (u.status !== 'active') throw new HttpError(403, 'This account has been disabled');
    loginLimiter.reset(key);
    const first = auth.membershipsFor(u.id)[0];
    auth.issueSession(res, u.id, first?.company_id ?? null);
    res.json({ ok: true });
  }));

  r.post('/logout', (req, res) => {
    auth.destroySession(req, res);
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => {
    if (!req.user) return res.json({ user: null });
    const memberships = auth.membershipsFor(req.user.id);
    res.json({
      user: req.user,
      memberships,
      active_company_id: req.authSession.active_company_id ?? memberships[0]?.company_id ?? null,
    });
  });

  r.post('/switch-company', auth.requireUser, h((req, res) => {
    const cid = Number(req.body?.company_id);
    if (!auth.loadMember(req.user.id, cid)) throw notFound('Company');
    db.run('UPDATE auth_sessions SET active_company_id = ? WHERE id = ?', cid, req.authSession.id);
    res.json({ ok: true });
  }));

  r.post('/change-password', auth.requireUser, h((req, res) => {
    const u = db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(String(req.body?.current_password || ''), u.password_hash)) throw bad('Current password is incorrect');
    const pw = str(req.body?.new_password, 'New password', { required: true, min: 8, max: 200 });
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(pw), u.id);
    db.run('DELETE FROM auth_sessions WHERE user_id = ? AND id != ?', u.id, req.authSession.id);
    res.json({ ok: true });
  }));

  // Self-service restaurant sign-up: creates the company on a free trial with its owner account.
  r.post('/register-company', h((req, res) => {
    const b = req.body || {};
    const companyName = str(b.company_name, 'Restaurant name', { required: true, min: 2, max: 80 });
    const name = str(b.name, 'Your name', { required: true, max: 80 });
    const em = vEmail(b.email);
    const pw = str(b.password, 'Password', { required: true, min: 8, max: 200 });
    const phone = str(b.phone, 'Phone', { max: 30 });
    if (db.get('SELECT id FROM users WHERE email = ?', em)) throw conflict('An account with this email already exists. Please sign in.');
    const plan = db.get('SELECT * FROM plans WHERE active = 1 ORDER BY price_monthly ASC LIMIT 1');
    const out = db.tx(() => {
      const uid = db.run('INSERT INTO users (email, password_hash, name, phone) VALUES (?,?,?,?)', em, hashPassword(pw), name, phone).lastId;
      let slug = slugify(companyName);
      while (db.get('SELECT id FROM companies WHERE slug = ?', slug)) slug = `${slugify(companyName)}-${randomToken(3).toLowerCase()}`;
      const trialEnds = new Date(Date.now() + (plan?.trial_days ?? 14) * 864e5).toISOString();
      const cid = db.run(
        `INSERT INTO companies (name, slug, phone, email, plan_id, subscription_status, trial_ends_at, taxes, payment_settings)
         VALUES (?,?,?,?,?,'trial',?,?,?)`,
        companyName, slug, phone, em, plan?.id ?? null, trialEnds,
        JSON.stringify([{ name: 'CGST', rate: 2.5 }, { name: 'SGST', rate: 2.5 }]),
        JSON.stringify({ cash: true, upi: false, online: true, online_provider: 'test', pay_at_counter: true })).lastId;
      db.run('INSERT INTO branches (company_id, name) VALUES (?, ?)', cid, 'Main Branch');
      db.run(`INSERT INTO company_members (company_id, user_id, role) VALUES (?,?,'owner')`, cid, uid);
      services.audit({ company_id: cid, actor: { id: uid, name }, action: 'company.register', entity: 'company', entity_id: cid, details: { plan: plan?.name }, ip: req.ip });
      return { uid, cid };
    });
    auth.issueSession(res, out.uid, out.cid);
    res.status(201).json({ ok: true, company_id: out.cid });
  }));

  function findInvite(token) {
    const inv = db.get(
      `SELECT i.*, c.name AS company_name FROM invitations i JOIN companies c ON c.id = i.company_id
        WHERE i.token_hash = ?`, sha256(String(token)));
    if (!inv || inv.revoked_at || inv.accepted_at || inv.expires_at < new Date().toISOString()) {
      throw notFound('Invitation (it may have expired or already been used)');
    }
    return inv;
  }

  r.get('/invitations/:token', h((req, res) => {
    const inv = findInvite(req.params.token);
    res.json({
      company_name: inv.company_name, role: inv.role, email: inv.email,
      existing_user: !!db.get('SELECT id FROM users WHERE email = ?', inv.email),
    });
  }));

  r.post('/invitations/:token/accept', h((req, res) => {
    const inv = findInvite(req.params.token);
    let user = db.get('SELECT * FROM users WHERE email = ?', inv.email);
    if (user) {
      // Existing account: must prove ownership with its password.
      if (!verifyPassword(String(req.body?.password || ''), user.password_hash)) throw new HttpError(401, 'Incorrect password for this existing account');
    } else {
      const name = str(req.body?.name, 'Your name', { required: true, max: 80 });
      const pw = str(req.body?.password, 'Password', { required: true, min: 8, max: 200 });
      const id = db.run('INSERT INTO users (email, password_hash, name) VALUES (?,?,?)', inv.email, hashPassword(pw), name).lastId;
      user = db.get('SELECT * FROM users WHERE id = ?', id);
    }
    db.tx(() => {
      const existing = db.get('SELECT * FROM company_members WHERE company_id = ? AND user_id = ?', inv.company_id, user.id);
      let mid;
      if (existing) {
        db.run(`UPDATE company_members SET role = ?, status = 'active' WHERE id = ?`, inv.role, existing.id);
        db.run('DELETE FROM member_branches WHERE member_id = ?', existing.id);
        mid = existing.id;
      } else {
        mid = db.run('INSERT INTO company_members (company_id, user_id, role) VALUES (?,?,?)', inv.company_id, user.id, inv.role).lastId;
      }
      for (const bid of json(inv.branch_ids, [])) {
        if (db.get('SELECT id FROM branches WHERE id = ? AND company_id = ?', bid, inv.company_id)) {
          db.run('INSERT OR IGNORE INTO member_branches (member_id, branch_id) VALUES (?,?)', mid, bid);
        }
      }
      db.run(`UPDATE invitations SET accepted_at = datetime('now') WHERE id = ?`, inv.id);
      services.audit({ company_id: inv.company_id, actor: { id: user.id, name: user.name }, action: 'staff.invite_accepted', entity: 'user', entity_id: user.id, details: { role: inv.role }, ip: req.ip });
    });
    auth.issueSession(res, user.id, inv.company_id);
    res.json({ ok: true });
  }));

  return r;
}
