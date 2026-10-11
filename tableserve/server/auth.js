// Authentication (cookie sessions) and role-based permission checks.
// Every company-scoped request resolves exactly one active membership; all data access is then
// filtered by that membership's company_id and branch list.
import { HttpError, forbidden, notFound, randomToken, sha256, json } from './util.js';

export const COOKIE = 'ts_sess';
const SESSION_DAYS = 14;

export const ROLE_LABELS = {
  owner: 'Company Owner',
  admin: 'Restaurant Admin / Branch Manager',
  kitchen: 'Kitchen Staff',
  waiter: 'Waiter',
  cashier: 'Cashier',
};

const P = {
  owner: ['company.manage', 'branches.create', 'branches.settings', 'staff.manage', 'staff.manage_admins',
    'menu.manage', 'tables.manage', 'sessions.manage', 'orders.view', 'orders.kitchen', 'orders.serve',
    'orders.place', 'orders.cancel', 'service.handle', 'billing.view', 'billing.manage', 'billing.discount',
    'billing.discount_unlimited', 'billing.refund', 'reports.view', 'audit.view', 'support.use'],
  admin: ['branches.settings', 'staff.manage', 'menu.manage', 'tables.manage', 'sessions.manage', 'orders.view',
    'orders.kitchen', 'orders.serve', 'orders.place', 'orders.cancel', 'service.handle', 'billing.view',
    'billing.manage', 'billing.discount', 'billing.discount_unlimited', 'billing.refund', 'reports.view',
    'audit.view', 'support.use'],
  kitchen: ['orders.view', 'orders.kitchen'],
  waiter: ['sessions.manage', 'orders.view', 'orders.serve', 'orders.place', 'service.handle', 'billing.view'],
  cashier: ['sessions.manage', 'orders.view', 'billing.view', 'billing.manage', 'billing.discount', 'billing.refund'],
};
export const ROLE_PERMS = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, new Set(v)]));

export const PLATFORM_PERMS = ['companies.view', 'companies.manage', 'onboarding', 'plans.manage', 'support', 'revenue.view'];

export function createAuth(db, config) {
  function issueSession(res, userId, companyId = null) {
    const token = randomToken();
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
    db.run('INSERT INTO auth_sessions (token_hash, user_id, active_company_id, expires_at) VALUES (?,?,?,?)',
      sha256(token), userId, companyId, expires.toISOString());
    res.cookie(COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, expires, path: '/',
    });
    return token;
  }

  function destroySession(req, res) {
    const token = req.cookies?.[COOKIE];
    if (token) db.run('DELETE FROM auth_sessions WHERE token_hash = ?', sha256(token));
    res.clearCookie(COOKIE, { path: '/' });
  }

  // Attaches req.user and req.authSession when a valid cookie is present.
  function loadUser(req, _res, next) {
    const token = req.cookies?.[COOKIE];
    if (token) {
      const s = db.get(
        `SELECT s.*, u.email, u.name, u.platform_role, u.platform_perms, u.status AS user_status
           FROM auth_sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > ?`, sha256(token), new Date().toISOString());
      if (s && s.user_status === 'active') {
        req.authSession = s;
        req.user = {
          id: s.user_id, email: s.email, name: s.name, platform_role: s.platform_role,
          platform_perms: json(s.platform_perms, []),
        };
      }
    }
    next();
  }

  function requireUser(req, _res, next) {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    next();
  }

  function membershipsFor(userId) {
    return db.all(
      `SELECT m.id, m.company_id, m.role, c.name AS company_name, c.status AS company_status
         FROM company_members m JOIN companies c ON c.id = m.company_id
        WHERE m.user_id = ? AND m.status = 'active' ORDER BY c.name`, userId);
  }

  function loadMember(userId, companyId) {
    const m = db.get(
      `SELECT * FROM company_members WHERE user_id = ? AND company_id = ? AND status = 'active'`, userId, companyId);
    if (!m) return null;
    const branchIds = m.role === 'owner'
      ? db.all('SELECT id FROM branches WHERE company_id = ?', companyId).map((r) => r.id)
      : db.all(
        `SELECT mb.branch_id AS id FROM member_branches mb JOIN branches b ON b.id = mb.branch_id
          WHERE mb.member_id = ? AND b.company_id = ?`, m.id, companyId).map((r) => r.id);
    return { ...m, branch_ids: branchIds, perms: ROLE_PERMS[m.role] };
  }

  // Resolve the membership for the company currently selected in this login session.
  function requireMember(req, _res, next) {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    let companyId = req.authSession.active_company_id;
    let member = companyId ? loadMember(req.user.id, companyId) : null;
    if (!member) {
      const first = membershipsFor(req.user.id)[0];
      if (first) {
        member = loadMember(req.user.id, first.company_id);
        db.run('UPDATE auth_sessions SET active_company_id = ? WHERE id = ?', first.company_id, req.authSession.id);
      }
    }
    if (!member) return next(forbidden('You are not a member of any restaurant company'));
    req.member = member;
    req.company = db.get('SELECT * FROM companies WHERE id = ?', member.company_id);
    next();
  }

  const can = (member, perm) => !!member?.perms?.has(perm);

  function requirePerm(...perms) {
    return (req, _res, next) => {
      if (!perms.every((p) => can(req.member, p))) return next(forbidden());
      next();
    };
  }

  // Throws unless the branch belongs to the member's company and is assigned to them.
  function assertBranch(member, branchId) {
    const id = Number(branchId);
    const b = db.get('SELECT * FROM branches WHERE id = ? AND company_id = ?', id, member.company_id);
    if (!b) throw notFound('Branch');
    if (!member.branch_ids.includes(id)) throw forbidden('You are not assigned to this branch');
    return b;
  }

  // Load a company-scoped row and verify both company and branch access in one place.
  function scoped(member, table, id, what) {
    const row = db.get(`SELECT * FROM ${table} WHERE id = ? AND company_id = ?`, Number(id), member.company_id);
    if (!row) throw notFound(what);
    if (row.branch_id != null && !member.branch_ids.includes(row.branch_id)) throw notFound(what);
    return row;
  }

  function requirePlatform(perm) {
    return (req, _res, next) => {
      const u = req.user;
      if (!u) return next(new HttpError(401, 'Please sign in'));
      if (u.platform_role === 'super_admin') return next();
      if (u.platform_role === 'platform_admin' && (!perm || u.platform_perms.includes(perm))) return next();
      next(forbidden());
    };
  }

  return {
    issueSession, destroySession, loadUser, requireUser, requireMember, requirePerm, requirePlatform,
    membershipsFor, loadMember, can, assertBranch, scoped,
  };
}
