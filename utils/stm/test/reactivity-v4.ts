// reactivity-v4.ts
// ─────────────────────────────────────────────
// Core reactive engine with scheduler & lazy Computed
// ─────────────────────────────────────────────

type SchedulerPriority = 'immediate' | 'microtask' | 'animationFrame' | 'idle';

let currentContext: Computed | Effect | undefined;
let batchedEffects: Set<Effect> | null = null;

// --- Polyfills for non-browser environments (Bun / Node) ---
if (typeof globalThis.requestAnimationFrame === "undefined") {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16); // ~60fps fallback
}

if (typeof globalThis.cancelAnimationFrame === "undefined") {
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}

if (typeof globalThis.requestIdleCallback === "undefined") {
  (globalThis as any).requestIdleCallback = (cb: Function, opts?: { timeout?: number }) => {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, opts?.timeout ?? 1);
  };
}

if (typeof globalThis.cancelIdleCallback === "undefined") {
  (globalThis as any).cancelIdleCallback = (id: any) => clearTimeout(id);
}

let pendingEffects: Map<SchedulerPriority, Set<Effect>> = new Map([
  ['immediate', new Set()],
  ['microtask', new Set()],
  ['animationFrame', new Set()],
  ['idle', new Set()],
]);

let flushScheduled = false;

function queueEffect(eff: Effect, priority: SchedulerPriority) {
  const set = pendingEffects.get(priority)!;
  set.add(eff);
  if (!flushScheduled) {
    flushScheduled = true;
    scheduleFlush();
  }
}

function scheduleFlush() {
  // приоритетная очередь — сначала immediate, потом microtask, frame, idle
  queueMicrotask(flushEffects);
}

async function flushEffects() {
  flushScheduled = false;
  const order: SchedulerPriority[] = ['immediate', 'microtask', 'animationFrame', 'idle'];

  for (const priority of order) {
    const effects = pendingEffects.get(priority)!;
    if (effects.size === 0) continue;

    const toRun = Array.from(effects);
    effects.clear();

    if (priority === 'animationFrame') {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    } else if (priority === 'idle' && 'requestIdleCallback' in globalThis) {
      await new Promise<void>((r) =>
        (requestIdleCallback as any)(() => r(), { timeout: 50 })
      );
    }

    for (const eff of toRun) eff.run();
  }
}

export function batch(fn: () => void) {
  const outer = !!batchedEffects;
  if (!outer) batchedEffects = new Set();

  try {
    fn();
  } finally {
    if (!outer) {
      const toRun = batchedEffects!;
      batchedEffects = null;
      for (const eff of toRun) eff.run();
      toRun.clear();
    }
  }
}

export interface Link {
  source: Signal;
  target: Computed | Effect;
  nextSource?: Link;
  prevSource?: Link;
  nextTarget?: Link;
  prevTarget?: Link;
}

export class Signal<T = any> {
  _value: T;
  _version = 0;
  _targets?: Link;

  constructor(value: T) {
    this._value = value;
  }

  get v() {
    const ctx = currentContext;
    if (ctx) {
      const link: Link = { source: this, target: ctx };
      link.nextTarget = this._targets;
      if (this._targets) this._targets.prevTarget = link;
      this._targets = link;

      link.nextSource = ctx._sources;
      if (ctx._sources) ctx._sources.prevSource = link;
      ctx._sources = link;
    }
    return this._value;
  }

  set v(v: T) {
    if (v === this._value) return;
    this._value = v;
    this._version++;
    this._notify();
  }

  _notify() {
    const targets = this._targets;
    if (!targets) return;
    for (let node = targets; node; node = node.nextTarget) {
      node.target.markDirty();
    }
  }
}

export class Computed<T = any> {
  _sources?: Link;
  _targets?: Link;
  _dirty = true;
  _value!: T;
  fn: () => T;
  private _computing = false;

  constructor(fn: Computed['fn']) {
    this.fn = fn;
  }

  get v() {
    if (this._dirty) this.recompute();
    // стандартная зависимость
    if (currentContext) {
      const link: Link = { source: this as any, target: currentContext };
      link.nextTarget = this._targets;
      if (this._targets) this._targets.prevTarget = link;
      this._targets = link;

      link.nextSource = currentContext._sources;
      if (currentContext._sources) currentContext._sources.prevSource = link;
      currentContext._sources = link;
    }
    return this._value;
  }

  recompute() {
    if (this._computing) throw new Error('Circular dependency in Computed');
    this._computing = true;
    unlinkAllSources(this);
    const prev = currentContext;
    currentContext = this;
    try {
      const next = this.fn();
      this._value = next;
      this._dirty = false;
    } finally {
      currentContext = prev;
      this._computing = false;
    }
  }

  markDirty() {
    if (!this._dirty) {
      this._dirty = true;
      this._notify();
    }
  }

  _notify() {
    const targets = this._targets;
    if (!targets) return;
    const outerBatch = !!batchedEffects;
    if (!outerBatch) batchedEffects = new Set();
    for (let n = targets; n; n = n.nextTarget) n.target.markDirty();
    if (!outerBatch) {
      const toRun = batchedEffects!;
      batchedEffects = null;
      for (const eff of toRun) eff.run();
      toRun.clear();
    }
  }
}

function unlinkAllSources(t: { _sources?: Link }) {
  let node = t._sources;
  if (!node) return;
  const toUnlink: Link[] = [];
  while (node) {
    toUnlink.push(node);
    node = node.nextSource;
  }
  for (const link of toUnlink) {
    const src = link.source as any;
    if (src._targets === link) {
      src._targets = link.nextTarget ?? undefined;
      if (link.nextTarget) link.nextTarget.prevTarget = undefined;
    } else {
      if (link.prevTarget) link.prevTarget.nextTarget = link.nextTarget;
      if (link.nextTarget) link.nextTarget.prevTarget = link.prevTarget;
    }
    link.nextSource = link.prevSource = link.nextTarget = link.prevTarget = undefined;
  }
  t._sources = undefined;
}

export class Effect {
  _sources?: Link;
  _dirty = true;
  private disposeFn?: () => void;
  private fn: () => void | (() => void);
  private isDisposed = false;
  private _running = false;
  private priority: SchedulerPriority;

  constructor(fn: Effect['fn'], priority: SchedulerPriority = 'microtask') {
    this.fn = fn;
    this.priority = priority;
    this.run();
  }

  run() {
    if (this.isDisposed || this._running) return;
    this._running = true;
    try {
      if (this.disposeFn) this.disposeFn();
      unlinkAllSources(this);
      const prev = currentContext;
      currentContext = this;
      try {
        const cleanup = this.fn();
        if (typeof cleanup === 'function') this.disposeFn = cleanup;
        this._dirty = false;
      } finally {
        currentContext = prev;
      }
    } finally {
      this._running = false;
    }
  }

  markDirty() {
    if (!this._dirty) {
      this._dirty = true;
      queueEffect(this, this.priority);
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.disposeFn) this.disposeFn();
    this.removeFromSources();
  }

  private removeFromSources() {
    let node = this._sources;
    if (!node) return;
    const toUnlink: Link[] = [];
    while (node) {
      toUnlink.push(node);
      node = node.nextSource;
    }
    for (const link of toUnlink) {
      const src = link.source as any;
      if (src._targets === link) {
        src._targets = link.nextTarget ?? undefined;
        if (link.nextTarget) link.nextTarget.prevTarget = undefined;
      } else {
        if (link.prevTarget) link.prevTarget.nextTarget = link.nextTarget;
        if (link.nextTarget) link.nextTarget.prevTarget = link.prevTarget;
      }
      link.nextSource = link.prevSource = link.nextTarget = link.prevTarget = undefined;
    }
    this._sources = undefined;
  }
}

// API
export const signal = <T>(v: T) => new Signal(v);
export const computed = <T>(fn: () => T) => new Computed(fn);
export const effect = (fn: () => void | (() => void), priority: SchedulerPriority = 'microtask') =>
  new Effect(fn, priority);


// const a = signal(1);
// const b = computed(() => a.v * 2);

// effect(() => console.log('[microtask]', b.v));                // по умолчанию
// effect(() => console.log('[frame]', b.v), 'animationFrame');  // кадр
// effect(() => console.log('[idle]', b.v), 'idle');             // низкий приоритет

// setInterval(() => {
//   a.v++;
// }, 50);