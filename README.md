# DCATS — Drone Countermeasure and Assessment Training System

SIH26247 · AI-Enabled Drone & Counter-Drone Threat Simulation Trainer · Ministry of Defence · Smart India Hackathon 2026.

Offline-first trainer — browser (PWA), WebXR-capable 3D view, and packaged
Windows desktop app (Electron).
Detect → independently classify → alert → engage drone threats across 9 scenario
packs, with emergent swarm AI, an in-browser ONNX advisory cue, weighted scoring,
a detailed AAR dashboard and an instructor console with custom scenario authoring.

## Quick start (web)

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run check      # unit tests + production build
npm run build      # production build in dist/ (PWA)
npm run preview    # serve the production build
```

## Desktop app (Electron)

```bash
npm run electron:build   # build + package installer -> release/DCATS-Setup-1.0.0.exe
npx electron .           # run packaged mode directly from dist/ (no installer)
```

For hot-reload development inside Electron, run the dev server first and then:

```bash
npm run dev              # terminal 1
npm run electron:dev     # terminal 2 — opens Electron on localhost:5173
```

## Train the ONNX model (optional — heuristic fallback works without it)

```bash
cd backend
python -m venv .venv
# Activate .venv using the shell for your platform, then:
pip install -r requirements.txt
python model/train_model.py   # writes public/models/threat_classifier.onnx
```

When the model file exists, `vite.config.js` enables real in-browser ONNX
inference automatically (restart the dev server / rebuild). The classifier is
an advisory cue: the trainee must choose the final classification by accepting
the cue or selecting an override. Without the model, the built-in classifier is
used and labelled as such in the AI panel.

## Model server (optional — the app runs fully offline without it)

```bash
cd backend
uvicorn server:app --port 8000
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" \
  -d '{"speed":65,"signature":0.02,"altitude":150}'
```

## Reproducible checks

- Runtime pins: `.nvmrc` (Node 24.9.0) and `.python-version` (Python 3.12.3).
- `make test` — offline unit suite.
- `make check` — unit suite plus production build.
- `docker build -t dcats .` then `docker run --rm -p 4173:4173 dcats` —
  reproducible production web container.
- Browser acceptance flow: Launch **Night Swarm Assault** → select a detected
  contact → **Acquire Track** (T) → **AI Assess** (C) → **Accept Advisory** or
  **Submit Assessment** → **Alert Team** (A) → **Engage** (E) → **End Exercise**
  → AAR. Contacts enter the track database on first detection; a momentary
  signal loss keeps the selection and holds the actions until reacquisition.
  The final score includes missed/unclassified threats at mission close.
- Viewport: **EO/IR Feed** (3D battlefield — drag to orbit, scroll to zoom,
  **Full View** for an immersive viewport) and **Radar**. **Enter VR** opens a
  YouTube-VR-style look-around view on WebXR headsets (stereo rendering + head
  tracking, starting from the current camera pose); the button stays visible on
  desktop and explains when no headset is detected. Full controller-based
  operator workflow remains phase 2.
- Instructor flow: Instructor → Scenario Builder → add threats → choose terrain,
  time, duration, difficulty and sensor conditions → Launch Custom Scenario.
- Local history: Instructor → Local Session History → export/import detailed JSON
  records for offline transfer between devices.
- Offline: first load the production app online so the service worker and model
  are cached, then disable networking and reopen. The packaged Electron build is
  offline by construction.
- Documentation: `docs/architecture.md`, `docs/sih_readiness_audit.md`,
  `sih_submission_content.md`, `demo_video_script.md`.
