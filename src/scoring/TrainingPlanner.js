/**
 * DCATS — TrainingPlanner.js
 * The AI Training Advisor: turns a trainee's performance (the session just
 * flown plus archived history on this machine) into a personalised training
 * plan — focus areas with concrete drills, and the next missions to fly,
 * each with a stated reason.
 *
 * Explainable by design: every line of the plan is derived from recorded
 * telemetry with the plain rules exported below. Deterministic, offline —
 * no session data leaves the machine.
 */

/* Training targets per metric — falling short of a target creates a focus
 * area. Values are the weighted scores the store already computes. */
export const TRAINING_TARGETS = {
  detection: 60,
  classification: 70,
  engagement: 60,
  collateral: 85,
};

export const METRIC_TITLES = {
  detection: 'Detection & tracking',
  classification: 'Threat identification',
  engagement: 'Engagement tempo',
  collateral: 'Safety discipline',
};

/* Coaching drills keyed by the type that was wrongly named or mistaken for
 * something else — built from the trainee's actual identification calls. */
const CONFUSION_DRILLS = {
  cargo: 'Cargo lifters fly slow and high — check SPD and ALT before calling a Scout.',
  kamikaze: 'Kamikaze dives are fast and low — a closing vector with rising speed gives it away.',
  ewJammer: 'Jammers hold a steady high orbit with a strong but erratic range return.',
  decoy: 'Decoys fake a larger return — compare the approach profile with its encyclopedia signature.',
  swarmNode: 'Swarm nodes arrive in numbers — count the returns before naming a type.',
  scout: 'Scouts are small, fast and mid-height — the compact return is the tell.',
  unidentified: 'Unidentified returns match no known signature — report the contact and hold fire; it may not be a drone at all.',
};

/* Which scenarios practise which weakness. Ordered — the first viable rung
 * wins, and the ladder never leaps more than one difficulty step past the
 * session just flown (except at mastery, where the top rungs are the point). */
const PRACTISE_LADDER = {
  detection: ['basic-recon', 'urban-patrol'],
  classification: ['urban-patrol', 'night-swarm'],
  engagement: ['night-swarm', 'urban-patrol'],
  collateral: ['basic-recon', 'urban-patrol'],
  mastery: ['full-spectrum', 'advanced-swarm'],
};

const MISSION_GOALS = {
  detection: 'Acquire every return inside 3 seconds.',
  classification: 'Call every type correctly without the advisory.',
  engagement: 'Neutralise every classified contact before the clock runs out.',
  collateral: 'Zero engagements on unconfirmed tracks.',
  mastery: 'Hold full accuracy at maximum difficulty.',
};

export function metricValue(score, id) {
  return Math.round(Math.max(0, Math.min(100, Number(score?.[id]) || 0)));
}

/** Average time from spawn to acquisition, or null when nothing was tracked. */
export function avgAcquisitionTime(threats = []) {
  const times = threats
    .filter(t => t.tracked && t.trackedAt != null)
    .map(t => Math.max(0, (t.trackedAt ?? 0) - (t.spawnTime ?? 0)));
  if (!times.length) return null;
  return times.reduce((sum, v) => sum + v, 0) / times.length;
}

/** Most common wrong identification calls, e.g. "Cargo called Scout x2". */
export function confusionPairs(threats = [], labels = {}) {
  const counts = new Map();
  for (const t of threats) {
    if (!t.classified || t.classCorrect || !t.type || !t.classifiedAs) continue;
    const key = `${t.type}>${t.classifiedAs}`;
    const entry = counts.get(key) ?? { actual: t.type, called: t.classifiedAs, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map(e => ({ ...e, actualLabel: labels[e.actual] ?? e.actual, calledLabel: labels[e.called] ?? e.called }));
}

/** Engagements fired on tracks the trainee had not identified correctly, or
 * on an unidentified return that should never have been engaged. */
export function unsafeEngagements(threats = []) {
  return threats.filter(t => t.neutralised && (
    t.type === 'unidentified' || !t.classified || t.classCorrect === false
  )).length;
}

/**
 * Merge in-memory sessions with the persisted archive: dedupe by id, drop
 * the session currently under review, and order oldest → newest so the
 * trend compares like with like.
 */
export function mergeSessionHistory(inMemory = [], archived = [], excludeId = null) {
  const byId = new Map();
  for (const s of [...archived, ...inMemory]) {
    if (!s || s.id == null || s.id === excludeId) continue;
    byId.set(s.id, { ...(byId.get(s.id) ?? {}), ...s });
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.date ?? a.savedAt ?? 0) - new Date(b.date ?? b.savedAt ?? 0)
  );
}

function scoreOf(record) {
  return typeof record?.score === 'number' ? { total: record.score } : (record?.score ?? {});
}

export function performanceTrend(history = [], score = {}) {
  if (!history.length) return null;
  // Only compare against records that carry a metric breakdown — legacy or
  // imported summaries without one would produce a meaningless delta.
  const previous = [...history]
    .reverse()
    .find(record => Object.keys(TRAINING_TARGETS).every(id => typeof scoreOf(record)[id] === 'number'));
  if (!previous) return null;
  const prevScore = scoreOf(previous);
  const metrics = Object.keys(TRAINING_TARGETS);
  const deltas = {};
  for (const id of metrics) deltas[id] = metricValue(score, id) - metricValue(prevScore, id);

  const [topId] = metrics
    .map(id => [id, deltas[id]])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const topDelta = deltas[topId];

  let headline;
  if (topDelta >= 5) headline = `${METRIC_TITLES[topId]} improved +${topDelta} vs your last session.`;
  else if (topDelta <= -5) headline = `${METRIC_TITLES[topId]} slipped ${Math.abs(topDelta)} vs your last session — the drills below target it.`;
  else headline = 'Scores are holding steady vs your last session.';

  return { sessions: history.length + 1, deltas, headline };
}

/* Recommended missions for the plan — matched to the weakest areas. */
function pickMissions(focusList, scenarios = [], currentScenarioId = null, mastery = false) {
  const byId = new Map(scenarios.map(s => [s.id, s]));
  const current = byId.get(currentScenarioId);

  const collect = (excludeCurrent) => {
    const picks = [];
    for (const focus of [...focusList].sort((a, b) => a.value - b.value)) {
      for (const scenarioId of PRACTISE_LADDER[focus.id] ?? []) {
        if (excludeCurrent && scenarioId === currentScenarioId) continue;
        if (picks.some(p => p.id === scenarioId)) continue;
        const sc = byId.get(scenarioId);
        if (!sc) continue;
        if (!mastery && current && (sc.difficulty ?? 1) > (current.difficulty ?? 1) + 1) continue;
        picks.push({
          id: sc.id,
          code: sc.code,
          name: sc.name,
          difficulty: sc.difficulty,
          goal: MISSION_GOALS[focus.id],
          reason: focus.id === 'mastery'
            ? 'You are ready to step up — this is the next tier.'
            : `Targets your weakest area — ${METRIC_TITLES[focus.id].toLowerCase()} (${focus.value}%).`,
        });
        break;
      }
      if (picks.length >= 2) break;
    }
    return picks;
  };

  // Prefer a fresh mission; falling back to the same one is only for the
  // corner case where the ladder offers nothing else.
  const preferred = collect(true);
  return (preferred.length ? preferred : collect(false)).slice(0, 2);
}

/* Focus areas — the metrics below target, ranked by how far short they fell. */
function buildFocusAreas(score, threats, labels) {
  const focus = [];

  const detection = metricValue(score, 'detection');
  if (detection < TRAINING_TARGETS.detection) {
    const avg = avgAcquisitionTime(threats);
    const tracked = threats.filter(t => t.tracked).length;
    focus.push({
      id: 'detection',
      value: detection,
      severity: detection < 40 ? 'high' : 'warn',
      title: METRIC_TITLES.detection,
      why: `${tracked} of ${threats.length || 0} drones acquired${avg != null ? ` — average ${avg.toFixed(1)}s to first track` : ''}. Training target is under 3s.`,
      drills: [
        'Watch the sweep — acquire the moment a return paints (T) instead of waiting for a second pass.',
        'Acquire before identifying: a tracked plot starts recording its trail, which helps later calls.',
        'Rehearse on a clean mission first, then hold the same pace under jamming.',
      ],
    });
  }

  const classification = metricValue(score, 'classification');
  if (classification < TRAINING_TARGETS.classification) {
    const classified = threats.filter(t => t.classified).length;
    const correct = threats.filter(t => t.classCorrect).length;
    const [topConfusion] = confusionPairs(threats, labels);
    const drills = [];
    if (topConfusion) {
      drills.push(`Repeat pattern from this session: ${topConfusion.actualLabel} called ${topConfusion.calledLabel} (x${topConfusion.count}).`);
      drills.push(`Read the ${topConfusion.actualLabel.toLowerCase()}'s tells: RCS, speed and altitude in the encyclopedia.`);
      const hint = CONFUSION_DRILLS[topConfusion.actual] ?? CONFUSION_DRILLS[topConfusion.called];
      if (hint) drills.push(hint);
    } else {
      drills.push('Study the encyclopedia signatures: RCS, speed band and altitude per type.');
    }
    drills.push('Name the type before letting the advisory confirm it — the call must be yours.');
    focus.push({
      id: 'classification',
      value: classification,
      severity: classification < 45 ? 'high' : 'warn',
      title: METRIC_TITLES.classification,
      why: classified
        ? `${correct} of ${classified} identification calls correct.${topConfusion ? ` Most common mix-up: ${topConfusion.actualLabel} → ${topConfusion.calledLabel} (x${topConfusion.count}).` : ''}`
        : 'No identification calls were made — classification is the core skill of the exercise.',
      drills,
    });
  }

  const engagement = metricValue(score, 'engagement');
  if (engagement < TRAINING_TARGETS.engagement) {
    const neutralised = threats.filter(t => t.neutralised).length;
    focus.push({
      id: 'engagement',
      value: engagement,
      severity: engagement < 40 ? 'high' : 'warn',
      title: METRIC_TITLES.engagement,
      why: `${neutralised} of ${threats.length || 0} drones neutralised. Training target is resolving every classified contact before the clock runs out.`,
      drills: [
        'Alert the team (A) immediately after confirming a classification — engagement needs the alert first.',
        'Keep the tempo up: engage the tracked contact, then re-scan for the next return.',
        'When several contacts are live, clear the nearest closing threat first.',
      ],
    });
  }

  const collateral = metricValue(score, 'collateral');
  if (collateral < TRAINING_TARGETS.collateral) {
    const unsafe = unsafeEngagements(threats);
    focus.push({
      id: 'collateral',
      value: collateral,
      severity: collateral < 60 ? 'high' : 'warn',
      title: METRIC_TITLES.collateral,
      why: unsafe
        ? `${unsafe} engagement${unsafe === 1 ? '' : 's'} fired on tracks that were not confirmed correctly. Safety is scored hardest of all.`
        : 'Safety discipline fell short this session — engagements must follow a confirmed identification every time.',
      drills: [
        'Confirm the identification before you commit — never engage on the advisory alone.',
        'Slow down one beat on approach vectors: a decoy rewards the impatient.',
        'If confidence is low, alert the team and hold — a held shot is not a lost one.',
      ],
    });
  }

  return focus;
}

/**
 * Build the personalised plan. `history` is past sessions (oldest → newest,
 * current session excluded); `score`/`threats` describe the session under
 * review (or the most recent archived session before starting a new one).
 */
export function buildTrainingPlan({
  score = {},
  threats = [],
  events = [],
  history = [],
  scenarios = [],
  labels = {},
  currentScenarioId = null,
} = {}) {
  const focus = buildFocusAreas(score, threats, labels);
  const mastery = focus.length === 0;

  if (mastery) {
    const metrics = Object.keys(TRAINING_TARGETS).map(id => metricValue(score, id));
    focus.push({
      id: 'mastery',
      value: Math.min(...metrics),
      severity: 'ok',
      title: 'Ready for the next tier',
      why: 'Every scored area met its training target this session.',
      drills: [
        'Raise difficulty rather than repeating the same package.',
        'Fly the harder mission without the advisory to make the calls unaided.',
      ],
    });
  }

  const trend = performanceTrend(history, score);
  const missions = pickMissions(focus, scenarios, currentScenarioId, mastery);
  const sessions = history.length + 1;

  return {
    mastery,
    focus,
    trend,
    missions,
    basis: { sessions, archivedSessions: history.length, currentScenarioId, eventCount: events.length },
    summary: `Generated from this session${history.length ? ` and ${history.length} of your archived session${history.length === 1 ? '' : 's'}` : ''} — explainable rules, runs fully offline.`,
    rules: [
      `Focus areas are the metrics that fell short of their training targets (acquisition ${TRAINING_TARGETS.detection}%, identification ${TRAINING_TARGETS.classification}%, tempo ${TRAINING_TARGETS.engagement}%, safety ${TRAINING_TARGETS.collateral}%).`,
      'Drills quote the exact identification mix-ups recorded in the session log.',
      'Missions are matched to the weakest areas and stay within one difficulty step of the session just flown.',
      'Trend lines compare this session with the sessions archived under your user ID on this machine.',
    ],
  };
}

export default { buildTrainingPlan, performanceTrend, mergeSessionHistory, confusionPairs, avgAcquisitionTime, unsafeEngagements, metricValue, TRAINING_TARGETS, METRIC_TITLES };
