import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ease, tween} from '../utils/animations';
import {colors, fonts, withAlpha} from '../utils/colors';

export type TimelineEvent = {date: string; year: string; title: string; body: string; tone?: 'alert'};

/**
 * Horizontal timeline. Events are spaced `spacing` px apart; the parent is
 * expected to move a <Camera> so the active event stays centred.
 * `activeAt[i]` is the frame at which event i becomes active.
 */
export const TimelineGraphic: React.FC<{
  events: readonly TimelineEvent[];
  activeAt: number[];
  spacing?: number;
  y?: number;
  originX?: number;
}> = ({events, activeAt, spacing = 620, y = 560, originX = 960}) => {
  const frame = useCurrentFrame();
  const totalW = spacing * (events.length - 1);
  const lineDraw = tween(frame, activeAt[0] - 20, activeAt[activeAt.length - 1] + 10, 0, 1, ease.linear);

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%'}}>
      {/* track */}
      <div style={{position: 'absolute', left: originX - 400, top: y, width: totalW + 800, height: 1, background: withAlpha(colors.text, 0.15)}} />
      <div style={{position: 'absolute', left: originX, top: y - 1, width: totalW * lineDraw, height: 3, background: colors.accent, boxShadow: `0 0 18px ${withAlpha(colors.accent, 0.6)}`}} />
      {/* ticks every quarter spacing */}
      {Array.from({length: (events.length - 1) * 4 + 1}).map((_, i) => (
        <div key={i} style={{position: 'absolute', left: originX + (i * spacing) / 4, top: y + 10, width: 1, height: i % 4 === 0 ? 0 : 10, background: withAlpha(colors.text, 0.25)}} />
      ))}
      {events.map((e, i) => {
        const x = originX + i * spacing;
        const on = tween(frame, activeAt[i], activeAt[i] + 18, 0, 1);
        const next = activeAt[i + 1];
        const dim = next === undefined ? 0 : tween(frame, next, next + 15, 0, 1);
        const accent = e.tone === 'alert' ? colors.alert : colors.accent;
        const above = i % 2 === 0;
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: x - 11,
                top: y - 10,
                width: 22,
                height: 22,
                borderRadius: 11,
                border: `2px solid ${on > 0 ? accent : withAlpha(colors.text, 0.3)}`,
                background: on > 0.5 ? accent : colors.background,
                transform: `scale(${1 + on * (1 - dim) * 0.3})`,
                boxShadow: on > 0 && dim < 1 ? `0 0 ${30 * (1 - dim)}px ${withAlpha(accent, 0.8)}` : undefined,
              }}
            />
            {/* year — big ghost number */}
            <div
              style={{
                position: 'absolute',
                left: x - 300,
                width: 600,
                top: above ? y + 40 : y - 190,
                textAlign: 'center',
                fontFamily: fonts.display,
                fontWeight: 800,
                fontSize: 150,
                lineHeight: 1,
                color: withAlpha(colors.text, 0.06 + on * (1 - dim * 0.7) * 0.1),
              }}
            >
              {e.year}
            </div>
            <div
              style={{
                position: 'absolute',
                left: x - 250,
                width: 500,
                top: above ? undefined : y + 60,
                bottom: above ? 1080 - y + 50 : undefined,
                textAlign: 'center',
                opacity: Math.max(0.28, on * (1 - dim * 0.65)),
                transform: `translateY(${(1 - on) * (above ? 20 : -20)}px)`,
              }}
            >
              <div style={{fontFamily: fonts.mono, fontSize: 22, letterSpacing: '0.18em', color: accent}}>{e.date}</div>
              <div style={{fontFamily: fonts.display, fontWeight: 700, fontSize: 54, color: colors.text, marginTop: 10}}>{e.title}</div>
              <div style={{fontFamily: fonts.body, fontSize: 26, color: colors.textMuted, marginTop: 10, lineHeight: 1.4}}>{e.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
