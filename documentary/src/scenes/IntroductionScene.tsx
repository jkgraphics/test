import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {Earth} from '../components/Celestial';
import {CinematicImage} from '../components/CinematicImage';
import {Eyebrow, KineticText} from '../components/KineticText';
import {crew} from '../config/content';
import {ease, envelope, springIn, tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

/**
 * SCENE 2 — INTRODUCTION: the mission and the crew.
 * An Earth limb glows at the bottom of frame; the camera drifts right as each
 * crew member's card is introduced in sync with the narration.
 * Ends on a ghosted "1957" that match-cuts into the History timeline.
 */
export const IntroductionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cues = getScene('introduction').narration;
  const crewAt = [sec(cues[1].start, fps), sec(cues[2].start, fps), sec(cues[3].start, fps)];
  const outroAt = sec(cues[4].start, fps);
  const headerOut = tween(frame, crewAt[0] - 20, crewAt[0] + 6, 0, 1, ease.in);
  const cardsOut = tween(frame, outroAt - 6, outroAt + 18, 0, 1, ease.in);
  const yearIn = tween(frame, outroAt + 6, outroAt + 40, 0, 1);

  return (
    <AbsoluteFill style={{background: colors.background}}>
      <Camera keys={[{frame: 0, x: 40, scale: 1.04}, {frame: sec(26, fps), x: -40, scale: 1.1}]}>
        <Layer depth={0.2}>
          <Starfield seed={21} count={260} opacity={0.7} />
        </Layer>
        <Layer depth={0.6}>
          <div style={{position: 'absolute', left: 960 - 1700, top: 700, opacity: 0.95}}>
            <Earth size={3400} lightAngle={250} shadow={0.35} spin={0.25} />
          </div>
        </Layer>
      </Camera>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(6,7,10,0.0) 0%, rgba(6,7,10,0.0) 55%, rgba(6,7,10,0.55) 100%)'}} />

      {/* header */}
      {headerOut < 1 ? (
        <AbsoluteFill style={{justifyContent: 'center', paddingLeft: safe.x, opacity: 1 - headerOut, transform: `translateY(${-headerOut * 30}px)`}}>
          <Eyebrow text="Prologue · July 1969" start={sec(0.6, fps)} />
          <KineticText text="Apollo 11" start={sec(1.2, fps)} style={{fontSize: 190, fontWeight: 800, marginTop: 24, lineHeight: 1}} />
          <KineticText
            text="The first mission to land humans on the Moon."
            start={sec(2.2, fps)}
            stagger={2}
            style={{fontFamily: fonts.body, fontSize: 44, color: colors.textMuted, marginTop: 26, fontWeight: 400}}
          />
        </AbsoluteFill>
      ) : null}

      {/* crew cards */}
      {frame >= crewAt[0] - 10 && cardsOut < 1 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: 1 - cardsOut, transform: `scale(${1 - cardsOut * 0.04})`}}>
          <div style={{display: 'flex', gap: 56, marginTop: -40}}>
            {crew.map((c, i) => {
              const appear = springIn(frame, fps, crewAt[i], 200, 30);
              const activeEnd = i < 2 ? crewAt[i + 1] : outroAt;
              const active = envelope(frame, crewAt[i], activeEnd, 10, 10);
              return (
                <div
                  key={c.name}
                  style={{
                    width: 470,
                    opacity: appear * (0.45 + 0.55 * active),
                    transform: `translateY(${(1 - appear) * 60}px) scale(${1 + active * 0.03})`,
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      height: 560,
                      overflow: 'hidden',
                      border: `1px solid ${active > 0.5 ? colors.accent : colors.line}`,
                      boxShadow: active > 0 ? `0 30px 80px rgba(0,0,0,0.6), 0 0 ${50 * active}px ${withAlpha(colors.accent, 0.25)}` : '0 30px 80px rgba(0,0,0,0.6)',
                    }}
                  >
                    <CinematicImage asset={c.assetKey} zoom={[1.02, 1.1]} grade="warm" fallback={<PortraitFallback name={c.name} index={i} />} />
                  </div>
                  <div style={{marginTop: 26}}>
                    <div style={{fontFamily: fonts.mono, fontSize: 20, letterSpacing: '0.24em', color: colors.accent, textTransform: 'uppercase'}}>{c.role}</div>
                    <div style={{fontFamily: fonts.display, fontWeight: 700, fontSize: 46, color: colors.text, marginTop: 8}}>{c.name}</div>
                    <div style={{fontFamily: fonts.body, fontSize: 22, color: colors.textMuted, marginTop: 8, opacity: 0.4 + active * 0.6}}>{c.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* match-cut bridge into History */}
      {yearIn > 0 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 420,
              color: withAlpha(colors.text, 0.12 * yearIn),
              transform: `scale(${0.92 + yearIn * 0.08})`,
              letterSpacing: '0.02em',
            }}
          >
            1957
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/** Original placeholder portrait: astronaut helmet silhouette + monogram. */
const PortraitFallback: React.FC<{name: string; index: number}> = ({name, index}) => {
  const frame = useCurrentFrame();
  const initials = name
    .replace(/“.*?”/g, '')
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w) && w.length > 2)
    .map((w) => w[0])
    .join('');
  const hue = [colors.accent, colors.accent2, '#b9a7e0'][index % 3];
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 90% 70% at 50% 35%, ${withAlpha(hue, 0.28)} 0%, ${colors.panel} 55%, #0a0b0e 100%)`}}>
      <svg viewBox="0 0 470 560" width="100%" height="100%">
        <defs>
          <linearGradient id={`visor-${index}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={hue} stopOpacity={0.7} />
            <stop offset="55%" stopColor="#0b0c10" />
            <stop offset="100%" stopColor={hue} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        {/* shoulders */}
        <path d="M40 560 C60 430 150 390 235 390 C320 390 410 430 430 560 Z" fill="#1b1e25" stroke={withAlpha('#ffffff', 0.08)} />
        {/* helmet */}
        <circle cx={235} cy={250} r={140} fill="#23262e" stroke={withAlpha('#ffffff', 0.12)} strokeWidth={2} />
        <ellipse cx={235} cy={262} rx={104} ry={92} fill={`url(#visor-${index})`} />
        <ellipse cx={200 + Math.sin(frame / 40) * 6} cy={226} rx={30} ry={14} fill="#ffffff" opacity={0.18} transform="rotate(-25 200 226)" />
      </svg>
      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 18,
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 90,
          color: withAlpha(colors.text, 0.12),
        }}
      >
        {initials}
      </div>
    </AbsoluteFill>
  );
};
