# DCATS — Pitch Deck Outline (5 slides, SIH format)

## Slide 1 — Title
DCATS (Drone Countermeasure and Assessment Training System) · SIH26247 · Robotics & Drones · Team ID/Name.

## Slide 2 — Idea & solution
Browser-based, offline-first drone-threat trainer: 3D/WebXR battlefield, 6 threat
archetypes, emergent Boids swarm AI, in-browser ONNX advisory cue with
explainability, independent trainee classification, T→C→A→E operator rail,
25/30/25/20 outcome scoring, detailed AAR + recommendations, custom scenario
builder, portable local session history and PWA.

## Slide 3 — Technical approach
React 18 + Vite · Three.js (plain, no engine lock-in) · onnxruntime-web ·
Recharts · Zustand · IndexedDB · FastAPI + scikit-learn training pipeline.
Demo the architecture diagram from docs/architecture.md.

## Slide 4 — Feasibility
Runs on a modern WebGL laptop; no cloud service dependency; degraded-hardware
fallback = 2D radar view. The first PWA load warms the local cache; Electron is
offline by construction. Exact bundle and installer sizes are reported by the
build artifacts rather than estimated in the slide.
Risks + mitigations per sih_submission_content.md.

## Slide 5 — Impact
Unlimited repeatable software practice without live-fire range dependency;
swarm + degraded-sensor readiness; Made-in-India, air-gappable prototype.
Cost avoidance and NDRF adaptation are pilot/roadmap hypotheses, not current
validation claims.

## Live demo order (2:30)
Landing → Launch Night Swarm → 3D battlefield → select visible track → AI cue →
manual classification / accept-or-override → T/A/E → degraded sensor run →
End mission → AAR outcome evidence → local history export → offline reopen.
Close: "Jai Hind".

## Anticipated judge question — "Why not Unity / Unreal?"

Two-target strategy: the shipped build is the unit-level deployment (browser,
WebXR where supported, and packaged desktop); Unity remains the phase-2
high-fidelity target reading the same scenario schema. The simulation core is
engine-agnostic, so the renderer never locks the training logic. Full module
mapping and proof-of-concept scope: `docs/unity_migration.md`.
