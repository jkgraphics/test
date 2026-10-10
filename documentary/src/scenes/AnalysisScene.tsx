import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {ChapterTitle} from '../components/ChapterTitle';
import {AnimatedCounter} from '../components/AnimatedCounter';
import {Eyebrow} from '../components/KineticText';
import {Beat} from '../components/Fade';
import {Moon} from '../components/Celestial';
import {Particles} from '../components/Atmosphere';
import {landings, legacy} from '../config/content';
import {ease, springIn, tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

/**
 * SCENE 8 — CHAPTER FOUR: THE LEGACY (analysis & impact)
 * Beat A: Apollo 11–17 mission strip; six landings, twelve moonwalkers.
 * Beat B: 382 kg of samples & what they revealed about the Moon's origin.
 * Beat C: the gap — a line from December 1972 that has not yet been continued.
 */
export const AnalysisScene: React.FC = () => {
  const {fps} = useVideoConfig();
  const cues = getScene('analysis').narration;
  const bAt = sec(cues[2].start, fps) - 10;
  const cAt = sec(cues[4].start, fps) - 10;
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Starfield seed={131} count={260} opacity={0.5} />
      <Sequence durationInFrames={bAt + 15} name="A · Missions">
        <Beat fadeIn={1} fadeOut={15}>
          <MissionsBeat walkersAt={sec(cues[1].start, fps)} startAt={sec(cues[0].start, fps)} />
        </Beat>
      </Sequence>
      <Sequence from={bAt} durationInFrames={cAt - bAt + 15} name="B · Samples">
        <Beat fadeIn={15} fadeOut={15}>
          <SamplesBeat originAt={sec(cues[3].start, fps) - bAt} />
        </Beat>
      </Sequence>
      <Sequence from={cAt} name="C · The gap">
        <Beat fadeIn={15} fadeOut={1}>
          <GapBeat />
        </Beat>
      </Sequence>
      <ChapterTitle number="CHAPTER FOUR" title="The Legacy" end={sec(3.4, fps)} backdrop={0.9} />
    </AbsoluteFill>
  );
};

const MissionsBeat: React.FC<{startAt: number; walkersAt: number}> = ({startAt, walkersAt}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const cardW = 214;
  return (
    <Camera keys={[{frame: 0, scale: 1.05, x: 40}, {frame: durationInFrames, scale: 1.0, x: -20}]}>
      <Layer depth={1}>
        <div style={{position: 'absolute', left: safe.x, top: 190, display: 'flex', gap: 120}}>
          <div>
            <Eyebrow text="Crewed landings" start={startAt} />
            <AnimatedCounter value={legacy.landings} start={startAt + 6} duration={30} style={{fontSize: 150, fontWeight: 700, display: 'block', marginTop: 10}} />
          </div>
          <div style={{opacity: tween(frame, walkersAt, walkersAt + 15)}}>
            <Eyebrow text="Moonwalkers" start={walkersAt} />
            <AnimatedCounter value={legacy.moonwalkers} start={walkersAt + 6} duration={30} style={{fontSize: 150, fontWeight: 700, display: 'block', marginTop: 10, color: colors.accent}} />
          </div>
        </div>
        <div style={{position: 'absolute', left: safe.x, top: 540, display: 'flex', gap: 20}}>
          {landings.map((m, i) => {
            const p = springIn(frame, fps, startAt + 10 + i * 6);
            const isThirteen = !m.landed;
            const hl = isThirteen ? tween(frame, walkersAt + 40, walkersAt + 60) : 0;
            return (
              <div
                key={m.mission}
                style={{
                  width: cardW,
                  height: 300,
                  padding: '22px 20px',
                  border: `1px solid ${isThirteen ? withAlpha(colors.alert, 0.3 + hl * 0.5) : m.mission === 'Apollo 11' ? colors.accent : colors.line}`,
                  background: m.mission === 'Apollo 11' ? withAlpha(colors.accent, 0.08) : withAlpha(colors.panel, 0.7),
                  opacity: p,
                  transform: `translateY(${(1 - p) * 50}px)`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{fontFamily: fonts.mono, fontSize: 18, letterSpacing: '0.16em', color: colors.textMuted}}>{m.date}</div>
                  <div style={{fontFamily: fonts.display, fontWeight: 700, fontSize: 40, color: colors.text, marginTop: 8}}>{m.mission}</div>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      background: m.landed ? colors.moon : 'transparent',
                      border: `2px solid ${m.landed ? colors.moon : colors.alert}`,
                      boxShadow: m.landed ? `0 0 16px ${withAlpha(colors.moon, 0.6)}` : undefined,
                    }}
                  />
                  <div style={{fontFamily: fonts.body, fontSize: 19, color: isThirteen ? withAlpha(colors.alert, 0.9) : colors.textMuted, lineHeight: 1.3}}>{m.site}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Layer>
    </Camera>
  );
};

const SamplesBeat: React.FC<{originAt: number}> = ({originAt}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const origin = springIn(frame, fps, originAt);
  // Schematic giant-impact illustration: a Mars-sized body approaches proto-Earth.
  const approach = tween(frame, originAt, durationInFrames, 0, 1, ease.inOut);
  return (
    <AbsoluteFill>
      <Camera keys={[{frame: 0, scale: 1.08}, {frame: durationInFrames, scale: 1.0}]}>
        <Layer depth={0.5}>
          <div style={{position: 'absolute', left: 1080, top: 160, opacity: 1 - origin * 0.85}}>
            <Moon size={760} lightAngle={200} shadow={0.45} glow={0.2} rotate={frame * 0.02} />
          </div>
        </Layer>
        <Layer depth={1.2}>
          <Particles count={50} seed={55} color={colors.moon} opacity={0.35} drift={0.5} />
        </Layer>
      </Camera>
      {origin > 0 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: origin}}>
          <defs>
            <radialGradient id="proto">
              <stop offset="0%" stopColor="#f09a4a" />
              <stop offset="70%" stopColor="#8a3d1a" />
              <stop offset="100%" stopColor="#2a1208" />
            </radialGradient>
            <radialGradient id="theia">
              <stop offset="0%" stopColor="#b9b2a6" />
              <stop offset="100%" stopColor="#3b3833" />
            </radialGradient>
          </defs>
          <circle cx={1420} cy={560} r={210} fill="url(#proto)" />
          <circle cx={1820 - approach * 260} cy={330 + approach * 110} r={100} fill="url(#theia)" />
          <path d={`M 1880 270 L ${1820 - approach * 260} ${330 + approach * 110}`} stroke={withAlpha(colors.text, 0.3)} strokeDasharray="6 8" />
          <text x={1420} y={830} textAnchor="middle" fill={colors.textMuted} fontFamily="JetBrains Mono, monospace" fontSize={20} letterSpacing="3">
            GIANT-IMPACT HYPOTHESIS · SCHEMATIC
          </text>
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: safe.x, top: 300}}>
        <Eyebrow text="Lunar samples returned · Apollo 11–17" start={10} />
        <div style={{marginTop: 20}}>
          <AnimatedCounter value={legacy.samplesKg} start={14} duration={sec(2.2, fps)} suffix=" kg" style={{fontSize: 170, fontWeight: 700, color: colors.accent}} />
        </div>
        <div style={{fontFamily: fonts.body, fontSize: 34, color: colors.textMuted, maxWidth: 680, lineHeight: 1.35, marginTop: 10}}>
          of rock, core and soil — still being studied today.
        </div>
        <div style={{opacity: origin, marginTop: 50, maxWidth: 680, transform: `translateY(${(1 - origin) * 20}px)`}}>
          <div style={{fontFamily: fonts.display, fontStyle: 'italic', fontWeight: 500, fontSize: 44, color: colors.text, lineHeight: 1.3}}>
            The samples are key evidence for the leading theory of how the Moon formed.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const GapBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const line = tween(frame, 10, durationInFrames - 10, 0, 1, ease.inOut);
  const dot = springIn(frame, fps, 4);
  const qIn = tween(frame, durationInFrames - 50, durationInFrames - 30);
  const x0 = 340;
  const x1 = 1580;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: x0 - 16, top: 524, width: 32, height: 32, borderRadius: 16, background: colors.moon, transform: `scale(${dot})`, boxShadow: `0 0 30px ${withAlpha(colors.moon, 0.6)}`}} />
      <div style={{position: 'absolute', left: x0, top: 539, width: (x1 - x0) * line, height: 2, backgroundImage: `linear-gradient(90deg, ${colors.moon}, ${withAlpha(colors.text, 0.15)})`}} />
      <div style={{position: 'absolute', left: x0 - 200, top: 600, width: 400, textAlign: 'center'}}>
        <div style={{fontFamily: fonts.mono, fontSize: 26, letterSpacing: '0.16em', color: colors.text}}>{legacy.lastSurfaceDate}</div>
        <div style={{fontFamily: fonts.body, fontSize: 22, color: colors.textMuted, marginTop: 8}}>Apollo 17 leaves the Moon</div>
      </div>
      <div style={{position: 'absolute', left: x1 - 60, top: 470, width: 120, textAlign: 'center', fontFamily: fonts.display, fontWeight: 700, fontSize: 120, color: colors.accent, opacity: qIn}}>?</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', fontFamily: fonts.display, fontWeight: 700, fontSize: 64, color: colors.text, opacity: tween(frame, 20, 40)}}>
        {legacy.gapNote} 1972.
      </div>
    </AbsoluteFill>
  );
};
