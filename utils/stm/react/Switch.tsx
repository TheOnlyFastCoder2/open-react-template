'use client';
import React from 'react';
import { useSignal, type TRSignal } from './react';
import { Active } from './Active';
import type { Signal } from '..';




interface SwitchProps<T> {
  sg: TRSignal<T> | Signal<T>;
  children: React.ReactNode;
}

type CaseCondition<T> = T | T[] | ((v: T) => boolean);

interface CaseProps<T> {
  is: CaseCondition<T>;
  children: React.ReactNode;
}

interface DefaultProps {
  children: React.ReactNode;
}


export function Switch<T>({ sg, children }: SwitchProps<T>) {
  const isDefault = useSignal(false);
  const count = useSignal<[number, number]>([0, 0]);
  const len = React.Children.count(children);

  return (
    <>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              sg,
              isDefault,
              count,
              len,
            } as any)
          : child
      )}
    </>
  );
}

Switch.Case = function Case<T>({
  sg,
  is,
  isDefault,
  count,
  len,
  children,
}: CaseProps<T> & {
  sg?: TRSignal<T>;
  isDefault?: ReturnType<typeof useSignal<boolean>>;
  count?: ReturnType<typeof useSignal<[number, number]>>;
  len?: number;
}) {
  const condition = is as T | T[] | ((v: T) => boolean);

  return (
    <Active
      sg={sg!}
      is={condition}
      callback={(match) => {
        const [i, matched] = count!.v;
        count!.v = [((i + 1) % (len ?? 1)), (matched + (match ? 1 : 0))];
        isDefault!.v = (count!.v as any)[1] === 0;

        if (count!.v[0] >= (len ?? 1) - 1) {
          count!.v = [0, 0];
        }
      }}
    >
      {children}
    </Active>
  );
};


Switch.Default = function Default<T>({
  isDefault,
  children,
}: DefaultProps & { sg?: TRSignal<T>; isDefault?: ReturnType<typeof useSignal<boolean>> }) {
  return (
    <Active sg={isDefault!} is={true}>
      {children}
    </Active>
  );
};
