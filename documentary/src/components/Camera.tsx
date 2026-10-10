import React, {createContext, useContext} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ease} from '../utils/animations';

/**
 * Virtual camera. <Camera> owns a set of keyframes; every <Layer> inside it
 * applies the camera transform scaled by its `depth`, which produces true
 * parallax: far layers (depth 0.2) barely move, near layers (depth 1.3) move
 * more than the frame itself.
 */
export type CameraKey = {frame: number; x?: number; y?: number; scale?: number; rotate?: number};

type CameraState = {x: number; y: number; scale: number; rotate: number};

const CameraContext = createContext<CameraState>({x: 0, y: 0, scale: 1, rotate: 0});

const track = (frame: number, keys: CameraKey[], prop: keyof Omit<CameraKey, 'frame'>, fallback: number, easing: (t: number) => number) => {
  const pts = keys.filter((k) => k[prop] !== undefined);
  if (pts.length === 0) return fallback;
  if (pts.length === 1) return pts[0][prop] as number;
  return interpolate(
    frame,
    pts.map((k) => k.frame),
    pts.map((k) => k[prop] as number),
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing},
  );
};

export const Camera: React.FC<{
  keys: CameraKey[];
  easing?: (t: number) => number;
  children: React.ReactNode;
}> = ({keys, easing = ease.camera, children}) => {
  const frame = useCurrentFrame();
  const sorted = [...keys].sort((a, b) => a.frame - b.frame);
  const state: CameraState = {
    x: track(frame, sorted, 'x', 0, easing),
    y: track(frame, sorted, 'y', 0, easing),
    scale: track(frame, sorted, 'scale', 1, easing),
    rotate: track(frame, sorted, 'rotate', 0, easing),
  };
  return <CameraContext.Provider value={state}>{children}</CameraContext.Provider>;
};

export const useCamera = () => useContext(CameraContext);

/** A parallax plane. depth = 1 moves exactly with the camera. */
export const Layer: React.FC<{
  depth?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({depth = 1, children, style}) => {
  const cam = useCamera();
  const s = 1 + (cam.scale - 1) * depth;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${cam.x * depth}px, ${cam.y * depth}px) scale(${s}) rotate(${cam.rotate * depth}deg)`,
        transformOrigin: '50% 50%',
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
