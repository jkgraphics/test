import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ease, springIn, tween} from '../utils/animations';
import {colors, fonts, withAlpha} from '../utils/colors';

/**
 * Full-frame chapter card: number in mono, title in display serif revealed by
 * a horizontal mask, framed by rules that draw outward from the centre.
 */
export const ChapterTitle: React.FC<{
  number: string;
  title: string;
  start?: number;
  end: number;
  /** Darken what's behind the card (0..1). */
  backdrop?: number;
  accent?: string;
}> = ({number, title, start = 0, end, backdrop = 0.75, accent = colors.accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame > end + 20) return null;

  const rule = tween(frame, start + 4, start + 34, 0, 1, ease.inOut);
  const reveal = springIn(frame, fps, start + 10, 200, 40);
  const numIn = tween(frame, start, start + 20, 0, 1);
  const out = tween(frame, end - 12, end + 8, 0, 1, ease.in);
  const bg = tween(frame, start, start + 10, 0, backdrop) * (1 - out);

  return (
    <AbsoluteFill style={{background: `rgba(4,5,7,${bg})`, alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: 1 - out,
          transform: `scale(${1 + out * 0.06})`,
          filter: out > 0 ? `blur(${out * 8}px)` : undefined,
        }}
      >
        <div style={{fontFamily: fonts.mono, fontSize: 26, letterSpacing: '0.5em', color: accent, opacity: numIn, marginBottom: 34, paddingLeft: '0.5em'}}>
          {number}
        </div>
        <div style={{width: 900 * rule, height: 1, background: withAlpha(colors.text, 0.5)}} />
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 148,
            fontWeight: 700,
            color: colors.text,
            lineHeight: 1.1,
            padding: '28px 0 22px',
            clipPath: `inset(0 ${(1 - reveal) * 50}% 0 ${(1 - reveal) * 50}%)`,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        <div style={{width: 900 * rule, height: 1, background: withAlpha(colors.text, 0.5)}} />
      </div>
    </AbsoluteFill>
  );
};
