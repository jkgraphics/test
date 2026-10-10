import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ease, tween} from '../utils/animations';
import {colors, fonts} from '../utils/colors';
import {KineticText} from './KineticText';

/** Large editorial pull-quote with attribution. */
export const QuoteCard: React.FC<{
  text: string;
  attribution: string;
  context?: string;
  start: number;
  end: number;
  fontSize?: number;
  maxWidth?: number;
  highlight?: string[];
}> = ({text, attribution, context, start, end, fontSize = 64, maxWidth = 1350, highlight}) => {
  const frame = useCurrentFrame();
  if (frame < start - 1 || frame > end + 20) return null;
  const markIn = tween(frame, start, start + 20, 0, 1);
  const attrIn = tween(frame, start + 30, start + 50, 0, 1);
  const out = tween(frame, end, end + 16, 0, 1, ease.in);
  return (
    <div style={{maxWidth, opacity: 1 - out, position: 'relative'}}>
      <div
        style={{
          position: 'absolute',
          left: -90,
          top: -70,
          fontFamily: fonts.display,
          fontSize: 260,
          color: colors.accent,
          opacity: markIn * 0.9,
          lineHeight: 1,
        }}
      >
        “
      </div>
      <KineticText
        text={text}
        start={start + 6}
        stagger={1.6}
        highlight={highlight}
        style={{fontSize, lineHeight: 1.22, fontStyle: 'italic', fontWeight: 500}}
      />
      <div style={{marginTop: 40, opacity: attrIn, transform: `translateY(${(1 - attrIn) * 10}px)`}}>
        <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 30, color: colors.text}}>— {attribution}</div>
        {context ? <div style={{fontFamily: fonts.mono, fontSize: 20, letterSpacing: '0.15em', color: colors.textMuted, marginTop: 8, textTransform: 'uppercase'}}>{context}</div> : null}
      </div>
    </div>
  );
};
