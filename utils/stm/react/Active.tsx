import { useState } from 'react';
import { useWatch, type TRSignal } from './react';
import type { SignalV } from '..';

const isUndefined = Symbol('undefined')

interface ActiveProps<T> {
  sg: TRSignal<any>| SignalV<any>;
  is?: T | T[] | ((v: T) => boolean) |  typeof isUndefined;
  callback?: (v: boolean) => void;
  children: React.ReactNode | (() => React.ReactNode);
}

export function Active<T>({ sg, is = isUndefined, children, callback }: ActiveProps<T>) {
  const [visible, setVisible] = useState(false);
  const isRerender = is === isUndefined;
  useWatch(() => {
    const val = sg.v;
    if(isRerender) return setVisible(!visible)
    let result = false;

    if (is === undefined) {
      result = !visible;
    } else if (typeof is === 'function') {
      result = (is as any)(val);
    } else if (Array.isArray(is)) {
      result = is.includes(val as any);
    } else {
      result = val === is;
    }

    callback?.(result);
    setVisible(result);
  });
  
  return !isRerender ? visible ? showChildren(children) : null : showChildren(children);
}

function showChildren(ch:React.ReactNode | (() => React.ReactNode)) { 
  return typeof ch === 'function' ? ch() : ch;
}