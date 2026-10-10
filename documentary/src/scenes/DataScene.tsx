import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Layer} from '../components/Camera';
import {Starfield} from '../components/Starfield';
import {AnimatedCounter} from '../components/AnimatedCounter';
import {BarChart} from '../components/DataChart';
import {Eyebrow, KineticText} from '../components/KineticText';
import {Beat} from '../components/Fade';
import {BlueprintGrid} from '../components/Atmosphere';
import {budgetShare, sources, stats, type SourceKey} from '../config/content';
import {ease, springIn, tween} from '../utils/animations';
import {colors, fonts, safe, withAlpha} from '../utils/colors';
import {getScene, sec} from '../utils/timing';

/**
 * SCENE 7 — BY THE NUMBERS (data & evidence)
 * Beat A: workforce (each dot = 1,000 people) and programme cost.
 * Beat B: NASA's share of federal spending, 1960–1970 — the 1966 peak.
 * Beat C: the guidance computer's memory, visualised word by word; surface stats.
 * Every figure carries a source line.
 */
export const DataScene: React.FC = () => {
  const {fps} = useVideoConfig();
  const cues = getScene('data').narration;
  const bAt = sec(cues[2].start, fps) - 10;
  const cAt = sec(cues[3].start, fps) - 10;
  return (
    <AbsoluteFill style={{background: colors.background}}>
      <AbsoluteFill>
        <Starfield seed={121} count={160} opacity={0.35} />
        <BlueprintGrid opacity={0.05} size={60} />
      </AbsoluteFill>
      <Sequence durationInFrames={bAt + 15} name="A · Workforce & cost">
        <Beat fadeIn={1} fadeOut={15}>
          <ScaleBeat costAt={sec(cues[1].start, fps)} />
        </Beat>
      </Sequence>
      <Sequence from={bAt} durationInFrames={cAt - bAt + 15} name="B · Budget chart">
        <Beat fadeIn={15} fadeOut={15}>
          <BudgetBeat />
        </Beat>
      </Sequence>
      <Sequence from={cAt} name="C · Computer & surface">
        <Beat fadeIn={15} fadeOut={1}>
          <ComputerBeat surfaceAt={sec(cues[4].start, fps) - cAt} />
        </Beat>
      </Sequence>
      <div style={{position: 'absolute', left: safe.x, top: safe.y}}>
        <Eyebrow text="By the numbers" start={4} />
      </div>
    </AbsoluteFill>
  );
};

const SourceLine: React.FC<{k: SourceKey; a?: number; style?: React.CSSProperties}> = ({k, a = 1, style}) => (
  <div style={{fontFamily: fonts.mono, fontSize: 17, letterSpacing: '0.08em', color: withAlpha(colors.text, 0.45), opacity: a, ...style}}>
    SOURCE · {sources[k].publisher.toUpperCase()} — {sources[k].title}
  </div>
);

const ScaleBeat: React.FC<{costAt: number}> = ({costAt}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const start = sec(1.2, fps);
  const cols = 40;
  const rows = 10;
  const filled = Math.floor(tween(frame, start, start + sec(3.5, fps), 0, cols * rows, ease.out));
  const costIn = springIn(frame, fps, costAt);
  const leftDim = tween(frame, costAt, costAt + 20, 1, 0.45);
  return (
    <Camera keys={[{frame: 0, scale: 1.04}, {frame: durationInFrames, scale: 1.0}]}>
      <Layer depth={1}>
        <div style={{position: 'absolute', left: safe.x, top: 240, opacity: leftDim}}>
          <AnimatedCounter value={stats.workforce.value} prefix={stats.workforce.prefix} start={start} duration={sec(3.5, fps)} style={{fontSize: 150, fontWeight: 700}} />
          <div style={{fontFamily: fonts.body, fontSize: 34, color: colors.textMuted, marginTop: 6}}>{stats.workforce.label}</div>
          <svg width={cols * 18} height={rows * 18} style={{marginTop: 46}}>
            {Array.from({length: cols * rows}).map((_, i) => (
              <circle key={i} cx={(i % cols) * 18 + 7} cy={Math.floor(i / cols) * 18 + 7} r={5} fill={i < filled ? colors.accent : withAlpha(colors.text, 0.08)} />
            ))}
          </svg>
          <div style={{fontFamily: fonts.mono, fontSize: 18, color: colors.textMuted, marginTop: 14, letterSpacing: '0.1em'}}>EACH DOT ≈ 1,000 PEOPLE</div>
          <SourceLine k={stats.workforce.source} style={{marginTop: 18}} a={tween(frame, start + 30, start + 50)} />
        </div>
        {frame >= costAt - 2 ? (
          <div style={{position: 'absolute', left: 1130, top: 240, opacity: costIn, transform: `translateY(${(1 - costIn) * 40}px)`}}>
            <AnimatedCounter
              value={stats.cost.value}
              decimals={stats.cost.decimals}
              prefix={stats.cost.prefix}
              suffix={stats.cost.suffix}
              start={costAt}
              duration={sec(2.4, fps)}
              style={{fontSize: 150, fontWeight: 700, color: colors.accent}}
            />
            <div style={{fontFamily: fonts.body, fontSize: 34, color: colors.textMuted, marginTop: 6, maxWidth: 640, lineHeight: 1.35}}>{stats.cost.label}</div>
            <SourceLine k={stats.cost.source} style={{marginTop: 26, maxWidth: 640}} a={tween(frame, costAt + 30, costAt + 50)} />
          </div>
        ) : null}
      </Layer>
    </Camera>
  );
};

const BudgetBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const peakIdx = budgetShare.data.findIndex((d) => d.label === '1966');
  const W = 1300;
  const H = 470;
  const slot = W / budgetShare.data.length;
  const peak = budgetShare.data[peakIdx];
  const annotIn = tween(frame, 80, 100);
  return (
    <Camera keys={[{frame: 0, scale: 0.98}, {frame: durationInFrames, scale: 1.04, y: -10}]}>
      <Layer depth={1}>
        <div style={{position: 'absolute', left: 300, top: 170}}>
          <KineticText text={budgetShare.title} start={8} style={{fontSize: 58, fontWeight: 700}} />
          <div style={{position: 'relative', marginTop: 70, marginLeft: 40}}>
            <BarChart data={budgetShare.data} width={W} height={H} start={14} unit="%" maxValue={5} gridStep={1} decimals={2} highlightIndex={peakIdx} />
            <div
              style={{
                position: 'absolute',
                left: peakIdx * slot + slot / 2 + 50,
                top: H - 70 - (peak.value / 5) * (H - 70) - 20,
                opacity: annotIn,
                fontFamily: fonts.body,
                fontSize: 26,
                color: colors.text,
                width: 360,
                borderLeft: `2px solid ${colors.accent}`,
                paddingLeft: 16,
              }}
            >
              Peak: 4.41% of federal outlays in 1966
            </div>
          </div>
          <SourceLine k={budgetShare.source} style={{marginTop: 26}} a={tween(frame, 40, 60)} />
        </div>
      </Layer>
    </Camera>
  );
};

const ComputerBeat: React.FC<{surfaceAt: number}> = ({surfaceAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cols = 64;
  const rows = 32;
  const cell = 9;
  const filled = Math.floor(tween(frame, 18, 18 + sec(3, fps), 0, cols * rows, ease.inOut));
  const surfIn = springIn(frame, fps, surfaceAt);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: safe.x, top: 200}}>
        <Eyebrow text="Apollo Guidance Computer" start={10} color={colors.accent2} />
        <div style={{marginTop: 20}}>
          <AnimatedCounter value={stats.agcMemory.value} start={18} duration={sec(3, fps)} style={{fontSize: 120, fontWeight: 700}} />
        </div>
        <div style={{fontFamily: fonts.body, fontSize: 32, color: colors.textMuted, marginTop: 4, maxWidth: 760}}>{stats.agcMemory.label}</div>
        <svg width={cols * cell} height={rows * cell} style={{marginTop: 36}}>
          {Array.from({length: cols * rows}).map((_, i) => (
            <rect
              key={i}
              x={(i % cols) * cell}
              y={Math.floor(i / cols) * cell}
              width={cell - 3}
              height={cell - 3}
              fill={i < filled ? colors.accent2 : withAlpha(colors.text, 0.06)}
              opacity={i < filled ? 0.55 + ((i * 7) % 10) / 22 : 1}
            />
          ))}
        </svg>
        <div style={{fontFamily: fonts.mono, fontSize: 18, color: colors.textMuted, marginTop: 12, letterSpacing: '0.1em'}}>EACH SQUARE = ONE 16-BIT WORD</div>
        <SourceLine k={stats.agcMemory.source} style={{marginTop: 14}} a={tween(frame, 40, 60)} />
      </div>
      {frame >= surfaceAt - 2 ? (
        <div style={{position: 'absolute', right: safe.x, top: 260, width: 560, opacity: surfIn, transform: `translateX(${(1 - surfIn) * 40}px)`}}>
          <Eyebrow text="On the surface" start={surfaceAt} />
          <div style={{fontFamily: fonts.mono, fontWeight: 700, fontSize: 110, color: colors.text, marginTop: 20}}>{stats.eva.display}</div>
          <div style={{fontFamily: fonts.body, fontSize: 28, color: colors.textMuted}}>{stats.eva.label}</div>
          <div style={{marginTop: 50}}>
            <AnimatedCounter value={stats.samples.value} decimals={stats.samples.decimals} suffix={stats.samples.suffix} start={surfaceAt + 12} duration={40} style={{fontSize: 110, fontWeight: 700, color: colors.accent}} />
          </div>
          <div style={{fontFamily: fonts.body, fontSize: 28, color: colors.textMuted}}>{stats.samples.label}</div>
          <SourceLine k={stats.samples.source} style={{marginTop: 20}} a={tween(frame, surfaceAt + 30, surfaceAt + 50)} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
