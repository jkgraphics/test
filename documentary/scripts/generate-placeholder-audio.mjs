// Generates ORIGINAL procedural placeholder audio with ffmpeg so the project
// renders with a full mix out of the box. These are not final music/SFX —
// replace them with licensed assets (same file names) before distribution.
//
// Usage: npm run audio      (requires ffmpeg on PATH)
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';

const root = join(dirname(new URL(import.meta.url).pathname), '..', 'public', 'audio');
const MUSIC_SECONDS = 300; // longer than the documentary; the mix fades it out.

const run = (name, args) => {
  const out = join(root, name);
  mkdirSync(dirname(out), {recursive: true});
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, '-c:a', 'libmp3lame', '-q:a', '3', out], {stdio: 'inherit'});
  console.log('✓', name);
};

// ── Score: slow two-chord drone (Am ↔ F) with a low pulse ──────────────────
const chordA = (d) => `0.22*sin(2*PI*55*${d}*t)+0.16*sin(2*PI*110*${d}*t)+0.10*sin(2*PI*130.81*${d}*t)+0.10*sin(2*PI*164.81*${d}*t)+0.05*sin(2*PI*220*${d}*t)`;
const chordF = (d) => `0.22*sin(2*PI*43.65*${d}*t)+0.16*sin(2*PI*87.31*${d}*t)+0.10*sin(2*PI*130.81*${d}*t)+0.10*sin(2*PI*174.61*${d}*t)+0.05*sin(2*PI*261.63*${d}*t)`;
const w = '(0.5+0.5*sin(2*PI*t/48))';
const swell = '(0.75+0.25*sin(2*PI*t/17))';
const pulse = '0.35*sin(2*PI*44*t)*exp(-7*mod(t,1.6))';
// Commas inside filter expressions must be escaped for the lavfi parser.
const esc = (expr) => expr.replace(/,/g, '\\,');
const channel = (d) => esc(`(${w}*(${chordA(d)})+(1-${w})*(${chordF(d)}))*${swell}+${pulse}`);
run('music/score-placeholder.mp3', [
  '-f', 'lavfi', '-i', `aevalsrc=${channel(1)}|${channel(1.003)}:s=44100:d=${MUSIC_SECONDS}`,
  '-af', 'lowpass=f=1800,aecho=0.8:0.7:120|260:0.35|0.25,volume=1.1,afade=t=in:d=4',
]);

// ── Ambience: dark room tone ───────────────────────────────────────────────
run('ambience/space-room-tone.mp3', [
  '-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.6:d=60:seed=7',
  '-af', 'lowpass=f=220,highpass=f=25,volume=0.6,afade=t=in:d=1,afade=t=out:st=59:d=1',
  '-ac', '2',
]);

// ── SFX ────────────────────────────────────────────────────────────────────
run('sfx/whoosh.mp3', [
  '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.9:d=1.3:seed=3',
  '-af', 'bandpass=f=900:width_type=o:w=2,afade=t=in:d=0.7:curve=exp,afade=t=out:st=0.7:d=0.6,volume=2.2',
  '-ac', '2',
]);
run('sfx/impact.mp3', [
  '-f', 'lavfi', '-i', 'aevalsrc=0.9*sin(2*PI*(35*t+(85/6)*(1-exp(-6*t))))*exp(-2.2*t):s=44100:d=3.5',
  '-af', 'aecho=0.8:0.6:90|180:0.3|0.2,lowpass=f=400,volume=1.6',
  '-ac', '2',
]);
run('sfx/riser.mp3', [
  '-f', 'lavfi', '-i', 'aevalsrc=0.5*(t/2.5)*(t/2.5)*sin(2*PI*(200*t+200*t*t)):s=44100:d=2.6',
  '-af', 'aecho=0.8:0.7:60|140:0.3|0.25,afade=t=out:st=2.45:d=0.15',
  '-ac', '2',
]);
run('sfx/alarm.mp3', [
  '-f', 'lavfi', '-i', 'aevalsrc=0.35*lt(mod(t\\,0.3)\\,0.15)*(sin(2*PI*1050*t)+0.4*sin(2*PI*2100*t)):s=44100:d=1.5',
  '-af', 'lowpass=f=3500,afade=t=out:st=1.3:d=0.2',
  '-ac', '2',
]);
// Quindar-style tone (Apollo air-to-ground used 2525 Hz intro tones).
run('sfx/beep.mp3', [
  '-f', 'lavfi', '-i', 'aevalsrc=0.4*sin(2*PI*2525*t):s=44100:d=0.25',
  '-af', 'afade=t=in:d=0.01,afade=t=out:st=0.22:d=0.03',
  '-ac', '2',
]);
run('sfx/rumble.mp3', [
  '-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=1:d=7:seed=11',
  '-af', 'lowpass=f=140,afade=t=in:d=1.5,afade=t=out:st=4:d=3,volume=2.5',
  '-ac', '2',
]);
