import { type PropsWithChildren, useEffect, useLayoutEffect, useRef } from 'react';
import { useSignal, useWatch } from './react';

export interface DraggableImpRef {
  move?: (x: number, y: number) => void;
  onEnd?: (x: number, y: number, resetPrevPos: (x: number, y: number) => void) => void;
  onStart?: (x: number, y: number, resetPrevPos: (x: number, y: number) => void) => void;
  reset?: () => void;
  resetPos: (absX?: number, absY?: number) => void;
  getPos: () => {
    x: number;
    y: number;
  };
  startX?: number;
  startY?: number;
}

interface DraggableProps extends PropsWithChildren {
  impRef: React.RefObject<Partial<DraggableImpRef>>;
  isComeBack?: boolean;
  mounted?: (r: DraggableProps['impRef']) => void;
  unmounted?: (r: DraggableProps['impRef']) => void;
}

export function Draggable({
  impRef,
  children,
  mounted,
  unmounted,
  isComeBack = false,
  ...props
}: DraggableProps) {
  const x = useSignal(0);
  const y = useSignal(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!impRef.current) impRef.current = {};
    impRef.current.reset = () => {
      x.v = 0;
      y.v = 0;
    };
    impRef.current.getPos = () => {
      return {
        x: x.v,
        y: y.v,
      };
    };
    impRef.current.resetPos = (absX = 0, absY = 0) => {
      x.v = absX;
      y.v = absY;
    };
  }, [impRef]);

  useWatch(() => {
    impRef.current?.move?.(x.v, y.v);
  });

  const onGrabberDown = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    let prevX = x.v;
    let prevY = y.v;

    startDrag(e.nativeEvent, {
      onStart: (startX, startY) => {
        impRef.current?.onStart?.(startX, startY, (x: number, y: number) => {
          prevX = x;
          prevY = y;
        });
        document.body.style.userSelect = 'none';
      },
      onMove: (dx, dy) => {
        x.v = prevX + dx;
        y.v = prevY + dy;
      },
      onEnd: (endX, endY, ev) => {
        if (isComeBack !== false) {
          x.v = prevX;
          y.v = prevY;
        }
        impRef.current?.onEnd?.(endX, endY, (x: number, y: number) => {
          prevX = x;
          prevY = y;
        });
        document.body.style.userSelect = '';
      },
    });
  };

  useLayoutEffect(() => {
    const curr = impRef.current;
    x.v = curr?.startX ?? 0;
    y.v = curr?.startY ?? 0;
    mounted?.(impRef);
    return () => {
      unmounted?.(impRef);
    };
  }, [impRef, x, y]);

  return (
    <div
      {...props}
      ref={ref}
      onMouseDown={onGrabberDown}
      onTouchStart={onGrabberDown}
      style={{ display: 'contents' }}
      children={children}
    />
  );
}

export function getPointerEvent(e: MouseEvent | TouchEvent) {
  return 'touches' in e ? e.touches[0] : e;
}

type DragCallbacks = {
  onStart?: (dx: number, dy: number, event: MouseEvent | TouchEvent) => void;
  onMove?: (dx: number, dy: number, event: MouseEvent | TouchEvent) => void;
  onEnd?: (dx: number, dy: number, event: MouseEvent | TouchEvent) => void;
};

const startDrag = (
  startEvent: MouseEvent | TouchEvent,
  { onStart, onMove, onEnd }: DragCallbacks = {}
) => {
  const startPointer = getPointerEvent(startEvent);
  const startX = startPointer.clientX;
  const startY = startPointer.clientY;
  let dx = 0;
  let dy = 0;
  onStart?.(startX, startY, startEvent);

  const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
    moveEvent.preventDefault();
    const pointer = getPointerEvent(moveEvent);
    dx = dx = pointer.clientX - startX;
    dy = dy = pointer.clientY - startY;
    onMove?.(dx, dy, moveEvent);
  };

  const handleEnd = (endEvent: MouseEvent | TouchEvent) => {
    if (typeof window == undefined) return;
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleEnd);
    window.removeEventListener('touchmove', handleMove);
    window.removeEventListener('touchend', handleEnd);
    document.body.style.cursor = 'default';
    onEnd?.(dx, dy, endEvent);
  };

  if (typeof window == undefined) return;
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);
  window.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('touchend', handleEnd);
  document.body.style.cursor = 'grabbing';
};
