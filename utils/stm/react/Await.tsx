'use client';
import React, { useImperativeHandle, useRef, useEffect } from 'react';
import { useSignal, useWatch } from './react';
import { Active } from './Active';
import type { Signal, SignalV } from '..';

interface GlobalSub<T = any> {
  params: any;
  reset: AwaitHandle<T>['reset'];
  run: AwaitHandle<T>['run'];
}

const globalSubs: GlobalSub[] = [];

export const AwaitGlobal = {
  invalidate(matchParams?: any, newParams?: any) {
    for (const sub of globalSubs) {
      const sp = sub.params;
      const matches = Array.isArray(sp)
        ? Array.isArray(matchParams)
          ? JSON.stringify(sp) === JSON.stringify(matchParams)
          : sp.includes(matchParams)
        : typeof sp === 'object' && typeof matchParams === 'object'
        ? Object.entries(matchParams).every(([k, v]) => sp[k] === v)
        : sp === matchParams;

      if (matches || !matchParams) sub.run(newParams ?? sp);
    }
  },
};

export interface AwaitHandle<T = any> {
  run: (...args: any[]) => Promise<T>;
  reset: () => void;
  status: SignalV<'idle' | 'pending' | 'fulfilled' | 'rejected'>;
  value: SignalV<T | null>;
  error: SignalV<any>;
}

interface AwaitProps<T> {
  from: (params?: any) => () => Promise<T>;
  params?: any;
  cacheTime?: number;
  children: React.ReactNode;
  ref?: React.Ref<AwaitHandle<T>>;
  isOptimistic?: boolean;
}

export function useAwaitRef<T>() {
  const ref = useRef<AwaitHandle<T>>(null);
  return {
    ref,
    get run() {
      return ref.current?.run!;
    },
    get reset() {
      return ref.current?.reset!;
    },
    get status() {
      return ref.current?.status!;
    },
    get value() {
      return ref.current?.value!;
    },
    get error() {
      return ref.current?.error!;
    },
  };
}

function AwaitBase<T>({ from, params, cacheTime = 5 * 60 * 1000, children, ref, isOptimistic = false }: AwaitProps<T>) {
  const status = useSignal<'idle' | 'pending' | 'fulfilled' | 'rejected'>('idle');
  const value = useSignal<T | null>(null);
  const error = useSignal<any>(null);
  const isRefreshing = useSignal(false);

  const cacheRef = useRef(new Map<string, { data: any; ts: number }>());
  const getCacheKey = (p: any) => JSON.stringify(p ?? {});

  const run = React.useCallback(
    async (p = params) => {
      const key = getCacheKey(p);
      const now = performance.now();
      const cached = cacheRef.current.get(key);

      if (cached && now - cached.ts < cacheTime) {
        value.v = cached.data;
        status.v = 'fulfilled';
        return cached.data;
      }

      isRefreshing.v = !!value.v;
      status.v = 'pending';
      error.v = null;

      try {
        const fn = Array.isArray(p) ? from(...p) : from(p);
        const data = await fn();
        cacheRef.current.set(key, { data, ts: performance.now() });
        value.v = data;
        status.v = 'fulfilled';
        return data;
      } catch (err) {
        error.v = err;
        status.v = 'rejected';
        throw err;
      } finally {
        isRefreshing.v = false;
      }
    },
    [from, params, cacheTime]
  );

  const reset = React.useCallback(() => {
    status.v = 'idle';
    value.v = null;
    error.v = null;
  }, []);

  // --- регистрация глобально (аналог createObservableState) ---
  useEffect(() => {
    const sub = { params, reset, run };
    globalSubs.push(sub);
    return () => {
      const i = globalSubs.indexOf(sub);
      if (i !== -1) globalSubs.splice(i, 1);
    };
  }, [params, run, reset]);

  useImperativeHandle(ref, () => ({ run, reset, status, value, error }));

  useWatch(() => {
    if (params !== undefined && status.v === 'idle') {
      queueMicrotask(() => run(params));
    }
  });
  const st = { status, value, error, isRefreshing };

  return (
    <>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child, { st, isOptimistic } as any) : child
      )}
    </>
  );
}

AwaitBase.displayName = 'Await';

const Pending = ({ st, children, isOptimistic }: { st?: any; children: React.ReactNode; isOptimistic?: boolean }) => {
  const [refreshing, setRefreshing] = React.useState(st.isRefreshing.v);

  useWatch(() => {
    setRefreshing(st.isRefreshing.v);
  });

  if (refreshing && isOptimistic) return null;

  return (
    <Active sg={st.status} is="pending">
      {children}
    </Active>
  );
};

const Then = <T,>({ st, children }: { st: any; children: (v: T) => React.ReactNode }) => {
  const [val, setVal] = React.useState<T | null>(st.value.v);

  useWatch(() => {
    setVal(st.value.v);
  });

  return st.status.v === 'fulfilled' && val ? <>{children(val)}</> : null;
};

const Catch = ({ st, children }: { st: any; children: (e: any) => React.ReactNode }) => {
  const [err, setErr] = React.useState<any>(st.error.v);

  useWatch(() => {
    setErr(st.error.v);
  });

  return st.status.v === 'rejected' && err ? <>{children(err)}</> : null;
};

export const Await = Object.assign(AwaitBase, { Pending, Then, Catch });
