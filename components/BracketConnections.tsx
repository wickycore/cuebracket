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
  cyan: "#78b8d8",
  rose: "#d98b99",
  violet: "#a895cc",
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

export function buildConnections(rounds: BracketRound[]): ConnectorPair[] {
  const ids = new Set(
    rounds.flatMap((round) => round.matches.map((match) => match.id)),
  );

  const pairs: ConnectorPair[] = [];
  const seen = new Set<string>();
  const incomingByTarget = new Map<string, Set<string>>();

  const add = (from: string, to: string) => {
    if (!ids.has(from) || !ids.has(to)) return;

    const key = `${from}->${to}`;
    if (seen.has(key)) return;

    seen.add(key);
    pairs.push({ from, to });
    const incoming = incomingByTarget.get(to) ?? new Set<string>();
    incoming.add(from);
    incomingByTarget.set(to, incoming);
  };

  for (const round of rounds) {
    for (const match of round.matches) {
      for (const source of [match.source1, match.source2]) {
        if (
          source &&
          (source.kind === "winner" || source.kind === "loser") &&
          ids.has(source.matchId)
        ) {
          add(source.matchId, match.id);
        }
      }
    }
  }

  // Public cloud rows can contain older bracket snapshots without complete
  // source metadata. Reconstruct missing feeders from the players that were
  // propagated into the next round. This also keeps completed brackets and
  // brackets containing BYEs connected permanently.
  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1]?.matches ?? [];
    const current = rounds[roundIndex]?.matches ?? [];

    if (!current.length || !previous.length) continue;

    current.forEach((target, position) => {
      if ((incomingByTarget.get(target.id)?.size ?? 0) >= 2) return;

      const targetPlayers = new Set(
        [target.player1, target.player2].filter(
          (player): player is string => Boolean(player),
        ),
      );

      if (targetPlayers.size) {
        for (const source of previous) {
          const advancingPlayer =
            source.winner ??
            (source.completed && Boolean(source.player1) !== Boolean(source.player2)
              ? source.player1 ?? source.player2
              : null);

          if (advancingPlayer && targetPlayers.has(advancingPlayer)) {
            add(source.id, target.id);
            if ((incomingByTarget.get(target.id)?.size ?? 0) >= 2) break;
          }
        }
      }

      if ((incomingByTarget.get(target.id)?.size ?? 0) >= 2) return;

      // Final fallback for legacy snapshots that have neither sources nor
      // populated participants yet. Standard elimination rounds are positional.
      if (previous.length !== current.length * 2) return;

      const first = previous[position * 2];
      const second = previous[position * 2 + 1];

      if (first) add(first.id, target.id);
      if (second) add(second.id, target.id);
    });
  }

  return pairs;
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

function samePaths(current: ConnectorPath[], next: ConnectorPath[]) {
  if (current.length !== next.length) return false;

  return current.every(
    (path, index) =>
      path.id === next[index]?.id && path.d === next[index]?.d,
  );
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

        const nextPaths = connections.flatMap(({ from, to }) => {
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
          const targetCard =
            target.querySelector<HTMLElement>("[data-bracket-card]") ?? target;

          const d = makePath(
            getUnscaledBox(sourceCard, container),
            getUnscaledBox(targetCard, container),
          );

          return d ? [{ id: `${from}-${to}`, d }] : [];
        });

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
  }, [connections, containerRef, matchRefs]);

  if (!paths.length || !size.width || !size.height) return null;

  const stroke = strokeByTone[tone];

  return (
    <svg
      data-bracket-connectors-version="0.10.2"
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
            strokeOpacity="0.09"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${filterId})`}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path.d}
            fill="none"
            stroke={stroke}
            strokeOpacity="0.78"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}
