// Platform console for the Super Admin and Platform Admins.
import { html, useState, api, toast, money, Modal, Loading, Empty, ErrorBox, useLoad, useAction, timeAgo } from '../lib.js';
import { Link } from '../core.js';

const SUB_CLS = { trial: 'info', active: 'ok', expired: 'bad', suspended: 'bad' };

export function PlatformPage({ me, path, logout }) {
  const ov = useLoad(() => api('/api/platform/overview'), []);
  const [open, setOpen] = useState(false);
  const perms = ov.data?.me.perms || [];
  const isSuper = me.user.platform_role === 'super_admin';
  const nav = [
    ['/app/platform', '📊', 'Overview', true],
    ['/app/platform/companies', '🏢', 'Companies', perms.includes('companies.view')],
    ['/app/platform/plans', '⭐', 'Plans', true],
    ['/app/platform/revenue', '💰', 'Subscription revenue', perms.includes('revenue.view')],
    ['/app/platform/support', '🛟', 'Support', perms.includes('support')],
    ['/app/platform/admins', '🛡️', 'Platform admins', isSuper],
    ['/app/platform/audit', '🗂️', 'Audit log', isSuper],
  ].filter((n) => n[3]);
  const route = path.replace(/\/$/, '');
  const pages = { '/app/platform': Overview, '/app/platform/companies': Companies, '/app/platform/plans': Plans, '/app/platform/revenue': Revenue, '/app/platform/support': Support, '/app/platform/admins': Admins, '/app/platform/audit': Audit };
  const Page = nav.some((n) => n[0] === route) ? pages[route] : null;
  return html`<div>
    <div class="mobile-bar"><button class="btn sm" onClick=${() => setOpen(true)}>☰</button><b>TableServe Platform</b></div>
    <div class="shell">
      <aside class=${`sidebar ${open ? 'open' : ''}`} onClick=${(e) => e.target.closest('a') && setOpen(false)}>
        <div class="logo"><span class="mark">🍽️</span> TableServe</div>
        <div class="co"><b style="color:#fff">Platform console</b><br/>${isSuper ? 'Super Admin' : 'Platform Admin'}</div>
        ${nav.map(([href, ic, label]) => html`<${Link} href=${href} class=${`nav ${route === href ? 'active' : ''}`}><span>${ic}</span>${label}</${Link}>`)}
        <div class="grow"></div>
        ${me.memberships.length ? html`<a class="nav" href="/app/dashboard"><span>🍽️</span>Restaurant view</a>` : null}
        <a class="nav" href="#" onClick=${(e) => { e.preventDefault(); logout(); }}><span>↩️</span>Sign out</a>
      </aside>
      <main class="main">${ov.loading ? html`<${Loading} />` : ov.error ? html`<${ErrorBox} error=${ov.error} />` : Page ? html`<${Page} ov=${ov.data} perms=${perms} isSuper=${isSuper} />` : html`<${Empty} icon="🚫" title="No access" />`}</main>
    </div></div>`;
}

const Stat = ({ label, value, sub }) => html`<div class="card stat"><span class="label">${label}</span><span class="value">${value}</span>${sub ? html`<span class="sub">${sub}</span>` : null}</div>`;

function Overview({ ov }) {
  return html`<div><div class="topbar"><h1>Platform overview</h1></div>
    <div class="grid cols-4">
      <${Stat} label="Registered companies" value=${ov.companies} sub=${`${ov.suspended_companies} suspended`} />
      <${Stat} label="Active branches" value=${ov.active_branches} />
      <${Stat} label="Revenue this month" value=${money(ov.revenue.this_month)} sub=${`All time ${money(ov.revenue.all_time)}`} />
      <${Stat} label="Open support tickets" value=${ov.open_tickets} />
    </div>
    <h3 class="mt">Subscriptions</h3>
    <div class="grid cols-4">${['trial', 'active', 'expired', 'suspended'].map((k) => html`<${Stat} label=${k} value=${ov.subscriptions[k]} />`)}</div>
    <p class="small muted mt">Platform subscription revenue is recorded separately from restaurants' own sales, which TableServe never holds.</p></div>`;
}

function Companies({ perms }) {
  const st = useLoad(() => api('/api/platform/companies').then((d) => d.companies), []);
  const plans = useLoad(() => api('/api/platform/plans').then((d) => d.plans), []);
  const [edit, setEdit] = useState(null);
  const [onboard, setOnboard] = useState(false);
  const [pay, setPay] = useState(null);
  const [q, setQ] = useState('');
  const canManage = perms.includes('companies.manage');
  return html`<div><div class="topbar"><h1>Companies</h1><div class="row"><input type="search" placeholder="Search" value=${q} onInput=${(e) => setQ(e.target.value)} />${perms.includes('onboarding') ? html`<button class="btn primary" onClick=${() => setOnboard(true)}>+ Onboard company</button>` : null}</div></div>
    ${st.loading ? html`<${Loading} />` : st.error ? html`<${ErrorBox} error=${st.error} />` : html`<div class="card pad-0 table-wrap"><table class="data"><thead><tr><th>Company</th><th>Owner</th><th>Plan</th><th>Subscription</th><th>Usage</th><th>Status</th><th></th></tr></thead><tbody>
      ${st.data.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())).map((c) => html`<tr><td><b>${c.name}</b>${c.is_demo ? html` <span class="badge warn">DEMO</span>` : null}<div class="small muted">since ${new Date(c.created_at).toLocaleDateString()}</div></td>
        <td class="small">${c.owner_email || html`<span class="muted">invite pending</span>`}</td><td>${c.plan_name || '—'} <div class="small muted">${c.billing_period}</div></td>
        <td><span class=${`badge ${SUB_CLS[c.subscription_status]}`}>${c.subscription_status}</span><div class="small muted">${c.subscription_status === 'trial' && c.trial_ends_at ? `ends ${new Date(c.trial_ends_at).toLocaleDateString()}` : c.current_period_end ? `until ${new Date(c.current_period_end).toLocaleDateString()}` : ''}</div></td>
        <td class="small">${c.branches} branches · ${c.tables} tables · ${c.staff} staff</td>
        <td><span class=${`badge ${c.status === 'active' ? 'ok' : 'bad'}`}>${c.status}</span></td>
        <td class="right nowrap">${canManage ? html`<button class="btn sm" onClick=${() => setPay(c)}>Record payment</button> <button class="btn sm" onClick=${() => setEdit(c)}>Manage</button>` : null}</td></tr>`)}</tbody></table></div>`}
    ${edit ? html`<${CompanyModal} c=${edit} plans=${plans.data || []} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); st.reload(true); }} />` : null}
    ${onboard ? html`<${OnboardModal} plans=${plans.data || []} onClose=${() => { setOnboard(false); st.reload(true); }} />` : null}
    ${pay ? html`<${SubPaymentModal} c=${pay} plans=${plans.data || []} onClose=${() => setPay(null)} onSaved=${() => { setPay(null); st.reload(true); }} />` : null}
  </div>`;
}

function CompanyModal({ c, plans, onClose, onSaved }) {
  const [f, setF] = useState({ plan_id: c.plan_id, status: c.status, subscription_status: c.subscription_status, billing_period: c.billing_period, trial_ends_at: c.trial_ends_at?.slice(0, 10) || '', current_period_end: c.current_period_end?.slice(0, 10) || '' });
  const [days, setDays] = useState(7);
  const [busy, run] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return html`<${Modal} title=${c.name} onClose=${onClose}>
    <form class="form" onSubmit=${(e) => { e.preventDefault(); run('s', () => api(`/api/platform/companies/${c.id}`, { method: 'PUT', body: { ...f, trial_ends_at: f.trial_ends_at || null, current_period_end: f.current_period_end || null } }).then(onSaved), 'Company updated'); }}>
      <div class="row"><label class="field">Plan<select value=${f.plan_id} onChange=${set('plan_id')}>${plans.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select></label>
        <label class="field">Billing<select value=${f.billing_period} onChange=${set('billing_period')}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label></div>
      <div class="row"><label class="field">Account status<select value=${f.status} onChange=${set('status')}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
        <label class="field">Subscription<select value=${f.subscription_status} onChange=${set('subscription_status')}>${['trial', 'active', 'expired', 'suspended'].map((s) => html`<option value=${s}>${s}</option>`)}</select></label></div>
      <div class="row"><label class="field">Trial ends<input type="date" value=${f.trial_ends_at} onInput=${set('trial_ends_at')} /></label><label class="field">Paid until<input type="date" value=${f.current_period_end} onInput=${set('current_period_end')} /></label></div>
      <p class="small muted">Suspended or expired companies keep their data, but customers cannot place orders.</p>
      <button class="btn primary" disabled=${!!busy}>Save</button></form>
    <hr class="sep" />
    <div class="row"><input type="number" min="1" max="90" value=${days} onInput=${(e) => setDays(e.target.value)} style="width:100px" /><button class="btn" disabled=${!!busy} onClick=${() => run('t', () => api(`/api/platform/companies/${c.id}/extend-trial`, { method: 'POST', body: { days: Number(days) } }).then(onSaved), 'Trial extended')}>Extend trial by days</button></div>
  </${Modal}>`;
}

function OnboardModal({ plans, onClose }) {
  const [f, setF] = useState({ name: '', owner_email: '', plan_id: plans[0]?.id });
  const [link, setLink] = useState(null);
  const [busy, run] = useAction();
  return html`<${Modal} title="Onboard a restaurant company" onClose=${onClose}>
    ${link ? html`<div class="alert ok">Company created on a free trial. Send this owner invitation link (valid 14 days):</div><input class="mono mt-s" readonly value=${link} onFocus=${(e) => e.target.select()} />
      <button class="btn primary mt-s" onClick=${() => navigator.clipboard?.writeText(link).then(() => toast('Copied', 'ok'))}>Copy link</button>` : html`
    <form class="form" onSubmit=${(e) => { e.preventDefault(); run('o', () => api('/api/platform/companies', { method: 'POST', body: f }).then((r) => setLink(r.owner_invite_url))); }}>
      <label class="field">Company name<input required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></label>
      <label class="field">Owner email<input type="email" required value=${f.owner_email} onInput=${(e) => setF({ ...f, owner_email: e.target.value })} /></label>
      <label class="field">Plan<select value=${f.plan_id} onChange=${(e) => setF({ ...f, plan_id: Number(e.target.value) })}>${plans.filter((p) => p.active).map((p) => html`<option value=${p.id}>${p.name} (${p.trial_days}-day trial)</option>`)}</select></label>
      <button class="btn primary lg" disabled=${!!busy}>Create company</button></form>`}
  </${Modal}>`;
}

function SubPaymentModal({ c, plans, onClose, onSaved }) {
  const [f, setF] = useState({ plan_id: c.plan_id || plans[0]?.id, period: c.billing_period || 'monthly', amount: '', reference: '' });
  const [busy, run] = useAction();
  const plan = plans.find((p) => p.id === Number(f.plan_id));
  return html`<${Modal} title=${`Subscription payment · ${c.name}`} onClose=${onClose}>
    <p class="small muted">Records a payment from the restaurant to TableServe and extends the paid period. This is separate from the restaurant's own sales.</p>
    <form class="form" onSubmit=${(e) => { e.preventDefault(); run('p', () => api(`/api/platform/companies/${c.id}/subscription-payments`, { method: 'POST', body: f }).then(onSaved), 'Payment recorded'); }}>
      <div class="row"><label class="field">Plan<select value=${f.plan_id} onChange=${(e) => setF({ ...f, plan_id: e.target.value })}>${plans.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select></label>
        <label class="field">Period<select value=${f.period} onChange=${(e) => setF({ ...f, period: e.target.value })}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label></div>
      <label class="field">Amount (₹) <span class="hint">Default ${plan ? money(f.period === 'annual' ? plan.price_annual : plan.price_monthly) : ''}</span><input type="number" step="0.01" min="0" value=${f.amount} onInput=${(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label class="field">Reference / invoice no.<input value=${f.reference} onInput=${(e) => setF({ ...f, reference: e.target.value })} /></label>
      <button class="btn primary" disabled=${!!busy}>Record payment</button></form></${Modal}>`;
}

function Plans({ perms, isSuper }) {
  const st = useLoad(() => api('/api/platform/plans').then((d) => d.plans), []);
  const [edit, setEdit] = useState(null);
  const canEdit = isSuper || perms.includes('plans.manage');
  return html`<div><div class="topbar"><h1>Plans</h1>${canEdit ? html`<button class="btn primary" onClick=${() => setEdit({})}>+ Plan</button>` : null}</div>
    ${st.loading ? html`<${Loading} />` : html`<div class="grid cols-3">${st.data.map((p) => html`<div class="card"><div class="row between"><h3 style="margin:0">${p.name}</h3>${p.active ? html`<span class="badge ok">active</span>` : html`<span class="badge">hidden</span>`}</div>
      <div class="stat mt-s"><span class="value">${money(p.price_monthly)}<small class="muted">/mo</small></span><span class="sub">${money(p.price_annual)}/year · ${p.trial_days}-day trial</span></div>
      <p class="small">${p.max_branches} branches · ${p.max_tables} tables · ${p.max_staff} staff</p>${canEdit ? html`<button class="btn sm" onClick=${() => setEdit(p)}>Edit</button>` : null}</div>`)}</div>`}
    ${edit ? html`<${PlanModal} p=${edit} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); st.reload(true); }} />` : null}</div>`;
}

function PlanModal({ p, onClose, onSaved }) {
  const [f, setF] = useState({ name: p.name || '', price_monthly: p.price_monthly != null ? p.price_monthly / 100 : '', price_annual: p.price_annual != null ? p.price_annual / 100 : '', max_branches: p.max_branches || 1, max_tables: p.max_tables || 10, max_staff: p.max_staff || 5, trial_days: p.trial_days ?? 14, active: p.active ?? 1 });
  const [busy, run] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value });
  return html`<${Modal} title=${p.id ? `Edit ${p.name}` : 'New plan'} onClose=${onClose}><form class="form" onSubmit=${(e) => { e.preventDefault(); run('s', () => (p.id ? api(`/api/platform/plans/${p.id}`, { method: 'PUT', body: f }) : api('/api/platform/plans', { method: 'POST', body: f })).then(onSaved), 'Plan saved'); }}>
    <label class="field">Name<input required value=${f.name} onInput=${set('name')} /></label>
    <div class="row"><label class="field">Monthly price (₹)<input type="number" min="0" step="0.01" required value=${f.price_monthly} onInput=${set('price_monthly')} /></label><label class="field">Annual price (₹)<input type="number" min="0" step="0.01" required value=${f.price_annual} onInput=${set('price_annual')} /></label></div>
    <div class="row"><label class="field">Max branches<input type="number" min="1" value=${f.max_branches} onInput=${set('max_branches')} /></label><label class="field">Max tables<input type="number" min="1" value=${f.max_tables} onInput=${set('max_tables')} /></label><label class="field">Max staff<input type="number" min="1" value=${f.max_staff} onInput=${set('max_staff')} /></label></div>
    <label class="field">Trial days<input type="number" min="0" max="90" value=${f.trial_days} onInput=${set('trial_days')} /></label>
    <label class="check"><input type="checkbox" checked=${!!f.active} onChange=${set('active')} /> Available for new sign-ups</label>
    <button class="btn primary" disabled=${!!busy}>Save</button></form></${Modal}>`;
}

function Revenue({ ov }) {
  const st = useLoad(() => api('/api/platform/subscription-payments').then((d) => d.payments), []);
  return html`<div><div class="topbar"><h1>Subscription revenue</h1></div>
    <div class="grid cols-3"><${Stat} label="This month" value=${money(ov.revenue.this_month)} /><${Stat} label="All time" value=${money(ov.revenue.all_time)} /></div>
    <div class="card mt"><h3>By month</h3>${ov.revenue.by_month.map((m) => html`<div class="row between small"><span>${m.month}</span><b>${money(m.amount)}</b></div>`)}</div>
    ${st.loading ? html`<${Loading} />` : html`<div class="card pad-0 mt table-wrap"><table class="data"><thead><tr><th>Date</th><th>Company</th><th>Plan</th><th>Period</th><th>Reference</th><th class="right">Amount</th></tr></thead><tbody>
      ${st.data.map((p) => html`<tr><td>${new Date(p.created_at).toLocaleDateString()}</td><td>${p.company_name}</td><td>${p.plan_name}</td><td>${p.period}</td><td>${p.reference}</td><td class="right">${money(p.amount)}</td></tr>`)}</tbody></table></div>`}</div>`;
}

function Support() {
  const st = useLoad(() => api('/api/platform/support').then((d) => d.tickets), []);
  const [reply, setReply] = useState({});
  const [busy, run] = useAction();
  return html`<div><div class="topbar"><h1>Support requests</h1></div>
    ${st.loading ? html`<${Loading} />` : !st.data.length ? html`<${Empty} icon="🛟" title="No tickets" />` : html`<div class="col">${st.data.map((t) => html`<div class="card">
      <div class="row between"><div><b>${t.subject}</b><div class="small muted">${t.company_name} · ${t.created_by_name} · ${timeAgo(t.created_at)} · priority ${t.priority}</div></div><span class=${`badge ${t.status === 'resolved' ? 'ok' : 'warn'}`}>${t.status.replace('_', ' ')}</span></div>
      ${t.messages.map((m) => html`<div class=${`small mt-s ${m.from_platform ? 'alert' : ''}`}><b>${m.from_platform ? `Support (${m.author})` : m.author}</b> · ${timeAgo(m.created_at)}<div>${m.body}</div></div>`)}
      <form class="row wrap mt-s" onSubmit=${(e) => { e.preventDefault(); run(`r${t.id}`, () => api(`/api/platform/support/${t.id}/reply`, { method: 'POST', body: { body: reply[t.id] || '', status: reply[`s${t.id}`] } }).then(() => { setReply({}); st.reload(true); }), 'Updated'); }}>
        <input class="grow" placeholder="Reply…" value=${reply[t.id] || ''} onInput=${(e) => setReply({ ...reply, [t.id]: e.target.value })} />
        <select value=${reply[`s${t.id}`] || ''} onChange=${(e) => setReply({ ...reply, [`s${t.id}`]: e.target.value || undefined })}><option value="">Status…</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="open">Open</option></select>
        <button class="btn sm" disabled=${!!busy}>Send</button></form></div>`)}</div>`}</div>`;
}

function Admins() {
  const st = useLoad(() => api('/api/platform/admins'), []);
  const [f, setF] = useState({ name: '', email: '', perms: ['companies.view', 'support'] });
  const [created, setCreated] = useState(null);
  const [busy, run] = useAction();
  if (st.loading) return html`<${Loading} />`;
  const all = st.data.all_perms;
  return html`<div><div class="topbar"><h1>Platform admins</h1></div>
    <div class="grid cols-2" style="align-items:start">
      <div class="card pad-0 table-wrap"><table class="data"><thead><tr><th>Admin</th><th>Permissions</th><th></th></tr></thead><tbody>
        ${st.data.admins.map((a) => html`<tr><td><b>${a.name}</b><div class="small muted">${a.email}</div></td>
          <td>${a.platform_role === 'super_admin' ? html`<span class="badge brand">Super admin – everything</span>` : html`<div class="row wrap" style="gap:4px">${all.map((p) => html`<label class="check small" style="min-height:28px"><input type="checkbox" checked=${a.platform_perms.includes(p)} disabled=${!!busy}
            onChange=${(e) => run(`p${a.id}`, () => api(`/api/platform/admins/${a.id}`, { method: 'PUT', body: { perms: e.target.checked ? [...a.platform_perms, p] : a.platform_perms.filter((x) => x !== p) } }).then(() => st.reload(true)))} />${p}</label>`)}</div>`}</td>
          <td>${a.platform_role === 'platform_admin' ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => run(`d${a.id}`, () => api(`/api/platform/admins/${a.id}`, { method: 'PUT', body: { status: a.status === 'active' ? 'disabled' : 'active' } }).then(() => st.reload(true)))}>${a.status === 'active' ? 'Disable' : 'Enable'}</button>` : null}</td></tr>`)}</tbody></table></div>
      <form class="card form" onSubmit=${(e) => { e.preventDefault(); run('c', () => api('/api/platform/admins', { method: 'POST', body: f }).then((r) => { setCreated(r.temporary_password); st.reload(true); })); }}>
        <h3>Add platform admin</h3>
        <label class="field">Name<input required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></label>
        <label class="field">Email<input type="email" required value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} /></label>
        <div class="row wrap">${all.map((p) => html`<label class="check small"><input type="checkbox" checked=${f.perms.includes(p)} onChange=${(e) => setF({ ...f, perms: e.target.checked ? [...f.perms, p] : f.perms.filter((x) => x !== p) })} />${p}</label>`)}</div>
        <button class="btn primary" disabled=${!!busy}>Create admin</button>
        ${created ? html`<div class="alert ok">Temporary password: <b class="mono">${created}</b><br/><span class="small">Share it securely; they should change it after signing in.</span></div>` : null}</form>
    </div></div>`;
}

function Audit() {
  const st = useLoad(() => api('/api/platform/audit').then((d) => d.entries), []);
  return html`<div><div class="topbar"><h1>Platform audit log</h1></div>${st.loading ? html`<${Loading} />` : html`<div class="card pad-0 table-wrap"><table class="data"><thead><tr><th>When</th><th>Company</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>
    ${st.data.map((a) => html`<tr><td class="nowrap">${new Date(a.created_at).toLocaleString()}</td><td>${a.company_name || '—'}</td><td>${a.actor_name || a.actor_label}</td><td><span class="badge">${a.action}</span></td><td class="small mono" style="max-width:380px;word-break:break-word">${JSON.stringify(a.details)}</td></tr>`)}</tbody></table></div>`}</div>`;
}
