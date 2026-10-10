import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {sources} from '../config/content';
import {documentaryConfig} from '../config/documentaryConfig';
import {ease, tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';

/** SCENE 10 — SOURCES & CREDITS. Slow drift; every cited source on screen. */
export const CreditsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const a = Math.min(tween(frame, 0, 20), tween(frame, durationInFrames - 30, durationInFrames, 1, 0, ease.in));
  const drift = tween(frame, 0, durationInFrames, 20, -20, ease.linear);
  const list = Object.values(sources);
  return (
    <AbsoluteFill style={{background: colors.background, opacity: a}}>
      <div style={{position: 'absolute', left: safe.x, right: safe.x, top: safe.y + 10, transform: `translateY(${drift}px)`}}>
        <div style={{fontFamily: fonts.display, fontWeight: 700, fontSize: 64, color: colors.text}}>{documentaryConfig.meta.title}</div>
        <div style={{fontFamily: fonts.mono, fontSize: 20, letterSpacing: '0.3em', color: colors.accent, marginTop: 10}}>SOURCES</div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 80, rowGap: 16, marginTop: 34}}>
          {list.map((s, i) => (
            <div key={s.title} style={{opacity: tween(frame, 10 + i * 3, 30 + i * 3)}}>
              <div style={{fontFamily: fonts.body, fontSize: 22, color: colors.text}}>{s.title}</div>
              <div style={{fontFamily: fonts.mono, fontSize: 15, color: colors.textMuted, marginTop: 2}}>
                {s.publisher} · {s.url}
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop: 40, paddingTop: 22, borderTop: `1px solid ${withAlpha(colors.text, 0.15)}`, fontFamily: fonts.body, fontSize: 20, color: colors.textMuted, lineHeight: 1.6}}>
          All graphics are original motion graphics; maps, trajectories and descent profiles are schematic and not to scale.
          <br />
          Music and sound effects in this cut are procedurally generated placeholders. Replace before distribution.
        </div>
      </div>
    </AbsoluteFill>
  );
};
