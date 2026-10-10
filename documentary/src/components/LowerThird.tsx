import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ease, springIn, tween} from '../utils/animations';
import {colors, fonts, safe} from '../utils/colors';

/**
 * Broadcast-style lower third for people, places and key facts.
 * Positioned inside the safe area; set `position` to 'left' or 'right'.
 */
export const LowerThird: React.FC<{
  title: string;
  subtitle?: string;
  meta?: string;
  start: number;
  end: number;
  accent?: string;
  position?: 'left' | 'right';
  bottom?: number;
}> = ({title, subtitle, meta, start, end, accent = colors.accent, position = 'left', bottom = safe.y + 150}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < start - 1 || frame > end + 16) return null;

  const bar = springIn(frame, fps, start, 200, 24);
  const titleIn = springIn(frame, fps, start + 6);
  const subIn = springIn(frame, fps, start + 12);
  const out = tween(frame, end, end + 14, 0, 1, ease.in);

  return (
    <div
      style={{
        position: 'absolute',
        bottom,
        [position]: safe.x,
        display: 'flex',
        flexDirection: position === 'left' ? 'row' : 'row-reverse',
        alignItems: 'stretch',
        gap: 24,
        opacity: 1 - out,
        transform: `translateX(${(position === 'left' ? -1 : 1) * out * 30}px)`,
      }}
    >
      <div style={{width: 5, background: accent, transform: `scaleY(${bar})`, transformOrigin: 'bottom'}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 8, textAlign: position}}>
        {meta ? (
          <div style={{fontFamily: fonts.mono, fontSize: 20, letterSpacing: '0.22em', color: accent, opacity: subIn, textTransform: 'uppercase'}}>{meta}</div>
        ) : null}
        <div style={{overflow: 'hidden'}}>
          <div
            style={{
              fontFamily: fonts.body,
              fontWeight: 700,
              fontSize: 48,
              color: colors.text,
              transform: `translateY(${(1 - titleIn) * 100}%)`,
              letterSpacing: '-0.01em',
              textShadow: '0 2px 20px rgba(0,0,0,0.6)',
            }}
          >
            {title}
          </div>
        </div>
        {subtitle ? (
          <div style={{overflow: 'hidden'}}>
            <div style={{fontFamily: fonts.body, fontSize: 26, color: colors.textMuted, transform: `translateY(${(1 - subIn) * 100}%)`}}>{subtitle}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
