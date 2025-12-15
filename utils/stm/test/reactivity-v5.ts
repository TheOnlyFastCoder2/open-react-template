// reactivity-v5.ts
// ─────────────────────────────────────────────────────────
// Adaptive reactive engine with self-tuning scheduler
// ─────────────────────────────────────────────────────────

type SchedulerPriority = 'immediate' | 'microtask' | 'animationFrame' | 'idle';

let currentContext: Computed | Effect | undefined;
let batchedEffects: Set<Effect> | null = null;

// Pending effect queues per priority
const pendingEffects = new Map<SchedulerPriority, Set<Effect>>([
  ['immediate', new Set()],
  ['microtask', new Set()],
  ['animationFrame', new Set()],
  ['idle', new Set()],
]);

// Performance tracking
let lastFlushDuration = 0;
let flushScheduled = false;
let adaptiveEnabled = true;

// --- Polyfills for Bun / Node ---
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16);
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}
if (typeof globalThis.requestIdleCallback === 'undefined') {
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
if (typeof globalThis.cancelIdleCallback === 'undefined') {
  (globalThis as any).cancelIdleCallback = (id: any) => clearTimeout(id);
}

// ───────────────────────────────────────────────
// Core scheduler logic
// ───────────────────────────────────────────────
function queueEffect(eff: Effect, priority: SchedulerPriority) {
  const set = pendingEffects.get(priority)!;
  set.add(eff);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushEffects);
  }
}

async function flushEffects() {
  const start = performance.now();
  flushScheduled = false;

  const priorities: SchedulerPriority[] = ['immediate', 'microtask', 'animationFrame', 'idle'];

  // 🧩 собираем статистику ДО очистки
  const countsBefore: Record<SchedulerPriority, number> = {
    immediate: pendingEffects.get('immediate')!.size,
    microtask: pendingEffects.get('microtask')!.size,
    animationFrame: pendingEffects.get('animationFrame')!.size,
    idle: pendingEffects.get('idle')!.size,
  };

  for (const p of priorities) {
    const effects = pendingEffects.get(p)!;
    if (effects.size === 0) continue;

    const toRun = Array.from(effects);
    // ⚠️ ВАЖНО: очищаем ПОСЛЕ измерения
    effects.clear();

    if (p === 'animationFrame') {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    } else if (p === 'idle' && 'requestIdleCallback' in globalThis) {
      await new Promise<void>((r) => (requestIdleCallback as any)(() => r(), { timeout: 50 }));
    }

    for (const eff of toRun) eff.run();
  }

  lastFlushDuration = performance.now() - start;

  console.log(
    `🌀 flush: ${lastFlushDuration.toFixed(2)}ms | micro=${countsBefore.microtask} | idle=${countsBefore.idle}`
  );
  console.log(
    `⚙️ Queues now: micro=${pendingEffects.get('microtask')!.size}, idle=${pendingEffects.get('idle')!.size}`
  );
  // ⚙️ Теперь адаптация имеет данные о размерах очереди
  if (adaptiveEnabled) {
    autoTunePriorities(countsBefore);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flushEffects);
    }
  }
}
let lastAdapt = 0;
function autoTunePriorities(counts?: Record<SchedulerPriority, number>) {
  const now = performance.now();
  if (now - lastAdapt < 2000) return; // не чаще раза в 2 сек
  lastAdapt = now;

  const micro = pendingEffects.get('microtask')!;
  const idle = pendingEffects.get('idle')!;
  const microCount = counts?.microtask ?? micro.size;
  const idleCount = counts?.idle ?? idle.size;

  if (lastFlushDuration > 8 && microCount > 20) {
    const downgrade = Math.floor(microCount / 3);
    for (let i = 0; i < downgrade; i++) {
      const eff = Array.from(micro)[i];
      if (!eff) break;
      micro.delete(eff);
      eff.priority = 'idle';
      idle.add(eff);
    }
    console.log(`⚠️ Adaptive: downgraded ${downgrade} effects → idle`);
  } else if (lastFlushDuration < 2 && idleCount > 5) {
    const upgrade = Math.floor(idleCount / 4);
    for (let i = 0; i < upgrade; i++) {
      const eff = Array.from(idle)[i];
      if (!eff) break;
      idle.delete(eff);
      eff.priority = 'microtask';
      micro.add(eff);
    }
    console.log(`💨 Adaptive: upgraded ${upgrade} idle effects → microtask`);
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

// ───────────────────────────────────────────────
// Core reactive primitives
// ───────────────────────────────────────────────
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
    const t = this._targets;
    if (!t) return;
    for (let n = t; n; n = n.nextTarget) n.target.markDirty();
  }
}

export class Computed<T = any> {
  _sources?: Link;
  _targets?: Link;
  _dirty = true;
  _value!: T;
  fn: () => T;
  private _computing = false;

  constructor(fn: () => T) {
    this.fn = fn;
  }

  get v() {
    if (this._dirty) this.recompute();
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
    if (this._computing) throw new Error('Circular Computed');
    this._computing = true;
    unlinkAllSources(this);
    const prev = currentContext;
    currentContext = this;
    try {
      this._value = this.fn();
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
    const t = this._targets;
    if (!t) return;
    const outer = !!batchedEffects;
    if (!outer) batchedEffects = new Set();
    for (let n = t; n; n = n.nextTarget) n.target.markDirty();
    if (!outer) {
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
  priority: SchedulerPriority;

  constructor(fn: () => void | (() => void), priority: SchedulerPriority = 'microtask') {
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
    unlinkAllSources(this);
  }
}

// ───────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────
export const signal = <T>(v: T) => new Signal(v);
export const computed = <T>(fn: () => T) => new Computed(fn);
export const effect = (fn: () => void | (() => void), priority: SchedulerPriority = 'microtask') =>
  new Effect(fn, priority);

const src = signal(0);
const derived = computed(() => src.v * 2);

for (let i = 0; i < 400; i++) {
  effect(() => {
    // создаём вычисление, чтобы загрузить CPU
    let n = 0;
    const v = derived.v;
    for (let j = 0; j < 10_000_000; j++) n += (v + j) % 3;
  }, 'microtask');
}

// каждые 100 мс меняем сигнал — нагрузка высокая
setInterval(() => {
  src.v++;
}, 100);

// debug-пинг
setInterval(() => {
  console.log('tick');
}, 500);
