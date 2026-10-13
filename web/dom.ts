export type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

/** Builds elements with textContent only; data never reaches innerHTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'style') el.style.cssText = String(v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

const toastEl = () => document.getElementById('toast')!;
let toastTimer: number | undefined;
export function toast(msg: string, kind: 'info' | 'error' = 'info') {
  const t = toastEl();
  t.textContent = msg;
  t.className = `toast${kind === 'error' ? ' error' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 6000);
}

export interface DialogSpec {
  title: string;
  intro?: Child;
  body: Child[];
  submitLabel: string;
  danger?: boolean;
  onSubmit: (form: HTMLFormElement) => Promise<string | null>;
}

/** Native modal dialog: focus moves in, Escape closes, focus returns to the opener, submit is single-flight. */
export function openDialog(spec: DialogSpec) {
  const opener = document.activeElement as HTMLElement | null;
  const id = `dlg-${Math.random().toString(36).slice(2)}`;
  const err = h('p', { class: 'err', role: 'alert', hidden: true });
  const submit = h('button', { type: 'submit', class: spec.danger ? 'danger' : '' }, spec.submitLabel);
  const cancel = h('button', { type: 'button', class: 'secondary', onclick: () => dlg.close() }, 'Cancel');
  const form = h('form', { method: 'dialog', novalidate: true },
    h('div', { class: 'dhead' }, h('h2', { id: `${id}-t` }, spec.title), h('button', { type: 'button', class: 'ghost', 'aria-label': 'Close dialog', onclick: () => dlg.close() }, '✕')),
    spec.intro ? h('div', { class: 'muted small', id: `${id}-d` }, spec.intro) : null,
    h('div', { class: 'stack' }, ...spec.body),
    err,
    h('div', { class: 'actions', style: 'margin-top:18px;justify-content:flex-end' }, cancel, submit));
  const dlg = h('dialog', { 'aria-labelledby': `${id}-t`, 'aria-describedby': spec.intro ? `${id}-d` : undefined }, form);
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true; submit.disabled = true; err.hidden = true;
    try {
      const problem = await spec.onSubmit(form);
      if (problem) { err.textContent = problem; err.hidden = false; (form.querySelector('input,select,textarea') as HTMLElement | null)?.focus(); }
      else dlg.close();
    } finally { busy = false; submit.disabled = false; }
  });
  dlg.addEventListener('close', () => { dlg.remove(); if (opener && document.contains(opener)) opener.focus(); else document.getElementById('main')?.focus(); });
  document.body.append(dlg);
  dlg.showModal();
  (form.querySelector('.stack input, .stack select, .stack textarea') as HTMLElement | null ?? submit).focus();
}

export function chip(text: string, kind: string, title?: string) {
  return h('span', { class: `chip ${kind}`, title }, text);
}
export const statusKind = (s: string) => ({ READY: 'ok', RESOLVED: 'ok', RANKED: 'ok', COMPARABLE: 'ok', PASS: 'ok', HOLD: 'hold', MISSING: 'missing', UNKNOWN: 'unknown', INSUFFICIENT: 'hold', STALE: 'stale', ABSTAIN: 'abstain', NO_BASELINE: 'abstain', FAIL: 'bad', EXCLUDED: 'excluded' } as Record<string, string>)[s] ?? 'neutral';
export const statusIcon = (s: string) => ({ READY: '✓', RESOLVED: '✓', RANKED: '✓', PASS: '✓', HOLD: '‖', MISSING: '?', UNKNOWN: '?', STALE: '△', ABSTAIN: '✕', FAIL: '✕', EXCLUDED: '–', NO_BASELINE: '✕', INSUFFICIENT: '‖' } as Record<string, string>)[s] ?? '';
export const statusChip = (s: string, title?: string) => chip(`${statusIcon(s)} ${s.replace('_', ' ')}`.trim(), statusKind(s), title);
export function randomKey(prefix: string) {
  const b = new Uint8Array(12); crypto.getRandomValues(b);
  return `${prefix}-${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
