/**
 * DCATS — DecisionTree.js
 * Multi-factor weighted scoring engine with temporal penalties.
 *
 * Weights (per SIH26247 rubric):
 *   detection      25%  — penalises slow acquisition
 *   classification 30%  — penalises misidentification
 *   engagement     25%  — penalises over/under-engagement
 *   collateral     20%  — penalises fratricide / civilian-zone engagement
 */

export const WEIGHTS = {
  detection: 0.25,
  classification: 0.30,
  engagement: 0.25,
  collateral: 0.20,
};

/** Detection score decays with delay: 100 at t=0, -5 pts/sec, clamped to [0, 100]. */
export function detectionScore(spawnTime, trackedAt, decayPerSec = 5) {
  return Math.min(100, Math.max(0, Math.round(100 - (trackedAt - spawnTime) * decayPerSec)));
}

/** Classification score: correct = 100, wrong = 20. */
export function classificationScore(correct) {
  return correct ? 100 : 20;
}

/**
 * Engagement quality: correct classification engaged = 100,
 * standing down on a correctly identified decoy = 100 (the right call),
 * unclassified/wrong engagement = 40 (collateral risk),
 * wasting an interceptor on a confirmed decoy = 40,
 * engaging an unidentified return = 20 (a return that may not be a drone
 * must never be engaged), standing down on a correctly identified
 * unidentified return = 100, ignoring an alerted real threat = 30, and
 * failing to alert = 0.
 *
 * `threatType` is optional so legacy call sites keep the original behaviour;
 * the simulation always passes it (see threatOutcomeScore).
 */
export function engagementScore({ classCorrect, engaged = true, alerted = true, threatType = null } = {}) {
  if (!alerted) return 0;
  const isDecoy = threatType === 'decoy';
  const isUnidentified = threatType === 'unidentified';
  if (!engaged) {
    if (isDecoy && classCorrect) return 100;
    if (isUnidentified && classCorrect) return 100;
    return 30;
  }
  if (isUnidentified) return 20;
  return isDecoy ? 40 : classCorrect ? 100 : 40;
}

/**
 * Collateral summary helper: 100 at zero wrongful engagements, -25 each.
 * "Wrongful" = engaging a threat that was never correctly classified, or
 * engaging an unidentified return that may not have been a drone.
 *
 * NOTE: the live aggregation (aggregateThreatScores → threatOutcomeScore)
 * scores collateral per threat as 100/0 instead of using this helper; the
 * per-threat mean has the same intent (wrongful engagement costs collateral)
 * with a sharper single-strike penalty. This helper stays available for
 * mission-level summaries and reports.
 */
export function collateralScore(wrongfulEngagements) {
  return Math.max(0, 100 - wrongfulEngagements * 25);
}

/** Running-average combiner used live during the mission. */
export function runningAverage(prev, next) {
  return Math.round((prev + next) / 2);
}

function mean(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Score one complete threat outcome. Missing operator actions intentionally
 * score zero for their corresponding dimension, rather than disappearing
 * from the average because no event was recorded.
 */
export function threatOutcomeScore(threat = {}) {
  const trackedAt = threat.trackedAt;
  const detection = threat.tracked && trackedAt != null
    ? detectionScore(threat.spawnTime ?? 0, trackedAt)
    : 0;
  const classification = threat.classified
    ? classificationScore(threat.classCorrect === true)
    : 0;
  const engagement = engagementScore({
    classCorrect: threat.classCorrect === true,
    engaged: threat.neutralised === true,
    alerted: threat.alerted === true,
    threatType: threat.type ?? null,
  });
  // A wrongful engagement is the collateral event for that threat. A threat
  // that was not engaged does not create collateral damage. Firing on an
  // unidentified return is wrongful even when the operator called it
  // correctly, because it may not have been a drone at all.
  const wrongfulEngagement = threat.neutralised === true
    && (threat.classCorrect !== true || threat.type === 'unidentified');
  const collateral = wrongfulEngagement ? 0 : 100;

  return { detection, classification, engagement, collateral };
}

/**
 * Aggregate the four rubric dimensions across every threat in a mission.
 * This is the authoritative score used when a mission closes. It accepts an
 * array directly and also tolerates a `{ threats }` envelope for callers that
 * already carry mission data alongside timeline events.
 */
export function aggregateThreatScores(input = []) {
  const threats = Array.isArray(input) ? input : (input?.threats ?? []);
  if (!threats.length) {
    return { detection: 0, classification: 0, engagement: 0, collateral: 100, total: 0 };
  }

  const outcomes = threats.map(threatOutcomeScore);
  const score = {
    detection: mean(outcomes.map((outcome) => outcome.detection)),
    classification: mean(outcomes.map((outcome) => outcome.classification)),
    engagement: mean(outcomes.map((outcome) => outcome.engagement)),
    collateral: mean(outcomes.map((outcome) => outcome.collateral)),
  };
  return { ...score, total: finalTotal(score) };
}

/** Final weighted total. */
export function finalTotal({ detection, classification, engagement, collateral }) {
  return Math.round(
    detection * WEIGHTS.detection +
    classification * WEIGHTS.classification +
    engagement * WEIGHTS.engagement +
    collateral * WEIGHTS.collateral
  );
}

export function grade(total) {
  if (total >= 80) return 'EXCELLENT';
  if (total >= 60) return 'GOOD';
  if (total >= 40) return 'NEEDS WORK';
  return 'CRITICAL';
}

export default {
  WEIGHTS, detectionScore, classificationScore,
  engagementScore, collateralScore, runningAverage, threatOutcomeScore,
  aggregateThreatScores, finalTotal, grade,
};
