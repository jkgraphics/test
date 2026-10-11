// Live operations: kitchen display, floor/waiter view, cashier billing, order list.
import { html, useState, useEffect, useRef, useCallback, api, toast, money, uuid, Modal, Diet, Spinner, Loading, Empty, ErrorBox, StatusBadge, ORDER_STATUS, clock, timeAgo, parseTime, mmss, useNow, beep, enableSound, useLoad, useAction } from '../lib.js';
import { useCtx, useBranchEvents } from '../core.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ACTIVE = ['pending', 'accepted', 'preparing', 'ready'];

function printKot(o, branchName) {
  const w = window.open('', '_blank', 'width=380,height=600');
  if (!w) { toast('Allow pop-ups to print tickets', 'warn'); return; }
  w.document.write(`<!doctype html><html><head><title>KOT #${o.order_no}</title><style>
    body{font-family:ui-monospace,monospace;width:72mm;margin:0 auto;padding:8px;font-size:14px}h1{font-size:20px;margin:0}
    .row{display:flex;justify-content:space-between}.it{font-size:16px;margin:6px 0;font-weight:700}.op{font-weight:400;font-size:13px;padding-left:22px}
    .note{border:1px dashed #000;padding:4px;margin:4px 0 4px 22px}hr{border:0;border-top:1px dashed #000}</style></head><body>
    <div class="row"><h1>KOT #${o.order_no}</h1><h1>T-${esc(o.table_number)}</h1></div>
    <div>${esc(branchName)} · ${new Date(o.created_at).toLocaleString()}</div><hr/>
    ${o.items.map((i) => `<div class="it">${i.qty} × ${esc(i.name)}</div>${i.options.length ? `<div class="op">${i.options.map((x) => esc(x.name)).join(', ')}</div>` : ''}${i.instructions ? `<div class="note">${esc(i.instructions)}</div>` : ''}`).join('')}
    ${o.note ? `<hr/><div class="note" style="margin-left:0">NOTE: ${esc(o.note)}</div>` : ''}<hr/><div>Source: ${o.source === 'staff' ? 'Staff' : 'QR order'}</div>
    <script>window.onload=()=>{window.print();}</script></body></html>`);
  w.document.close();
}

function ReasonModal({ title, label = 'Reason', confirm = 'Confirm', danger = true, onClose, onSubmit, presets = [] }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return html`<${Modal} title=${title} onClose=${onClose}>
    <form class="form" onSubmit=${async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(reason); onClose(); } catch (x) { toast(x.message, 'bad'); } finally { setBusy(false); } }}>
      ${presets.length ? html`<div class="row wrap">${presets.map((p) => html`<button type="button" class="btn sm" onClick=${() => setReason(p)}>${p}</button>`)}</div>` : null}
      <label class="field">${label}<input required minlength="3" maxlength="200" value=${reason} onInput=${(e) => setReason(e.target.value)} autofocus /></label>
      <button class=${`btn ${danger ? 'danger' : 'primary'} lg`} disabled=${busy || reason.trim().length < 3}>${busy ? html`<${Spinner} />` : null} ${confirm}</button>
    </form></${Modal}>`;
}

function useOrders(branchId) {
  const st = useLoad(() => api(`/api/staff/branches/${branchId}/orders`).then((d) => d.orders), [branchId]);
  const upsert = (o) => st.setData((list) => {
    if (!list) return list;
    const rest = list.filter((x) => x.id !== o.id);
    return ACTIVE.includes(o.status) ? [...rest, o].sort((a, b) => a.id - b.id) : rest;
  });
  return { ...st, upsert };
}

// =========================================================================== KITCHEN (tablet)
export function KitchenPage() {
  const { branch, branchId, can } = useCtx();
  const orders = useOrders(branchId);
  const [sound, setSound] = useState(false);
  const [reject, setReject] = useState(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [busy, run] = useAction();
  const now = useNow(1000);
  useBranchEvents((n, d) => {
    if (n === 'resync') orders.reload(true);
    if (n === 'order.new') { orders.upsert(d); beep(); toast(`New order #${d.order_no} · Table ${d.table_number}`, 'warn'); }
    if (n === 'order.updated') orders.upsert(d);
  });
  const act = (o, action, body = {}) => run(`${o.id}:${action}`, () => api(`/api/staff/orders/${o.id}/${action}`, { method: 'POST', body }).then((r) => orders.upsert(r.order)));
  const list = orders.data || [];
  const cols = [
    ['New', list.filter((o) => o.status === 'pending')],
    ['Cooking', list.filter((o) => ['accepted', 'preparing'].includes(o.status))],
    ['Ready for pickup', list.filter((o) => o.status === 'ready')],
  ];
  return html`<div class="kitchen">
    <div class="topbar"><h1>Kitchen · ${branch?.name}</h1>
      <div class="row wrap">
        <button class=${`btn ${sound ? 'ok' : ''}`} onClick=${() => { if (enableSound()) { setSound(true); beep([660]); } }}>${sound ? '🔔 Sound on' : '🔕 Enable sound'}</button>
        <button class="btn" onClick=${() => setStockOpen(true)}>📦 Stock</button>
        ${can('branches.settings') ? html`<${PauseButton} />` : null}
      </div></div>
    ${orders.error ? html`<${ErrorBox} error=${orders.error} onRetry=${() => orders.reload()} />` : null}
    ${orders.loading && !orders.data ? html`<${Loading} />` : html`
    <div class="grid cols-3" style="align-items:start">${cols.map(([title, items]) => html`<section>
      <h2 class="row between">${title} <span class="badge">${items.length}</span></h2>
      ${!items.length ? html`<div class="card flat empty small">Nothing here</div>` : html`<div class="col">${items.map((o) => html`<${Ticket} key=${o.id} o=${o} now=${now} busy=${busy} act=${act} onReject=${() => setReject(o)} branchName=${branch?.name} />`)}</div>`}
    </section>`)}</div>`}
    ${reject ? html`<${ReasonModal} title=${`Reject order #${reject.order_no}`} confirm="Reject order" presets=${['Item unavailable', 'Kitchen closing', 'Duplicate order']}
      onClose=${() => setReject(null)} onSubmit=${(reason) => api(`/api/staff/orders/${reject.id}/reject`, { method: 'POST', body: { reason } }).then((r) => orders.upsert(r.order))} />` : null}
    ${stockOpen ? html`<${StockModal} onClose=${() => setStockOpen(false)} />` : null}
  </div>`;
}

function Ticket({ o, now, busy, act, onReject, branchName }) {
  const [prep, setPrep] = useState('');
  const since = now - parseTime(o.created_at).getTime();
  const due = o.accepted_at && o.prep_minutes ? parseTime(o.accepted_at).getTime() + o.prep_minutes * 60000 - now : null;
  const late = due != null && due < 0 && o.status !== 'ready';
  const b = (a) => busy === `${o.id}:${a}`;
  return html`<article class=${`ticket ${o.status} ${late ? 'late' : ''}`}>
    <div class="t-head"><div><span class="tno">#${o.order_no}</span> <span class="badge brand" style="font-size:.95rem">Table ${o.table_number}</span></div>
      <div class="right"><${StatusBadge} status=${o.status} /><div class=${`timer ${late ? 'late' : ''}`} title="Time since order / time left">${due != null && o.status !== 'ready' ? `⏱ ${mmss(due)}` : `🕒 ${mmss(since)}`}</div></div></div>
    <div class="t-body">
      ${o.items.map((i) => html`<div class="t-item"><span class="q">${i.qty}×</span><div class="grow"><div class="row" style="gap:6px"><${Diet} diet=${i.diet} /><b>${i.name}</b></div>
        ${i.options.length ? html`<div class="small muted">${i.options.map((x) => x.name).join(', ')}</div>` : null}
        ${i.instructions ? html`<div class="t-note">⚠ ${i.instructions}</div>` : null}</div></div>`)}
      ${o.note ? html`<div class="t-note">📝 ${o.note}</div>` : null}
      <div class="small muted">${clock(o.created_at)} · ${o.source === 'staff' ? 'Taken by staff' : 'QR order'}</div>
    </div>
    <div class="t-foot">
      ${o.status === 'pending' ? html`
        <select aria-label="Preparation minutes" style="flex:0 0 110px" value=${prep} onChange=${(e) => setPrep(e.target.value)} title="Estimated preparation time"><option value="">Auto ⏱</option>${[5, 10, 15, 20, 25, 30, 45, 60].map((m) => html`<option value=${m}>${m} min</option>`)}</select>
        <button class="btn ok" disabled=${!!busy} onClick=${() => act(o, 'accept', prep ? { prep_minutes: Number(prep) } : {})}>${b('accept') ? html`<${Spinner} />` : '✓'} Accept</button>
        <button class="btn danger" disabled=${!!busy} onClick=${onReject}>Reject</button>` : null}
      ${o.status === 'accepted' ? html`<button class="btn soft" disabled=${!!busy} onClick=${() => act(o, 'preparing')}>🔥 Start preparing</button>` : null}
      ${['accepted', 'preparing'].includes(o.status) ? html`<button class="btn ok" disabled=${!!busy} onClick=${() => act(o, 'ready')}>${b('ready') ? html`<${Spinner} />` : '🛎️'} Ready</button>` : null}
      ${o.status === 'ready' ? html`<span class="small muted grow">Waiting for waiter pickup · ready ${timeAgo(o.ready_at)}</span>` : null}
      <button class="btn sm ghost" title="Print KOT" onClick=${() => printKot(o, branchName)}>🖨️ KOT</button>
    </div>
  </article>`;
}

function PauseButton() {
  const { branch, branchId, reloadCtx } = useCtx();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, run] = useAction();
  const toggle = (paused, message = '') => run('pause', async () => { await api(`/api/staff/branches/${branchId}/pause`, { method: 'POST', body: { paused, message } }); await reloadCtx(); setOpen(false); }, paused ? 'New orders paused' : 'Orders resumed');
  if (branch?.ordering_paused) return html`<button class="btn ok" disabled=${!!busy} onClick=${() => toggle(false)}>▶ Resume orders</button>`;
  return html`<button class="btn danger" onClick=${() => setOpen(true)}>⏸ Pause orders</button>
    ${open ? html`<${Modal} title="Pause incoming QR orders" onClose=${() => setOpen(false)}>
      <p class="muted">Customers can still browse the menu and call staff, but cannot submit new orders until you resume. Staff can still take orders.</p>
      <label class="field">Message shown to customers (optional)<input maxlength="200" value=${msg} placeholder="Kitchen is very busy – back in 15 minutes" onInput=${(e) => setMsg(e.target.value)} /></label>
      <button class="btn danger lg block mt" disabled=${!!busy} onClick=${() => toggle(true, msg)}>Pause new orders</button></${Modal}>` : null}`;
}

function StockModal({ onClose }) {
  const { branchId } = useCtx();
  const menu = useLoad(() => api(`/api/staff/branches/${branchId}/menu`), [branchId]);
  const [q, setQ] = useState('');
  const [busy, run] = useAction();
  const toggle = (i) => run(i.id, async () => { await api(`/api/staff/menu-items/${i.id}/stock`, { method: 'POST', body: { in_stock: !i.in_stock } }); menu.setData((m) => ({ ...m, items: m.items.map((x) => (x.id === i.id ? { ...x, in_stock: !i.in_stock } : x)) })); });
  return html`<${Modal} title="Out of stock toggles" onClose=${onClose}>
    <p class="small muted">Changes appear on customer menus immediately.</p>
    <input type="search" placeholder="Search dishes" value=${q} onInput=${(e) => setQ(e.target.value)} />
    ${menu.loading ? html`<${Loading} />` : html`<div class="col mt">${menu.data.items.filter((i) => i.active && i.name.toLowerCase().includes(q.toLowerCase())).map((i) => html`
      <label class="check row between" style="border-bottom:1px solid var(--line)"><span class="row"><${Diet} diet=${i.diet} />${i.name}</span>
        <span class="row">${i.in_stock ? html`<span class="badge ok">In stock</span>` : html`<span class="badge bad">Out of stock</span>`}
        <input type="checkbox" checked=${i.in_stock} disabled=${busy === i.id} onChange=${() => toggle(i)} aria-label=${`${i.name} in stock`} /></span></label>`)}</div>`}
  </${Modal}>`;
}

// =========================================================================== FLOOR (waiter)
export function FloorPage() {
  const { branch, branchId, can, me } = useCtx();
  const tables = useLoad(() => api(`/api/staff/branches/${branchId}/tables`).then((d) => d.tables), [branchId]);
  const orders = useOrders(branchId);
  const joins = useLoad(() => (can('sessions.manage') ? api(`/api/staff/branches/${branchId}/join-requests`).then((d) => d.requests) : Promise.resolve([])), [branchId]);
  const service = useLoad(() => api(`/api/staff/branches/${branchId}/service-requests`).then((d) => d.requests), [branchId]);
  const [selected, setSelected] = useState(null);
  const [mine, setMine] = useState(false);
  const [sound, setSound] = useState(false);
  const [busy, run] = useAction();

  useBranchEvents((n, d) => {
    if (n === 'resync') { tables.reload(true); orders.reload(true); joins.reload(true); service.reload(true); }
    if (n === 'table.updated') tables.setData((l) => l && (l.some((t) => t.id === d.id) ? l.map((t) => (t.id === d.id ? d : t)) : [...l, d]));
    if (n === 'order.new') { orders.upsert(d); if (d.source === 'customer') toast(`Table ${d.table_number}: new order #${d.order_no}`); }
    if (n === 'order.updated') {
      orders.upsert(d);
      if (d.status === 'ready') { beep([988, 0, 1319, 0, 1568]); toast(`🛎️ Table ${d.table_number}: order #${d.order_no} is READY`, 'ok'); }
    }
    if (n === 'join.new') { joins.setData((l) => [...(l || []), d]); beep([660, 0, 660]); toast(`Table ${d.table_number}: a phone wants to join`, 'warn'); }
    if (n === 'join.updated') joins.setData((l) => (l || []).filter((x) => x.id !== d.id));
    if (n === 'service.new') { service.setData((l) => [...(l || []), d]); beep([784, 0, 784]); toast(`Table ${d.table_number}: ${{ waiter: 'calling a waiter', water: 'needs water', bill: 'requested the bill' }[d.type]}`, 'warn'); }
    if (n === 'service.updated' && d.status !== 'open') service.setData((l) => (l || []).filter((x) => x.id !== d.id));
  });

  const ready = (orders.data || []).filter((o) => o.status === 'ready');
  const svc = service.data || [];
  const allTables = (tables.data || []).filter((t) => !mine || t.assigned_waiter?.id === me.user.id);
  const alertTables = new Set([...svc.map((s) => s.table_id), ...ready.map((o) => o.table_id), ...(joins.data || []).map((j) => j.table_id)]);
  const STATUS = { available: ['Available', 'ok'], occupied: ['Occupied', 'warn'], bill_requested: ['Bill requested', 'info'], cleaning: ['Cleaning', ''] };

  return html`<div>
    <div class="topbar"><h1>Tables · ${branch?.name}</h1>
      <div class="row wrap">
        <label class="check"><input type="checkbox" checked=${mine} onChange=${(e) => setMine(e.target.checked)} /> My tables only</label>
        <button class=${`btn ${sound ? 'ok' : ''}`} onClick=${() => { if (enableSound()) { setSound(true); beep([660]); } }}>${sound ? '🔔 Alerts on' : '🔕 Enable sound'}</button>
      </div></div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(260px,340px);align-items:start">
      <section>
        ${tables.error ? html`<${ErrorBox} error=${tables.error} onRetry=${() => tables.reload()} />` : null}
        ${tables.loading && !tables.data ? html`<${Loading} />` : !allTables.length ? html`<${Empty} icon="🪑" title="No tables">Add tables under Tables & QR.</${Empty}>` : html`
        <div class="floor">${allTables.map((t) => html`<button class=${`tile ${t.status} ${alertTables.has(t.id) ? 'alerting' : ''}`} onClick=${() => setSelected(t.id)}>
          <div class="row between"><span class="num">${t.number}</span><span class=${`badge ${STATUS[t.status][1]}`}>${STATUS[t.status][0]}</span></div>
          <div class="small muted">${t.section || ''} · ${t.capacity} seats</div>
          ${t.session ? html`<div class="small">Code <b class="mono">${t.session.join_code}</b> · 📱${t.session.devices}</div>
            <div class="row wrap small" style="gap:4px">${t.session.pending ? html`<span class="badge warn">${t.session.pending} new</span>` : null}${t.session.cooking ? html`<span class="badge brand">${t.session.cooking} cooking</span>` : null}${t.session.ready ? html`<span class="badge ok">${t.session.ready} ready</span>` : null}</div>` : null}
        </button>`)}</div>`}
      </section>
      <aside class="col">
        ${(joins.data || []).length ? html`<div class="card"><h3>📱 Join requests</h3>${joins.data.map((j) => html`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <div><b>Table ${j.table_number}</b>${j.label ? html` · ${j.label}` : null}<div class="small muted">${timeAgo(j.created_at)}</div></div>
          <div class="row"><button class="btn sm ok" disabled=${!!busy} onClick=${() => run(`j${j.id}`, () => api(`/api/staff/join-requests/${j.id}/approve`, { method: 'POST', body: {} }).then(() => joins.reload(true)), 'Phone approved')}>Approve</button>
          <button class="btn sm" disabled=${!!busy} onClick=${() => run(`j${j.id}`, () => api(`/api/staff/join-requests/${j.id}/deny`, { method: 'POST', body: {} }).then(() => joins.reload(true)))}>Deny</button></div></div>`)}</div>` : null}
        <div class="card"><h3>🙋 Service requests</h3>${!svc.length ? html`<p class="muted small">No open requests.</p>` : svc.map((s) => html`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <div><b>Table ${s.table_number}</b> · ${{ waiter: '🙋 Waiter', water: '💧 Water', bill: '🧾 Bill' }[s.type]}<div class="small muted">${timeAgo(s.created_at)}</div></div>
          ${can('service.handle') ? html`<button class="btn sm ok" disabled=${!!busy} onClick=${() => run(`s${s.id}`, () => api(`/api/staff/service-requests/${s.id}/done`, { method: 'POST', body: {} }).then(() => service.reload(true)))}>Done</button>` : null}</div>`)}</div>
        <div class="card"><h3>🛎️ Ready to serve</h3>${!ready.length ? html`<p class="muted small">Nothing waiting.</p>` : ready.map((o) => html`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <div><b>Table ${o.table_number}</b> · #${o.order_no}<div class="small muted">${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div></div>
          ${can('orders.serve') ? html`<button class="btn sm ok" disabled=${!!busy} onClick=${() => run(`o${o.id}`, () => api(`/api/staff/orders/${o.id}/served`, { method: 'POST', body: {} }).then((r) => orders.upsert(r.order)), 'Marked served')}>Served</button>` : null}</div>`)}</div>
      </aside>
    </div>
    ${selected ? html`<${TableModal} table=${(tables.data || []).find((t) => t.id === selected)} orders=${(orders.data || []).filter((o) => o.table_id === selected)} onClose=${() => setSelected(null)} reloadTables=${() => tables.reload(true)} upsertOrder=${orders.upsert} />` : null}
  </div>`;
}

function TableModal({ table: t, onClose, reloadTables, upsertOrder }) {
  const { can, branchId } = useCtx();
  const [busy, run] = useAction();
  const [view, setView] = useState('main');
  const [guests, setGuests] = useState(2);
  const [closeErr, setCloseErr] = useState(null);
  const session = useLoad(() => (t?.session ? api(`/api/staff/sessions/${t.session.id}/bill`) : Promise.resolve(null)), [t?.session?.id]);
  const sessOrders = useLoad(() => (t?.session ? api(`/api/staff/branches/${branchId}/orders?scope=recent`).then((d) => d.orders.filter((o) => o.session_id === t.session.id)) : Promise.resolve([])), [t?.session?.id]);
  useBranchEvents((n, d) => {
    if ((n === 'order.updated' || n === 'order.new') && d.session_id === t?.session?.id) { sessOrders.reload(true); session.reload(true); }
    if (n === 'bill.updated' && d.session_id === t?.session?.id) session.reload(true);
  });
  if (!t) return null;
  const doClose = (force = false, reason = '') => run('close', async () => {
    try {
      await api(`/api/staff/tables/${t.id}/close`, { method: 'POST', body: { force, reason } });
      toast(`Table ${t.number} closed – marked for cleaning`, 'ok'); reloadTables(); onClose();
    } catch (e) { if (e.data?.needs_force) setCloseErr(e.message); else throw e; }
  });
  if (view === 'order') return html`<${TakeOrder} table=${t} onClose=${() => setView('main')} onPlaced=${(o) => { upsertOrder(o); sessOrders.reload(true); setView('main'); }} />`;
  return html`<${Modal} title=${`Table ${t.number}`} onClose=${onClose} wide>
    <div class="row wrap between"><div class="muted">${t.section || 'No section'} · ${t.capacity} seats ${t.assigned_waiter ? `· Waiter: ${t.assigned_waiter.name}` : ''}</div><span class="badge">${t.status.replace('_', ' ')}</span></div>
    ${!t.session ? html`<div class="mt">
      ${t.status === 'cleaning' ? html`<div class="alert">This table is marked for cleaning. Mark it available when it's ready for the next guests.</div>
        <button class="btn ok lg mt" disabled=${!!busy} onClick=${() => run('avail', () => api(`/api/staff/tables/${t.id}/status`, { method: 'POST', body: { status: 'available' } }).then(reloadTables), 'Table available')}>✓ Mark available</button>` : null}
      ${can('sessions.manage') ? html`<div class="row wrap mt"><label class="field" style="max-width:140px">Guests<input type="number" min="1" max="50" value=${guests} onInput=${(e) => setGuests(e.target.value)} /></label>
        <button class="btn primary lg" style="align-self:flex-end" disabled=${!!busy} onClick=${() => run('open', () => api(`/api/staff/tables/${t.id}/open`, { method: 'POST', body: { guest_count: Number(guests) || null } }).then(reloadTables), 'Session opened')}>Open dining session</button></div>
        <p class="small muted">Opening a session generates a 4-digit table code. Guests enter it on their phones (or you approve their phones) before they can order or see the bill.</p>` : null}
    </div>` : html`
      <div class="grid cols-3 mt">
        <div class="card flat stat"><span class="label">Table code</span><span class="value mono">${t.session.join_code}</span>
          ${can('sessions.manage') ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => run('code', () => api(`/api/staff/tables/${t.id}/new-code`, { method: 'POST', body: {} }).then(reloadTables), 'New code generated')}>New code</button>` : null}</div>
        <div class="card flat stat"><span class="label">Phones joined</span><span class="value">${t.session.devices}</span><span class="sub">Open since ${clock(t.session.opened_at)}</span></div>
        <div class="card flat stat"><span class="label">Bill</span><span class="value">${session.data ? money(session.data.bill.total) : '…'}</span><span class="sub">${session.data ? `Due ${money(session.data.bill.outstanding)}` : ''}</span></div>
      </div>
      <h3 class="mt">Orders</h3>
      ${sessOrders.loading ? html`<${Loading} />` : !sessOrders.data.length ? html`<p class="muted">No orders yet.</p>` : html`<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Items</th><th>Status</th><th></th></tr></thead><tbody>
        ${sessOrders.data.map((o) => html`<tr><td>#${o.order_no}<div class="small muted">${clock(o.created_at)}</div></td>
          <td>${o.items.map((i) => html`<div>${i.qty}× ${i.name}${i.instructions ? html` <i class="small">“${i.instructions}”</i>` : null}</div>`)}</td>
          <td><${StatusBadge} status=${o.status} />${o.cancel_reason ? html`<div class="small muted">${o.cancel_reason}</div>` : null}</td>
          <td class="right">${['ready', 'accepted', 'preparing'].includes(o.status) && can('orders.serve') ? html`<button class="btn sm ok" disabled=${!!busy} onClick=${() => run(`s${o.id}`, () => api(`/api/staff/orders/${o.id}/served`, { method: 'POST', body: {} }).then((r) => { upsertOrder(r.order); sessOrders.reload(true); }))}>Served</button>` : null}</td></tr>`)}
      </tbody></table></div>`}
      <div class="row wrap mt">
        ${can('orders.place') ? html`<button class="btn primary" onClick=${() => setView('order')}>➕ Take order</button>` : null}
        <a class="btn" href=${`/api/staff/sessions/${t.session.id}/bill/print`} target="_blank" rel="noopener">🧾 Print bill</a>
        ${can('sessions.manage') ? html`<button class="btn danger" disabled=${!!busy} onClick=${() => doClose(false)}>Close session</button>` : null}
      </div>
      ${closeErr ? html`<div class="alert warn mt"><b>${closeErr}</b>
        ${can('orders.cancel') ? html`<${ForceClose} onSubmit=${(reason) => doClose(true, reason)} busy=${busy} />` : html`<div class="small">Collect payment at billing first, or ask a manager to force-close.</div>`}</div>` : null}
    `}
  </${Modal}>`;
}

function ForceClose({ onSubmit, busy }) {
  const [reason, setReason] = useState('');
  return html`<form class="row wrap mt-s" onSubmit=${(e) => { e.preventDefault(); onSubmit(reason); }}>
    <input class="grow" placeholder="Reason (required, audited)" minlength="3" required value=${reason} onInput=${(e) => setReason(e.target.value)} />
    <button class="btn danger" disabled=${!!busy || reason.trim().length < 3}>Force close</button></form>`;
}

// Waiter takes an order on behalf of the table (server validates & prices exactly like QR orders).
function TakeOrder({ table, onClose, onPlaced }) {
  const { branchId } = useCtx();
  const menu = useLoad(() => api(`/api/staff/branches/${branchId}/menu`), [branchId]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [pick, setPick] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const keyRef = useRef(uuid());
  const total = cart.reduce((s, l) => s + l.unit * l.qty, 0);
  async function send() {
    setSending(true);
    try {
      const r = await api(`/api/staff/tables/${table.id}/orders`, { method: 'POST', body: { idempotency_key: keyRef.current, note, lines: cart.map((l) => ({ item_id: l.item_id, qty: l.qty, selections: l.selections, instructions: l.instructions })) }, retries: 2 });
      toast(`Order #${r.order.order_no} sent to kitchen`, 'ok'); onPlaced(r.order);
    } catch (e) { toast(e.message, 'bad'); if (e.status !== 0) keyRef.current = uuid(); } finally { setSending(false); }
  }
  return html`<${Modal} title=${`Take order · Table ${table.number}`} onClose=${onClose} wide>
    ${menu.loading ? html`<${Loading} />` : menu.error ? html`<${ErrorBox} error=${menu.error} />` : html`
    <div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">
      <div><input type="search" placeholder="Search menu" value=${q} onInput=${(e) => setQ(e.target.value)} />
        <div class="col mt-s" style="max-height:55vh;overflow:auto">${menu.data.items.filter((i) => i.active && i.name.toLowerCase().includes(q.toLowerCase())).map((i) => html`
          <button class="btn" style="justify-content:space-between" disabled=${!i.in_stock} onClick=${() => setPick(i)}><span class="row"><${Diet} diet=${i.diet} />${i.name}</span><span>${i.in_stock ? money(i.price) + (i.options.length ? ' +' : '') : 'Out of stock'}</span></button>`)}</div></div>
      <div class="card flat"><h3>Order</h3>
        ${!cart.length ? html`<p class="muted small">Tap dishes to add.</p>` : cart.map((l, idx) => html`<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--line)">
          <span>${l.qty}× ${l.name}${l.labels ? html` <span class="muted">(${l.labels})</span>` : null}${l.instructions ? html`<br/><i>“${l.instructions}”</i>` : null}</span>
          <span class="row">${money(l.unit * l.qty)}<button class="btn sm ghost" aria-label="Remove" onClick=${() => setCart(cart.filter((_, i) => i !== idx))}>✕</button></span></div>`)}
        <label class="field mt-s">Note for kitchen<input value=${note} maxlength="300" onInput=${(e) => setNote(e.target.value)} /></label>
        <div class="row between mt-s"><b>Items total</b><b>${money(total)}</b></div>
        <button class="btn primary lg block mt-s" disabled=${!cart.length || sending} onClick=${send}>${sending ? html`<${Spinner} />` : null} Send to kitchen</button>
      </div></div>`}
    ${pick ? html`<${PickOptions} item=${pick} onClose=${() => setPick(null)} onAdd=${(l) => { setCart([...cart, l]); setPick(null); }} />` : null}
  </${Modal}>`;
}

function PickOptions({ item, onClose, onAdd }) {
  const [sel, setSel] = useState(() => Object.fromEntries(item.options.filter((g) => g.type === 'single' && g.required).map((g) => [g.id, g.choices.find((c) => c.in_stock !== false)?.id])));
  const [qty, setQty] = useState(1);
  const [instr, setInstr] = useState('');
  const unit = item.price + item.options.reduce((s, g) => s + [].concat(sel[g.id] || []).reduce((a, id) => a + (g.choices.find((c) => c.id === id)?.price || 0), 0), 0);
  const labels = item.options.flatMap((g) => [].concat(sel[g.id] || []).map((id) => g.choices.find((c) => c.id === id)?.name)).filter(Boolean).join(', ');
  const missing = item.options.some((g) => g.required && ![].concat(sel[g.id] || []).length);
  return html`<${Modal} title=${item.name} onClose=${onClose}>
    ${item.options.map((g) => html`<fieldset class="card flat mb"><legend><b>${g.name}</b> ${g.required ? html`<span class="badge warn">required</span>` : null}</legend>
      ${g.choices.map((c) => html`<label class="check"><input type=${g.type === 'single' ? 'radio' : 'checkbox'} name=${g.id} disabled=${c.in_stock === false}
        checked=${[].concat(sel[g.id] || []).includes(c.id)} onChange=${() => setSel((s) => (g.type === 'single' ? { ...s, [g.id]: c.id } : { ...s, [g.id]: [].concat(s[g.id] || []).includes(c.id) ? [].concat(s[g.id]).filter((x) => x !== c.id) : [...[].concat(s[g.id] || []), c.id] }))} />
        <span class="grow">${c.name}</span><span class="muted">${c.price ? `+${money(c.price)}` : ''}</span></label>`)}</fieldset>`)}
    <label class="field">Instructions<input value=${instr} maxlength="200" placeholder="less spicy, no onion" onInput=${(e) => setInstr(e.target.value)} /></label>
    <div class="row mt"><label class="field" style="max-width:100px">Qty<input type="number" min="1" max="50" value=${qty} onInput=${(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} /></label>
      <button class="btn primary lg grow" style="align-self:flex-end" disabled=${missing} onClick=${() => onAdd({ item_id: item.id, name: item.name, selections: sel, qty, instructions: instr.trim(), unit, labels })}>Add · ${money(unit * qty)}</button></div>
  </${Modal}>`;
}

// =========================================================================== BILLING (cashier)
export function BillingPage() {
  const { branchId, branch } = useCtx();
  const list = useLoad(() => api(`/api/staff/branches/${branchId}/bills`), [branchId]);
  const [sel, setSel] = useState(null);
  const [busy, run] = useAction();
  useBranchEvents((n, d) => {
    if (['resync', 'bill.updated', 'payment.updated', 'table.updated'].includes(n)) list.reload(true);
    if (n === 'payment.updated' && d.needs_confirmation) { beep([523, 0, 659]); toast('A customer reported a UPI payment – please verify', 'warn'); }
  });
  return html`<div>
    <div class="topbar"><h1>Billing · ${branch?.name}</h1></div>
    ${list.error ? html`<${ErrorBox} error=${list.error} onRetry=${() => list.reload()} />` : null}
    ${list.loading && !list.data ? html`<${Loading} />` : html`
    ${list.data.pending_upi.length ? html`<div class="card mb" style="border-color:var(--warn)"><h3>📲 UPI payments awaiting confirmation</h3>
      <p class="small muted">Check your bank / UPI app for the transaction before confirming. Screenshots are never proof of payment.</p>
      ${list.data.pending_upi.map((p) => html`<div class="row wrap between" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div><b>Table ${p.table_number}</b> · ${money(p.amount)} · UTR <span class="mono">${p.reference}</span><div class="small muted">${timeAgo(p.created_at)}</div></div>
        <div class="row"><button class="btn ok" disabled=${!!busy} onClick=${() => run(`c${p.id}`, () => api(`/api/staff/payments/${p.id}/confirm`, { method: 'POST', body: {} }).then(() => list.reload(true)), 'Payment confirmed')}>✓ Received</button>
        <button class="btn" disabled=${!!busy} onClick=${() => run(`r${p.id}`, () => api(`/api/staff/payments/${p.id}/reject`, { method: 'POST', body: { reason: 'Not received' } }).then(() => list.reload(true)), 'Marked as not received')}>Not received</button></div></div>`)}</div>` : null}
    <div class="grid cols-2" style="align-items:start">
      <div class="card"><h3>Open tables</h3>
        ${!list.data.open.length ? html`<${Empty} icon="🧾" title="No open tables" />` : html`<table class="data"><thead><tr><th>Table</th><th>Total</th><th>Due</th><th></th></tr></thead><tbody>
        ${list.data.open.map((b) => html`<tr style="cursor:pointer" onClick=${() => setSel(b.session_id)}><td><b>${b.table_number}</b> ${b.table_status === 'bill_requested' ? html`<span class="badge info">Bill requested</span>` : null}${b.pending_orders ? html`<span class="badge warn">${b.pending_orders} pending</span>` : null}</td>
          <td>${money(b.total)}</td><td>${b.outstanding ? html`<b>${money(b.outstanding)}</b>` : html`<span class="badge ok">Paid</span>`}</td><td class="right"><button class="btn sm">Open</button></td></tr>`)}</tbody></table>`}</div>
      <div class="card"><h3>Recent bills</h3>
        ${!list.data.recent.length ? html`<p class="muted">No bills yet.</p>` : html`<table class="data"><thead><tr><th>Bill</th><th>Table</th><th>Total</th><th>Status</th></tr></thead><tbody>
        ${list.data.recent.map((b) => html`<tr style="cursor:pointer" onClick=${() => setSel(b.session_id)}><td>#${b.bill_no}<div class="small muted">${timeAgo(b.created_at)}</div></td><td>${b.table_number}</td><td>${money(b.total)}</td>
          <td><span class=${`badge ${b.status === 'paid' ? 'ok' : 'warn'}`}>${b.status}</span>${b.refunded ? html` <span class="badge info">refund</span>` : null}</td></tr>`)}</tbody></table>`}</div>
    </div>`}
    ${sel ? html`<${BillModal} sessionId=${sel} onClose=${() => { setSel(null); list.reload(true); }} />` : null}
  </div>`;
}

function BillModal({ sessionId, onClose }) {
  const { can, branch } = useCtx();
  const st = useLoad(() => api(`/api/staff/sessions/${sessionId}/bill`), [sessionId]);
  const [busy, run] = useAction();
  const [pay, setPay] = useState({ method: 'cash', amount: '', reference: '' });
  const [disc, setDisc] = useState({ type: 'percent', value: '', reason: '' });
  const [refund, setRefund] = useState(null);
  useBranchEvents((n, d) => { if ((n === 'bill.updated' && d.session_id === sessionId) || n === 'payment.updated') st.reload(true); });
  if (st.loading && !st.data) return html`<${Modal} title="Bill" onClose=${onClose}><${Loading} /></${Modal}>`;
  if (st.error) return html`<${Modal} title="Bill" onClose=${onClose}><${ErrorBox} error=${st.error} /></${Modal}>`;
  const { bill: b, session: s } = st.data;
  const open = s.status === 'open';
  return html`<${Modal} title=${`Table ${s.table_number} · Bill ${b.bill_no ? `#${b.bill_no}` : '(not generated)'}`} onClose=${onClose} wide>
    <div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:start">
      <div>
        ${!b.lines.length ? html`<p class="muted">No accepted orders yet.</p>` : html`<table class="data"><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead><tbody>
          ${b.lines.map((l) => html`<tr><td>${l.name}${l.options.length ? html`<div class="small muted">${l.options.map((o) => o.name).join(', ')}</div>` : null}<div class="small muted">#${l.order_no}</div></td><td class="right">${l.qty}</td><td class="right">${money(l.unit_price)}</td><td class="right">${money(l.line_total)}</td></tr>`)}
        </tbody></table>`}
        <table class="data mt-s">
          <tr><td>Subtotal</td><td class="right">${money(b.subtotal)}</td></tr>
          ${b.discount ? html`<tr><td>Discount ${b.discount_type === 'percent' ? `(${b.discount_value}%)` : ''} – ${b.discount_reason}</td><td class="right">−${money(b.discount)}</td></tr>` : null}
          ${b.service_charge ? html`<tr><td>Service charge (${b.service_charge_pct}%)</td><td class="right">${money(b.service_charge)}</td></tr>` : null}
          ${b.taxes.map((t) => html`<tr><td>${t.name} (${t.rate}%)</td><td class="right">${money(t.amount)}</td></tr>`)}
          <tr><td><b>Total</b></td><td class="right"><b>${money(b.total)}</b></td></tr>
          <tr><td>Paid</td><td class="right">${money(b.paid)}</td></tr>
          ${b.refunded ? html`<tr><td>Refunded</td><td class="right">−${money(b.refunded)}</td></tr>` : null}
          <tr><td><b>Outstanding</b></td><td class="right"><b>${money(b.outstanding)}</b></td></tr>
        </table>
        ${b.pending_orders ? html`<div class="alert warn mt-s small">${b.pending_orders} order(s) still waiting for the kitchen – they are not on the bill yet.</div>` : null}
        <h3 class="mt">Payments</h3>
        ${!b.payments.length ? html`<p class="muted small">No payments yet.</p>` : html`<table class="data"><tbody>${b.payments.map((p) => html`<tr>
          <td>${p.method.toUpperCase()} ${p.provider_mode === 'test' ? html`<span class="badge test">TEST</span>` : null}<div class="small muted">${p.reference || ''} ${clock(p.created_at)}</div>${p.failure_reason ? html`<div class="small error-text">${p.failure_reason}</div>` : null}</td>
          <td class="right">${money(p.amount)}${p.refunded_amount ? html`<div class="small muted">refunded ${money(p.refunded_amount)}</div>` : null}</td>
          <td><span class=${`badge ${{ paid: 'ok', failed: 'bad', refunded: 'info', pending: 'warn' }[p.status]}`}>${p.status}</span></td>
          <td class="right">${can('billing.refund') && ['paid', 'refunded'].includes(p.status) && p.refunded_amount < p.amount ? html`<button class="btn sm" onClick=${() => setRefund(p)}>Refund</button>` : null}</td></tr>`)}</tbody></table>`}
      </div>
      <div class="col">
        ${!b.bill_no && can('billing.manage') ? html`<button class="btn primary" disabled=${!!busy} onClick=${() => run('gen', () => api(`/api/staff/sessions/${sessionId}/bill`, { method: 'POST', body: {} }).then(() => st.reload(true)), 'Bill generated')}>Generate bill</button>` : null}
        <a class="btn" href=${`/api/staff/sessions/${sessionId}/bill/print`} target="_blank" rel="noopener">🖨️ Print ${b.status === 'paid' ? 'receipt' : 'bill'}</a>
        ${b.outstanding > 0 && can('billing.manage') ? html`<form class="card flat form" onSubmit=${(e) => { e.preventDefault(); run('pay', () => api(`/api/staff/sessions/${sessionId}/payments`, { method: 'POST', body: pay }).then(() => { setPay({ method: 'cash', amount: '', reference: '' }); st.reload(true); }), 'Payment recorded'); }}>
          <h3>Record payment</h3>
          <div class="row">${['cash', 'upi', 'card'].map((m) => html`<label class="check"><input type="radio" name="m" checked=${pay.method === m} onChange=${() => setPay({ ...pay, method: m })} />${m.toUpperCase()}</label>`)}</div>
          <label class="field">Amount (₹) <span class="hint">Leave empty for the full outstanding ${money(b.outstanding)}</span><input type="number" step="0.01" min="0.01" value=${pay.amount} onInput=${(e) => setPay({ ...pay, amount: e.target.value })} /></label>
          <label class="field">${pay.method === 'upi' ? 'UPI reference (UTR) – required' : 'Reference (optional)'}<input required=${pay.method === 'upi'} value=${pay.reference} onInput=${(e) => setPay({ ...pay, reference: e.target.value })} /></label>
          <button class="btn ok lg" disabled=${!!busy || b.pending_orders > 0}>${busy === 'pay' ? html`<${Spinner} />` : null} Confirm payment received</button>
          <p class="small muted">Recording a payment here is your confirmation as cashier that the money was received.</p></form>` : null}
        ${open && b.status !== 'paid' && can('billing.discount') ? html`<form class="card flat form" onSubmit=${(e) => { e.preventDefault(); run('disc', () => api(`/api/staff/sessions/${sessionId}/discount`, { method: 'POST', body: disc }).then(() => st.reload(true)), 'Discount applied'); }}>
          <h3>Discount</h3>
          ${!can('billing.discount_unlimited') ? html`<p class="small muted">Cashier limit: ${branch?.max_cashier_discount_pct}% of the subtotal.</p>` : null}
          <div class="row"><select value=${disc.type} onChange=${(e) => setDisc({ ...disc, type: e.target.value })}><option value="percent">Percent %</option><option value="flat">Flat ₹</option><option value="none">Remove discount</option></select>
            ${disc.type !== 'none' ? html`<input type="number" step="0.01" min="0" placeholder="Value" required value=${disc.value} onInput=${(e) => setDisc({ ...disc, value: e.target.value })} />` : null}</div>
          ${disc.type !== 'none' ? html`<input placeholder="Reason (required, audited)" required value=${disc.reason} onInput=${(e) => setDisc({ ...disc, reason: e.target.value })} />` : null}
          <button class="btn" disabled=${!!busy}>Apply</button></form>` : null}
      </div>
    </div>
    ${refund ? html`<${RefundModal} payment=${refund} onClose=${() => setRefund(null)} onDone=${() => st.reload(true)} />` : null}
  </${Modal}>`;
}

function RefundModal({ payment: p, onClose, onDone }) {
  const [amount, setAmount] = useState(((p.amount - p.refunded_amount) / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useLoad(() => api(`/api/staff/payments/${p.id}/refunds`).then((d) => d.refunds), [p.id]);
  return html`<${Modal} title=${`Refund ${p.method.toUpperCase()} payment`} onClose=${onClose}>
    <p>Paid ${money(p.amount)} · already refunded ${money(p.refunded_amount)}</p>
    ${p.method === 'online' ? html`<p class="small muted">The refund is sent to the payment gateway${p.provider_mode === 'test' ? ' (TEST MODE – simulated)' : ''}.</p>` : html`<p class="small muted">Return the money to the guest (${p.method}) and record it here.</p>`}
    <form class="form" onSubmit=${async (e) => { e.preventDefault(); setBusy(true); try { await api(`/api/staff/payments/${p.id}/refund`, { method: 'POST', body: { amount, reason } }); toast('Refund recorded', 'ok'); onDone(); onClose(); } catch (x) { toast(x.message, 'bad'); } finally { setBusy(false); } }}>
      <label class="field">Amount (₹)<input type="number" step="0.01" min="0.01" max=${(p.amount - p.refunded_amount) / 100} required value=${amount} onInput=${(e) => setAmount(e.target.value)} /></label>
      <label class="field">Reason (required, audited)<input required minlength="3" value=${reason} onInput=${(e) => setReason(e.target.value)} /></label>
      <button class="btn danger lg" disabled=${busy}>Issue refund</button></form>
    ${history.data?.length ? html`<h3 class="mt">Refund history</h3>${history.data.map((r) => html`<div class="small">${new Date(r.created_at).toLocaleString()} · ${money(r.amount)} · ${r.reason} · by ${r.by_name} <span class="badge">${r.status}</span></div>`)}` : null}
  </${Modal}>`;
}

// =========================================================================== ORDERS (manager)
export function OrdersPage() {
  const { branchId, branch, can } = useCtx();
  const [scope, setScope] = useState('active');
  const st = useLoad(() => api(`/api/staff/branches/${branchId}/orders?scope=${scope}`).then((d) => d.orders), [branchId, scope]);
  const [cancel, setCancel] = useState(null);
  useBranchEvents((n) => { if (['resync', 'order.new', 'order.updated'].includes(n)) st.reload(true); });
  return html`<div>
    <div class="topbar"><h1>Orders · ${branch?.name}</h1>
      <div class="tabs" style="margin:0;border:0">${[['active', 'Active'], ['recent', 'Last 24 hours']].map(([k, l]) => html`<button class=${scope === k ? 'active' : ''} onClick=${() => setScope(k)}>${l}</button>`)}</div></div>
    ${st.error ? html`<${ErrorBox} error=${st.error} onRetry=${() => st.reload()} />` : null}
    ${st.loading && !st.data ? html`<${Loading} />` : !st.data.length ? html`<${Empty} icon="🧾" title="No orders" />` : html`<div class="card pad-0 table-wrap"><table class="data">
      <thead><tr><th>#</th><th>Table</th><th>Time</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
      ${st.data.map((o) => html`<tr><td><b>#${o.order_no}</b></td><td>${o.table_number}</td><td>${clock(o.created_at)}<div class="small muted">${timeAgo(o.created_at)}</div></td>
        <td>${o.items.map((i) => html`<div>${i.qty}× ${i.name}${i.options.length ? html` <span class="small muted">(${i.options.map((x) => x.name).join(', ')})</span>` : null}${i.instructions ? html` <i class="small">“${i.instructions}”</i>` : null}</div>`)}${o.note ? html`<div class="small">📝 ${o.note}</div>` : null}</td>
        <td>${money(o.subtotal)}</td><td><${StatusBadge} status=${o.status} />${o.cancel_reason ? html`<div class="small muted">${o.cancel_reason}</div>` : null}</td>
        <td class="right nowrap">${can('orders.cancel') && ACTIVE.includes(o.status) ? html`<button class="btn sm" onClick=${() => setCancel(o)}>Cancel</button>` : null}
          <button class="btn sm ghost" onClick=${() => printKot(o, branch?.name)}>🖨️</button></td></tr>`)}
    </tbody></table></div>`}
    ${cancel ? html`<${ReasonModal} title=${`Cancel order #${cancel.order_no}`} confirm="Cancel order" presets=${['Customer request', 'Item unavailable', 'Entered by mistake']}
      onClose=${() => setCancel(null)} onSubmit=${(reason) => api(`/api/staff/orders/${cancel.id}/cancel`, { method: 'POST', body: { reason } }).then(() => st.reload(true))} />` : null}
  </div>`;
}
