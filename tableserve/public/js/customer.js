// Customer app: opened by scanning a table QR code. No install or registration required.
import { html, render, useState, useEffect, useRef, useCallback, api, ApiError, money, uuid, toast, useStream, Modal, Diet, Spinner, Loading, Empty, ErrorBox, ORDER_STATUS, StatusBadge, clock, parseTime, useNow } from './lib.js';
import { STRINGS } from './i18n.js';

const QR = decodeURIComponent(location.pathname.split('/').pop());
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(`ts:${QR}:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(`ts:${QR}:${k}`) : localStorage.setItem(`ts:${QR}:${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};

const lineKey = (l) => `${l.item_id}|${JSON.stringify(l.selections)}|${l.instructions || ''}`;
const nm = (o, lang) => (lang === 'hi' && o?.name_hi) || o?.name || '';
const desc = (o, lang) => (lang === 'hi' && o?.description_hi) || o?.description || '';

function unitPrice(item, selections) {
  let p = item.price;
  for (const g of item.options || []) {
    const ids = [].concat(selections?.[g.id] || []);
    for (const id of ids) p += g.choices.find((c) => c.id === id)?.price || 0;
  }
  return p;
}
function minPrice(item) {
  let p = item.price;
  for (const g of item.options || []) if (g.required) p += Math.min(...g.choices.filter((c) => c.in_stock !== false).map((c) => c.price), Infinity) || 0;
  return p;
}

function App() {
  const [lang, setLang] = useState(LS.get('lang', (navigator.language || '').startsWith('hi') ? 'hi' : 'en'));
  const t = STRINGS[lang];
  const [info, setInfo] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [menu, setMenu] = useState(null);
  const [menuError, setMenuError] = useState(null);
  const [token, setToken] = useState(LS.get('token', null));
  const [sess, setSess] = useState(null);
  const [cart, setCart] = useState(LS.get('cart', []));
  const [tab, setTab] = useState('menu');
  const [sheet, setSheet] = useState(null);
  const [ended, setEnded] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const afterJoin = useRef(null);

  useEffect(() => { LS.set('lang', lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { LS.set('cart', cart); }, [cart]);
  useEffect(() => { LS.set('token', token); }, [token]);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const guestHeaders = token ? { 'X-Guest-Token': token } : {};
  const loadInfo = useCallback(async () => {
    try {
      const d = await api(`/api/public/t/${encodeURIComponent(QR)}`, { headers: guestHeaders });
      setInfo(d);
      if (d.company.brand_color) document.documentElement.style.setProperty('--brand', d.company.brand_color);
      document.title = `${d.company.name} · ${STRINGS[lang].table} ${d.table.number}`;
      if (token && !d.joined) dropSession(false);
    } catch (e) {
      if (e.status === 404) setFatal(t.notFound); else setFatal(e.message);
    }
  }, [token]);

  const loadMenu = useCallback(async () => {
    try {
      const m = await api(`/api/public/t/${encodeURIComponent(QR)}/menu`);
      setMenu(m); setMenuError(null);
      // Re-validate the cart against the fresh menu.
      setCart((c) => c.map((l) => {
        const it = m.items.find((i) => i.id === l.item_id);
        const bad = !it || !it.in_stock || (it.options || []).some((g) => [].concat(l.selections[g.id] || []).some((id) => { const ch = g.choices.find((x) => x.id === id); return !ch || ch.in_stock === false; }));
        return { ...l, unavailable: bad, unit: it ? unitPrice(it, l.selections) : l.unit, name: it?.name || l.name, name_hi: it?.name_hi || l.name_hi };
      }));
    } catch (e) { setMenuError(e.message); }
  }, []);

  const loadSession = useCallback(async () => {
    if (!token) { setSess(null); return; }
    try {
      setSess(await api(`/api/public/t/${encodeURIComponent(QR)}/session`, { headers: { 'X-Guest-Token': token } }));
    } catch (e) {
      if (e.status === 401) dropSession(true);
    }
  }, [token]);

  function dropSession(showEnded) {
    setToken(null); setSess(null); LS.set('pending', null);
    if (showEnded) { setEnded(true); setCart([]); }
  }

  useEffect(() => { loadInfo(); loadMenu(); }, []);
  useEffect(() => { loadSession(); }, [token]);

  // Payment return (?payment=ID) from the gateway.
  useEffect(() => {
    const p = new URLSearchParams(location.search).get('payment');
    if (p) { setTab('bill'); toast(t.checkingPayment); history.replaceState(null, '', location.pathname); }
  }, []);

  const connected = useStream(info ? `/api/public/t/${encodeURIComponent(QR)}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}` : null, {
    onOpen: () => { loadSession(); },
    'menu.updated': () => loadMenu(),
    'branch.updated': (d) => setInfo((i) => i && ({ ...i, branch: { ...i.branch, ordering_paused: d.ordering_paused, pause_message: d.pause_message } })),
    'order.new': (o) => setSess((s) => s && ({ ...s, orders: [o, ...s.orders.filter((x) => x.id !== o.id)] })),
    'order.updated': (o) => {
      setSess((s) => {
        if (!s) return s;
        const prev = s.orders.find((x) => x.id === o.id);
        if (prev && prev.status !== o.status && o.device_id === s.device_id) toast(`#${o.order_no}: ${ORDER_STATUS[o.status].label}`, o.status === 'cancelled' ? 'bad' : 'ok');
        return { ...s, orders: s.orders.map((x) => (x.id === o.id ? o : x)) };
      });
    },
    'bill.updated': (b) => setSess((s) => s && ({ ...s, bill: b })),
    'service.updated': (r) => setSess((s) => s && ({ ...s, service_requests: r.status === 'open' ? [...s.service_requests.filter((x) => x.id !== r.id), r] : s.service_requests.filter((x) => x.id !== r.id) })),
    'session.closed': (_d, es) => { es.close(); dropSession(true); },
  }, [token]);

  const ordering = info && info.ordering.allowed;
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.filter((l) => !l.unavailable).reduce((s, l) => s + l.unit * l.qty, 0);

  function requireJoin(then) {
    if (token) return then();
    afterJoin.current = then;
    setSheet({ type: 'join' });
  }
  function onJoined(newToken, code) {
    LS.set('token', newToken); // write through immediately so a queued submit sees it
    setToken(newToken); setEnded(false);
    setSheet(code ? { type: 'joined', code } : null);
    if (!code && afterJoin.current) { const f = afterJoin.current; afterJoin.current = null; setTimeout(f, 50); }
    loadInfo();
  }

  if (fatal) return html`<div class="c-wrap"><div class="c-center"><${Empty} icon="🔍" title=${fatal} /></div></div>`;
  if (!info) return html`<div class="c-wrap"><${Loading} /></div>`;

  const cur = info.company.currency;
  return html`<div class="c-wrap">
    <${Header} info=${info} lang=${lang} setLang=${setLang} t=${t} connected=${connected} online=${online} />
    ${ended ? html`<div class="c-pad"><div class="alert ok"><b>${t.sessionEnded}</b><br/>${t.sessionEndedHint}</div></div>` : null}
    ${!info.ordering.allowed && info.ordering.reason ? html`<div class="c-pad"><div class="alert warn">${info.ordering.reason}</div></div>` : null}
    ${info.company.ordering_mode === 'menu_only' ? html`<div class="c-pad"><div class="alert">${t.menuOnly}</div></div>` : null}
    ${info.branch.ordering_paused ? html`<div class="c-pad"><div class="alert warn"><b>${t.paused}</b>${info.branch.pause_message ? html`<br/>${info.branch.pause_message}` : null}</div></div>` : null}
    ${sess?.session?.join_code ? html`<div class="c-pad c-code-strip"><span>${t.shareCode}:</span> <b class="mono">${sess.session.join_code}</b></div>` : null}

    <main class="c-main">
      ${tab === 'menu' ? html`<${MenuView} menu=${menu} error=${menuError} reload=${loadMenu} lang=${lang} t=${t} cur=${cur} canOrder=${ordering}
          onPick=${(item) => setSheet({ type: 'item', item })} />` : null}
      ${tab === 'orders' ? html`<${OrdersView} sess=${sess} token=${token} t=${t} lang=${lang} cur=${cur} onJoin=${() => setSheet({ type: 'join' })} reload=${loadSession} />` : null}
      ${tab === 'bill' ? html`<${BillView} sess=${sess} token=${token} info=${info} t=${t} lang=${lang} cur=${cur} onJoin=${() => setSheet({ type: 'join' })} reload=${loadSession} />` : null}
    </main>

    ${cartCount > 0 && tab === 'menu' ? html`<button class="c-cartbar" onClick=${() => setSheet({ type: 'cart' })}>
      <span><b>${cartCount}</b> ${cartCount === 1 ? t.item : t.items} · ${money(cartTotal, cur)}</span><span>${t.viewCart} →</span></button>` : null}

    <nav class="c-nav" aria-label="Sections">
      ${[['menu', '🍽️', t.menu], ['orders', '🧾', t.orders], ['bill', '💳', t.bill]].map(([k, ic, label]) => html`
        <button class=${tab === k ? 'active' : ''} onClick=${() => { setTab(k); window.scrollTo(0, 0); }}>
          <span class="ic">${ic}</span><span>${label}</span>
          ${k === 'orders' && sess?.orders?.some((o) => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)) ? html`<span class="dot"></span>` : null}
        </button>`)}
      <button onClick=${() => requireJoin(() => setSheet({ type: 'service' }))}><span class="ic">🙋</span><span>${t.service}</span></button>
    </nav>

    ${sheet?.type === 'item' ? html`<${ItemSheet} item=${sheet.item} t=${t} lang=${lang} cur=${cur} canOrder=${ordering && !info.branch.ordering_paused}
        onClose=${() => setSheet(null)} onAdd=${(line) => {
          setCart((c) => { const k = lineKey(line); const ex = c.find((x) => lineKey(x) === k); return ex ? c.map((x) => (x === ex ? { ...x, qty: Math.min(50, x.qty + line.qty) } : x)) : [...c, line]; });
          setSheet(null); toast(`${nm(line, lang)} ✓`, 'ok');
        }} />` : null}
    ${sheet?.type === 'cart' ? html`<${CartSheet} cart=${cart} setCart=${setCart} info=${info} t=${t} lang=${lang} cur=${cur} token=${token}
        onClose=${() => setSheet(null)} requireJoin=${requireJoin} reloadMenu=${loadMenu}
        onPlaced=${(order) => { setCart([]); setSheet(null); setTab('orders'); setSess((s) => s && ({ ...s, orders: [order, ...s.orders.filter((x) => x.id !== order.id)] })); toast(t.orderPlaced, 'ok'); }}
        onSessionLost=${() => dropSession(true)} />` : null}
    ${sheet?.type === 'join' ? html`<${JoinSheet} info=${info} t=${t} onClose=${() => { afterJoin.current = null; setSheet(null); }} onJoined=${onJoined} />` : null}
    ${sheet?.type === 'joined' ? html`<${Modal} title=${t.shareCode} onClose=${() => { setSheet(null); if (afterJoin.current) { const f = afterJoin.current; afterJoin.current = null; f(); } }}>
        <p>${t.startHint}</p><div class="c-bigcode mono">${sheet.code}</div>
        <button class="btn primary lg block mt" onClick=${() => { setSheet(null); if (afterJoin.current) { const f = afterJoin.current; afterJoin.current = null; f(); } }}>OK</button></${Modal}>` : null}
    ${sheet?.type === 'service' ? html`<${ServiceSheet} t=${t} token=${token} sess=${sess} onClose=${() => setSheet(null)} onSent=${loadSession} />` : null}
    <footer class="c-foot muted small">${t.poweredBy}</footer>
  </div>`;
}

function Header({ info, lang, setLang, t, connected, online }) {
  const langs = info.company.languages || ['en'];
  return html`<header class="c-head">
    <div class="row">
      ${info.company.logo_url ? html`<img class="c-logo" src=${info.company.logo_url} alt="" />` : html`<div class="c-logo c-logo-ph">${info.company.name.replace('[DEMO] ', '').slice(0, 1)}</div>`}
      <div class="grow">
        <div class="c-name">${info.company.name}</div>
        <div class="small muted">${info.branch.name}</div>
      </div>
      <div class="c-table"><small>${t.table}</small><b>${info.table.number}</b></div>
    </div>
    <div class="row between mt-s">
      ${langs.length > 1 ? html`<div class="c-lang" role="group" aria-label="Language">
        <button class=${lang === 'en' ? 'on' : ''} onClick=${() => setLang('en')}>English</button>
        <button class=${lang === 'hi' ? 'on' : ''} onClick=${() => setLang('hi')}>हिन्दी</button></div>` : html`<span></span>`}
      <span class=${`conn ${connected && online ? '' : 'off'}`}><span class="dot"></span>${connected && online ? t.live : t.offline}</span>
    </div>
  </header>`;
}

// ------------------------------------------------------------------------------------- menu
function MenuView({ menu, error, reload, lang, t, cur, canOrder, onPick }) {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [cat, setCat] = useState('all');
  if (error && !menu) return html`<div class="c-pad"><${ErrorBox} error=${error} onRetry=${reload} /></div>`;
  if (!menu) return html`<div class="c-pad col">${[1, 2, 3, 4].map(() => html`<div class="skeleton" style="height:96px"></div>`)}</div>`;
  const toggle = (k) => setFilters((f) => ({ ...f, [k]: !f[k] }));
  const ql = q.trim().toLowerCase();
  const items = menu.items.filter((i) => {
    if (ql && ![i.name, i.name_hi, i.description, i.ingredients].join(' ').toLowerCase().includes(ql)) return false;
    if (filters.veg && !['veg', 'vegan'].includes(i.diet)) return false;
    if (filters.nonveg && !['nonveg', 'egg'].includes(i.diet)) return false;
    if (filters.popular && !i.is_popular) return false;
    if (filters.special && !i.is_special) return false;
    if (filters.combo && !i.is_combo) return false;
    if (filters.mild && i.spice_level > 1) return false;
    return true;
  });
  const cats = menu.categories.filter((c) => items.some((i) => i.category_id === c.id));
  const uncategorised = items.filter((i) => !menu.categories.some((c) => c.id === i.category_id));
  const shown = cat === 'all' ? cats : cats.filter((c) => c.id === cat);
  const chips = [['veg', `🟢 ${t.vegOnly}`], ['nonveg', `🔺 ${t.nonveg}`], ['popular', `⭐ ${t.popular}`], ['special', `✨ ${t.specials}`], ['combo', `🍱 ${t.combos}`], ['mild', `🌿 ${t.mild}`]];
  return html`<div>
    <div class="c-sticky">
      <div class="c-pad"><input type="search" placeholder=${t.search} value=${q} onInput=${(e) => setQ(e.target.value)} aria-label=${t.search} /></div>
      <div class="c-chips">${chips.map(([k, label]) => html`<button class=${`chip ${filters[k] ? 'on' : ''}`} aria-pressed=${!!filters[k]} onClick=${() => toggle(k)}>${label}</button>`)}</div>
      <div class="c-cats">
        <button class=${cat === 'all' ? 'on' : ''} onClick=${() => setCat('all')}>${t.all}</button>
        ${menu.categories.map((c) => html`<button class=${cat === c.id ? 'on' : ''} onClick=${() => setCat(c.id)}>${nm(c, lang)}</button>`)}
      </div>
    </div>
    ${!items.length ? html`<${Empty} icon="🥄" title=${q ? `“${q}”` : t.all}>—</${Empty}>` : null}
    ${shown.map((c) => html`<section class="c-section"><h2 class="c-cat-title">${nm(c, lang)}</h2>
      ${items.filter((i) => i.category_id === c.id).map((i) => html`<${ItemCard} key=${i.id} item=${i} lang=${lang} t=${t} cur=${cur} canOrder=${canOrder} onPick=${onPick} />`)}</section>`)}
    ${cat === 'all' && uncategorised.length ? html`<section class="c-section">${uncategorised.map((i) => html`<${ItemCard} key=${i.id} item=${i} lang=${lang} t=${t} cur=${cur} canOrder=${canOrder} onPick=${onPick} />`)}</section>` : null}
  </div>`;
}

const Chillies = ({ n }) => (n > 0 ? html`<span class="c-spice" title=${`Spice ${n}/3`}>${'🌶️'.repeat(n)}</span>` : null);

function ItemCard({ item, lang, t, cur, canOrder, onPick }) {
  const hasOpts = (item.options || []).length > 0;
  return html`<article class=${`c-item ${item.in_stock ? '' : 'oos'}`} onClick=${() => onPick(item)} tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && onPick(item)}>
    <div class="grow">
      <div class="row" style="gap:8px"><${Diet} diet=${item.diet} />
        ${item.is_popular ? html`<span class="badge brand">⭐ ${t.popular}</span>` : null}
        ${item.is_special ? html`<span class="badge warn">✨ ${t.specials}</span>` : null}
        ${item.is_combo ? html`<span class="badge info">🍱 ${t.combos}</span>` : null}
      </div>
      <h3 class="c-item-name">${nm(item, lang)}</h3>
      <div class="c-price">${hasOpts && minPrice(item) !== item.price && lang !== 'hi' ? html`<small class="muted">${t.from} </small>` : null}${money(hasOpts ? minPrice(item) : item.price, cur)}${hasOpts && minPrice(item) !== item.price && lang === 'hi' ? html`<small class="muted"> ${t.from}</small>` : null} <${Chillies} n=${item.spice_level} /></div>
      <p class="c-desc">${desc(item, lang)}</p>
    </div>
    <div class="c-item-side">
      ${item.image_url ? html`<img src=${item.image_url} alt="" loading="lazy" />` : html`<div class="c-noimg">🍽️</div>`}
      ${item.in_stock
        ? (canOrder ? html`<button class="btn sm primary c-add" onClick=${(e) => { e.stopPropagation(); onPick(item); }}>${t.add}${hasOpts ? ' +' : ''}</button>` : null)
        : html`<span class="badge bad c-add">${t.outOfStock}</span>`}
    </div>
  </article>`;
}

function ItemSheet({ item, t, lang, cur, canOrder, onClose, onAdd }) {
  const [sel, setSel] = useState(() => {
    const s = {};
    for (const g of item.options || []) if (g.type === 'single' && g.required) { const first = g.choices.find((c) => c.in_stock !== false); if (first) s[g.id] = first.id; }
    return s;
  });
  const [qty, setQty] = useState(1);
  const [instr, setInstr] = useState('');
  const missing = (item.options || []).filter((g) => g.required && ![].concat(sel[g.id] || []).length);
  const unit = unitPrice(item, sel);
  const pick = (g, c) => setSel((s) => {
    if (g.type === 'single') return { ...s, [g.id]: c.id };
    const cur_ = [].concat(s[g.id] || []);
    const next = cur_.includes(c.id) ? cur_.filter((x) => x !== c.id) : [...cur_, c.id];
    if (g.max && next.length > g.max) return s;
    return { ...s, [g.id]: next };
  });
  return html`<${Modal} title=${nm(item, lang)} onClose=${onClose}>
    ${item.image_url ? html`<img class="c-hero" src=${item.image_url} alt="" />` : null}
    <div class="row wrap" style="gap:8px"><${Diet} diet=${item.diet} /><b>${money(unit, cur)}</b>${item.portion_size ? html`<span class="muted small">· ${item.portion_size}</span>` : null}<${Chillies} n=${item.spice_level} /></div>
    <p class="mt-s">${desc(item, lang)}</p>
    <dl class="c-facts">
      ${item.is_combo && item.combo_details ? html`<dt>${t.combo}</dt><dd>${item.combo_details}</dd>` : null}
      ${item.ingredients ? html`<dt>${t.ingredients}</dt><dd>${item.ingredients}</dd>` : null}
      <dt>${t.allergens}</dt><dd>${item.allergens?.length ? item.allergens.map((a) => html`<span class="badge warn" style="margin:0 4px 4px 0">${a}</span>`) : '—'}</dd>
      ${item.taste_notes ? html`<dt>${t.taste}</dt><dd>${item.taste_notes}</dd>` : null}
      <dt>${t.spice}</dt><dd>${t.spiceLevels[item.spice_level] || ''}</dd>
    </dl>
    ${!item.in_stock ? html`<div class="alert bad">${t.outOfStock}</div>` : null}
    ${canOrder && item.in_stock ? html`
      ${(item.options || []).map((g) => html`<fieldset class="c-opt"><legend>${nm(g, lang)} <span class="muted small">${g.required ? t.required : g.type === 'multi' && g.max ? `${t.chooseUpTo} ${g.max}` : t.optional}</span></legend>
        ${g.choices.map((c) => {
          const on = [].concat(sel[g.id] || []).includes(c.id);
          return html`<label class=${`check c-choice ${c.in_stock === false ? 'oos' : ''}`}>
            <input type=${g.type === 'single' ? 'radio' : 'checkbox'} name=${g.id} checked=${on} disabled=${c.in_stock === false} onChange=${() => pick(g, c)} />
            <span class="grow">${nm(c, lang)}${c.in_stock === false ? html` <span class="badge bad">${t.outOfStock}</span>` : null}</span>
            <span class="muted">${c.price ? `+${money(c.price, cur)}` : ''}</span></label>`;
        })}</fieldset>`)}
      <label class="field mt">${t.instructions}<input maxlength="200" placeholder=${t.instructionsPh} value=${instr} onInput=${(e) => setInstr(e.target.value)} /></label>
      <div class="row between mt">
        <div class="c-qty"><button aria-label="-" onClick=${() => setQty(Math.max(1, qty - 1))}>−</button><b>${qty}</b><button aria-label="+" onClick=${() => setQty(Math.min(50, qty + 1))}>+</button></div>
        <button class="btn primary lg grow" disabled=${missing.length > 0} onClick=${() => onAdd({ id: uuid(), item_id: item.id, name: item.name, name_hi: item.name_hi, diet: item.diet, selections: sel, qty, instructions: instr.trim(), unit,
          optionLabels: (item.options || []).flatMap((g) => [].concat(sel[g.id] || []).map((id) => g.choices.find((c) => c.id === id)).filter(Boolean)) })}>
          ${t.addToOrder} · ${money(unit * qty, cur)}</button>
      </div>
      ${missing.length ? html`<p class="error-text mt-s">${t.required}: ${missing.map((g) => nm(g, lang)).join(', ')}</p>` : null}` : null}
  </${Modal}>`;
}

// ------------------------------------------------------------------------------------- cart
function CartSheet({ cart, setCart, info, t, lang, cur, token, onClose, requireJoin, onPlaced, onSessionLost, reloadMenu }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState(LS.get('pending', null) ? 'retry' : 'idle');
  const [err, setErr] = useState(null);
  const valid = cart.filter((l) => !l.unavailable);
  const subtotal = valid.reduce((s, l) => s + l.unit * l.qty, 0);
  const sc = Math.round(subtotal * (info.company.service_charge_pct || 0) / 100);
  const taxes = (info.company.taxes || []).map((x) => ({ ...x, amount: Math.round((subtotal + sc) * x.rate / 100) }));
  const total = subtotal + sc + taxes.reduce((s, x) => s + x.amount, 0);
  const setQty = (id, q) => setCart((c) => (q <= 0 ? c.filter((l) => l.id !== id) : c.map((l) => (l.id === id ? { ...l, qty: Math.min(50, q) } : l))));

  async function submit() {
    if (state === 'sending') return;
    // One idempotency key per submission; reused on retries so the order is created at most once.
    let pending = LS.get('pending', null);
    const lines = valid.map((l) => ({ item_id: l.item_id, qty: l.qty, selections: l.selections, instructions: l.instructions }));
    if (!pending || JSON.stringify(pending.lines) !== JSON.stringify(lines)) pending = { key: uuid(), lines, note };
    LS.set('pending', pending);
    setState('sending'); setErr(null);
    try {
      const r = await api(`/api/public/t/${encodeURIComponent(QR)}/orders`, { method: 'POST', body: { lines: pending.lines, note: pending.note, idempotency_key: pending.key }, headers: { 'X-Guest-Token': LS.get('token', null) || token }, retries: 2 });
      LS.set('pending', null);
      setState('idle');
      onPlaced(r.order);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) { setState('retry'); setErr(e.message); return; }
      LS.set('pending', null);
      setState('idle');
      if (e.status === 401) { onSessionLost(); onClose(); return; }
      if (e.data?.unavailable) {
        const badIds = new Set(e.data.unavailable.map((u) => u.item_id));
        setCart((c) => c.map((l) => (badIds.has(l.item_id) ? { ...l, unavailable: true } : l)));
        reloadMenu();
      }
      setErr(e.message);
    }
  }

  return html`<${Modal} title=${t.yourCart} onClose=${onClose}>
    ${!cart.length ? html`<${Empty} icon="🛒" title=${t.emptyCart}>${t.emptyCartHint}</${Empty}>` : html`
      <div class="col">
        ${cart.map((l) => html`<div class=${`c-line ${l.unavailable ? 'oos' : ''}`}>
          <div class="grow">
            <div class="row" style="gap:8px"><${Diet} diet=${l.diet} /><b>${nm(l, lang)}</b></div>
            ${l.optionLabels?.length ? html`<div class="small muted">${l.optionLabels.map((o) => nm(o, lang)).join(', ')}</div>` : null}
            ${l.instructions ? html`<div class="small">“${l.instructions}”</div>` : null}
            ${l.unavailable ? html`<div class="error-text small">${t.outOfStock}</div>` : null}
            <div class="small muted">${money(l.unit, cur)} × ${l.qty}</div>
          </div>
          ${l.unavailable ? html`<button class="btn sm" onClick=${() => setQty(l.id, 0)}>${t.remove}</button>` : html`
          <div class="c-qty sm"><button aria-label="-" onClick=${() => setQty(l.id, l.qty - 1)}>−</button><b>${l.qty}</b><button aria-label="+" onClick=${() => setQty(l.id, l.qty + 1)}>+</button></div>`}
        </div>`)}
      </div>
      <label class="field mt">${t.noteKitchen}<input maxlength="300" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder=${t.instructionsPh} /></label>
      <table class="c-sum mt">
        <tr><td>${t.subtotal}</td><td class="right">${money(subtotal, cur)}</td></tr>
        ${sc ? html`<tr><td>${t.serviceCharge} (${info.company.service_charge_pct}%)</td><td class="right">${money(sc, cur)}</td></tr>` : null}
        ${taxes.map((x) => html`<tr><td>${x.name} (${x.rate}%)</td><td class="right">${money(x.amount, cur)}</td></tr>`)}
        <tr class="tot"><td>${t.estTotal}</td><td class="right">${money(total, cur)}</td></tr>
      </table>
      <p class="small muted">${t.estNote}</p>
      ${cart.some((l) => l.unavailable) ? html`<div class="alert warn mb">${t.unavailableItems}</div>` : null}
      ${err ? html`<div class="alert bad mb" role="alert">${err}</div>` : null}
      ${info.branch.ordering_paused ? html`<div class="alert warn mb">${t.paused}</div>` : null}
      <button class="btn primary lg block" disabled=${!valid.length || state === 'sending' || info.branch.ordering_paused || !info.ordering.allowed}
        onClick=${() => requireJoin(submit)}>
        ${state === 'sending' ? html`<${Spinner} /> ${t.placing}` : state === 'retry' ? t.retry : `${t.placeOrder} · ${money(subtotal, cur)}`}</button>`}
  </${Modal}>`;
}

// ------------------------------------------------------------------------------------- join
function JoinSheet({ info, t, onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [req, setReq] = useState(LS.get('joinreq', null));
  const [reqStatus, setReqStatus] = useState(req ? 'pending' : null);
  const base = `/api/public/t/${encodeURIComponent(QR)}`;

  async function doJoin(e) {
    e?.preventDefault();
    setBusy(true); setErr(null);
    try { const r = await api(`${base}/join`, { method: 'POST', body: { code, label } }); LS.set('joinreq', null); onJoined(r.token); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  async function doStart() {
    setBusy(true); setErr(null);
    try { const r = await api(`${base}/start`, { method: 'POST', body: { label } }); onJoined(r.token, r.join_code); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  async function doRequest() {
    setBusy(true); setErr(null);
    try { const r = await api(`${base}/join-request`, { method: 'POST', body: { label } }); LS.set('joinreq', r); setReq(r); setReqStatus('pending'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const poll = useCallback(async () => {
    if (!req) return;
    try {
      const r = await api(`/api/public/join-requests/${req.request_id}?poll=${encodeURIComponent(req.poll_token)}`);
      if (r.status === 'approved' && r.token) { LS.set('joinreq', null); onJoined(r.token); }
      else if (r.status !== 'pending') { LS.set('joinreq', null); setReq(null); setReqStatus(r.status); }
    } catch (x) { if (x.status === 404) { LS.set('joinreq', null); setReq(null); setReqStatus(null); } }
  }, [req]);
  useStream(req ? `/api/public/join-requests/${req.request_id}/stream?poll=${encodeURIComponent(req.poll_token)}` : null, { 'join.updated': () => poll(), onOpen: () => poll() }, [req?.request_id]);
  useEffect(() => { if (!req) return undefined; const id = setInterval(poll, 6000); return () => clearInterval(id); }, [req]);

  const canStart = !info.table.has_open_session && info.branch.self_start_sessions && info.table.status !== 'cleaning';
  return html`<${Modal} title=${t.joinTitle} onClose=${onClose}>
    <p class="muted">${t.joinIntro}</p>
    ${reqStatus === 'pending' ? html`<div class="alert"><${Spinner} /> ${t.waitingApproval}</div>` : html`
    <label class="field">${t.yourName}<input maxlength="40" value=${label} onInput=${(e) => setLabel(e.target.value)} autocomplete="given-name" /></label>
    ${canStart ? html`<div class="card flat mt"><p class="small">${t.startHint}</p><button class="btn primary lg block" disabled=${busy} onClick=${doStart}>${busy ? html`<${Spinner} />` : null} ${t.startSession}</button></div>` : null}
    ${info.table.has_open_session ? html`<form class="card flat mt form" onSubmit=${doJoin}>
      <label class="field">${t.enterCode}<input class="c-codein mono" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code" value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))} /><span class="hint">${t.codeHint}</span></label>
      <button class="btn primary lg block" disabled=${busy || code.length !== 4}>${busy ? html`<${Spinner} />` : null} ${t.join}</button></form>` : null}
    ${!info.table.has_open_session && !canStart ? html`<div class="alert mt">${t.noSession}</div>` : null}
    <button class="btn block mt" disabled=${busy} onClick=${doRequest}>🙋 ${t.askStaff}</button>
    ${reqStatus === 'denied' ? html`<div class="alert bad mt">${t.denied}</div>` : null}`}
    ${err ? html`<div class="alert bad mt" role="alert">${err}</div>` : null}
  </${Modal}>`;
}

// ------------------------------------------------------------------------------------- orders
const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'served'];
function OrdersView({ sess, token, t, lang, cur, onJoin, reload }) {
  const now = useNow(15000);
  const [busy, setBusy] = useState(null);
  if (!token) return html`<${NeedJoin} t=${t} onJoin=${onJoin} />`;
  if (!sess) return html`<${Loading} />`;
  if (!sess.orders.length) return html`<${Empty} icon="🧾" title=${t.noOrders}>${t.noOrdersHint}</${Empty}>`;
  async function cancel(o) {
    setBusy(o.id);
    try { await api(`/api/public/t/${encodeURIComponent(QR)}/orders/${o.id}/cancel`, { method: 'POST', body: {}, headers: { 'X-Guest-Token': token } }); reload(); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(null); }
  }
  return html`<div class="c-pad col">${sess.orders.map((o) => {
    const idx = STEPS.indexOf(o.status);
    const eta = o.accepted_at && o.prep_minutes && ['accepted', 'preparing'].includes(o.status) ? Math.max(0, Math.ceil((parseTime(o.accepted_at).getTime() + o.prep_minutes * 60000 - now) / 60000)) : null;
    return html`<div class="card">
      <div class="row between"><div><b>#${o.order_no}</b> <span class="muted small">· ${clock(o.created_at)}</span> ${o.device_id === sess.device_id ? html`<span class="badge">${t.myPhone}</span>` : null}</div><${StatusBadge} status=${o.status} /></div>
      ${o.status === 'cancelled' ? html`<div class="alert bad mt-s small">${ORDER_STATUS.cancelled.label}${o.cancel_reason ? `: ${o.cancel_reason}` : ''}</div>` : html`
        <div class="c-steps" aria-label=${ORDER_STATUS[o.status].label}>${STEPS.map((s, i) => html`<div class=${`step ${i <= idx ? 'done' : ''} ${i === idx ? 'cur' : ''}`}><span></span><small>${ORDER_STATUS[s].short}</small></div>`)}</div>
        ${eta != null ? html`<div class="small"><b>${t.eta} ${eta} ${t.min}</b></div>` : null}`}
      <ul class="c-olist">${o.items.map((i) => html`<li><span><b>${i.qty}×</b> ${nm(i, lang)}${i.options.length ? html` <small class="muted">(${i.options.map((x) => nm(x, lang)).join(', ')})</small>` : null}${i.instructions ? html`<br/><small>“${i.instructions}”</small>` : null}</span><span>${money(i.line_total, cur)}</span></li>`)}</ul>
      ${o.status === 'pending' && o.device_id === sess.device_id ? html`<button class="btn sm mt-s" disabled=${busy === o.id} onClick=${() => cancel(o)}>${t.cancelOrder}</button>` : null}
    </div>`;
  })}</div>`;
}

const NeedJoin = ({ t, onJoin }) => html`<div class="c-pad"><${Empty} icon="🔐" title=${t.joinTitle}>${t.joinIntro}<div class="mt"><button class="btn primary lg" onClick=${onJoin}>${t.join}</button></div></${Empty}></div>`;

// ------------------------------------------------------------------------------------- bill
function BillView({ sess, token, info, t, lang, cur, onJoin, reload }) {
  const [busy, setBusy] = useState(null);
  const [upi, setUpi] = useState(false);
  const [utr, setUtr] = useState('');
  if (!token) return html`<${NeedJoin} t=${t} onJoin=${onJoin} />`;
  if (!sess) return html`<${Loading} />`;
  const b = sess.bill;
  const hdr = { 'X-Guest-Token': token };
  const base = `/api/public/t/${encodeURIComponent(QR)}`;
  const pay = info.payments;
  const pendingUpi = b.payments.find((p) => p.method === 'upi' && p.status === 'pending');
  const failed = b.payments.filter((p) => p.status === 'failed').slice(-1)[0];
  async function act(id, fn) { setBusy(id); try { await fn(); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(null); } }

  return html`<div class="c-pad col">
    <div class="card">
      <div class="row between"><h2 style="margin:0">${t.bill}${b.bill_no ? ` #${b.bill_no}` : ''}</h2>${b.status === 'paid' ? html`<span class="badge ok">${t.paid}</span>` : null}</div>
      ${!b.lines.length ? html`<p class="muted mt-s">${t.nothingToPay}</p>` : html`
      <ul class="c-olist mt-s">${b.lines.map((l) => html`<li><span>${l.qty}× ${nm(l, lang)}${l.options.length ? html` <small class="muted">(${l.options.map((x) => nm(x, lang)).join(', ')})</small>` : null}</span><span>${money(l.line_total, cur)}</span></li>`)}</ul>
      <table class="c-sum">
        <tr><td>${t.subtotal}</td><td class="right">${money(b.subtotal, cur)}</td></tr>
        ${b.discount ? html`<tr><td>${t.discount}${b.discount_reason ? ` (${b.discount_reason})` : ''}</td><td class="right">−${money(b.discount, cur)}</td></tr>` : null}
        ${b.service_charge ? html`<tr><td>${t.serviceCharge} (${b.service_charge_pct}%)</td><td class="right">${money(b.service_charge, cur)}</td></tr>` : null}
        ${b.taxes.map((x) => html`<tr><td>${x.name} (${x.rate}%)</td><td class="right">${money(x.amount, cur)}</td></tr>`)}
        <tr class="tot"><td>${t.total}</td><td class="right">${money(b.total, cur)}</td></tr>
        ${b.paid ? html`<tr><td>${t.paid}</td><td class="right">−${money(b.paid, cur)}</td></tr>` : null}
        <tr class="tot"><td>${t.outstanding}</td><td class="right">${money(b.outstanding, cur)}</td></tr>
      </table>`}
      ${b.pending_orders ? html`<div class="alert warn mt-s small">${b.pending_orders} ${t.pendingNote}</div>` : null}
    </div>

    ${b.payments.length ? html`<div class="card"><h3>${t.payments}</h3>${b.payments.map((p) => html`<div class="row between small" style="padding:4px 0">
      <span>${p.method.toUpperCase()} ${p.provider_mode === 'test' ? html`<span class="badge test">${t.testMode}</span>` : null} ${p.reference ? html`<span class="muted mono">${p.reference}</span>` : null}</span>
      <span>${money(p.amount, cur)} <span class=${`badge ${p.status === 'paid' ? 'ok' : p.status === 'failed' ? 'bad' : p.status === 'refunded' ? 'info' : 'warn'}`}>${p.status}</span></span></div>`)}</div>` : null}

    ${b.status === 'paid' ? html`<div class="alert ok">${t.billPaid}</div>
      <a class="btn primary lg block" href=${`${base}/receipt?download=1&token=${encodeURIComponent(token)}`}>⬇️ ${t.downloadReceipt}</a>
      <a class="btn block" target="_blank" rel="noopener" href=${`${base}/receipt?token=${encodeURIComponent(token)}`}>${t.printReceipt}</a>` : null}

    ${failed && b.outstanding > 0 && !b.payments.some((p) => p.status === 'pending') ? html`<div class="alert bad">${t.paymentFailed}</div>` : null}
    ${pendingUpi ? html`<div class="alert warn">${t.upiPending}</div>` : null}

    ${b.outstanding > 0 && !b.pending_orders && !pendingUpi ? html`<div class="col">
      ${pay.online ? html`<button class="btn primary lg block" disabled=${!!busy} onClick=${() => act('online', async () => {
        const r = await api(`${base}/pay/online`, { method: 'POST', body: {}, headers: hdr });
        location.href = r.checkout_url;
      })}>${busy === 'online' ? html`<${Spinner} />` : '💳'} ${t.payOnline} · ${money(b.outstanding, cur)} ${pay.online_mode === 'test' ? html`<span class="badge test">${t.testMode}</span>` : null}</button>` : null}
      ${pay.upi ? html`<button class="btn lg block" onClick=${() => setUpi(!upi)}>📲 ${t.payUpi}</button>
        ${upi ? html`<div class="card center"><h3>${t.upiTitle}</h3>
          <img src=${`${base}/upi-qr.svg?token=${encodeURIComponent(token)}&t=${b.outstanding}`} alt="UPI QR code" width="220" height="220" />
          <div class="mono">${pay.upi_vpa}</div><div class="muted small">${pay.upi_payee} · ${money(b.outstanding, cur)}</div>
          <a class="btn soft block mt-s" href=${`upi://pay?pa=${encodeURIComponent(pay.upi_vpa)}&pn=${encodeURIComponent(pay.upi_payee)}&am=${(b.outstanding / 100).toFixed(2)}&cu=${cur}`}>Open UPI app</a>
          <form class="form mt" onSubmit=${(e) => { e.preventDefault(); act('upi', async () => { await api(`${base}/pay/upi`, { method: 'POST', body: { reference: utr }, headers: hdr }); setUpi(false); reload(); }); }}>
            <label class="field">${t.upiRef}<input inputmode="numeric" minlength="6" maxlength="40" required value=${utr} onInput=${(e) => setUtr(e.target.value.trim())} /></label>
            <button class="btn primary block" disabled=${busy === 'upi' || utr.length < 6}>${t.upiSubmit}</button></form></div>` : null}` : null}
      ${pay.cash || pay.pay_at_counter ? html`<button class="btn lg block" disabled=${!!busy} onClick=${() => act('counter', async () => {
        await api(`${base}/service`, { method: 'POST', body: { type: 'bill' }, headers: hdr }); toast(t.counterHint, 'ok');
      })}>🧾 ${t.payCounter}</button>` : null}
    </div>` : null}
  </div>`;
}

// ------------------------------------------------------------------------------------- service
function ServiceSheet({ t, token, sess, onClose, onSent }) {
  const [busy, setBusy] = useState(null);
  const open = new Set((sess?.service_requests || []).map((r) => r.type));
  async function send(type) {
    setBusy(type);
    try { await api(`/api/public/t/${encodeURIComponent(QR)}/service`, { method: 'POST', body: { type }, headers: { 'X-Guest-Token': token } }); toast(t.serviceSent, 'ok'); onSent(); onClose(); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(null); }
  }
  return html`<${Modal} title=${t.service} onClose=${onClose}>
    <div class="grid cols-3">
      ${[['waiter', '🙋', t.callWaiter], ['water', '💧', t.water], ['bill', '🧾', t.requestBill]].map(([k, ic, label]) => html`
        <button class="btn lg c-svc" disabled=${!!busy || open.has(k)} onClick=${() => send(k)}><span style="font-size:1.8rem">${ic}</span><span>${label}</span>${open.has(k) ? html`<small class="badge ok">${t.requested}</small>` : null}</button>`)}
    </div>
  </${Modal}>`;
}

render(html`<${App} />`, document.getElementById('app'));
