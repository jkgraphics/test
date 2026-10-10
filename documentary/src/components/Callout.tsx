import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ease, tween} from '../utils/animations';
import {colors, fonts} from '../utils/colors';

/**
 * Annotation: a pulsing anchor dot, an elbow leader line that draws itself,
 * and a label block. Coordinates are absolute pixels in the parent.
 */
export const Callout: React.FC<{
  anchor: {x: number; y: number};
  label: {x: number; y: number};
  title: string;
  body?: string;
  start: number;
  end?: number;
  color?: string;
  align?: 'left' | 'right';
}> = ({anchor, label, title, body, start, end, color = colors.accent, align = 'left'}) => {
  const frame = useCurrentFrame();
  if (frame < start - 1) return null;
  const dot = tween(frame, start, start + 10, 0, 1);
  const draw = tween(frame, start + 4, start + 24, 0, 1, ease.inOut);
  const txt = tween(frame, start + 18, start + 34, 0, 1);
  const out = end === undefined ? 0 : tween(frame, end, end + 12, 0, 1, ease.in);
  const elbowX = label.x;
  const d = `M ${anchor.x} ${anchor.y} L ${elbowX} ${label.y} L ${label.x + (align === 'left' ? 34 : -34)} ${label.y}`;
  const pulse = (frame - start) % 45;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: 1 - out}}>
      <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width="100%" height="100%">
        <circle cx={anchor.x} cy={anchor.y} r={6 * dot} fill={color} />
        <circle cx={anchor.x} cy={anchor.y} r={6 + pulse * 0.5} fill="none" stroke={color} strokeOpacity={dot * (1 - pulse / 45)} strokeWidth={2} />
        <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="1" strokeDashoffset={1 - draw} />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: label.y - 18,
          ...(align === 'left' ? {left: label.x + 46} : {right: `calc(100% - ${label.x - 46}px)`}),
          textAlign: align,
          opacity: txt,
          transform: `translateX(${(1 - txt) * (align === 'left' ? -10 : 10)}px)`,
          width: 460,
        }}
      >
        <div style={{fontFamily: fonts.mono, fontSize: 22, letterSpacing: '0.12em', color, textTransform: 'uppercase'}}>{title}</div>
        {body ? <div style={{fontFamily: fonts.body, fontSize: 24, color: colors.textMuted, marginTop: 6, lineHeight: 1.35}}>{body}</div> : null}
      </div>
    </div>
  );
};
