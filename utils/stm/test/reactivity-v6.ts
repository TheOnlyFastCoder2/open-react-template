// reactivity-v6.ts
// ──────────────────────────────────────────────
// Adaptive Phased Scheduler + Reactive Core
// ──────────────────────────────────────────────

type Priority = "high" | "normal" | "low";
type Phase = "update" | "commit" | "idle";

let currentContext: Computed | Effect | undefined;
let batchedEffects: Set<Effect> | null = null;

const queues = {
  high: new Set<Effect>(),
  normal: new Set<Effect>(),
  low: new Set<Effect>(),
};

let phase: Phase = "idle";
let lastFrameTime = performance.now();
let frameCount = 0;
let flushScheduled = false;
let avgFrameMs = 0;

// FPS target: 60fps ≈ 16.6ms
const TARGET_FRAME_MS = 16.6;
const MAX_FRAME_MS = 25;

// Polyfill for Bun
if (typeof globalThis.requestAnimationFrame === "undefined") {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16);
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}

// ──────────────────────────────────────────────
// Internal scheduler logic
// ──────────────────────────────────────────────
export function schedule(eff: Effect) {
  queues[eff.priority].add(eff);
  if (!flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(runFrame);
  }
}

async function runFrame() {
  flushScheduled = false;
  phase = "update";
  const start = performance.now();

  // 1️⃣ UPDATE PHASE — high-priority first
  for (const eff of Array.from(queues.high)) eff.run();
  queues.high.clear();

  const afterHigh = performance.now();

  // 2️⃣ NORMAL PHASE — until time budget runs out
  for (const eff of Array.from(queues.normal)) {
    if (performance.now() - start > TARGET_FRAME_MS) {
      // перенести оставшиеся эффекты в low
      queues.low.add(eff);
      continue;
    }
    eff.run();
    queues.normal.delete(eff);
  }

  // 3️⃣ COMMIT PHASE
  phase = "commit";

  const afterCommit = performance.now();

  // 4️⃣ LOW PHASE (отложенные эффекты, если есть бюджет)
  if (afterCommit - start < MAX_FRAME_MS) {
    for (const eff of Array.from(queues.low)) {
      if (performance.now() - start > MAX_FRAME_MS) break;
      eff.run();
      queues.low.delete(eff);
    }
  }

  // 💤 Остальные эффекты → ждут следующего кадра
  if (
    queues.high.size > 0 ||
    queues.normal.size > 0 ||
    queues.low.size > 0
  ) {
    flushScheduled = true;
    requestAnimationFrame(runFrame);
  }

  // 📊 Stats
  const now = performance.now();
  const duration = now - start;
  frameCount++;
  avgFrameMs = (avgFrameMs * 0.9 + duration * 0.1);

  if (frameCount % 30 === 0) {
    console.log(
      `🎯 Frame ${frameCount}: ${duration.toFixed(2)}ms (avg=${avgFrameMs.toFixed(
        2
      )}) | q={H:${queues.high.size},N:${queues.normal.size},L:${queues.low.size}}`
    );
  }

  phase = "idle";
}

// ──────────────────────────────────────────────
// Core reactivity system (same API as before)
// ──────────────────────────────────────────────
export class Signal<T = any> {
  _value: T;
  _targets?: Link;
  constructor(value: T) {
    this._value = value;
  }

  get v() {
    const ctx = currentContext;
    if (ctx) {
      const link: Link = { source: this, target: ctx };
      link.nextTarget = this._targets;
      this._targets = link;
      link.nextSource = ctx._sources;
      ctx._sources = link;
    }
    return this._value;
  }

  set v(v: T) {
    if (v === this._value) return;
    this._value = v;
    this._notify();
  }

  _notify() {
    for (let node = this._targets; node; node = node.nextTarget) {
      node.target.markDirty();
    }
  }
}

export interface Link {
  source: Signal;
  target: Computed | Effect;
  nextSource?: Link;
  nextTarget?: Link;
}

export class Computed<T = any> {
  _sources?: Link;
  _targets?: Link;
  _dirty = true;
  _value!: T;
  fn: () => T;

  constructor(fn: () => T) {
    this.fn = fn;
  }

  get v() {
    if (this._dirty) this.recompute();
    if (currentContext) {
      const link: Link = { source: this as any, target: currentContext };
      link.nextTarget = this._targets;
      this._targets = link;
      link.nextSource = currentContext._sources;
      currentContext._sources = link;
    }
    return this._value;
  }

  recompute() {
    this._sources = undefined;
    const prev = currentContext;
    currentContext = this;
    try {
      this._value = this.fn();
      this._dirty = false;
    } finally {
      currentContext = prev;
    }
  }

  markDirty() {
    if (!this._dirty) {
      this._dirty = true;
      for (let n = this._targets; n; n = n.nextTarget) {
        n.target.markDirty();
      }
    }
  }
}

export class Effect {
  _sources?: Link;
  _dirty = true;
  private fn: () => void | (() => void);
  private disposeFn?: () => void;
  isDisposed = false;
  priority: Priority;

  constructor(fn: () => void | (() => void), priority: Priority = "normal") {
    this.fn = fn;
    this.priority = priority;
    this.run();
  }

  run() {
    if (this.isDisposed) return;
    if (this.disposeFn) this.disposeFn();
    this._sources = undefined;
    const prev = currentContext;
    currentContext = this;
    try {
      const cleanup = this.fn();
      if (typeof cleanup === "function") this.disposeFn = cleanup;
      this._dirty = false;
    } finally {
      currentContext = prev;
    }
  }

  markDirty() {
    if (!this._dirty) {
      this._dirty = true;
      schedule(this);
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.disposeFn) this.disposeFn();
    this._sources = undefined;
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
export const signal = <T>(v: T) => new Signal(v);
export const computed = <T>(fn: () => T) => new Computed(fn);
export const effect = (
  fn: () => void | (() => void),
  priority: Priority = "normal"
) => new Effect(fn, priority);


const counter = signal(0);
const doubled = computed(() => counter.v * 2);

// Высокоприоритетные эффекты — анимация
effect(() => {
  console.log("🎞 high:", doubled.v);
}, "high");

// Средний приоритет — бизнес-логика
effect(() => {
  const value = doubled.v;
  for (let i = 0; i < 10_000_000; i++); // имитация нагрузки
  console.log("⚙️ normal done:", value);
}, "normal");

// Низкий приоритет — аналитика
effect(() => {
  console.log("📊 low analytics:", doubled.v);
}, "low");

setInterval(() => {
  counter.v++;
}, 50);