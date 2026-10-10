import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {ChapterTitle} from '../components/ChapterTitle';
import {TimelineGraphic} from '../components/TimelineGraphic';
import {QuoteCard} from '../components/QuoteCard';
import {Eyebrow} from '../components/KineticText';
import {Moon} from '../components/Celestial';
import {kennedyQuote, timeline} from '../config/content';
import {ease, envelope, tween} from '../utils/animations';
import {colors, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

const SPACING = 640;

/**
 * SCENE 3 — CHAPTER ONE: THE RACE (history & context)
 * A horizontal timeline; the camera whips from event to event exactly when the
 * narration names it. The Kennedy quote interrupts as a full-frame pull-quote.
 * The Apollo 1 tragedy shifts the palette to alert red for a beat.
 */
export const HistoryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cues = getScene('history').narration;
  // Narration cue → timeline event mapping (cue 4 is the Rice quote = event 4).
  const activeAt = [0, 1, 2, 3, 4, 5, 6].map((i) => sec(cues[i].start, fps));
  const quoteStart = sec(cues[4].start, fps) + 6;
  const quoteEnd = sec(cues[4].end, fps) - 6;
  const quoteDim = envelope(frame, quoteStart - 10, quoteEnd + 16, 14, 16);
  const tragedy = envelope(frame, activeAt[5], activeAt[6], 10, 16);
  const moonRise = tween(frame, activeAt[6], activeAt[6] + sec(3, fps), 0, 1, ease.out);

  const camKeys = [{frame: 0, x: 200, scale: 1.05}];
  activeAt.forEach((f, i) => {
    camKeys.push({frame: Math.max(f - 22, camKeys[camKeys.length - 1].frame + 1), x: i === 0 ? 120 : -(i - 1) * SPACING, scale: 1});
    camKeys.push({frame: f + 4, x: -i * SPACING, scale: 1});
  });
  camKeys.push({frame: sec(40, fps), x: -6 * SPACING - 60, scale: 1.04});

  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Camera keys={camKeys} easing={ease.inOut}>
        <Layer depth={0.08}>
          <Starfield seed={31} count={300} opacity={0.65} />
        </Layer>
        <Layer depth={1}>
          <TimelineGraphic events={timeline} activeAt={activeAt} spacing={SPACING} />
        </Layer>
      </Camera>

      <div style={{position: 'absolute', left: 1480, top: 70, opacity: moonRise * 0.9, transform: `translateY(${(1 - moonRise) * 120}px)`}}>
        <Moon size={300} lightAngle={160} shadow={0.35} glow={0.15} />
      </div>

      <AbsoluteFill style={{paddingLeft: safe.x, paddingTop: safe.y}}>
        <Eyebrow text="The Space Race · 1957–1968" start={sec(4, fps)} />
      </AbsoluteFill>

      {/* Apollo 1 — tonal shift */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,0,0,0) 30%, ${withAlpha(colors.alert, 0.28)} 100%)`,
          opacity: tragedy,
        }}
      />

      {/* Kennedy pull-quote */}
      <AbsoluteFill style={{background: `rgba(4,5,7,${quoteDim * 0.95})`}} />
      {quoteDim > 0 ? (
        <AbsoluteFill style={{justifyContent: 'center', paddingLeft: safe.x + 120}}>
          <QuoteCard
            text={kennedyQuote.text}
            attribution={kennedyQuote.attribution}
            context={kennedyQuote.context}
            start={quoteStart}
            end={quoteEnd}
            fontSize={62}
            highlight={['hard']}
          />
        </AbsoluteFill>
      ) : null}

      <ChapterTitle number="CHAPTER ONE" title="The Race" end={sec(3.6, fps)} backdrop={0.9} />
    </AbsoluteFill>
  );
};
