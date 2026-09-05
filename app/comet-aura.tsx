import type { CSSProperties } from "react";

const trailSegments = 80;
// Pā‘ina's 330° trail and 30° gap, expressed as constant perimeter distance.
const trailLength = (330 / 360) * 100;
const segmentLength = trailLength / trailSegments;

function trailOpacity(index: number) {
  const distanceBehindHead = (index + 0.5) / trailSegments;
  return Math.min(
    1,
    distanceBehindHead / (20 / 330),
    (1 - distanceBehindHead) / (60 / 330),
  );
}

/**
 * A fixed capsule with a distance-driven green trail.
 * Native SVG geometry follows the button's CSS-pixel viewport at every size.
 * Only the shared dash phase animates; every tail segment keeps its arc distance
 * from the head, including through both rounded ends and the loop seam.
 */
export function CometAura({ id }: { id: string }) {
  const perimeterId = `${id}-perimeter`;
  const trailId = `${id}-trail`;

  return (
    <svg className="comet-aura" aria-hidden="true" focusable="false">
      <defs>
        <rect
          id={perimeterId}
          className="comet-perimeter"
          x="1"
          y="1"
          pathLength="100"
        />
        <g id={trailId}>
          {Array.from({ length: trailSegments }, (_, index) => (
            <use
              key={index}
              href={`#${perimeterId}`}
              className={index < 22 ? "comet-segment" : "comet-segment comet-quiet-tail"}
              strokeDasharray={`${segmentLength + 0.025} ${100 - segmentLength - 0.025}`}
              strokeOpacity={trailOpacity(index)}
              style={
                {
                  "--comet-segment-offset": index * segmentLength,
                } as CSSProperties
              }
            />
          ))}
        </g>
      </defs>
      <use className="comet-glow" href={`#${trailId}`} />
      <use className="comet-ribbon" href={`#${trailId}`} />
    </svg>
  );
}
