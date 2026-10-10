// Prints the scene table (start/end frames, timecodes) and total duration.
// Usage: node scripts/print-timeline.mjs
import {build} from 'esbuild';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'timeline-'));
const out = join(dir, 'timing.mjs');
await build({entryPoints: ['src/utils/timing.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error'});
const {timeline, timecode, FPS} = await import(out);
rmSync(dir, {recursive: true, force: true});

console.log('#  Scene              Start   End     Start TC    Dur   Transition out');
timeline.scenes.forEach((s, i) => {
  const end = s.from + s.durationInFrames - 1;
  console.log(
    `${String(i + 1).padStart(2)} ${s.id.padEnd(18)} ${String(s.from).padStart(5)}  ${String(end).padStart(5)}   ${timecode(s.from)}  ${String(s.durationSec).padStart(4)}s  ${s.transitionOut ? `${s.transitionOut.type} (${s.transitionOut.frames}f)` : '—'}`,
  );
});
console.log(`\nTotal: ${timeline.totalFrames} frames = ${(timeline.totalFrames / FPS).toFixed(2)} s (${timecode(timeline.totalFrames)}) @ ${FPS} fps`);
