import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ease, tween} from '../utils/animations';
import {colors, fonts} from '../utils/colors';

/** Counts from `from` to `value` between `start` and `start + duration` frames. */
export const AnimatedCounter: React.FC<{
  value: number;
  from?: number;
  start?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
  easing?: (t: number) => number;
}> = ({value, from = 0, start = 0, duration = 45, decimals = 0, prefix = '', suffix = '', style, easing = ease.out}) => {
  const frame = useCurrentFrame();
  const v = tween(frame, start, start + duration, from, value, easing);
  const formatted = v.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
  return (
    <span style={{fontFamily: fonts.mono, fontVariantNumeric: 'tabular-nums', color: colors.text, ...style}}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
