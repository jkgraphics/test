import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
// Self-hosted fonts via @fontsource (bundled by Remotion's webpack). No network needed at render time.
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/500-italic.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

const FACES = [
  '500 48px "Playfair Display"',
  'italic 500 48px "Playfair Display"',
  '700 48px "Playfair Display"',
  '800 48px "Playfair Display"',
  '400 48px Inter',
  '500 48px Inter',
  '700 48px Inter',
  '400 48px "JetBrains Mono"',
  '700 48px "JetBrains Mono"',
];

/** Blocks rendering until every font face is loaded so no frame uses a fallback font. */
export const FontLoader: React.FC = () => {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all(FACES.map((f) => document.fonts.load(f)))
      .catch((err) => console.warn('Font loading failed, falling back to system fonts', err))
      .finally(() => continueRender(handle));
  }, [handle]);
  return null;
};
