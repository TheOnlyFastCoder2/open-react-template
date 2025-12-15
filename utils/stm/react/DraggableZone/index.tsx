import $ from './styles.module.css';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Active } from 'shared/utils/_stm/react/Active';
import { Draggable, type DraggableImpRef } from 'shared/utils/_stm/react/Draggable';
import { useSignal } from 'shared/utils/_stm/react/react';

const zoneRegistry = new Map<string, HTMLElement>();
const itemRegistry = new Map<string, Map<string, HTMLElement>>();

function registerItem(zoneName: string, id: string, el: HTMLElement) {
  let zoneItems = itemRegistry.get(zoneName);
  if (!zoneItems) {
    zoneItems = new Map();
    itemRegistry.set(zoneName, zoneItems);
  }
  zoneItems.set(id, el);
}

function unregisterItem(zoneName: string, id: string, el: HTMLElement) {
  const zoneItems = itemRegistry.get(zoneName);
  if (!zoneItems) return;
  const curr = zoneItems.get(id);
  if (curr === el) {
    zoneItems.delete(id);
    if (!zoneItems.size) itemRegistry.delete(zoneName);
  }
}

function getInsertBeforeId(
  zoneName: string,
  y: number,
  excludeEl?: HTMLElement | null
): string | null {
  const zoneItems = itemRegistry.get(zoneName);
  if (!zoneItems) return null;

  const items = Array.from(zoneItems.entries())
    .map(([id, el]) => ({ id, el, rect: el.getBoundingClientRect() }))
    .filter((x) => x.el !== excludeEl)
    .sort((a, b) => a.rect.top - b.rect.top);

  for (const item of items) {
    const middle = item.rect.top + item.rect.height / 2;
    if (y < middle) return item.id;
  }

  return null;
}

export function registerZone(name: string, el: HTMLElement) {
  zoneRegistry.set(name, el);
}

export function unregisterZone(name: string, el: HTMLElement) {
  const curr = zoneRegistry.get(name);
  if (curr === el) zoneRegistry.delete(name);
}

function getZoneByPoint(x: number, y: number): string | null {
  for (const [name, el] of zoneRegistry.entries()) {
    const rect = el.getBoundingClientRect();
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (inside) return name;
  }
  return null;
}

export interface DraggableZoneProps {
  name: string;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

export function DraggableZone({ name, id = '', className = '', children }: DraggableZoneProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    registerZone(name, el);
    return () => unregisterZone(name, el);
  }, [name]);

  return (
    <div ref={ref} id={id} className={`${$.zone} ${className}`} data-zone={name}>
      {children}
    </div>
  );
}

export interface DraggableItemProps {
  id: string;
  onZoneChange?: (zoneName: string | null, event: 'move' | 'end' | 'start') => void;
  onDropBetween?: (info: {
    zoneName: string | null;
    beforeId: string | null;
    event: 'move' | 'end';
  }) => void;
  className?: string;
  children: React.ReactNode;
  isComeBack?: boolean;
}

let lastHighlight: { zoneName: string | null; beforeId: string | null } = {
  zoneName: null,
  beforeId: null,
};

function highlightInsertPosition(zoneName: string, beforeId: string | null) {
  if (lastHighlight.zoneName && lastHighlight.beforeId) {
    const prevZoneItems = itemRegistry.get(lastHighlight.zoneName);
    const prevEl = prevZoneItems?.get(lastHighlight.beforeId);
    prevEl?.removeAttribute('data-insert-before');
  }

  if (zoneName && beforeId) {
    const zoneItems = itemRegistry.get(zoneName);
    const el = zoneItems?.get(beforeId);
    el?.setAttribute('data-insert-before', 'true');
  }

  lastHighlight = { zoneName, beforeId };
}

export function DraggableItem({
  id,
  onZoneChange,
  onDropBetween,
  isComeBack = true,
  className = '',
  children,
}: DraggableItemProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const impRef = useRef<Partial<DraggableImpRef>>({});
  const lastZoneRef = useRef<string | null>(null);
  const force = useSignal(0);
  const pos = useSignal({ x: 0, y: 0, isRoot: false });
  const portalTarget = useSignal<HTMLElement | null>(null);
  const currentDropRef = useRef<{ zoneName: string | null; beforeId: string | null }>({
    zoneName: null,
    beforeId: null,
  });
  const zoneNameRef = useRef<string | null>(null);
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const zoneEl = node.closest('[data-zone]') as HTMLElement | null;
    const zoneName = zoneEl?.dataset.zone ?? null;

    zoneNameRef.current = zoneName;

    if (!zoneName) return;

    registerItem(zoneName, id, node);
    return () => unregisterItem(zoneName, id, node);
  }, [id]);

  impRef.current.move = (x, y) => {
    const node = wrapperRef.current;
    if (!node) return;

    node.style.top = `${y}px`;
    node.style.left = `${x}px`;
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const zoneName = getZoneByPoint(centerX, centerY);
    const drop = currentDropRef.current;

    if (zoneName !== lastZoneRef.current) {
      if (lastZoneRef.current) {
        const zoneEl = zoneRegistry.get(lastZoneRef.current);
        zoneEl?.toggleAttribute('data-active', false);
      }
      lastZoneRef.current = zoneName;
      onZoneChange?.(zoneName, 'move');
      if (zoneName) {
        const zoneEl = zoneRegistry.get(zoneName);
        zoneEl?.toggleAttribute('data-active', true);
      }
    }
    onDropBetween?.({
      zoneName,
      beforeId: drop.beforeId,
      event: 'move',
    });

    if (!zoneName) {
      currentDropRef.current = { zoneName: null, beforeId: null };
      return;
    }

    const beforeId = getInsertBeforeId(zoneName, centerY, node);
    currentDropRef.current = { zoneName, beforeId };

    highlightInsertPosition(zoneName, beforeId);
  };
  impRef.current.onStart = (_x, _y, resetPrevPos) => {
    onZoneChange?.(lastZoneRef.current, 'start');
    const node = wrapperRef.current;
    if (!node) return;

    pos.v.isRoot = false;
    const rect = node.getBoundingClientRect();

    node.classList.add($.dragging);
    pos.v.x = rect.left;
    pos.v.y = rect.top;
    pos.v.isRoot = true;
    resetPrevPos(pos.v.x, pos.v.y);
    if (portalTarget.v === document.body) return;
    portalTarget.v = document.body;
    force.v += 1;
  };

  impRef.current.onEnd = () => {
    onZoneChange?.(lastZoneRef.current, 'end');

    const node = wrapperRef.current;
    if (!node) return;

    const drop = currentDropRef.current;
    const zoneName = drop.zoneName;

    onDropBetween?.({
      zoneName,
      beforeId: drop.beforeId,
      event: 'end',
    });

    if (!zoneName) return;
    const zoneEl = zoneRegistry.get(zoneName);
    if (!zoneEl) return;

    impRef.current.reset?.();
    node.classList.remove($.dragging);
    portalTarget.v = zoneEl;
    force.v += 1;
    pos.v.isRoot = false;
  };

  const Content = () => {
    return (
      <div
        children={children}
        className={`${$.draggableItem}  ${className}`}
        ref={(node) => {
          wrapperRef.current = node;
          if (pos.v.isRoot) {
            impRef.current.resetPos?.(pos.v.x, pos.v.y);
            node?.classList.add?.($.dragging);
          }
        }}
      />
    );
  };

  return (
    <Draggable impRef={impRef} isComeBack={isComeBack}>
      <Active
        sg={force}
        children={() => {
          if (portalTarget.v === undefined) return <Content />;
          if (portalTarget.v === null) return <Content />;

          return createPortal(<Content />, portalTarget.v);
        }}
      />
    </Draggable>
  );
}
