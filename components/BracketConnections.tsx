"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";

import type { BracketRound } from "@/lib/tournaments";
import { buildBracketConnectionPlan } from "@/lib/bracket/connections";

export type ConnectorTone = "cyan" | "rose" | "violet";

type ConnectorPath = {
  id: string;
  d: string;
  kind: "match" | "entry";
};

type ElementBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const strokeByTone: Record<ConnectorTone, string> = {
  cyan: "#52d3ee",
  rose: "#ef8193",
  violet: "#a78bfa",
};

export function useBracketMatchRefs() {
  const matchRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerMatch = useCallback(
    (matchId: string, node: HTMLDivElement | null) => {
      if (node) matchRefs.current.set(matchId, node);
      else matchRefs.current.delete(matchId);
    },
    [],
  );

  return { matchRefs, registerMatch };
}

function getUnscaledBox(
  element: HTMLElement,
  container: HTMLDivElement,
): ElementBox {
  // Use the rendered rectangles so CSS positioning transforms are included.
  // Dividing by the viewport scale converts the points back into the SVG's
  // unscaled coordinate system used by BracketViewport.
  const containerBox = container.getBoundingClientRect();
  const elementBox = element.getBoundingClientRect();

  const scaleX =
    container.offsetWidth > 0 && containerBox.width > 0
      ? containerBox.width / container.offsetWidth
      : 1;
  const scaleY =
    container.offsetHeight > 0 && containerBox.height > 0
      ? containerBox.height / container.offsetHeight
      : scaleX;

  const safeScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  const safeScaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;

  return {
    left: (elementBox.left - containerBox.left) / safeScaleX,
    top: (elementBox.top - containerBox.top) / safeScaleY,
    width: elementBox.width / safeScaleX,
    height: elementBox.height / safeScaleY,
  };
}

function makePath(source: ElementBox, target: ElementBox) {
  const startX = source.left + source.width;
  const startY = source.top + source.height / 2;
  const endX = target.left;
  const endY = target.top + target.height / 2;

  if (![startX, startY, endX, endY].every(Number.isFinite)) return null;
  if (endX <= startX) return null;

  const middleX = startX + (endX - startX) / 2;

  return `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`;
}

function makeEntryPath(target: ElementBox) {
  const endX = target.left;
  const endY = target.top + target.height / 2;
  if (![endX, endY].every(Number.isFinite)) return null;
  return `M ${Math.max(0, endX - 24)} ${endY} H ${endX}`;
}

function samePaths(current: ConnectorPath[], next: ConnectorPath[]) {
  if (current.length !== next.length) return false;

  return current.every(
    (path, index) =>
      path.id === next[index]?.id && path.d === next[index]?.d,
  );
}

export function BracketConnections({
  rounds,
  sourceRounds = rounds,
  containerRef,
  matchRefs,
  tone,
}: {
  rounds: BracketRound[];
  sourceRounds?: BracketRound[];
  containerRef: RefObject<HTMLDivElement | null>;
  matchRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  tone: ConnectorTone;
}) {
  const [paths, setPaths] = useState<ConnectorPath[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const plan = useMemo(
    () => buildBracketConnectionPlan(rounds, sourceRounds),
    [rounds, sourceRounds],
  );
  const rawId = useId();
  const filterId = `bracket-glow-${tone}-${rawId.replace(/:/g, "")}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;
    const timers: number[] = [];

    const measure = () => {
      cancelAnimationFrame(animationFrame);

      animationFrame = requestAnimationFrame(() => {
        const width = Math.max(container.scrollWidth, container.clientWidth);
        const height = Math.max(container.scrollHeight, container.clientHeight);

        const matchPaths = plan.connections.flatMap(
          ({ from, to, targetSlot }) => {
            const source =
              matchRefs.current.get(from) ??
              container.querySelector<HTMLElement>(
                `[data-bracket-match-id="${CSS.escape(from)}"]`,
              );
            const target =
              matchRefs.current.get(to) ??
              container.querySelector<HTMLElement>(
                `[data-bracket-match-id="${CSS.escape(to)}"]`,
              );

            if (!source || !target) return [];

            const sourceCard =
              source.querySelector<HTMLElement>("[data-bracket-card]") ?? source;
            const targetSlotElement =
              target.querySelector<HTMLElement>(
                `[data-bracket-player-slot="${targetSlot}"]`,
              ) ??
              target.querySelector<HTMLElement>("[data-bracket-card]") ??
              target;

            const d = makePath(
              getUnscaledBox(sourceCard, container),
              getUnscaledBox(targetSlotElement, container),
            );

            return d
              ? [{ id: `${from}-${to}-${targetSlot}`, d, kind: "match" as const }]
              : [];
          },
        );

        const entryPaths = plan.entryStubs.flatMap(({ to, targetSlot }) => {
          const target =
            matchRefs.current.get(to) ??
            container.querySelector<HTMLElement>(
              `[data-bracket-match-id="${CSS.escape(to)}"]`,
            );
          const targetSlotElement = target?.querySelector<HTMLElement>(
            `[data-bracket-player-slot="${targetSlot}"]`,
          );
          if (!targetSlotElement) return [];

          const d = makeEntryPath(getUnscaledBox(targetSlotElement, container));
          return d
            ? [{ id: `entry-${to}-${targetSlot}`, d, kind: "entry" as const }]
            : [];
        });

        const nextPaths = [...matchPaths, ...entryPaths];

        setSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );

        setPaths((current) =>
          samePaths(current, nextPaths) ? current : nextPaths,
        );
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    matchRefs.current.forEach((node) => resizeObserver.observe(node));

    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    void document.fonts?.ready.then(measure);

    timers.push(window.setTimeout(measure, 60));
    timers.push(window.setTimeout(measure, 240));
    timers.push(window.setTimeout(measure, 700));

    return () => {
      cancelAnimationFrame(animationFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [containerRef, matchRefs, plan]);

  if (!paths.length || !size.width || !size.height) return null;

  const stroke = strokeByTone[tone];

  return (
    <svg
      data-bracket-connectors-version="0.11.0"
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-[1] overflow-visible"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={{
        width: size.width,
        height: size.height,
        maxWidth: "none",
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <defs>
        <filter
          id={filterId}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map((path) => (
        <g key={path.id}>
          <path
            d={path.d}
            fill="none"
            stroke={stroke}
            strokeOpacity={path.kind === "entry" ? "0.18" : "0.16"}
            strokeWidth={path.kind === "entry" ? "4" : "6"}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${filterId})`}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path.d}
            fill="none"
            stroke={stroke}
            strokeOpacity={path.kind === "entry" ? "0.95" : "0.94"}
            strokeWidth={path.kind === "entry" ? "2" : "2.5"}
            strokeDasharray={path.kind === "entry" ? "4 3" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}
