let currentContext: Computed | Effect | undefined;
let batchedEffects: Set<Effect> | null = null;

let pendingEffects: Set<Effect> | null = null;
let flushScheduled = false;

function scheduleEffectRun(eff: Effect) {
  if (!pendingEffects) pendingEffects = new Set();
  pendingEffects.add(eff);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushEffects);
  }
}

function flushEffects() {
  if (!pendingEffects) return;
  const toRun = Array.from(pendingEffects);
  pendingEffects = null;
  flushScheduled = false;
  for (const eff of toRun) eff.run();
}

export function batch(fn: () => void) {
  const outer = !!batchedEffects;
  if (!outer) batchedEffects = new Set();

  try {
    fn();
  } finally {
    if (!outer) {
      const toRun = Array.from(batchedEffects!);
      batchedEffects = null;
      for (const eff of toRun) eff.run();
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
  _middleware?: (v: Signal<T>) => void;

  constructor(value: T, middlewareCallback?: (v: Signal<T>) => void) {
    this._value = value;
    this._middleware = middlewareCallback;
  }

  get v() {
    const ctx = currentContext;
    if (ctx) {
      const link: Link = { source: this, target: ctx };

      // привязываем к списку targets источника
      link.nextTarget = this._targets;
      if (this._targets) this._targets.prevTarget = link; // <— ВАЖНО
      this._targets = link;

      // привязываем к списку sources таргета
      link.nextSource = ctx._sources;
      if (ctx._sources) ctx._sources.prevSource = link; // <— ВАЖНО
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
    this._middleware?.(this);
    const targets = this._targets;
    if (!this._targets) return;
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

  constructor(fn: Computed['fn']) {
    this.fn = fn;
  }
  get v() {
    if (this._dirty) this.recompute();

    if (currentContext) {
      // Computed.get v (когда есть currentContext)
      const link: Link = { source: this as any, target: currentContext };
      link.nextTarget = this._targets;
      if (this._targets) this._targets.prevTarget = link; // <— ВАЖНО
      this._targets = link;

      link.nextSource = currentContext._sources;
      if (currentContext._sources) currentContext._sources.prevSource = link; // <— ВАЖНО
      currentContext._sources = link;
    }

    return this._value;
  }

  recompute() {
    unlinkAllSources(this);
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
      this._notify();
    }
  }

  _notify() {
    const targets = this._targets;
    if (!this._targets) return;
    const outerBatch = !!batchedEffects;
    if (!outerBatch) batchedEffects = new Set();

    for (let n = targets; n; n = n.nextTarget) {
      n.target.markDirty();
    }
    if (!outerBatch) {
      const toRun = Array.from(batchedEffects!);
      batchedEffects = null;
      for (const eff of toRun) eff.run();
    }
  }
}

export function untracked<T>(fn: () => T): T {
  const prev = currentContext;

  currentContext = undefined;
  try {
    return fn();
  } finally {
    currentContext = prev;
  }
}

export class Effect {
  _sources?: Link;
  _dirty = true;
  private disposeFn?: () => void;
  private fn: () => void | (() => void);
  private isDisposed = false; 

  constructor(fn: Effect['fn']) {
    this.fn = fn;
    this.run();
  }

  run() {
    if (this.isDisposed) return;
    if (this.disposeFn) this.disposeFn();
  
    unlinkAllSources(this);
    this._sources = undefined;
    const prev = currentContext;
    currentContext = this;
    try {
      const cleanup = this.fn();
      if (typeof cleanup === 'function') this.disposeFn = cleanup;
      this._dirty = false;
    } finally {
      currentContext = prev;
    }
  }

  markDirty() {
    if (!this._dirty) {
      this._dirty = true;
      scheduleEffectRun(this);
    }
  }

  dispose() {
    this.isDisposed = true;

    if (this.disposeFn) this.disposeFn();
    this.removeFromPendingEffects();
    this.removeFromSources();
    this._sources = undefined;
  }

  private removeFromSources() {
    let node = this._sources;
    while (node) {
      const next = node.nextSource;

      const src = node.source as any;
      // удаляем link из src._targets (список target-ссылок)
      if (src._targets === node) {
        src._targets = node.nextTarget ?? undefined;
        if (node.nextTarget) node.nextTarget.prevTarget = undefined;
      } else {
        if (node.prevTarget) node.prevTarget.nextTarget = node.nextTarget;
        if (node.nextTarget) node.nextTarget.prevTarget = node.prevTarget;
      }

      node.nextSource = node.prevSource = undefined;
      node.nextTarget = node.prevTarget = undefined;

      node = next;
    }
    this._sources = undefined;
  }

  private removeFromPendingEffects() {
    if (batchedEffects) {
      batchedEffects.delete(this);
    }
    if (pendingEffects) {
      pendingEffects.delete(this);
    }
  }
}

function unlinkAllSources(t: { _sources?: Link }) {
  let node = t._sources;
  while (node) {
    const next = node.nextSource;

    // убрать node из списка targets на source
    const src = node.source as any;
    const tHead = src._targets as Link | undefined;
    // если этот link — голова
    if (tHead === node) {
      src._targets = node.nextTarget ?? undefined;
      if (node.nextTarget) node.nextTarget.prevTarget = undefined;
    } else {
      // обычное удаление из двусвязного списка targets
      if (node.prevTarget) node.prevTarget.nextTarget = node.nextTarget;
      if (node.nextTarget) node.nextTarget.prevTarget = node.prevTarget;
    }

    // обнулить собственные указатели
    node.nextSource = node.prevSource = undefined;
    node.nextTarget = node.prevTarget = undefined;

    node = next;
  }
  t._sources = undefined;
}

export type Primitive = string | number | boolean | symbol | bigint | null | undefined;
export type SignalArrayMethods<U, T, R extends object = {}> = {
  v: TSignal<T, R>[];
  _value: TSignal<T, R>;
  _version: 0;
  _targets?: Link;
  length: number;
  push: (...items: U[]) => number;
  pop: () => TSignal<U, R> | undefined;
  shift: () => TSignal<U, R> | undefined;
  unshift: (...items: U[]) => number;
  splice: (start: number, deleteCount?: number, ...items: U[]) => TSignal<U, R>[];
  sort: (compareFn?: (a: TSignal<U, R>, b: TSignal<U, R>) => number) => TSignal<U, R>[];
  reverse: () => TSignal<U, R>[];
  forEach(fn: (item: TSignal<U, R>, index: number, array: Signal<T>[]) => void): void;
  map(fn: (item: TSignal<U, R>, index: number, array: TSignal<U, R>[]) => void): any[];
  some(fn: (item: TSignal<U, R>, index: number, array: TSignal<U, R>[]) => boolean): boolean;
  effectMap(fn: (item: T, index: number, array: T[]) => void | (() => void)): Effect;
};

export type SignalV<T, R extends object = any> = {
  v: T;
  _value: T;
  _version: 0;
  _targets?: Link;
} & R;

export type TSignal<T, R extends object = {}> = T extends Primitive
  ? SignalV<T, R>
  : T extends (infer U)[]
  ? TSignal<U, R>[] & SignalV<U, R>
  : {
      [K in keyof T]: TSignal<T[K], R>;
    } & SignalV<T, R>;

function wrapItemInSignals<T>(
  item: T,
  mdw?: (v: TSignal<any>) => void,
  defender?: (sg: TSignal<any>) => void
): { [key: string]: Signal<any> } | Signal<T> {
  if (typeof item === 'object' && item !== null) {
    const wrappedItem: any = {};
    for (const key in item) {
      wrappedItem[key] = new Signal(item[key], mdw as any);
      defender?.(wrappedItem[key]);
    }
    return wrappedItem;
  }
  const sg = new Signal(item, mdw as any);
  defender?.(sg as any);
  return sg;
}

export class SignalMap<T> extends Signal<T[]> {
  defender?: (sg: TSignal<any>) => void;
  mdw?: (v: TSignal<any>) => void;
  constructor(initial: T[] = [], mdw?: SignalMap<any>['mdw'], defender?: SignalMap<any>['defender']) {
    super(initial.map((item) => wrapItemInSignals(item, mdw, defender)) as any);
    this.defender = defender;
    this.mdw = mdw;
    effect(() => {
      const arr = this.v ?? [];
      arr.length;
    });
  }

  forEach(fn: (item: Signal<T>, index: number, array: Signal<T>[]) => void) {
    const arr = this.v ?? [];
    for (let i = 0; i < arr.length; i++) {
      fn(arr[i] as any, i, arr as any);
    }
  }

  effectMap(fn: (item: T, index: number, array: T[]) => void | (() => void)) {
    return new Effect(() => {
      const arr = this.v ?? [];
      for (let i = 0; i < arr.length; i++) {
        fn(arr[i], i, arr);
      }
    });
  }

  push(...items: T[]) {
    const arr = this.v ?? [];
    items.forEach((item) => {
      const wrappedItem = wrapItemInSignals(item, this.mdw, this.defender);
      arr.push(wrappedItem as any);
    });
    this.v = [...arr];
  }

  splice(start: number, deleteCount?: number, ...items: T[]) {
    const arr = this.v ?? [];
    const next = [...arr];
    if (items.length > 0) {
      items.forEach((item) => {
        const wrappedItem = wrapItemInSignals(item, this.mdw, this.defender);
        next.splice(start, deleteCount as any, wrappedItem as any);
      });
    } else {
      next.splice(start, deleteCount);
    }
    this.v = next;
  }
  get length() {
    return (this.v ?? []).length;
  }
  reverse() {
    const arr = this.v ?? [];
    this.v = [...arr].reverse();
  }

  sort(compareFn?: (a: T, b: T) => number) {
    const arr = this.v ?? [];
    this.v = [...arr].sort(compareFn);
  }

  pop() {
    const arr = this.v ?? [];
    const next = [...arr];
    next.pop();
    this.v = next;
  }

  shift() {
    const arr = this.v ?? [];
    const next = [...arr];
    next.shift();
    this.v = next;
  }

  unshift(...items: T[]) {
    const arr = this.v ?? [];
    items.forEach((item) => {
      const wrappedItem = wrapItemInSignals(item, this.mdw, this.defender);
      arr.unshift(wrappedItem as any);
    });
    this.v = [...arr];
  }

  some(fn: (item: TSignal<T, any>, index: number, array: TSignal<T, any>[]) => boolean): boolean {
    const arr = (this.v ?? []) as unknown as TSignal<T, any>[];
    for (let i = 0; i < arr.length; i++) {
      if (fn(arr[i], i, arr)) return true;
    }
    return false;
  }
}

export const signal = <T>(value: T) => new Signal<T>(value);
export const signalMap = <T extends Array<T>>(value: T) => new Signal<T>(value);
export const computed = <T>(fn: () => T) => new Computed<T>(fn);
export const effect = (fn: () => void | (() => void)) => new Effect(fn);


