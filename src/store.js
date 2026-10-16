import { create } from 'zustand';
import { persistSession } from './scoring/AAREngine';
import { readSession } from './profile';
import {
  aggregateThreatScores,
} from './scoring/DecisionTree';
import {
  updateThreatPosition, sensorAvailableAt, sampleVisibility, signalStrength, SIM_RANGE,
} from './simulation/SwarmAI';
import { generateProceduralScenario } from './ai/scenarioGen';
import { classifyThreat as classifyTrackAI } from './ai/classifier';

const THREAT_TYPES = {
  scout: { label: 'Scout', color: '#9A6700', rcs: 0.01, speed: [15, 35] },
  cargo: { label: 'Cargo', color: '#1E7B4F', rcs: 0.1, speed: [8, 20] },
  kamikaze: { label: 'Kamikaze', color: '#B3261E', rcs: 0.02, speed: [40, 80] },
  ewJammer: { label: 'EW Jammer', color: '#61407F', rcs: 0.05, speed: [10, 25] },
  decoy: { label: 'Decoy', color: '#B2551B', rcs: 0.08, speed: [20, 40] },
  swarmNode: { label: 'Swarm Node', color: '#8C1D18', rcs: 0.005, speed: [20, 45] },
  // A return with no matching signature. It may be a drone, or it may not —
  // the training point is to report it and hold fire until it is confirmed.
  // Its wide speed/RCS envelopes deliberately overlap several known types.
  unidentified: { label: 'Unidentified', color: '#475569', rcs: 0.045, speed: [5, 60] },
};

const SCENARIOS = [
  {
    id: 'basic-recon',
    name: 'Basic Reconnaissance',
    description: 'Two scout drones surveying a rural area. Clear conditions, high sensor quality.',
    environment: 'rural',
    timeOfDay: 'day',
    difficulty: 1,
    sensorQuality: 0.95,
    threats: [
      { type: 'scout', count: 2 },
    ],
    duration: 90,
    code: 'Mission 01',
  },
  {
    id: 'urban-patrol',
    name: 'Urban Grid Patrol',
    description: 'Mixed threat package over urban terrain. Medium sensor quality.',
    environment: 'urban',
    timeOfDay: 'day',
    difficulty: 2,
    sensorQuality: 0.8,
    threats: [
      { type: 'scout', count: 1 },
      { type: 'cargo', count: 1 },
      { type: 'decoy', count: 1 },
    ],
    duration: 120,
    code: 'Mission 02',
  },
  {
    id: 'night-swarm',
    name: 'Night Swarm Assault',
    description: 'Coordinated swarm attack under cover of darkness. Night vision degraded.',
    environment: 'urban',
    timeOfDay: 'night',
    difficulty: 4,
    sensorQuality: 0.6,
    threats: [
      { type: 'swarmNode', count: 8 },
    ],
    duration: 120,
    code: 'Mission 03',
  },
  {
    id: 'degraded-ops',
    name: 'Degraded Operations',
    description: 'Mixed threats in forest terrain with heavy EW jamming. Sensor quality severely degraded.',
    environment: 'forest',
    timeOfDay: 'dusk',
    difficulty: 4,
    sensorQuality: 0.3,
    threats: [
      { type: 'ewJammer', count: 1 },
      { type: 'kamikaze', count: 2 },
      { type: 'decoy', count: 1 },
      { type: 'unidentified', count: 1 },
    ],
    duration: 150,
    code: 'Mission 04',
  },
  {
    id: 'full-spectrum',
    name: 'Full Spectrum Threat',
    description: 'All threat types at night with EW jamming. Maximum difficulty.',
    environment: 'mixed',
    timeOfDay: 'night',
    difficulty: 5,
    sensorQuality: 0.2,
    threats: [
      { type: 'scout', count: 2 },
      { type: 'cargo', count: 1 },
      { type: 'kamikaze', count: 2 },
      { type: 'ewJammer', count: 1 },
      { type: 'decoy', count: 1 },
      { type: 'swarmNode', count: 5 },
      { type: 'unidentified', count: 1 },
    ],
    duration: 180,
    code: 'Mission 05',
  },
  {
    id: 'advanced-swarm',
    name: 'Advanced Swarm Tactics',
    description: '20-node coordinated swarm with dynamic formation changes. Extreme difficulty.',
    environment: 'urban',
    timeOfDay: 'night',
    difficulty: 5,
    sensorQuality: 0.25,
    threats: [
      { type: 'swarmNode', count: 20 },
    ],
    duration: 180,
    code: 'Mission 06',
  },
  {
    id: 'logistics-raid',
    name: 'Logistics Raid',
    description: 'Cargo drones escorted by kamikaze units. Protect the supply depot.',
    environment: 'rural',
    timeOfDay: 'day',
    difficulty: 3,
    sensorQuality: 0.85,
    threats: [
      { type: 'cargo', count: 3 },
      { type: 'kamikaze', count: 2 },
    ],
    duration: 120,
    code: 'Mission 07',
  },
  {
    id: 'unknown-contact',
    name: 'Unknown Contact',
    description: 'A return with no matching drone signature appears over mixed terrain. Identify it, report it, and decide whether to hold fire.',
    environment: 'mixed',
    timeOfDay: 'dusk',
    difficulty: 3,
    sensorQuality: 0.7,
    threats: [
      { type: 'unidentified', count: 2 },
      { type: 'scout', count: 1 },
    ],
    duration: 120,
    code: 'Mission 08',
  },
  {
    id: 'procedural',
    name: 'Procedural Generation',
    description: 'Randomised threat mix, terrain, and conditions. No two runs are the same.',
    environment: 'random',
    timeOfDay: 'random',
    difficulty: 0,
    sensorQuality: 0,
    threats: [],
    duration: 150,
    code: 'Mission 09',
  },
];

// Ids are generated locally for in-memory tracks and sessions; no collision
// guarantees needed beyond a run.
const generateId = () => Math.random().toString(36).slice(2, 11);
const emptyScore = () => ({ detection: 0, classification: 0, engagement: 0, collateral: 100, total: 0 });
const isSelectableThreat = (threat) => Boolean(threat && !threat.neutralised && threat.visible !== false);

/* Time from "Engage" to impact. The countdown, the homing interceptor and the
 * store resolution all share this window, so the visual kill and the log entry
 * land on the same tick. */
const ENGAGE_RESOLVE_SECONDS = 5;

const useStore = create((set, get) => ({
  // === App State ===
  currentPage: 'landing',
  
  // === Scenario ===
  scenarios: SCENARIOS,
  selectedScenario: null,
  // Unknown ids leave the current selection untouched instead of storing
  // an undefined scenario (which the console would render as "Unknown").
  selectScenario: (id) => set((state) => {
    const found = SCENARIOS.find(s => s.id === id);
    return found ? { selectedScenario: found } : state;
  }),

  // === Simulation State ===
  simStatus: 'idle', // idle | briefing | running | paused | complete
  simTime: 0,
  simDuration: 120,
  threats: [],
  selectedThreat: null,
  events: [],
  score: emptyScore(),
  activeSessionId: null,
  lastSession: null,
  lastArchivedSessionId: null,

  // === Sensor Config ===
  // sensorLatency is in simulation SECONDS (consistent with simTime). The
  // instructor console enters it in milliseconds and converts on launch.
  sensorSNR: 0.9,
  sensorDropout: 0.05,
  sensorLatency: 0,

  // === Simulation Control ===
  startSimulation: (scenario, sensorOverrides = {}) => {
    const sc = scenario || get().selectedScenario;
    if (!sc) return;

    const resolvedScenario = sc.id === 'procedural' ? generateProceduralScenario() : sc;
    const sensorConfig = {
      sensorSNR: sensorOverrides.sensorSNR ?? resolvedScenario.sensorQuality,
      sensorDropout: sensorOverrides.sensorDropout ?? 0.05,
      sensorLatency: sensorOverrides.sensorLatency ?? 0,
    };
    const generatedThreats = generateThreats(resolvedScenario, sensorConfig);

    set({
      simStatus: 'running',
      simTime: 0,
      simDuration: resolvedScenario.duration,
      threats: generatedThreats,
      selectedThreat: null,
      events: [],
      score: emptyScore(),
      aiPrediction: null,
      activeSessionId: generateId(),
      lastSession: null,
      lastArchivedSessionId: null,
      // Instructor console overrides win over the scenario defaults.
      ...sensorConfig,
      selectedScenario: resolvedScenario,
    });
  },

  pauseSimulation: () => set({ simStatus: 'paused' }),
  resumeSimulation: () => set({ simStatus: 'running' }),

  endSimulation: () => {
    const state = get();
    if (state.simStatus === 'complete') return state.lastSession;
    if (state.simStatus !== 'running' && state.simStatus !== 'paused') return null;

    const finalScore = aggregateThreatScores(state.threats);
    const session = {
      id: state.activeSessionId ?? generateId(),
      traineeId: state.traineeId ?? readSession()?.userId ?? null,
      scenario: state.selectedScenario?.id ?? 'unknown',
      scenarioName: state.selectedScenario?.name ?? 'Unknown',
      score: finalScore,
      eventCount: state.events.length,
      threatCount: state.threats.length,
      neutralised: state.threats.filter(t => t.neutralised).length,
      simTime: Math.round(state.simTime),
      date: new Date().toISOString(),
      sensorSNR: state.sensorSNR,
      sensorDropout: state.sensorDropout,
      sensorLatency: state.sensorLatency,
      scenarioConfig: {
        id: state.selectedScenario?.id ?? 'unknown',
        name: state.selectedScenario?.name ?? 'Unknown',
        environment: state.selectedScenario?.environment,
        timeOfDay: state.selectedScenario?.timeOfDay,
        difficulty: state.selectedScenario?.difficulty,
        duration: state.selectedScenario?.duration,
        threats: state.selectedScenario?.threats,
      },
      // Keep the complete evidence trail so an instructor can export, import,
      // and audit a run without relying on the current in-memory Zustand state.
      details: {
        events: state.events,
        threats: state.threats,
      },
    };

    let archived = false;
    set((current) => {
      if (current.simStatus === 'complete' || current.lastArchivedSessionId === session.id) return current;
      archived = true;
      return {
        simStatus: 'complete',
        score: finalScore,
        lastSession: session,
        lastArchivedSessionId: session.id,
        sessionHistory: [...current.sessionHistory, session],
      };
    });

    // Offline-first persistence (IndexedDB → localStorage fallback)
    if (archived) persistSession(session).catch(() => {});
    return session;
  },

  // AAR can call this action to leave a completed mission without carrying
  // its tracks/events into the next run. The Simulator also exposes retry.
  resetSimulation: () => set((state) => ({
    simStatus: 'idle',
    simTime: 0,
    threats: [],
    selectedThreat: null,
    events: [],
    score: emptyScore(),
    aiPrediction: null,
    activeSessionId: null,
    lastSession: null,
    lastArchivedSessionId: null,
    selectedScenario: state.selectedScenario,
  })),

  retrySimulation: () => {
    const { selectedScenario, sensorSNR, sensorDropout, sensorLatency } = get();
    if (selectedScenario) {
      get().startSimulation(selectedScenario, { sensorSNR, sensorDropout, sensorLatency });
    }
  },

  tickSimulation: (dt) => {
    const {
      simStatus, simTime, simDuration, threats,
      sensorSNR, sensorDropout, sensorLatency, selectedThreat,
    } = get();
    if (simStatus !== 'running') return;

    const newTime = simTime + dt;
    const clampedTime = Math.min(newTime, simDuration);

    // Update threat positions using Boids movement + sensor model.
    // A track holds its ingress position beyond the coverage ring until its
    // spawn time, so the package arrives one at a time. Only entered tracks
    // are neighbours for the flocking step, so parked ingress tracks cannot
    // drag the entered group off course.
    const entered = threats.filter(t => !t.neutralised && newTime >= t.spawnTime);
    const updatedThreats = threats.map(t => {
      if (t.neutralised) return t;
      const updated = newTime >= t.spawnTime
        ? updateThreatPosition(t, entered, dt)
        : { ...t };
      // Return strength falls off with range: strong up close, fading to
      // nothing at the coverage edge, so detection follows the drone in.
      updated.signal = sensorSNR * signalStrength(Math.hypot(updated.x, updated.y));
      updated.sensorAvailableAt = sensorAvailableAt(t.spawnTime, sensorLatency);
      const sample = sampleVisibility({
        simTime: newTime,
        spawnTime: t.spawnTime,
        latency: sensorLatency,
        snr: updated.signal,
        dropout: sensorDropout,
        prevVisible: t.visible !== false,
        nextSampleAt: t.nextSampleAt,
      });
      // An acquired track is held: once the operator has locked on, a sensor
      // dropout must not make the drone vanish from the board mid-engagement.
      updated.visible = t.tracked ? true : sample.visible;
      updated.detected = t.detected === true || updated.visible;
      updated.nextSampleAt = sample.nextSampleAt;
      return updated;
    });

    // Resolve an intercept after its flight. The threat keeps moving until
    // this tick, so the homing missile has a live target; the neutralise
    // event is stamped at impact, not at launch.
    const resolvedThreats = updatedThreats.map(t => {
      if (!t.engaging || t.neutralised || t.engageResolveAt == null || newTime < t.engageResolveAt) return t;
      return {
        ...t,
        engaging: false,
        neutralised: true,
        neutralisedAt: t.engageResolveAt,
      };
    });
    const resolvedNow = resolvedThreats.filter((t, index) => (
      t.neutralised && !updatedThreats[index].neutralised
    ));
    const resolvedScore = resolvedNow.length ? aggregateThreatScores(resolvedThreats) : null;
    const resolvedEvents = resolvedScore == null
      ? []
      : resolvedNow.map(t => ({
        type: 'engage',
        threatId: t.id,
        time: t.neutralisedAt ?? newTime,
        score: resolvedScore,
      }));

    // A momentary sensor dropout must not yank the operator's selection —
    // only a resolved (neutralised) or missing track ends it. Track/assess
    // actions remain guarded by visibility inside the store actions.
    const selectedTrack = selectedThreat == null
      ? null
      : resolvedThreats.find((threat) => threat.id === selectedThreat);
    const selectionEnded = selectedThreat != null
      && (!selectedTrack || selectedTrack.neutralised);
    set({
      // Clamp the clock to the mission duration: the final tick still applies
      // its movement/visibility update before the mission closes (no snap).
      simTime: clampedTime,
      threats: resolvedThreats,
      ...(resolvedEvents.length ? {
        events: [...get().events, ...resolvedEvents],
        score: resolvedScore,
      } : {}),
      selectedThreat: selectionEnded ? null : selectedThreat,
      aiPrediction: selectionEnded ? null : get().aiPrediction,
    });

    if (newTime >= simDuration) get().endSimulation();
  },

  // === Operator Actions ===
  selectThreat: (id) => set((state) => {
    if (id == null) return { selectedThreat: null, aiPrediction: null };
    const target = state.threats.find((threat) => threat.id === id);
    if (!isSelectableThreat(target)) return { selectedThreat: null, aiPrediction: null };
    return {
      selectedThreat: id,
      aiPrediction: state.selectedThreat === id ? state.aiPrediction : null,
    };
  }),

  // Mutating operator actions are live only while the exercise is running.
  // This keeps the archived session snapshot (taken when the mission ends)
  // identical to what the operator can still influence afterwards.
  trackThreat: (id) => {
    const { simTime, sensorLatency, simStatus } = get();
    if (simStatus !== 'running') return;
    set((state) => {
      const target = state.threats.find((threat) => threat.id === id);
      if (!isSelectableThreat(target) || target.tracked) return state;
      const threats = state.threats.map((threat) => (
        threat.id === id
          ? { ...threat, tracked: true, trackedAt: simTime, visible: true, detected: true }
          : threat
      ));
       const event = {
         type: 'track',
         threatId: id,
         time: simTime,
         sensorLatency,
       };
       const score = aggregateThreatScores(threats);
       event.score = score;
       return {
         threats,
         events: [...state.events, event],
         score,
      };
    });
  },

  classifyThreat: (id, classification, options = {}) => {
    const { simTime, threats: currentThreats, simStatus } = get();
    if (simStatus !== 'running') return false;
    const threat = currentThreats.find(t => t.id === id);
    if (!isSelectableThreat(threat) || !threat.tracked || threat.classified || !THREAT_TYPES[classification]) return false;

    const correct = classification === threat.type;
    const source = options.source ?? 'trainee';
    set((state) => {
      const threats = state.threats.map(t => (
        t.id === id
          ? {
            ...t,
            classified: true,
            classifiedAs: classification,
            classCorrect: correct,
            classificationSource: source,
          }
          : t
      ));
       const event = {
         type: 'classify',
        threatId: id,
        time: simTime,
        classification,
        correct,
        source,
         aiPredictedType: options.aiPredictedType ?? null,
       };
       const score = aggregateThreatScores(threats);
       event.score = score;
       return {
         threats,
         events: [...state.events, event],
         score,
      };
    });
    return true;
  },

  acceptAiClassification: (id) => {
    const { aiPrediction } = get();
    if (!aiPrediction || aiPrediction.threatId !== id) return false;
    return get().classifyThreat(id, aiPrediction.predictedType, {
      source: 'ai-accepted',
      aiPredictedType: aiPrediction.predictedType,
    });
  },

  overrideClassification: (id, classification) => get().classifyThreat(id, classification, {
    source: 'trainee-override',
    aiPredictedType: get().aiPrediction?.threatId === id ? get().aiPrediction.predictedType : null,
  }),

  setAiPrediction: (pred) => set({ aiPrediction: pred }),

  // === AI Prediction (ONNX in-browser, heuristic fallback) ===
  aiPrediction: null,

  predictThreat: async (threatId) => {
    const threat = get().threats.find(t => t.id === threatId);
    if (!isSelectableThreat(threat)) return null;
    const pred = await classifyTrackAI(threat);
    const latest = get().threats.find(t => t.id === threatId);
    if (!isSelectableThreat(latest)) return null;
    const advisory = { ...pred, threatId };
    if (get().selectedThreat === threatId) set({ aiPrediction: advisory });
    return advisory;
  },

  alertThreat: (id) => {
    const { simTime, simStatus } = get();
    if (simStatus !== 'running') return;
    set((state) => {
      const target = state.threats.find((threat) => threat.id === id);
      if (!isSelectableThreat(target) || !target.classified || target.alerted) return state;
      const threats = state.threats.map(t => (
        t.id === id ? { ...t, alerted: true, alertedAt: simTime } : t
      ));
       const score = aggregateThreatScores(threats);
       const event = { type: 'alert', threatId: id, time: simTime, score };
       return { threats, events: [...state.events, event], score };
    });
  },

  engageThreat: (id) => {
    const { simTime, threats: currentThreats, simStatus } = get();
    if (simStatus !== 'running') return null;
    const threat = currentThreats.find(t => t.id === id);
    if (!isSelectableThreat(threat) || !threat.alerted || threat.engaging) return null;

    set((state) => {
      const current = state.threats.find((target) => target.id === id);
      if (!current || current.neutralised || current.engaging) return state;
      const threats = state.threats.map(t => (
        t.id === id
          ? {
            ...t,
            engaging: true,
            engageStartedAt: simTime,
            engageResolveAt: simTime + ENGAGE_RESOLVE_SECONDS,
          }
          : t
      ));
      return {
        threats,
        // Keep the target selected so Chase stays on the intercept; the
        // engaging flag locks the action buttons until the impact tick.
        aiPrediction: null,
      };
    });
    return null;
  },

  // === Session History ===
  traineeId: null,
  sessionHistory: [],
  /**
   * Switching profiles must never leak one trainee's runs into another's
   * plan. Sessions are tagged at archive time; untagged legacy entries stay
   * in the instructor archive only.
   */
  setActiveTrainee: (traineeId) => set((state) => {
    const key = String(traineeId ?? '').trim().toLowerCase();
    const previous = String(state.traineeId ?? '').trim().toLowerCase();
    if (key === previous) return state;
    return {
      traineeId: traineeId ?? null,
      sessionHistory: key
        ? state.sessionHistory.filter(
            (session) => String(session.traineeId ?? '').trim().toLowerCase() === key
          )
        : [],
    };
  }),
  addSession: (session) => set((state) => {
    if (session?.id && state.sessionHistory.some((existing) => existing.id === session.id)) return state;
    return { sessionHistory: [...state.sessionHistory, session] };
  }),
}));

// === Helper Functions ===

function generateThreats(scenario, sensorConfig = {}) {
  const sensorLatency = sensorConfig.sensorLatency ?? 0;

  // Expand the package into individual tracks, then shuffle so the types
  // interleave around the perimeter instead of arriving in same-type blocks.
  const types = [];
  for (const tDef of scenario.threats) {
    for (let i = 0; i < tDef.count; i++) types.push(tDef.type);
  }
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  const total = types.length || 1;
  const slot = (Math.PI * 2) / total;
  // Drones arrive one at a time: the package is spread across the first ~65%
  // of the mission, each track getting its own entry window. The jitter stays
  // under half a gap so the arrival order never swaps.
  const duration = Math.max(30, Number(scenario.duration) || 120);
  const spawnGap = Math.min(9, Math.max(3.5, (duration * 0.65) / total));

  return types.map((type, index) => {
    const typeInfo = THREAT_TYPES[type];
    // Even angular slots guarantee the tracks ingress well apart; jitter of up
    // to 30% of a slot keeps the ring from looking mechanically regular while
    // never letting two neighbours meet.
    const angle = index * slot + (Math.random() - 0.5) * slot * 0.6;
    // Every drone starts beyond the coverage ring and flies in, so it enters
    // from outside the boundary and its return builds as it closes on centre.
    const dist = SIM_RANGE + 25 + Math.random() * 70;
    const spawnTime = Math.max(0, 2 + index * spawnGap + (Math.random() - 0.5) * spawnGap * 0.6);
    const availableAt = sensorAvailableAt(spawnTime, sensorLatency);
    return {
      id: `t-${index}`,
      type,
      label: typeInfo.label,
      color: typeInfo.color,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      z: 50 + Math.random() * 150,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      speed: typeInfo.speed[0] + Math.random() * (typeInfo.speed[1] - typeInfo.speed[0]),
      rcs: typeInfo.rcs * (0.8 + Math.random() * 0.4),
      spawnTime,
      sensorAvailableAt: availableAt,
      // Effective return strength (0..1) for the operator readout. Recomputed
      // each tick from the track's range; starts at zero outside coverage.
      signal: 0,
      // First visibility sample is drawn on the first tick at/after the
      // track becomes available; the hold cadence runs from there.
      visible: false,
      // Sticky flag: the operator console lists a track only after it has
      // been detected at least once.
      detected: false,
      nextSampleAt: availableAt,
      tracked: false,
      classified: false,
      classifiedAs: null,
      classCorrect: false,
      alerted: false,
      // An intercept takes ENGAGE_RESOLVE_SECONDS to fly; the threat keeps
      // moving until that tick and is only neutralised on impact.
      engaging: false,
      engageStartedAt: null,
      engageResolveAt: null,
      neutralised: false,
      // Unidentified returns carry no confirmable signature: the classifier
      // abstains instead of forcing them into a known drone class.
      ambiguous: type === 'unidentified',
    };
  });
}

export { THREAT_TYPES, SCENARIOS };
export default useStore;
