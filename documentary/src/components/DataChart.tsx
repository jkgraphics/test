import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ease, springIn, tween} from '../utils/animations';
import {colors, fonts, withAlpha} from '../utils/colors';

export type Datum = {label: string; value: number};

/**
 * Animated bar chart: gridlines fade in, bars grow with a staggered spring,
 * the highlighted bar (default: max) gets the accent colour and a value label.
 */
export const BarChart: React.FC<{
  data: readonly Datum[];
  width: number;
  height: number;
  start: number;
  unit?: string;
  maxValue?: number;
  highlightIndex?: number;
  gridStep?: number;
  decimals?: number;
}> = ({data, width, height, start, unit = '', maxValue, highlightIndex, gridStep = 1, decimals = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const max = maxValue ?? Math.ceil(Math.max(...data.map((d) => d.value)));
  const hi = highlightIndex ?? data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const plotH = height - 70;
  const slot = width / data.length;
  const barW = slot * 0.56;
  const gridIn = tween(frame, start, start + 20, 0, 1);

  return (
    <div style={{position: 'relative', width, height}}>
      {Array.from({length: Math.floor(max / gridStep) + 1}).map((_, i) => {
        const v = i * gridStep;
        const y = plotH - (v / max) * plotH;
        return (
          <div key={i} style={{position: 'absolute', left: 0, top: y, width: width * gridIn, height: 1, background: withAlpha(colors.text, i === 0 ? 0.4 : 0.1)}}>
            <div style={{position: 'absolute', left: -70, top: -14, width: 56, textAlign: 'right', fontFamily: fonts.mono, fontSize: 20, color: colors.textMuted, opacity: gridIn}}>
              {v}
              {unit}
            </div>
          </div>
        );
      })}
      {data.map((d, i) => {
        const g = springIn(frame, fps, start + 12 + i * 4, 200, 40);
        const h = (d.value / max) * plotH * g;
        const isHi = i === hi;
        const labelIn = tween(frame, start + 40 + i * 4, start + 55 + i * 4, 0, 1);
        return (
          <div key={d.label}>
            <div
              style={{
                position: 'absolute',
                left: i * slot + (slot - barW) / 2,
                top: plotH - h,
                width: barW,
                height: h,
                background: isHi ? colors.accent : withAlpha(colors.accent2, 0.55),
                boxShadow: isHi ? `0 0 40px ${withAlpha(colors.accent, 0.45)}` : undefined,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: i * slot,
                width: slot,
                top: plotH - h - 40,
                textAlign: 'center',
                fontFamily: fonts.mono,
                fontSize: isHi ? 26 : 19,
                fontWeight: isHi ? 700 : 400,
                color: isHi ? colors.accent : colors.textMuted,
                opacity: labelIn,
              }}
            >
              {d.value.toFixed(decimals)}
              {unit}
            </div>
            <div style={{position: 'absolute', left: i * slot, width: slot, top: plotH + 16, textAlign: 'center', fontFamily: fonts.mono, fontSize: 20, color: isHi ? colors.text : colors.textMuted, opacity: gridIn}}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Animated line chart; the line is revealed left→right from `start` over `duration` frames. */
export const LineChart: React.FC<{
  points: readonly {x: number; y: number}[];
  width: number;
  height: number;
  start: number;
  duration?: number;
  color?: string;
  domain: {x: [number, number]; y: [number, number]};
  fill?: boolean;
  /** Override the reveal (0..1 of the x-axis) — e.g. to sync with a moving marker. */
  progress?: number;
}> = ({points, width, height, start, duration = 60, color = colors.accent2, domain, fill = true, progress}) => {
  const frame = useCurrentFrame();
  const draw = progress ?? tween(frame, start, start + duration, 0, 1, ease.inOut);
  const sx = (x: number) => ((x - domain.x[0]) / (domain.x[1] - domain.x[0])) * width;
  const sy = (y: number) => height - ((y - domain.y[0]) / (domain.y[1] - domain.y[0])) * height;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`).join(' ');
  const area = `${d} L ${sx(points[points.length - 1].x)} ${height} L ${sx(points[0].x)} ${height} Z`;
  const gid = `lc-${Math.round(width)}-${Math.round(height)}`;
  return (
    <svg width={width} height={height} style={{overflow: 'visible'}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${gid}-clip`}>
          <rect x={0} y={-20} width={width * draw} height={height + 40} />
        </clipPath>
      </defs>
      {fill ? <path d={area} fill={`url(#${gid})`} clipPath={`url(#${gid}-clip)`} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={3} clipPath={`url(#${gid}-clip)`} />
    </svg>
  );
};
