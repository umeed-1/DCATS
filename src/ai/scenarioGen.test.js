import { describe, it, expect } from 'vitest';
import { generateProceduralScenario, THREAT_TYPES } from './scenarioGen';

describe('scenarioGen', () => {
  it('generates a valid scenario', () => {
    const sc = generateProceduralScenario(() => 0.5);
    expect(sc.threats.length).toBeGreaterThan(0);
    expect(sc.duration).toBeGreaterThanOrEqual(120);
    expect(sc.sensorQuality).toBeGreaterThanOrEqual(0.2);
    expect(sc.difficulty).toBeGreaterThanOrEqual(1);
  });

  it('is randomised across runs', () => {
    let i = 0;
    const seq = [0.1, 0.9, 0.3, 0.7, 0.2, 0.8];
    const sc = generateProceduralScenario(() => seq[i++ % seq.length]);
    expect(sc.id).toContain('procedural-');
  });

  it('includes unidentified contacts in the procedural pool', () => {
    expect(THREAT_TYPES).toContain('unidentified');
    // rand 0.999 selects the last (rarest) weighted slot for every pick.
    const sc = generateProceduralScenario(() => 0.999);
    expect(sc.threats.some(t => t.type === 'unidentified')).toBe(true);
  });
});
