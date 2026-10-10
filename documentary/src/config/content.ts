/**
 * Factual content for every scene. Each fact carries a `source` key that maps
 * to `sources` at the bottom of this file, so claims stay traceable.
 *
 * Items marked `verify: true` are correct to the best of our research but
 * should be re-checked against the primary source before publication.
 */

export type SourceKey = keyof typeof sources;

export const opening = {
  date: 'JULY 20, 1969',
  lines: [
    'July 20, 1969.',
    'Two men are falling toward the Moon.',
    'Alarms are sounding. The computer is overloaded.',
    'The world is listening.',
  ],
};

export const crew = [
  {
    name: 'Neil A. Armstrong',
    role: 'Commander',
    detail: 'Former test pilot · First person to walk on the Moon',
    assetKey: 'crewArmstrong',
    source: 'nasaApollo11',
  },
  {
    name: 'Edwin “Buzz” Aldrin',
    role: 'Lunar Module Pilot',
    detail: 'Flew with Armstrong in Eagle',
    assetKey: 'crewAldrin',
    source: 'nasaApollo11',
  },
  {
    name: 'Michael Collins',
    role: 'Command Module Pilot',
    detail: 'Remained in lunar orbit aboard Columbia',
    assetKey: 'crewCollins',
    source: 'nasaApollo11',
  },
] as const;

export const timeline = [
  {date: 'OCT 4, 1957', year: '1957', title: 'Sputnik 1', body: 'The Soviet Union launches the first artificial satellite.', source: 'nasaSputnik'},
  {date: 'APR 12, 1961', year: '1961', title: 'Yuri Gagarin', body: 'First human in space, aboard Vostok 1.', source: 'nasaGagarin'},
  {date: 'MAY 5, 1961', year: '1961', title: 'Alan Shepard', body: 'First American in space, aboard Freedom 7.', source: 'nasaShepard'},
  {date: 'MAY 25, 1961', year: '1961', title: 'The Promise', body: 'Kennedy asks Congress to land a man on the Moon before the decade is out.', source: 'jfkCongress'},
  {date: 'SEP 12, 1962', year: '1962', title: 'Rice University', body: '“We choose to go to the Moon.”', source: 'jfkRice'},
  {date: 'JAN 27, 1967', year: '1967', title: 'Apollo 1', body: 'A cabin fire kills Grissom, White and Chaffee during a launch rehearsal.', source: 'nasaApollo1', tone: 'alert'},
  {date: 'DEC 24, 1968', year: '1968', title: 'Apollo 8', body: 'First humans to orbit the Moon.', source: 'nasaApollo8'},
] as const;

export const kennedyQuote = {
  text: 'We choose to go to the Moon in this decade and do the other things, not because they are easy, but because they are hard.',
  attribution: 'John F. Kennedy',
  context: 'Rice University, Houston · September 12, 1962',
  source: 'jfkRice',
};

export const saturnV = {
  heightM: 110.6,
  heightFt: 363,
  thrustLbf: '7.5 million lbf',
  engines: 'Five F-1 engines (first stage)',
  stages: [
    {id: 'les', label: 'Launch Escape System', detail: 'Pulls the crew clear in an abort'},
    {id: 'csm', label: 'Command & Service Module', detail: 'Columbia — crew cabin and main engine'},
    {id: 'lm', label: 'Lunar Module', detail: 'Eagle — housed below the CSM'},
    {id: 'ivb', label: 'S-IVB · Third Stage', detail: 'One J-2 engine · fires twice'},
    {id: 'ii', label: 'S-II · Second Stage', detail: 'Five J-2 engines'},
    {id: 'ic', label: 'S-IC · First Stage', detail: 'Five F-1 engines'},
  ],
  launch: {
    local: 'JULY 16, 1969 · 9:32 A.M. EDT',
    utc: '13:32 UTC',
    site: 'Launch Complex 39A',
    place: 'Kennedy Space Center, Florida',
  },
  source: 'nasaSaturnV',
};

export const geo = {
  ksc: {lat: 28.57, lon: -80.65, label: 'Kennedy Space Center', coords: '28.57° N · 80.65° W'},
  splashdown: {lat: 13.32, lon: -169.15, label: 'Splashdown · Pacific Ocean', coords: '13°19′ N · 169°09′ W'},
  tranquility: {lat: 0.674, lon: 23.473, label: 'Tranquility Base', coords: '0.674° N · 23.473° E'},
};

export const journey = {
  earthMoonKm: 384400,
  milestones: [
    {id: 'launch', label: 'Launch', when: 'JUL 16 · 13:32 UTC'},
    {id: 'loi', label: 'Lunar orbit insertion', when: 'JUL 19 · 17:21 UTC'},
    {id: 'landing', label: 'Eagle lands', when: 'JUL 20 · 20:17 UTC'},
    {id: 'splashdown', label: 'Splashdown', when: 'JUL 24 · 16:50 UTC'},
  ],
  source: 'nasaApollo11Timeline',
};

export const descent = {
  startAltitudeFt: 50000,
  alarms: ['1202', '1201'],
  landingUtc: '20:17:40 UTC',
  landingDate: 'JULY 20, 1969',
  landingQuote: 'Houston, Tranquility Base here. The Eagle has landed.',
  firstStepUtc: '02:56 UTC · JULY 21, 1969',
  firstStepQuote: 'That’s one small step for [a] man, one giant leap for mankind.',
  quoteNote: 'Armstrong later said he intended to say “a man.”',
  source: 'nasaApollo11Journal',
};

export const stats = {
  workforce: {value: 400000, prefix: '~', suffix: '', label: 'people worked on Apollo at its peak', source: 'nasaWorkforce'},
  cost: {value: 25.4, prefix: '$', suffix: 'B', decimals: 1, label: 'programme cost reported to Congress, 1973 (then-year dollars)', source: 'nasaCost'},
  agcMemory: {value: 2048, prefix: '', suffix: '', label: 'words of erasable memory in the Apollo Guidance Computer', source: 'nasaAGC'},
  eva: {display: '2 h 31 m', label: 'Apollo 11 moonwalk (EVA) duration', source: 'nasaApollo11'},
  samples: {value: 21.5, prefix: '', suffix: ' kg', decimals: 1, label: 'of lunar samples returned by Apollo 11', source: 'nasaApollo11'},
} as const;

/**
 * NASA budget as a share of total US federal outlays, 1960–1970.
 * Source: OMB historical tables as compiled in "Budget of NASA". verify: true
 */
export const budgetShare = {
  title: 'NASA budget as a share of federal spending',
  unit: '%',
  verify: true,
  source: 'nasaBudget',
  data: [
    {label: '1960', value: 0.5},
    {label: '1961', value: 0.9},
    {label: '1962', value: 1.18},
    {label: '1963', value: 2.29},
    {label: '1964', value: 3.52},
    {label: '1965', value: 4.31},
    {label: '1966', value: 4.41},
    {label: '1967', value: 3.45},
    {label: '1968', value: 2.65},
    {label: '1969', value: 2.31},
    {label: '1970', value: 1.92},
  ],
} as const;

export const landings = [
  {mission: 'Apollo 11', date: 'JUL 1969', site: 'Sea of Tranquility', landed: true},
  {mission: 'Apollo 12', date: 'NOV 1969', site: 'Ocean of Storms', landed: true},
  {mission: 'Apollo 13', date: 'APR 1970', site: 'Aborted — crew returned safely', landed: false},
  {mission: 'Apollo 14', date: 'FEB 1971', site: 'Fra Mauro', landed: true},
  {mission: 'Apollo 15', date: 'JUL 1971', site: 'Hadley–Apennine', landed: true},
  {mission: 'Apollo 16', date: 'APR 1972', site: 'Descartes Highlands', landed: true},
  {mission: 'Apollo 17', date: 'DEC 1972', site: 'Taurus–Littrow', landed: true},
] as const;

export const legacy = {
  moonwalkers: 12,
  landings: 6,
  samplesKg: 382,
  lastSurfaceDate: 'DEC 14, 1972',
  /** "As of writing" claim — re-check before publishing. verify: true */
  gapNote: 'No human has stood on the Moon since',
  source: 'nasaApolloProgram',
};

export const conclusion = {
  missionDuration: '8 days · 3 hours · 18 minutes',
  plaque:
    'Here men from the planet Earth first set foot upon the Moon, July 1969 A.D. We came in peace for all mankind.',
  finalLine: 'Who goes next?',
  source: 'nasaApollo11',
};

/** Every source cited on screen in the credits scene. */
export const sources = {
  nasaApollo11: {title: 'Apollo 11 Mission Overview', publisher: 'NASA', url: 'https://www.nasa.gov/mission/apollo-11/'},
  nasaApollo11Timeline: {title: 'Apollo 11 Timeline', publisher: 'NASA History Office', url: 'https://history.nasa.gov/SP-4029/Apollo_11i_Timeline.htm'},
  nasaApollo11Journal: {title: 'Apollo 11 Lunar Surface Journal', publisher: 'NASA', url: 'https://www.nasa.gov/history/alsj/a11/'},
  nasaSaturnV: {title: 'Saturn V', publisher: 'NASA Marshall Space Flight Center', url: 'https://www.nasa.gov/marshall/history/'},
  nasaSputnik: {title: 'Sputnik and the Origins of the Space Age', publisher: 'NASA History Office', url: 'https://history.nasa.gov/sputnik/'},
  nasaGagarin: {title: 'Yuri Gagarin: First Man in Space', publisher: 'NASA', url: 'https://www.nasa.gov/history/'},
  nasaShepard: {title: 'Mercury-Redstone 3 (Freedom 7)', publisher: 'NASA', url: 'https://www.nasa.gov/history/'},
  jfkCongress: {title: 'Special Message to Congress on Urgent National Needs, 25 May 1961', publisher: 'JFK Presidential Library', url: 'https://www.jfklibrary.org/'},
  jfkRice: {title: 'Address at Rice University on the Nation’s Space Effort, 12 Sep 1962', publisher: 'JFK Presidential Library', url: 'https://www.jfklibrary.org/'},
  nasaApollo1: {title: 'Apollo 1', publisher: 'NASA', url: 'https://www.nasa.gov/mission/apollo-1/'},
  nasaApollo8: {title: 'Apollo 8', publisher: 'NASA', url: 'https://www.nasa.gov/mission/apollo-8/'},
  nasaWorkforce: {title: 'Apollo program workforce figures', publisher: 'NASA', url: 'https://www.nasa.gov/history/'},
  nasaCost: {title: 'Apollo Program Summary Report / 1973 NASA budget testimony', publisher: 'NASA', url: 'https://history.nasa.gov/'},
  nasaAGC: {title: 'Apollo Guidance Computer', publisher: 'NASA / MIT Instrumentation Laboratory', url: 'https://www.nasa.gov/history/'},
  nasaBudget: {title: 'Budget of NASA — OMB historical tables (verify)', publisher: 'U.S. OMB / NASA', url: 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/'},
  nasaApolloProgram: {title: 'The Apollo Program', publisher: 'NASA', url: 'https://www.nasa.gov/the-apollo-program/'},
} as const;
