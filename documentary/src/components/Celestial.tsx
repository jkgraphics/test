import React, {useId, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {seededArray} from '../utils/random';
import {colors, withAlpha} from '../utils/colors';

const useSvgId = (prefix: string) => `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/**
 * Procedural Moon: albedo gradient, maria, seeded craters, limb darkening and
 * a soft terminator. `lightAngle` is the direction the sunlight comes FROM
 * (degrees, 0 = from the left), `phase` 0..1 how much of the disc is in shadow.
 */
export const Moon: React.FC<{
  size: number;
  lightAngle?: number;
  shadow?: number;
  seed?: number;
  rotate?: number;
  glow?: number;
}> = ({size, lightAngle = 200, shadow = 0.55, seed = 42, rotate = 0, glow = 0.25}) => {
  const id = useSvgId('moon');
  const R = 500;
  const craters = useMemo(
    () =>
      seededArray(seed, 140, (r) => {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * R * 0.97;
        const big = r() > 0.9;
        return {x: Math.cos(a) * d, y: Math.sin(a) * d, r: big ? 18 + r() * 40 : 3 + r() * 14, o: 0.15 + r() * 0.35};
      }),
    [seed],
  );
  const maria = useMemo(
    () =>
      seededArray(seed + 1, 9, (r) => ({
        x: (r() - 0.5) * R * 1.1,
        y: (r() - 0.6) * R * 1.0,
        rx: 60 + r() * 150,
        ry: 50 + r() * 110,
        rot: r() * 180,
        o: 0.25 + r() * 0.25,
      })),
    [seed],
  );
  const rad = (lightAngle * Math.PI) / 180;
  const lx = 0.5 - Math.cos(rad) * 0.5;
  const ly = 0.5 - Math.sin(rad) * 0.5;
  return (
    <svg width={size} height={size} viewBox={`${-R - 60} ${-R - 60} ${2 * R + 120} ${2 * R + 120}`} style={{overflow: 'visible'}}>
      <defs>
        <radialGradient id={`${id}-base`} cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#e4dfd5" />
          <stop offset="70%" stopColor="#a9a398" />
          <stop offset="100%" stopColor="#6f6a61" />
        </radialGradient>
        <radialGradient id={`${id}-crater`}>
          <stop offset="0%" stopColor="#4a463f" stopOpacity={0.8} />
          <stop offset="75%" stopColor="#6d685f" stopOpacity={0.5} />
          <stop offset="92%" stopColor="#f1ece2" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#f1ece2" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-term`} x1={lx} y1={ly} x2={1 - lx} y2={1 - ly}>
          <stop offset="0%" stopColor="#000" stopOpacity={0} />
          <stop offset={`${Math.max(0, 1 - shadow - 0.18) * 100}%`} stopColor="#000" stopOpacity={0} />
          <stop offset={`${Math.min(1, 1 - shadow + 0.12) * 100}%`} stopColor="#000" stopOpacity={0.92} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.98} />
        </linearGradient>
        <radialGradient id={`${id}-limb`}>
          <stop offset="70%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.55} />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="80%" stopColor={colors.moon} stopOpacity={glow} />
          <stop offset="100%" stopColor={colors.moon} stopOpacity={0} />
        </radialGradient>
        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <circle r={R} />
        </clipPath>
      </defs>
      <circle r={R + 60} fill={`url(#${id}-glow)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <g transform={`rotate(${rotate})`}>
          <circle r={R} fill={`url(#${id}-base)`} />
          <g filter={`url(#${id}-soft)`}>
            {maria.map((m, i) => (
              <ellipse key={i} cx={m.x} cy={m.y} rx={m.rx} ry={m.ry} transform={`rotate(${m.rot} ${m.x} ${m.y})`} fill="#5b574f" opacity={m.o} />
            ))}
          </g>
          {craters.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={`url(#${id}-crater)`} opacity={c.o} />
          ))}
        </g>
        <circle r={R} fill={`url(#${id}-limb)`} />
        <circle r={R} fill={`url(#${id}-term)`} />
      </g>
    </svg>
  );
};

/** Procedural Earth with drifting cloud bands, atmosphere rim and terminator. */
export const Earth: React.FC<{size: number; lightAngle?: number; shadow?: number; seed?: number; spin?: number}> = ({
  size,
  lightAngle = 200,
  shadow = 0.45,
  seed = 11,
  spin = 0.6,
}) => {
  const frame = useCurrentFrame();
  const id = useSvgId('earth');
  const R = 500;
  const land = useMemo(
    () => seededArray(seed, 20, (r) => ({x: r() * 2400 - 1200, y: (r() - 0.5) * 760, rx: 50 + r() * 170, ry: 40 + r() * 130, rot: r() * 180, desert: r() > 0.65})),
    [seed],
  );
  const clouds = useMemo(
    () => seededArray(seed + 5, 60, (r) => ({x: r() * 2400 - 1200, y: (r() - 0.5) * 950, rx: 25 + r() * 120, ry: 12 + r() * 45, o: 0.2 + r() * 0.45, rot: (r() - 0.5) * 50})),
    [seed],
  );
  const shift = (frame * spin) % 2400;
  const wrap = (x: number, s: number) => ((((x + s + 1200) % 2400) + 2400) % 2400) - 1200;
  const rad = (lightAngle * Math.PI) / 180;
  const lx = 0.5 - Math.cos(rad) * 0.5;
  const ly = 0.5 - Math.sin(rad) * 0.5;
  return (
    <svg width={size} height={size} viewBox={`${-R - 80} ${-R - 80} ${2 * R + 160} ${2 * R + 160}`} style={{overflow: 'visible'}}>
      <defs>
        <radialGradient id={`${id}-ocean`} cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#3f86c9" />
          <stop offset="60%" stopColor="#174a86" />
          <stop offset="100%" stopColor="#0a1f3d" />
        </radialGradient>
        <radialGradient id={`${id}-atmo`}>
          <stop offset="86%" stopColor={colors.accent2} stopOpacity={0.0} />
          <stop offset="91%" stopColor={colors.accent2} stopOpacity={0.55} />
          <stop offset="100%" stopColor={colors.accent2} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-term`} x1={lx} y1={ly} x2={1 - lx} y2={1 - ly}>
          <stop offset="0%" stopColor="#000" stopOpacity={0} />
          <stop offset={`${Math.max(0, 1 - shadow - 0.22) * 100}%`} stopColor="#000" stopOpacity={0} />
          <stop offset={`${Math.min(1, 1 - shadow + 0.18) * 100}%`} stopColor="#01030a" stopOpacity={0.94} />
          <stop offset="100%" stopColor="#01030a" stopOpacity={0.98} />
        </linearGradient>
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation="20" />
        </filter>
        <filter id={`${id}-cblur`}>
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <circle r={R} />
        </clipPath>
      </defs>
      <circle r={R * 1.1} fill={`url(#${id}-atmo)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <circle r={R} fill={`url(#${id}-ocean)`} />
        <g filter={`url(#${id}-blur)`}>
          {land.map((l, i) => (
            <ellipse key={i} cx={wrap(l.x, shift)} cy={l.y} rx={l.rx} ry={l.ry} transform={`rotate(${l.rot} ${wrap(l.x, shift)} ${l.y})`} fill={l.desert ? '#8c7a4e' : '#4f6a35'} opacity={0.6} />
          ))}
        </g>
        <g filter={`url(#${id}-cblur)`}>
          {clouds.map((c, i) => (
            <ellipse key={i} cx={wrap(c.x, shift * 1.3)} cy={c.y} rx={c.rx} ry={c.ry} transform={`rotate(${c.rot} ${wrap(c.x, shift * 1.3)} ${c.y})`} fill="#f4f7fb" opacity={c.o} />
          ))}
        </g>
        <circle r={R} fill={`url(#${id}-term)`} />
      </g>
      <circle r={R} fill="none" stroke={withAlpha(colors.accent2, 0.5)} strokeWidth={3} />
    </svg>
  );
};

/** Orthographic graticule globe with geo markers — a schematic "satellite" map. */
export const Globe: React.FC<{
  size: number;
  centerLon: number;
  centerLat: number;
  markers?: {lat: number; lon: number; color?: string; progress?: number}[];
  gridOpacity?: number;
}> = ({size, centerLon, centerLat, markers = [], gridOpacity = 0.35}) => {
  const id = useSvgId('globe');
  const R = size / 2 - 4;
  const toRad = Math.PI / 180;
  const l0 = centerLon * toRad;
  const p0 = centerLat * toRad;
  const project = (lat: number, lon: number) => {
    const p = lat * toRad;
    const l = lon * toRad;
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
    return {
      x: R * Math.cos(p) * Math.sin(l - l0),
      y: -R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0)),
      visible: cosc > 0,
      depth: cosc,
    };
  };
  const line = (pts: {lat: number; lon: number}[]) => {
    let d = '';
    let pen = false;
    for (const pt of pts) {
      const q = project(pt.lat, pt.lon);
      if (q.visible) {
        d += `${pen ? 'L' : 'M'} ${q.x.toFixed(1)} ${q.y.toFixed(1)} `;
        pen = true;
      } else pen = false;
    }
    return d;
  };
  const paths: string[] = [];
  for (let lat = -75; lat <= 75; lat += 15) paths.push(line(Array.from({length: 121}, (_, i) => ({lat, lon: -180 + i * 3}))));
  for (let lon = -180; lon < 180; lon += 15) paths.push(line(Array.from({length: 61}, (_, i) => ({lat: -90 + i * 3, lon}))));
  const equator = line(Array.from({length: 121}, (_, i) => ({lat: 0, lon: -180 + i * 3})));
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{overflow: 'visible'}}>
      <defs>
        <radialGradient id={`${id}-fill`} cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#14304f" />
          <stop offset="100%" stopColor="#050b14" />
        </radialGradient>
        <radialGradient id={`${id}-rim`}>
          <stop offset="90%" stopColor={colors.accent2} stopOpacity={0} />
          <stop offset="97%" stopColor={colors.accent2} stopOpacity={0.45} />
          <stop offset="100%" stopColor={colors.accent2} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r={R * 1.05} fill={`url(#${id}-rim)`} />
      <circle r={R} fill={`url(#${id}-fill)`} />
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={colors.accent2} strokeOpacity={gridOpacity} strokeWidth={1} />
      ))}
      <path d={equator} fill="none" stroke={colors.accent2} strokeOpacity={gridOpacity * 1.8} strokeWidth={1.5} />
      <circle r={R} fill="none" stroke={withAlpha(colors.accent2, 0.7)} strokeWidth={2} />
      {markers.map((m, i) => {
        const q = project(m.lat, m.lon);
        if (!q.visible) return null;
        const c = m.color ?? colors.accent;
        const p = m.progress ?? 1;
        return (
          <g key={i} opacity={Math.min(1, q.depth * 3) * p}>
            <circle cx={q.x} cy={q.y} r={22 * p} fill="none" stroke={c} strokeWidth={2} />
            <circle cx={q.x} cy={q.y} r={7} fill={c} />
            <line x1={q.x - 40} y1={q.y} x2={q.x - 26} y2={q.y} stroke={c} strokeWidth={2} />
            <line x1={q.x + 26} y1={q.y} x2={q.x + 40} y2={q.y} stroke={c} strokeWidth={2} />
            <line x1={q.x} y1={q.y - 40} x2={q.x} y2={q.y - 26} stroke={c} strokeWidth={2} />
            <line x1={q.x} y1={q.y + 26} x2={q.x} y2={q.y + 40} stroke={c} strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
};

/** Exposed for scenes that need to place HTML labels next to globe markers. */
export const projectOrthographic = (size: number, centerLat: number, centerLon: number, lat: number, lon: number) => {
  const R = size / 2 - 4;
  const toRad = Math.PI / 180;
  const p = lat * toRad;
  const l = lon * toRad;
  const p0 = centerLat * toRad;
  const l0 = centerLon * toRad;
  return {
    x: R * Math.cos(p) * Math.sin(l - l0),
    y: -R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0)),
  };
};
