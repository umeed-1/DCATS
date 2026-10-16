# DCATS — Unity Phase-2 Migration (High-Fidelity / VR Target)

The submission build ships as a browser PWA and a packaged Electron desktop app
(Three.js renderer). This document defines the phase-2 path to a **Unity 6**
deployment for physics-grade fidelity and VR training — reusing the same
simulation core, scenario schema and AI model. It exists so judges, mentors and
future maintainers can see exactly what moves where, and why the split is
deliberate rather than a compromise.

**Judge-facing one-liner:** *"The simulation core is engine-agnostic — scenarios,
swarm AI, sensor degradation, scoring and AAR are separate from the renderer.
That lets us ship today's build as the unit-level deployment (any laptop, fully
offline) and add a Unity/VR high-fidelity target in phase 2 without rewriting
the training logic."*

---

## Why the split architecture

- The training logic — scenario packs + procedural generator, Boids swarm AI,
  sensor visibility/degradation model, ONNX classifier, decision-tree scoring,
  AAR engine, session archive, instructor console — is **plain logic**, verified
  end-to-end, and free of any renderer dependency.
- Three.js / Electron is the **unit-level deployment**: 136 MB installer, runs
  on integrated graphics, browser or desktop, zero network — the "minimal
  specialised hardware" line in the problem statement.
- Unity is the **fidelity / VR deployment**: real physics, URP/HDRP rendering,
  editor tooling, XR Toolkit. It's the right tool for that goal — and the wrong
  reason to rebuild working training logic.
- Both targets consume the **same declarative scenario JSON** (`data/scenarios/`),
  so content authored today feeds the Unity build unchanged.

## Deployment targets

| | Current (shipped) | Phase 2 (Unity 6) |
|---|---|---|
| Engine | Three.js (plain, no engine lock-in) | Unity 6 (`6000.2.x`), URP |
| Shell | Browser PWA / Electron app | Standalone Windows player (IL2CPP) |
| Hardware | Any laptop, integrated GPU | dGPU recommended; VR: PC + headset |
| Install size | 136 MB installer | ≈400 MB – 1 GB |
| VR | WebXR look-around view (stereo + head tracking; browser/headset dependent) | Yes (OpenXR / XR Interaction Toolkit, controller workflow) |
| Physics | Procedural / kinematic | Rigidbody, ballistics-grade |
| Primary use | Unit-level repetition training | High-fidelity drills, VR immersion |
| Scenario source | `data/scenarios/*.json` + generator | Same JSON (imported as ScriptableObjects) |

## Module mapping

| Current module | Unity counterpart | Effort | Notes |
|---|---|---|---|
| `data/scenarios/*.json` (7 packs) | JSON import → ScriptableObjects | S | Schema reused as-is |
| `src/ai/scenarioGen.js` | C# port (deterministic seed) | S–M | Port alongside its tests |
| `src/simulation/SwarmAI.js` (boids + sensor model) | C# Burst/Jobs implementation | M | Logic maps 1:1; DOTS for 20+ drones |
| Sensor visibility / dropout (store) | Pure C# model class | S | |
| `src/ai/classifier.js` — ONNX path | Unity Sentis | M | Same `threat_classifier.onnx` file |
| `src/ai/classifier.js` — heuristic fallback | C# port | S | |
| `src/scoring/DecisionTree.js` | C# scoring service | S–M | Rules are declarative |
| `src/scoring/AAREngine.js` | C# stats + UI Toolkit screens | M | Charts via Unity UI |
| IndexedDB session archive | SQLite (`sqlite-net`) or JSON on disk | S | |
| `src/pages/InstructorPanel.jsx` | UI Toolkit screens | M–L | Largest UI rework |
| `src/simulation/SceneManager.js` + `Battlefield3D.jsx` | Unity scenes, prefabs, URP, VFX Graph | L | The visual jump — terrain, PBR lighting, FX |
| Radar View (2D canvas) | UI canvas / render texture | S–M | |
| Electron packaging (`electron/*.cjs`) | Unity standalone build | S | Offline by construction |

Effort scale: **S** = days, **M** = 1–2 weeks, **L** = multi-week.
Full parity is a **multi-week effort for a small team** — which is exactly why
phase 2 is staged: proof-of-concept first, port decision after.

## Proof-of-concept (immediate next milestone, after submission)

A single Unity 6 project at `unity/DCATS-Sim/` that proves the pipeline:

1. Loads the Mission 03 (Night Swarm Assault) scenario JSON through the same schema
2. Builds terrain, sky and a city block-out in URP
3. Spawns 8 swarm nodes driven by a C# boids port (same envelopes as `SwarmAI.js`)
4. Orbit camera with the same interaction model as the current 3D view
   (drag orbit, right-drag pan, wheel zoom)
5. Builds to a standalone Windows player, verified from screenshots

**Deliverable:** runnable Windows player + imagery showing the same scenario
rendered in Unity. **Not in PoC scope:** scoring, AAR, instructor UI — those
stay in the shipped app until the port decision.

## Verification approach for the PoC

- Headless (batchmode) build, then launch the player and capture frames — the
  same screenshot-QA loop used for the current 3D view.
- Compare boids envelopes and scenario loading against the JS implementation's
  existing test cases (speed/altitude/RCS bands).
- When Sentis lands: run the ONNX model in Unity, browser and Python on
  identical feature vectors and diff the outputs.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Porting cost (weeks) | Keep the shipped build as the product; port module-by-module behind the shared JSON schema |
| Build size vs "minimal hardware" PS line | Keep both targets — browser/Electron stays the unit-level deployment; Unity is the VR/fidelity option |
| Unity licensing | Unity Personal is free at this scale; confirm organisational licence before any defence deployment |
| ONNX parity between Sentis and onnxruntime-web | Validate all three runtimes on identical inputs before trusting the Unity path |
| Team Unity experience | PoC-first staged approach de-risks; the editor tooling is the learning curve, the logic already exists |
