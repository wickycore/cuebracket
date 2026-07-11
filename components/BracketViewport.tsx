"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: string;
};

const ZOOM_LEVELS = [0.75, 0.9, 1, 1.15, 1.3];

export function BracketViewport({ children, label }: Props) {
  const [zoomIndex, setZoomIndex] = useState(2);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const zoom = ZOOM_LEVELS[zoomIndex];

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const target = event.target as HTMLElement;
    if (target.closest("button,input,label,a")) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    dragging.current = true;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
    };
    scroller.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollLeft = start.current.left - (event.clientX - start.current.x);
    scroller.scrollTop = start.current.top - (event.clientY - start.current.y);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = false;
    const scroller = scrollerRef.current;
    if (scroller?.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 sm:px-7">
        <p className="text-[11px] font-bold text-slate-500">
          Drag to move · Use zoom controls · Swipe rounds on mobile
        </p>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/60 p-1" aria-label={`${label} zoom controls`}>
          <button
            type="button"
            onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}
            disabled={zoomIndex === 0}
            className="h-8 w-8 rounded-lg text-sm font-black text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex(2)}
            className="min-w-14 rounded-lg px-2 py-1.5 text-[11px] font-black text-cyan-300 hover:bg-white/10"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className="h-8 w-8 rounded-lg text-sm font-black text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="max-h-[72vh] cursor-grab overflow-auto overscroll-contain px-5 py-6 active:cursor-grabbing sm:px-7"
      >
        <div
          className="w-max min-w-full origin-top-left transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})`, marginBottom: `${Math.max(0, (zoom - 1) * 240)}px`, marginRight: `${Math.max(0, (zoom - 1) * 360)}px` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
