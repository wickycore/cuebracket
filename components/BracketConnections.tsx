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

type ConnectorPair = {
  from: string;
  to: string;
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
 * includes that transform, so dividing by the measured scale keeps the match
 * cards and the SVG paths in the same coordinate system.
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

function connectionKey(pair: ConnectorPair) {
  return `${pair.from}->${pair.to}`;
}

/**
 * Older and current single-elimination brackets do not always store source1 /
 * source2 metadata. In a standard single-elimination bracket, every match in
 * the next round is fed by two adjacent matches from the previous round.
 * Infer those links only for clean 2-to-1 round transitions and only when that
 * target match does not already have explicit source metadata.
 */
function buildConnections(rounds: BracketRound[]): ConnectorPair[] {
  const ids = new Set(
    rounds.flatMap((round) => round.matches.map((match) => match.id)),
  );
  const result: ConnectorPair[] = [];
  const seen = new Set<string>();
  const explicitTargets = new Set<string>();

  const add = (pair: ConnectorPair) => {
    if (!ids.has(pair.from) || !ids.has(pair.to)) return;
    const key = connectionKey(pair);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(pair);
  };

  for (const round of rounds) {
    for (const match of round.matches) {
      for (const source of [match.source1, match.source2]) {
        if (
          source &&
          (source.kind === "winner" || source.kind === "loser") &&
          ids.has(source.matchId)
        ) {
          explicitTargets.add(match.id);
          add({ from: source.matchId, to: match.id });
        }
      }
    }
  }

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1]?.matches ?? [];
    const current = rounds[roundIndex]?.matches ?? [];

    // This is the normal single-elimination shape: 8 -> 4 -> 2 -> 1.
    if (!current.length || previous.length !== current.length * 2) continue;

    current.forEach((target, position) => {
      if (explicitTargets.has(target.id)) return;

      const firstFeeder = previous[position * 2];
      const secondFeeder = previous[position * 2 + 1];

      if (firstFeeder) add({ from: firstFeeder.id, to: target.id });
      if (secondFeeder) add({ from: secondFeeder.id, to: target.id });
    });
  }

  return result;
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

  const connections = useMemo(() => buildConnections(rounds), [rounds]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const timers: number[] = [];

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

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    matchRefs.current.forEach((node) => resizeObserver.observe(node));

    // Public cloud data and fonts can finish rendering after the first layout.
    // These extra measurements make the connectors reliable after hydration,
    // realtime updates, orientation changes and mobile zoom fitting.
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    void document.fonts?.ready.then(measure);

    timers.push(window.setTimeout(measure, 80));
    timers.push(window.setTimeout(measure, 250));
    timers.push(window.setTimeout(measure, 700));

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [connections, containerRef, matchRefs, rounds]);

  if (!paths.length || !size.width || !size.height) return null;

  const stroke = strokeByTone[tone];
  const filterId = `bracket-glow-${tone}`;

  return (
    <svg
      data-bracket-connectors-version="0.9e6"
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
