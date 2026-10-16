# DCATS — Demo Video Script & Production Guide
## SIH26247 | Target Duration: 2:30–3:00 minutes

---

## Production Overview

| Item | Recommendation |
|---|---|
| Duration | 2:30 – 3:00 min (SIH judges watch many; keep tight) |
| Format | 1920×1080 MP4, 30fps |
| Screen Recorder | OBS Studio (free) or ShareX |
| Voiceover | Male/female voice recorded separately, merged in DaVinci Resolve (free) |
| Background Music | Subtle cinematic underscore; duck to 10–15% under voiceover |
| Captions | Add auto-captions in CapCut or DaVinci for accessibility |
| Opening Graphic | 3-second title card: white shield mark on deep navy, SIH26247 badge |
| Closing Graphic | Team name, institute, "Made for Smart India Hackathon 2026" |

**Visual identity note:** the simulator is now a full-dark operator console (near-black chrome, square instrument panels, mono data type, cyan/amber/red status cues, zulu clock strip), while the landing, performance dashboard and instructor pages stay light (neutral grey page, white cards, navy accent `#1B4E8F`). Keep the video consistent with that: dark console footage for the training beats, light pages for briefing and review — no glow effects or neon beyond the console's own status colours. Use the shield mark from `public/favicon.svg` as the logo — do not typeset a new one.

---

## Full Voiceover Script

*(Read at ~130 words/min. Pause markers shown as [PAUSE])*

---

### SEGMENT 1 — Hook (0:00–0:20)
**[Show: Deep-navy card, white shield mark, radar sweep animating (can be cut from the landing page radar graphic) → DCATS title card]**

> "Drone swarms have changed modern warfare.
> But training soldiers to fight them? Still stuck in classrooms.
> DCATS changes that — a fully offline, AI-powered simulation trainer that puts operators in the fight from day one.
> Built for Smart India Hackathon 2026, Problem Statement SIH26247."

[PAUSE — cut to app loading]

---

### SEGMENT 2 — The Problem (0:20–0:40)
**[Show: Text overlay with problem statement bullet points, royalty-free drone-swarm footage if available]**

> "The Indian Army needs soldiers who can detect, independently classify, and safely respond to drone threats — solo or in swarms — across day, night, urban, and degraded environments.
> Current training relies on costly live-fire drills.
> DCATS replaces that with an unlimited, zero-cost simulator that runs on any laptop — no cloud, no installation required."

---

### SEGMENT 3 — Landing Page / Mission Brief (0:40–0:55)
**[Show: Screen recording — landing hero (SIH badge, hero stats: 6 threat types, 8 scenario packs, ONNX in-browser, zero cloud), then the scenario grid]**

> "Launch DCATS in the browser — or as an installed desktop app.
> Eight scenario packs, from basic reconnaissance to a twenty-node swarm assault, plus a procedural generator that randomises terrain, conditions and threats.
> Select Night Swarm Assault — Pack 3, urban terrain, night, difficulty 4 of 5.
> Just hit Start Training."

---

### SEGMENT 4 — 3D Simulator (0:55–1:33)
**[Show: Screen recording — 3D battlefield loads (dark viewport, city skyline with lit windows, moon and mountains, radar sweep), eight swarm nodes moving as a flock with flight trails]**

> "The 3D battlefield renders in real time — terrain, skyline, lighting and radar sweep, all in the browser.
> Watch — eight swarm nodes converge as a coordinated flock. The movement is Boids-based, so no two runs play out the same way."

[PAUSE — optional: switch to RADAR for two seconds, then back to the EO/IR FEED (or drag the feed once to orbit it)]

**[Show: 8-second quick cut — Mission Brief → Basic Reconnaissance (Mission 01, rural terrain, daylight): green fields, conifer treeline, two scout drones crossing, sun glow]**

> "Every scenario builds its own battlefield. Rural terrain at noon — two scouts on reconnaissance.
> Same engine, completely different fight."

[PAUSE — cut back to the night swarm mission]

**[Show: Operator clicks a detected contact in the TRACK DATABASE; the AI ASSESSMENT AID populates]**

> "Click a detected contact. The in-browser AI aid weighs speed, radar cross-section, altitude and trajectory.
> It returns a recommendation — SWARM NODE — with a confidence value and the inference mode on screen. The operator still makes the final call."

*(Read the confidence value actually on screen; it varies per run.)*

[PAUSE]

**[Show: Operator presses T, C, A, E in sequence; key badges highlight, event log fills, score updates]**

> "Acquire. Run the AI assessment. Accept the advisory — or submit your own call. Alert the team. Engage.
> Behind it, a weighted scoring engine grades the operator live — detection speed, independent classification accuracy, engagement quality, and wrongful-engagement avoidance, weighted 25, 30, 25 and 20."

---

### SEGMENT 5 — Sensor Degradation (1:33–1:48)
**[Show: Instructor console → select Degraded Operations → drag SNR to 30% and dropout to 20% → Launch Training Session → back on the console, contacts drop out for seconds at a time and flag SIGNAL LOST — reacquisition, not magic]**

> "Instructors can dial in the chaos before a run.
> Degraded Operations — forest terrain, dusk, electronic jamming.
> Drop the Signal-to-Noise Ratio to 30 percent, raise the dropout rate to 20 percent, and launch.
> Now the operator is fighting the environment as well as the threat — contacts drop off the board for seconds at a time and the console flags the signal loss."

---

### SEGMENT 6 — AAR Dashboard (1:48–2:13)
**[Show: End Exercise → View After-Action Review → AAR opens: score and grade badge, eight summary cards, then the charts]**

> "Exercise complete.
> The After-Action Review opens with the score and grade, then breaks the mission down:
> score over time, a performance radar, threat composition, detection time for every track, and a classification results table showing exactly which calls were right and which were wrong."

[PAUSE — scroll to Recommendations, then the event timeline]

> "Then it closes the loop with specific recommendations — for example: 'Classification accuracy is low — study RCS and speed patterns in the Threat Encyclopedia.'
> The full event timeline records every operator action, timestamps, missed outcomes and whether the AI cue was accepted or overridden.
> Every detailed session is archived locally and can be exported as JSON, so nothing leaves the machine unless the instructor explicitly transfers it."

[PAUSE]

**[Show: Instructor panel → Local Session History tab — archived sessions with scores and trends]**

> "Instructors also get local session history — every completed run, archived automatically with its score, grade, sensor conditions and detailed decision record."

---

### SEGMENT 7 — Offline & Deployment (2:13–2:28)
**[Show: DevTools → Network tab → Offline → refresh → app still loads and runs a mission]**

> "After the first online warm-up, turn the internet off entirely, then close and reopen.
> DCATS still works — fully.
> As a Progressive Web App it caches its runtime and model and stores all session data on the device.
> The same build ships as a standalone Windows desktop application for locked-down machines.
> Perfect for forward operating bases. No cloud. No dependency. No failure point."

---

### SEGMENT 8 — Close (2:28–2:53)
**[Show: Split-screen montage — 3D battlefield / AAR charts / Instructor console / Radar / shield logo]**

> "DCATS — Drone Countermeasure and Assessment Training System.
> Explainable AI on the edge. Measurable training value. Zero specialised hardware.
> Runs on a modern WebGL laptop, works in an air-gapped environment, and gives personnel repeatable decision practice.
> Team [Your Team Name], [Your College], Smart India Hackathon 2026.
> Jai Hind."

**[Show: End card — Team name, institute, SIH badge, shield logo]**

---

## Shot-by-Shot Production Checklist

### Pre-Recording Setup
- [ ] Build and serve the production app: `npm run build` then `npm run preview` — open it, press **Ctrl+R once** (the service worker updates to the latest build), then run **one mission**: that caches the shell **and the AI model**, so the offline shot (including offline ONNX inference) works. Use the same browser for rehearsal and recording
- [ ] **Pre-seed the session-history shot:** before recording, run 2–3 quick missions in that browser (launch → End Exercise straight away) so the Local Session History tab has archived sessions to show
- [ ] Train the ONNX model before recording: `cd backend && pip install -r requirements.txt && python model/train_model.py`, then restart the server. Confirm the AI aid shows `MODEL · ONNX IN-BROWSER` on its mode line
- [ ] If the model is not trained, the mode line honestly reads `MODEL · BUILT-IN CLASSIFIER` — in that case say "built-in classifier" in the narration and do not claim ONNX on screen
- [ ] Desktop clip: install `release/DCATS-Setup-1.0.0.exe` **before** recording (Windows SmartScreen: "More info" → "Run anyway" — never on camera). Record the installed DCATS app; `npx electron .` runs the same build without installing. The AI aid shows the same `MODEL · ONNX IN-BROWSER` mode line in the desktop app
- [ ] Set display resolution to 1920×1080, browser zoom to 100%
- [ ] Light OS theme; the simulator console is full-dark by design (night-ops console) while the landing and review pages stay light — that contrast is the look
- [ ] Hide bookmarks bar; clear personal data from the browser
- [ ] Start OBS: record desktop + microphone on separate tracks
- [ ] Rehearse the full flow at least 3 times before the final take
- [ ] *(18 Oct)* The full click-path was rehearsed headless on the production build — landing → start exercise → radar toggle → contact select → advisory (accept or override) → T/C/A/E → sitrep log → AAR → degraded instructor run → session archive (real, exportable) → offline reload. All steps pass, zero console errors. A forced-failure drill (WebGL off + crashed view) also passes: auto Radar View fallback, error boundary catch, navigation recovery. The operator-console restyle was re-verified headless on this build (hold-sampled sensor model, selection survives dropouts, console labels updated end-to-end); **regenerate the installer from this build before the desktop clip** (`npm run electron:build`)

### Screen Recording Segments to Capture
- [ ] Landing: hero stats visible, hover Night Swarm Assault (Mission 03), click Start Training
- [ ] 3D battlefield: flock of eight swarm nodes moving together; toggle to RADAR and back
- [ ] Optional (recommended): drag the 3D view once on camera — orbit and a scroll-zoom over the city — then let the auto-orbit take back over (shows the battlefield is fully navigable)
- [ ] Day/rural beat: from Mission Brief, launch Basic Reconnaissance (Mission 01, rural, day) → capture ~8 s of the two scouts over the green terrain → End Exercise (quick cut in Segment 4)
- [ ] Click a detected contact → the AI aid opens (mode line visible: MODE · ONNX IN-BROWSER or BUILT-IN CLASSIFIER)
- [ ] Press T, C, A, E in sequence — sitrep log fills with zulu-stamped entries, live score climbs (E clears the selection and hides the aid/action panels — capture the advisory close-up before pressing E)
- [ ] Instructor console: select Degraded Operations, drag SNR to 30%, dropout to 20%, Launch Training Session
- [ ] Console under degradation: contacts drop off the radar and track list for seconds at a time (SIGNAL LOST rows), then reacquire
- [ ] End Exercise → View After-Action Review → AAR: score and grade, summary cards, scroll all five charts, the classification results table, recommendations, full event timeline
- [ ] Instructor console: Local Session History tab — archived sessions with score, grade and trend delta (pre-seeded above)
- [ ] DevTools: Network → Offline → refresh → app loads and runs offline *(Electron pass: turn Wi-Fi off from the tray, close and reopen the app — no DevTools; see the Electron runbook below)*
- [ ] Electron clip (short) — installed app launching, mission running, AI panel showing ONNX mode (see the two Electron sections below)

### Electron Desktop — Short Clip (for Segment 7)

*(Record once, use ~8–10 s in the edit; voiceover is the desktop beat in Segment 7.)*

1. Install the app beforehand from `release/DCATS-Setup-1.0.0.exe` (SmartScreen: "More info" → "Run anyway" — do this during rehearsal, never on camera)
2. Open **DCATS** from the Start Menu / desktop shortcut → the native window opens (no browser chrome, no tabs)
3. Click **Start Training** on **Night Swarm Assault**
4. Let the battlefield render a few seconds; optionally toggle RADAR and back
5. Click a detected contact → the AI aid pops its advisory and mode line (**MODEL · ONNX IN-BROWSER**) — the desktop build runs the identical in-browser inference
6. Press **T → C → A → E** slowly
7. Optional 3-second proof: launch DCATS again from the Start Menu — the existing window just comes to focus (single-instance desktop app)
8. Stop the clip. Do **not** open DevTools (F12) on camera

If you prefer not to install: `npx electron .` opens the exact same packaged-mode window straight from `dist/`.

### Recording the Whole Demo Inside the Electron App (Full Runbook)

*Use this when the desktop app should carry the demo — no browser chrome anywhere. The click path matches the browser flow; only the differences below matter.*

**Prep — do all of it during rehearsal, never on camera:**
1. Install `release/DCATS-Setup-1.0.0.exe` (SmartScreen → "More info" → "Run anyway")
2. **Pre-seed the session-history shot inside the app:** launch 2–3 missions and End Exercise straight away. The app keeps its own storage — sessions seeded in the browser do not appear here
3. Rehearse the offline beat: Wi-Fi off from the tray → close the app → reopen from the Start Menu → run a mission → the AI aid still returns an advisory (in-browser inference)
4. 1920×1080 display, light OS theme, taskbar auto-hide, other windows closed, OBS armed

**Click path — one clean pass, 15 beats:**
1. **Landing** — hero stats and scenario grid on screen; hover Night Swarm Assault (Mission 03)
2. **Start Training** → battlefield loads dark; let the flock, city skyline and trails play ~8 s (the widest shot of the video)
3. *Optional:* RADAR ~2 s → back to the EO/IR FEED
4. **Click a detected contact** → the AI aid opens; hold on the mode line + confidence
5. **T** — contact flips to ACQUIRED (sitrep entry, score ticks up)
6. **C** — advisory arrives; accept it (ASSESSED entry)
7. **A** — ALERTED entry
8. **E** — Engage: interceptor streak → explosion in the 3D view. *E clears the selection and closes the panels by design — capture the advisory close-up at step 4, not here*
9. **End Exercise** → overlay → **View After-Action Review**
10. **AAR** — scroll: score + grade, summary cards, charts, classification table, recommendations, event timeline
11. **Instructor** → **Degraded Operations** → SNR 30%, dropout 20% → **Launch Training Session**
12. In-mission: contacts dropping out for seconds and reacquiring (degradation in action)
13. **End Exercise** → **Instructor** → **Local Session History** — the seeded sessions with grades and trend deltas
14. **Offline beat:** tray network icon → **Wi-Fi off** (if the machine is wired, unplug Ethernet too or use Airplane mode) → close the app fully → reopen from the Start Menu → it loads and runs → the AI aid still returns an advisory
15. *Optional 3-second proof:* launch DCATS again from the Start Menu — the existing window just comes to focus (single-instance app)

**Gotchas:**
- No F12 / DevTools on camera — the tray Wi-Fi toggle is the offline proof
- The 3D camera is fully navigable — drag to orbit, right-drag / Shift-drag to pan, scroll to zoom — and it gently resumes its cinematic auto-orbit after ~8 s without input; for hands-off footage, just let it sit
- E closing the side panels is intended behaviour, not a bug — plan the cutaways
- Session-history content must be seeded in whichever app you film (browser and Electron storage are separate)
- If the whole video is shot in Electron, this runbook replaces the DevTools offline beat in Segment 7

### Editing Timeline (DaVinci Resolve)
```
00:00 – 00:03   Title card: shield mark on navy + SIH26247 badge
00:03 – 00:20   Hook voiceover over radar sweep
00:20 – 00:40   Problem text overlay
00:40 – 00:55   Landing page screen recording
00:55 – 01:33   3D simulator screen recording (core demo) + day/rural quick cut
01:33 – 01:48   Sensor degradation clip (instructor console + dropouts)
01:48 – 02:13   AAR dashboard
02:13 – 02:28   Offline demo (+ optional Electron clip)
02:28 – 02:53   Closing montage + end card
```

### Audio Notes
- Voiceover: quiet room, close to mic, around -12 dB average RMS
- Music: "Cinematic Tension" from the YouTube Audio Library (royalty-free)
- Duck music to 10% whenever voiceover is active
- Optional subtle radar beep when threat dots spawn (royalty-free)

### Text Overlays to Add in Editing
| Timecode | Text |
|---|---|
| 0:20 | "Problem: SIH26247 — AI-Enabled Drone Threat Simulation" |
| 0:40 | "Mission 03 · Night Swarm Assault — Difficulty 4/5" |
| 0:47 | "Runs in the browser — or as a desktop app" |
| 0:55 | "Works fully offline" |
| 1:02 | "Any standard laptop" |
| 1:10 | "Emergent swarm behaviour (Boids)" |
| 1:13 | "Mission 01 · Basic Reconnaissance — rural, daylight" |
| 1:24 | "ONNX classifier — runs in-browser" (only if the model is trained) |
| 1:30 | "Scoring: 25% detection · 30% classification · 25% engagement · 20% collateral" |
| 1:38 | "Instructor set: SNR 30%, dropout 20%" |
| 1:56 | "Every session archived locally" |
| 2:13 | "Offline after warm-up + packaged Windows build — no runtime service dependency" |
| 2:28 | "Team [Your Team Name] — [Your College]" |

---

## Thumbnail / Title Card

**Text:** `DCATS — Drone Countermeasure and Assessment Training System — SIH26247`
**Layout:** light neutral background (#F2F4F7), navy wordmark, dark 3D battlefield screenshot running through the middle as the visual anchor, white shield mark from `public/favicon.svg`, SIH 2026 badge top-right.
**Font:** system UI stack (Segoe UI / Inter) — the same family the app uses. No stencil fonts.
**Style rules:** flat colours, thin borders, no glow, no emoji anywhere on the card or in lower thirds.

---

## Tips to Make the Video Stand Out

1. **Open with the swarm moment** — the eight-node flock moving over the night battlefield is the strongest visual; use it in the hook, not a slideshow
2. **Never say "we plan to"** — demo everything as if it is working now, because everything shown is working
3. **Keep voiceover confident and concise** — no filler words ("basically", "um", "sort of")
4. **Close with "Jai Hind"** — culturally resonant with SIH judges
5. **Upload to YouTube as Unlisted** — submit the link on the SIH portal; do not make it public before results are declared
6. **Add captions** — many judges watch without sound
7. **Keep the UI footage honest** — no zoom-and-enhance tricks; the dark operator console and its instrument readouts read well on video as-is

---

## Fact-Check Guardrails (do not say these — they are not in the build)

| Do not claim | What is actually true |
|---|---|
| "RandomForest and GRU sequence model" | RandomForest classifier exported to ONNX; there is no GRU in this build |
| "Timeline scrubbing / video replay" | The AAR shows a static event timeline and charts, not a scrubable replay |
| "Score trend across ten sessions" | Sessions are archived locally; charts are per-mission |
| "Radar ghosts / phantom returns" | Sensor degradation manifests as bounded signal-loss windows (tracks drop for ~2 s samples, then reacquire) |
| "Instructors change sensors mid-mission live" | Sensor settings are applied by the instructor at launch |
| "Cloud AI / server-backed inference" | Everything runs locally, in-browser |
| "Unity / VR-based simulator" | The build is Three.js (browser + packaged desktop); Unity/VR is the documented phase-2 target (`docs/unity_migration.md`), not in this build |
| "NATO-issue / officially fielded system" | The console styling follows open standard conventions (MIL-STD-2525-style track symbology, zulu logs, operator-station layout); this is a training simulator, not a fielded C2 system |
| Specific confidence percentages | Read the number on screen — it varies per run |
