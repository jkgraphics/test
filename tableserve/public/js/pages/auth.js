import { html, useState, useEffect, api, toast, Spinner, Loading, ErrorBox } from '../lib.js';
import { useCtx } from '../core.js';

const Brand = () => html`<div class="brandmark"><span class="mark">🍽️</span>TableServe</div>`;

const DEMO = [
  ['Platform', [['Super Admin', 'super@tableserve.demo'], ['Platform Support', 'support@tableserve.demo']]],
  ['Spice Garden (Company A)', [['Owner', 'owner@spicegarden.demo'], ['Branch manager', 'manager@spicegarden.demo'], ['Kitchen', 'kitchen@spicegarden.demo'], ['Waiter', 'waiter@spicegarden.demo'], ['Cashier', 'cashier@spicegarden.demo']]],
  ['Coastal Curry Co. (Company B)', [['Owner', 'owner@coastalcurry.demo'], ['Branch manager', 'manager@coastalcurry.demo'], ['Kitchen', 'kitchen@coastalcurry.demo'], ['Waiter', 'waiter@coastalcurry.demo'], ['Cashier', 'cashier@coastalcurry.demo']]],
];

export function LoginPage({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api('/api/auth/login', { method: 'POST', body: { email, password } }); await onDone(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return html`<div class="auth-wrap"><div class="col" style="width:min(880px,100%)">
    <div class="grid cols-2" style="align-items:start">
      <form class="card form" onSubmit=${submit} aria-label="Sign in">
        <${Brand} />
        <h1>Sign in</h1>
        <label class="field">Email<input type="email" required autocomplete="username" value=${email} onInput=${(e) => setEmail(e.target.value)} /></label>
        <label class="field">Password<input type="password" required autocomplete="current-password" value=${password} onInput=${(e) => setPassword(e.target.value)} /></label>
        ${err ? html`<div class="alert bad" role="alert">${err}</div>` : null}
        <button class="btn primary lg" disabled=${busy}>${busy ? html`<${Spinner} />` : null} Sign in</button>
        <p class="small muted">New restaurant? <a href="/register">Register and start a free trial</a></p>
      </form>
      <div class="card">
        <h3>Demo accounts <span class="badge warn">DEMO</span></h3>
        <p class="small muted">Password for every demo account: <b class="mono">Demo@1234</b>. Tap to fill.</p>
        ${DEMO.map(([group, list]) => html`<div class="mt-s"><div class="small" style="font-weight:700">${group}</div>
          <div class="row wrap" style="gap:6px;margin-top:4px">${list.map(([label, em]) => html`<button type="button" class="btn sm soft" onClick=${() => { setEmail(em); setPassword('Demo@1234'); }}>${label}</button>`)}</div></div>`)}
        <hr class="sep" />
        <p class="small">Customer view (no login): <a href="/t/demo-spice-kor-t5" target="_blank">Spice Garden · Table 5</a> · <a href="/t/demo-coastal-ban-t5" target="_blank">Coastal Curry · Table 5</a></p>
      </div>
    </div></div></div>`;
}

export function RegisterPage({ onDone }) {
  const [f, setF] = useState({ company_name: '', name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api('/api/auth/register-company', { method: 'POST', body: f }); toast('Welcome to TableServe! Your free trial has started.', 'ok'); onDone(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return html`<div class="auth-wrap"><form class="card auth-card form" onSubmit=${submit}>
    <${Brand} />
    <h1>Register your restaurant</h1>
    <p class="muted small">Start a free trial. You'll be the company owner and can add branches, menus, tables and staff.</p>
    <label class="field">Restaurant / company name<input required minlength="2" maxlength="80" value=${f.company_name} onInput=${set('company_name')} /></label>
    <label class="field">Your name<input required maxlength="80" value=${f.name} onInput=${set('name')} autocomplete="name" /></label>
    <div class="row wrap"><label class="field grow">Email<input type="email" required value=${f.email} onInput=${set('email')} autocomplete="email" /></label>
      <label class="field grow">Phone<input type="tel" value=${f.phone} onInput=${set('phone')} autocomplete="tel" /></label></div>
    <label class="field">Password<input type="password" required minlength="8" value=${f.password} onInput=${set('password')} autocomplete="new-password" /><span class="hint">At least 8 characters.</span></label>
    ${err ? html`<div class="alert bad" role="alert">${err}</div>` : null}
    <button class="btn primary lg" disabled=${busy}>${busy ? html`<${Spinner} />` : null} Create account</button>
    <p class="small muted">Already registered? <a href="/login">Sign in</a></p>
  </form></div>`;
}

export function InvitePage({ token, onDone }) {
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/api/auth/invitations/${encodeURIComponent(token)}`).then(setInv, (e) => setErr(e.message)); }, [token]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api(`/api/auth/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST', body: { name, password } }); toast('Invitation accepted', 'ok'); onDone(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  if (err && !inv) return html`<div class="auth-wrap"><div class="card auth-card"><${Brand} /><${ErrorBox} error=${err} /><p class="mt"><a href="/login">Go to sign in</a></p></div></div>`;
  if (!inv) return html`<${Loading} />`;
  return html`<div class="auth-wrap"><form class="card auth-card form" onSubmit=${submit}>
    <${Brand} />
    <h1>Join ${inv.company_name}</h1>
    <p>You've been invited as <b>${inv.role}</b> using <b>${inv.email}</b>.</p>
    ${inv.existing_user ? html`<label class="field">Your existing password<input type="password" required value=${password} onInput=${(e) => setPassword(e.target.value)} /></label>` : html`
      <label class="field">Your name<input required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
      <label class="field">Choose a password<input type="password" required minlength="8" value=${password} onInput=${(e) => setPassword(e.target.value)} /></label>`}
    ${err ? html`<div class="alert bad">${err}</div>` : null}
    <button class="btn primary lg" disabled=${busy}>Accept invitation</button>
  </form></div>`;
}

export function AccountPage() {
  const { me } = useCtx();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { await api('/api/auth/change-password', { method: 'POST', body: { current_password: cur, new_password: next } }); toast('Password changed. Other devices were signed out.', 'ok'); setCur(''); setNext(''); } catch (x) { toast(x.message, 'bad'); } finally { setBusy(false); }
  }
  return html`<div><div class="topbar"><h1>My account</h1></div>
    <div class="grid cols-2"><div class="card"><h3>${me.user.name}</h3><p class="muted">${me.user.email}</p></div>
    <form class="card form" onSubmit=${submit}><h3>Change password</h3>
      <label class="field">Current password<input type="password" required value=${cur} onInput=${(e) => setCur(e.target.value)} /></label>
      <label class="field">New password<input type="password" minlength="8" required value=${next} onInput=${(e) => setNext(e.target.value)} /></label>
      <button class="btn primary" disabled=${busy}>Update password</button></form></div></div>`;
}
