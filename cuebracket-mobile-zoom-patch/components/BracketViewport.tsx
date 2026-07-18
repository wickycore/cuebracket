"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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

type Size = {
  width: number;
  height: number;
};

type PinchState = {
  startDistance: number;
  startZoom: number;
  contentX: number;
  contentY: number;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const BUTTON_ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 1;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: Point, second: Point): Point {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function BracketViewport({ children, label }: Props) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [contentSize, setContentSize] = useState<Size>({ width: 0, height: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);

  const zoomRef = useRef(DEFAULT_ZOOM);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const lastSinglePointer = useRef<Point | null>(null);
  const pinch = useRef<PinchState | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    const measure = () => {
      const nextWidth = Math.ceil(content.scrollWidth);
      const nextHeight = Math.ceil(content.scrollHeight);
      const nextViewportWidth = Math.ceil(scroller.clientWidth);

      setContentSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
      setViewportWidth((current) => (current === nextViewportWidth ? current : nextViewportWidth));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(content);

    return () => observer.disconnect();
  }, []);

  const setZoomAroundPoint = useCallback(
    (requestedZoom: number, clientX?: number, clientY?: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const nextZoom = clampZoom(requestedZoom);
      const currentZoom = zoomRef.current;
      if (Math.abs(nextZoom - currentZoom) < 0.001) return;

      const rect = scroller.getBoundingClientRect();
      const localX = (clientX ?? rect.left + rect.width / 2) - rect.left;
      const localY = (clientY ?? rect.top + rect.height / 2) - rect.top;
      const contentX = (scroller.scrollLeft + localX) / currentZoom;
      const contentY = (scroller.scrollTop + localY) / currentZoom;

      zoomRef.current = nextZoom;
      setZoom(nextZoom);

      requestAnimationFrame(() => {
        const activeScroller = scrollerRef.current;
        if (!activeScroller) return;
        activeScroller.scrollLeft = contentX * nextZoom - localX;
        activeScroller.scrollTop = contentY * nextZoom - localY;
      });
    },
    [],
  );

  const fitBracket = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || contentSize.width <= 0) return;

    const horizontalPadding = 32;
    const availableWidth = Math.max(1, scroller.clientWidth - horizontalPadding);
    const nextZoom = clampZoom(availableWidth / contentSize.width);

    zoomRef.current = nextZoom;
    setZoom(nextZoom);

    requestAnimationFrame(() => {
      const activeScroller = scrollerRef.current;
      if (!activeScroller) return;
      activeScroller.scrollLeft = 0;
      activeScroller.scrollTop = 0;
    });
  }, [contentSize.width]);

  function beginPinch() {
    const scroller = scrollerRef.current;
    const activePointers = Array.from(pointers.current.values());
    if (!scroller || activePointers.length < 2) return;

    const [first, second] = activePointers;
    const center = midpoint(first, second);
    const rect = scroller.getBoundingClientRect();
    const localX = center.x - rect.left;
    const localY = center.y - rect.top;
    const currentZoom = zoomRef.current;

    pinch.current = {
      startDistance: Math.max(1, distance(first, second)),
      startZoom: currentZoom,
      contentX: (scroller.scrollLeft + localX) / currentZoom,
      contentY: (scroller.scrollTop + localY) / currentZoom,
    };
    lastSinglePointer.current = null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const isInteractive = Boolean(target.closest("button,input,select,textarea,label,a"));

    // Keep score controls clickable. A second finger may still start a pinch.
    if (isInteractive && pointers.current.size === 0) return;

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointers.current.size >= 2) {
      event.preventDefault();
      beginPinch();
      return;
    }

    lastSinglePointer.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;

    const nextPoint = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, nextPoint);

    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (pointers.current.size >= 2) {
      event.preventDefault();
      const activePointers = Array.from(pointers.current.values());
      const [first, second] = activePointers;
      const pinchState = pinch.current;
      if (!pinchState) {
        beginPinch();
        return;
      }

      const center = midpoint(first, second);
      const rect = scroller.getBoundingClientRect();
      const localX = center.x - rect.left;
      const localY = center.y - rect.top;
      const ratio = distance(first, second) / pinchState.startDistance;
      const nextZoom = clampZoom(pinchState.startZoom * ratio);

      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      scroller.scrollLeft = pinchState.contentX * nextZoom - localX;
      scroller.scrollTop = pinchState.contentY * nextZoom - localY;
      return;
    }

    const previous = lastSinglePointer.current;
    lastSinglePointer.current = nextPoint;
    if (!previous) return;

    event.preventDefault();
    const deltaX = nextPoint.x - previous.x;
    const deltaY = nextPoint.y - previous.y;

    scroller.scrollLeft -= deltaX;

    const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const atTop = scroller.scrollTop <= 1;
    const atBottom = scroller.scrollTop >= maxScrollTop - 1;
    const mostlyVertical = Math.abs(deltaY) > Math.abs(deltaX) * 1.15;
    const shouldPassToPage =
      mostlyVertical && ((atTop && deltaY > 0) || (atBottom && deltaY < 0) || maxScrollTop === 0);

    if (shouldPassToPage) {
      window.scrollBy(0, -deltaY);
    } else {
      scroller.scrollTop -= deltaY;
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }

    pinch.current = null;
    const remainingPointer = Array.from(pointers.current.values())[0];
    lastSinglePointer.current = remainingPointer ?? null;
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    const multiplier = Math.exp(-event.deltaY * 0.0025);
    setZoomAroundPoint(zoomRef.current * multiplier, event.clientX, event.clientY);
  }

  const scaledWidth = Math.ceil(contentSize.width * zoom);
  const scaledHeight = Math.ceil(contentSize.height * zoom);
  const stageWidth = Math.max(Math.max(0, viewportWidth - 32), scaledWidth);
  const stageHeight = Math.max(280, scaledHeight);
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-7">
        <div>
          <p className="text-[11px] font-bold text-slate-400">
            Move with one finger · Pinch with two fingers · Scroll the page at the bracket edges
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-600">
            Zoom range: 25%–200%
          </p>
        </div>

        <div
          className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/70 p-1"
          aria-label={`${label} zoom controls`}
        >
          <button
            type="button"
            onClick={() => setZoomAroundPoint(zoomRef.current - BUTTON_ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM + 0.001}
            className="grid h-11 w-11 place-items-center rounded-lg text-lg font-black text-slate-200 hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            onClick={() => setZoomAroundPoint(DEFAULT_ZOOM)}
            className="min-h-11 min-w-[4.25rem] rounded-lg px-2 text-xs font-black text-cyan-300 hover:bg-white/10 active:scale-95"
            aria-label="Reset zoom to 100 percent"
            title="Reset to 100%"
          >
            {zoomPercent}%
          </button>

          <button
            type="button"
            onClick={() => setZoomAroundPoint(zoomRef.current + BUTTON_ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM - 0.001}
            className="grid h-11 w-11 place-items-center rounded-lg text-lg font-black text-slate-200 hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Zoom in"
          >
            +
          </button>

          <button
            type="button"
            onClick={fitBracket}
            className="min-h-11 rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.08em] text-violet-300 hover:bg-white/10 active:scale-95"
            aria-label="Fit bracket to screen width"
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        className="max-h-[72vh] cursor-grab overflow-auto overscroll-x-contain px-4 py-5 active:cursor-grabbing sm:px-7 sm:py-6"
        style={{ touchAction: "none", WebkitOverflowScrolling: "touch" }}
        aria-label={`${label} interactive bracket. Drag to move and pinch to zoom.`}
      >
        <div
          className="relative"
          style={{
            width: `${stageWidth}px`,
            height: `${stageHeight}px`,
          }}
        >
          <div
            ref={contentRef}
            className="absolute left-0 top-0 inline-block w-max origin-top-left select-none"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              transition: pointers.current.size > 0 ? "none" : "transform 160ms ease-out",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
