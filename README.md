# DCATS — Drone Countermeasure and Assessment Training System

AI-Enabled Drone & Counter-Drone Threat Simulation Trainer

Offline-first trainer — browser (PWA), optional WebXR look-around VR view, and
a packaged Windows desktop app (Electron).
Detect → independently classify → alert → engage drone threats across 9 scenario
packs, with emergent swarm AI, an in-browser ONNX advisory cue, weighted scoring,
a detailed AAR dashboard and an instructor console with custom scenario authoring.

## Quick start (web)

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # 61 tests (Vitest)
npm run check      # tests + production build
npm run build      # production build in dist/ (PWA)
npm run preview    # serve the production build
```

## Desktop app (Electron)

```bash
npm run electron:build   # build + package installer -> release/DCATS-Setup-1.0.0.exe
npm run build            # create dist/ without packaging
npx electron .           # run packaged mode directly from dist/ (no installer)
```

For hot-reload development inside Electron, run the dev server first and then:

```bash
npm run dev              # terminal 1
npm run electron:dev     # terminal 2 — opens Electron on localhost:5173
```

`electron:dev` starts Electron with `ELECTRON_DEV=1` and loads the Vite dev
server. The packaged window sizes itself to the primary display's usable area
and is centered; at 1536×864 / 125% scaling this gives a 1474×779 content area
without clipping the navigation or bottom console. The rebuilt installer
includes the display-fit window and the VR control.

## VR view (WebXR)

The 3D battlefield includes an optional, YouTube-VR-style look-around mode for
WebXR headsets. It is an immersive viewer, not a separate controller-based
operator console.

- **Enter:** open any scenario, then click the headset icon at the bottom-right
  of the EO/IR Feed, next to **Full View**.
- **What it does:** renders the battlefield in stereo, starts from the current
  desktop camera pose, and lets you look around with head tracking. The orbit
  camera is paused while the headset session is live; exiting resumes the
  desktop camera.
- **Exit:** use the headset's system menu, or click the headset icon again on
  the desktop mirror.
- **No headset:** the icon stays visible and shows a short status explaining
  whether WebXR is unavailable or no headset was detected.
- **Requirements:** a WebXR-capable browser and headset, plus a secure context
  (`https://` or `http://localhost`). For a standalone headset, serve over HTTPS
  or use `adb reverse` to expose the dev server on the headset's localhost
  (for example `adb reverse tcp:5173 tcp:5173`, then open
  `http://localhost:5173`); a plain LAN `http://192.168.x.x` URL will not enable
  WebXR.
- **Scope:** look-around only. Track tags, the HUD, action buttons and logs stay
  on the desktop monitor; controller rays, teleportation and an in-VR HUD are
  phase 2.

The packaged Electron build includes the same control, but headset
availability depends on the WebXR runtime exposed to Electron. The browser/PWA
path is the reference for headset testing. The core trainer remains fully usable
without VR; headset mode is an optional delivery path.

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

The FastAPI service is an optional development aid, not part of the shipped
desktop/PWA runtime. The app uses the local ONNX model or the heuristic fallback.

## Reproducible checks

- Runtime pins: `.nvmrc` (Node 24.9.0) and `.python-version` (Python 3.12.3).
- `make test` — 61-test offline suite.
- `make check` — tests plus production build.
- `docker build -t dcats .` then `docker run --rm -p 4173:4173 dcats` —
  reproducible production web container.
- Browser acceptance flow: Launch **Night Swarm Assault** → select a detected
  contact → **Acquire Track** (T) → wait for the **AI Assessment** → **Accept
  Advisory** (C) or choose a classification and **Submit Assessment** → **Alert
  Team** (A) → **Engage** (E) → **End Exercise** → AAR. Contacts enter the track
  database on first detection; a momentary signal loss keeps the selection and
  holds the actions until reacquisition. The final score includes
  missed/unclassified threats at mission close.
- Viewport: **EO/IR Feed** (3D battlefield — drag to orbit, scroll to zoom,
  **Full View** for a browser full-screen viewport) and **Radar**. The headset
  icon in the 3D view opens the optional WebXR look-around mode described in
  **VR view (WebXR)** above; it remains visible without a headset and explains
  why VR cannot start.
- VR delivery check: without a headset, the icon must remain visible and show
  the fallback message; with a WebXR headset over localhost/HTTPS, entering VR
  must show the battlefield with head tracking and exit must return to the
  desktop orbit view. The desktop fallback is part of the shipped build; headset
  support is runtime-dependent.
- Instructor flow: Instructor → Scenario Builder → add threats → choose terrain,
  time, duration, difficulty and sensor conditions → Launch Custom Scenario.
- Local history: Instructor → Local Session History → export/import detailed JSON
  records for offline transfer between devices.
- Offline: first load the production app online so the service worker and model
  are cached, then disable networking and reopen. The packaged Electron build is
  offline by construction.
- Documentation: `docs/architecture.md`, `docs/sih_readiness_audit.md`,
  `docs/unity_migration.md`, `docs/pitch_deck_outline.md`, `demo_video_script.md`.
- Submission assets kept locally and intentionally excluded from the app repo:
  `sih_ppt_slides/` (deck copy/review) and `sih_submission_content.md`.

---

Made with ❤️ by Team Trath
