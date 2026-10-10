import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {ChapterTitle} from '../components/ChapterTitle';
import {SATURN_V_SECTIONS, SaturnV} from '../components/Spacecraft';
import {Callout} from '../components/Callout';
import {AnimatedCounter} from '../components/AnimatedCounter';
import {LowerThird} from '../components/LowerThird';
import {CinematicImage} from '../components/CinematicImage';
import {Earth} from '../components/Celestial';
import {BlueprintGrid} from '../components/Atmosphere';
import {Eyebrow} from '../components/KineticText';
import {FadeIn} from '../components/Fade';
import {saturnV} from '../config/content';
import {ease, envelope, springIn, tween} from '../utils/animations';
import {seededArray} from '../utils/random';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

const ROCKET_H = 800;
const ROCKET_TOP = 110;
const ROCKET_X = 560; // centre line
const DIM_X = ROCKET_X - 120; // height dimension line
const LABEL_X = 880;

/**
 * SCENE 4 — CHAPTER TWO: THE MACHINE
 * Beat A (0–14 s): blueprint of the Saturn V draws itself; callouts walk the
 *                  stack from escape tower to first stage; thrust statistic.
 * Beat B (14–19.6 s): launch — ignition, smoke, lift-off, sky fades to space.
 * Beat C (19.6–30 s): orbital diagram — 1.5 Earth orbits then translunar injection.
 */
export const MachineScene: React.FC = () => {
  const {fps} = useVideoConfig();
  const cues = getScene('machine').narration;
  const launchAt = sec(cues[2].start, fps);
  const orbitAt = sec(cues[3].start, fps);
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Sequence durationInFrames={launchAt + 10} name="A · Blueprint">
        <Blueprint />
      </Sequence>
      <Sequence from={launchAt} durationInFrames={orbitAt - launchAt + 15} name="B · Launch">
        <FadeIn frames={10}>
          <CinematicImage asset="launchFootage" zoom={[1.05, 1.15]} fallback={<Launch />} />
        </FadeIn>
        <LowerThird
          title={saturnV.launch.site}
          subtitle={saturnV.launch.place}
          meta={saturnV.launch.local}
          start={6}
          end={orbitAt - launchAt - 12}
          position="right"
        />
      </Sequence>
      <Sequence from={orbitAt} name="C · Orbit">
        <FadeIn frames={15}>
          <OrbitDiagram tliAt={sec(cues[4].start, fps) - orbitAt} />
        </FadeIn>
      </Sequence>
      <ChapterTitle number="CHAPTER TWO" title="The Machine" end={sec(3.4, fps)} backdrop={0.9} />
    </AbsoluteFill>
  );
};

const Blueprint: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cues = getScene('machine').narration;
  const drawAt = sec(3.0, fps);
  const draw = tween(frame, drawAt, drawAt + sec(3, fps), 0, 1, ease.inOut);
  const fill = tween(frame, drawAt + sec(2.4, fps), drawAt + sec(4, fps), 0, 1);
  const calloutsAt = sec(cues[0].start, fps) + 20;
  const thrustAt = sec(cues[1].start, fps);
  const perStage = Math.floor((thrustAt + sec(4, fps) - calloutsAt) / SATURN_V_SECTIONS.length);
  const stageOrder = ['les', 'csm', 'lm', 'ivb', 'ii', 'ic'];
  const activeIdx = Math.min(stageOrder.length - 1, Math.max(-1, Math.floor((frame - calloutsAt) / perStage)));
  const scale = ROCKET_H / 112;
  const sectionY = (id: string) => {
    const s = SATURN_V_SECTIONS.find((x) => x.id === id)!;
    return ROCKET_TOP + ((s.y0 + s.y1) / 2 + 1) * scale;
  };
  const labelYs = [150, 265, 380, 495, 610, 725];

  return (
    <AbsoluteFill>
      <Camera keys={[{frame: 0, scale: 1.08, y: 30}, {frame: sec(14.5, fps), scale: 1.0, y: 0}]}>
        <Layer depth={0.2}>
          <Starfield seed={41} count={160} opacity={0.4} />
        </Layer>
        <Layer depth={0.5}>
          <BlueprintGrid opacity={0.07} />
        </Layer>
        <Layer depth={1}>
          <div style={{position: 'absolute', left: ROCKET_X - (30 * scale) / 2, top: ROCKET_TOP}}>
            <SaturnV height={ROCKET_H} draw={draw} fill={fill} highlight={activeIdx >= 0 && frame < thrustAt + sec(4, fps) ? stageOrder[activeIdx] : null} />
          </div>
          {/* height dimension */}
          <div style={{position: 'absolute', left: DIM_X, top: ROCKET_TOP, height: ROCKET_H * draw, width: 1, background: withAlpha(colors.text, 0.5)}} />
          <div style={{position: 'absolute', left: DIM_X - 12, top: ROCKET_TOP, width: 25, height: 1, background: withAlpha(colors.text, 0.5), opacity: draw}} />
          <div style={{position: 'absolute', left: DIM_X - 12, top: ROCKET_TOP + ROCKET_H - 6, width: 25, height: 1, background: withAlpha(colors.text, 0.5), opacity: draw}} />
          <div
            style={{
              position: 'absolute',
              left: DIM_X - 290,
              top: ROCKET_TOP + ROCKET_H / 2 - 60,
              width: 270,
              textAlign: 'right',
              whiteSpace: 'nowrap',
              opacity: tween(frame, sec(cues[0].start, fps), sec(cues[0].start, fps) + 15),
            }}
          >
            <AnimatedCounter value={saturnV.heightM} decimals={1} suffix=" m" start={sec(cues[0].start, fps)} duration={50} style={{fontSize: 48, fontWeight: 700}} />
            <div style={{fontFamily: fonts.mono, fontSize: 20, color: colors.textMuted, marginTop: 6}}>{saturnV.heightFt} FT</div>
          </div>
          {stageOrder.map((id, i) => {
            const st = saturnV.stages.find((s) => s.id === id)!;
            const isActive = i === activeIdx;
            return (
              <div key={id} style={{opacity: activeIdx >= i ? (isActive ? 1 : 0.55) : 0}}>
                <Callout
                  anchor={{x: ROCKET_X + 40 + (id === 'ic' || id === 'ii' ? 40 : 0), y: sectionY(id)}}
                  label={{x: LABEL_X, y: labelYs[i]}}
                  title={st.label}
                  body={st.detail}
                  start={calloutsAt + i * perStage}
                  color={isActive ? colors.accent : colors.text}
                />
              </div>
            );
          })}
        </Layer>
      </Camera>

      {/* thrust stat */}
      {frame >= thrustAt ? (
        <div
          style={{
            position: 'absolute',
            right: safe.x,
            top: 330,
            width: 420,
            textAlign: 'right',
            opacity: envelope(frame, thrustAt, sec(cues[2].start, fps) + 5, 12, 12),
          }}
        >
          <Eyebrow text="Liftoff thrust" start={thrustAt} style={{justifyContent: 'flex-end'}} />
          <div style={{marginTop: 14}}>
            <AnimatedCounter value={7.5} decimals={1} start={thrustAt + 4} duration={40} suffix="M" style={{fontSize: 120, fontWeight: 700, color: colors.accent}} />
            <span style={{fontFamily: fonts.mono, fontSize: 36, color: colors.textMuted, marginLeft: 16}}>LBF</span>
          </div>
          <div style={{fontFamily: fonts.body, fontSize: 26, color: colors.textMuted}}>{saturnV.engines}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Procedural launch: dawn sky, ignition, smoke, lift-off, sky darkens to space. */
const Launch: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ign = sec(0.4, fps);
  const liftoff = sec(1.6, fps);
  const flame = tween(frame, ign, ign + 20, 0, 1);
  const t = Math.max(0, (frame - liftoff) / fps);
  const rise = t * t * 150;
  const space = tween(frame, liftoff + sec(1, fps), liftoff + sec(4.5, fps), 0, 1, ease.inOut);
  const smoke = seededArray(77, 46, (r) => ({x: (r() - 0.5) * 900, y: r() * 120, r: 60 + r() * 120, speed: 0.6 + r() * 1.6, delay: r() * 30, shade: 150 + Math.floor(r() * 80)}));
  const sceneScale = 1 + space * 0.08;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${mix('#1d3b66', '#020306', space)} 0%, ${mix('#4d6f97', '#05070b', space)} 55%, ${mix('#e3a46a', '#090b10', space)} 100%)`,
        }}
      />
      <AbsoluteFill style={{opacity: space}}>
        <Starfield seed={51} count={260} />
      </AbsoluteFill>
      <AbsoluteFill style={{transform: `translateY(${space * 600}px) scale(${sceneScale})`}}>
        {/* pad & horizon */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 930, bottom: -400, background: 'linear-gradient(180deg, #2c2a28, #0b0b0c)'}} />
        <div style={{position: 'absolute', left: 1150, top: 380, width: 30, height: 560, background: 'linear-gradient(90deg, #6b2a1a, #a7472c, #5a2214)', opacity: 0.9}} />
        <div style={{position: 'absolute', left: 1130, top: 380, width: 70, height: 6, background: '#5a2214'}} />
        {/* rocket */}
        <div style={{position: 'absolute', left: 960 - 105, top: 100 - rise}}>
          <SaturnV height={840} flame={flame} />
        </div>
        {/* smoke */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <defs>
            <filter id="smoke-blur">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          <g filter="url(#smoke-blur)">
            {smoke.map((s, i) => {
              const k = Math.max(0, frame - ign - s.delay);
              const grow = Math.min(1, k / 40);
              return (
                <circle
                  key={i}
                  cx={960 + s.x * (0.3 + grow * 0.9) + Math.sign(s.x) * k * s.speed}
                  cy={950 - s.y - k * 0.3}
                  r={s.r * grow}
                  fill={`rgb(${s.shade},${s.shade - 6},${s.shade - 14})`}
                  opacity={0.85 * grow}
                />
              );
            })}
          </g>
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 50% 40% at 50% 85%, ${withAlpha('#ffb15e', 0.35 * flame * (1 - space))} 0%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
      <div style={{position: 'absolute', left: safe.x, top: safe.y, fontFamily: fonts.mono, fontSize: 24, letterSpacing: '0.2em', color: colors.text, opacity: tween(frame, 0, 12)}}>
        T{frame < liftoff ? '−' : '+'} {formatClock(Math.abs(frame - liftoff) / fps)}
      </div>
    </AbsoluteFill>
  );
};

const OrbitDiagram: React.FC<{tliAt: number}> = ({tliAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inA = tween(frame, 0, 20, 0, 1);
  const cx = 760;
  const cy = 560;
  const rx = 330;
  const ry = 300;
  // 1.5 orbits before TLI, then a departure spiral toward the upper right.
  const orbitT = tween(frame, 10, tliAt + 10, 0, 1.5, ease.inOut);
  const depart = tween(frame, tliAt + 10, tliAt + sec(4, fps), 0, 1, ease.in);
  const endAng = -Math.PI / 2 + 1.5 * Math.PI * 2;
  const spiral = (d: number) => {
    const a = endAng + d * Math.PI * 0.9;
    const k = 1 + d * d * 4;
    return {x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k};
  };
  const ang = -Math.PI / 2 + orbitT * Math.PI * 2;
  const pos = depart > 0 ? spiral(depart) : {x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry};
  const {x, y} = pos;
  const trail = Array.from({length: 120}, (_, i) => {
    const tt = (orbitT * i) / 119;
    const a = -Math.PI / 2 + tt * Math.PI * 2;
    return `${i === 0 ? 'M' : 'L'} ${cx + Math.cos(a) * rx} ${cy + Math.sin(a) * ry}`;
  }).join(' ');
  const departPath = Array.from({length: 40}, (_, i) => {
    const p = spiral((depart * i) / 39);
    return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
  }).join(' ');
  const tliIn = springIn(frame, fps, tliAt);
  return (
    <AbsoluteFill style={{opacity: inA}}>
      <Starfield seed={61} count={260} opacity={0.6} />
      <div style={{position: 'absolute', left: cx - 260, top: cy - 260}}>
        <Earth size={520} lightAngle={190} shadow={0.4} spin={0.5} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={withAlpha(colors.text, 0.15)} strokeDasharray="4 10" />
        <path d={trail} fill="none" stroke={colors.accent2} strokeWidth={3} />
        {depart > 0 ? <path d={departPath} stroke={colors.accent} strokeWidth={3} fill="none" /> : null}
        <circle cx={x} cy={y} r={9} fill={colors.accent} />
        <circle cx={x} cy={y} r={22} fill="none" stroke={colors.accent} strokeOpacity={0.5} />
      </svg>
      <div style={{position: 'absolute', right: safe.x, top: 300, textAlign: 'right', width: 640}}>
        <Eyebrow text="Earth parking orbit" start={8} style={{justifyContent: 'flex-end'}} color={colors.accent2} />
        <div style={{fontFamily: fonts.mono, fontSize: 54, color: colors.text, marginTop: 18}}>T+ 00:11:42</div>
        <div style={{fontFamily: fonts.body, fontSize: 26, color: colors.textMuted, marginTop: 8}}>Orbit insertion, about 12 minutes after launch</div>
        <div style={{opacity: tliIn, transform: `translateY(${(1 - tliIn) * 20}px)`, marginTop: 70}}>
          <Eyebrow text="Translunar injection" start={tliAt} style={{justifyContent: 'flex-end'}} />
          <div style={{fontFamily: fonts.mono, fontSize: 54, color: colors.accent, marginTop: 18}}>T+ 02:44:16</div>
          <div style={{fontFamily: fonts.body, fontSize: 26, color: colors.textMuted, marginTop: 8}}>S-IVB re-ignites · next stop, the Moon</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const formatClock = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `00:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
};

