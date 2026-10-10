import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';

/** Technical framing: corner brackets + optional top-left / top-right readouts. */
export const Hud: React.FC<{
  start?: number;
  topLeft?: string;
  topRight?: string;
  color?: string;
  opacity?: number;
}> = ({start = 0, topLeft, topRight, color = colors.text, opacity = 0.55}) => {
  const frame = useCurrentFrame();
  const a = tween(frame, start, start + 20, 0, 1) * opacity;
  const L = 44;
  const corner = (style: React.CSSProperties) => (
    <div style={{position: 'absolute', width: L, height: L, borderColor: withAlpha(color, 0.7), borderStyle: 'solid', borderWidth: 0, ...style}} />
  );
  const m = 56;
  return (
    <AbsoluteFill style={{opacity: a, pointerEvents: 'none'}}>
      {corner({top: m, left: m, borderTopWidth: 2, borderLeftWidth: 2})}
      {corner({top: m, right: m, borderTopWidth: 2, borderRightWidth: 2})}
      {corner({bottom: m, left: m, borderBottomWidth: 2, borderLeftWidth: 2})}
      {corner({bottom: m, right: m, borderBottomWidth: 2, borderRightWidth: 2})}
      {topLeft ? (
        <div style={{position: 'absolute', top: safe.y - 20, left: safe.x, fontFamily: fonts.mono, fontSize: 20, letterSpacing: '0.2em', color}}>{topLeft}</div>
      ) : null}
      {topRight ? (
        <div style={{position: 'absolute', top: safe.y - 20, right: safe.x, fontFamily: fonts.mono, fontSize: 20, letterSpacing: '0.2em', color}}>{topRight}</div>
      ) : null}
    </AbsoluteFill>
  );
};
