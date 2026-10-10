import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {ChapterTitle} from '../components/ChapterTitle';
import {LineChart} from '../components/DataChart';
import {LunarModule} from '../components/Spacecraft';
import {Earth} from '../components/Celestial';
import {CinematicImage} from '../components/CinematicImage';
import {QuoteCard} from '../components/QuoteCard';
import {LowerThird} from '../components/LowerThird';
import {Eyebrow} from '../components/KineticText';
import {Hud} from '../components/Hud';
import {Beat} from '../components/Fade';
import {BlueprintGrid, Particles} from '../components/Atmosphere';
import {descent, geo} from '../config/content';
import {ease, envelope, springPop, tween} from '../utils/animations';
import {seededArray} from '../utils/random';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

/**
 * SCENE 6 — CHAPTER THREE: THE DESCENT (turning point)
 * Beat A (0–21 s): instrument view. Altitude unwinds, the descent profile
 *   draws, program alarms 1202/1201 flash red, Houston's GO is stamped.
 * Beat B (21–33 s): surface view. Eagle overflies a boulder field, then lands.
 * Beat C (33–40 s): first step — the quote, in near silence.
 */
export const DescentScene: React.FC = () => {
  const {fps} = useVideoConfig();
  const cues = getScene('descent').narration;
  const bAt = sec(cues[3].start, fps) - 10;
  const cAt = sec(cues[5].start, fps) - 10;
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Sequence durationInFrames={bAt + 15} name="A · Instruments">
        <Beat fadeIn={1} fadeOut={15}>
          <Instruments />
        </Beat>
      </Sequence>
      <Sequence from={bAt} durationInFrames={cAt - bAt + 15} name="B · Surface">
        <Beat fadeIn={15} fadeOut={15}>
          <CinematicImage asset="landingSurface" grade="bw" fallback={<Surface landAt={sec(cues[4].start, fps) - bAt} />} />
          <LandingText at={sec(cues[4].start, fps) - bAt + 20} />
        </Beat>
      </Sequence>
      <Sequence from={cAt} name="C · First step">
        <Beat fadeIn={15} fadeOut={1}>
          <FirstStep />
        </Beat>
      </Sequence>
      <ChapterTitle number="CHAPTER THREE" title="The Descent" end={sec(3.4, fps)} backdrop={0.9} />
    </AbsoluteFill>
  );
};

// Schematic descent profile: altitude (ft) vs. normalised time.
const PROFILE = [
  {x: 0, y: 50000},
  {x: 0.15, y: 44000},
  {x: 0.3, y: 35000},
  {x: 0.45, y: 24000},
  {x: 0.6, y: 13000},
  {x: 0.72, y: 7000},
  {x: 0.82, y: 2500},
  {x: 0.9, y: 700},
  {x: 0.96, y: 150},
  {x: 1, y: 0},
];

const altitudeAt = (t: number) => {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (t <= b.x) return a.y + ((t - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return 0;
};

const Instruments: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const cues = getScene('descent').narration;
  const startAt = sec(cues[0].start, fps);
  const alarmA = sec(cues[1].start, fps) + 6;
  const alarmB = sec(12.4, fps);
  const decideAt = sec(cues[2].start, fps);
  const goAt = sec(18.6, fps);
  // Instrument beat covers the profile from PDI down to ~0.6 (13,000 ft-ish).
  const t = tween(frame, startAt, durationInFrames, 0, 0.62, ease.linear);
  const alt = altitudeAt(t);
  const metStart = 102 * 3600 + 33 * 60 + 5; // PDI, GET 102:33:05
  const metEnd = 102 * 3600 + 45 * 60 + 40; // touchdown, GET 102:45:40
  const met = metStart + (metEnd - metStart) * t;
  const alarmOn = frame >= alarmA && frame < goAt;
  const blink = alarmOn && frame % 20 < 12;
  const code = frame >= alarmB ? descent.alarms[1] : descent.alarms[0];
  const go = springPop(frame, fps, goAt);
  const alarmWash = envelope(frame, alarmA, goAt + 6, 4, 10) * (blink ? 1 : 0.4);
  const chartW = 900;
  const chartH = 460;
  const chartX = 860;
  const chartY = 300;

  return (
    <AbsoluteFill>
      <Camera keys={[{frame: 0, scale: 1.06}, {frame: alarmA, scale: 1.0}, {frame: goAt, scale: 1.05, x: -20}, {frame: durationInFrames, scale: 1.0}]}>
        <Layer depth={0.3}>
          <BlueprintGrid opacity={0.06} size={60} />
        </Layer>
        <Layer depth={1}>
          {/* altitude */}
          <div style={{position: 'absolute', left: safe.x, top: 300}}>
            <Eyebrow text="Altitude" start={startAt} />
            <div style={{fontFamily: fonts.mono, fontWeight: 700, fontSize: 132, color: colors.text, marginTop: 18, fontVariantNumeric: 'tabular-nums'}}>
              {Math.round(alt).toLocaleString('en-US')}
              <span style={{fontSize: 44, color: colors.textMuted, marginLeft: 14}}>FT</span>
            </div>
            <div style={{marginTop: 50}}>
              <Eyebrow text="Mission elapsed time" start={startAt + 8} color={colors.accent2} />
              <div style={{fontFamily: fonts.mono, fontSize: 64, color: colors.text, marginTop: 14, fontVariantNumeric: 'tabular-nums'}}>{formatMet(met)}</div>
              <div style={{fontFamily: fonts.mono, fontSize: 17, color: colors.textMuted, marginTop: 8, letterSpacing: '0.15em'}}>TIME-COMPRESSED · PDI 102:33:05 → TOUCHDOWN 102:45:40</div>
            </div>
          </div>
          {/* profile */}
          <div style={{position: 'absolute', left: chartX, top: chartY}}>
            <div style={{position: 'absolute', left: 0, top: -90, fontFamily: fonts.mono, fontSize: 18, letterSpacing: '0.18em', color: colors.textMuted}}>
              POWERED DESCENT · SCHEMATIC PROFILE
            </div>
            <div style={{position: 'absolute', left: 0, top: chartH, width: chartW, height: 1, background: withAlpha(colors.text, 0.4)}} />
            <div style={{position: 'absolute', left: 0, top: 0, width: 1, height: chartH, background: withAlpha(colors.text, 0.4)}} />
            <LineChart points={PROFILE} width={chartW} height={chartH} start={startAt} duration={durationInFrames - startAt} domain={{x: [0, 1], y: [0, 52000]}} color={colors.accent2} progress={t} />
            <div
              style={{
                position: 'absolute',
                left: t * chartW - 40,
                top: chartH - (alt / 52000) * chartH - 70,
              }}
            >
              <LunarModule size={80} thrust={0.6} />
            </div>
          </div>
        </Layer>
      </Camera>

      {/* alarm */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,0,0) 35%, ${withAlpha(colors.alert, 0.4)} 100%)`, opacity: alarmWash}} />
      {frame >= alarmA ? (
        <div
          style={{
            position: 'absolute',
            left: chartX + 470,
            top: 290,
            padding: '18px 30px',
            border: `3px solid ${colors.alert}`,
            background: blink ? withAlpha(colors.alert, 0.25) : 'rgba(10,6,6,0.75)',
            fontFamily: fonts.mono,
            color: colors.alert,
            opacity: frame < goAt + 20 ? 1 : tween(frame, goAt + 20, goAt + 40, 1, 0),
          }}
        >
          <div style={{fontSize: 22, letterSpacing: '0.3em'}}>PROGRAM ALARM</div>
          <div style={{fontSize: 84, fontWeight: 700, letterSpacing: '0.1em'}}>{code}</div>
        </div>
      ) : null}
      {frame >= decideAt && frame < goAt ? (
        <div style={{position: 'absolute', left: chartX + 470, top: 470, fontFamily: fonts.body, fontSize: 30, color: colors.text, opacity: tween(frame, decideAt, decideAt + 12)}}>
          Houston: abort or continue?
        </div>
      ) : null}
      {frame >= goAt ? (
        <div
          style={{
            position: 'absolute',
            left: chartX + 520,
            top: 450,
            padding: '6px 34px',
            border: `4px solid ${colors.accent}`,
            fontFamily: fonts.mono,
            fontWeight: 700,
            fontSize: 96,
            color: colors.accent,
            transform: `scale(${2 - go}) rotate(-4deg)`,
            opacity: Math.min(1, go * 1.5),
            letterSpacing: '0.12em',
          }}
        >
          GO
        </div>
      ) : null}
      <Hud start={startAt} topRight="EAGLE · LM-5" topLeft="APOLLO 11 · POWERED DESCENT" />
    </AbsoluteFill>
  );
};

const Surface: React.FC<{landAt: number}> = ({landAt}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  // Eagle flies left→right over the crater, then settles at x=1300.
  const fly = tween(frame, 0, landAt, 0, 1, ease.out);
  const lmX = 300 + fly * 1000;
  const lmY = 380 + fly * 370;
  const touchdown = frame >= landAt;
  const dust = tween(frame, landAt - 40, landAt + 20, 0, 1) * (1 - tween(frame, landAt + 20, landAt + 90, 0, 1));
  const boulders = seededArray(91, 46, (r) => ({x: 520 + r() * 520, y: 860 + r() * 120, w: 8 + r() * 26, h: 6 + r() * 16}));
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #000 0%, #040507 60%, #0b0b0c 100%)'}}>
      <Camera keys={[{frame: 0, scale: 1.1, x: 120}, {frame: landAt, scale: 1.0, x: -60}, {frame: durationInFrames, scale: 1.06, x: -80}]}>
        <Layer depth={0.1}>
          <Starfield seed={101} count={120} opacity={0.35} twinkle={false} />
        </Layer>
        <Layer depth={0.3}>
          <div style={{position: 'absolute', left: 1500, top: 110}}>
            <Earth size={170} lightAngle={180} shadow={0.5} spin={0.3} />
          </div>
        </Layer>
        <Layer depth={0.7}>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <defs>
              <linearGradient id="regolith" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7b776f" />
                <stop offset="100%" stopColor="#2f2d2a" />
              </linearGradient>
            </defs>
            <path d="M -400 760 Q 400 720 960 745 T 2400 735 L 2400 1300 L -400 1300 Z" fill="url(#regolith)" />
            {/* the boulder-filled crater Armstrong avoided */}
            <ellipse cx={780} cy={890} rx={300} ry={60} fill="#3b3934" />
            <ellipse cx={780} cy={884} rx={300} ry={52} fill="none" stroke="#a6a197" strokeOpacity={0.4} strokeWidth={3} />
            {boulders.map((b, i) => (
              <g key={i}>
                <ellipse cx={b.x + 4} cy={b.y - 26} rx={b.w} ry={b.h * 0.6} fill="#141312" opacity={0.6} />
                <ellipse cx={b.x} cy={b.y - 30} rx={b.w} ry={b.h} fill="#6b665d" />
              </g>
            ))}
          </svg>
          <div style={{position: 'absolute', left: lmX - 120, top: (touchdown ? 750 : lmY) - 170}}>
            <LunarModule size={240} thrust={touchdown ? 0 : 0.7} />
          </div>
        </Layer>
        <Layer depth={0.9}>
          <AbsoluteFill style={{opacity: dust}}>
            <Particles count={80} seed={33} color="#c9c4ba" opacity={0.6} drift={-2} />
          </AbsoluteFill>
        </Layer>
      </Camera>
      {frame < landAt ? (
        <div style={{position: 'absolute', left: safe.x, top: safe.y}}>
          <Eyebrow text="P66 · semi-manual control" start={10} />
          <div style={{fontFamily: fonts.body, fontSize: 30, color: colors.textMuted, marginTop: 14, opacity: tween(frame, 20, 34)}}>Boulder field ahead — Armstrong flies past it</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const LandingText: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  if (frame < at - 1) return null;
  const a = tween(frame, at, at + 15);
  return (
    <>
      <AbsoluteFill style={{background: `rgba(0,0,0,${a * 0.45})`}} />
      <div style={{position: 'absolute', left: safe.x, top: 220}}>
        <div style={{fontFamily: fonts.mono, fontSize: 30, letterSpacing: '0.2em', color: colors.accent, opacity: a}}>
          {descent.landingDate} · {descent.landingUtc}
        </div>
        <div style={{marginTop: 70}}>
          <QuoteCard text={descent.landingQuote} attribution="Neil Armstrong" context="Transmission to Mission Control" start={at + 10} end={durationInFrames} fontSize={66} maxWidth={1150} highlight={['landed']} />
        </div>
      </div>
      <LowerThird title={geo.tranquility.label} subtitle="Sea of Tranquility" meta={geo.tranquility.coords} start={at + 40} end={durationInFrames} position="right" />
    </>
  );
};

const FirstStep: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <AbsoluteFill>
      <CinematicImage
        asset="firstStep"
        grade="neutral"
        fallback={
          <Camera keys={[{frame: 0, scale: 1.0}, {frame: durationInFrames, scale: 1.08, y: -20}]}>
            <Layer depth={0.2}>
              <Starfield seed={111} count={90} opacity={0.3} twinkle={false} />
            </Layer>
            <Layer depth={0.4}>
              <div style={{position: 'absolute', left: 1360, top: 140}}>
                <Earth size={260} lightAngle={185} shadow={0.5} spin={0.3} />
              </div>
            </Layer>
            <Layer depth={1}>
              <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
                <defs>
                  <linearGradient id="fs-ground" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5d5a54" />
                    <stop offset="100%" stopColor="#141413" />
                  </linearGradient>
                </defs>
                <path d="M -200 820 Q 960 790 2200 830 L 2200 1300 L -200 1300 Z" fill="url(#fs-ground)" />
                {/* boot prints */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <g key={i} transform={`translate(${1120 + i * 120} ${880 + (i % 2) * 40}) rotate(-12)`} opacity={tween(frame, 20 + i * 12, 40 + i * 12, 0, 0.8)}>
                    <ellipse rx={36} ry={14} fill="#262522" />
                    {[-24, -12, 0, 12, 24].map((dx) => (
                      <line key={dx} x1={dx} y1={-10} x2={dx} y2={10} stroke="#3c3a36" strokeWidth={3} />
                    ))}
                  </g>
                ))}
              </svg>
            </Layer>
          </Camera>
        }
      />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 70%)'}} />
      <div style={{position: 'absolute', left: safe.x, top: 230}}>
        <div style={{fontFamily: fonts.mono, fontSize: 30, letterSpacing: '0.2em', color: colors.accent, opacity: tween(frame, 6, 20)}}>{descent.firstStepUtc}</div>
        <div style={{marginTop: 70}}>
          <QuoteCard text={descent.firstStepQuote} attribution="Neil Armstrong" context={descent.quoteNote} start={14} end={durationInFrames + 30} fontSize={70} maxWidth={1100} highlight={['giant', 'leap']} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const formatMet = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};
