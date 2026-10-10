/**
 * Replaceable media slots.
 *
 * Every slot starts as `src: null`. When a slot is empty the documentary uses
 * an original motion-graphic fallback, so nothing is ever blank on screen.
 *
 * To use real footage or photos:
 *   1. Put the file in /public (e.g. public/images/crew-armstrong.jpg)
 *   2. Set `src` to the path relative to /public ('images/crew-armstrong.jpg')
 *   3. Optionally tune `focus` (CSS object-position) for cropping.
 *
 * Videos (.mp4/.webm/.mov) are rendered muted with <OffthreadVideo>.
 * The `suggestion` field lists public-domain NASA material that fits — check
 * the licence/credit requirements of whatever you use.
 */

export type AssetSlot = {
  src: string | null;
  description: string;
  suggestion: string;
  focus?: string;
};

export const assets = {
  openingMoon: {
    src: null,
    description: 'Opening hero: close-up of the lunar surface or a full Moon.',
    suggestion: 'NASA LRO mosaics or Apollo 11 Hasselblad frames (images.nasa.gov).',
  },
  crewArmstrong: {
    src: null,
    description: 'Portrait of Neil Armstrong (vertical crop works best).',
    suggestion: 'Apollo 11 official crew portrait, NASA photo S69-31740 (crop).',
    focus: '50% 30%',
  },
  crewAldrin: {
    src: null,
    description: 'Portrait of Buzz Aldrin.',
    suggestion: 'Apollo 11 official crew portrait, NASA photo S69-31740 (crop).',
    focus: '50% 30%',
  },
  crewCollins: {
    src: null,
    description: 'Portrait of Michael Collins.',
    suggestion: 'Apollo 11 official crew portrait, NASA photo S69-31740 (crop).',
    focus: '50% 30%',
  },
  launchFootage: {
    src: null,
    description: 'Saturn V launch footage (plays behind the launch beat of the Machine scene).',
    suggestion: 'NASA Apollo 11 launch film (public domain) — trim to ~12 s.',
  },
  landingSurface: {
    src: null,
    description: 'Lunar surface during the landing beat of the Descent scene.',
    suggestion: '16mm descent camera footage from Eagle (NASA).',
  },
  firstStep: {
    src: null,
    description: 'Still for the first-step quote.',
    suggestion: 'NASA photo AS11-40-5903 (Aldrin on the surface).',
  },
} satisfies Record<string, AssetSlot>;

export type AssetKey = keyof typeof assets;
