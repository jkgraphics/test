import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {absoluteCues} from '../utils/timing';
import {colors, fonts} from '../utils/colors';
import {tween} from '../utils/animations';

/**
 * Timed captions for the whole documentary, driven by the narration cues in
 * documentaryConfig. Scenes flagged `narrationIsOnScreen` are skipped because
 * their narration is already rendered as kinetic type.
 */
export const SubtitleTrack: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = absoluteCues().find((c) => !c.onScreen && frame >= c.from && frame < c.to);
  if (!cue) return null;
  const a = Math.min(tween(frame, cue.from, cue.from + 6), tween(frame, cue.to - 6, cue.to, 1, 0));
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 64, pointerEvents: 'none'}}>
      <div
        style={{
          maxWidth: 1400,
          padding: '12px 28px 14px',
          background: 'rgba(4,5,7,0.62)',
          borderRadius: 6,
          fontFamily: fonts.body,
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.35,
          color: colors.text,
          textAlign: 'center',
          opacity: a,
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
