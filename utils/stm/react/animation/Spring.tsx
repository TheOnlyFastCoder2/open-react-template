'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useSignal, useWatch } from '../react';
import useSpringSignal from './useSpringSignal';
import useVisibilitySignal from './useVisibilitySignal';
import { batch } from '../../index';

type SpringPhase = 'enter' | 'leave' | 'down' | 'up' | 'default' | 'active';
type TransformStyleValue = 'flat' | 'preserve-3d';

type SpringPropConfig = {
  values?: Partial<Record<SpringPhase, any>>;
  stiffness?: number;
  damping?: number;
  isMobile?: boolean;

  isActive?: ReactiveLike<boolean>;
  phase?: ReactiveLike<SpringPhase>;
  triggers?: ('hover' | 'enter' | 'leave' | 'up' | 'down')[];
};

type ReactiveLike<T> = { readonly v: T };

const initConfig = {
  scale: 1,
  rotate: 0,
  depth: 0,
  opacity: 1,
  boxShadow: 0,
  translateY: 0,
  translateX: 0,
  shadowColor: [0, 0, 0, 0],
  perspective: 50,
  perspectiveOrigin: [50, 50],
  transformOrigin: 'center',
  rotateY: 0,
  rotateX: 0,
  transformStyle: 'flat' as TransformStyleValue,
};

export interface SpringProps {
  children?: React.ReactNode;
  spring?: Partial<Record<keyof typeof initConfig, SpringPropConfig>>;
  triggers?: ('hover' | 'enter' | 'leave' | 'up' | 'down')[];
  isActive?: ReactiveLike<boolean>;
  visibility?: Parameters<typeof useVisibilitySignal>[0];
  className?: string;
  classInner?: string;
  moveShadow?: boolean;
  isMove?: boolean;
  coverThreshold?: number;
  phases?: SpringPhase[];
  onToggle?: (v?: boolean) => void;
  index?: number;
  total?: number;
}

const isEventPhase = (p: SpringPhase) =>
  p === 'enter' || p === 'leave' || p === 'down' || p === 'up';

const shouldReactToEvent = (
  p: SpringPhase,
  cfg: SpringPropConfig,
  componentTriggers: ('hover' | 'enter' | 'leave' | 'up' | 'down')[]
) => {
  const list = cfg.triggers ?? componentTriggers;
  return list.includes(p as any) || (list.includes('hover') && (p === 'enter' || p === 'leave'));
};
const setPhase = (
  basePhase: SpringPhase,
  st: Record<string, any>,
  spring?: Partial<Record<keyof typeof initConfig, SpringPropConfig>>,
  componentTriggers: ('hover' | 'enter' | 'leave' | 'up' | 'down')[] = []
) => {
  const has = Object.prototype.hasOwnProperty;
  const baseIsEvent = isEventPhase(basePhase);

  batch(() => {
    for (const key in initConfig) {
      const cfg = (spring as any)?.[key] as SpringPropConfig | undefined;
      if (!cfg) continue;

      const hasOverride = !!cfg.isActive || !!cfg.phase;

      let phase: SpringPhase = basePhase;

      // 1) phase = “жёсткий” локальный драйвер (всегда главный)
      if (cfg.phase) {
        phase = cfg.phase.v;
      }
      // 2) isActive = локальный драйвер только для active/default (не ломает down/up/hover)
      else if (!baseIsEvent && cfg.isActive) {
        phase = cfg.isActive.v ? 'active' : 'default';
      }
      // 3) event-фазы применяем только если:
      //    - свойство вообще должно на них реагировать
      //    - и если у свойства есть override, то оно должно явно указать triggers
      else if (baseIsEvent) {
        if (hasOverride && !cfg.triggers) continue;
        if (!shouldReactToEvent(basePhase, cfg, componentTriggers)) continue;
      }

      const vals = cfg.values ?? {};
      if (has.call(vals, phase)) {
        st[key].v = (vals as any)[phase];
      } else if (has.call(vals, 'default')) {
        st[key].v = (vals as any).default;
      } else {
        st[key].v = (initConfig as any)[key];
      }
    }
  });
};

export function Spring({
  children,
  spring,
  triggers = [],
  isActive,
  visibility,
  onToggle,
  className = '',
  classInner = '',
  isMove,
  moveShadow,
  phases,
  index = 1,
  total = 0,
  coverThreshold = 0.35,
}: SpringProps) {
  const elRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const vis = visibility ? useVisibilitySignal<HTMLDivElement>(visibility, elRef) : null;

  const st: Record<string, any> = {};
  for (const key in initConfig) {
    st[key] = useSignal((spring as any)?.[key]?.values?.default ?? (initConfig as any)[key]);
  }
  st.isPressed = useSignal(false);
  st.wasVisibleOnce = useSignal(false);

  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(hover: hover)');
    const update = () => setIsTouch(!media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const phaseHandler = (p: SpringPhase, pressed?: boolean) => {
    if (pressed !== undefined) st.isPressed.v = pressed;

    setPhase(p, st, spring, triggers);

    if (phases?.includes(p)) onToggle?.(p === 'enter' || p === 'down');
  };
  const handle = {
    down: () => phaseHandler('down', true),
    up: () => phaseHandler('up', false),
    enter: () => phaseHandler('enter'),
    leave: () => phaseHandler('leave'),
  };
  useWatch(() => {
    if (vis) {
      const visible = vis.visible.v;
      phaseHandler(visible ? 'active' : 'default', visible);
      if (visible) st.wasVisibleOnce.v = true;
    }

    if (isActive) {
      const phase: SpringPhase = isActive.v ? 'active' : 'default';
      setPhase(phase, st, spring);
      if (phases?.includes(phase)) {
        onToggle?.(isActive.v);
      }
    }
  });

  useWatch(() => {
    if (!vis || !st.wasVisibleOnce.v) return;
    const el = vis.ref.current;
    if (!el) return;
    const isLast = index === total;
    const hide = isLast ? 0 : Math.min(1, vis.overlap.v * 2);
    const covered = !isLast && hide > coverThreshold;
    setPhase(covered || !vis.visible.v ? 'default' : 'active', st, spring);
  });

  const springSignals: Record<string, any> = {};
  for (const key in st) {
    springSignals[key] = useSpringSignal(st[key], useSignal(st[key].v), {
      stiffness: (spring as any)?.[key]?.stiffness ?? 160,
      damping: (spring as any)?.[key]?.damping ?? 18,
    });
  }

  useWatch(() => {
    const el = elRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;

    const has = (key: keyof typeof initConfig) =>
      !!spring && Object.prototype.hasOwnProperty.call(spring, key);

    if (has('perspective') || has('perspectiveOrigin')) {
      const p = springSignals.perspective.v;
      const po = springSignals.perspectiveOrigin.v;
      const origin = Array.isArray(po) ? `${po[0]}% ${po[1]}%` : po;

      el.style.perspective = `${p}px`;
      el.style.perspectiveOrigin = origin;
    }

    const needTransform =
      has('scale') ||
      has('rotate') ||
      has('depth') ||
      has('translateX') ||
      has('translateY') ||
      has('rotateY') ||
      has('rotateX') ||
      has('transformStyle') ||
      has('transformOrigin');

    if (needTransform) {
      const s = springSignals.scale.v;
      const r = springSignals.rotate.v;
      const z = springSignals.depth.v;
      const x = springSignals.translateX.v;
      const y = springSignals.translateY.v;
      const ry = springSignals.rotateY.v;
      const rx = springSignals.rotateX.v;

      const tOrigin = Array.isArray(st.transformOrigin.v)
        ? `${st.transformOrigin.v[0]}% ${st.transformOrigin.v[1]}%`
        : st.transformOrigin.v;

      inner.style.transformStyle = springSignals.transformStyle.v;
      inner.style.transformOrigin = tOrigin;
      el.style.willChange = 'transform';

      inner.style.transform = `
        rotateY(${ry}deg)
        rotateX(${rx}deg)
        scale(${s})
        rotate(${r}deg)
        translate3d(${x}px, ${y}px, ${z}px)
      `;
    }

    if (has('opacity')) {
      const o = springSignals.opacity.v;
      inner.style.opacity = o.toFixed(2);
    }

    if (has('boxShadow') || has('shadowColor') || has('depth')) {
      const z = springSignals.depth.v;
      const sh = springSignals.boxShadow.v;
      const colorArr = springSignals.shadowColor.v;

      const color = `rgba(${colorArr[0]}, ${colorArr[1]}, ${colorArr[2]}, ${colorArr[3].toFixed(
        2
      )})`;

      inner.style.boxShadow = `0 ${z + sh}px ${(z + sh) * 3}px ${color}`;
    }
  });

  useEffect(() => {
    const el = elRef.current;
    const inner = innerRef.current;

    if (!isMove || isTouch || !el || !inner) return;

    const controller = new AbortController();
    const { signal } = controller;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);

      st.rotateY.v = -dx * 12;
      st.rotateX.v = dy * 12;

      if (moveShadow) {
        inner.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        inner.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      }
    };

    const reset = () => {
      st.rotateY.v = 0;
      st.rotateX.v = 0;

      if (moveShadow) {
        inner.style.setProperty('--mouse-x', `50%`);
        inner.style.setProperty('--mouse-y', `50%`);
      }
    };

    el.addEventListener('mousemove', handleMove, { signal });
    el.addEventListener('mouseleave', reset, { signal });

    return () => {
      controller.abort();
    };
  }, [isTouch, isMove, moveShadow]);

  return (
    <div
      ref={elRef}
      className={className}
      onPointerDown={handle.down}
      onPointerUp={handle.up}
      onPointerCancel={handle.up}
      onPointerLeave={handle.leave}
      onPointerEnter={handle.enter}
    >
      <div className={classInner} ref={innerRef}>
        {children}
      </div>
    </div>
  );
}

export function isPointerEvent(e: any): e is React.PointerEvent {
  return !!e && typeof e === 'object' && 'pointerId' in e;
}

export function trySetPointerCapture(
  e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  el?: HTMLElement | null
) {
  if (!isPointerEvent(e)) return;
  const target = el ?? (e.currentTarget as HTMLElement | null);
  if (!target?.setPointerCapture) return;
  try {
    target.setPointerCapture(e.pointerId);
  } catch {}
}

export function tryReleasePointerCapture(
  e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  el?: HTMLElement | null
) {
  if (!isPointerEvent(e)) return;
  const target = el ?? (e.currentTarget as HTMLElement | null);
  if (!target?.releasePointerCapture) return;
  try {
    target.releasePointerCapture(e.pointerId);
  } catch {}
}
