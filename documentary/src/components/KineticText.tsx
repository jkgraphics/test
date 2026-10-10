import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ease, springIn, tween} from '../utils/animations';
import {colors, fonts} from '../utils/colors';

type Mode = 'words' | 'chars' | 'lines';

/**
 * Kinetic typography with masked entrances. Each unit (word/char/line) rises
 * out of an overflow-hidden mask with a staggered spring, then exits with a
 * soft blur-fade at `exitAt` (frames, relative to the parent Sequence).
 */
export const KineticText: React.FC<{
  text: string;
  start?: number;
  exitAt?: number;
  mode?: Mode;
  stagger?: number;
  style?: React.CSSProperties;
  /** Words (case-insensitive, punctuation ignored) rendered in the accent colour. */
  highlight?: string[];
  highlightColor?: string;
  align?: 'left' | 'center' | 'right';
}> = ({text, start = 0, exitAt, mode = 'words', stagger, style, highlight = [], highlightColor = colors.accent, align = 'left'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const units = mode === 'lines' ? text.split('\n') : mode === 'chars' ? Array.from(text) : text.split(' ');
  const step = stagger ?? (mode === 'chars' ? 1.2 : mode === 'words' ? 3 : 6);
  const exit = exitAt === undefined ? 0 : tween(frame, exitAt, exitAt + 14, 0, 1, ease.in);
  const hl = highlight.map((h) => h.toLowerCase());

  return (
    <div
      style={{
        fontFamily: fonts.display,
        color: colors.text,
        textAlign: align,
        opacity: 1 - exit,
        filter: exit > 0 ? `blur(${exit * 10}px)` : undefined,
        transform: `translateY(${-exit * 24}px)`,
        ...style,
      }}
    >
      {units.map((u, i) => {
        const p = springIn(frame, fps, start + i * step);
        const clean = u.toLowerCase().replace(/[^a-z0-9']/g, '');
        const isHl = hl.includes(clean);
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: mode === 'lines' ? 'block' : 'inline-block',
                overflow: 'hidden',
                verticalAlign: 'top',
                paddingBottom: '0.08em',
                marginBottom: '-0.08em',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: `translateY(${(1 - p) * 105}%)`,
                  opacity: Math.min(1, p * 1.6),
                  color: isHl ? highlightColor : undefined,
                  whiteSpace: 'pre',
                }}
              >
                {u}
              </span>
            </span>
            {mode === 'words' && i < units.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Small monospaced label with an accent rule — used above headlines. */
export const Eyebrow: React.FC<{text: string; start?: number; color?: string; style?: React.CSSProperties}> = ({
  text,
  start = 0,
  color = colors.accent,
  style,
}) => {
  const frame = useCurrentFrame();
  const line = tween(frame, start, start + 18, 0, 1);
  const txt = tween(frame, start + 6, start + 24, 0, 1);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 18, ...style}}>
      <div style={{width: 56 * line, height: 2, background: color}} />
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 22,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color,
          opacity: txt,
          transform: `translateX(${(1 - txt) * -12}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
