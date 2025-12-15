import {
  memo,
  useEffect as _useEffect,
  useRef,
  useEffect,
  type DependencyList,
} from 'react';
import { useSyncExternalStore } from 'react';
import {
  Computed,
  computed,
  Effect,
  effect,
  Signal,

} from '../index';
import { SignalV } from '../test/reactivity-v3';

export type Sig<T = any> =  Signal<T> | Computed<T> ;
type ExternalStore = <T>(signal: Sig<T>) => T;
type ReactSig = { c: React.JSX.Element };
// export type TRMapSignal<T, R extends object = ReactSig> =
//   T extends (infer U)[] ? SignalArrayMethods<U, T, R> : never;
export type TRSignal<T> = SignalV<T, ReactSig>;

function useSignalListener(): [() => void, ExternalStore] {
  const listeners = useRef<Set<() => void>>(new Set());
  const middleware = useRef(() => {
    for (const l of listeners.current) l();
  });

  function externalStore<T>(signal: Sig<T>) {
    return useSyncExternalStore(
      (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
      () => signal.v,
      () => signal.v
    );
  }

  return [middleware.current, externalStore];
}

function definedComponent(externalStore: ExternalStore, sig: Sig) {
  const Comp = memo(() => {
    const value = externalStore(sig);
    return renderValue(value);
  });
  Object.defineProperty(sig, 'c', {
    configurable: true,
    enumerable: false,
    value: <Comp />,
  });
}

export function renderValue<T>(value: T): React.ReactElement {
  if (typeof value === 'object' && value !== null && 'type' in (value as any)) {
    return value as unknown as React.ReactElement;
  }

  return <>{String(value)}</>;
}

export function useSignal<T>(initialValue: T): TRSignal<T> {
  const [middleware, externalStore] = useSignalListener();
  const sigRef = useRef<Signal>(null);

  if (!sigRef.current) {
    sigRef.current = new Signal(initialValue);
    const sig = sigRef.current;
    definedComponent(externalStore, sig);
  }

  return sigRef.current as any;
}

export function useComputed<T>(fn: () => T): TRSignal<T> {
  const [middleware, externalStore] = useSignalListener();

  const compRef = useRef<Computed<T>>(null);
  if (!compRef.current) {
    compRef.current = computed(fn);
    const comp = compRef.current;
    effect(() => {
      comp.v;
      middleware();
    });
    definedComponent(externalStore, comp);
  }

  return compRef.current as any;
}

export function useWatch(fn: () => void | (() => void)) {
  const cb = useRef(fn);
  cb.current = fn;

  _useEffect(() => {
    const eff = new Effect(() => {
      return cb.current();
    });

    return () => eff.dispose();
  }, []);
}

// export function useSignalMap<T extends any[]>(
//   initialValue: T,
//   deps: DependencyList = []
// ): TRMapSignal<T> {
//   const [middleware, externalStore] = useSignalListener();
//   const [middleware1, externalStore1] = useSignalListener();

//   const sigMapRef = useRef<SignalMap<T>>(null);
//   const refEffect = useRef<Effect>(null);

//   useEffect(() => {
//     sigMapRef.current = null;
//     refEffect.current?.dispose();
//   }, [...deps]);

//   if (!sigMapRef.current) {
//     sigMapRef.current = new SignalMap(
//       initialValue,
//       () => middleware(),
//       (comp: SignalV<any>) => {
//         definedComponent(externalStore, comp);
//       }
//     );

//     const signal = sigMapRef.current;
//     refEffect.current = effect(() => {
//       signal.v;
//       middleware1();
//     });

//     Object.defineProperty(signal, 'map', {
//       configurable: true,
//       enumerable: false,
//       value: (renderFn: (item: any, index: number) => React.ReactNode) => {
//         const Map = memo(() => {
//           const state = externalStore1(signal);

//           return state.map(renderFn);
//         });
//         Map.displayName = 'Map';
//         return <Map />;
//       },
//     });
//   }

//   return sigMapRef.current as any;
// }
