import { describe, it, expect } from 'vitest';
import {
  updateThreatPosition, sensorAvailableAt, trackAvailable, sensorVisible,
  sampleVisibility, SENSOR_SAMPLE_INTERVAL, signalStrength, SIM_RANGE, SIGNAL_FULL_RADIUS,
} from './SwarmAI';

const base = (over = {}) => ({
  id: 't-0', x: 0, y: 0, vx: 1, vy: 0, speed: 30, neutralised: false, ...over,
});

describe('SwarmAI Boids step', () => {
  it('moves a lone threat along its velocity', () => {
    const out = updateThreatPosition(base(), [], 1);
    expect(out.x).toBeGreaterThan(0);
  });

  it('separates overlapping neighbours', () => {
    const a = base({ id: 'a', x: 0, y: 0, vx: 0, vy: 0 });
    const b = base({ id: 'b', x: 5, y: 0, vx: 0, vy: 0 });
    const out = updateThreatPosition(a, [a, b], 1);
    expect(out.x).toBeLessThan(0); // pushed away from b
  });

  it('clamps speed to type maximum', () => {
    const out = updateThreatPosition(base({ vx: 999, vy: 0 }), [], 1);
    const v = Math.hypot(out.vx, out.vy);
    expect(v).toBeLessThanOrEqual(30 * 0.1 + 1e-6);
  });

  it('ignores neutralised neighbours', () => {
    const a = base({ id: 'a', vx: 0, vy: 0 });
    const dead = base({ id: 'b', x: 5, y: 0, neutralised: true });
    const out = updateThreatPosition(a, [a, dead], 1);
    expect(out.vx).toBeCloseTo(0);
  });

  it('sensor visibility degrades with low SNR', () => {
    // The first draw tests SNR and the second draw tests dropout.
    const rand = (() => {
      const seq = [0.25, 0.9];
      let i = 0;
      return () => seq[i++ % seq.length];
    })();
    expect(sensorVisible(0.5, 0.5, rand)).toBe(true);

    // SNR remains meaningful even with no configured dropout.
    expect(sensorVisible(0, 0.5, () => 0.05)).toBe(false);
    expect(sensorVisible(1, 0.5, () => 0.9)).toBe(true);
    // Dropout remains meaningful even with perfect SNR.
    expect(sensorVisible(1, 1, () => 0.05)).toBe(false);
  });

  it('keeps latency separate from SNR and dropout', () => {
    expect(sensorAvailableAt(4, 3)).toBe(7);
    expect(trackAvailable(6.99, 4, 3)).toBe(false);
    expect(trackAvailable(7, 4, 3)).toBe(true);
  });
});

describe('SwarmAI held sensor sampling', () => {
  it('holds the previous visibility between samples (no re-draw)', () => {
    // Not due yet: previous visibility is held and the schedule is untouched.
    let calls = 0;
    const rand = () => { calls += 1; return 0.99; };
    const out = sampleVisibility({
      simTime: 1, prevVisible: true, nextSampleAt: 3, snr: 0, dropout: 0, rand,
    });
    expect(out.visible).toBe(true);
    expect(out.nextSampleAt).toBe(3);
    expect(calls).toBe(0); // no random draw consumed while holding
  });

  it('draws a fresh sample when due and schedules the next interval', () => {
    const out = sampleVisibility({ simTime: 3, prevVisible: false, nextSampleAt: 3, snr: 1, dropout: 0 });
    expect(out.visible).toBe(true);
    expect(out.nextSampleAt).toBe(3 + SENSOR_SAMPLE_INTERVAL);
  });

  it('a failed draw yields a bounded dropout window, not a per-frame redraw', () => {
    // SNR 0 → always invisible at a due sample; the next draw is +interval away.
    const out = sampleVisibility({
      simTime: 2, prevVisible: true, nextSampleAt: 2, snr: 0, dropout: 0,
    });
    expect(out.visible).toBe(false);
    expect(out.nextSampleAt).toBe(2 + SENSOR_SAMPLE_INTERVAL);
    // Held invisible until the next sample is due.
    const held = sampleVisibility({
      simTime: 2.5, prevVisible: out.visible, nextSampleAt: out.nextSampleAt, snr: 1, dropout: 0,
    });
    expect(held.visible).toBe(false);
    expect(held.nextSampleAt).toBe(2 + SENSOR_SAMPLE_INTERVAL);
  });

  it('never reports a track before its availability time', () => {
    const out = sampleVisibility({
      simTime: 4, spawnTime: 5, latency: 3, prevVisible: false, nextSampleAt: 4, snr: 1, dropout: 0,
    });
    expect(out.visible).toBe(false);
    expect(out.nextSampleAt).toBe(4 + SENSOR_SAMPLE_INTERVAL);
  });
});

describe('SwarmAI range-dependent signal', () => {
  it('is full strength inside the near radius and zero at the coverage edge', () => {
    expect(signalStrength(0)).toBe(1);
    expect(signalStrength(SIGNAL_FULL_RADIUS)).toBe(1);
    expect(signalStrength(SIM_RANGE)).toBe(0);
    expect(signalStrength(SIM_RANGE + 200)).toBe(0);
  });

  it('strengthens as a track closes on the centre', () => {
    const far = signalStrength(420);
    const mid = signalStrength(300);
    const near = signalStrength(200);
    expect(far).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(mid);
  });
});
