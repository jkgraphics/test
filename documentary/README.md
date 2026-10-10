# The Eight Days — a cinematic documentary in Remotion

A 4 min 40 s, 1920×1080, 30 fps documentary about **Apollo 11**, built entirely
in code with [Remotion](https://www.remotion.dev/), React and TypeScript.

The film is built from original motion graphics: procedural Moon, Earth and
starfields, an orthographic globe map, a Saturn V blueprint, trajectory and
descent diagrams, animated charts and counters, kinetic typography, a virtual
parallax camera, custom transitions, subtitles and a full sound mix. Every
asset slot can be swapped for real NASA footage or photos without touching
scene code.

> **Topic note.** The brief left the topic open (`[INSERT YOUR TOPIC HERE]`),
> so this build ships with Apollo 11. Apollo 11 is well documented, so every
> on-screen claim can be sourced. The engine (components, camera, transitions,
> timing, audio) does not depend on the topic. See
> [Changing the topic](#changing-the-topic).

---

## 1. Quick start

```bash
cd documentary
npm install
npm run dev            # opens Remotion Studio (live preview + timeline scrubbing)
npm run render         # renders out/documentary.mp4 (H.264, CRF 18, 320 kbps AAC)
```

Requirements: Node 18 or later. Remotion downloads its own headless Chrome on
first render. If you are offline or behind a proxy, point it at a local
Chrome/Chromium with `--browser-executable=/path/to/chrome`.

### All commands

| Command | What it does |
|---|---|
| `npm run dev` | Remotion Studio. `Documentary` is the full film; the `Scenes/` folder holds each scene as its own composition. |
| `npm run typecheck` | Runs `tsc --noEmit` over the project. |
| `npm run timeline` | Prints the scene table: start and end frames, timecodes, transitions and the total duration. |
| `npm run render` | Final MP4 at `out/documentary.mp4`. |
| `npm run render:preview` | Fast half-resolution preview at `out/preview.mp4`. |
| `npm run render:master` | ProRes HQ master `.mov` for further grading or editing. |
| `npm run still` | Renders a single PNG (frame 300). |
| `npm run stills -- 0 900 4500` | Bundles once and renders the listed frames to `out/stills/` for QA. |
| `npm run audio` | Regenerates the procedural placeholder music and SFX (needs `ffmpeg`). |

Render one scene on its own:

```bash
npx remotion render src/index.ts Scene06-descent out/descent.mp4
```

Render a frame range:

```bash
npx remotion render src/index.ts Documentary out/clip.mp4 --frames=4262-5461
```

### Dependencies

| Package | Why |
|---|---|
| `remotion`, `@remotion/cli` 4.0.534 | Core framework, Studio and renderer CLI |
| `@remotion/transitions` 4.0.534 | `<TransitionSeries>` for frame-accurate overlapping transitions |
| `react`, `react-dom` 19 | UI runtime |
| `@fontsource/playfair-display`, `inter`, `jetbrains-mono` | Self-hosted fonts, so no network access is needed at render time |
| dev: `typescript`, `@types/react`, `esbuild`, `@remotion/bundler`, `@remotion/renderer` | Type checking and the QA scripts |

---

## 2. Project structure

```
documentary/
├─ remotion.config.ts            render defaults (JPEG frames, quality, concurrency)
├─ docs/scene-breakdown.md       scene-by-scene direction document
├─ scripts/
│  ├─ generate-placeholder-audio.mjs   procedural music, ambience and SFX (ffmpeg)
│  ├─ print-timeline.mjs               scene/frame table
│  └─ render-stills.mjs                QA stills
├─ public/
│  ├─ audio/{music,ambience,sfx,vo}/   sound (vo/ is empty until you add narration)
│  ├─ images/  videos/  fonts/         drop real assets here
└─ src/
   ├─ index.ts                   registerRoot
   ├─ Root.tsx                   <Composition> for the film plus one per scene
   ├─ Documentary.tsx            TransitionSeries, finishing layers, subtitles, soundtrack
   ├─ config/
   │  ├─ documentaryConfig.ts    ★ topic, colours, fonts, features, audio, scene order, durations, transitions, narration
   │  ├─ content.ts              ★ facts, stats, chart data, quotes, sources
   │  └─ assets.ts               ★ replaceable footage and photo slots
   ├─ scenes/                    Opening, Introduction, History, Machine, Journey,
   │                             Descent, Data, Analysis, Conclusion, Credits
   ├─ components/
   │  ├─ Camera.tsx              virtual camera + parallax <Layer depth>
   │  ├─ KineticText.tsx         masked word/char/line reveals, Eyebrow labels
   │  ├─ ChapterTitle.tsx        chapter cards
   │  ├─ LowerThird.tsx          people, places, facts
   │  ├─ AnimatedCounter.tsx     number counters
   │  ├─ TimelineGraphic.tsx     horizontal history timeline
   │  ├─ DataChart.tsx           BarChart, LineChart
   │  ├─ Callout.tsx             annotation leader lines
   │  ├─ QuoteCard.tsx           pull-quotes with attribution
   │  ├─ CinematicImage.tsx      photo/video slot with Ken Burns + graded fallback
   │  ├─ Celestial.tsx           procedural Moon, Earth, orthographic Globe map
   │  ├─ Spacecraft.tsx          Saturn V (to scale) and Lunar Module
   │  ├─ Starfield.tsx           deterministic stars
   │  ├─ Atmosphere.tsx          FilmGrain, Vignette, LightLeak, Particles, Letterbox, BlueprintGrid
   │  ├─ Hud.tsx                 technical frame brackets and readouts
   │  ├─ Fade.tsx                FadeIn / Beat envelopes for sub-scenes
   │  ├─ SceneTransition.tsx     8 transition presentations
   │  ├─ Subtitle.tsx            timed captions driven by the narration cues
   │  └─ FontLoader.tsx          blocks rendering until the fonts have loaded
   ├─ audio/Soundtrack.tsx       music, ambience, VO, SFX, ducking and fades
   └─ utils/                     animations (easing/tween/spring), timing, colours, seeded random
```

---

## 3. How timing works

- Each scene in `documentaryConfig.scenes` has a `durationSec` and an optional
  `transitionOut: {type, frames}`.
- `utils/timing.ts → buildTimeline()` lays scenes out the same way
  `<TransitionSeries>` does: each transition overlaps the outgoing and incoming
  scenes by `frames`. The composition duration is **computed**, so it never
  goes out of sync and there are no gaps or unintended overlaps.
- Narration cues use **seconds relative to the scene start**. Scenes read
  their own cues (`getScene('descent').narration`) to time visual beats, so
  re-timing a line moves its animation too.
- Subtitles, SFX, voice-over and ducking convert those cues to absolute frames
  with the same timeline.

Current timeline (`npm run timeline`):

```
#  Scene              Start   End     Start TC    Dur   Transition out
 1 opening                0    719   00:00:00    24s  lightLeak (30f)
 2 introduction         690   1469   00:23:00    26s  dipToBlack (24f)
 3 history             1446   2645   00:48:06    40s  whipPan (18f)
 4 machine             2628   3527   01:27:18    30s  zoomThrough (22f)
 5 journey             3506   4285   01:56:26    26s  blurDissolve (24f)
 6 descent             4262   5461   02:22:02    40s  iris (26f)
 7 data                5436   6395   03:01:06    32s  shapeWipe (24f)
 8 analysis            6372   7271   03:32:12    30s  crossfade (30f)
 9 conclusion          7242   8081   04:01:12    28s  dipToBlack (30f)
10 credits             8052   8411   04:28:12    12s  —

Total: 8412 frames = 280.40 s (04:40:12) @ 30 fps
```

To make the film shorter or longer, change `durationSec` (and the cue times
inside that scene) in the config. Change the frame rate in `meta.fps`; all
timing is expressed in seconds and converted with `sec()`.

---

## 4. Adding real media

### Footage and photos

1. Copy the file into `public/images/` or `public/videos/`.
2. In `src/config/assets.ts`, set the slot's `src`, for example
   `src: 'images/crew-armstrong.jpg'`.
3. Optionally adjust `focus` (CSS `object-position`) to control the crop.

Each slot lists what it is for and a suggested public-domain NASA source.
Videos are played muted with `<OffthreadVideo>`. Empty slots fall back to
original motion graphics, so nothing renders blank. While assembling footage,
set `features.showPlaceholderLabels: true` to see which slots are still empty.

| Slot | Used in |
|---|---|
| `openingMoon` | Cold open hero |
| `crewArmstrong`, `crewAldrin`, `crewCollins` | Introduction crew cards |
| `launchFootage` | Machine scene, launch beat |
| `landingSurface` | Descent scene, surface beat |
| `firstStep` | Descent scene, first-step quote |

### Narration (voice-over)

No narration audio exists yet, and **none has been generated**. The script
lives in the config as `narration` cues and is shown as subtitles.

1. Record one file per scene, using the script in `documentaryConfig.ts`.
2. Save the files as `public/audio/vo/<sceneId>.mp3` (`opening.mp3`,
   `introduction.mp3`, …), matching each scene's `voiceOver` path.
3. Set `audio.voiceOver.enabled: true`.
4. Re-time each cue's `start`/`end` to the recording (Studio's waveform helps).
   The music then ducks automatically under each line.

### Music and sound effects

`public/audio/music/score-placeholder.mp3`, `ambience/space-room-tone.mp3` and
`sfx/*.mp3` are **original, procedurally generated placeholders** made by
`npm run audio`. Replace them with licensed audio, either with the same file
names or by editing `audio.music.src` and the other paths. Levels, fades, the
ducking depth and per-cue SFX volumes are all in `documentaryConfig.audio` and
in each scene's `sfx` list. Transitions automatically add a whoosh or impact;
turn that off with `audio.transitionSfx: false`.

### Fonts

Fonts come from `@fontsource` packages, imported in `components/FontLoader.tsx`.
To use a different font, either install another `@fontsource/*` package or put
`.woff2` files in `public/fonts/` and declare them with `@font-face` (use
`staticFile()` for the URL). Then update `theme.fonts` in the config and the
`FACES` list in `FontLoader.tsx`, so rendering waits for the new font.

### Subtitles

On by default (`features.subtitles`). They can also be toggled per render:

```bash
npx remotion render src/index.ts Documentary out/clean.mp4 --props='{"showSubtitles":false}'
```

---

## 5. Changing the topic

1. **`config/documentaryConfig.ts`**: set `meta.title`/`subtitle`, the colours,
   and rewrite each scene's `title`, `purpose`, `durationSec` and `narration`.
   Add, remove or reorder scenes in the `scenes` array.
2. **`config/content.ts`**: replace the facts, statistics, chart data, quotes
   and `sources`. Only use verified facts. If research isn't finished yet, use
   obvious placeholders such as `'[STAT — VERIFY]'`.
3. **`config/assets.ts`**: define your media slots.
4. **Scenes**: reuse the components. For a new scene, create
   `src/scenes/MyScene.tsx`, add its id to `SceneId` and register it in
   `SCENE_COMPONENTS` in `Documentary.tsx`.

The Apollo-specific visuals (`Spacecraft.tsx`, parts of `Celestial.tsx`) are
self-contained, so delete them if you don't need them.

---

## 6. Determinism and render safety

- Animation is driven only by `useCurrentFrame()`. There are no CSS keyframe
  animations, timers or `Math.random()`. Stars, particles, craters and smoke
  all use a seeded PRNG (`utils/random.ts`).
- Film grain changes its `feTurbulence` seed per frame from `frame % 9`, so it
  is deterministic.
- `FontLoader` holds the render with `delayRender()` until every font face has
  loaded.
- All media go through `staticFile()`. Empty slots never request a file.

---

## 7. Quality-control record (this build)

What was actually run on this build:

- [x] `tsc --noEmit` passes with `strict`, `noUnusedLocals` and `noUnusedParameters`.
- [x] Timeline computed at 8,412 frames (280.4 s) at 30 fps, 1920×1080, with no
      gaps (`npm run timeline`).
- [x] Stills rendered and inspected from the beginning, middle and end of every
      scene, around 50 frames in total. Fixes made from that review: the title
      was clipping past the safe margins; timeline year numbers overlapped the
      event titles; the Moon collided with timeline text; the Saturn V height
      label wrapped; the thrust figure, alarm box and budget chart overlapped
      the subtitles; and trajectory labels were cut off at the frame edges.
- [x] A 10 s segment containing the blur-dissolve transition was rendered to
      MP4. The output is H.264 1920×1080 at 30 fps with 48 kHz stereo AAC.
- [x] Placeholder audio levels measured with ffmpeg `volumedetect` (music
      around −20.6 dB mean and −6.1 dB peak before mix gain).
- [x] Full-length render completed: `out/documentary.mp4` is 67 MB, H.264
      1920×1080 at 30 fps, **8,412 frames, 280.4 s**, with AAC stereo audio
      (mix around −24.7 dB mean, −4.0 dB peak). ffmpeg `blackdetect` flagged
      only the intended fade-in from black (0–2 s) and the dark chapter title
      cards. No blank frames or missing media.

---

## 8. Checklist: replacing placeholders before publishing

**Facts and sources**
- [ ] Re-verify every figure in `content.ts` against its source, especially
      the items marked `verify`: the NASA budget-share series and the
      "no human has stood on the Moon since 1972" line, which is true as of
      writing but should be re-checked against current Artemis status.
- [ ] Replace the generic `nasa.gov/history/` source URLs with the exact pages
      you used.
- [ ] Have someone read the narration against the sources: dates, times (UTC
      and local), quotes and attributions.

**Media**
- [ ] Fill the `assets.ts` slots with licensed or public-domain media and
      credit them in the credits scene.
- [ ] Render with `showPlaceholderLabels: true` once to confirm no slot is
      still empty, if you intended to fill them all.

**Audio**
- [ ] Record narration, enable `voiceOver`, and re-time the cues to it.
- [ ] Replace the placeholder score, ambience and SFX. Then update the credits
      line that says the audio is a placeholder.
- [ ] Check the loudness of the final mix (for example `ffmpeg -af loudnorm=print_format=summary`).
      Aim for about −14 LUFS for web, or −23/−24 for broadcast.

**Picture**
- [ ] Scrub the whole film in Studio and watch every transition.
- [ ] Check readability on a phone-sized preview: subtitles 40 px, body text
      ≥ 22 px at 1080p.
- [ ] Render the final MP4 and watch it end to end with sound.
