import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ease, tween} from '../utils/animations';

/** Fades its children in over `frames` at the start of the parent Sequence. */
export const FadeIn: React.FC<{frames: number; children: React.ReactNode}> = ({frames, children}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{opacity: tween(frame, 0, frames, 0, 1, ease.inOut)}}>{children}</AbsoluteFill>;
};

/** Fades in at the start and out at the end of the parent Sequence (a "beat"). */
export const Beat: React.FC<{fadeIn?: number; fadeOut?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  fadeIn = 12,
  fadeOut = 12,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const a = Math.min(tween(frame, 0, fadeIn, 0, 1, ease.inOut), tween(frame, durationInFrames - fadeOut, durationInFrames, 1, 0, ease.inOut));
  return <AbsoluteFill style={{opacity: a, ...style}}>{children}</AbsoluteFill>;
};
