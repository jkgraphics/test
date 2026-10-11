// Staff, owner and platform admin app (single page, path-based routing under /app).
import { html, render, useState, useEffect, useRef, useCallback, api, Loading, ErrorBox } from './lib.js';
import { navigate, usePath, Link, Ctx, createBus } from './core.js';
import { KitchenPage, FloorPage, BillingPage, OrdersPage } from './pages/ops.js';
import { MenuPage, TablesPage, StaffPage, BranchesPage, SettingsPage, ReportsPage, AuditPage, SubscriptionPage, SupportPage, DashboardPage } from './pages/admin.js';
import { PlatformPage } from './pages/platform.js';
import { LoginPage, RegisterPage, InvitePage, AccountPage } from './pages/auth.js';

const BRANCH_EVENTS = ['order.new', 'order.updated', 'table.updated', 'service.new', 'service.updated', 'join.new', 'join.updated', 'payment.updated', 'bill.updated', 'branch.updated', 'menu.updated'];

function StaffShell({ me, reloadMe }) {
  const path = usePath();
  const [ctxData, setCtxData] = useState(null);
  const [err, setErr] = useState(null);
  const [branchId, setBranchId] = useState(() => Number(localStorage.getItem('ts:branch')) || null);
  const [connected, setConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const busRef = useRef(createBus());

  const loadCtx = useCallback(async () => {
    try {
      const d = await api('/api/staff/context');
      setCtxData(d); setErr(null);
      setBranchId((b) => (d.branches.some((x) => x.id === b) ? b : d.branches[0]?.id || null));
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { loadCtx(); }, []);
  useEffect(() => { if (branchId) localStorage.setItem('ts:branch', branchId); }, [branchId]);

  // One live connection per selected branch, fanned out to whichever page is open.
  useEffect(() => {
    if (!branchId) return undefined;
    let es; let closed = false; let retry;
    const connect = () => {
      es = new EventSource(`/api/staff/branches/${branchId}/stream`);
      es.addEventListener('hello', () => { setConnected(true); busRef.current.emit('resync', null); });
      es.onerror = () => { setConnected(false); if (es.readyState === EventSource.CLOSED && !closed) retry = setTimeout(connect, 3000); };
      for (const n of BRANCH_EVENTS) es.addEventListener(n, (ev) => { try { busRef.current.emit(n, JSON.parse(ev.data)); } catch { /* ignore */ } });
      es.addEventListener('branch.updated', () => loadCtx());
    };
    connect();
    return () => { closed = true; clearTimeout(retry); es?.close(); setConnected(false); };
  }, [branchId]);

  if (err) return html`<div class="auth-wrap"><div class="card auth-card"><${ErrorBox} error=${err} onRetry=${loadCtx} /><button class="btn mt" onClick=${logout}>Sign out</button></div></div>`;
  if (!ctxData) return html`<${Loading} />`;

  const can = (p) => ctxData.perms.includes(p);
  const branch = ctxData.branches.find((b) => b.id === branchId);
  const nav = [
    ['/app/dashboard', '📊', 'Dashboard', can('reports.view')],
    ['/app/kitchen', '👨‍🍳', 'Kitchen', can('orders.kitchen')],
    ['/app/floor', '🪑', 'Tables & service', can('service.handle') || can('sessions.manage')],
    ['/app/billing', '💳', 'Billing', can('billing.view')],
    ['/app/orders', '🧾', 'Orders', can('orders.view') && can('reports.view')],
    ['/app/menu', '📖', 'Menu', can('menu.manage')],
    ['/app/tables', '🔳', 'Tables & QR', can('tables.manage')],
    ['/app/staff', '👥', 'Staff', can('staff.manage')],
    ['/app/branches', '🏬', 'Branches', can('branches.settings')],
    ['/app/reports', '📈', 'Reports', can('reports.view')],
    ['/app/settings', '⚙️', 'Company & payments', can('company.manage')],
    ['/app/subscription', '⭐', 'Subscription', can('company.manage')],
    ['/app/audit', '🗂️', 'Audit log', can('audit.view')],
    ['/app/support', '🛟', 'Support', can('support.use')],
  ].filter((x) => x[3]);

  const roleHome = { kitchen: '/app/kitchen', waiter: '/app/floor', cashier: '/app/billing' }[ctxData.role];
  const home = roleHome || nav[0]?.[0] || '/app/account';
  const route = path === '/app' || path === '/app/' ? home : path;
  if (route !== path) setTimeout(() => navigate(route, true));
  const pages = {
    '/app/dashboard': DashboardPage, '/app/kitchen': KitchenPage, '/app/floor': FloorPage, '/app/billing': BillingPage, '/app/orders': OrdersPage,
    '/app/menu': MenuPage, '/app/tables': TablesPage, '/app/staff': StaffPage, '/app/branches': BranchesPage, '/app/reports': ReportsPage,
    '/app/settings': SettingsPage, '/app/subscription': SubscriptionPage, '/app/audit': AuditPage, '/app/support': SupportPage, '/app/account': AccountPage,
  };
  const allowed = nav.some((n) => n[0] === route) || route === '/app/account';
  const Page = allowed ? pages[route] : null;
  const value = { me, ctx: ctxData, can, branch, branchId, setBranchId, bus: busRef.current, connected, reloadCtx: loadCtx, reloadMe };
  const company = ctxData.company;

  return html`<${Ctx.Provider} value=${value}>
    <div class="mobile-bar no-print"><button class="btn sm" onClick=${() => setMenuOpen(true)} aria-label="Open menu">☰</button><b class="grow">${company.name}</b>${branch ? html`<small>${branch.name}</small>` : null}</div>
    <div class="shell">
      <aside class=${`sidebar ${menuOpen ? 'open' : ''}`} onClick=${(e) => e.target.closest('a') && setMenuOpen(false)}>
        <div class="logo"><span class="mark">🍽️</span> TableServe</div>
        <div class="co"><b style="color:#fff">${company.name}</b><br/>${ctxData.role_label}</div>
        ${ctxData.memberships.length > 1 ? html`<select aria-label="Company" value=${company.id} onChange=${async (e) => { await api('/api/auth/switch-company', { method: 'POST', body: { company_id: Number(e.target.value) } }); localStorage.removeItem('ts:branch'); location.href = '/app'; }}>
          ${ctxData.memberships.map((m) => html`<option value=${m.company_id}>${m.company_name}</option>`)}</select>` : null}
        ${ctxData.branches.length > 0 ? html`<label class="small" style="padding:8px 4px 0;color:#cbb8a5">Branch
          <select value=${branchId} onChange=${(e) => setBranchId(Number(e.target.value))}>${ctxData.branches.map((b) => html`<option value=${b.id}>${b.name}${b.active ? '' : ' (inactive)'}</option>`)}</select></label>` : null}
        <div style="height:8px"></div>
        ${nav.map(([href, ic, label]) => html`<${Link} href=${href} class=${`nav ${route === href ? 'active' : ''}`}><span>${ic}</span>${label}</${Link}>`)}
        <div class="grow"></div>
        <span class=${`conn ${connected ? '' : 'off'}`} style="padding:6px 12px;color:#cbb8a5"><span class="dot"></span>${connected ? 'Live updates on' : 'Reconnecting…'}</span>
        <${Link} href="/app/account" class=${`nav ${route === '/app/account' ? 'active' : ''}`}><span>👤</span>${me.user.name}</${Link}>
        <a class="nav" href="#" onClick=${(e) => { e.preventDefault(); logout(); }}><span>↩️</span>Sign out</a>
      </aside>
      ${menuOpen ? html`<div class="modal-back no-print" style="z-index:750" onClick=${() => setMenuOpen(false)}></div>` : null}
      <main class="main">
        ${!ctxData.operating.ok ? html`<div class="alert warn mb"><b>Customer ordering is disabled:</b> ${ctxData.operating.reason} ${can('company.manage') ? html`<${Link} href="/app/subscription">Manage subscription</${Link}>` : 'Contact your restaurant owner.'}</div>` : null}
        ${company.subscription_status === 'trial' && company.trial_ends_at ? html`<div class="alert mb small no-print">Free trial on the <b>${company.plan.name}</b> plan until ${new Date(company.trial_ends_at).toLocaleDateString()}.</div>` : null}
        ${company.is_demo ? html`<div class="alert warn mb small no-print">You are viewing <b>DEMO</b> data. Payments here run in clearly labelled test mode.</div>` : null}
        ${branch?.ordering_paused ? html`<div class="alert bad mb no-print"><b>New customer orders are paused</b> at ${branch.name}.</div>` : null}
        ${!branch && ctxData.branches.length === 0 ? html`<div class="alert warn">You are not assigned to any branch yet. Ask your manager to give you access.</div>` : null}
        ${Page ? html`<${Page} key=${`${route}-${branchId}`} />` : html`<div class="empty"><div class="big">🚫</div><b>You don't have access to this page.</b><div class="mt"><${Link} href=${home} class="btn">Go to your dashboard</${Link}></div></div>`}
      </main>
    </div>
  </${Ctx.Provider}>`;
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
  location.href = '/login';
}

function Root() {
  const path = usePath();
  const [me, setMe] = useState(undefined);
  const loadMe = useCallback(async () => {
    try { setMe(await api('/api/auth/me')); } catch (e) { setMe({ user: null, error: e.message }); }
  }, []);
  useEffect(() => { loadMe(); }, []);

  if (path.startsWith('/invite/')) return html`<${InvitePage} token=${path.split('/')[2]} me=${me} onDone=${() => { loadMe(); navigate('/app'); }} />`;
  if (path === '/register') return html`<${RegisterPage} onDone=${() => { loadMe(); navigate('/app'); }} />`;
  if (me === undefined) return html`<${Loading} />`;
  if (me.error && !me.user) return html`<div class="auth-wrap"><div class="card auth-card"><${ErrorBox} error=${me.error} onRetry=${loadMe} /></div></div>`;
  if (!me.user || path === '/login') {
    if (me.user && path === '/login') { setTimeout(() => navigate('/app', true)); return html`<${Loading} />`; }
    return html`<${LoginPage} onDone=${async () => { await loadMe(); navigate('/app'); }} />`;
  }
  const isPlatform = !!me.user.platform_role;
  if (path.startsWith('/app/platform') || (isPlatform && !me.memberships.length)) {
    if (!isPlatform) { setTimeout(() => navigate('/app', true)); return null; }
    return html`<${PlatformPage} me=${me} path=${path} logout=${logout} />`;
  }
  if (!me.memberships.length) {
    return html`<div class="auth-wrap"><div class="card auth-card"><h2>No restaurant access yet</h2><p class="muted">Your account isn't part of any restaurant team. Ask an owner to invite you, or register your restaurant.</p>
      <div class="row"><a class="btn primary" href="/register">Register a restaurant</a><button class="btn" onClick=${logout}>Sign out</button></div></div></div>`;
  }
  return html`<${StaffShell} me=${me} reloadMe=${loadMe} />`;
}

render(html`<${Root} />`, document.getElementById('app'));
