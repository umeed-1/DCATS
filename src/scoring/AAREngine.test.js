import { describe, it, expect } from 'vitest';
import {
  avgDetectionTime,
  mergeSessionRecords,
  parseSessionArchive,
  recommendations,
  serializeSessionArchive,
  sessionsForTrainee,
  timelineData,
  threatSummary,
} from './AAREngine';

describe('AAREngine', () => {
  const threats = [
    { id: 't-0', type: 'scout', tracked: true, trackedAt: 3, spawnTime: 0, classified: true, classifiedAs: 'scout', classCorrect: true, alerted: true, neutralised: true },
    { id: 't-1', type: 'kamikaze', tracked: true, trackedAt: 8, spawnTime: 2, classified: true, classifiedAs: 'scout', classCorrect: false, alerted: false, neutralised: false },
  ];

  it('summarises threat outcomes', () => {
    const s = threatSummary(threats);
    expect(s).toMatchObject({
      total: 2, tracked: 2, classified: 2, correct: 1,
      alerted: 1, neutralised: 1, missed: 1, decoysStoodDown: 0,
    });
  });

  it('treats a correctly ignored decoy as handled, not missed', () => {
    const summary = threatSummary([{
      id: 'd-0', type: 'decoy', tracked: true, classified: true,
      classifiedAs: 'decoy', classCorrect: true, alerted: true, neutralised: false,
    }]);

    expect(summary).toMatchObject({ total: 1, missed: 0, decoysStoodDown: 1 });
    const recs = recommendations(
      { detection: 95, classification: 95, engagement: 95, collateral: 100 },
      summary
    );
    expect(recs.every(r => !r.text.includes('Fewer than half'))).toBe(true);
  });

  it('treats a correctly stood-down unidentified contact as handled, not missed', () => {
    const summary = threatSummary([{
      id: 'u-0', type: 'unidentified', tracked: true, classified: true,
      classifiedAs: 'unidentified', classCorrect: true, alerted: true, neutralised: false,
    }]);

    expect(summary).toMatchObject({
      total: 1, missed: 0, unidentifiedStoodDown: 1,
    });
    const recs = recommendations(
      { detection: 95, classification: 95, engagement: 95, collateral: 100 },
      summary
    );
    expect(recs.every(r => !r.text.includes('Fewer than half'))).toBe(true);
  });

  it('computes average detection time', () => {
    expect(avgDetectionTime(threats)).toBeCloseTo(4.5);
    expect(avgDetectionTime([])).toBeNull();
  });

  it('recommends improvement areas, praises excellence', () => {
    const recs = recommendations({ detection: 20, classification: 20, engagement: 20, collateral: 100 }, threatSummary(threats));
    expect(recs.length).toBeGreaterThan(1);
    expect(recs[0]).toHaveProperty('severity');
    expect(recs[0]).toHaveProperty('text');
    const praise = recommendations(
      { detection: 95, classification: 95, engagement: 95, collateral: 100 },
      { total: 2, tracked: 2, classified: 2, correct: 2, alerted: 2, neutralised: 2 }
    );
    expect(praise[0].severity).toBe('ok');
    expect(praise[0].text).toContain('Excellent');
  });

  it('round-trips detailed session records and accepts legacy arrays', () => {
    const detailed = {
      id: 'session-1',
      scenario: 'custom-1',
      scenarioName: 'Instructor Custom Scenario',
      score: { total: 84, detection: 90 },
      events: [{ type: 'track', time: 2.5 }],
      scenarioConfig: { environment: 'forest', timeOfDay: 'dusk' },
    };

    const archive = serializeSessionArchive([detailed]);
    expect(parseSessionArchive(archive)).toEqual([detailed]);
    expect(parseSessionArchive(JSON.stringify([detailed]))).toEqual([detailed]);
  });

  it('merges a richer imported record without breaking summary fields', () => {
    const existing = [{
      id: 'session-1',
      scenarioName: 'Basic Reconnaissance',
      score: { total: 70 },
    }];
    const imported = [{
      id: 'session-1',
      scenarioName: 'Basic Reconnaissance',
      score: { total: 70, detection: 80 },
      events: [{ type: 'engage', time: 10 }],
    }];

    expect(mergeSessionRecords(existing, imported)).toEqual([{
      id: 'session-1',
      scenarioName: 'Basic Reconnaissance',
      score: { total: 70, detection: 80 },
      events: [{ type: 'engage', time: 10 }],
    }]);
  });

  it('uses authoritative score snapshots for the AAR timeline', () => {
    expect(timelineData([
      { type: 'track', time: 1, score: { total: 24 } },
      { type: 'classify', time: 2, score: { total: 51 } },
      { type: 'engage', time: 3, score: { total: 68 } },
    ])).toEqual([
      { time: 1, score: 24, event: 'track' },
      { time: 2, score: 51, event: 'classify' },
      { time: 3, score: 68, event: 'engage' },
    ]);
  });

  it('scopes personal session history to one trainee', () => {
    const records = [
      { id: 's-1', traineeId: 'Akash' },
      { id: 's-2', traineeId: 'akash' },
      { id: 's-3', traineeId: 'PRIYA' },
      { id: 's-4' },
    ];
    expect(sessionsForTrainee(records, 'AKASH').map(r => r.id)).toEqual(['s-1', 's-2']);
    expect(sessionsForTrainee(records, 'priya').map(r => r.id)).toEqual(['s-3']);
    expect(sessionsForTrainee(records, '')).toEqual([]);
    expect(sessionsForTrainee(records, 'nobody')).toEqual([]);
  });
});
