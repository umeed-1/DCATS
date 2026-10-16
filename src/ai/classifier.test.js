import { describe, it, expect } from 'vitest';
import { heuristicClassify, classifyThreat } from './classifier';

const noRand = () => 0.999; // deterministic branch selection

describe('heuristicClassifier', () => {
  it('flags fast threats as kamikaze', () => {
    const p = heuristicClassify({ speed: 70, rcs: 0.02, z: 150 }, noRand);
    expect(p.predictedType).toBe('kamikaze');
  });

  it('flags tiny-RCS threats as swarm nodes', () => {
    const p = heuristicClassify({ speed: 30, rcs: 0.005, z: 90 }, noRand);
    expect(p.predictedType).toBe('swarmNode');
  });

  it('keeps fast swarm nodes out of the kamikaze speed band', () => {
    const p = heuristicClassify({ speed: 42, rcs: 0.005, z: 90 }, noRand);
    expect(p.predictedType).toBe('swarmNode');
  });

  it('flags heavy-RCS threats as cargo/decoy', () => {
    const p = heuristicClassify({ speed: 15, rcs: 0.1, z: 60 }, noRand);
    expect(['cargo', 'decoy']).toContain(p.predictedType);
  });

  it('returns explanation + feature importances', () => {
    const p = heuristicClassify({ speed: 25, rcs: 0.012, z: 120 }, noRand);
    expect(p.explanation).toContain('speed=');
    expect(p.importances.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1);
    expect(p.confidence).toBeGreaterThanOrEqual(55);
  });

  it('abstains on unidentified returns instead of forcing a drone class', () => {
    const p = heuristicClassify(
      { type: 'unidentified', ambiguous: true, speed: 22, rcs: 0.05, z: 120 },
      noRand
    );
    expect(p.predictedType).toBe('unidentified');
    expect(p.mode).toBe('abstain');
    expect(p.confidence).toBeLessThan(50);
    expect(p.explanation).toContain('No signature match');
  });

  it('abstains before inference so the ONNX model cannot guess for unidentified returns', async () => {
    const p = await classifyThreat({ type: 'unidentified', ambiguous: true, speed: 22, rcs: 0.05, z: 120 });
    expect(p.predictedType).toBe('unidentified');
    expect(p.mode).toBe('abstain');
  });
});
