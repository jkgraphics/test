import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {Moon} from '../components/Celestial';
import {CinematicImage} from '../components/CinematicImage';
import {KineticText} from '../components/KineticText';
import {LightLeak, Particles} from '../components/Atmosphere';
import {documentaryConfig} from '../config/documentaryConfig';
import {opening} from '../config/content';
import {breathe, ease, envelope, springIn, tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

/**
 * SCENE 1 — COLD OPEN (hook + title)
 * 0–18 s: darkness → stars → the Moon slowly fills frame while four short
 *         kinetic lines set up the tension of the landing.
 * 18–24 s: title reveal.
 * Camera: continuous slow push-in with parallax between star layers and Moon.
 */
export const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cues = getScene('opening').narration;
  const titleAt = sec(18.2, fps);

  const fadeFromBlack = tween(frame, 0, sec(3, fps), 0, 1, ease.inOut);
  const moonIn = tween(frame, sec(1, fps), sec(6, fps), 0, 1, ease.inOut);
  const alarmStart = sec(cues[2].start, fps);
  const alarmEnd = sec(cues[2].end, fps);
  const alarm = envelope(frame, alarmStart, alarmEnd, 6, 20) * (frame % 24 < 12 ? 1 : 0.35);
  const titleDim = tween(frame, titleAt - 15, titleAt + 20, 0, 0.55);

  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Camera
        keys={[
          {frame: 0, scale: 1, x: 0, y: 0},
          {frame: titleAt, scale: 1.22, x: -90, y: 20},
          {frame: sec(24, fps), scale: 1.3, x: -110, y: 24},
        ]}
      >
        <AbsoluteFill style={{opacity: fadeFromBlack}}>
          <Layer depth={0.15}>
            <Starfield seed={3} count={380} opacity={0.8} />
          </Layer>
          <Layer depth={0.4}>
            <Starfield seed={9} count={90} maxSize={3} opacity={0.9} />
          </Layer>
          <Layer depth={1}>
            <CinematicImage
              asset="openingMoon"
              zoom={[1, 1.1]}
              fallback={
                <div
                  style={{
                    position: 'absolute',
                    left: 1500 - 650,
                    top: 560 - 650,
                    opacity: moonIn,
                    transform: `translateY(${(1 - moonIn) * 80}px)`,
                  }}
                >
                  <Moon size={1300} lightAngle={195} shadow={0.5} rotate={frame * 0.01} glow={0.18} />
                </div>
              }
            />
          </Layer>
          <Layer depth={1.4}>
            <Particles count={40} opacity={0.25} drift={0.4} />
          </Layer>
        </AbsoluteFill>
      </Camera>

      {/* alarm wash — red is reserved for danger */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,0,0) 40%, ${withAlpha(colors.alert, 0.45)} 100%)`,
          opacity: alarm,
          mixBlendMode: 'screen',
        }}
      />

      {/* narration as kinetic typography */}
      <AbsoluteFill style={{justifyContent: 'center', paddingLeft: safe.x, paddingRight: 760}}>
        {frame < sec(cues[0].end + 0.5, fps) ? (
          <KineticText
            text={opening.date}
            mode="chars"
            start={sec(cues[0].start, fps)}
            exitAt={sec(cues[0].end, fps)}
            stagger={1.4}
            style={{fontFamily: fonts.mono, fontSize: 92, letterSpacing: '0.12em', color: colors.text}}
          />
        ) : null}
        {frame >= sec(cues[1].start, fps) - 2 && frame < sec(cues[1].end + 0.5, fps) ? (
          <KineticText
            text={cues[1].text}
            start={sec(cues[1].start, fps)}
            exitAt={sec(cues[1].end, fps)}
            highlight={['moon']}
            style={{fontSize: 104, fontWeight: 700, lineHeight: 1.08}}
          />
        ) : null}
        {frame >= alarmStart - 2 && frame < alarmEnd + 15 ? (
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 26,
                letterSpacing: '0.3em',
                color: colors.alert,
                marginBottom: 22,
                opacity: alarm > 0 ? 0.6 + alarm * 0.4 : 0,
              }}
            >
              ● PROGRAM ALARM
            </div>
            <KineticText
              text={cues[2].text}
              start={alarmStart}
              exitAt={alarmEnd}
              highlight={['alarms']}
              highlightColor={colors.alert}
              style={{fontSize: 92, fontWeight: 700, lineHeight: 1.1}}
            />
          </div>
        ) : null}
        {frame >= sec(cues[3].start, fps) - 2 && frame < titleAt ? (
          <KineticText
            text={cues[3].text}
            start={sec(cues[3].start, fps)}
            exitAt={titleAt - 16}
            style={{fontSize: 104, fontWeight: 500, fontStyle: 'italic'}}
          />
        ) : null}
      </AbsoluteFill>

      {/* title reveal */}
      {frame >= titleAt - 15 ? <TitleCard start={titleAt} dim={titleDim} /> : null}
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{start: number; dim: number}> = ({start, dim}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const title = documentaryConfig.meta.title.toUpperCase();
  const rule = tween(frame, start + 10, start + 50, 0, 1, ease.inOut);
  const sub = tween(frame, start + 40, start + 70, 0, 1);
  const glow = 0.4 + 0.2 * breathe(frame, 80);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `rgba(3,4,6,${dim})`}} />
      <LightLeak intensity={0.35 * tween(frame, start, start + 30)} from={start} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div style={{display: 'flex', gap: 6, fontFamily: fonts.display, fontWeight: 800, fontSize: 150, color: colors.text, letterSpacing: '0.05em'}}>
          {Array.from(title).map((ch, i) => {
            const p = springIn(frame, fps, start + i * 2.2, 200, 40);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  minWidth: ch === ' ' ? 46 : undefined,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 40}px) scale(${1.15 - p * 0.15})`,
                  filter: `blur(${(1 - p) * 14}px)`,
                  textShadow: `0 0 60px ${withAlpha(colors.accent, glow * p)}`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{width: 1100 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`, margin: '18px 0 34px'}} />
        <div style={{fontFamily: fonts.mono, fontSize: 30, letterSpacing: '0.42em', color: colors.textMuted, opacity: sub, transform: `translateY(${(1 - sub) * 12}px)`, paddingLeft: '0.42em'}}>
          {documentaryConfig.meta.subtitle.toUpperCase()}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
