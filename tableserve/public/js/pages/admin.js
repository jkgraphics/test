// Owner / restaurant admin pages.
import { html, useState, useEffect, api, toast, money, Modal, Diet, Spinner, Loading, Empty, ErrorBox, useLoad, useAction, timeAgo, fileToDataUrl } from '../lib.js';
import { useCtx, Link } from '../core.js';

const ALLERGENS = ['gluten', 'dairy', 'nuts', 'peanuts', 'soy', 'egg', 'fish', 'shellfish', 'sesame', 'mustard', 'celery', 'sulphites'];
const rupees = (paise) => (paise == null ? '' : String(paise / 100));
const Stat = ({ label, value, sub }) => html`<div class="card stat"><span class="label">${label}</span><span class="value">${value}</span>${sub ? html`<span class="sub">${sub}</span>` : null}</div>`;

// =========================================================================== DASHBOARD
export function DashboardPage() {
  const { ctx, branch, can } = useCtx();
  const today = new Date().toISOString().slice(0, 10);
  const rep = useLoad(() => api(`/api/manage/reports?from=${today}&to=${today}`), []);
  const week = useLoad(() => api(`/api/manage/reports?from=${new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)}&to=${today}`), []);
  return html`<div>
    <div class="topbar"><div><h1>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</h1><p class="muted" style="margin:0">${ctx.company.name} · ${ctx.role_label}</p></div>
      <div class="row wrap">${can('orders.kitchen') ? html`<${Link} class="btn" href="/app/kitchen">👨‍🍳 Kitchen</${Link}>` : null}<${Link} class="btn" href="/app/floor">🪑 Tables</${Link}><${Link} class="btn primary" href="/app/billing">💳 Billing</${Link}></div></div>
    ${rep.loading ? html`<${Loading} />` : rep.error ? html`<${ErrorBox} error=${rep.error} onRetry=${() => rep.reload()} />` : html`
    <h3>Today</h3>
    <div class="grid cols-4">
      <${Stat} label="Paid revenue" value=${money(rep.data.summary.paid_revenue)} sub=${rep.data.summary.test_mode_revenue ? `incl. ${money(rep.data.summary.test_mode_revenue)} test-mode` : `${rep.data.summary.payments} payments`} />
      <${Stat} label="Orders" value=${rep.data.summary.orders} sub=${`${rep.data.summary.cancelled_orders} cancelled`} />
      <${Stat} label="Outstanding" value=${money(rep.data.summary.outstanding)} sub=${`${rep.data.summary.outstanding_bills} open bills`} />
      <${Stat} label="Avg. bill value" value=${money(rep.data.summary.average_bill_value)} sub=${`${rep.data.summary.settled_bills} bills settled`} />
    </div>`}
    ${week.data ? html`<div class="grid cols-2 mt">
      <div class="card"><h3>Last 7 days</h3><${Bars} series=${week.data.series} /></div>
      <div class="card"><h3>Top dishes this week</h3>${week.data.best_sellers.slice(0, 6).map((b) => html`<div class="row between small" style="padding:4px 0"><span>${b.name}</span><b>${b.qty}</b></div>`)}${!week.data.best_sellers.length ? html`<p class="muted">No sales yet.</p>` : null}</div>
    </div>` : null}
    ${branch ? html`<div class="card mt"><h3>Customer QR link for ${branch.name}</h3><p class="small muted">Print table QR codes from <${Link} href="/app/tables">Tables & QR</${Link}>. Each code opens the menu for that exact table.</p></div>` : null}
  </div>`;
}

function Bars({ series, value = (s) => s.revenue }) {
  if (!series.length) return html`<p class="muted">No data for this period.</p>`;
  const max = Math.max(...series.map(value), 1);
  return html`<div class="bars" role="img" aria-label="Sales chart">${series.map((s) => html`<div class="bar" style=${`height:${Math.max(2, (value(s) / max) * 100)}%`} title=${`${s.period}: ${money(value(s))}`}></div>`)}</div>
    <div class="bars-x">${series.map((s) => html`<span>${s.period.slice(5)}</span>`)}</div>`;
}

// =========================================================================== MENU
export function MenuPage() {
  const { branchId, branch, ctx } = useCtx();
  const st = useLoad(() => api(`/api/staff/branches/${branchId}/menu`), [branchId]);
  const [edit, setEdit] = useState(null);
  const [catEdit, setCatEdit] = useState(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, run] = useAction();
  if (st.loading && !st.data) return html`<${Loading} />`;
  if (st.error) return html`<${ErrorBox} error=${st.error} onRetry=${() => st.reload()} />`;
  const { categories, items } = st.data;
  const visible = items.filter((i) => i.active && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  const toggleStock = (i) => run(`s${i.id}`, () => api(`/api/staff/menu-items/${i.id}/stock`, { method: 'POST', body: { in_stock: !i.in_stock } }).then(() => st.reload(true)));
  return html`<div>
    <div class="topbar"><h1>Menu · ${branch?.name}</h1>
      <div class="row wrap"><input type="search" placeholder="Search" value=${q} onInput=${(e) => setQ(e.target.value)} style="width:200px" />
        ${ctx.branches.length > 1 ? html`<button class="btn" onClick=${() => setCopyOpen(true)}>Copy from branch</button>` : null}
        <button class="btn" onClick=${() => setCatEdit({})}>+ Category</button><button class="btn primary" onClick=${() => setEdit({})}>+ Dish</button></div></div>
    <p class="small muted">Changes appear on customer phones within seconds. Existing orders keep the price they were placed at; printed QR codes keep working.</p>
    ${!categories.length && !items.length ? html`<${Empty} icon="📖" title="Your menu is empty">Add a category, then add dishes.</${Empty}>` : null}
    ${[...categories, { id: null, name: 'Uncategorised' }].map((c) => {
      const list = visible.filter((i) => (i.category_id ?? null) === c.id);
      if (!list.length && c.id === null) return null;
      return html`<div class="card mb pad-0">
        <div class="row between" style="padding:14px 18px;border-bottom:1px solid var(--line)"><h3 style="margin:0">${c.name} ${c.name_hi ? html`<span class="muted small">· ${c.name_hi}</span>` : null} ${c.active === 0 ? html`<span class="badge">hidden</span>` : null}</h3>
          ${c.id ? html`<button class="btn sm ghost" onClick=${() => setCatEdit(c)}>Edit</button>` : null}</div>
        ${!list.length ? html`<p class="muted small" style="padding:12px 18px">No dishes.</p>` : html`<div class="table-wrap"><table class="data"><tbody>${list.map((i) => html`<tr>
          <td style="width:56px">${i.image_url ? html`<img src=${i.image_url} alt="" style="width:48px;height:40px;object-fit:cover;border-radius:8px" />` : null}</td>
          <td><div class="row" style="gap:6px"><${Diet} diet=${i.diet} /><b>${i.name}</b>${i.is_popular ? html`<span class="badge brand">Popular</span>` : null}${i.is_special ? html`<span class="badge warn">Special</span>` : null}${i.is_combo ? html`<span class="badge info">Combo</span>` : null}</div>
            <div class="small muted">${i.name_hi}${i.options.length ? ` · ${i.options.map((g) => g.name).join(', ')}` : ''}</div></td>
          <td class="nowrap">${money(i.price)}</td>
          <td><label class="check"><input type="checkbox" checked=${i.in_stock} disabled=${!!busy} onChange=${() => toggleStock(i)} />${i.in_stock ? 'In stock' : html`<span class="error-text">Out of stock</span>`}</label></td>
          <td class="right"><button class="btn sm" onClick=${() => setEdit(i)}>Edit</button></td></tr>`)}</tbody></table></div>`}
      </div>`;
    })}
    ${edit ? html`<${ItemEditor} item=${edit} categories=${categories} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); st.reload(true); }} />` : null}
    ${catEdit ? html`<${CategoryEditor} cat=${catEdit} onClose=${() => setCatEdit(null)} onSaved=${() => { setCatEdit(null); st.reload(true); }} />` : null}
    ${copyOpen ? html`<${CopyMenu} onClose=${() => setCopyOpen(false)} onDone=${() => { setCopyOpen(false); st.reload(true); }} />` : null}
  </div>`;
}

function CopyMenu({ onClose, onDone }) {
  const { ctx, branchId } = useCtx();
  const others = ctx.branches.filter((b) => b.id !== branchId);
  const [from, setFrom] = useState(others[0]?.id);
  const [busy, run] = useAction();
  return html`<${Modal} title="Copy menu from another branch" onClose=${onClose}>
    <p class="muted">All categories and dishes from the chosen branch are added to this branch. You can edit them independently afterwards.</p>
    <select value=${from} onChange=${(e) => setFrom(Number(e.target.value))}>${others.map((b) => html`<option value=${b.id}>${b.name}</option>`)}</select>
    <button class="btn primary mt" disabled=${!!busy} onClick=${() => run('c', () => api(`/api/manage/branches/${branchId}/copy-menu`, { method: 'POST', body: { from_branch_id: from } }).then(onDone), 'Menu copied')}>Copy menu</button></${Modal}>`;
}

function CategoryEditor({ cat, onClose, onSaved }) {
  const { branchId } = useCtx();
  const [f, setF] = useState({ name: cat.name || '', name_hi: cat.name_hi || '', sort: cat.sort ?? 0, active: cat.active ?? 1 });
  const [busy, run] = useAction();
  const save = (e) => { e.preventDefault(); run('save', () => (cat.id ? api(`/api/manage/categories/${cat.id}`, { method: 'PUT', body: f }) : api(`/api/manage/branches/${branchId}/categories`, { method: 'POST', body: f })).then(onSaved), 'Saved'); };
  return html`<${Modal} title=${cat.id ? 'Edit category' : 'New category'} onClose=${onClose}><form class="form" onSubmit=${save}>
    <label class="field">Name (English)<input required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></label>
    <label class="field">Name (Hindi)<input value=${f.name_hi} onInput=${(e) => setF({ ...f, name_hi: e.target.value })} /></label>
    <label class="field">Sort order<input type="number" value=${f.sort} onInput=${(e) => setF({ ...f, sort: e.target.value })} /></label>
    <label class="check"><input type="checkbox" checked=${!!f.active} onChange=${(e) => setF({ ...f, active: e.target.checked ? 1 : 0 })} /> Visible to customers</label>
    <div class="row"><button class="btn primary" disabled=${!!busy}>Save</button>
      ${cat.id ? html`<button type="button" class="btn danger" disabled=${!!busy} onClick=${() => confirm('Delete this category?') && run('del', () => api(`/api/manage/categories/${cat.id}`, { method: 'DELETE' }).then(onSaved), 'Deleted')}>Delete</button>` : null}</div>
  </form></${Modal}>`;
}

function ItemEditor({ item, categories, onClose, onSaved }) {
  const { branchId } = useCtx();
  const [f, setF] = useState(() => ({
    name: item.name || '', name_hi: item.name_hi || '', description: item.description || '', description_hi: item.description_hi || '',
    price: rupees(item.price ?? 0), category_id: item.category_id ?? categories[0]?.id ?? '', image_url: item.image_url || '', portion_size: item.portion_size || '',
    diet: item.diet || 'veg', ingredients: item.ingredients || '', allergens: item.allergens || [], spice_level: item.spice_level ?? 0, taste_notes: item.taste_notes || '',
    is_popular: !!item.is_popular, is_special: !!item.is_special, is_combo: !!item.is_combo, combo_details: item.combo_details || '', prep_minutes: item.prep_minutes ?? '',
    in_stock: item.in_stock ?? true, active: item.active ?? true, sort: item.sort ?? 0,
    options: (item.options || []).map((g) => ({ ...g, choices: g.choices.map((c) => ({ ...c, price: rupees(c.price) })) })),
  }));
  const [busy, run] = useAction();
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setGroup = (gi, patch) => setF({ ...f, options: f.options.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  const setChoice = (gi, ci, patch) => setGroup(gi, { choices: f.options[gi].choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) { toast('Image must be smaller than 2.5 MB', 'bad'); return; }
    run('up', async () => { const r = await api('/api/manage/uploads', { method: 'POST', body: { data: await fileToDataUrl(file) } }); setF((x) => ({ ...x, image_url: r.url })); }, 'Image uploaded');
  }
  function save(e) {
    e.preventDefault(); setErr(null);
    const body = { ...f, category_id: f.category_id || null, prep_minutes: f.prep_minutes === '' ? null : Number(f.prep_minutes) };
    run('save', async () => {
      try { await (item.id ? api(`/api/manage/items/${item.id}`, { method: 'PUT', body }) : api(`/api/manage/branches/${branchId}/items`, { method: 'POST', body })); onSaved(); } catch (x) { setErr(x.message); throw x; }
    }, 'Dish saved');
  }
  return html`<${Modal} title=${item.id ? `Edit ${item.name}` : 'New dish'} onClose=${onClose} wide><form class="form" onSubmit=${save}>
    <div class="row wrap"><label class="field grow">Name (English)<input required maxlength="80" value=${f.name} onInput=${set('name')} /></label><label class="field grow">Name (Hindi)<input maxlength="80" value=${f.name_hi} onInput=${set('name_hi')} /></label></div>
    <div class="row wrap"><label class="field grow">Description (English)<textarea maxlength="500" value=${f.description} onInput=${set('description')}></textarea></label><label class="field grow">Description (Hindi)<textarea maxlength="500" value=${f.description_hi} onInput=${set('description_hi')}></textarea></label></div>
    <div class="row wrap">
      <label class="field">Base price (₹)<input type="number" step="0.01" min="0" required value=${f.price} onInput=${set('price')} /><span class="hint">Option prices are added on top.</span></label>
      <label class="field">Category<select value=${f.category_id} onChange=${set('category_id')}><option value="">— none —</option>${categories.map((c) => html`<option value=${c.id}>${c.name}</option>`)}</select></label>
      <label class="field">Diet<select value=${f.diet} onChange=${set('diet')}><option value="veg">Vegetarian</option><option value="vegan">Vegan</option><option value="egg">Contains egg</option><option value="nonveg">Non-vegetarian</option></select></label>
      <label class="field">Spice level<select value=${f.spice_level} onChange=${set('spice_level')}><option value="0">0 – Not spicy</option><option value="1">1 – Mild</option><option value="2">2 – Medium</option><option value="3">3 – Hot</option></select></label>
    </div>
    <div class="row wrap"><label class="field grow">Portion size<input value=${f.portion_size} placeholder="e.g. 6 pieces / serves 2" onInput=${set('portion_size')} /></label>
      <label class="field grow">Taste notes<input value=${f.taste_notes} placeholder="Smoky, tangy" onInput=${set('taste_notes')} /></label>
      <label class="field">Prep time (min)<input type="number" min="1" max="240" value=${f.prep_minutes} onInput=${set('prep_minutes')} /></label></div>
    <label class="field">Ingredients (as provided by the restaurant)<input value=${f.ingredients} onInput=${set('ingredients')} /></label>
    <fieldset class="card flat"><legend><b>Allergens</b></legend><div class="row wrap">${ALLERGENS.map((a) => html`<label class="check"><input type="checkbox" checked=${f.allergens.includes(a)} onChange=${(e) => setF({ ...f, allergens: e.target.checked ? [...f.allergens, a] : f.allergens.filter((x) => x !== a) })} />${a}</label>`)}</div></fieldset>
    <div class="row wrap">
      <label class="field grow">Photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange=${upload} /></label>
      ${f.image_url ? html`<img src=${f.image_url} alt="" style="width:96px;height:72px;object-fit:cover;border-radius:10px" /><button type="button" class="btn sm" onClick=${() => setF({ ...f, image_url: '' })}>Remove photo</button>` : null}</div>
    <div class="row wrap">${[['is_popular', 'Popular'], ['is_special', "Chef's special"], ['is_combo', 'Combo meal'], ['in_stock', 'In stock'], ['active', 'Show on menu']].map(([k, l]) => html`<label class="check"><input type="checkbox" checked=${!!f[k]} onChange=${set(k)} />${l}</label>`)}</div>
    ${f.is_combo ? html`<label class="field">Combo includes<input value=${f.combo_details} onInput=${set('combo_details')} /></label>` : null}

    <h3 class="mt">Options & add-ons</h3>
    <p class="small muted">e.g. a required “Portion” group with Half / Full, or an optional “Add-ons” group with extra cheese. Prices are extra amounts in ₹.</p>
    ${f.options.map((g, gi) => html`<div class="card flat">
      <div class="row wrap"><input style="flex:2" required placeholder="Group name (e.g. Portion)" value=${g.name} onInput=${(e) => setGroup(gi, { name: e.target.value })} />
        <input style="flex:2" placeholder="Hindi name" value=${g.name_hi || ''} onInput=${(e) => setGroup(gi, { name_hi: e.target.value })} />
        <select style="flex:1" value=${g.type} onChange=${(e) => setGroup(gi, { type: e.target.value })}><option value="single">Pick one</option><option value="multi">Pick many</option></select>
        <label class="check"><input type="checkbox" checked=${!!g.required} onChange=${(e) => setGroup(gi, { required: e.target.checked })} />Required</label>
        ${g.type === 'multi' ? html`<input type="number" min="1" style="width:90px" placeholder="Max" value=${g.max || ''} onInput=${(e) => setGroup(gi, { max: e.target.value })} />` : null}
        <button type="button" class="btn sm ghost" onClick=${() => setF({ ...f, options: f.options.filter((_, i) => i !== gi) })}>Remove group</button></div>
      ${g.choices.map((c, ci) => html`<div class="row wrap mt-s" style="padding-left:16px">
        <input style="flex:2" required placeholder="Choice (e.g. Full)" value=${c.name} onInput=${(e) => setChoice(gi, ci, { name: e.target.value })} />
        <input style="flex:2" placeholder="Hindi" value=${c.name_hi || ''} onInput=${(e) => setChoice(gi, ci, { name_hi: e.target.value })} />
        <input style="flex:1" type="number" step="0.01" placeholder="+₹" value=${c.price} onInput=${(e) => setChoice(gi, ci, { price: e.target.value })} />
        <label class="check"><input type="checkbox" checked=${c.in_stock !== false} onChange=${(e) => setChoice(gi, ci, { in_stock: e.target.checked })} />In stock</label>
        <button type="button" class="btn sm ghost" aria-label="Remove choice" onClick=${() => setGroup(gi, { choices: g.choices.filter((_, i) => i !== ci) })}>✕</button></div>`)}
      <button type="button" class="btn sm mt-s" onClick=${() => setGroup(gi, { choices: [...g.choices, { id: `c${Date.now()}`, name: '', name_hi: '', price: '0', in_stock: true }] })}>+ Choice</button>
    </div>`)}
    <button type="button" class="btn" onClick=${() => setF({ ...f, options: [...f.options, { id: `g${Date.now()}`, name: '', name_hi: '', type: 'single', required: false, choices: [{ id: `c${Date.now()}`, name: '', price: '0', in_stock: true }] }] })}>+ Option group</button>
    ${err ? html`<div class="alert bad" role="alert">${err}</div>` : null}
    <div class="row"><button class="btn primary lg" disabled=${!!busy}>${busy === 'save' ? html`<${Spinner} />` : null} Save dish</button>
      ${item.id ? html`<button type="button" class="btn danger" disabled=${!!busy} onClick=${() => confirm('Remove this dish from the menu? Past orders are not affected.') && run('del', () => api(`/api/manage/items/${item.id}`, { method: 'DELETE' }).then(onSaved), 'Dish removed')}>Remove dish</button>` : null}</div>
  </form></${Modal}>`;
}

// =========================================================================== TABLES & QR
export function TablesPage() {
  const { branchId, branch } = useCtx();
  const st = useLoad(() => api(`/api/manage/branches/${branchId}/tables`).then((d) => d.tables), [branchId]);
  const staff = useLoad(() => api('/api/manage/staff').then((d) => d.staff).catch(() => []), []);
  const [edit, setEdit] = useState(null);
  const [qr, setQr] = useState(null);
  return html`<div>
    <div class="topbar"><h1>Tables & QR codes · ${branch?.name}</h1>
      <div class="row"><a class="btn" href=${`/api/manage/branches/${branchId}/qr-sheet`} target="_blank" rel="noopener">🖨️ Print all QR codes</a><button class="btn primary" onClick=${() => setEdit({})}>+ Table</button></div></div>
    <p class="small muted">Each table has a permanent QR code. Changing dishes, prices or table details never changes the code. Use “Replace QR” only if a code is being misused.</p>
    ${st.loading && !st.data ? html`<${Loading} />` : st.error ? html`<${ErrorBox} error=${st.error} onRetry=${() => st.reload()} />` : !st.data.length ? html`<${Empty} icon="🔳" title="No tables yet">Add your first table to generate its QR code.</${Empty}>` : html`
    <div class="card pad-0 table-wrap"><table class="data"><thead><tr><th>Table</th><th>Section</th><th>Seats</th><th>Waiter</th><th>Status</th><th></th></tr></thead><tbody>
      ${st.data.map((t) => html`<tr style=${t.active ? '' : 'opacity:.5'}><td><b>${t.number}</b></td><td>${t.section || '—'}</td><td>${t.capacity}</td><td>${t.assigned_waiter?.name || '—'}</td>
        <td><span class="badge">${t.active ? t.status.replace('_', ' ') : 'inactive'}</span></td>
        <td class="right nowrap"><button class="btn sm" onClick=${() => setQr(t)}>QR code</button> <button class="btn sm ghost" onClick=${() => setEdit(t)}>Edit</button></td></tr>`)}</tbody></table></div>`}
    ${edit ? html`<${TableEditor} table=${edit} waiters=${(staff.data || []).filter((s) => s.status === 'active' && ['waiter', 'admin'].includes(s.role) && (s.branch_ids === 'all' || s.branch_ids.includes(branchId)))} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); st.reload(true); }} />` : null}
    ${qr ? html`<${QrModal} table=${qr} onClose=${() => setQr(null)} onRotated=${(t) => { setQr(t); st.reload(true); }} />` : null}
  </div>`;
}

function QrModal({ table: t, onClose, onRotated }) {
  const { branchId } = useCtx();
  const [busy, run] = useAction();
  const [v, setV] = useState(0);
  return html`<${Modal} title=${`Table ${t.number} QR code`} onClose=${onClose}>
    <div class="center"><img src=${`/api/manage/tables/${t.id}/qr.svg?v=${v}`} alt=${`QR code for table ${t.number}`} style="width:240px;height:240px" />
      <p class="small mono" style="word-break:break-all">${t.qr_url}</p></div>
    <div class="row wrap"><a class="btn primary" href=${`/api/manage/tables/${t.id}/qr.png`} download>⬇️ Download PNG</a>
      <a class="btn" href=${`/api/manage/branches/${branchId}/qr-sheet?table=${t.id}`} target="_blank" rel="noopener">🖨️ Print table card</a>
      <a class="btn ghost" href=${t.qr_url} target="_blank" rel="noopener">Open customer view</a></div>
    <hr class="sep" />
    <p class="small muted">Replace the QR only if the printed code is being abused. The old printed code will stop working immediately.</p>
    <button class="btn danger sm" disabled=${!!busy} onClick=${() => confirm('Replace this QR code? The current printed code will stop working.') && run('rot', () => api(`/api/manage/tables/${t.id}/rotate-qr`, { method: 'POST', body: {} }).then((r) => { setV(v + 1); onRotated(r.table); }), 'New QR code generated')}>Replace QR code</button>
  </${Modal}>`;
}

function TableEditor({ table, waiters, onClose, onSaved }) {
  const { branchId } = useCtx();
  const [f, setF] = useState({ number: table.number || '', capacity: table.capacity || 4, section: table.section || '', assigned_waiter_id: table.assigned_waiter?.id || '', active: table.active ?? 1 });
  const [busy, run] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value });
  return html`<${Modal} title=${table.id ? `Edit table ${table.number}` : 'New table'} onClose=${onClose}><form class="form" onSubmit=${(e) => { e.preventDefault(); run('s', () => (table.id ? api(`/api/manage/tables/${table.id}`, { method: 'PUT', body: f }) : api(`/api/manage/branches/${branchId}/tables`, { method: 'POST', body: f })).then(onSaved), 'Table saved'); }}>
    <div class="row"><label class="field">Table number / name<input required maxlength="20" value=${f.number} onInput=${set('number')} /></label><label class="field">Seats<input type="number" min="1" max="50" value=${f.capacity} onInput=${set('capacity')} /></label></div>
    <label class="field">Floor / section (optional)<input maxlength="40" value=${f.section} placeholder="Indoor, Terrace, First floor…" onInput=${set('section')} /></label>
    ${table.id ? html`<label class="field">Assigned waiter<select value=${f.assigned_waiter_id} onChange=${set('assigned_waiter_id')}><option value="">— none —</option>${waiters.map((w) => html`<option value=${w.user_id}>${w.name}</option>`)}</select></label>
      <label class="check"><input type="checkbox" checked=${!!f.active} onChange=${set('active')} /> Active</label>` : null}
    <button class="btn primary lg" disabled=${!!busy}>Save</button></form></${Modal}>`;
}

// =========================================================================== STAFF
const ROLES = { admin: 'Restaurant admin / branch manager', kitchen: 'Kitchen staff', waiter: 'Waiter', cashier: 'Cashier', owner: 'Owner' };
export function StaffPage() {
  const { ctx, can, me } = useCtx();
  const st = useLoad(() => api('/api/manage/staff'), []);
  const [invite, setInvite] = useState(false);
  const [edit, setEdit] = useState(null);
  const [busy, run] = useAction();
  const bname = (id) => ctx.branches.find((b) => b.id === id)?.name || `#${id}`;
  return html`<div>
    <div class="topbar"><h1>Staff</h1><button class="btn primary" onClick=${() => setInvite(true)}>+ Invite staff</button></div>
    ${st.loading && !st.data ? html`<${Loading} />` : st.error ? html`<${ErrorBox} error=${st.error} />` : html`
    <div class="card pad-0 table-wrap"><table class="data"><thead><tr><th>Name</th><th>Role</th><th>Branches</th><th>Status</th><th></th></tr></thead><tbody>
      ${st.data.staff.map((s) => html`<tr><td><b>${s.name}</b><div class="small muted">${s.email}</div></td><td>${s.role_label}</td>
        <td>${s.branch_ids === 'all' ? 'All branches' : s.branch_ids.map(bname).join(', ') || '—'}</td>
        <td><span class=${`badge ${s.status === 'active' ? 'ok' : ''}`}>${s.status}</span></td>
        <td class="right">${s.role !== 'owner' && s.user_id !== me.user.id && (s.role !== 'admin' || can('staff.manage_admins')) ? html`<button class="btn sm" onClick=${() => setEdit(s)}>Edit</button>` : null}</td></tr>`)}</tbody></table></div>
    ${st.data.invitations.length ? html`<div class="card mt"><h3>Pending invitations</h3>${st.data.invitations.map((i) => html`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)">
      <div>${i.email} · ${ROLES[i.role]} <div class="small muted">expires ${new Date(i.expires_at).toLocaleDateString()}</div></div>
      <button class="btn sm" disabled=${!!busy} onClick=${() => run('r', () => api(`/api/manage/invitations/${i.id}`, { method: 'DELETE' }).then(() => st.reload(true)), 'Invitation revoked')}>Revoke</button></div>`)}</div>` : null}`}
    ${invite ? html`<${InviteModal} onClose=${() => { setInvite(false); st.reload(true); }} />` : null}
    ${edit ? html`<${StaffEditor} s=${edit} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); st.reload(true); }} />` : null}
  </div>`;
}

function BranchPicker({ value, onChange }) {
  const { ctx } = useCtx();
  return html`<fieldset class="card flat"><legend><b>Branch access</b></legend><div class="row wrap">${ctx.branches.map((b) => html`<label class="check"><input type="checkbox" checked=${value.includes(b.id)} onChange=${(e) => onChange(e.target.checked ? [...value, b.id] : value.filter((x) => x !== b.id))} />${b.name}</label>`)}</div></fieldset>`;
}

function InviteModal({ onClose }) {
  const { can, branchId } = useCtx();
  const [f, setF] = useState({ email: '', role: 'waiter', branch_ids: [branchId] });
  const [link, setLink] = useState(null);
  const [busy, run] = useAction();
  return html`<${Modal} title="Invite a team member" onClose=${onClose}>
    ${link ? html`<div class="alert ok"><b>Invitation created.</b> Share this one-time link with ${f.email} (valid for 7 days):</div>
      <input class="mono mt-s" readonly value=${link} onFocus=${(e) => e.target.select()} />
      <div class="row mt-s"><button class="btn primary" onClick=${() => navigator.clipboard?.writeText(link).then(() => toast('Link copied', 'ok'))}>Copy link</button><button class="btn" onClick=${onClose}>Done</button></div>
      <p class="small muted mt-s">Automatic invitation emails need an email provider (SMTP) – see the README.</p>` : html`
    <form class="form" onSubmit=${(e) => { e.preventDefault(); run('i', () => api('/api/manage/invitations', { method: 'POST', body: f }).then((r) => setLink(r.invite_url))); }}>
      <label class="field">Email<input type="email" required value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} /></label>
      <label class="field">Role<select value=${f.role} onChange=${(e) => setF({ ...f, role: e.target.value })}>
        ${can('staff.manage_admins') ? html`<option value="admin">${ROLES.admin}</option>` : null}<option value="kitchen">${ROLES.kitchen}</option><option value="waiter">${ROLES.waiter}</option><option value="cashier">${ROLES.cashier}</option></select></label>
      <${BranchPicker} value=${f.branch_ids} onChange=${(v) => setF({ ...f, branch_ids: v })} />
      <button class="btn primary lg" disabled=${!!busy || !f.branch_ids.length}>Create invitation</button></form>`}
  </${Modal}>`;
}

function StaffEditor({ s, onClose, onSaved }) {
  const { can } = useCtx();
  const [f, setF] = useState({ role: s.role, branch_ids: s.branch_ids === 'all' ? [] : s.branch_ids, status: s.status });
  const [busy, run] = useAction();
  return html`<${Modal} title=${`Edit ${s.name}`} onClose=${onClose}><form class="form" onSubmit=${(e) => { e.preventDefault(); run('s', () => api(`/api/manage/staff/${s.id}`, { method: 'PUT', body: f }).then(onSaved), 'Saved'); }}>
    <label class="field">Role<select value=${f.role} onChange=${(e) => setF({ ...f, role: e.target.value })}>
      ${can('staff.manage_admins') ? html`<option value="admin">${ROLES.admin}</option>` : null}<option value="kitchen">${ROLES.kitchen}</option><option value="waiter">${ROLES.waiter}</option><option value="cashier">${ROLES.cashier}</option></select></label>
    <${BranchPicker} value=${f.branch_ids} onChange=${(v) => setF({ ...f, branch_ids: v })} />
    <label class="check"><input type="checkbox" checked=${f.status === 'active'} onChange=${(e) => setF({ ...f, status: e.target.checked ? 'active' : 'disabled' })} /> Account active (untick to remove access)</label>
    <button class="btn primary lg" disabled=${!!busy}>Save</button></form></${Modal}>`;
}

// =========================================================================== BRANCHES
export function BranchesPage() {
  const { can, reloadCtx } = useCtx();
  const st = useLoad(() => api('/api/manage/branches').then((d) => d.branches), []);
  const [edit, setEdit] = useState(null);
  return html`<div>
    <div class="topbar"><h1>Branches</h1>${can('branches.create') ? html`<button class="btn primary" onClick=${() => setEdit({})}>+ Branch</button>` : null}</div>
    ${st.loading && !st.data ? html`<${Loading} />` : html`<div class="grid cols-2">${(st.data || []).map((b) => html`<div class="card">
      <div class="row between"><h3 style="margin:0">${b.name}</h3>${b.active ? html`<span class="badge ok">Active</span>` : html`<span class="badge">Inactive</span>`}</div>
      <p class="small muted mt-s">${b.address || 'No address'} · ${b.phone || 'No phone'}</p>
      <div class="row wrap small"><span class="badge">${b.tables} tables</span><span class="badge">${b.items} dishes</span>${b.ordering_paused ? html`<span class="badge bad">Orders paused</span>` : null}
        <span class="badge">${b.self_start_sessions ? 'Guests can self-start tables' : 'Staff opens tables'}</span><span class="badge">Prep ${b.default_prep_minutes} min</span></div>
      <button class="btn sm mt" onClick=${() => setEdit(b)}>Edit settings</button></div>`)}</div>`}
    ${edit ? html`<${BranchEditor} b=${edit} branches=${st.data || []} onClose=${() => setEdit(null)} onSaved=${() => { setEdit(null); st.reload(true); reloadCtx(); }} />` : null}
  </div>`;
}

function BranchEditor({ b, branches, onClose, onSaved }) {
  const { can } = useCtx();
  const [f, setF] = useState({ name: b.name || '', address: b.address || '', phone: b.phone || '', opening_hours: b.opening_hours || '', self_start_sessions: !!b.self_start_sessions, default_prep_minutes: b.default_prep_minutes ?? 15, max_cashier_discount_pct: b.max_cashier_discount_pct ?? 10, copy_menu_from: '' });
  const [busy, run] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return html`<${Modal} title=${b.id ? `Edit ${b.name}` : 'New branch'} onClose=${onClose}><form class="form" onSubmit=${(e) => { e.preventDefault(); run('s', () => (b.id ? api(`/api/manage/branches/${b.id}`, { method: 'PUT', body: f }) : api('/api/manage/branches', { method: 'POST', body: { ...f, copy_menu_from: f.copy_menu_from || null } })).then(onSaved), 'Branch saved'); }}>
    <label class="field">Branch name<input required value=${f.name} onInput=${set('name')} /></label>
    <label class="field">Address<input value=${f.address} onInput=${set('address')} /></label>
    <div class="row"><label class="field">Phone<input value=${f.phone} onInput=${set('phone')} /></label><label class="field">Opening hours<input value=${f.opening_hours} onInput=${set('opening_hours')} /></label></div>
    <div class="row"><label class="field">Default prep time (min)<input type="number" min="1" max="240" value=${f.default_prep_minutes} onInput=${set('default_prep_minutes')} /></label>
      <label class="field">Cashier discount limit (%)<input type="number" min="0" max="100" step="0.5" value=${f.max_cashier_discount_pct} onInput=${set('max_cashier_discount_pct')} /></label></div>
    <label class="check"><input type="checkbox" checked=${f.self_start_sessions} onChange=${set('self_start_sessions')} /> Let the first guest at an idle table start the session from their phone</label>
    <p class="small muted">When off, staff must open the table (or approve the guest's phone) before anyone can order.</p>
    ${!b.id && branches.length ? html`<label class="field">Copy menu from<select value=${f.copy_menu_from} onChange=${set('copy_menu_from')}><option value="">— start empty —</option>${branches.map((x) => html`<option value=${x.id}>${x.name}</option>`)}</select></label>` : null}
    <div class="row"><button class="btn primary lg" disabled=${!!busy}>Save</button>
      ${b.id && can('branches.create') ? html`<button type="button" class="btn" disabled=${!!busy} onClick=${() => run('a', () => api(`/api/manage/branches/${b.id}/active`, { method: 'POST', body: { active: !b.active } }).then(onSaved))}>${b.active ? 'Deactivate' : 'Activate'}</button>` : null}</div>
  </form></${Modal}>`;
}

// =========================================================================== SETTINGS
export function SettingsPage() {
  const st = useLoad(() => api('/api/manage/company').then((d) => d.company), []);
  const [tab, setTab] = useState('profile');
  if (st.loading && !st.data) return html`<${Loading} />`;
  if (st.error) return html`<${ErrorBox} error=${st.error} />`;
  return html`<div><div class="topbar"><h1>Company & payments</h1></div>
    <div class="tabs">${[['profile', 'Profile & branding'], ['ordering', 'Ordering, tax & languages'], ['payments', 'Payment methods']].map(([k, l]) => html`<button class=${tab === k ? 'active' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</div>
    ${tab === 'payments' ? html`<${PaymentSettings} c=${st.data} onSaved=${(c) => st.setData(c)} />` : html`<${CompanyForm} c=${st.data} tab=${tab} onSaved=${(c) => st.setData(c)} />`}</div>`;
}

function CompanyForm({ c, tab, onSaved }) {
  const { reloadCtx } = useCtx();
  const [f, setF] = useState({ ...c, taxes: c.taxes.map((t) => ({ ...t })) });
  const [busy, run] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function upload(e) {
    const file = e.target.files[0]; if (!file) return;
    run('up', async () => { const r = await api('/api/manage/uploads', { method: 'POST', body: { data: await fileToDataUrl(file) } }); setF((x) => ({ ...x, logo_url: r.url })); }, 'Logo uploaded – remember to save');
  }
  const save = (e) => { e.preventDefault(); run('s', () => api('/api/manage/company', { method: 'PUT', body: f }).then((r) => { onSaved(r.company); reloadCtx(); }), 'Saved'); };
  return html`<form class="card form" onSubmit=${save} style="max-width:820px">
    ${tab === 'profile' ? html`
      <label class="field">Restaurant name<input required value=${f.name} onInput=${set('name')} /></label>
      <label class="field">Description<textarea value=${f.description} onInput=${set('description')}></textarea></label>
      <div class="row wrap"><label class="field grow">Phone<input value=${f.phone} onInput=${set('phone')} /></label><label class="field grow">Email<input value=${f.email} onInput=${set('email')} /></label></div>
      <label class="field">Address<input value=${f.address} onInput=${set('address')} /></label>
      <label class="field">Opening hours<input value=${f.opening_hours} onInput=${set('opening_hours')} placeholder="Mon–Sun 11:00–23:00" /></label>
      <div class="row wrap"><label class="field">Logo<input type="file" accept="image/*" onChange=${upload} /></label>${f.logo_url ? html`<img src=${f.logo_url} alt="" style="width:64px;height:64px;border-radius:12px;object-fit:cover" />` : null}
        <label class="field">Brand colour<input type="color" value=${f.brand_color} onInput=${set('brand_color')} style="width:80px;padding:4px" /></label></div>` : html`
      <fieldset class="card flat"><legend><b>Ordering mode</b></legend>
        <label class="check"><input type="radio" checked=${f.ordering_mode === 'ordering'} onChange=${() => setF({ ...f, ordering_mode: 'ordering' })} /> Menu with ordering – guests order from their phones</label>
        <label class="check"><input type="radio" checked=${f.ordering_mode === 'menu_only'} onChange=${() => setF({ ...f, ordering_mode: 'menu_only' })} /> Menu only – digital menu, staff take orders</label></fieldset>
      <fieldset class="card flat"><legend><b>Customer languages</b></legend><div class="row">${[['en', 'English'], ['hi', 'हिन्दी Hindi']].map(([k, l]) => html`<label class="check"><input type="checkbox" checked=${f.languages.includes(k)} onChange=${(e) => setF({ ...f, languages: e.target.checked ? [...f.languages, k] : f.languages.filter((x) => x !== k) })} />${l}</label>`)}</div></fieldset>
      <div class="row wrap"><label class="field">Currency<select value=${f.currency} onChange=${set('currency')}>${['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((x) => html`<option>${x}</option>`)}</select></label>
        <label class="field">Service charge (%)<input type="number" min="0" max="30" step="0.5" value=${f.service_charge_pct} onInput=${set('service_charge_pct')} /></label></div>
      <fieldset class="card flat"><legend><b>Taxes</b> <span class="small muted">applied to (subtotal − discount + service charge)</span></legend>
        ${f.taxes.map((t, i) => html`<div class="row mt-s"><input placeholder="Name (e.g. CGST)" value=${t.name} onInput=${(e) => setF({ ...f, taxes: f.taxes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
          <input type="number" step="0.01" min="0" max="50" placeholder="Rate %" value=${t.rate} onInput=${(e) => setF({ ...f, taxes: f.taxes.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)) })} />
          <button type="button" class="btn ghost" onClick=${() => setF({ ...f, taxes: f.taxes.filter((_, j) => j !== i) })}>✕</button></div>`)}
        <button type="button" class="btn sm mt-s" onClick=${() => setF({ ...f, taxes: [...f.taxes, { name: '', rate: 0 }] })}>+ Tax</button></fieldset>`}
    <button class="btn primary lg" disabled=${!!busy}>Save changes</button></form>`;
}

function PaymentSettings({ c, onSaved }) {
  const p = c.payment_settings;
  const [f, setF] = useState({ cash: p.cash, pay_at_counter: p.pay_at_counter, upi: p.upi, upi_vpa: p.upi_vpa, upi_payee: p.upi_payee, online: p.online, online_provider: p.online_provider, razorpay_key_id: p.razorpay_key_id, razorpay_key_secret: '', razorpay_webhook_secret: '' });
  const [busy, run] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return html`<div class="grid cols-2" style="align-items:start">
    <form class="card form" onSubmit=${(e) => { e.preventDefault(); run('s', () => api('/api/manage/company/payments', { method: 'PUT', body: f }).then((r) => { onSaved(r.company); setF((x) => ({ ...x, razorpay_key_secret: '', razorpay_webhook_secret: '' })); }), 'Payment settings saved'); }}>
      <h3>Accepted payment methods</h3>
      <label class="check"><input type="checkbox" checked=${f.cash} onChange=${set('cash')} /> Cash (recorded by cashier)</label>
      <label class="check"><input type="checkbox" checked=${f.pay_at_counter} onChange=${set('pay_at_counter')} /> Pay at counter (guest requests the bill)</label>
      <label class="check"><input type="checkbox" checked=${f.upi} onChange=${set('upi')} /> UPI to your UPI ID (cashier confirms each payment)</label>
      ${f.upi ? html`<div class="row"><label class="field">UPI ID<input value=${f.upi_vpa} placeholder="restaurant@okbank" onInput=${set('upi_vpa')} /></label><label class="field">Payee name<input value=${f.upi_payee} onInput=${set('upi_payee')} /></label></div>` : null}
      <label class="check"><input type="checkbox" checked=${f.online} onChange=${set('online')} /> Online payments (card / UPI / netbanking via gateway)</label>
      ${f.online ? html`<fieldset class="card flat"><legend><b>Gateway</b></legend>
        <label class="check"><input type="radio" checked=${f.online_provider === 'test'} onChange=${() => setF({ ...f, online_provider: 'test' })} /> <span>Test mode – simulated gateway <span class="badge test">TEST MODE</span></span></label>
        <label class="check"><input type="radio" checked=${f.online_provider === 'razorpay'} onChange=${() => setF({ ...f, online_provider: 'razorpay' })} /> Razorpay (your own account)</label>
        ${f.online_provider === 'razorpay' ? html`<div class="form mt-s">
          <label class="field">Key ID<input value=${f.razorpay_key_id} placeholder="rzp_live_…" onInput=${set('razorpay_key_id')} /></label>
          <label class="field">Key secret ${p.razorpay_key_secret_set ? html`<span class="hint">Saved (hidden). Leave blank to keep.</span>` : null}<input type="password" autocomplete="off" value=${f.razorpay_key_secret} onInput=${set('razorpay_key_secret')} /></label>
          <label class="field">Webhook secret ${p.razorpay_webhook_secret_set ? html`<span class="hint">Saved (hidden). Leave blank to keep.</span>` : null}<input type="password" autocomplete="off" value=${f.razorpay_webhook_secret} onInput=${set('razorpay_webhook_secret')} /></label>
          <label class="field">Webhook URL to configure in Razorpay<input readonly class="mono" value=${p.webhook_url} onFocus=${(e) => e.target.select()} /></label></div>` : null}
      </fieldset>` : null}
      <button class="btn primary lg" disabled=${!!busy}>Save payment settings</button>
    </form>
    <div class="card"><h3>How payments are confirmed</h3>
      <ul class="small" style="padding-left:18px">
        <li><b>Cash / card machine / UPI at the counter:</b> the cashier records it – that is the confirmation.</li>
        <li><b>Guest-reported UPI:</b> stays <i>pending</i> until a cashier checks the bank app and confirms. Screenshots are never accepted.</li>
        <li><b>Online:</b> marked paid only after a server-verified, signed notification from the gateway.</li>
        <li>Restaurant sales go to your own UPI / gateway account and are kept separate from your TableServe subscription.</li>
      </ul>
      <h3 class="mt">Going live with Razorpay</h3>
      <ol class="small" style="padding-left:18px">
        <li>Create and KYC-activate a Razorpay account.</li>
        <li>Dashboard → Settings → API Keys: generate a <b>live</b> key and paste Key ID & Key secret here.</li>
        <li>Dashboard → Settings → Webhooks: add the webhook URL above, choose events <i>payment.captured</i>, <i>payment.failed</i>, <i>order.paid</i>, set a secret and paste it here.</li>
        <li>Your server must be reachable over HTTPS at the configured <span class="mono">APP_URL</span>.</li>
      </ol>
      <p class="small muted">Currently effective online provider: <b>${p.effective_online || 'none (pay at counter)'}</b>${p.effective_online === 'test' ? ' – no real money moves.' : ''}</p>
    </div></div>`;
}

// =========================================================================== REPORTS
export function ReportsPage() {
  const { ctx } = useCtx();
  const iso = (d) => d.toISOString().slice(0, 10);
  const [q, setQ] = useState({ from: iso(new Date(Date.now() - 29 * 864e5)), to: iso(new Date()), group: 'day', branch_id: '' });
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
  const st = useLoad(() => api(`/api/manage/reports?${qs}`), [qs]);
  const preset = (days, group) => setQ({ ...q, from: iso(new Date(Date.now() - (days - 1) * 864e5)), to: iso(new Date()), group });
  const r = st.data;
  const maxBranch = r ? Math.max(1, ...r.branches.map((b) => b.revenue)) : 1;
  return html`<div>
    <div class="topbar"><h1>Reports</h1><a class="btn" href=${`/api/manage/reports/export.csv?${qs}`}>⬇️ Download CSV</a></div>
    <div class="card row wrap mb">
      <button class="btn sm" onClick=${() => preset(1, 'day')}>Today</button><button class="btn sm" onClick=${() => preset(7, 'day')}>7 days</button><button class="btn sm" onClick=${() => preset(30, 'day')}>30 days</button><button class="btn sm" onClick=${() => preset(84, 'week')}>12 weeks</button><button class="btn sm" onClick=${() => preset(365, 'month')}>12 months</button>
      <label class="field">From<input type="date" value=${q.from} onInput=${(e) => setQ({ ...q, from: e.target.value })} /></label>
      <label class="field">To<input type="date" value=${q.to} onInput=${(e) => setQ({ ...q, to: e.target.value })} /></label>
      <label class="field">Group by<select value=${q.group} onChange=${(e) => setQ({ ...q, group: e.target.value })}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
      <label class="field">Branch<select value=${q.branch_id} onChange=${(e) => setQ({ ...q, branch_id: e.target.value })}><option value="">All my branches</option>${ctx.branches.map((b) => html`<option value=${b.id}>${b.name}</option>`)}</select></label>
    </div>
    ${st.error ? html`<${ErrorBox} error=${st.error} onRetry=${() => st.reload()} />` : null}
    ${st.loading && !r ? html`<${Loading} />` : r ? html`
    <div class="grid cols-4">
      <${Stat} label="Paid revenue" value=${money(r.summary.paid_revenue)} sub=${r.summary.test_mode_revenue ? `incl. ${money(r.summary.test_mode_revenue)} test mode` : `${r.summary.payments} payments`} />
      <${Stat} label="Refunds" value=${money(r.summary.refunds)} sub=${`${r.summary.refund_count} refunds · net ${money(r.summary.net_revenue)}`} />
      <${Stat} label="Outstanding bills" value=${money(r.summary.outstanding)} sub=${`${r.summary.outstanding_bills} open`} />
      <${Stat} label="Average bill" value=${money(r.summary.average_bill_value)} sub=${`${r.summary.settled_bills} settled bills`} />
      <${Stat} label="Orders" value=${r.summary.orders} sub=${`${r.summary.cancelled_orders} cancelled`} />
    </div>
    <div class="card mt"><h3>Sales by ${r.range.group}</h3><${Bars} series=${r.series} /></div>
    <div class="grid cols-2 mt">
      <div class="card"><h3>Best-selling dishes</h3>${!r.best_sellers.length ? html`<p class="muted">No sales.</p>` : html`<table class="data"><thead><tr><th>Dish</th><th class="right">Qty</th><th class="right">Revenue</th></tr></thead><tbody>${r.best_sellers.map((b) => html`<tr><td>${b.name}</td><td class="right">${b.qty}</td><td class="right">${money(b.revenue)}</td></tr>`)}</tbody></table>`}</div>
      <div class="card"><h3>Branch comparison</h3>${r.branches.map((b) => html`<div class="mb"><div class="row between small"><b>${b.name}</b><span>${money(b.revenue)} · ${b.orders} orders · ${b.bills} bills</span></div><div class="hbar"><div style=${`width:${(b.revenue / maxBranch) * 100}%`}></div></div></div>`)}
        <h3 class="mt">By payment method</h3>${r.by_method.map((m) => html`<div class="row between small"><span>${m.method.toUpperCase()}</span><span>${money(m.total)} (${m.n})</span></div>`)}</div>
    </div>
    ${r.outstanding.length ? html`<div class="card mt"><h3>Outstanding bills</h3><table class="data"><thead><tr><th>Bill</th><th>Branch</th><th>Table</th><th class="right">Total</th><th class="right">Paid</th></tr></thead><tbody>
      ${r.outstanding.map((b) => html`<tr><td>#${b.bill_no}<div class="small muted">${timeAgo(b.created_at)}</div></td><td>${b.branch_name}</td><td>${b.table_number}</td><td class="right">${money(b.total)}</td><td class="right">${money(b.paid)}</td></tr>`)}</tbody></table></div>` : null}` : null}
  </div>`;
}

// =========================================================================== AUDIT / SUBSCRIPTION / SUPPORT
export function AuditPage() {
  const st = useLoad(() => api('/api/manage/audit').then((d) => d.entries), []);
  return html`<div><div class="topbar"><h1>Audit log</h1></div>
    <p class="small muted">Administrative actions, cancellations, discounts, refunds, payment confirmations and settings changes.</p>
    ${st.loading ? html`<${Loading} />` : html`<div class="card pad-0 table-wrap"><table class="data"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>
    ${st.data.map((a) => html`<tr><td class="nowrap">${new Date(a.created_at).toLocaleString()}</td><td>${a.actor_name || a.actor_label || '—'}</td><td><span class="badge">${a.action}</span></td>
      <td class="small mono" style="max-width:420px;word-break:break-word">${Object.entries(a.details || {}).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}</td></tr>`)}</tbody></table></div>`}</div>`;
}

export function SubscriptionPage() {
  const st = useLoad(() => api('/api/manage/subscription'), []);
  if (st.loading) return html`<${Loading} />`;
  if (st.error) return html`<${ErrorBox} error=${st.error} />`;
  const s = st.data;
  const cls = { trial: 'info', active: 'ok', expired: 'bad', suspended: 'bad' }[s.status];
  return html`<div><div class="topbar"><h1>Subscription</h1></div>
    <div class="grid cols-3">
      <div class="card stat"><span class="label">Plan</span><span class="value">${s.plan.name}</span><span class="sub"><span class=${`badge ${cls}`}>${s.status}</span> ${s.status === 'trial' && s.trial_ends_at ? `until ${new Date(s.trial_ends_at).toLocaleDateString()}` : s.current_period_end ? `renews ${new Date(s.current_period_end).toLocaleDateString()}` : ''}</span></div>
      ${['branches', 'tables', 'staff'].map((k) => html`<div class="card stat"><span class="label">${k}</span><span class="value">${s.usage[k]} / ${s.plan[`max_${k}`]}</span><div class="hbar"><div style=${`width:${Math.min(100, (s.usage[k] / s.plan[`max_${k}`]) * 100)}%`}></div></div></div>`)}
    </div>
    <h3 class="mt">Available plans</h3>
    <div class="grid cols-3">${s.plans.map((p) => html`<div class="card"><h3>${p.name}</h3><div class="stat"><span class="value">${money(p.price_monthly)}<small class="muted">/month</small></span><span class="sub">or ${money(p.price_annual)}/year</span></div>
      <ul class="small"><li>${p.max_branches} branches</li><li>${p.max_tables} tables</li><li>${p.max_staff} staff</li></ul>${p.id === s.plan.id ? html`<span class="badge ok">Current plan</span>` : null}</div>`)}</div>
    <p class="small muted mt">To change plan or pay your subscription, raise a support request – the TableServe team records platform payments. These are separate from your restaurant's sales.</p>
    ${s.payments.length ? html`<div class="card mt"><h3>Subscription payments</h3>${s.payments.map((p) => html`<div class="row between small"><span>${new Date(p.created_at).toLocaleDateString()} · ${p.period} · ${p.reference}</span><span>${money(p.amount)} <span class="badge ok">${p.status}</span></span></div>`)}</div>` : null}
  </div>`;
}

export function SupportPage() {
  const st = useLoad(() => api('/api/manage/support').then((d) => d.tickets), []);
  const [f, setF] = useState({ subject: '', body: '', priority: 'normal' });
  const [reply, setReply] = useState({});
  const [busy, run] = useAction();
  return html`<div><div class="topbar"><h1>Support</h1></div>
    <div class="grid cols-2" style="align-items:start">
      <form class="card form" onSubmit=${(e) => { e.preventDefault(); run('n', () => api('/api/manage/support', { method: 'POST', body: f }).then(() => { setF({ subject: '', body: '', priority: 'normal' }); st.reload(true); }), 'Request sent to TableServe support'); }}>
        <h3>New support request</h3>
        <label class="field">Subject<input required maxlength="120" value=${f.subject} onInput=${(e) => setF({ ...f, subject: e.target.value })} /></label>
        <label class="field">Message<textarea required value=${f.body} onInput=${(e) => setF({ ...f, body: e.target.value })}></textarea></label>
        <label class="field">Priority<select value=${f.priority} onChange=${(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        <button class="btn primary" disabled=${!!busy}>Send</button></form>
      <div class="col">${st.loading ? html`<${Loading} />` : !st.data.length ? html`<${Empty} icon="🛟" title="No requests yet" />` : st.data.map((t) => html`<div class="card">
        <div class="row between"><b>${t.subject}</b><span class=${`badge ${t.status === 'resolved' ? 'ok' : 'warn'}`}>${t.status.replace('_', ' ')}</span></div>
        ${t.messages.map((m) => html`<div class=${`small mt-s ${m.from_platform ? 'alert' : ''}`}><b>${m.from_platform ? 'TableServe support' : m.author}</b> · ${timeAgo(m.created_at)}<div>${m.body}</div></div>`)}
        <form class="row mt-s" onSubmit=${(e) => { e.preventDefault(); run(`r${t.id}`, () => api(`/api/manage/support/${t.id}/reply`, { method: 'POST', body: { body: reply[t.id] } }).then(() => { setReply({ ...reply, [t.id]: '' }); st.reload(true); })); }}>
          <input placeholder="Reply…" required value=${reply[t.id] || ''} onInput=${(e) => setReply({ ...reply, [t.id]: e.target.value })} /><button class="btn sm" disabled=${!!busy}>Send</button></form></div>`)}</div>
    </div></div>`;
}
