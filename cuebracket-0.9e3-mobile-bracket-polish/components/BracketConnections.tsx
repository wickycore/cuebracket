"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { BracketRound } from "@/lib/tournaments";

export type ConnectorTone = "cyan" | "rose" | "violet";

type ConnectorPath = {
  id: string;
  d: string;
};

type ElementBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const strokeByTone: Record<ConnectorTone, string> = {
  cyan: "#22d3ee",
  rose: "#fb7185",
  violet: "#a78bfa",
};

export function useBracketMatchRefs() {
  const matchRefs = useRef(new Map<string, HTMLDivElement>());

  const registerMatch = useCallback(
    (matchId: string, node: HTMLDivElement | null) => {
      if (node) matchRefs.current.set(matchId, node);
      else matchRefs.current.delete(matchId);
    },
    [],
  );

  return { matchRefs, registerMatch };
}

/**
 * Returns coordinates in the bracket container's unscaled coordinate system.
 * BracketViewport uses CSS transforms for pinch zoom. getBoundingClientRect()
 * includes that transform, so using its values directly makes connector paths
 * shrink twice and disconnect from match cards on phones. Dividing by the
 * measured scale keeps cards and SVG lines in the same coordinate system.
 */
function getUnscaledBox(
  element: HTMLElement,
  container: HTMLDivElement,
): ElementBox {
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

export function BracketConnections({
  rounds,
  containerRef,
  matchRefs,
  tone,
}: {
  rounds: BracketRound[];
  containerRef: RefObject<HTMLDivElement | null>;
  matchRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  tone: ConnectorTone;
}) {
  const [paths, setPaths] = useState<ConnectorPath[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const connections = useMemo(() => {
    const ids = new Set(
      rounds.flatMap((round) => round.matches.map((match) => match.id)),
    );
    const result: Array<{ from: string; to: string }> = [];

    for (const round of rounds) {
      for (const match of round.matches) {
        for (const source of [match.source1, match.source2]) {
          if (
            source &&
            (source.kind === "winner" || source.kind === "loser") &&
            ids.has(source.matchId)
          ) {
            result.push({ from: source.matchId, to: match.id });
          }
        }
      }
    }

    return result;
  }, [rounds]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = Math.max(container.scrollWidth, container.clientWidth);
        const height = Math.max(container.scrollHeight, container.clientHeight);

        const nextPaths = connections.flatMap(({ from, to }) => {
          const source = matchRefs.current.get(from);
          const target = matchRefs.current.get(to);
          if (!source || !target) return [];

          const sourceBox = getUnscaledBox(source, container);
          const targetBox = getUnscaledBox(target, container);

          const startX = sourceBox.left + sourceBox.width;
          const startY = sourceBox.top + sourceBox.height / 2;
          const endX = targetBox.left;
          const endY = targetBox.top + targetBox.height / 2;

          if (endX <= startX) return [];

          const horizontalRoom = endX - startX;
          const curve = Math.max(28, horizontalRoom * 0.46);
          const d = `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;

          return [{ id: `${from}-${to}`, d }];
        });

        setSize({ width, height });
        setPaths(nextPaths);
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    matchRefs.current.forEach((node) => observer.observe(node));
    window.addEventListener("resize", measure);

    // Fonts can finish loading after the first layout measurement.
    void document.fonts?.ready.then(measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [connections, containerRef, matchRefs, rounds]);

  if (!paths.length || !size.width || !size.height) return null;

  const stroke = strokeByTone[tone];
  const filterId = `bracket-glow-${tone}`;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      fill="none"
    >
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
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
            stroke={stroke}
            strokeOpacity="0.22"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path.d}
            stroke={stroke}
            strokeOpacity="0.95"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            filter={`url(#${filterId})`}
          />
        </g>
      ))}
    </svg>
  );
}
