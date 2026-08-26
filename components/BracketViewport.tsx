"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";

type Props = {
  children: ReactNode;
  label: string;
};

type Point = {
  x: number;
  y: number;
};

type GestureState = {
  mode: "idle" | "pan" | "pinch";
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startDistance: number;
  startZoom: number;
  anchorContentX: number;
  anchorContentY: number;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: Point, second: Point) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button,input,select,textarea,label,a"))
    : false;
}

export function BracketViewport({ children, label }: Props) {
  const [zoom, setZoom] = useState(1);
  const [isGesturing, setIsGesturing] = useState(false);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });

  const zoomRef = useRef(1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const gesture = useRef<GestureState>({
    mode: "idle",
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    startDistance: 0,
    startZoom: 1,
    anchorContentX: 0,
    anchorContentY: 0,
  });

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      setContentSize({
        width: content.scrollWidth,
        height: content.scrollHeight,
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(content);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  function commitZoom(nextValue: number, anchor?: Point) {
    const scroller = scrollerRef.current;
    const nextZoom = clampZoom(nextValue);
    const previousZoom = zoomRef.current;

    if (!scroller || previousZoom === nextZoom) return;

    const localAnchor = anchor ?? {
      x: scroller.clientWidth / 2,
      y: scroller.clientHeight / 2,
    };

    const contentX = (scroller.scrollLeft + localAnchor.x) / previousZoom;
    const contentY = (scroller.scrollTop + localAnchor.y) / previousZoom;

    zoomRef.current = nextZoom;
    setZoom(nextZoom);

    requestAnimationFrame(() => {
      scroller.scrollLeft = Math.max(0, contentX * nextZoom - localAnchor.x);
      scroller.scrollTop = Math.max(0, contentY * nextZoom - localAnchor.y);
    });
  }

  function beginPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return;

    const scroller = scrollerRef.current;
    if (!scroller) return;

    event.preventDefault();
    scroller.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const activePoints = [...pointers.current.values()];

    if (activePoints.length === 1) {
      const point = activePoints[0];
      gesture.current = {
        mode: "pan",
        startX: point.x,
        startY: point.y,
        startLeft: scroller.scrollLeft,
        startTop: scroller.scrollTop,
        startDistance: 0,
        startZoom: zoomRef.current,
        anchorContentX: 0,
        anchorContentY: 0,
      };
      setIsGesturing(true);
      return;
    }

    if (activePoints.length >= 2) {
      const first = activePoints[0];
      const second = activePoints[1];
      const center = midpoint(first, second);
      const bounds = scroller.getBoundingClientRect();
      const localCenter = {
        x: center.x - bounds.left,
        y: center.y - bounds.top,
      };

      gesture.current = {
        mode: "pinch",
        startX: 0,
        startY: 0,
        startLeft: scroller.scrollLeft,
        startTop: scroller.scrollTop,
        startDistance: Math.max(1, distance(first, second)),
        startZoom: zoomRef.current,
        anchorContentX:
          (scroller.scrollLeft + localCenter.x) / zoomRef.current,
        anchorContentY:
          (scroller.scrollTop + localCenter.y) / zoomRef.current,
      };
      setIsGesturing(true);
    }
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;

    const scroller = scrollerRef.current;
    if (!scroller) return;

    event.preventDefault();
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const activePoints = [...pointers.current.values()];

    if (activePoints.length >= 2 && gesture.current.mode === "pinch") {
      const first = activePoints[0];
      const second = activePoints[1];
      const center = midpoint(first, second);
      const bounds = scroller.getBoundingClientRect();
      const localCenter = {
        x: center.x - bounds.left,
        y: center.y - bounds.top,
      };
      const scale =
        distance(first, second) / Math.max(1, gesture.current.startDistance);
      const nextZoom = clampZoom(gesture.current.startZoom * scale);

      zoomRef.current = nextZoom;
      setZoom(nextZoom);

      requestAnimationFrame(() => {
        scroller.scrollLeft = Math.max(
          0,
          gesture.current.anchorContentX * nextZoom - localCenter.x,
        );
        scroller.scrollTop = Math.max(
          0,
          gesture.current.anchorContentY * nextZoom - localCenter.y,
        );
      });
      return;
    }

    if (activePoints.length === 1 && gesture.current.mode === "pan") {
      const point = activePoints[0];
      const deltaX = point.x - gesture.current.startX;
      const deltaY = point.y - gesture.current.startY;
      const desiredLeft = gesture.current.startLeft - deltaX;
      const desiredTop = gesture.current.startTop - deltaY;
      const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const nextLeft = Math.min(maxLeft, Math.max(0, desiredLeft));
      const nextTop = Math.min(maxTop, Math.max(0, desiredTop));

      scroller.scrollLeft = nextLeft;
      scroller.scrollTop = nextTop;

      // When the bracket has reached its top or bottom, keep the swipe moving
      // the webpage so a phone user is never trapped inside the bracket.
      const verticalOverflow = desiredTop - nextTop;
      if (Math.abs(verticalOverflow) > 0.5) {
        window.scrollBy({ top: verticalOverflow, behavior: "auto" });
      }
    }
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);

    const scroller = scrollerRef.current;
    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }

    const remainingPoints = [...pointers.current.values()];

    if (remainingPoints.length === 1 && scroller) {
      const point = remainingPoints[0];
      gesture.current = {
        mode: "pan",
        startX: point.x,
        startY: point.y,
        startLeft: scroller.scrollLeft,
        startTop: scroller.scrollTop,
        startDistance: 0,
        startZoom: zoomRef.current,
        anchorContentX: 0,
        anchorContentY: 0,
      };
      return;
    }

    if (remainingPoints.length === 0) {
      gesture.current.mode = "idle";
      setIsGesturing(false);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;

    event.preventDefault();
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const bounds = scroller.getBoundingClientRect();
    commitZoom(zoomRef.current + (event.deltaY < 0 ? 0.1 : -0.1), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  }

  const compensatedWidth = contentSize.width * (zoom - 1);
  const compensatedHeight = contentSize.height * (zoom - 1);

  return (
    <div data-bracket-viewport-version="0.10">
      <div
        ref={scrollerRef}
        aria-label={`${label} wide chart`}
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={() => commitZoom(1)}
        onWheel={handleWheel}
        className="max-h-[calc(100dvh-9rem)] cursor-grab overflow-auto overscroll-contain px-3 py-4 active:cursor-grabbing sm:max-h-[78vh] sm:px-7 sm:py-6"
        style={{
          touchAction: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          ref={contentRef}
          className={`w-max min-w-full origin-top-left ${
            isGesturing
              ? "transition-none"
              : "transition-transform duration-150 ease-out"
          }`}
          style={{
            transform: `scale(${zoom})`,
            marginRight: `${compensatedWidth}px`,
            marginBottom: `${compensatedHeight}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
