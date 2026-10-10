import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import type {TransitionPresentation, TransitionPresentationComponentProps} from '@remotion/transitions';
import {linearTiming, springTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import type {TransitionType} from '../config/documentaryConfig';
import {ease} from '../utils/animations';
import {colors, withAlpha} from '../utils/colors';

/**
 * Custom transition presentations for <TransitionSeries>. Each receives the
 * exiting and entering scene separately (presentationDirection) with a
 * shared 0..1 progress, so both halves stay frame-locked.
 */
type Empty = Record<string, never>;
type P = TransitionPresentationComponentProps<Empty>;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const WhipPan: React.FC<P> = ({children, presentationDirection, presentationProgress: p}) => {
  const e = ease.inOut(p);
  const exiting = presentationDirection === 'exiting';
  const x = exiting ? -e * 100 : (1 - e) * 100;
  const blur = Math.sin(p * Math.PI) * 40;
  return (
    <AbsoluteFill style={{transform: `translateX(${x}%) skewX(${(exiting ? 1 : -1) * Math.sin(p * Math.PI) * -6}deg)`, filter: `blur(${blur}px)`}}>
      {children}
    </AbsoluteFill>
  );
};

const LightLeak: React.FC<P> = ({children, presentationDirection, presentationProgress: p}) => {
  const exiting = presentationDirection === 'exiting';
  const opacity = exiting ? 1 : interpolate(p, [0.35, 0.75], [0, 1], clamp);
  const flare = Math.sin(p * Math.PI);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>
      {!exiting ? (
        <AbsoluteFill
          style={{
            mixBlendMode: 'screen',
            opacity: flare,
            background: `radial-gradient(ellipse 70% 55% at ${20 + p * 60}% 45%, ${withAlpha('#fff1d6', 0.95)} 0%, ${withAlpha(colors.accent, 0.6)} 30%, rgba(0,0,0,0) 75%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const ShapeWipe: React.FC<P> = ({children, presentationDirection, presentationProgress: p}) => {
  if (presentationDirection === 'exiting') return <AbsoluteFill>{children}</AbsoluteFill>;
  const e = ease.inOut(p);
  const edge = -30 + e * 160; // percent; diagonal band sweeps left→right
  const clip = `polygon(0% 0%, ${edge}% 0%, ${edge - 25}% 100%, 0% 100%)`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{clipPath: clip}}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          clipPath: `polygon(${edge}% 0%, ${edge + 3}% 0%, ${edge - 22}% 100%, ${edge - 25}% 100%)`,
          background: colors.accent,
          opacity: Math.sin(p * Math.PI),
        }}
      />
    </AbsoluteFill>
  );
};

const ZoomThrough: React.FC<P> = ({children, presentationDirection, presentationProgress: p}) => {
  const e = ease.in(p);
  if (presentationDirection === 'exiting') {
    return <AbsoluteFill style={{transform: `scale(${1 + e * 1.4})`, opacity: 1 - interpolate(p, [0.4, 1], [0, 1], clamp), filter: `blur(${e * 16}px)`}}>{children}</AbsoluteFill>;
  }
  const o = ease.out(p);
  return <AbsoluteFill style={{transform: `scale(${0.82 + o * 0.18})`, opacity: interpolate(p, [0.3, 0.8], [0, 1], clamp), filter: `blur(${(1 - o) * 12}px)`}}>{children}</AbsoluteFill>;
};

const BlurDissolve: React.FC<P> = ({children, presentationDirection, presentationProgress: p}) => {
  const exiting = presentationDirection === 'exiting';
  const blur = exiting ? p * 30 : (1 - p) * 30;
  const opacity = exiting ? 1 : ease.inOut(p);
  return <AbsoluteFill style={{filter: `blur(${blur}px)`, opacity}}>{children}</AbsoluteFill>;
};

const Iris: React.FC<P> = ({children, presentationDirection, presentationProgress: p}) => {
  if (presentationDirection === 'exiting') {
    return <AbsoluteFill style={{opacity: interpolate(p, [0.6, 1], [1, 0], clamp)}}>{children}</AbsoluteFill>;
  }
  const r = ease.inOut(p) * 75;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{clipPath: `circle(${r}% at 50% 50%)`}}>{children}</AbsoluteFill>
      <AbsoluteFill style={{clipPath: `circle(${r}% at 50% 50%)`, boxShadow: 'none'}}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute'}}>
          <circle cx={960} cy={540} r={(r / 100) * Math.hypot(1920, 1080) * 0.707} fill="none" stroke={colors.text} strokeOpacity={Math.sin(p * Math.PI) * 0.6} strokeWidth={2} />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const DipToBlack: React.FC<P> = ({children, presentationDirection, presentationProgress: p}) => {
  const opacity = presentationDirection === 'exiting' ? interpolate(p, [0, 0.5], [1, 0], clamp) : interpolate(p, [0.5, 1], [0, 1], clamp);
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const make = (component: React.FC<P>): TransitionPresentation<Empty> => ({component, props: {}});

/** Map a config transition name to a presentation + timing. */
export const getTransition = (type: TransitionType, frames: number) => {
  const timing =
    type === 'whipPan' || type === 'zoomThrough'
      ? linearTiming({durationInFrames: frames})
      : type === 'iris'
        ? springTiming({config: {damping: 200}, durationInFrames: frames})
        : linearTiming({durationInFrames: frames});
  const presentation: TransitionPresentation<Record<string, unknown>> = {
    crossfade: fade() as TransitionPresentation<Record<string, unknown>>,
    dipToBlack: make(DipToBlack),
    whipPan: make(WhipPan),
    lightLeak: make(LightLeak),
    shapeWipe: make(ShapeWipe),
    zoomThrough: make(ZoomThrough),
    blurDissolve: make(BlurDissolve),
    iris: make(Iris),
  }[type] as TransitionPresentation<Record<string, unknown>>;
  return {timing, presentation};
};
