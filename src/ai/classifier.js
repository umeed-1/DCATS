/**
 * DCATS — classifier.js
 * ONNX threat classifier wrapper with offline rule-based fallback.
 *
 * Production path: loads `public/models/threat_classifier.onnx`
 * via onnxruntime-web and runs snapshot-feature inference.
 * Fallback path: deterministic heuristic whose decision boundaries match
 * the simulation's declared per-type envelopes (src/store.js THREAT_TYPES),
 * so the demo and judges always see an explainable prediction even before
 * `backend/model/train_model.py` has been run.
 */

function modelUrl() {
  return new URL('models/threat_classifier.onnx', document.baseURI).href;
}

let sessionPromise = null;

async function getSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    try {
      // No model built, or a non-web origin where fetch cannot reach local
      // files — fall back to the built-in classifier. The packaged Electron
      // app serves its bundle over app:// (electron/protocol.cjs), so ONNX
      // loads there exactly as it does over http(s).
      const hasModel = typeof __HAS_ONNX_MODEL__ !== 'undefined' && __HAS_ONNX_MODEL__;
      if (!hasModel || !/^(https?|app):$/.test(window.location.protocol)) {
        return { ort: null, session: null, mode: 'heuristic' };
      }
      const ort = await import('onnxruntime-web');
      const session = await ort.InferenceSession.create(modelUrl());
      return { ort, session, mode: 'onnx' };
    } catch {
      return { ort: null, session: null, mode: 'heuristic' };
    }
  })();
  return sessionPromise;
}

const CLASSES = ['scout', 'cargo', 'kamikaze', 'ewJammer', 'decoy', 'swarmNode'];

const LABELS = {
  scout: 'Scout', cargo: 'Cargo', kamikaze: 'Kamikaze',
  ewJammer: 'EW Jammer', decoy: 'Decoy', swarmNode: 'Swarm Node',
  unidentified: 'Unidentified',
};

/**
 * Heuristic classifier — decision boundaries mirror the simulation's
 * declared per-type envelopes (src/store.js THREAT_TYPES) and the trained RF.
 * Deterministic given threat + optional noise function (for tests).
 *
 * Unidentified/ambiguous returns abstain with a low confidence instead of
 * being forced into one of the known drone classes — the operator makes the
 * call. The real ONNX model has no class for them, so `classifyThreat()`
 * routes them here before inference.
 */
export function heuristicClassify(threat, rand = Math.random) {
  const { speed = 20, rcs = 0.05, z = 100 } = threat;
  let predicted;
  let confidence;

  const trajectoryClass = speed > 35 ? 'aggressive' : speed > 20 ? 'transit' : 'surveillance';

  // Feature importances from the trained RF (public/models/threat_classifier.meta.json)
  const importances = [
    { feature: 'rcs', weight: 0.64 },
    { feature: 'speed', weight: 0.29 },
    { feature: 'manoeuvre', weight: 0.06 },
    { feature: 'altitude', weight: 0.01 },
  ];

  if (threat.ambiguous || threat.type === 'unidentified') {
    return {
      predictedType: 'unidentified',
      // Deliberately low: this is an abstention, not a classification.
      confidence: 34 + Math.floor(rand() * 12),
      mode: 'abstain',
      features: {
        speed: Math.round(speed),
        rcs: Number(rcs).toFixed(4),
        altitude: Math.round(z),
        trajectoryClass: 'ambiguous',
      },
      importances,
      explanation:
        `No signature match (speed=${Math.round(speed)}m/s, ` +
        `RCS=${Number(rcs).toFixed(4)}m², altitude=${Math.round(z)}m) — ` +
        'the return may be a drone or may not. Operator assessment required.',
    };
  }

  // Tiny-RCS check first: swarm nodes overlap the kamikaze speed band
  // (both can fly at 40–45 m/s), but their RCS envelopes do not overlap.
  if (rcs <= 0.007) { predicted = 'swarmNode'; confidence = 74 + Math.floor(rand() * 14); }
  else if (speed >= 40) { predicted = 'kamikaze'; confidence = 82 + Math.floor(rand() * 12); }
  else if (rcs >= 0.08) { predicted = speed <= 20 ? 'cargo' : 'decoy'; confidence = 68 + Math.floor(rand() * 15); }
  else if (rcs >= 0.062) { predicted = 'decoy'; confidence = 70 + Math.floor(rand() * 14); }
  else if (rcs >= 0.03) { predicted = 'ewJammer'; confidence = 66 + Math.floor(rand() * 14); }
  else { predicted = 'scout'; confidence = 64 + Math.floor(rand() * 14); }

  return {
    predictedType: predicted,
    confidence,
    mode: 'heuristic',
    features: {
      speed: Math.round(speed),
      rcs: Number(rcs).toFixed(4),
      altitude: Math.round(z),
      trajectoryClass,
    },
    importances,
    explanation:
      `Based on speed=${Math.round(speed)}m/s, RCS=${Number(rcs).toFixed(4)}m², ` +
      `altitude=${Math.round(z)}m → ${LABELS[predicted]} (${confidence}% confidence)`,
  };
}

/**
 * Classify a threat. Tries ONNX first, falls back to heuristic.
 * Ambiguous/unidentified returns abstain before inference — the ONNX model
 * only knows the six confirmed drone classes and would otherwise return a
 * confident wrong label for them.
 * @param {object} threat - { speed, rcs, z, x, y, vx, vy }
 */
export async function classifyThreat(threat) {
  if (threat?.ambiguous || threat?.type === 'unidentified') return heuristicClassify(threat);
  const { ort, session, mode } = await getSession();
  if (mode === 'heuristic' || !session) return heuristicClassify(threat);

  try {
    const input = new ort.Tensor('float32', Float32Array.from([
      threat.speed ?? 20, threat.rcs ?? 0.05, threat.z ?? 100,
      threat.vx ?? 0, threat.vy ?? 0,
      (threat.speed ?? 20) > 35 ? 1 : 0,
    ]), [1, 6]);
    const out = await session.run({ input });
    // skl2onnx exports [label, probabilities]; with zipmap disabled the
    // probability output is a plain [1, 6] tensor — select it by length so the
    // lookup is robust to skl2onnx naming changes.
    const probKey = Object.keys(out).find((k) => (out[k]?.data?.length ?? 0) === CLASSES.length);
    if (!probKey) return heuristicClassify(threat);
    const scores = Array.from(out[probKey].data);
    let best = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    // RandomForest emits normalised probabilities; softmax only applies to raw logits.
    const looksLikeProbs =
      scores.every((s) => s >= 0 && s <= 1) &&
      Math.abs(scores.reduce((a, b) => a + b, 0) - 1) < 0.05;
    let confidence;
    if (looksLikeProbs) {
      confidence = Math.round(scores[best] * 100);
    } else {
      const sum = scores.reduce((a, b) => a + Math.exp(b), 0);
      confidence = Math.round((Math.exp(scores[best]) / sum) * 100);
    }
    const base = heuristicClassify(threat);
    const predictedType = CLASSES[best] ?? base.predictedType;
    return {
      ...base,
      predictedType,
      confidence,
      mode: 'onnx',
      explanation:
        `Based on speed=${Math.round(threat.speed ?? 20)}m/s, ` +
        `RCS=${Number(threat.rcs ?? 0.05).toFixed(4)}m², ` +
        `altitude=${Math.round(threat.z ?? 100)}m → ${LABELS[predictedType] ?? predictedType} ` +
        `(${confidence}% confidence)`,
    };
  } catch {
    return heuristicClassify(threat);
  }
}

/** Prefetch model in background (call on app boot). */
export function warmupClassifier() {
  getSession().catch(() => {});
}

/**
 * Resolve which backend serving classifyThreat() uses — 'onnx' (loaded
 * model) or 'heuristic' (built-in fallback). Resolves once the warmup
 * promise does; call after warmupClassifier() for an accurate answer.
 */
export async function classifierMode() {
  const { mode } = await getSession();
  return mode;
}

export default { classifyThreat, heuristicClassify, warmupClassifier, classifierMode, CLASSES };
