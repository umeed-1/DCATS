import { describe, it, expect } from 'vitest';
import {
  buildTrainingPlan,
  mergeSessionHistory,
  metricValue,
  performanceTrend,
  unsafeEngagements,
} from './TrainingPlanner';

const SCENARIOS = [
  { id: 'basic-recon', code: 'Mission 01', name: 'Basic Reconnaissance', difficulty: 1 },
  { id: 'urban-patrol', code: 'Mission 02', name: 'Urban Grid Patrol', difficulty: 2 },
  { id: 'degraded-ops', code: 'Mission 04', name: 'Degraded Ops', difficulty: 3 },
  { id: 'night-swarm', code: 'Mission 03', name: 'Night Swarm Assault', difficulty: 4 },
  { id: 'full-spectrum', code: 'Mission 05', name: 'Full Spectrum', difficulty: 5 },
  { id: 'advanced-swarm', code: 'Mission 06', name: 'Advanced Swarm', difficulty: 5 },
];

const LABELS = {
  scout: 'Scout',
  cargo: 'Cargo',
  kamikaze: 'Kamikaze',
  decoy: 'Decoy',
  swarmNode: 'Swarm Node',
  ewJammer: 'Jammer',
};

describe('TrainingPlanner', () => {
  const weakCalls = [
    { id: 't-0', type: 'kamikaze', tracked: true, spawnTime: 1, trackedAt: 9, classified: true, classifiedAs: 'scout', classCorrect: false, alerted: true, neutralised: true },
    { id: 't-1', type: 'cargo', tracked: true, spawnTime: 0, trackedAt: 12, classified: true, classifiedAs: 'scout', classCorrect: false, alerted: false, neutralised: false },
  ];

  it('turns weak identification into a focus area with the real mix-up', () => {
    const plan = buildTrainingPlan({
      score: { detection: 80, classification: 40, engagement: 55, collateral: 100 },
      threats: weakCalls,
      history: [],
      scenarios: SCENARIOS,
      labels: LABELS,
      currentScenarioId: 'basic-recon',
    });

    const classification = plan.focus.find(f => f.id === 'classification');
    expect(classification).toBeTruthy();
    expect(classification.severity).toBe('high');
    expect(classification.why).toContain('0 of 2');
    expect(classification.why).toContain('Scout');
    expect(classification.drills.join(' ')).toContain('called Scout');
    expect(plan.missions.length).toBeGreaterThan(0);
  });

  it('suggests the next tier when every training target is met', () => {
    const plan = buildTrainingPlan({
      score: { detection: 95, classification: 95, engagement: 95, collateral: 100 },
      threats: [
        { id: 't-0', type: 'scout', tracked: true, classified: true, classifiedAs: 'scout', classCorrect: true, alerted: true, neutralised: true, spawnTime: 0, trackedAt: 2 },
      ],
      history: [],
      scenarios: SCENARIOS,
      labels: LABELS,
      currentScenarioId: 'basic-recon',
    });

    expect(plan.mastery).toBe(true);
    expect(plan.focus).toHaveLength(1);
    expect(plan.focus[0].severity).toBe('ok');
    expect(plan.missions[0].id).toBe('full-spectrum');
  });

  it('avoids recommending the mission just flown when another rung exists', () => {
    const plan = buildTrainingPlan({
      score: { detection: 30, classification: 90, engagement: 90, collateral: 95 },
      threats: [],
      history: [],
      scenarios: SCENARIOS,
      labels: LABELS,
      currentScenarioId: 'basic-recon',
    });

    expect(plan.missions[0].id).toBe('urban-patrol');
    expect(plan.missions.map(m => m.id)).not.toContain('basic-recon');
  });

  it('compares against archived sessions and reports the biggest move', () => {
    const history = [
      { id: 's-1', date: '2026-10-01T10:00:00Z', score: { detection: 40, classification: 60, engagement: 60, collateral: 90 } },
    ];
    const plan = buildTrainingPlan({
      score: { detection: 80, classification: 60, engagement: 60, collateral: 90 },
      threats: [],
      history,
      scenarios: SCENARIOS,
      labels: LABELS,
      currentScenarioId: 'basic-recon',
    });

    expect(plan.trend.sessions).toBe(2);
    expect(plan.trend.deltas.detection).toBe(40);
    expect(plan.trend.headline).toContain('improved +40');
  });

  it('states a drop without a double negative', () => {
    const plan = buildTrainingPlan({
      score: { detection: 30, classification: 60, engagement: 60, collateral: 90 },
      threats: [],
      history: [{
        id: 's-1',
        date: '2026-10-01T10:00:00Z',
        score: { detection: 80, classification: 60, engagement: 60, collateral: 90 },
      }],
      scenarios: SCENARIOS,
      labels: LABELS,
      currentScenarioId: 'basic-recon',
    });

    expect(plan.trend.headline).toContain('slipped 50');
    expect(plan.trend.headline).not.toContain('slipped -');
  });

  it('merges, dedupes and orders session history around the current run', () => {
    const merged = mergeSessionHistory(
      [{ id: 'b', date: '2026-10-02T00:00:00Z' }, { id: 'c', date: '2026-10-03T00:00:00Z' }],
      [{ id: 'a', date: '2026-10-01T00:00:00Z' }, { id: 'b', date: '2026-10-02T00:00:00Z', score: { total: 50 } }],
      'c'
    );

    expect(merged.map(s => s.id)).toEqual(['a', 'b']);
    expect(merged[1].score.total).toBe(50);
  });

  it('clamps metric values and handles empty trend input', () => {
    expect(metricValue({ detection: 130 }, 'detection')).toBe(100);
    expect(metricValue({ detection: -5 }, 'detection')).toBe(0);
    expect(metricValue({}, 'detection')).toBe(0);
    expect(performanceTrend([], { detection: 90 })).toBeNull();
  });

  it('counts an engaged unidentified return as unsafe even when called correctly', () => {
    expect(unsafeEngagements([
      { type: 'unidentified', classified: true, classCorrect: true, neutralised: true },
      { type: 'scout', classified: true, classCorrect: true, neutralised: true },
    ])).toBe(1);
  });
});
