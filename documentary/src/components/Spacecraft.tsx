import React, {useId} from 'react';
import {useCurrentFrame} from 'remotion';
import {colors, withAlpha} from '../utils/colors';

const useSvgId = (prefix: string) => `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/**
 * Saturn V side elevation drawn to (approximate) scale in metres.
 * y = 0 is the tip of the escape tower, y = 110.6 the base of the engine bells.
 * Stage ids match content.saturnV.stages so callouts can highlight sections.
 */
export const SATURN_V_SECTIONS: {id: string; y0: number; y1: number; d: string; dark?: boolean}[] = [
  {id: 'les', y0: 0, y1: 10, d: 'M0 0 L0.45 0.8 L0.45 3.5 L0.7 10 L-0.7 10 L-0.45 3.5 L-0.45 0.8 Z'},
  {id: 'csm', y0: 10, y1: 20.7, d: 'M-0.5 10 L0.5 10 L1.95 13.2 L1.95 20.7 L-1.95 20.7 L-1.95 13.2 Z'},
  {id: 'lm', y0: 20.7, y1: 29.2, d: 'M-1.95 20.7 L1.95 20.7 L3.3 29.2 L-3.3 29.2 Z'},
  {id: 'iu', y0: 29.2, y1: 30.1, d: 'M-3.3 29.2 L3.3 29.2 L3.3 30.1 L-3.3 30.1 Z', dark: true},
  {id: 'ivb', y0: 30.1, y1: 47.9, d: 'M-3.3 30.1 L3.3 30.1 L3.3 47.9 L-3.3 47.9 Z'},
  {id: 'ii', y0: 47.9, y1: 77.9, d: 'M-3.3 47.9 L3.3 47.9 L5.05 53 L5.05 77.9 L-5.05 77.9 L-5.05 53 L-3.3 47.9 Z'},
  {
    id: 'ic',
    y0: 77.9,
    y1: 110.6,
    d: 'M-5.05 77.9 L5.05 77.9 L5.05 102 L8.6 108.5 L8.6 110 L5.05 108 L-5.05 108 L-8.6 110 L-8.6 108.5 L-5.05 102 Z',
  },
];

export const SaturnV: React.FC<{
  height: number;
  /** 0..1 outline draw-on. */
  draw?: number;
  /** 0..1 paint fill fade. */
  fill?: number;
  highlight?: string | null;
  /** 0..1 engine flame intensity. */
  flame?: number;
}> = ({height, draw = 1, fill = 1, highlight = null, flame = 0}) => {
  const frame = useCurrentFrame();
  const id = useSvgId('sv');
  const scale = height / 112;
  const width = 30 * scale;
  const flick = 0.85 + 0.1 * Math.sin(frame * 1.9) + 0.05 * Math.sin(frame * 4.3);
  const bells = [-3.6, -1.2, 1.2, 3.6];
  return (
    <svg width={width} height={height + flame * height * 0.5} viewBox={`-15 -1 30 ${112 + flame * 56}`} style={{overflow: 'visible'}}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1">
          <stop offset="0%" stopColor="#8f8b84" />
          <stop offset="35%" stopColor="#f3efe6" />
          <stop offset="60%" stopColor="#e2ddd3" />
          <stop offset="100%" stopColor="#6d6a64" />
        </linearGradient>
        <linearGradient id={`${id}-dark`} x1="0" x2="1">
          <stop offset="0%" stopColor="#050507" />
          <stop offset="40%" stopColor="#2b2c31" />
          <stop offset="100%" stopColor="#050507" />
        </linearGradient>
        <radialGradient id={`${id}-flame`} cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#fffbe8" />
          <stop offset="25%" stopColor="#ffd27a" />
          <stop offset="60%" stopColor="#ff7a1a" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#ff4500" stopOpacity={0} />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          {SATURN_V_SECTIONS.map((s) => (
            <path key={s.id} d={s.d} />
          ))}
        </clipPath>
      </defs>

      {flame > 0 ? (
        <g opacity={Math.min(1, flame * 1.5)}>
          <ellipse cx={0} cy={110 + 20 * flame * flick} rx={9 * (0.6 + flame * 0.5)} ry={24 * flame * flick} fill={`url(#${id}-flame)`} />
          <ellipse cx={0} cy={110 + 10 * flame} rx={5} ry={12 * flame * flick} fill="#fff8e0" opacity={0.9} />
        </g>
      ) : null}

      {/* paint */}
      <g opacity={fill}>
        {SATURN_V_SECTIONS.map((s) => (
          <path key={s.id} d={s.d} fill={s.dark ? `url(#${id}-dark)` : `url(#${id}-body)`} />
        ))}
        <g clipPath={`url(#${id}-clip)`}>
          {/* roll pattern & black bands */}
          <rect x={-5.1} y={77.9} width={5.1} height={6} fill={`url(#${id}-dark)`} />
          <rect x={0} y={96} width={5.1} height={6} fill={`url(#${id}-dark)`} />
          <rect x={-5.1} y={96} width={5.1} height={6} fill="none" />
          <rect x={-5.1} y={70.5} width={10.2} height={1.2} fill={`url(#${id}-dark)`} />
          <rect x={-3.3} y={42} width={3.3} height={5.9} fill={`url(#${id}-dark)`} />
          <rect x={-1.95} y={13.2} width={3.9} height={0.5} fill={withAlpha('#000000', 0.4)} />
          {/* USA lettering suggestion */}
          <rect x={-0.6} y={85} width={1.2} height={9} fill={withAlpha('#000000', 0.18)} />
        </g>
        {bells.map((bx) => (
          <path key={bx} d={`M${bx - 0.8} 108 L${bx + 0.8} 108 L${bx + 1.3} 110.6 L${bx - 1.3} 110.6 Z`} fill={`url(#${id}-dark)`} />
        ))}
      </g>

      {/* outline draw-on + highlight */}
      {SATURN_V_SECTIONS.map((s) => {
        const hi = highlight === s.id;
        return (
          <path
            key={s.id}
            d={s.d}
            pathLength={1}
            fill={hi ? withAlpha(colors.accent, 0.35) : 'none'}
            stroke={hi ? colors.accent : withAlpha(colors.text, 0.85)}
            strokeWidth={hi ? 0.35 : 0.15}
            strokeDasharray="1"
            strokeDashoffset={1 - draw}
          />
        );
      })}
    </svg>
  );
};

/** Stylised Apollo Lunar Module (Eagle). Origin is the bottom of the footpads. */
export const LunarModule: React.FC<{size: number; thrust?: number}> = ({size, thrust = 0}) => {
  const frame = useCurrentFrame();
  const id = useSvgId('lm');
  const flick = 0.85 + 0.15 * Math.sin(frame * 2.3);
  return (
    <svg width={size} height={size} viewBox="-120 -170 240 240" style={{overflow: 'visible'}}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" x2="1">
          <stop offset="0%" stopColor="#6b4f17" />
          <stop offset="45%" stopColor="#e3b64f" />
          <stop offset="100%" stopColor="#7a5a1c" />
        </linearGradient>
        <linearGradient id={`${id}-silver`} x1="0" x2="1">
          <stop offset="0%" stopColor="#5d5f63" />
          <stop offset="50%" stopColor="#cfd1d4" />
          <stop offset="100%" stopColor="#55575b" />
        </linearGradient>
        <radialGradient id={`${id}-plume`} cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#fff6dc" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#ffb347" stopOpacity={0} />
        </radialGradient>
      </defs>
      {thrust > 0 ? <ellipse cx={0} cy={-10 + 30 * thrust} rx={18} ry={40 * thrust * flick} fill={`url(#${id}-plume)`} opacity={thrust} /> : null}
      {/* legs */}
      {[-1, 1].map((s) => (
        <g key={s} stroke="#b9b2a2" strokeWidth={4} fill="none">
          <line x1={s * 40} y1={-55} x2={s * 95} y2={-2} />
          <line x1={s * 45} y1={-30} x2={s * 95} y2={-2} />
          <ellipse cx={s * 95} cy={0} rx={14} ry={4} fill="#9c9585" stroke="none" />
        </g>
      ))}
      <line x1={0} y1={-30} x2={0} y2={-8} stroke="#b9b2a2" strokeWidth={4} />
      <ellipse cx={0} cy={-4} rx={12} ry={3.5} fill="#9c9585" />
      {/* descent stage */}
      <path d="M-55 -78 L55 -78 L62 -60 L55 -30 L-55 -30 L-62 -60 Z" fill={`url(#${id}-gold)`} />
      <path d="M-14 -30 L14 -30 L18 -16 L-18 -16 Z" fill="#2a2a2e" />
      {/* ascent stage */}
      <path d="M-48 -78 L-52 -120 L-30 -150 L25 -150 L50 -128 L50 -78 Z" fill={`url(#${id}-silver)`} />
      <path d="M-30 -135 L-12 -142 L-12 -122 L-30 -118 Z" fill="#141419" />
      <rect x={-6} y={-112} width={22} height={20} fill="#2a2a2e" />
      <line x1={30} y1={-150} x2={40} y2={-168} stroke="#cfd1d4" strokeWidth={3} />
      <circle cx={42} cy={-170} r={6} fill="none" stroke="#cfd1d4" strokeWidth={2} />
    </svg>
  );
};
