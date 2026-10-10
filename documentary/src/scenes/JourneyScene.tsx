import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {Earth, Globe, Moon, projectOrthographic} from '../components/Celestial';
import {AnimatedCounter} from '../components/AnimatedCounter';
import {Eyebrow} from '../components/KineticText';
import {Beat} from '../components/Fade';
import {geo, journey} from '../config/content';
import {ease, springIn, tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

/**
 * SCENE 5 — THE JOURNEY (map + trajectory)
 * Beat A: schematic orthographic globe rotates to Florida; the launch site is
 *         marked and an arc leaves Earth. Distance counter.
 * Beat B: schematic Earth–Moon trajectory: outbound coast, lunar orbit, Eagle
 *         separating to land, Columbia alone behind the Moon, return path.
 */
export const JourneyScene: React.FC = () => {
  const {fps} = useVideoConfig();
  const cues = getScene('journey').narration;
  const bAt = sec(cues[1].start, fps) - 15;
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Sequence durationInFrames={bAt + 15} name="A · Globe">
        <Beat fadeIn={1} fadeOut={15}>
          <GlobeBeat />
        </Beat>
      </Sequence>
      <Sequence from={bAt} name="B · Trajectory">
        <Beat fadeIn={15} fadeOut={1}>
          <TrajectoryBeat
            outboundAt={15}
            descentAt={sec(cues[2].start, fps) - bAt}
            collinsAt={sec(cues[3].start, fps) - bAt}
          />
        </Beat>
      </Sequence>
    </AbsoluteFill>
  );
};

const GLOBE = 780;

const GlobeBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const lon = tween(frame, 0, sec(6, fps), -135, -86, ease.camera);
  const lat = 18;
  const markerIn = springIn(frame, fps, sec(1.8, fps));
  const p = projectOrthographic(GLOBE, lat, lon, geo.ksc.lat, geo.ksc.lon);
  const gx = 560;
  const gy = 560;
  const mx = gx + p.x;
  const my = gy + p.y;
  const arc = tween(frame, sec(4, fps), sec(7.5, fps), 0, 1, ease.inOut);
  return (
    <AbsoluteFill>
      <Camera keys={[{frame: 0, scale: 1.12, x: 60}, {frame: durationInFrames, scale: 1.0, x: 0}]}>
        <Layer depth={0.2}>
          <Starfield seed={71} count={260} opacity={0.6} />
        </Layer>
        <Layer depth={1}>
          <div style={{position: 'absolute', left: gx - GLOBE / 2, top: gy - GLOBE / 2}}>
            <Globe size={GLOBE} centerLon={lon} centerLat={lat} markers={[{lat: geo.ksc.lat, lon: geo.ksc.lon, progress: markerIn}]} />
          </div>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <path
              d={`M ${mx} ${my} Q ${mx + 380} ${my - 520} ${mx + 1100} ${my - 470}`}
              pathLength={1}
              fill="none"
              stroke={colors.accent}
              strokeWidth={3}
              strokeDasharray="1"
              strokeDashoffset={1 - arc}
            />
          </svg>
          <div style={{position: 'absolute', left: mx + 46, top: my + 18, opacity: markerIn}}>
            <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 30, color: colors.text}}>{geo.ksc.label}</div>
            <div style={{fontFamily: fonts.mono, fontSize: 20, color: colors.accent, marginTop: 4}}>{geo.ksc.coords}</div>
          </div>
        </Layer>
      </Camera>
      <div style={{position: 'absolute', right: safe.x, top: 300, width: 640, textAlign: 'right'}}>
        <Eyebrow text="Average Earth–Moon distance" start={sec(1.2, fps)} style={{justifyContent: 'flex-end'}} color={colors.accent2} />
        <div style={{marginTop: 16}}>
          <AnimatedCounter value={journey.earthMoonKm} start={sec(1.4, fps)} duration={sec(3.5, fps)} style={{fontSize: 108, fontWeight: 700}} />
          <span style={{fontFamily: fonts.mono, fontSize: 40, color: colors.textMuted, marginLeft: 12}}>KM</span>
        </div>
        <div style={{opacity: tween(frame, sec(5, fps), sec(5.8, fps)), marginTop: 60}}>
          <Eyebrow text="Launch to lunar orbit" start={sec(5, fps)} style={{justifyContent: 'flex-end'}} />
          <div style={{fontFamily: fonts.display, fontWeight: 700, fontSize: 96, color: colors.text, marginTop: 10}}>≈ 3 days</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Trajectory geometry (schematic, not to scale)
const E = {x: 330, y: 580};
const M = {x: 1480, y: 520};
const ORBIT_R = 190;

type Pt = {x: number; y: number};
const bezier = (p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
};
const outbound = (t: number) => bezier({x: E.x + 60, y: E.y - 70}, {x: 700, y: 180}, {x: 1200, y: 200}, {x: M.x, y: M.y - ORBIT_R}, t);
const inbound = (t: number) => bezier({x: M.x, y: M.y + ORBIT_R}, {x: 1200, y: 860}, {x: 700, y: 900}, {x: E.x + 60, y: E.y + 80}, t);
/** turns = number of revolutions from the top of the lunar orbit, clockwise on screen. */
const orbitPt = (turns: number): Pt => {
  const a = -Math.PI / 2 + turns * Math.PI * 2;
  return {x: M.x + Math.cos(a) * ORBIT_R, y: M.y + Math.sin(a) * ORBIT_R};
};
const poly = (fn: (t: number) => Pt, upto: number, n = 80) =>
  Array.from({length: n}, (_, i) => {
    const q = fn((upto * i) / (n - 1));
    return `${i === 0 ? 'M' : 'L'} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }).join(' ');

const TrajectoryBeat: React.FC<{outboundAt: number; descentAt: number; collinsAt: number}> = ({outboundAt, descentAt, collinsAt}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const out = tween(frame, outboundAt, descentAt - 10, 0, 1, ease.inOut);
  const turns = tween(frame, descentAt - 10, durationInFrames, 0, 2.4, ease.linear);
  const sep = tween(frame, descentAt + sec(1.6, fps), descentAt + sec(4, fps), 0, 1, ease.inOut);
  const ret = tween(frame, collinsAt + sec(2.4, fps), collinsAt + sec(4.6, fps), 0, 1, ease.inOut);
  const csm = out < 1 ? outbound(out) : orbitPt(turns);
  // Eagle: leaves orbit at the separation point and lands on the near side (facing Earth).
  const sepPt = orbitPt(tween(descentAt + sec(1.6, fps), descentAt - 10, durationInFrames, 0, 2.4, ease.linear));
  const landPt = {x: M.x - 118, y: M.y + 10};
  const eagle = {x: sepPt.x + (landPt.x - sepPt.x) * sep, y: sepPt.y + (landPt.y - sepPt.y) * sep};
  const behind = csm.x > M.x + 40 && out >= 1;
  const loiIn = springIn(frame, fps, descentAt - 25);
  const landIn = springIn(frame, fps, descentAt + sec(4, fps));
  const collinsIn = springIn(frame, fps, collinsAt);
  const splashIn = springIn(frame, fps, collinsAt + sec(4, fps));

  return (
    <AbsoluteFill>
      <Camera keys={[{frame: 0, scale: 1.0}, {frame: descentAt, scale: 1.05, x: -60}, {frame: durationInFrames, scale: 1.06, x: -60, y: 10}]}>
        <Layer depth={0.15}>
          <Starfield seed={81} count={300} opacity={0.6} />
        </Layer>
        <Layer depth={1}>
          <div style={{position: 'absolute', left: E.x - 110, top: E.y - 110}}>
            <Earth size={220} lightAngle={180} shadow={0.45} spin={0.6} />
          </div>
          <div style={{position: 'absolute', left: M.x - 120, top: M.y - 120}}>
            <Moon size={240} lightAngle={180} shadow={0.35} glow={0.1} />
          </div>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            {/* far side: no radio contact */}
            <path
              d={`M ${M.x + 20} ${M.y - ORBIT_R - 40} A ${ORBIT_R + 40} ${ORBIT_R + 40} 0 0 1 ${M.x + 20} ${M.y + ORBIT_R + 40}`}
              fill="none"
              stroke={withAlpha(colors.alert, 0.35)}
              strokeWidth={22}
              opacity={tween(frame, collinsAt, collinsAt + 20)}
            />
            <circle cx={M.x} cy={M.y} r={ORBIT_R} fill="none" stroke={withAlpha(colors.text, 0.18)} strokeDasharray="4 10" opacity={out} />
            <path d={poly(outbound, out)} fill="none" stroke={colors.accent2} strokeWidth={3} />
            {out >= 1 ? <path d={poly(orbitPt, Math.min(turns, 1), 120)} fill="none" stroke={colors.accent2} strokeWidth={3} opacity={0.8} /> : null}
            {ret > 0 ? <path d={poly(inbound, ret)} fill="none" stroke={withAlpha(colors.accent2, 0.7)} strokeWidth={3} strokeDasharray="10 10" /> : null}
            {sep > 0 ? (
              <g>
                <line x1={sepPt.x} y1={sepPt.y} x2={eagle.x} y2={eagle.y} stroke={colors.accent} strokeWidth={2} strokeDasharray="4 6" />
                <circle cx={eagle.x} cy={eagle.y} r={9} fill={colors.accent} />
              </g>
            ) : null}
            <circle cx={csm.x} cy={csm.y} r={10} fill={behind ? withAlpha(colors.accent2, 0.35) : colors.accent2} />
            <circle cx={csm.x} cy={csm.y} r={24} fill="none" stroke={colors.accent2} strokeOpacity={behind ? 0.15 : 0.5} />
          </svg>
          {/* labels */}
          <Label x={E.x - 140} y={E.y - 240} title={journey.milestones[0].label} sub={journey.milestones[0].when} a={tween(frame, outboundAt, outboundAt + 15)} />
          <Label x={M.x - 700} y={M.y - ORBIT_R + 20} title={journey.milestones[1].label} sub={journey.milestones[1].when} a={loiIn} />
          <Label x={M.x - 470} y={M.y + 40} title={journey.milestones[2].label} sub={journey.milestones[2].when} a={landIn} color={colors.accent} align="right" w={300} />
          <Label x={M.x - 170} y={M.y + ORBIT_R + 40} title="Columbia · Michael Collins" sub="Alone in lunar orbit" a={collinsIn} color={colors.accent2} />
          <Label x={E.x - 140} y={E.y + 140} title={journey.milestones[3].label} sub={journey.milestones[3].when} a={splashIn} />
          {behind && frame > collinsAt ? (
            <div style={{position: 'absolute', left: M.x + 40, top: M.y - ORBIT_R - 100, fontFamily: fonts.mono, fontSize: 22, letterSpacing: '0.2em', color: colors.alert, opacity: frame % 30 < 20 ? 1 : 0.3}}>
              ● NO SIGNAL
            </div>
          ) : null}
        </Layer>
      </Camera>
      <div style={{position: 'absolute', left: safe.x, top: safe.y}}>
        <Eyebrow text="Trajectory · schematic, not to scale" start={outboundAt} color={colors.accent2} />
      </div>
    </AbsoluteFill>
  );
};

const Label: React.FC<{x: number; y: number; title: string; sub: string; a: number; color?: string; align?: 'left' | 'right'; w?: number}> = ({
  x,
  y,
  title,
  sub,
  a,
  color = colors.text,
  align = 'left',
  w = 420,
}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, textAlign: align, opacity: a, transform: `translateY(${(1 - a) * 14}px)`}}>
    <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 28, color}}>{title}</div>
    <div style={{fontFamily: fonts.mono, fontSize: 19, color: colors.textMuted, marginTop: 4, letterSpacing: '0.08em'}}>{sub}</div>
  </div>
);
