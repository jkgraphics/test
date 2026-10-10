// QA helper: bundles once and renders a list of frames to out/stills/.
// Usage: node scripts/render-stills.mjs 0 300 900 ...   (no args = 3 frames per scene)
//        BROWSER=/path/to/chrome node scripts/render-stills.mjs ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = process.env.BROWSER || null;
const composition = await selectComposition({serveUrl, id: 'Documentary', browserExecutable});

let frames = process.argv.slice(2).map(Number);
if (frames.length === 0) {
  // Default: beginning, middle and end of every scene, from the scene markers.
  const timeline = null; // pass explicit frames, or see scripts/print-timeline.mjs
  frames = timeline
    ? timeline.flatMap((s) => [s.from + 45, s.from + Math.floor(s.durationInFrames / 2), s.from + s.durationInFrames - 45])
    : [0, Math.floor(composition.durationInFrames / 2), composition.durationInFrames - 1];
}
mkdirSync('out/stills', {recursive: true});
for (const frame of frames) {
  const output = `out/stills/f${String(frame).padStart(5, '0')}.jpg`;
  await renderStill({composition, serveUrl, frame, output, imageFormat: 'jpeg', jpegQuality: 85, browserExecutable});
  console.log('✓', output);
}
