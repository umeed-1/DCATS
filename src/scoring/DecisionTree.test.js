import { describe, it, expect } from 'vitest';
import {
  WEIGHTS, detectionScore, classificationScore, engagementScore,
  collateralScore, runningAverage, finalTotal, grade,
  threatOutcomeScore, aggregateThreatScores,
} from './DecisionTree';

describe('DecisionTree scoring', () => {
  it('weights sum to 1', () => {
    const total = WEIGHTS.detection + WEIGHTS.classification + WEIGHTS.engagement + WEIGHTS.collateral;
    expect(total).toBeCloseTo(1);
  });

  it('detection decays with delay, floors at 0', () => {
    expect(detectionScore(0, 0)).toBe(100);
    expect(detectionScore(0, 4)).toBe(80);
    expect(detectionScore(0, 100)).toBe(0);
  });

  it('classification rewards correctness', () => {
    expect(classificationScore(true)).toBe(100);
    expect(classificationScore(false)).toBe(20);
  });

  it('engagement penalises unclassified targets', () => {
    expect(engagementScore({ classCorrect: true })).toBe(100);
    expect(engagementScore({ classCorrect: false })).toBe(40);
    expect(engagementScore({ classCorrect: true, engaged: false })).toBe(30);
    expect(engagementScore({ classCorrect: true, alerted: false })).toBe(0);
  });

  it('collateral degrades per wrongful engagement', () => {
    expect(collateralScore(0)).toBe(100);
    expect(collateralScore(2)).toBe(50);
    expect(collateralScore(99)).toBe(0);
  });

  it('does not reward wasting an interceptor on a confirmed decoy', () => {
    expect(engagementScore({ classCorrect: true, threatType: 'decoy' })).toBe(40);
    expect(engagementScore({ classCorrect: true, engaged: false, threatType: 'scout' })).toBe(30);
    // Standing down on a decoy is the correct engagement decision.
    expect(engagementScore({ classCorrect: true, engaged: false, threatType: 'decoy' })).toBe(100);
    expect(threatOutcomeScore({
      type: 'decoy',
      tracked: true, spawnTime: 0, trackedAt: 1,
      classified: true, classCorrect: true,
      alerted: true, neutralised: true,
    })).toEqual({
      detection: 95, classification: 100, engagement: 40, collateral: 100,
    });
  });

  it('never rewards engaging an unidentified return', () => {
    expect(engagementScore({ classCorrect: true, threatType: 'unidentified' })).toBe(20);
    expect(engagementScore({ classCorrect: false, threatType: 'unidentified' })).toBe(20);
    expect(engagementScore({ classCorrect: true, engaged: false, threatType: 'unidentified' })).toBe(100);
    expect(engagementScore({ classCorrect: true, engaged: false, alerted: false, threatType: 'unidentified' })).toBe(0);
  });

  it('zeros collateral for any engagement on an unidentified return', () => {
    const base = {
      type: 'unidentified',
      tracked: true, spawnTime: 0, trackedAt: 1,
      classified: true, classCorrect: true, alerted: true,
    };
    expect(threatOutcomeScore({ ...base, neutralised: true })).toEqual({
      detection: 95, classification: 100, engagement: 20, collateral: 0,
    });
    // Standing down leaves collateral intact and credits the correct call.
    expect(threatOutcomeScore({ ...base, neutralised: false })).toEqual({
      detection: 95, classification: 100, engagement: 100, collateral: 100,
    });
  });

  it('running average combines live scores', () => {
    expect(runningAverage(0, 100)).toBe(50);
    expect(runningAverage(50, 100)).toBe(75);
  });

  it('final total is weighted', () => {
    expect(finalTotal({ detection: 100, classification: 100, engagement: 100, collateral: 100 })).toBe(100);
    expect(finalTotal({ detection: 0, classification: 0, engagement: 0, collateral: 0 })).toBe(0);
  });

  it('scores every threat outcome, including missing operator actions', () => {
    const complete = {
      tracked: true, spawnTime: 0, trackedAt: 1,
      classified: true, classCorrect: true,
      alerted: true, neutralised: true,
    };
    const missed = {
      tracked: false, classified: false,
      alerted: false, neutralised: false,
    };

    expect(threatOutcomeScore(complete)).toEqual({
      detection: 95, classification: 100, engagement: 100, collateral: 100,
    });
    expect(threatOutcomeScore(missed)).toEqual({
      detection: 0, classification: 0, engagement: 0, collateral: 100,
    });
    expect(aggregateThreatScores([complete, missed])).toEqual({
      detection: 48, classification: 50, engagement: 50, collateral: 100, total: 60,
    });
  });

  it('supports mission data envelopes without changing timeline event shape', () => {
    const result = aggregateThreatScores({
      threats: [{
        tracked: true, trackedAt: 0, spawnTime: 0,
        classified: true, classCorrect: true,
        alerted: true, neutralised: true,
      }],
      events: [{ type: 'classify', time: 0, correct: true }],
    });
    expect(result.total).toBe(100);
  });

  it('grades thresholds', () => {
    expect(grade(85)).toBe('EXCELLENT');
    expect(grade(65)).toBe('GOOD');
    expect(grade(45)).toBe('NEEDS WORK');
    expect(grade(10)).toBe('CRITICAL');
  });
});
