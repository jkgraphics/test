import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {breathe} from '../utils/animations';
import {seededArray} from '../utils/random';
import {colors, withAlpha} from '../utils/colors';

/** Animated film grain. The noise seed changes per frame but is deterministic. */
export const FilmGrain: React.FC<{opacity?: number}> = ({opacity = 0.07}) => {
  const frame = useCurrentFrame();
  const seed = frame % 9;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity}}>
      <svg width="100%" height="100%" viewBox="0 0 960 540" preserveAspectRatio="none">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="960" height="540" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.75}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

export const Letterbox: React.FC<{ratio?: number}> = ({ratio = 2.39}) => {
  const {width, height} = useVideoConfig();
  const bar = Math.max(0, (height - width / ratio) / 2);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: bar, background: '#000'}} />
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: bar, background: '#000'}} />
    </AbsoluteFill>
  );
};

/** Warm anamorphic light leak that drifts across frame. */
export const LightLeak: React.FC<{intensity?: number; hue?: string; from?: number; speed?: number}> = ({
  intensity = 0.5,
  hue = colors.accent,
  from = 0,
  speed = 1,
}) => {
  const frame = useCurrentFrame() - from;
  const x = -20 + ((frame * 0.25 * speed) % 140);
  const pulse = 0.75 + 0.25 * breathe(frame, 90);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: intensity * pulse,
        background: `radial-gradient(ellipse 40% 60% at ${x}% 40%, ${withAlpha(hue, 0.55)} 0%, ${withAlpha(hue, 0.12)} 40%, rgba(0,0,0,0) 70%)`,
      }}
    />
  );
};

/** Slow drifting dust motes; positions are a pure function of frame. */
export const Particles: React.FC<{count?: number; seed?: number; color?: string; opacity?: number; drift?: number}> = ({
  count = 60,
  seed = 7,
  color = colors.text,
  opacity = 0.5,
  drift = 1,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const motes = seededArray(seed, count, (r) => ({
    x: r() * width,
    y: r() * height,
    size: 1 + r() * 3,
    speed: 0.15 + r() * 0.45,
    sway: 10 + r() * 30,
    phase: r() * 1000,
    alpha: 0.2 + r() * 0.8,
  }));
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <svg width={width} height={height}>
        {motes.map((m, i) => {
          const y = (((m.y - frame * m.speed * drift) % height) + height) % height;
          const x = m.x + Math.sin((frame + m.phase) / 70) * m.sway;
          return <circle key={i} cx={x} cy={y} r={m.size} fill={color} opacity={m.alpha * (0.5 + 0.5 * breathe(frame, 60, m.phase))} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Subtle technical grid used behind data/diagram scenes. */
export const BlueprintGrid: React.FC<{opacity?: number; size?: number}> = ({opacity = 0.08, size = 80}) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: `linear-gradient(${colors.text} 1px, transparent 1px), linear-gradient(90deg, ${colors.text} 1px, transparent 1px)`,
      backgroundSize: `${size}px ${size}px`,
      backgroundPosition: 'center center',
      maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)',
      WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)',
    }}
  />
);
