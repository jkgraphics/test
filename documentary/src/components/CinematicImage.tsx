import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {assets, type AssetKey} from '../config/assets';
import {documentaryConfig} from '../config/documentaryConfig';
import {ease, tween} from '../utils/animations';
import {colors, fonts, withAlpha} from '../utils/colors';

const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)$/i.test(src);

/**
 * Photo / footage slot with a Ken Burns move and documentary grade.
 * If the slot in config/assets.ts has no `src`, the `fallback` motion graphic
 * renders instead — so a missing asset never produces an empty frame.
 */
export const CinematicImage: React.FC<{
  asset: AssetKey;
  fallback: React.ReactNode;
  /** Scale at the start and end of the parent Sequence. */
  zoom?: [number, number];
  /** Pan in px at the start and end. */
  pan?: [{x: number; y: number}, {x: number; y: number}];
  grade?: 'neutral' | 'cool' | 'warm' | 'bw';
  style?: React.CSSProperties;
}> = ({asset, fallback, zoom = [1.04, 1.14], pan = [{x: 0, y: 0}, {x: -30, y: 0}], grade = 'neutral', style}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const slot = assets[asset] as {src: string | null; description: string; focus?: string};

  if (!slot.src) {
    return (
      <AbsoluteFill style={style}>
        {fallback}
        {documentaryConfig.features.showPlaceholderLabels ? (
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              padding: '10px 16px',
              border: `1px dashed ${withAlpha(colors.accent, 0.8)}`,
              fontFamily: fonts.mono,
              fontSize: 16,
              color: colors.accent,
              background: 'rgba(0,0,0,0.6)',
              maxWidth: 520,
            }}
          >
            PLACEHOLDER · assets.{asset}: {slot.description}
          </div>
        ) : null}
      </AbsoluteFill>
    );
  }

  const t = tween(frame, 0, durationInFrames, 0, 1, ease.linear);
  const s = zoom[0] + (zoom[1] - zoom[0]) * t;
  const x = pan[0].x + (pan[1].x - pan[0].x) * t;
  const y = pan[0].y + (pan[1].y - pan[0].y) * t;
  const filter = {
    neutral: 'contrast(1.08) saturate(0.85)',
    cool: 'contrast(1.1) saturate(0.7) hue-rotate(-8deg)',
    warm: 'contrast(1.08) saturate(0.9) sepia(0.18)',
    bw: 'grayscale(1) contrast(1.2)',
  }[grade];
  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: slot.focus ?? '50% 50%',
    transform: `translate(${x}px, ${y}px) scale(${s})`,
    filter,
  };
  return (
    <AbsoluteFill style={{overflow: 'hidden', ...style}}>
      {isVideo(slot.src) ? <OffthreadVideo src={staticFile(slot.src)} muted style={mediaStyle} /> : <Img src={staticFile(slot.src)} style={mediaStyle} />}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.65) 100%)'}} />
    </AbsoluteFill>
  );
};
