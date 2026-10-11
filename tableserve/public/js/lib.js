// Shared browser utilities for the customer and staff apps.
import { h, render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import htm from 'htm';

export const html = htm.bind(h);
export { h, render, useState, useEffect, useRef, useCallback };

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

// fetch wrapper: JSON, CSRF header, friendly network errors, and retry for idempotent requests.
export async function api(path, { method = 'GET', body, headers = {}, retries = method === 'GET' ? 2 : 0, signal } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(path, {
        method,
        credentials: 'same-origin',
        signal,
        headers: { 'X-Requested-With': 'TableServe', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
      if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data);
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e.name === 'AbortError') throw e;
      lastErr = new ApiError(0, 'Network problem – check your connection and try again.', null);
      if (attempt < retries) await sleep(400 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function money(minor, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format((minor || 0) / 100);
  } catch {
    return `${currency} ${((minor || 0) / 100).toFixed(2)}`;
  }
}

export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}
export const parseTime = (iso) => (iso ? new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z') : null);
export function clock(iso) {
  const d = parseTime(iso);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}
export function mmss(ms) {
  const neg = ms < 0; ms = Math.abs(ms);
  const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000);
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

// ---- toasts ----------------------------------------------------------------------------------
let toastHost;
export function toast(msg, kind = '') {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  toastHost.appendChild(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 6000 : 3500);
}

// ---- sound -----------------------------------------------------------------------------------
let audioCtx;
export function enableSound() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); return true; } catch { return false; }
}
export function beep(pattern = [880, 0, 1175]) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  let t = audioCtx.currentTime;
  for (const f of pattern) {
    if (f) {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.start(t); o.stop(t + 0.25);
    }
    t += 0.18;
  }
  if (navigator.vibrate) navigator.vibrate(120);
}

// ---- server-sent events with auto-reconnect + resync callback ---------------------------------
export function useStream(url, handlers, deps = []) {
  const [connected, setConnected] = useState(false);
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!url) return undefined;
    let es; let closed = false; let retry;
    const connect = () => {
      es = new EventSource(url);
      es.addEventListener('hello', () => { setConnected(true); ref.current.onOpen?.(); });
      es.onerror = () => {
        setConnected(false);
        if (es.readyState === EventSource.CLOSED && !closed) { retry = setTimeout(connect, 3000); }
      };
      for (const name of Object.keys(ref.current)) {
        if (name === 'onOpen') continue;
        es.addEventListener(name, (ev) => { let d = null; try { d = JSON.parse(ev.data); } catch { /* ignore */ } ref.current[name]?.(d, es); });
      }
    };
    connect();
    return () => { closed = true; clearTimeout(retry); es?.close(); };
  }, [url, ...deps]);
  return connected;
}

export function useInterval(fn, ms) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { const id = setInterval(() => ref.current(), ms); return () => clearInterval(id); }, [ms]);
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), ms);
  return now;
}

// Async action helper: tracks busy state and shows errors as toasts.
export function useAction() {
  const [busy, setBusy] = useState(null);
  const run = useCallback(async (id, fn, okMsg) => {
    if (busy) return undefined;
    setBusy(id);
    try {
      const r = await fn();
      if (okMsg) toast(okMsg, 'ok');
      return r;
    } catch (e) {
      toast(e.message || 'Something went wrong', 'bad');
      return undefined;
    } finally { setBusy(null); }
  }, [busy]);
  return [busy, run];
}

// ---- small components ------------------------------------------------------------------------
export const Diet = ({ diet }) => html`<span class=${`diet ${diet}`} title=${{ veg: 'Vegetarian', nonveg: 'Non-vegetarian', egg: 'Contains egg', vegan: 'Vegan' }[diet]} aria-label=${diet}></span>`;

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return html`<div class="modal-back" onClick=${(e) => e.target === e.currentTarget && onClose?.()}>
    <div class=${`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="modal-head"><h2>${title}</h2><button class="btn ghost icon" aria-label="Close" onClick=${onClose}>✕</button></div>
      ${children}
    </div></div>`;
}

export const Spinner = () => html`<span class="spinner" aria-hidden="true"></span>`;
export const Loading = ({ text = 'Loading…' }) => html`<div class="empty"><${Spinner} /><div class="mt-s">${text}</div></div>`;
export const Empty = ({ icon = '🍽️', title, children }) => html`<div class="empty"><div class="big">${icon}</div><div><b>${title}</b></div>${children ? html`<div class="mt-s">${children}</div>` : null}</div>`;
export const ErrorBox = ({ error, onRetry }) => html`<div class="alert bad row between"><span>${error}</span>${onRetry ? html`<button class="btn sm" onClick=${onRetry}>Try again</button>` : null}</div>`;

export const ORDER_STATUS = {
  pending: { label: 'Waiting for kitchen', short: 'Pending', cls: 'warn' },
  accepted: { label: 'Accepted', short: 'Accepted', cls: 'info' },
  preparing: { label: 'Being prepared', short: 'Preparing', cls: 'brand' },
  ready: { label: 'Ready to serve', short: 'Ready', cls: 'ok' },
  served: { label: 'Served', short: 'Served', cls: '' },
  cancelled: { label: 'Cancelled', short: 'Cancelled', cls: 'bad' },
};
export const StatusBadge = ({ status }) => html`<span class=${`badge ${ORDER_STATUS[status]?.cls || ''}`}>${ORDER_STATUS[status]?.short || status}</span>`;

// Load data with loading/error state and a reload function.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const seq = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const my = ++seq.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (my === seq.current) setState({ loading: false, error: null, data });
    } catch (e) {
      if (my === seq.current) setState((s) => ({ loading: false, error: e.message, data: quiet ? s.data : null }));
    }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}
