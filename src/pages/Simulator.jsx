import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import useStore, { THREAT_TYPES } from '../store';
import Battlefield3D from '../simulation/Battlefield3D';
import { TYPE_TINT, TYPE_TINT_PANEL } from '../simulation/SceneManager';
import { warmupClassifier, classifyThreat as classifyTrackAI, heuristicClassify } from '../ai/classifier';
import Icon from '../components/Icon';
import { trackLabel } from '../utils/format';
import './Simulator.css';

/* Exercise clock — consoles stamp everything in zulu (UTC). The exercise
 * begins at 04:00:00Z; entries tick forward with simulation time. */
const ZULU_BASE = 4 * 3600;
function zulu(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0)) + ZULU_BASE;
  const hh = String(Math.floor(s / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${hh}:${mm}:${ss}Z`;
}

/* Recording timecode — counts up from zero when the feed opens:
 * minutes : seconds : milliseconds, unlike the zulu exercise clock (UTC). */
function timecode(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  const ms = String(Math.floor((s % 1) * 1000)).padStart(3, '0');
  return `${mm}:${ss}:${ms}`;
}

/* Live telemetry derived from simulation state (world units are metres). */
const bearingOf = (t) => (Math.atan2(t.x, -t.y) * 180 / Math.PI + 360) % 360;
const rangeOf = (t) => Math.hypot(t.x, t.y);
const speedKmhOf = (t) => Math.hypot(t.vx || 0, t.vy || 0) * 36;

/* Camera presets driven from the feed's top-left Cams chip. */
const CAMERA_VIEWS = [
  { id: 'free', label: 'Orbit' },
  { id: 'top', label: 'Top' },
  { id: 'chase', label: 'Chase' },
  { id: 'ground', label: 'Ground' },
];

/* APP-6 / MIL-STD-2525-flavoured track symbol: diamond = UAS track,
 * amber until assessed, red once classified hostile, dashed when lost.
 * Drawn on light panels, so it carries the darker panel tints. */
function TrackGlyph({ state = 'unknown', size = 15 }) {
  const stroke = state === 'hostile' ? '#b3261e'
    : state === 'resolved' ? '#64748b'
      : state === 'lost' ? '#8a6a2f'
        : '#b45309';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`track-glyph track-glyph-${state}`}
      aria-hidden="true"
    >
      <path
        d="M8 1.4 14.6 8 8 14.6 1.4 8Z"
        fill={state === 'hostile' ? 'rgba(179, 38, 30, 0.15)' : 'none'}
        stroke={stroke}
        strokeWidth="1.4"
        strokeDasharray={state === 'lost' ? '2.5 2' : undefined}
      />
      {(state === 'hostile' || state === 'resolved') && (
        <circle cx="8" cy="8" r="1.6" fill={stroke} />
      )}
    </svg>
  );
}

/* Target-recognition silhouettes — filled colour profiles of each platform
 * type, drawn as inline SVG (no image assets; works fully offline). Used as
 * the sensor-ID thumbnail in the AI advisory panel and the actions readout. */
function ThreatSilhouette({ type, size = 38 }) {
  const arm = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
  };
  const shapes = {
    // Quad-rotor, X-frame (seen from above).
    scout: (
      <>
        <path d="M24 24 L13.5 13.5 M24 24 L34.5 13.5 M24 24 L13.5 34.5 M24 24 L34.5 34.5"
          {...arm} strokeWidth="3" />
        <circle cx="13.5" cy="13.5" r="5.8" fill="currentColor" opacity="0.85" />
        <circle cx="34.5" cy="13.5" r="5.8" fill="currentColor" opacity="0.85" />
        <circle cx="13.5" cy="34.5" r="5.8" fill="currentColor" opacity="0.85" />
        <circle cx="34.5" cy="34.5" r="5.8" fill="currentColor" opacity="0.85" />
        <rect x="19" y="19" width="10" height="10" rx="2" fill="currentColor" />
      </>
    ),
    // Heavy-lift hexa-rotor with slung container bay.
    cargo: (
      <>
        <path d="M24 24 L38.3 32.3 M24 24 L24 40.5 M24 24 L9.7 32.3 M24 24 L9.7 15.8 M24 24 L24 7.5 M24 24 L38.3 15.8"
          {...arm} strokeWidth="3" />
        <circle cx="38.3" cy="32.3" r="4.6" fill="currentColor" opacity="0.85" />
        <circle cx="24" cy="40.5" r="4.6" fill="currentColor" opacity="0.85" />
        <circle cx="9.7" cy="32.3" r="4.6" fill="currentColor" opacity="0.85" />
        <circle cx="9.7" cy="15.8" r="4.6" fill="currentColor" opacity="0.85" />
        <circle cx="24" cy="7.5" r="4.6" fill="currentColor" opacity="0.85" />
        <circle cx="38.3" cy="15.8" r="4.6" fill="currentColor" opacity="0.85" />
        <rect x="15.5" y="15.5" width="17" height="17" rx="2.5" fill="currentColor" />
      </>
    ),
    // Loitering munition — missile airframe.
    kamikaze: (
      <>
        <rect x="6" y="18.6" width="27" height="10.8" rx="5" fill="currentColor" opacity="0.9" />
        <path d="M31 16.5 L43 24 L31 31.5 Z" fill="currentColor" />
        <path d="M8 18.6 L1.5 11.5 L10.5 15.2 Z" fill="currentColor" opacity="0.85" />
        <path d="M8 29.4 L1.5 36.5 L10.5 32.8 Z" fill="currentColor" opacity="0.85" />
        <rect x="5" y="17" width="4" height="14" rx="2" fill="currentColor" opacity="0.7" />
      </>
    ),
    // EW jammer — quad with a comms dish.
    ewJammer: (
      <>
        <path d="M24 34 L12.5 28.5 M24 34 L35.5 28.5 M24 34 L12.5 39.5 M24 34 L35.5 39.5"
          {...arm} strokeWidth="2.8" />
        <circle cx="12.5" cy="28.5" r="5" fill="currentColor" opacity="0.85" />
        <circle cx="35.5" cy="28.5" r="5" fill="currentColor" opacity="0.85" />
        <circle cx="12.5" cy="39.5" r="5" fill="currentColor" opacity="0.85" />
        <circle cx="35.5" cy="39.5" r="5" fill="currentColor" opacity="0.85" />
        <rect x="19.5" y="29.5" width="9" height="9" rx="2" fill="currentColor" />
        <path d="M14.5 15.5 A 9.5 9.5 0 0 1 33.5 15.5 L 24 15.5 Z" fill="currentColor" opacity="0.9" />
        <path d="M24 15.5 V29.5" {...arm} strokeWidth="2.2" />
        <circle cx="24" cy="13" r="1.8" fill="currentColor" />
      </>
    ),
    // Decoy — square-frame quad with a strobe mast.
    decoy: (
      <>
        <path d="M13.5 13.5 H34.5 V34.5 H13.5 Z" {...arm} strokeWidth="2.6" />
        <circle cx="13.5" cy="13.5" r="5" fill="currentColor" opacity="0.85" />
        <circle cx="34.5" cy="13.5" r="5" fill="currentColor" opacity="0.85" />
        <circle cx="13.5" cy="34.5" r="5" fill="currentColor" opacity="0.85" />
        <circle cx="34.5" cy="34.5" r="5" fill="currentColor" opacity="0.85" />
        <circle cx="24" cy="24" r="5" fill="currentColor" />
        <path d="M24 19 V7.5" {...arm} strokeWidth="2.2" />
        <circle cx="24" cy="5.5" r="2.4" fill="currentColor" opacity="0.8" />
      </>
    ),
    // Swarm node — mesh-networked micro-drone.
    swarmNode: (
      <>
        <path d="M24 22 L11.5 13.5 M24 22 L36.5 13.5 M24 22 V37.5"
          {...arm} strokeWidth="2" opacity="0.8" />
        <circle cx="24" cy="22" r="6" fill="currentColor" />
        <circle cx="10" cy="12" r="3.4" fill="currentColor" opacity="0.85" />
        <circle cx="38" cy="12" r="3.4" fill="currentColor" opacity="0.85" />
        <circle cx="24" cy="40" r="3.4" fill="currentColor" opacity="0.85" />
        <path d="M14 4.5 A 13.5 13.5 0 0 1 34 4.5" {...arm} strokeWidth="2" />
      </>
    ),
    // Unidentified — no confirmed airframe; dashed contact ring with a query.
    unidentified: (
      <>
        <circle cx="24" cy="24" r="15.5" {...arm} strokeWidth="2.4" strokeDasharray="4.5 3.5" />
        <path d="M19.4 19.6a5 5 0 1 1 7.2 4.5c-1.4.7-2.2 1.6-2.2 3v.6" {...arm} strokeWidth="2.6" />
        <circle cx="24.2" cy="33" r="1.6" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      {shapes[type] || shapes.scout}
    </svg>
  );
}

/* Sitrep entries read as plain sentences; track codes are dim secondary
 * detail. The log guides the trainee — it is not a machine dump. */
function EventSentence({ ev }) {
  const code = <span className="event-code">{trackLabel(ev.threatId)}</span>;
  switch (ev.type) {
    case 'track':
      return <>{code} acquired</>;
    case 'classify': {
      const label = THREAT_TYPES[ev.classification]?.label || ev.classification;
      return <>{code} classified as {label}</>;
    }
    case 'alert':
      return <>Team alerted — {code}</>;
    case 'engage':
      return <>{code} neutralised</>;
    default:
      return <>{code}</>;
  }
}

export default function Simulator() {
  const {
    simStatus, simTime, simDuration, threats, selectedThreat,
    events, aiPrediction, activeSessionId,
    tickSimulation, selectThreat, trackThreat,
    alertThreat, engageThreat, acceptAiClassification,
    overrideClassification, retrySimulation,
    pauseSimulation, resumeSimulation, selectedScenario,
  } = useStore();

  const miniRadarRef = useRef(null);
  const viewportRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(performance.now());
  /* Radar repeater helpers: latest sim state (read by the draw loop) and
   * per-track echo trails (keyed by threat id). */
  const radarStateRef = useRef({});
  radarStateRef.current = { threats, selectedThreat, simTime, simStatus };
  const trailRef = useRef(new Map());
  const [webglReady, setWebglReady] = useState(true);
  const [manualClassification, setManualClassification] = useState('');
  const [fullView, setFullView] = useState(false);
  /* Camera preset control — a Cams chip beside the REC stamp that opens the
   * view names. The 3D host owns the move; the page owns the picker. */
  const [cameraView, setCameraView] = useState('free');
  const [camOpen, setCamOpen] = useState(false);
  const [cameraRequest, setCameraRequest] = useState(null);
  const cameraLabel = (CAMERA_VIEWS.find((v) => v.id === cameraView) || CAMERA_VIEWS[0]).label;
  const chooseCameraView = (id) => {
    setCameraRequest({ id });
    setCameraView(id);
    setCamOpen(false);
  };
  /* Full-view engagement board: the classification picker stays collapsed
   * until the operator opens it, so the board stays a four-button strip. */
  const [classifyOpen, setClassifyOpen] = useState(false);
  /* Acquisition kicks off the assessment aid automatically. The result is
   * held back for 3–5 seconds so the operator watches the track develop,
   * then receives a suggestion to accept or override. */
  const analysisTimersRef = useRef(new Map());
  const analysisResultsRef = useRef(new Map());
  const [analysisPending, setAnalysisPending] = useState({});
  /* First-use guidance only: once a contact has been selected, the operator
   * has found the interaction pattern and the hint is no longer needed. */
  const [hasSelectedOnce, setHasSelectedOnce] = useState(false);
  /* Boot overlay — waits for the 3D feed's first rendered frame, with a short
   * hold so the console power-up reads deliberately and a failsafe so a
   * stalled GPU can never trap the operator on a loading screen. */
  const [bootPhase, setBootPhase] = useState('boot'); // boot | leaving | done
  const [sceneReady, setSceneReady] = useState(false);
  /* Mount the heavy Three.js scene only after the boot overlay has painted,
   * so the first thing the operator sees is the power-up, not a frozen page. */
  const [sceneMounted, setSceneMounted] = useState(false);
  /* Side notices over the 3D feed — a countdown while an interceptor is in
   * flight, the impact confirmation, a new contact, the report being sent,
   * and the team's delayed engage/hold guidance. Contact/report/guidance
   * notices fire in Full View (where the right rail is off-screen); the
   * engage countdown and impact notice render in both views. Guidance is
   * advisory: the operator still owns the decision and scoring is unchanged. */
  const [notices, setNotices] = useState([]);
  const noticeTimersRef = useRef(new Map());
  const teamReplyTimersRef = useRef(new Map());
  const fullViewRef = useRef(false);
  fullViewRef.current = fullView;
  const detectedRef = useRef(new Set());
  const alertedRef = useRef(new Set());
  const neutralisedRef = useRef(new Set());

  const pushNotice = useCallback((notice) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotices((prev) => [...prev.slice(-2), { id, ...notice }]);
    const timer = setTimeout(() => {
      setNotices((prev) => prev.filter((item) => item.id !== id));
      noticeTimersRef.current.delete(id);
    }, notice.ttl ?? 6500);
    noticeTimersRef.current.set(id, timer);
  }, []);

  const scheduleTeamReply = useCallback((id) => {
    if (teamReplyTimersRef.current.has(id)) return;
    const timer = setTimeout(() => {
      teamReplyTimersRef.current.delete(id);
      const state = useStore.getState();
      if (state.simStatus === 'idle' || state.simStatus === 'complete') return;
      const latest = state.threats.find((threat) => threat.id === id);
      if (!latest || latest.neutralised || latest.engaging || !latest.alerted) return;
      const mustHold = latest.type === 'decoy' || latest.type === 'unidentified';
      const hold = mustHold || latest.classCorrect !== true;
      pushNotice({
        kind: hold ? 'guidance-hold' : 'guidance-engage',
        title: 'Team guidance',
        body: hold
          ? (mustHold ? 'Hold fire — leave it alone.' : 'Hold — re-verify identification.')
          : 'Cleared to engage.',
        ttl: 3800,
      });
    }, 2800 + Math.random() * 1200);
    teamReplyTimersRef.current.set(id, timer);
  }, [pushNotice]);

  /* New exercise: drop notices, seen markers and any pending team reply. */
  useEffect(() => {
    setNotices([]);
    detectedRef.current.clear();
    alertedRef.current.clear();
    neutralisedRef.current.clear();
    const pendingNotices = noticeTimersRef.current;
    pendingNotices.forEach(clearTimeout);
    pendingNotices.clear();
    const pendingReplies = teamReplyTimersRef.current;
    pendingReplies.forEach(clearTimeout);
    pendingReplies.clear();
  }, [activeSessionId]);

  useEffect(() => () => {
    noticeTimersRef.current.forEach(clearTimeout);
    noticeTimersRef.current.clear();
    teamReplyTimersRef.current.forEach(clearTimeout);
    teamReplyTimersRef.current.clear();
  }, []);

  /* First detection of each track — not every visibility flicker after a
   * sensor dropout. Detected while not in Full View is marked as seen but not
   * queued, so entering Full View never replays old contacts. */
  useEffect(() => {
    if (simStatus === 'idle') return;
    for (const threat of threats) {
      if (!threat.detected || threat.neutralised || detectedRef.current.has(threat.id)) continue;
      detectedRef.current.add(threat.id);
      if (!fullViewRef.current) continue;
      pushNotice({
        kind: 'contact',
        title: 'New contact detected',
        body: `${trackLabel(threat.id)} · BRG ${String(Math.round(bearingOf(threat))).padStart(3, '0')}° · RNG ${Math.round(rangeOf(threat))}m`,
        ttl: 3200,
      });
    }
  }, [threats, simStatus, pushNotice]);

  /* A report sent in Full View is acknowledged immediately; the team's
   * guidance follows a few seconds later. */
  useEffect(() => {
    if (simStatus === 'idle') return;
    for (const threat of threats) {
      if (!threat.alerted || alertedRef.current.has(threat.id)) continue;
      alertedRef.current.add(threat.id);
      if (fullViewRef.current) {
        pushNotice({
          kind: 'team',
          title: 'Team informed',
          body: `${trackLabel(threat.id)} reported — awaiting guidance.`,
          ttl: 2600,
        });
      }
      scheduleTeamReply(threat.id);
    }
  }, [threats, simStatus, pushNotice, scheduleTeamReply]);

  /* Impact confirmation — the store only neutralises a track when the
   * interceptor reaches it, so this lands on the same tick as the explosion. */
  useEffect(() => {
    if (simStatus === 'idle') return;
    for (const threat of threats) {
      if (!threat.neutralised || neutralisedRef.current.has(threat.id)) continue;
      neutralisedRef.current.add(threat.id);
      pushNotice({
        kind: 'neutralised',
        title: 'Drone neutralised',
        body: `${trackLabel(threat.id)} · target destroyed.`,
        ttl: 3600,
      });
    }
  }, [threats, simStatus, pushNotice]);

  const clearAnalysisPending = useCallback((id) => {
    setAnalysisPending((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const startAiAnalysis = useCallback((id) => {
    const state = useStore.getState();
    const target = state.threats.find((threat) => threat.id === id);
    if (!target || !target.tracked || target.classified || target.neutralised) return;

    const cached = analysisResultsRef.current.get(id);
    if (cached) {
      if (state.selectedThreat === id) state.setAiPrediction({ ...cached, threatId: id });
      clearAnalysisPending(id);
      return;
    }
    if (analysisTimersRef.current.has(id)) return;

    setAnalysisPending((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    /* Start the model immediately (so first-inference warm-up happens in
       parallel), but hold the suggestion for a 3–5 second analysis window. */
    const runId = activeSessionId;
    const predictionPromise = classifyTrackAI(target).catch(() => null);
    const delay = 3000 + Math.floor(Math.random() * 1301);
    const timer = setTimeout(async () => {
      /* Keep the aid inside its promised 3–5 second window. If the ONNX
         session is still warming up, the built-in classifier answers now;
         later assessments use ONNX once the session is ready. */
      const prediction = (await Promise.race([
        predictionPromise,
        new Promise((resolve) => { setTimeout(() => resolve(null), 600); }),
      ])) || heuristicClassify(target);
      const latest = useStore.getState();
      const current = latest.threats.find((threat) => threat.id === id);
      if (latest.activeSessionId === runId
        && prediction
        && current
        && !current.classified
        && !current.neutralised) {
        analysisResultsRef.current.set(id, prediction);
        if (latest.selectedThreat === id) {
          latest.setAiPrediction({ ...prediction, threatId: id });
        }
      }
      analysisTimersRef.current.delete(id);
      clearAnalysisPending(id);
    }, delay);
    analysisTimersRef.current.set(id, timer);
  }, [activeSessionId, clearAnalysisPending]);

  /* A new exercise invalidates any assessment still running against the
     previous track set. */
  useEffect(() => {
    setAnalysisPending({});
    analysisResultsRef.current.clear();
    const timers = analysisTimersRef.current;
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  }, [activeSessionId]);

  useEffect(() => () => {
    const timers = analysisTimersRef.current;
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    analysisResultsRef.current.clear();
  }, []);

  useEffect(() => { setManualClassification(''); setClassifyOpen(false); }, [selectedThreat]);
  useEffect(() => { if (selectedThreat) setHasSelectedOnce(true); }, [selectedThreat]);

  // Warm up ONNX classifier in background (falls back to heuristic offline)
  useEffect(() => { warmupClassifier(); }, []);

  useEffect(() => {
    // Full View state mirrors the browser, including when fullscreen is
    // granted/denied/ended outside our button (Esc, F11, OS shortcuts).
    const handleFullscreen = () => setFullView(document.fullscreenElement === viewportRef.current);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('fullscreenerror', handleFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('fullscreenerror', handleFullscreen);
    };
  }, []);

  // Boot sequence: let the overlay paint first, then initialize the feed.
  useEffect(() => {
    let inner = null;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSceneMounted(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner != null) cancelAnimationFrame(inner);
    };
  }, []);

  useEffect(() => {
    if (!sceneReady || bootPhase !== 'boot') return undefined;
    const timer = setTimeout(() => setBootPhase('leaving'), 900);
    return () => clearTimeout(timer);
  }, [sceneReady, bootPhase]);

  useEffect(() => {
    if (bootPhase !== 'leaving') return undefined;
    const timer = setTimeout(() => setBootPhase('done'), 300);
    return () => clearTimeout(timer);
  }, [bootPhase]);

  useEffect(() => {
    const failsafe = setTimeout(() => {
      setBootPhase((phase) => (phase === 'boot' ? 'leaving' : phase));
    }, 5000);
    return () => clearTimeout(failsafe);
  }, []);

  /* Full View — the viewport element (not the page) is fullscreened, so the
   * scene HUD, overlays and the Full View button stay inside it. Every state
   * flip flows through the listeners below; the loop retries a deferred exit
   * transition and the guard prevents overlapping toggles. */
  const fsBusyRef = useRef(false);
  const toggleFullView = async () => {
    if (!viewportRef.current || fsBusyRef.current) return;
    fsBusyRef.current = true;
    try {
      if (document.fullscreenElement) {
        for (let tries = 0; tries < 3 && document.fullscreenElement; tries += 1) {
          await document.exitFullscreen().catch(() => { });
          if (document.fullscreenElement) await new Promise((r) => setTimeout(r, 500));
        }
      } else {
        await viewportRef.current.requestFullscreen();
      }
    } catch {
      /* rapid toggles can be refused by the browser; Esc always works and the
         listeners keep the button honest either way. */
    } finally {
      fsBusyRef.current = false;
    }
  };

  // Simulation loop — held until the console has finished booting, so the
  // exercise clock starts when the operator can actually see the board.
  useEffect(() => {
    if (simStatus !== 'running' || bootPhase !== 'done') return;

    const loop = (now) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      tickSimulation(Math.min(dt, 0.1));
      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [simStatus, tickSimulation, bootPhase]);

  // Radar repeater (PiP) — compact PPI scope in the corner of the EO/IR feed.
  // Reads sim state and shared echo-trail memory from refs; chrome is kept
  // minimal (no range labels, no cursor readout, designation on the selected
  // track) so it stays legible at the smaller size.
  useEffect(() => {
    const canvas = miniRadarRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const ACCENT = '85, 214, 245';
    const MONO = '"Roboto Mono", "Cascadia Mono", Consolas, monospace';

    let cw = 0, ch = 0, cx = 0, cy = 0, radius = 1, scale = 1;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cw = canvas.offsetWidth;
      ch = canvas.offsetHeight;
      canvas.width = Math.max(1, cw * dpr);
      canvas.height = Math.max(1, ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = cw / 2;
      cy = ch / 2;
      radius = Math.max(24, Math.min(cx, cy) - 14);
      scale = radius / 500;
    };
    resize();
    window.addEventListener('resize', resize);

    const clutter = Array.from({ length: 24 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.14 + Math.sqrt(Math.random()) * 0.84,
      ph: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      const { threats: ths, selectedThreat: sel, simTime: st, simStatus: status } = radarStateRef.current;
      if (cw < 40 || ch < 40) return;

      // Glass scope: the scene reads through the panel — only a faint tint
      // and edge falloff keep the PPI legible over bright terrain.
      ctx.clearRect(0, 0, cw, ch);
      const bg = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.15);
      bg.addColorStop(0, 'rgba(4, 12, 22, 0.08)');
      bg.addColorStop(1, 'rgba(3, 8, 16, 0.22)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);

      // Clutter returns
      for (const c of clutter) {
        const alpha = 0.06 + 0.08 * (0.5 + 0.5 * Math.sin(st * 6 + c.ph));
        ctx.fillStyle = `rgba(120, 205, 230, ${alpha.toFixed(3)})`;
        ctx.fillRect(cx + Math.cos(c.a) * c.r * radius, cy + Math.sin(c.a) * c.r * radius, 1.4, 1.4);
      }

      // Range rings + 30° spokes
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (i / 4), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ACCENT}, ${i === 4 ? 0.36 : 0.19})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        ctx.strokeStyle = `rgba(${ACCENT}, ${k % 3 === 0 ? 0.2 : 0.1})`;
        ctx.stroke();
      }

      // Bearing ring — 15° ticks, N marker inside the top
      const outer = radius + 6;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ACCENT}, 0.38)`;
      ctx.stroke();
      for (let d = 0; d < 360; d += 15) {
        const a = (d / 180) * Math.PI - Math.PI / 2;
        const major = d % 30 === 0;
        const len = major ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        ctx.lineTo(cx + Math.cos(a) * (outer + len), cy + Math.sin(a) * (outer + len));
        ctx.strokeStyle = `rgba(${ACCENT}, ${major ? 0.58 : 0.28})`;
        ctx.stroke();
      }
      ctx.font = `bold 8px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(165, 230, 250, 0.9)';
      ctx.fillText('N', cx, cy - radius + 9);

      // Sweep — leading edge + trailing afterglow
      const sweep = -Math.PI / 2 + ((st * 1.2566) % (Math.PI * 2));
      if (typeof ctx.createConicGradient === 'function') {
        const gradient = ctx.createConicGradient(sweep - 0.55, cx, cy);
        gradient.addColorStop(0, `rgba(${ACCENT}, 0)`);
        gradient.addColorStop(0.1, `rgba(${ACCENT}, 0.07)`);
        gradient.addColorStop(0.13, `rgba(${ACCENT}, 0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, sweep - 0.55, sweep);
        ctx.closePath();
        ctx.fillStyle = `rgba(${ACCENT}, 0.06)`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius);
      ctx.strokeStyle = 'rgba(150, 235, 255, 0.65)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.lineWidth = 1;

      // Own sensor (green, pulsing)
      ctx.beginPath();
      ctx.arc(cx, cy, 4 + 2 * (0.5 + 0.5 * Math.sin(st * 2.6)), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(70, 217, 154, 0.35)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#46d99a';
      ctx.fill();

      // Echo trails — shared memory with the full radar
      const trail = trailRef.current;
      for (const t of ths) {
        if (t.neutralised || t.visible === false) continue;
        if (Math.hypot(t.x, t.y) * scale > radius) continue;
        let arr = trail.get(t.id);
        if (!arr) { arr = []; trail.set(t.id, arr); }
        const last = arr[arr.length - 1];
        if (!last || (st - last.t > 0.14 && Math.abs(last.x - t.x) + Math.abs(last.y - t.y) > 1.2)) {
          arr.push({ x: t.x, y: t.y, t: st });
        }
        if (arr.length > 26) arr.splice(0, arr.length - 26);
      }
      for (const [id, arr] of trail) {
        while (arr.length && (st < arr[0].t || st - arr[0].t > 2.2)) arr.shift();
        if (!arr.length) { trail.delete(id); continue; }
        const owner = ths.find((th) => th.id === id);
        const color = TYPE_TINT[owner?.type] || '#ff5348';
        for (const p of arr) {
          const alpha = 0.42 * (1 - (st - p.t) / 2.2);
          ctx.globalAlpha = Math.max(0.04, alpha);
          ctx.beginPath();
          ctx.arc(cx + p.x * scale, cy + p.y * scale, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Contacts
      for (const t of ths) {
        if (t.neutralised) continue;
        if (Math.hypot(t.x, t.y) * scale > radius) continue;
        const tx = cx + t.x * scale;
        const ty = cy + t.y * scale;
        const isSelected = sel === t.id;
        const color = TYPE_TINT[t.type] || t.color || '#ff5348';

        if (t.visible === false) {
          if (isSelected) {
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.arc(tx, ty, 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(232, 176, 75, 0.8)';
            ctx.stroke();
            ctx.setLineDash([]);
          }
          continue;
        }

        if (t.tracked) {
          const vx = t.vx || 0, vy = t.vy || 0;
          const vlen = Math.hypot(vx, vy);
          if (vlen > 0.05) {
            const len = Math.min(18, 6 + vlen * scale * 6);
            const ux = vx / vlen, uy = vy / vlen;
            const ex = tx + ux * len, ey = ty + uy * len;
            const aa = Math.atan2(uy, ux);
            ctx.globalAlpha = 0.75;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(ex, ey);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 3 * Math.cos(aa - 0.5), ey - 3 * Math.sin(aa - 0.5));
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 3 * Math.cos(aa + 0.5), ey - 3 * Math.sin(aa + 0.5));
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
          }
          ctx.globalAlpha = isSelected ? 0.3 : 0.18;
          ctx.beginPath();
          ctx.arc(tx, ty, isSelected ? 7 : 5.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(tx, ty, isSelected ? 3.4 : 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          if (isSelected) {
            // Small designation plate — the right rail carries the full readout.
            const tag = trackLabel(t.id);
            ctx.font = `8px ${MONO}`;
            const tw = ctx.measureText(tag).width;
            const tagX = tx + 8, tagY = ty - 20;
            ctx.fillStyle = 'rgba(3, 9, 16, 0.78)';
            ctx.fillRect(tagX, tagY, tw + 8, 12);
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = color;
            ctx.strokeRect(tagX + 0.5, tagY + 0.5, tw + 7, 11);
            ctx.globalAlpha = 1;
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(tag, tagX + 4, tagY + 6.5);
          }
        } else {
          // Untracked plot — blinking hollow return
          ctx.globalAlpha = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(st * 4.2 + (t.x + t.y) * 0.01));
          ctx.beginPath();
          ctx.arc(tx, ty, 3, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.lineWidth = 1;
        }

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(tx, ty, 11, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${ACCENT}, 0.9)`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.lineDashOffset = -st * 22;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
          ctx.lineWidth = 1;
          ctx.strokeStyle = `rgba(${ACCENT}, 0.7)`;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            ctx.beginPath();
            ctx.moveTo(tx + dx * 13, ty + dy * 13);
            ctx.lineTo(tx + dx * 17, ty + dy * 17);
            ctx.stroke();
          }
        }
      }

      // Clock / hold stamp
      ctx.font = `8px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = status === 'paused' ? 'rgba(232, 176, 75, 0.85)' : 'rgba(175, 232, 252, 0.72)';
      ctx.fillText(status === 'paused' ? 'HOLD' : zulu(st), cw - 7, ch - 8);
      ctx.textAlign = 'left';
    };

    draw();
    const interval = setInterval(draw, 1000 / 30);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Keyboard shortcuts — scoring actions are only accepted while the exercise
  // is running, so a paused console (or a finished one) can't keep scoring.
  // Escape is the exception: it clears the current selection even while paused.
  // Never while the event originated inside a form control (the classification
  // select uses letter keys for option-typeahead). Browser/modifier combos pass.
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' || e.key === 'Esc') { selectThreat(null); return; }
      if (simStatus !== 'running') return;
      if (!selectedThreat) return;
      const t = threats.find(th => th.id === selectedThreat);
      if (!t) return;

      switch (e.key.toLowerCase()) {
        case 't': if (!t.tracked) {
          trackThreat(t.id);
          startAiAnalysis(t.id);
        } break;
        case 'c': if (t.tracked && !t.classified && aiPrediction?.threatId === t.id) {
          acceptAiClassification(t.id);
        } break;
        case 'a': if (t.classified && !t.alerted) alertThreat(t.id); break;
        case 'e': if (t.alerted && !t.neutralised && !t.engaging) engageThreat(t.id); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [simStatus, selectedThreat, threats, aiPrediction, trackThreat, startAiAnalysis, acceptAiClassification, alertThreat, engageThreat, selectThreat]);

  // Selection survives momentary sensor dropouts — the panel stays on the
  // track, but actions are held while the signal is lost.
  const currentThreat = threats.find(t => t.id === selectedThreat);
  const signalLost = Boolean(currentThreat && currentThreat.visible === false);
  const actionsLive = simStatus === 'running';
  /* Stand-down guidance appears only after the operator has correctly
   * identified the decoy or the unidentified return — never before the
   * assessment is made. */
  const confirmedDecoy = Boolean(currentThreat
    && currentThreat.type === 'decoy'
    && currentThreat.classCorrect === true);
  const confirmedUnidentified = Boolean(currentThreat
    && currentThreat.type === 'unidentified'
    && currentThreat.classCorrect === true);
  const standDown = confirmedDecoy || confirmedUnidentified;
  /* Tracks with an interceptor in flight — the bottom countdown reads from
   * this and the store resolves each kill on its own 5-second tick. */
  const engagingTracks = threats.filter(t => t.engaging && !t.neutralised);
  const secondsToImpact = (threat) => Math.max(1, Math.ceil((threat.engageResolveAt ?? simTime) - simTime));
  /* Contact/report/team-guidance cues stay Full View-only (the right rail is
   * off-screen there); the impact confirmation shows in both views. */
  const visibleNotices = fullView ? notices : notices.filter((notice) => notice.kind === 'neutralised');
  /* Which action the guidance line points at — used to highlight that button
   * so the next step is obvious at a glance. An intercept already in flight
   * has no next action. */
  const suggestedAction = !currentThreat || signalLost || !currentThreat.tracked || !currentThreat.classified
    ? null
    : currentThreat.engaging ? null
      : !currentThreat.alerted ? 'alert'
        : standDown ? 'standdown'
          : 'engage';
  const aiForThreat = aiPrediction?.threatId === currentThreat?.id ? aiPrediction : null;
  const aiAnalyzing = Boolean(currentThreat && analysisPending[currentThreat.id]);
  /* Signal strength (return quality) for the selected track: 0% beyond radar
   * coverage, rising to 100% as the drone closes on the centre. */
  const signalPct = Math.round((currentThreat?.signal ?? 0) * 100);
  const signalClass = signalPct >= 60 ? 'sig-strong' : signalPct >= 30 ? 'sig-fair' : 'sig-weak';

  const handleViewportSelect = useCallback((id) => {
    const target = threats.find(t => t.id === id);
    if (!target || target.neutralised || target.visible === false) return;
    selectThreat(id);
    /* Returning to a tracked, unassessed track restarts the aid if its
       suggestion is no longer in memory. */
    if (target.tracked && !target.classified && aiPrediction?.threatId !== id) {
      startAiAnalysis(id);
    }
  }, [threats, selectThreat, aiPrediction, startAiAnalysis]);

  const handleAcquire = useCallback((id) => {
    const target = threats.find(t => t.id === id);
    if (!target || !actionsLive || target.tracked || target.neutralised || target.visible === false) return;
    selectThreat(id);
    trackThreat(id);
    startAiAnalysis(id);
  }, [threats, actionsLive, selectThreat, trackThreat, startAiAnalysis]);

  const timeRemaining = Math.max(0, simDuration - simTime);
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  /* Scene conditions as the 3D host resolves them — shared by the EO/IR
   * feed overlay so its stamps match what is actually rendered. */
  const sceneTimeOfDay = selectedScenario?.timeOfDay === 'random' ? 'night' : (selectedScenario?.timeOfDay || 'day');
  const sceneEnvironment = selectedScenario?.environment === 'random' ? 'urban' : (selectedScenario?.environment || 'urban');
  const activeThreats = threats.filter(t => (t.detected === true || t.tracked) && !t.neutralised).length;
  const neutralised = threats.filter(t => t.neutralised).length;
  const visibleTracks = threats.filter(t => !t.neutralised && t.visible !== false).length;
  /* Contacts listed on the full-view board — anything the console has seen. */
  const contactTracks = threats.filter(t => (t.detected === true || t.tracked) && !t.neutralised);

  if (simStatus === 'idle') {
    return (
      <div className="sim-idle">
        <div className="sim-idle-panel">
          <span className="console-tag">DCATS · OPERATOR CONSOLE</span>
          <h2>No Active Training</h2>
          <p className="text-secondary">Select a training scenario from Start Training to bring the console online.</p>
          <Link to="/" className="btn btn-primary btn-lg">
            <Icon name="arrowLeft" size={14} /> Start Training
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="simulator">
      {/* Console strip — exercise identity + zulu clock. */}
      <div className="console-strip">
        <div className="console-strip-group">
          {/*  <span className="console-tag">EXERCISE 01</span> */}
          <span className="console-sim-badge"><i className="console-sim-dot" aria-hidden="true" /> SIMULATION</span>
        </div>
        <div className="console-strip-group console-strip-right">
          <span className="console-zulu">{zulu(simTime)}</span>
          <Link to="/" className="console-exit" title="Leave the console">EXIT</Link>
        </div>
      </div>

      {/* Top HUD Bar — live mission data only; exercise identity lives in
          the strip above. */}
      <div className="sim-hud-bar">
        <div className="hud-group">
          <span className="hud-label">Drones active</span>
          <span className="hud-value text-threat">{activeThreats}</span>
        </div>
        <div className="hud-group">
          <span className="hud-label">Resolved</span>
          <span className="hud-value text-safe">{neutralised}</span>
        </div>
        {/* Pause/Resume is parked over the 3D feed's top-right corner — the
            slot the countdown used to occupy. The countdown itself now lives
            on the picture (see .scene-timer). */}
        <div className="hud-controls">
          {simStatus === 'running' && (
            <button className="btn btn-outline" onClick={pauseSimulation}>
              <Icon name="pause" size={12} /> Pause
            </button>
          )}
          {simStatus === 'paused' && (
            <button className="btn btn-primary" onClick={resumeSimulation}>
              <Icon name="play" size={12} /> Resume
            </button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="sim-layout">
        {/* Viewport: EO/IR 3D feed */}
        <div className="sim-viewport">
          <div className="sim-radar-container" ref={viewportRef}>
            {!webglReady && (
              <div className="sim-degraded-note">
                <Icon name="alert" size={12} /> 3D feed unavailable on this device
              </div>
            )}
            <div className="sim-3d-host">
              {sceneMounted && (
                <Battlefield3D
                  threats={threats}
                  selectedThreat={selectedThreat}
                  onSelect={handleViewportSelect}
                  onReady={() => setSceneReady(true)}
                  onUnavailable={() => { setWebglReady(false); setSceneReady(true); }}
                  environment={sceneEnvironment}
                  timeOfDay={sceneTimeOfDay}
                  simTime={simTime}
                  cameraView={cameraView}
                  onCameraViewChange={setCameraView}
                  cameraRequest={cameraRequest}
                />
              )}
              <div className={`scene-overlay scene-overlay-${sceneTimeOfDay}`}>                <span className="scene-scanlines" aria-hidden="true" />
                <span className="scene-vignette" aria-hidden="true" />
                <span className="scene-reticle" aria-hidden="true">
                  <svg width="126" height="126" viewBox="0 0 126 126" fill="none" stroke="rgba(220, 240, 255, 0.6)" strokeWidth="1.1">
                    <line x1="63" y1="14" x2="63" y2="46" />
                    <line x1="63" y1="80" x2="63" y2="112" />
                    <line x1="14" y1="63" x2="46" y2="63" />
                    <line x1="80" y1="63" x2="112" y2="63" />
                    <rect x="58.5" y="58.5" width="9" height="9" stroke="rgba(220, 240, 255, 0.8)" />
                    <circle cx="63" cy="63" r="1.6" fill="rgba(220, 240, 255, 0.85)" stroke="none" />
                  </svg>
                </span>
                <div className="scene-overlay-top">
                  <div className="scene-top-right">
                    <span className="scene-rec">
                      <i className="scene-rec-dot" aria-hidden="true" /> REC {timecode(simTime)}
                    </span>
                    {/* Camera presets sit beside the REC stamp, top-left of
                        the feed, and open downward into the picture. */}
                    {webglReady && (
                      <div className="sim-cam-dock" role="group" aria-label="3D camera view">
                        {/* The chip names the live view — pick Top and it reads
                            Top — so the operator can tell the camera mode
                            without opening the list. */}
                        <button
                          type="button"
                          className={`sim-cam-fab${camOpen ? ' is-open' : ''}`}
                          aria-expanded={camOpen}
                          aria-label={`Camera view: ${cameraLabel}. ${camOpen ? 'Hide' : 'Show'} camera views`}
                          onClick={() => setCamOpen((open) => !open)}
                        >
                          {cameraLabel}
                        </button>
                        {camOpen && (
                          <div className="sim-cam-views">
                            {CAMERA_VIEWS.map((view) => (
                              <button
                                key={view.id}
                                type="button"
                                className={`sim-cam-view${cameraView === view.id ? ' is-active' : ''}`}
                                aria-pressed={cameraView === view.id}
                                onClick={() => chooseCameraView(view.id)}
                              >
                                {view.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Mission countdown, centred on the feed itself so the
                      operator can read time-to-impact without leaving the
                      picture. The HUD bar no longer carries a clock, so this
                      is the single time readout. */}
                  <span className={`scene-timer${timeRemaining < 30 ? ' is-low' : ''}`}>
                    <span className="scene-timer-label">Time Left</span>
                    <span className="scene-timer-value">
                      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </span>
                  </span>
                </div>
                <div className="scene-overlay-bottom">
                  {/*<div className="scene-telemetry">
                   
                  </div>*/}
                </div>
                {/* Radar repeater — compact PPI scope alongside the EO/IR feed. */}
                <div className="radar-pip" aria-label="Radar repeater — range 500 metres">
                  <canvas ref={miniRadarRef} className="radar-pip-canvas" />
                  {/*  <span className="radar-pip-label">RADAR · R 500M</span> */}
                </div>
              </div>
            </div>
            {/* Full View engagement board — glass panel carrying the four
              operator actions. It lives inside the fullscreened viewport
              because the right rail is off-screen in Full View. */}
            {fullView && simStatus !== 'complete' && (
              <div className="engage-board" role="region" aria-label="Engagement board">
                <div className="engage-board-head">
                  <span className="engage-board-title">Engagement Board</span>
                  {simStatus === 'paused' && (
                    <span className="engage-board-status is-hold">HOLD</span>
                  )}
                </div>

                {/* Same row anatomy as the right rail's Drone Board — state
                  glyph, track id, status chip, range/meta — so Full View
                  carries the same information without the rail. */}
                <div className="engage-contacts" role="list" aria-label="Detected drones">
                  {contactTracks.length === 0 && (
                    <span className="engage-empty">Scanning — no contacts</span>
                  )}
                  {contactTracks.map(t => {
                    const lost = t.visible === false;
                    const analyzing = Boolean(analysisPending[t.id]);
                    const chip = t.classified ? 'assessed' : analyzing && !lost ? 'analyzing' : t.tracked ? 'tracked' : 'new';
                    const canAcquire = !t.tracked && !lost;
                    return (
                      <div
                        key={t.id}
                        role="listitem"
                        className={`engage-contact${selectedThreat === t.id ? ' is-active' : ''}${lost ? ' is-lost' : ''}`}
                      >
                        {/* The track body is the select target; the inline Acquire
                          button sits beside it and never triggers selection. */}
                        <div
                          role="button"
                          tabIndex={lost ? -1 : 0}
                          className="engage-contact-select"
                          aria-disabled={lost}
                          aria-current={selectedThreat === t.id ? 'true' : undefined}
                          onClick={() => { if (!lost) handleViewportSelect(t.id); }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !lost) {
                              e.preventDefault();
                              handleViewportSelect(t.id);
                            }
                          }}
                        >
                          <TrackGlyph
                            state={t.classified ? 'hostile' : lost ? 'lost' : 'unknown'}
                            size={13}
                          />
                          <span className="engage-contact-main">
                            <span className="engage-contact-line">
                              <span className="engage-contact-id">{trackLabel(t.id)}</span>
                              <span className={`engage-contact-chip chip-${chip}`}>
                                {t.classified
                                  ? (THREAT_TYPES[t.classifiedAs]?.label || 'ASSESSED')
                                  : analyzing && !lost ? 'ANALYZING' : t.tracked ? 'UNKNOWN' : 'NEW'}
                              </span>
                            </span>
                            <span className={`engage-contact-meta${lost ? ' is-lost' : ''}`}>
                              {lost
                                ? 'SIGNAL LOST — REACQUISITION'
                                : t.tracked
                                  ? `RNG ${Math.round(rangeOf(t))}m`
                                  : 'UNIDENTIFIED CONTACT'}
                            </span>
                          </span>
                        </div>
                        {canAcquire && (
                          <button
                            type="button"
                            className="engage-contact-acquire"
                            disabled={!actionsLive}
                            onClick={() => handleAcquire(t.id)}
                            title="Acquire track and start automatic AI assessment"
                          >
                            Acquire
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {currentThreat ? (
                  <>
                    <div className="engage-readout">
                      <span><i>BRG</i>{String(Math.round(bearingOf(currentThreat))).padStart(3, '0')}°</span>
                      <span><i>RNG</i>{Math.round(rangeOf(currentThreat))}m</span>
                      <span><i>ALT</i>{Math.round(currentThreat.z)}m</span>
                      <span><i>SPD</i>{Math.round(speedKmhOf(currentThreat))}km/h</span>
                      <span className={signalClass}><i>SIG</i>{signalPct}%</span>
                    </div>

                    {signalLost && (
                      <div className="engage-lost">
                        <Icon name="alert" size={11} /> Signal lost — reacquisition
                      </div>
                    )}

                    <div className="engage-actions">
                      <button
                        type="button"
                        className={`engage-action${currentThreat.tracked ? ' is-done' : ''}`}
                        disabled={!actionsLive || signalLost || currentThreat.neutralised || currentThreat.tracked}
                        onClick={() => handleAcquire(currentThreat.id)}
                        title="Acquire the track and start automatic assessment"
                      >
                        {currentThreat.tracked ? 'Acquired' : 'Acquire'}
                      </button>
                      <button
                        type="button"
                        className={`engage-action${currentThreat.classified ? ' is-done' : ''}`}
                        disabled={!actionsLive || signalLost || currentThreat.neutralised || !currentThreat.tracked || currentThreat.classified}
                        onClick={() => setClassifyOpen(open => !open)}
                        title="Identify the drone"
                      >
                        {currentThreat.classified ? 'Classified' : 'Classify'}
                      </button>
                      <button
                        type="button"
                        className={`engage-action${currentThreat.alerted ? ' is-done' : ''}${suggestedAction === 'alert' ? ' is-next' : ''}`}
                        disabled={!actionsLive || signalLost || currentThreat.neutralised || !currentThreat.classified || currentThreat.alerted}
                        onClick={() => alertThreat(currentThreat.id)}
                        title="Report the threat to the team"
                      >
                        {currentThreat.alerted ? 'Reported' : 'Report'}
                      </button>
                      <button
                        type="button"
                        className={`engage-action${currentThreat.alerted && !standDown ? ' is-danger' : ''}${suggestedAction === 'engage' ? ' is-next' : ''}`}
                        disabled={!actionsLive || signalLost || currentThreat.neutralised || !currentThreat.alerted || currentThreat.engaging}
                        onClick={() => engageThreat(currentThreat.id)}
                        title={confirmedDecoy
                          ? 'Engaging a confirmed decoy wastes an interceptor'
                          : confirmedUnidentified
                            ? 'Engaging an unidentified contact risks collateral damage'
                            : currentThreat.engaging
                              ? 'Interceptor already inbound'
                              : 'Engage to neutralise the threat'}
                      >
                        {currentThreat.engaging ? 'Engaging…' : 'Engage'}
                      </button>
                    </div>

                    {classifyOpen && currentThreat.tracked && !currentThreat.classified && (
                      <div className="engage-classify">
                        {aiAnalyzing ? (
                          <span className="engage-empty">AI assessment running…</span>
                        ) : (
                          <select
                            className="engage-classify-select"
                            aria-label="Operator assessment"
                            value={manualClassification}
                            onChange={(e) => setManualClassification(e.target.value)}
                          >
                            <option value="">Select classification…</option>
                            {Object.entries(THREAT_TYPES).map(([type, info]) => (
                              <option key={type} value={type}>{info.label}</option>
                            ))}
                          </select>
                        )}
                        {aiForThreat && !aiAnalyzing && (
                          <button
                            type="button"
                            className="engage-mini"
                            disabled={!actionsLive || signalLost || currentThreat.neutralised}
                            onClick={() => { acceptAiClassification(currentThreat.id); setClassifyOpen(false); }}
                            title="Accept the AI advisory"
                          >
                            {aiForThreat.predictedType === 'unidentified'
                              ? 'Confirm Unidentified'
                              : `Accept AI ${aiForThreat.confidence}%`}
                          </button>
                        )}
                        <button
                          type="button"
                          className="engage-mini engage-mini-primary"
                          disabled={!actionsLive || signalLost || currentThreat.neutralised || !manualClassification || aiAnalyzing}
                          onClick={() => { overrideClassification(currentThreat.id, manualClassification); setClassifyOpen(false); }}
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="engage-hint">Select a contact above, or click a drone in the feed.</p>
                )}
              </div>
            )}
            {simStatus !== 'complete' && (visibleNotices.length > 0 || engagingTracks.length > 0) && (
              <div className="scene-notices" aria-label="Mission notifications">
                {visibleNotices.map((notice) => {
                  const iconName = notice.kind === 'contact' ? 'radar'
                    : notice.kind === 'team' ? 'alert'
                      : notice.kind === 'neutralised' ? 'check'
                        : notice.kind === 'guidance-hold' ? 'shield' : 'check';
                  return (
                    <div
                      key={notice.id}
                      className={`scene-notice is-${notice.kind}`}
                      role="status"
                      style={{ '--notice-life': `${notice.ttl ?? 3200}ms` }}
                    >
                      <span className="scene-notice-icon" aria-hidden="true">
                        <Icon name={iconName} size={14} />
                      </span>
                      <span className="scene-notice-copy">
                        <span className="scene-notice-title">{notice.title}</span>
                        <span className="scene-notice-body">{notice.body}</span>
                      </span>
                    </div>
                  );
                })}
                {engagingTracks.map((threat) => (
                  <div
                    key={`engage-${threat.id}`}
                    className="scene-notice is-timer"
                    role="timer"
                    aria-live="off"
                  >
                    <span className="scene-notice-icon" aria-hidden="true">
                      <Icon name="crosshair" size={14} />
                    </span>
                    <span className="scene-notice-copy">
                      <span className="scene-notice-title">Intercept inbound</span>
                      <span className="scene-notice-body">
                        {trackLabel(threat.id)} · impact in {secondsToImpact(threat)}s
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {simStatus === 'paused' && (
              <div className="sim-paused-overlay">
                <span>Training Paused</span>
              </div>
            )}
            {simStatus === 'complete' && (
              <div className="sim-complete-overlay">
                <span>Training Ended</span>
                <div className="sim-complete-actions">
                  <Link to="/aar" className="btn btn-primary btn-lg">
                    View After-Action Review <Icon name="arrowRight" size={14} />
                  </Link>
                  <button className="btn btn-outline btn-lg" onClick={retrySimulation}>Re-run Training</button>
                </div>
              </div>
            )}
            {/* Full View toggle — floats over the feed's bottom-right corner and
              lives inside the fullscreened viewport, so it stays reachable for
              exiting while everything else stays dressed in the scene HUD.
              Icon only: expand to enter, collapse to exit. */}
            <button
              type="button"
              className={`fullview-fab${fullView ? ' active' : ''}`}
              onClick={toggleFullView}
              title={fullView ? 'Exit Full View (Esc)' : 'Fill the screen with the 3D feed'}
              aria-label={fullView ? 'Exit Full View' : 'Full View'}
            >
              {fullView ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 3v5a1 1 0 0 1-1 1H3" />
                  <path d="M21 9h-5a1 1 0 0 1-1-1V3" />
                  <path d="M3 15h5a1 1 0 0 1 1 1v5" />
                  <path d="M15 21v-5a1 1 0 0 1 1-1h5" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9V4a1 1 0 0 1 1-1h5" />
                  <path d="M15 3h5a1 1 0 0 1 1 1v5" />
                  <path d="M21 15v5a1 1 0 0 1-1 1h-5" />
                  <path d="M9 21H4a1 1 0 0 1-1-1v-5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="sim-right-panel">
          {/* Contact board */}
          <div className="sim-panel card">
            <div className="section-label">Engagement Board</div>
            <div className="threat-list">
              {threats.filter(t => t.detected === true || t.tracked || t.neutralised).map(t => {
                const lost = t.visible === false;
                const analyzing = Boolean(analysisPending[t.id]);
                const glyphState = t.neutralised ? 'resolved' : lost ? 'lost' : t.classified ? 'hostile' : 'unknown';
                const canAcquire = !t.tracked && !t.neutralised && !lost;
                return (
                  <div
                    key={t.id}
                    className={`threat-list-item ${selectedThreat === t.id ? 'active' : ''} ${t.neutralised ? 'neutralised' : ''} ${lost ? 'hidden' : ''}`}
                  >
                    <div
                      role="button"
                      tabIndex={lost || t.neutralised ? -1 : 0}
                      className="contact-select"
                      aria-disabled={lost || t.neutralised}
                      onClick={() => { if (!lost && !t.neutralised) handleViewportSelect(t.id); }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !lost && !t.neutralised) {
                          e.preventDefault();
                          handleViewportSelect(t.id);
                        }
                      }}
                    >
                      <TrackGlyph state={glyphState} />
                      <div className="contact-main">
                        <div className="contact-line">
                          <span className="contact-id">{trackLabel(t.id)}</span>
                          <span className={`contact-chip ${t.classified ? 'chip-assessed' : analyzing && !lost ? 'chip-analyzing' : t.tracked ? 'chip-tracked' : 'chip-new'}`}>
                            {t.classified
                              ? (THREAT_TYPES[t.classifiedAs]?.label || 'ASSESSED').toUpperCase()
                              : analyzing && !lost ? 'ANALYZING' : t.tracked ? 'UNKNOWN' : 'NEW'}
                          </span>
                        </div>
                        <div className={`contact-meta${lost ? ' contact-meta-lost' : ''}`}>
                          {t.neutralised
                            ? `NEUTRALISED ${zulu(t.neutralisedAt)}`
                            : lost
                              ? 'SIGNAL LOST — REACQUISITION'
                              : t.tracked
                                ? `RNG ${Math.round(rangeOf(t))}m`
                                : 'UNIDENTIFIED CONTACT'}
                        </div>
                      </div>
                    </div>
                    {canAcquire && (
                      <button
                        type="button"
                        className="contact-acquire"
                        disabled={!actionsLive}
                        onClick={() => handleAcquire(t.id)}
                        title="Acquire track and start automatic AI assessment"
                      >
                        Acquire
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operator actions — response actions unlock after assessment. */}
          {currentThreat && currentThreat.tracked && currentThreat.classified && !currentThreat.neutralised && (
            <div className="sim-panel card action-panel">
              <div className="section-label action-heading">
                <span>Operator Actions — {trackLabel(currentThreat.id)}</span>
                <span
                  className="action-thumb"
                  style={{ color: TYPE_TINT_PANEL[currentThreat.classifiedAs] || 'var(--text-secondary)' }}
                  aria-hidden="true"
                >
                  <ThreatSilhouette type={currentThreat.classifiedAs} size={24} />
                </span>
              </div>
              <div className="track-readout">
                <span className="readout-item"><i>BRG</i>{String(Math.round(bearingOf(currentThreat))).padStart(3, '0')}°</span>
                <span className="readout-item"><i>RNG</i>{Math.round(rangeOf(currentThreat))}m</span>
                <span className="readout-item"><i>ALT</i>{Math.round(currentThreat.z)}m</span>
                <span className="readout-item"><i>SPD</i>{Math.round(speedKmhOf(currentThreat))}km/h</span>
                <span className={`readout-item ${signalClass}`}><i>SIG</i>{signalPct}%</span>
              </div>
              {signalLost && (
                <div className="signal-lost-note">
                  <Icon name="alert" size={12} /> SIGNAL LOST — REACQUISITION IN PROGRESS
                </div>
              )}
              <div className="next-step">
                <span className="next-step-tag">Next</span>
                <span>
                  {signalLost
                    ? 'Hold — actions resume when the drone returns'
                    : currentThreat.engaging
                      ? `Interceptor inbound — impact in ${secondsToImpact(currentThreat)}s`
                      : !currentThreat.alerted
                        ? 'Alert the team (A) about this contact'
                        : confirmedDecoy
                          ? 'Confirmed decoy — stand down; do not engage'
                          : confirmedUnidentified
                            ? 'Unidentified contact — report and hold; do not engage'
                            : 'Engage to neutralise the threat (E)'}
                </span>
              </div>
              <div className="action-buttons">
                <button
                  className={`btn ${currentThreat.alerted ? 'btn-ghost' : 'btn-outline'} ${suggestedAction === 'alert' ? 'is-suggested' : ''}`}
                  disabled={!actionsLive || currentThreat.alerted || signalLost}
                  onClick={() => alertThreat(currentThreat.id)}
                >
                  <span className="key-badge">A</span> Alert Team
                </button>
                <button
                  className={`btn ${currentThreat.alerted && actionsLive && !signalLost && !standDown ? 'btn-danger' : 'btn-outline'} ${suggestedAction === 'engage' ? 'is-suggested' : ''}`}
                  disabled={!actionsLive || !currentThreat.alerted || signalLost || currentThreat.engaging}
                  onClick={() => engageThreat(currentThreat.id)}
                  title={confirmedDecoy
                    ? 'Engaging a confirmed decoy wastes an interceptor'
                    : confirmedUnidentified
                      ? 'Engaging an unidentified contact risks collateral damage'
                      : currentThreat.engaging
                        ? 'Interceptor already inbound'
                        : undefined}
                >
                  <span className="key-badge">E</span> {currentThreat.engaging ? 'Engaging…' : 'Engage'}
                </button>
              </div>
            </div>
          )}

          {/* AI advisory and operator classification */}
          {currentThreat && currentThreat.tracked && !currentThreat.classified && (
            <div className="sim-panel card ai-panel">
              <div className="section-label">AI Assessment</div>
              {aiAnalyzing ? (
                <div className="ai-analyzing" role="status" aria-live="polite">
                  <span className="ai-analyzing-dot" aria-hidden="true" />
                  <span className="ai-analyzing-copy">
                    <span className="ai-analyzing-title">Analyzing track</span>
                    <span className="ai-analyzing-sub">Assessment aid ready in 3–5 seconds</span>
                  </span>
                </div>
              ) : (
                <>
                  {aiForThreat ? (
                    <div className="ai-prediction">
                      <div className="ai-pred-header">
                        <span className="ai-pred-thumb" style={{ color: TYPE_TINT_PANEL[aiForThreat.predictedType] }} aria-hidden="true">
                          <ThreatSilhouette type={aiForThreat.predictedType} size={40} />
                        </span>
                        <span className="ai-pred-type" style={{ color: TYPE_TINT_PANEL[aiForThreat.predictedType] }}>
                          {(THREAT_TYPES[aiForThreat.predictedType]?.label || 'Unknown').toUpperCase()}
                        </span>
                        {aiForThreat.mode === 'abstain' ? (
                          <span className="ai-confidence low">NO MATCH</span>
                        ) : (
                          <span className={`ai-confidence ${aiForThreat.confidence > 70 ? 'high' : 'low'}`}>
                            CONF {aiForThreat.confidence}%
                          </span>
                        )}
                      </div>
                      <div className="ai-mode">
                        {aiForThreat.mode === 'abstain'
                          ? 'No signature match · operator assessment required'
                          : ''}
                      </div>
                      <div className="ai-model-mode">
                        {aiForThreat.mode === 'onnx'
                          ? 'MODEL · ONNX IN-BROWSER'
                          : aiForThreat.mode === 'abstain'
                            ? 'MODEL · NO SIGNATURE MATCH'
                            : 'MODEL · BUILT-IN CLASSIFIER'}
                      </div>
                    </div>
                  ) : (
                    <p className="ai-explanation">Assessment aid unavailable. Classify the drone yourself.</p>
                  )}
                  <div className="classification-choice">
                    <label className="ai-choice-label" htmlFor="trainee-classification">Identify track</label>
                    <select
                      id="trainee-classification"
                      className="classification-select"
                      value={manualClassification}
                      onChange={(e) => setManualClassification(e.target.value)}
                    >
                      <option value="">Select classification…</option>
                      {Object.entries(THREAT_TYPES).map(([type, info]) => (
                        <option key={type} value={type}>{info.label}</option>
                      ))}
                    </select>
                    <div className="classification-actions">
                      <button
                        className="btn btn-primary"
                        disabled={!actionsLive || !aiForThreat || signalLost}
                        onClick={() => acceptAiClassification(currentThreat.id)}
                      >
                        Accept Advisory
                      </button>
                      <button
                        className="btn btn-outline"
                        disabled={!actionsLive || !manualClassification || signalLost}
                        onClick={() => overrideClassification(currentThreat.id, manualClassification)}
                      >
                        Submit Assessment
                      </button>
                    </div>
                    {/* <p className="ai-choice-note">The operator's assessment is authoritative and always scored. Disagreeing with the aid carries no penalty.</p> */}
                  </div>
                  {aiForThreat && (
                    <div className="ai-details">
                      {/*<p className="ai-explanation">Assessment derived from the track's motion profile, signal return and height.</p> */}
                      <details className="technical-details">
                        <summary>Show technical details</summary>
                        <div className="ai-features">
                          {Object.entries(aiForThreat.features || {}).map(([k, v]) => (
                            <div key={k} className="ai-feature-row">
                              <span className="ai-feature-key">{k}</span>
                              <span className="ai-feature-val">{v}</span>
                            </div>
                          ))}
                        </div>
                        <p className="ai-explanation">{aiForThreat.explanation}</p>
                      </details>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Sitrep Log */}
      <div className="sim-event-log card">
        <div className="section-label">Sitrep Log</div>
        <div className="event-log-entries">
          {events.slice(-8).reverse().map((ev) => (
            <div key={`${ev.type}-${ev.threatId}-${ev.time}`} className="event-entry">
              <span className={`event-dot event-dot-${ev.type}`} aria-hidden="true" />
              <span className="event-text"><EventSentence ev={ev} /></span>
              <span className="event-time">{zulu(ev.time)}</span>
            </div>
          ))}
          {events.length === 0 && <span className="text-muted">No activity yet — acquire a drone to begin.</span>}
        </div>
      </div>

      {/* Console boot — holds until the feed is live, then fades away. */}
      {bootPhase !== 'done' && (
        <div
          className={`sim-boot-overlay${bootPhase === 'leaving' ? ' is-leaving' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="sim-boot-panel">
            <span className="sim-boot-brand">DCATS</span>
            <span className="sim-boot-title">Initializing Simulator</span>
            <span className="sim-boot-sub">Please wait</span>
            <span className="sim-boot-bar" aria-hidden="true"><span /></span>
            {/*  <span className="sim-boot-meta">Powering operator console · Exercise 01</span>*/}
          </div>
        </div>
      )}
    </div>
  );
}
