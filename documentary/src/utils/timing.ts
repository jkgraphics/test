import {documentaryConfig, type SceneConfig, type SceneId} from '../config/documentaryConfig';

export const FPS = documentaryConfig.meta.fps;

/** Seconds → frames (rounded to whole frames). */
export const sec = (seconds: number, fps: number = FPS): number => Math.round(seconds * fps);

export type TimedScene = SceneConfig & {
  /** First frame of the scene on the master timeline. */
  from: number;
  durationInFrames: number;
  /** Frames this scene overlaps with the next one (its outgoing transition). */
  overlapOut: number;
};

/**
 * Computes the master timeline exactly the way <TransitionSeries> lays it out:
 * every transition overlaps the outgoing and incoming scene, so each scene
 * starts `transitionOut.frames` before the previous one ends.
 */
export const buildTimeline = (scenes: SceneConfig[] = documentaryConfig.scenes, fps: number = FPS) => {
  let cursor = 0;
  const timed: TimedScene[] = scenes.map((scene, i) => {
    const durationInFrames = sec(scene.durationSec, fps);
    const isLast = i === scenes.length - 1;
    const overlapOut = !isLast && scene.transitionOut ? scene.transitionOut.frames : 0;
    if (overlapOut * 2 > durationInFrames) {
      throw new Error(`Scene "${scene.id}": transition (${overlapOut}f) is too long for its duration.`);
    }
    const item: TimedScene = {...scene, from: cursor, durationInFrames, overlapOut};
    cursor += durationInFrames - overlapOut;
    return item;
  });
  return {scenes: timed, totalFrames: cursor};
};

export const timeline = buildTimeline();

export const getScene = (id: SceneId): TimedScene => {
  const s = timeline.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

/** Absolute (master timeline) narration cues — used by subtitles and ducking. */
export const absoluteCues = (fps: number = FPS) =>
  timeline.scenes.flatMap((scene) =>
    scene.narration.map((cue) => ({
      sceneId: scene.id,
      from: scene.from + sec(cue.start, fps),
      to: scene.from + sec(cue.end, fps),
      text: cue.text,
      onScreen: Boolean(scene.narrationIsOnScreen),
    })),
  );

/** Format frames as mm:ss:ff — handy for logging scene tables. */
export const timecode = (frames: number, fps: number = FPS): string => {
  const total = Math.floor(frames / fps);
  const ff = frames % fps;
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
};
