# DCATS — SIH Readiness Audit

**Audit date:** 18 October 2026  
**Problem statement:** `problem_statement.txt` — *AI-Enabled Drone & Counter-Drone Threat Simulation Trainer*  
**Scope:** repository, application behavior, documentation/pitch claims, production web build, offline flow, and Windows packaging path.

## Executive verdict

DCATS is a real and visually convincing **desktop/browser prototype**. It
already demonstrates a useful end-to-end shape:

```text
scenario selection → moving 3D/radar battlefield → T/C/A/E operator rail
→ local ONNX classifier cue → live score → AAR dashboard → local archive
```

The strongest evidence is the working Night Swarm flow, procedural scenario
generator, Boids movement, ONNX inference in the browser, AAR charts, local
session archive, WebGL fallback, and a successful Vite production build.

The project is **not yet winning-ready as currently pitched**. The jury can
directly expose four trust gaps:

1. The “trainee decision, not AI decision” claim is false in the current UI:
   Classify records the model prediction as the trainee answer.
2. The Scenario Builder accepts threat rows but cannot launch a custom mission.
3. Sensor degradation is only partly real: latency is unused, SNR is coupled to
   dropout, and hidden tracks remain selectable from the list.
4. The scoring/AAR system does not penalise missed threats consistently and
   stores only a summary for historical sessions.

The winning strategy is **not more visual effects**. It is to make the human
decision, sensor challenge, scoring semantics, and learning evidence explicit
and testable, then narrow the pitch so every claim survives a live jury demo.

## What was actually verified

All commands below were run from `C:\Users\Akash\Desktop\sihfinal` unless
otherwise noted.

| Check | Result | Evidence / limitation |
|---|---|---|
| `npm test` | **PASS** | 5 files, 32 tests passed. These are pure-function/unit tests only. |
| `npm run build` | **PASS with warning** | 674 modules transformed. Vite warns that the main JS chunk is ~1.16 MB and ONNX WASM is ~28.3 MB. |
| Production browser smoke test | **PASS for core flow** | Landing renders 8 packs; Night Swarm launches with 8 tracks; ONNX panel appears; T/C/A/E, AAR and charts render; no console errors/network failures in the warmed run. |
| Scenario Builder browser check | **PARTIAL** | Threat rows can be added, but there are 0 launch buttons in the builder view. |
| Retry Mission browser check | **FAIL** | Returns to the already-completed simulator state; it does not call `startSimulation()`. |
| Offline PWA check | **CONDITIONAL PASS** | A first cold offline reload before the documented warm reload produced an empty page and module MIME error. After an online reload and one mission/model warm-up, offline reload, new mission, and ONNX mode worked. |
| Backend syntax/import check | **PASS** | `python -m py_compile server.py model/train_model.py` and imports for FastAPI, Uvicorn, scikit-learn, skl2onnx, ONNX and NumPy passed. No backend test suite exists. |
| `npm run electron:build` | **FAIL** | Web build and Windows unpacked packaging progressed, then electron-builder failed in `icons@1.1.0` with `WebAssembly.Memory(): could not allocate memory` while generating the ICO. Existing installer/unpacked artifacts are present, but this run did not produce a verified fresh installer. |

The workspace is also **not an independent Git checkout**: Git resolves to
`C:\Users\Akash`, which has no commits and contains unrelated home-directory
files. This is a reproducibility and submission hygiene risk.

## Requirement scorecard

| Problem-statement requirement | Status | What exists | What is missing or overstated |
|---|---|---|---|
| Desktop or VR-capable simulator | **Met for desktop + VR view** | Browser/PWA and Electron path; 2D radar fallback; WebXR look-around view (stereo + head tracking). | Full controller-based VR operator workflow is phase 2. |
| Scripted scenarios | **Met at prototype level** | 7 static packs plus a catalogue entry for procedural generation. | Frontend uses a duplicated hardcoded array, not `data/scenarios/*.json`. |
| Procedurally generated scenarios | **Partially met / usable** | `src/ai/scenarioGen.js` randomises mix, terrain, time, difficulty and sensor quality. | No seed/replay; generated threat spawn is immediate rather than time-based. |
| Recognise, classify and respond | **Partially met** | Threat tracks, classifier panel, T/C/A/E rail and keyboard shortcuts. | No independent manual classification; model output is recorded as operator answer. |
| Day/night | **Met** | Scenario metadata and distinct Three.js sky/lighting. | Real sensor/night-vision fidelity is simplified. |
| Urban/rural terrain | **Partially met** | Procedural city, trees, mountains and palettes. | Terrain is presentation-level; no occlusion, protected assets or operational objectives. |
| Single-drone and swarm attacks | **Partially met** | 1–20 threats and Boids separation/alignment/cohesion. | All threats use the same movement routine; no terminal dive, cargo objective, decoy/EW behaviour or threat escape condition. |
| Realistic degraded sensors | **Partially met** | SNR/dropout controls, visible flicker, hidden 3D track placement. | Latency is stored but unused; SNR alone has no effect when dropout is zero; hidden tracks remain selectable. |
| Decision-tree scoring | **Partially met** | 25/30/25/20 weighted score functions and live score breakdown. | Detection keeps the best score, missed threats are not closed out, collateral is only wrongful classification, and score-over-time uses arbitrary increments. |
| AAR dashboard | **Met for current mission** | Score/grade, summary cards, charts, detection times, recommendations and event timeline. | No timeline scrubbing/replay. |
| Individual/unit performance over repeats | **Partially met** | IndexedDB/localStorage session summaries and local cohort table. | No trainee/unit identity, export/import, sync, access control or detailed historical AAR. |
| Difficulty adjustment | **Partially met** | Instructor SNR/dropout/latency controls and scenario packs. | Latency has no effect; no adaptive difficulty; builder cannot launch. |
| Randomisation against rote learning | **Partially met** | Procedural generator, random initial positions and emergent movement. | No deterministic seed, evaluation repeatability or measured learning improvement. |
| Minimal specialised hardware | **Met for the prototype** | WebGL desktop path and radar fallback. | No FPS/startup/memory matrix; “any government laptop” is unproven. |

## What is already strong

### Product and demo strengths

- The app immediately communicates the mission and has a coherent command-console
  visual language.
- Eight scenario cards are visible and understandable, including Night Swarm,
  Degraded Operations, Full Spectrum and Procedural Generation.
- The Night Swarm battlefield is a strong visual anchor: moving nodes, terrain,
  lighting, tracks, trails and engagement effects.
- The operator rail has a clear, memorable T → C → A → E sequence.
- The browser actually loaded `MODEL: ONNX IN-BROWSER` during the production QA
  run; this is stronger than a static claim in a slide.
- The AAR gives judges something concrete to inspect after the action, rather
  than ending at a visual animation.
- The WebGL fallback to Radar View and classifier fallback are sensible
  resilience decisions.
- The design is suitable for an air-gapped prototype after the app shell and
  model have been warmed once.

### Technical strengths

- `src/simulation/SwarmAI.js` is pure and unit-tested.
- `src/scoring/DecisionTree.js` has explicit weights and pure functions.
- `src/ai/scenarioGen.js` accepts an injected random source, which is a good
  foundation for deterministic evaluation even though the production path does
  not expose a seed.
- Electron uses context isolation, disabled Node integration and sandboxing.
- The app does not need the optional Python server during normal browser use.

## Blocking jury risks

### 1. AI assistance currently replaces the trainee decision

Evidence:

- Track selection immediately calls `predictThreat()` in
  `src/pages/Simulator.jsx:202-228` and the threat-list handler at
  `src/pages/Simulator.jsx:370-375`.
- The Classify action calls the model and records `pred.predictedType` in
  `src/pages/Simulator.jsx:403-408`.
- `src/store.js:260-279` scores that value as the classification.

The pitch says scoring is always based on the trainee’s independent decision,
but there is no candidate list, dropdown, manual type selection, accept button,
override button or AI-use audit trail. A judge can accurately call this an AI
demo rather than a human-performance trainer.

**Smallest winning correction:** show the AI result as an advisory cue, require
the trainee to choose a type manually, and separately offer “Accept AI cue” and
“Override”. Store `aiPrediction`, `aiConfidence`, `traineeClassification`,
`acceptedCue`, and ground truth. Score only `traineeClassification`.

### 2. Scenario Builder is a dead-end feature

`InstructorPanel.jsx:73-84` only changes local `customThreats` state and
`InstructorPanel.jsx:241-281` renders the rows. It never builds a scenario,
passes it to `startSimulation`, or exposes a launch action.

**Smallest winning correction:** add terrain, time, duration and difficulty
fields; build a scenario object; launch it through the same store path; display
the custom name/mix in the simulator. If time does not allow this, remove the
claim from the slide and label the tab “Roadmap”.

### 3. Sensor degradation can be bypassed

`sensorVisible()` is `rand() > dropout * (1 - snr)` in
`src/simulation/SwarmAI.js:82-84`. Consequences:

- SNR does nothing when dropout is zero.
- The configured `sensorLatency` is stored in `store.js:167-189` but never used
  in `tickSimulation()`.
- Hidden tracks are skipped on the radar but remain in the full threat list and
  can be selected directly.
- Radar selection does not check `t.visible`.

**Smallest winning correction:** make SNR affect measurement noise/confidence or
  visibility independently; use latency as delayed track availability or action
  timing; filter hidden tracks from selection; add an explicit “track lost” state.
Then demo the same scenario at clear and degraded settings with a measurable
difference.

### 4. Scoring does not represent complete operator performance

Evidence:

- Detection uses `Math.max()` in `store.js:243-257`, so one fast track can hide
  slow or missed tracks.
- The `engaged: false` branch exists in `DecisionTree.js:34-36`, but production
  code does not use it at mission end.
- “Collateral” is a penalty for wrong classification in `store.js:293-316`;
  there are no civilian zones, friendly units or protected assets.
- `AAREngine.timelineData()` adds +20/+15 rather than using the actual weighted
  score.
- `runningAverage(0, score)` means the first correct classification or
  engagement displays 50, not 100.

**Smallest winning correction:** compute per-threat outcomes at mission close;
penalise missed/unclassified/unalerted/unengaged threats; make the timeline use
the same score accumulator; either add a protected-zone concept or rename the
metric to “Wrongful Engagement Avoidance”.

### 5. Historical AAR is not replayable unit analytics

At mission end, `store.js:197-217` persists only scenario, score, event count,
threat count, neutralised count, time and date. Detailed events, sensor setup,
threat outcomes and score history are not persisted. The cohort table is local
browser/device history with no person or unit identity.

**Smallest winning correction:** persist a complete session record with a
session ID, trainee/unit fields, seed, sensor settings, ground truth, decisions,
events and metric history. Add JSON export/import for a simple offline unit
workflow. Call it “local session history” until identity and aggregation exist.

## AI and realism: what to claim honestly

The model metadata reports 99.916% nominal accuracy and 99.833% jittered
accuracy on 12,000 synthetic samples. The training script generates those
samples from the same per-type envelopes used by the simulator. This is useful
as a consistency check, but it is **not field accuracy** and should not be the
headline innovation.

The safer claim is:

> “DCATS is an offline operator-learning and evaluation loop. The local AI
> gives an explainable advisory cue; the trainee’s independent decision is what
> should be measured.”

Before claiming operational readiness, add:

- a confusion matrix and held-out distributions that are not identical to the
  simulator generator;
- confidence calibration and an “uncertain / abstain” state;
- an out-of-distribution test case;
- explicit model version and feature-schema metadata;
- an explanation that the current data is synthetic and open-source-derived.

The optional FastAPI service is not the app’s runtime AI path. `backend/server.py`
returns a separate hand-written heuristic, while the browser uses
`src/ai/classifier.js` and the ONNX model. That split is acceptable for a demo,
but it should be described as “optional diagnostic/model API”, not as the
backend powering the trainer.

## Documentation and pitch contradictions to fix

| Current statement | Replace with |
|---|---|
| “AAR replay” | “Static AAR timeline and charts” unless replay/scrubbing is implemented. |
| “Scenario Builder composes threat mixes” | “Scenario Builder prototype” or implement launch. |
| “Scoring is always based on the trainee’s decision” | Use only after manual classification/accept-override flow exists. |
| “Unit/cohort analytics” | “Local session history” unless identity/export/aggregation is added. |
| “Realistic collateral avoidance” | “Wrongful engagement avoidance” unless civilian/friendly/protected geometry exists. |
| “Full VR simulator” | “Desktop build + WebXR look-around VR view; controller-based VR and Unity/OpenXR are phase 2.” |
| “Runs on any government laptop” | “Runs on a modern WebGL laptop; 2D radar fallback available.” |
| “99.9% accurate AI” | “99.9% synthetic hold-out accuracy on simulator-envelope data.” |
| “Zero network calls” | “No runtime service dependency after cache/package warm-up; verify with a network log.” |
| “₹15–40 lakh saved per drill” | “Targeted cost-avoidance hypothesis to validate in a pilot.” |

There are also inconsistent size claims: approximately 25 MB + 2 MB, 29 MB,
136 MB, and the current production build contains a 28.3 MB ONNX WASM asset
alone. Define every size as one of: web download, unpacked Electron directory,
or installer size.

`sihppt.txt` is empty. The usable content is in
`sih_submission_content.md`, so the final official SIH deck still needs to be
generated and checked for the actual team ID, team name, institute and slide
format.

## P0 — must-have implementation work before judging

Do these in order. Each item should have a visible acceptance test.

### P0.1 Independent trainee classification

Acceptance:

- Selecting a track shows the AI cue but does not classify it.
- Classify opens six type choices plus “Unknown/hold”.
- Accepting the cue and overriding it are separate actions.
- AAR shows ground truth, AI prediction, trainee answer, confidence and cue
  acceptance/override.
- Classification score uses the trainee answer only.

### P0.2 Real custom scenario launch

Acceptance:

- Instructor can choose threat counts, terrain, time, duration, difficulty and
  sensor settings.
- “Launch Custom Scenario” starts the exact selected mix.
- Simulator HUD and AAR identify the custom scenario.
- The scenario is persisted/exportable as JSON.

### P0.3 Close the sensor model loopholes

Acceptance:

- Clear SNR/dropout/latency sweeps have different observed detection metrics.
- A hidden track cannot be selected from the threat list or radar.
- A lost track is visibly labelled and can reappear.
- Latency affects when a track/action becomes available or the measured delay.
- Unit tests cover low/high SNR, dropout, latency and hidden-track selection.

### P0.4 Make score semantics defensible

Acceptance:

- Every threat receives a terminal outcome: detected, classified, alerted,
  engaged, missed, unsafe or ignored.
- Detection score aggregates all threats, not the best one.
- Missed and unengaged outcomes affect the final score.
- The AAR timeline is derived from the same scoring accumulator as the final
  total.
- The score labels explain the formula in the UI.

### P0.5 Remove easy-to-discover workflow bugs

Acceptance:

- End Mission is disabled/hidden after completion and cannot create duplicate
  archives.
- Retry Mission starts a fresh simulation with a new session ID and reset state.
- Reloading a completed session has an intentional behavior: either restore a
  detailed AAR or clearly show that no mission is active.

## P1 — evidence and submission hardening

After P0, add only the evidence that strengthens the jury story:

1. Add browser acceptance tests for launch, manual classification, custom
   launch, sensor degradation, missed threat scoring, AAR, retry and offline.
2. Add a deterministic seed to procedural scenarios and show two different
   seeds in the demo.
3. Add an evaluation report: detection time, classification accuracy, safe
   resolution rate, missed-threat rate and score improvement across repeated
   sessions.
4. Add a hardware matrix with laptop CPU/GPU/RAM, FPS, startup time and memory.
5. Pin Node and Python versions; add Python lockfile, Dockerfile and one offline
   test command. Keep `package-lock.json`.
6. Make the project an independent Git repository or clean worktree. Do not
   submit a parent home-directory repository containing unrelated files.
7. Make the Electron packaging command reproducible. Investigate the
   `icons@1.1.0` WebAssembly memory failure and verify a fresh installer, not
   only the existing ignored artifact.
8. Move the seven scenario packs to one source of truth and validate them with a
   schema. The current JSON files are not consumed by the frontend.
9. Generate the actual five-slide PDF/deck from the corrected claims; do not
   leave `sihppt.txt` as the only presentation placeholder.

## Demo that is most likely to win

Use a “mistake → learning → improvement” story, not a perfect AI kill:

1. Open on the Night Swarm battlefield for the visual hook.
2. Show one track and the AI advisory cue.
3. Make a manual classification decision; show Accept vs Override.
4. Deliberately make one unsafe/wrong decision or leave one threat unengaged.
5. Repeat under degraded SNR/dropout and show a lost/reacquired track.
6. Open AAR: show the exact penalty, decision timeline and recommendation.
7. Run a second seeded/procedural mission and show improvement in a measurable
   metric.
8. Open local history/export and state the local-only data boundary.
9. Turn off network after the documented warm-up, close/reopen, run a new
   mission and show ONNX still works offline.

Do not spend demo time on Unity/VR, unsupported cost savings, or synthetic
accuracy as if they were field validation. Those belong in a bounded roadmap
slide.

## Jury questions to prepare for

- What does the trainee decide independently of the model?
- How do you score a missed, ignored or uncertain threat?
- Can you build and launch a custom scenario live?
- What does SNR change mathematically, and how is latency implemented?
- How do you avoid selecting a track that the sensor has lost?
- What is “collateral” in this simulator if there are no civilian or friendly
  entities?
- Is 99.9% accuracy based on real sensor data or synthetic simulator data?
- What is persisted, and can another instructor/unit receive the results?
- What is the exact supported hardware and offline warm-up procedure?
- Why is the shipped build Three.js while the deck mentions Unity/VR?
- Can you rebuild the installer from a clean machine?

## Recommended final positioning

Present the current product as:

> **DCATS — an offline prototype for measuring operator decisions under
> synthetic drone-threat and sensor-degradation scenarios.**

That is accurate, directly aligned to the problem statement, and more credible
than claiming a complete operational qualification system. The path to a strong
SIH result is to make the central training loop truthful and measurable, then
use VR, real sensor data, multi-unit synchronization, encrypted personnel
records and high-fidelity physics as explicitly staged next milestones.

## Implementation update — 18 October 2026

The P0 prototype corrections identified above have now been implemented:

- The AI is visibly advisory. The trainee can accept the recommendation or
  override it with a manually selected type; the AAR records the source.
- Scenario Builder now launches a custom threat mix with terrain, time,
  duration, difficulty, SNR, dropout and latency controls.
- SNR and dropout are independent, latency delays track availability, and
  hidden tracks cannot be selected.
- Mission-close scoring aggregates every threat and penalises incomplete
  outcomes while preserving the 25/30/25/20 weights.
- End Mission is idempotent; Retry Mission starts a fresh run with the same
  scenario/sensor configuration.
- Detailed session records now include scenario configuration, sensor settings,
  events and threat outcomes. Local history supports JSON export/import.
- AAR classification rows show ground truth, trainee call, and AI accepted vs
  trainee override.
- PWA cache versioning and install-time asset/model discovery were hardened for
  offline reopen after the online warm-up.
- Reproducibility files were added: `.nvmrc`, `.python-version`, `Dockerfile`,
  `.dockerignore`, `Makefile`, and `npm run check`.

The remaining release gap is fresh Windows installer packaging: the web build
passes, but the current machine's `electron-builder` icon conversion failed with
`WebAssembly.Memory(): could not allocate memory`. This is a release-toolchain
issue that must be resolved and retested before claiming a newly built installer.
