import {Easing, interpolate, spring} from 'remotion';

/** Editorial easing presets — use these instead of ad-hoc curves. */
export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  /** Slow, weighty camera ease. */
  camera: Easing.bezier(0.45, 0.05, 0.25, 1),
  linear: Easing.linear,
};

/** Clamped interpolate with an easing — the workhorse of every component. */
export const tween = (
  frame: number,
  from: number,
  to: number,
  outFrom = 0,
  outTo = 1,
  easing: (t: number) => number = ease.out,
): number =>
  interpolate(frame, [from, to], [outFrom, outTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

/**
 * Visibility envelope: 0 → 1 over `fadeIn` frames starting at `start`,
 * then 1 → 0 over `fadeOut` frames ending at `end`.
 */
export const envelope = (frame: number, start: number, end: number, fadeIn = 15, fadeOut = 15): number => {
  if (frame < start || frame > end) return 0;
  const a = tween(frame, start, start + fadeIn, 0, 1, ease.out);
  const b = tween(frame, end - fadeOut, end, 1, 0, ease.in);
  return Math.min(a, b);
};

/** Natural, non-bouncy spring for entrances. */
export const springIn = (frame: number, fps: number, delay = 0, damping = 200, durationInFrames?: number): number =>
  spring({frame: frame - delay, fps, config: {damping, mass: 1, stiffness: 100}, durationInFrames});

/** Spring with a little overshoot, for graphic "pops". */
export const springPop = (frame: number, fps: number, delay = 0): number =>
  spring({frame: frame - delay, fps, config: {damping: 14, mass: 0.8, stiffness: 140}});

/** Smooth 0..1 oscillation for subtle breathing / flicker. Deterministic. */
export const breathe = (frame: number, periodFrames: number, phase = 0): number =>
  0.5 + 0.5 * Math.sin(((frame + phase) / periodFrames) * Math.PI * 2);
