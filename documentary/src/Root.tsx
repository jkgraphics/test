import React from 'react';
import {Composition, Folder} from 'remotion';
import {Documentary, SCENE_COMPONENTS} from './Documentary';
import {documentaryConfig} from './config/documentaryConfig';
import {timeline} from './utils/timing';
import {FontLoader} from './components/FontLoader';

const {meta, features} = documentaryConfig;

/** Each scene wrapped with the font loader so it can be previewed on its own. */
const SCENE_COMPOSITIONS = timeline.scenes.map((scene, i) => {
  const Scene = SCENE_COMPONENTS[scene.id];
  const Standalone: React.FC = () => (
    <>
      <FontLoader />
      <Scene />
    </>
  );
  return {id: `Scene${String(i + 1).padStart(2, '0')}-${scene.id}`, scene, Standalone};
});

/**
 * Registers the full documentary plus one composition per scene (in the
 * "Scenes" folder) so each scene can be previewed and rendered in isolation.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={meta.id}
        component={Documentary}
        durationInFrames={timeline.totalFrames}
        fps={meta.fps}
        width={meta.width}
        height={meta.height}
        defaultProps={{showSubtitles: features.subtitles}}
      />
      <Folder name="Scenes">
        {SCENE_COMPOSITIONS.map(({id, scene, Standalone}) => (
          <Composition
            key={id}
            id={id}
            component={Standalone}
            durationInFrames={scene.durationInFrames}
            fps={meta.fps}
            width={meta.width}
            height={meta.height}
          />
        ))}
      </Folder>
    </>
  );
};
