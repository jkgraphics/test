import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {AnimatedCounter} from '../components/AnimatedCounter';
import {Eyebrow, KineticText} from '../components/KineticText';
import {Beat} from '../components/Fade';
import {Earth, Globe, Moon} from '../components/Celestial';
import {LightLeak} from '../components/Atmosphere';
import {documentaryConfig} from '../config/documentaryConfig';
import {conclusion} from '../config/content';
import {breathe, ease, springIn, tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

/**
 * SCENE 9 — CONCLUSION: WHO GOES NEXT
 * Beat A: the mission's duration, counted up.
 * Beat B: the plaque left on Eagle's descent stage.
 * Beat C: footprints in the regolith (camera dolly).
 * Beat D: Earth and Moon; Artemis; the closing question and title lockup.
 */
export const ConclusionScene: React.FC = () => {
  const {fps} = useVideoConfig();
  const cues = getScene('conclusion').narration;
  const bAt = sec(cues[1].start, fps) - 10;
  const cAt = sec(cues[2].start, fps) - 10;
  const dAt = sec(cues[3].start, fps) - 10;
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Sequence durationInFrames={bAt + 15} name="A · Duration">
        <Beat fadeIn={1} fadeOut={15}>
          <DurationBeat />
        </Beat>
      </Sequence>
      <Sequence from={bAt} durationInFrames={cAt - bAt + 15} name="B · Plaque">
        <Beat fadeIn={15} fadeOut={15}>
          <PlaqueBeat />
        </Beat>
      </Sequence>
      <Sequence from={cAt} durationInFrames={dAt - cAt + 15} name="C · Footprints">
        <Beat fadeIn={15} fadeOut={15}>
          <FootprintsBeat />
        </Beat>
      </Sequence>
      <Sequence from={dAt} name="D · Who goes next">
        <Beat fadeIn={15} fadeOut={1}>
          <FinaleBeat questionAt={sec(cues[4].start, fps) - dAt} />
        </Beat>
      </Sequence>
    </AbsoluteFill>
  );
};

const DurationBeat: React.FC = () => {
  const {fps, durationInFrames} = useVideoConfig();
  const start = sec(1.2, fps);
  const units = [
    {v: 8, l: 'DAYS'},
    {v: 3, l: 'HOURS'},
    {v: 18, l: 'MINUTES'},
  ];
  return (
    <Camera keys={[{frame: 0, scale: 1.0}, {frame: durationInFrames, scale: 1.06}]}>
      <Layer depth={0.2}>
        <Starfield seed={141} count={280} opacity={0.6} />
      </Layer>
      <Layer depth={0.5}>
        <div style={{position: 'absolute', left: 960 - 700, top: 640}}>
          <Moon size={1400} lightAngle={270} shadow={0.25} glow={0.15} />
        </div>
      </Layer>
      <Layer depth={1}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', marginTop: -140}}>
          <Eyebrow text="Apollo 11 · total mission time" start={start - 10} />
          <div style={{display: 'flex', gap: 110, marginTop: 40}}>
            {units.map((u, i) => (
              <div key={u.l} style={{textAlign: 'center'}}>
                <AnimatedCounter value={u.v} start={start + i * 10} duration={36} style={{fontSize: 190, fontWeight: 700, display: 'block'}} />
                <div style={{fontFamily: fonts.mono, fontSize: 24, letterSpacing: '0.3em', color: colors.accent, marginTop: 4}}>{u.l}</div>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Layer>
    </Camera>
  );
};

const PlaqueBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const lines = ['HERE MEN FROM THE PLANET EARTH', 'FIRST SET FOOT UPON THE MOON', 'JULY 1969, A.D.', 'WE CAME IN PEACE FOR ALL MANKIND'];
  const sheen = tween(frame, 20, durationInFrames, -40, 140, ease.linear);
  return (
    <AbsoluteFill style={{background: '#050506'}}>
      <Camera keys={[{frame: 0, scale: 0.94, y: 20}, {frame: durationInFrames, scale: 1.06, y: -10}]}>
        <Layer depth={1}>
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
            <div
              style={{
                position: 'relative',
                width: 1180,
                height: 640,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #9a9893 0%, #d8d5cf 30%, #8b8984 55%, #c9c6bf 80%, #7f7d78 100%)',
                boxShadow: '0 40px 120px rgba(0,0,0,0.8), inset 0 0 0 6px rgba(0,0,0,0.25), inset 0 0 0 9px rgba(255,255,255,0.25)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 36,
              }}
            >
              <div style={{display: 'flex', gap: 30, opacity: 0.8, filter: 'grayscale(1) contrast(1.4) brightness(0.55)'}}>
                <Globe size={170} centerLon={-80} centerLat={0} gridOpacity={0.9} />
                <Globe size={170} centerLon={100} centerLat={0} gridOpacity={0.9} />
              </div>
              <div style={{marginTop: 28}}>
                {lines.map((l, i) => {
                  const a = tween(frame, 18 + i * 16, 36 + i * 16);
                  return (
                    <div
                      key={l}
                      style={{
                        fontFamily: fonts.display,
                        fontWeight: 700,
                        fontSize: 44,
                        letterSpacing: '0.08em',
                        color: '#1b1b1d',
                        textAlign: 'center',
                        lineHeight: 1.45,
                        opacity: a,
                        textShadow: '0 1px 0 rgba(255,255,255,0.45)',
                        marginTop: i === 3 ? 18 : 0,
                      }}
                    >
                      {l}
                    </div>
                  );
                })}
              </div>
              <div style={{display: 'flex', gap: 46, marginTop: 34, opacity: tween(frame, 90, 110)}}>
                {['NEIL A. ARMSTRONG', 'MICHAEL COLLINS', 'EDWIN E. ALDRIN, JR.', 'RICHARD NIXON'].map((n) => (
                  <div key={n} style={{textAlign: 'center'}}>
                    <div style={{width: 200, height: 1, background: 'rgba(0,0,0,0.5)', marginBottom: 6}} />
                    <div style={{fontFamily: fonts.body, fontSize: 14, letterSpacing: '0.1em', color: '#2a2a2c'}}>{n}</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(110deg, transparent ${sheen - 12}%, rgba(255,255,255,0.35) ${sheen}%, transparent ${sheen + 12}%)`,
                  mixBlendMode: 'overlay',
                }}
              />
            </div>
          </AbsoluteFill>
        </Layer>
      </Camera>
      <div style={{position: 'absolute', left: safe.x, top: safe.y}}>
        <Eyebrow text="Plaque on Eagle's descent stage" start={10} />
      </div>
    </AbsoluteFill>
  );
};

const FootprintsBeat: React.FC = () => {
  const {durationInFrames} = useVideoConfig();
  const prints = Array.from({length: 18}, (_, i) => ({x: 200 + i * 105, y: 840 + (i % 2) * 46 - i * 6, rot: -8 + (i % 2) * 6, s: 0.8 + i * 0.03}));
  return (
    <AbsoluteFill>
      <Camera keys={[{frame: 0, x: 220, scale: 1.12}, {frame: durationInFrames, x: -160, scale: 1.02}]}>
        <Layer depth={0.1}>
          <Starfield seed={151} count={80} opacity={0.3} twinkle={false} />
        </Layer>
        <Layer depth={0.3}>
          <div style={{position: 'absolute', left: 1460, top: 120}}>
            <Earth size={200} lightAngle={185} shadow={0.5} spin={0.3} />
          </div>
        </Layer>
        <Layer depth={1}>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <defs>
              <linearGradient id="fp-ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6b6760" />
                <stop offset="100%" stopColor="#151514" />
              </linearGradient>
            </defs>
            <path d="M -600 700 Q 960 670 2600 705 L 2600 1400 L -600 1400 Z" fill="url(#fp-ground)" />
            {prints.map((p, i) => (
              <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.rot}) scale(${p.s})`}>
                <ellipse rx={40} ry={15} fill="#24231f" />
                <ellipse rx={40} ry={15} fill="none" stroke="#8a857b" strokeOpacity={0.35} transform="translate(-2 -3)" />
                {[-26, -13, 0, 13, 26].map((dx) => (
                  <line key={dx} x1={dx} y1={-10} x2={dx} y2={10} stroke="#3e3c37" strokeWidth={3.5} />
                ))}
              </g>
            ))}
          </svg>
        </Layer>
      </Camera>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 40%)'}} />
      <div style={{position: 'absolute', left: safe.x, top: 200, maxWidth: 1000}}>
        <KineticText text="No wind. No rain." start={10} style={{fontSize: 88, fontWeight: 700}} />
        <KineticText text="Nothing to erase them." start={34} style={{fontSize: 88, fontWeight: 500, fontStyle: 'italic', color: colors.textMuted}} />
      </div>
    </AbsoluteFill>
  );
};

const FinaleBeat: React.FC<{questionAt: number}> = ({questionAt}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const qIn = springIn(frame, fps, questionAt);
  const lockAt = questionAt + sec(2.6, fps);
  const lock = tween(frame, lockAt, lockAt + 20);
  const glow = 0.4 + 0.3 * breathe(frame, 90);
  return (
    <AbsoluteFill>
      <Camera keys={[{frame: 0, scale: 1.0, x: 0}, {frame: durationInFrames, scale: 1.12, x: -40}]}>
        <Layer depth={0.15}>
          <Starfield seed={161} count={340} opacity={0.75} />
        </Layer>
        <Layer depth={0.45}>
          <div style={{position: 'absolute', left: 1420, top: 90}}>
            <Earth size={340} lightAngle={190} shadow={0.45} spin={0.4} />
          </div>
        </Layer>
        <Layer depth={0.9}>
          <div style={{position: 'absolute', left: -300, top: 520}}>
            <Moon size={1300} lightAngle={160} shadow={0.3} glow={0.2} />
          </div>
        </Layer>
      </Camera>
      <LightLeak intensity={0.25 * qIn} from={questionAt} />
      <div style={{position: 'absolute', left: safe.x, top: 260, opacity: 1 - tween(frame, questionAt - 12, questionAt + 4)}}>
        <Eyebrow text="NASA · Artemis programme" start={10} color={colors.accent2} />
        <KineticText text="The return." start={18} style={{fontSize: 120, fontWeight: 700, marginTop: 20}} />
      </div>
      {frame >= questionAt - 2 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 210,
              color: colors.text,
              opacity: qIn,
              transform: `translateY(${(1 - qIn) * 40 + 40 - lock * 20}px) scale(${1.06 - qIn * 0.06})`,
              textShadow: `0 0 80px ${withAlpha(colors.accent, glow * qIn)}`,
              filter: `blur(${(1 - qIn) * 12}px)`,
            }}
          >
            {conclusion.finalLine}
          </div>
          <div style={{marginTop: 10, opacity: lock, display: 'flex', alignItems: 'center', gap: 26, transform: `translateY(${20 - lock * 10}px)`}}>
            <div style={{width: 80, height: 1, background: colors.accent}} />
            <div style={{fontFamily: fonts.mono, fontSize: 28, letterSpacing: '0.4em', color: colors.textMuted}}>{documentaryConfig.meta.title.toUpperCase()}</div>
            <div style={{width: 80, height: 1, background: colors.accent}} />
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
