import React from 'react';
import {AbsoluteFill} from 'remotion';
import {TransitionSeries} from '@remotion/transitions';
import {documentaryConfig, type SceneId} from './config/documentaryConfig';
import {timeline} from './utils/timing';
import {getTransition} from './components/SceneTransition';
import {FilmGrain, Letterbox, Vignette} from './components/Atmosphere';
import {SubtitleTrack} from './components/Subtitle';
import {FontLoader} from './components/FontLoader';
import {Soundtrack} from './audio/Soundtrack';
import {OpeningScene} from './scenes/OpeningScene';
import {IntroductionScene} from './scenes/IntroductionScene';
import {HistoryScene} from './scenes/HistoryScene';
import {MachineScene} from './scenes/MachineScene';
import {JourneyScene} from './scenes/JourneyScene';
import {DescentScene} from './scenes/DescentScene';
import {DataScene} from './scenes/DataScene';
import {AnalysisScene} from './scenes/AnalysisScene';
import {ConclusionScene} from './scenes/ConclusionScene';
import {CreditsScene} from './scenes/CreditsScene';
import {colors} from './utils/colors';

/** Scene registry: config id → component. Reorder scenes in the config, not here. */
export const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  opening: OpeningScene,
  introduction: IntroductionScene,
  history: HistoryScene,
  machine: MachineScene,
  journey: JourneyScene,
  descent: DescentScene,
  data: DataScene,
  analysis: AnalysisScene,
  conclusion: ConclusionScene,
  credits: CreditsScene,
};

export type DocumentaryProps = {
  showSubtitles: boolean;
};

/**
 * Master composition.
 *   picture: scenes in a <TransitionSeries>, each transition overlapping the
 *            adjacent scenes by its configured frames
 *   finish:  film grain + vignette (+ optional letterbox) over everything
 *   text:    subtitle track on top
 *   sound:   music / ambience / VO / SFX mix
 */
export const Documentary: React.FC<DocumentaryProps> = ({showSubtitles}) => {
  const {features} = documentaryConfig;
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <FontLoader />
      <TransitionSeries>
        {timeline.scenes.flatMap((scene) => {
          const Scene = SCENE_COMPONENTS[scene.id];
          const items = [
            <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames} name={scene.title}>
              <Scene />
            </TransitionSeries.Sequence>,
          ];
          if (scene.overlapOut > 0 && scene.transitionOut) {
            const {timing, presentation} = getTransition(scene.transitionOut.type, scene.transitionOut.frames);
            items.push(<TransitionSeries.Transition key={`${scene.id}-out`} timing={timing} presentation={presentation} />);
          }
          return items;
        })}
      </TransitionSeries>
      {features.vignette ? <Vignette /> : null}
      {features.filmGrain ? <FilmGrain /> : null}
      {features.letterbox ? <Letterbox /> : null}
      {showSubtitles ? <SubtitleTrack /> : null}
      <Soundtrack />
    </AbsoluteFill>
  );
};
