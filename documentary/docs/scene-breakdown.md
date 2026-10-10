# Scene breakdown — *The Eight Days*

Direction document for each scene. Frames are absolute on the master timeline
(30 fps). Narration text and cue timings live in
`src/config/documentaryConfig.ts`; this document describes the intent.

Palette: background `#06070a`, warm white `#f2ede4`, **Apollo gold** `#e8a33d`
(emphasis), **Earth blue** `#6fa8dc` (Earth, data, trajectories). Alert red
`#e5484d` is used only for danger: alarms, Apollo 1, loss of signal.
Type: Playfair Display (headlines and quotes), Inter (body and subtitles),
JetBrains Mono (dates, data, labels).

---

### 1 · Cold open — the hook · frames 0–719 (24 s)
- **Purpose:** drop the viewer into the most tense moment, the landing alarms, before giving any context.
- **Narration (on-screen kinetic type):** "July 20, 1969." · "Two men are falling toward the Moon." · "Alarms are sounding. The computer is overloaded." · "The world is listening."
- **Visual:** black fades into two parallax star layers, and a large procedural Moon rises in on the right. A red alarm wash pulses during line 3.
- **Typography:** the date types on character by character in mono; the lines rise word by word from masks in the serif; key words take the accent colour (Moon in gold, Alarms in red).
- **Camera:** a continuous slow push-in from 1.00 to 1.30 with a drift to the left; stars at depth 0.15 and 0.4, the Moon at 1.0, dust at 1.4.
- **Title (18.2 s):** THE EIGHT DAYS. Letters resolve from blur with a staggered spring, a gold rule draws out from the centre, then the subtitle appears in mono. A light leak blooms behind it.
- **Out:** light-leak transition (30 f).
- **Sound:** low rumble from 0 s, alarm beeps at 11 s, riser into an impact on the title.
- **Assets:** `openingMoon` (optional).

### 2 · Introduction — the crew · 690–1469 (26 s)
- **Purpose:** what Apollo 11 was, and the three people the story follows.
- **Visual:** an Earth limb glows at the bottom of frame. "Prologue · July 1969" / **Apollo 11** headline. Three portrait cards then arrive one by one, each with its role (mono), name (serif) and a one-line detail. The active card lifts and glows gold.
- **Bridge:** a ghosted **1957** fades up behind the last line and match-cuts into the timeline.
- **Camera:** a slow lateral drift (x +40 → −40) with a scale-in.
- **Out:** dip to black (24 f).
- **Sound:** a Quindar-style beep as each crew member is named.
- **Assets:** `crewArmstrong`, `crewAldrin`, `crewCollins` (helmet-silhouette fallbacks until then).

### 3 · Chapter One — The Race · 1446–2645 (40 s)
- **Purpose:** historical context, from Sputnik to Apollo 8, and the political deadline.
- **Visual:** a chapter card, then a horizontal timeline with seven events (1957 Sputnik → 1968 Apollo 8). Each node lights up as the narration names it; the progress line glows gold. A ghosted year number sits opposite each label.
- **Kennedy beat (27–33 s):** the frame dims to a full-screen pull-quote from the Rice University speech, with the attribution and date.
- **Apollo 1 beat:** a red vignette for the tragedy, then relief as Apollo 8 lights up and a small Moon rises top right.
- **Camera:** whips (an ease-in-out move over about 26 frames) from node to node.
- **Out:** whip pan with motion blur (18 f) and a whoosh.

### 4 · Chapter Two — The Machine · 2628–3527 (30 s)
- **Beat A (0–14 s):** a Saturn V drawn to scale in metres on a blueprint grid. The outline draws on, then the paint fades in. The height counter runs to **110.6 m**. Six callouts walk the stack from the escape tower to the S-IC, each highlighting its section. The thrust figure **7.5M lbf** counts up.
- **Beat B (14–19.6 s):** launch from LC-39A. Morning sky, ignition, smoke and liftoff. The rocket accelerates out of frame while the sky fades to space. A T-minus/plus clock runs, with a lower third: *Launch Complex 39A · Kennedy Space Center · July 16, 1969 · 9:32 a.m. EDT*.
- **Beat C (19.6–30 s):** orbit diagram. The spacecraft makes 1.5 orbits of Earth (T+ 00:11:42 orbit insertion), then spirals out at translunar injection (T+ 02:44:16).
- **Camera:** a slow pull-back on the blueprint; on the launch, the camera "tilts" as the scene drops away and scales up.
- **Out:** zoom-through (22 f) and a whoosh.
- **Sound:** an impact on the chapter card, rumble on ignition.
- **Assets:** `launchFootage` (replaces the procedural launch beat).

### 5 · The Journey · 3506–4285 (26 s)
- **Beat A:** a schematic orthographic globe (graticule) rotates to Florida. A crosshair marks **Kennedy Space Center 28.57° N · 80.65° W**, and an arc departs into space. Readouts show **384,400 km** (average Earth–Moon distance) and **≈ 3 days**.
- **Beat B:** a schematic trajectory, labelled *not to scale*. The outbound coast draws on; lunar orbit insertion on July 19; Eagle separates and lands on the near side; Columbia keeps orbiting. On the far side the orbit passes through a red "NO SIGNAL" arc, and the dashed return path ends at splashdown on July 24.
- **Camera:** a slow push from Earth toward the Moon.
- **Out:** blur dissolve (24 f).

### 6 · Chapter Three — The Descent (turning point) · 4262–5461 (40 s)
- **Beat A (instruments):** a HUD frame. The altitude unwinds from 50,000 ft, a time-compressed mission clock runs (PDI 102:33:05 → touchdown 102:45:40, labelled as compressed), and a descent-profile chart draws with the LM riding the curve. **PROGRAM ALARM 1202**, then 1201, flash red with a red edge wash. "Houston: abort or continue?" A gold **GO** stamp springs in.
- **Beat B (surface):** low lunar horizon with Earth in the sky. Eagle flies past a boulder-filled crater (label: *P66 · semi-manual control*) and settles; dust lifts at touchdown. Then the date and time *July 20, 1969 · 20:17:40 UTC*, the quote card *"Houston, Tranquility Base here. The Eagle has landed."*, and a lower third *Tranquility Base 0.674° N · 23.473° E*.
- **Beat C (first step):** near-silence, Earth over the horizon, boot prints appearing one by one. *02:56 UTC · July 21, 1969*, followed by the quote *"That's one small step for [a] man…"* with the note on the intended "a".
- **Out:** iris (26 f) and a soft impact.
- **Assets:** `landingSurface`, `firstStep`.

### 7 · By the Numbers (evidence) · 5436–6395 (32 s)
- **Beat A:** **~400,000** people, as a 400-dot grid where each dot is about 1,000 people. **$25.4B** programme cost (1973 report, then-year dollars).
- **Beat B:** a bar chart of NASA's share of federal outlays, 1960–1970. The bars grow on staggered springs; the 1966 bar (4.41%) is highlighted in gold with an annotation.
- **Beat C:** **2,048** words of AGC erasable memory, as a grid of 2,048 squares that fills up. On the surface: **2 h 31 m** EVA and **21.5 kg** of samples.
- Every figure carries a mono source line.
- **Out:** diagonal shape wipe with a gold edge (24 f) and a whoosh.

### 8 · Chapter Four — The Legacy (analysis) · 6372–7271 (30 s)
- **Beat A:** counters for **6** crewed landings and **12** moonwalkers, over a strip of seven mission cards (Apollo 11–17). Apollo 13 is marked in red: *Aborted — crew returned safely*.
- **Beat B:** **382 kg** of lunar samples with a slowly rotating Moon, then a schematic giant-impact illustration: "the samples are key evidence for the leading theory of how the Moon formed."
- **Beat C:** a single line drawn from *Dec 14, 1972 — Apollo 17 leaves the Moon* toward a gold "?".
- **Out:** crossfade (30 f).

### 9 · Conclusion — who goes next · 7242–8081 (28 s)
- **Beat A:** **8 days · 3 hours · 18 minutes** counted up over a rising Moon.
- **Beat B:** the plaque from Eagle's descent stage in brushed steel, with the two-hemisphere globes, the inscription revealed line by line, the signatory names and a moving sheen.
- **Beat C:** a camera dolly across a trail of boot prints. "No wind. No rain. / Nothing to erase them."
- **Beat D:** Earth and Moon. "NASA · Artemis programme — The return." Then **Who goes next?** with a gold glow and a light leak, and the title lockup.
- **Out:** dip to black (30 f).
- **Sound:** riser into a final impact.

### 10 · Sources & credits · 8052–8411 (12 s)
- Every source in `content.ts → sources`, laid out in two columns. Production notes say the graphics are schematic and the audio is placeholder.
