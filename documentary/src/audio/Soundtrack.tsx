import React from 'react';
import {Audio, Sequence, interpolate, staticFile} from 'remotion';
import {documentaryConfig, type SfxName, type TransitionType} from '../config/documentaryConfig';
import {absoluteCues, sec, timeline} from '../utils/timing';

const audioCfg = documentaryConfig.audio;

const SFX_FILES: Record<SfxName, string> = {
  whoosh: 'audio/sfx/whoosh.mp3',
  impact: 'audio/sfx/impact.mp3',
  riser: 'audio/sfx/riser.mp3',
  alarm: 'audio/sfx/alarm.mp3',
  beep: 'audio/sfx/beep.mp3',
  rumble: 'audio/sfx/rumble.mp3',
};

/** Which sound (if any) accompanies each transition style. */
const TRANSITION_SFX: Partial<Record<TransitionType, {name: SfxName; lead: number; volume: number}>> = {
  whipPan: {name: 'whoosh', lead: 0.2, volume: 0.8},
  zoomThrough: {name: 'whoosh', lead: 0.3, volume: 0.7},
  shapeWipe: {name: 'whoosh', lead: 0.25, volume: 0.6},
  lightLeak: {name: 'whoosh', lead: 0.4, volume: 0.35},
  iris: {name: 'impact', lead: 0, volume: 0.45},
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0..1 — how much the music should duck at master frame `f`. */
const duckAmount = (f: number, fps: number): number => {
  if (!audioCfg.voiceOver.enabled) return 0;
  const ramp = sec(audioCfg.duckRampSec, fps);
  let amount = 0;
  for (const c of absoluteCues(fps)) {
    if (f < c.from - ramp || f > c.to + ramp) continue;
    const a = interpolate(f, [c.from - ramp, c.from, c.to, c.to + ramp], [0, 1, 1, 0], clamp);
    amount = Math.max(amount, a);
  }
  return amount;
};

const fadeEnvelope = (f: number, total: number, fps: number, inSec: number, outSec: number) =>
  Math.min(interpolate(f, [0, sec(inSec, fps)], [0, 1], clamp), interpolate(f, [total - sec(outSec, fps), total], [1, 0], clamp));

/**
 * The full mix: music bed (with fades + ducking under narration), ambience,
 * per-scene voice-over, scene SFX and automatic transition SFX.
 */
export const Soundtrack: React.FC = () => {
  const fps = documentaryConfig.meta.fps;
  const total = timeline.totalFrames;

  const sfxEvents: {from: number; name: SfxName; volume: number}[] = [];
  for (const scene of timeline.scenes) {
    for (const s of scene.sfx ?? []) {
      sfxEvents.push({from: scene.from + sec(s.at, fps), name: s.name, volume: s.volume ?? 1});
    }
    if (audioCfg.transitionSfx && scene.transitionOut && scene.overlapOut > 0) {
      const t = TRANSITION_SFX[scene.transitionOut.type];
      if (t) {
        const boundary = scene.from + scene.durationInFrames - scene.overlapOut;
        sfxEvents.push({from: Math.max(0, boundary - sec(t.lead, fps)), name: t.name, volume: t.volume});
      }
    }
  }

  return (
    <>
      {audioCfg.music.src ? (
        <Audio
          src={staticFile(audioCfg.music.src)}
          volume={(f) => {
            const base = audioCfg.music.volume + (audioCfg.music.duckedVolume - audioCfg.music.volume) * duckAmount(f, fps);
            return base * fadeEnvelope(f, total, fps, audioCfg.music.fadeInSec, audioCfg.music.fadeOutSec);
          }}
        />
      ) : null}

      {audioCfg.ambience.src ? (
        <Audio
          src={staticFile(audioCfg.ambience.src)}
          loop
          volume={(f) => audioCfg.ambience.volume * fadeEnvelope(f, total, fps, audioCfg.ambience.fadeInSec, audioCfg.ambience.fadeOutSec)}
        />
      ) : null}

      {audioCfg.voiceOver.enabled
        ? timeline.scenes
            .filter((s) => s.voiceOver)
            .map((s) => (
              <Sequence key={`vo-${s.id}`} from={s.from} durationInFrames={s.durationInFrames} name={`VO · ${s.id}`}>
                <Audio src={staticFile(s.voiceOver as string)} volume={audioCfg.voiceOver.volume} />
              </Sequence>
            ))
        : null}

      {sfxEvents.map((e, i) => (
        <Sequence key={`sfx-${i}`} from={e.from} durationInFrames={sec(6, fps)} name={`SFX · ${e.name}`}>
          <Audio src={staticFile(SFX_FILES[e.name])} volume={e.volume * audioCfg.sfxVolume} />
        </Sequence>
      ))}
    </>
  );
};
