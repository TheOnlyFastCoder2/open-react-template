import type { JSX } from "react";
import type { Signal } from "..";
import { useSignal, type TRSignal } from "./react";
import { Active } from "./Active";

type CaseCondition<T> = T | T[] | ((v: T) => boolean);

interface CaseProps<T> {
  is: CaseCondition<T>;
  children: React.ReactNode;
}

interface SwitchProps<T> {
  sg: TRSignal<T> | Signal<T>;
  children:
    | React.ReactElement<CaseProps<T>>
    | React.ReactElement<CaseProps<T>>[];
}
interface DefaultProps {
  children: React.ReactNode;
}

function SwitchInner<T>({ sg, children }: SwitchProps<T>) {
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

function CaseInner<T>({
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
  const condition = is as CaseCondition<T>;

  return (
    <Active
      sg={sg!}
      is={condition}
      callback={(match) => {
        const [i, matched] = count!.v;
        count!.v = [((i + 1) % (len ?? 1)), matched + (match ? 1 : 0)];
        isDefault!.v = (count!.v as any)[1] === 0;

        if (count!.v[0] >= (len ?? 1) - 1) {
          count!.v = [0, 0];
        }
      }}
    >
      {children}
    </Active>
  );
}

function DefaultInner<T>({
  isDefault,
  children,
}: DefaultProps & {
  sg?: TRSignal<T>;
  isDefault?: ReturnType<typeof useSignal<boolean>>;
}) {
  return (
    <Active sg={isDefault!} is={true}>
      {children}
    </Active>
  );
}

// объединяем в один компонент с дженериками наружу
type SwitchComponent = {
  <T>(props: SwitchProps<T>): JSX.Element;
  Case: <T>(props: CaseProps<T>) => JSX.Element;
  Default: <T>(props: DefaultProps & { sg?: TRSignal<T>; isDefault?: ReturnType<typeof useSignal<boolean>> }) => JSX.Element;
};

export const Switch = SwitchInner as SwitchComponent;
Switch.Case = CaseInner as any;
Switch.Default = DefaultInner as any;
