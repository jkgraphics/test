// Router, app context and live-event bus shared by the staff app and its pages.
import { html, useState, useEffect, useRef } from './lib.js';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

// ---- router ---------------------------------------------------------------------------------
const listeners = new Set();
export function navigate(to, replace = false) {
  if (to === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => listeners.forEach((l) => l()));
export function usePath() {
  const [p, setP] = useState(location.pathname);
  useEffect(() => { const l = () => setP(location.pathname); listeners.add(l); return () => listeners.delete(l); }, []);
  return p;
}
export const Link = ({ href, children, ...rest }) => html`<a href=${href} onClick=${(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); navigate(href); }} ...${rest}>${children}</a>`;

// ---- app context: who am I, which company/branch, live branch events -----------------------
export const Ctx = createContext(null);
export const useCtx = () => useContext(Ctx);

export function createBus() {
  const subs = new Set();
  return { on: (fn) => { subs.add(fn); return () => subs.delete(fn); }, emit: (name, data) => subs.forEach((fn) => fn(name, data)) };
}
// Subscribe a page to live branch events.
export function useBranchEvents(handler) {
  const { bus } = useCtx();
  const ref = useRef(handler); ref.current = handler;
  useEffect(() => bus.on((n, d) => ref.current(n, d)), [bus]);
}

