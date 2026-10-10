import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {seededArray} from '../utils/random';

/**
 * Deterministic starfield. Generated 30% larger than the frame so camera moves
 * never expose an edge. Wrap it in a <Layer depth={…}> for parallax.
 */
export const Starfield: React.FC<{
  seed?: number;
  count?: number;
  opacity?: number;
  maxSize?: number;
  twinkle?: boolean;
}> = ({seed = 1, count = 320, opacity = 1, maxSize = 2.2, twinkle = true}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const W = width * 1.3;
  const H = height * 1.3;
  const stars = useMemo(
    () =>
      seededArray(seed, count, (r) => {
        const big = r() > 0.97;
        return {
          x: r() * W,
          y: r() * H,
          r: big ? maxSize * (1 + r()) : 0.4 + r() * maxSize * 0.6,
          a: 0.25 + r() * 0.75,
          phase: r() * 600,
          period: 40 + r() * 120,
          warm: r() > 0.85,
          big,
        };
      }),
    [seed, count, W, H, maxSize],
  );
  return (
    <AbsoluteFill style={{opacity}}>
      <svg width={W} height={H} style={{position: 'absolute', left: -(W - width) / 2, top: -(H - height) / 2}}>
        <defs>
          <radialGradient id={`starglow-${seed}`}>
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {stars.map((s, i) => {
          const tw = twinkle ? 0.65 + 0.35 * Math.sin(((frame + s.phase) / s.period) * Math.PI * 2) : 1;
          return (
            <g key={i} opacity={s.a * tw}>
              {s.big ? <circle cx={s.x} cy={s.y} r={s.r * 4} fill={`url(#starglow-${seed})`} opacity={0.35} /> : null}
              <circle cx={s.x} cy={s.y} r={s.r} fill={s.warm ? '#ffe2b8' : '#e8f0ff'} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
