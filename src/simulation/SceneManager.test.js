import { describe, it, expect } from 'vitest';
import { terrainHeight } from './SceneManager';

describe('terrainHeight (rolling relief)', () => {
  it('keeps urban/mixed ground graded flat', () => {
    expect(terrainHeight(420, -370, 'urban')).toBe(0);
    expect(terrainHeight(420, -370, 'mixed')).toBe(0);
    expect(terrainHeight(0, 0, 'urban')).toBe(0);
  });

  it('grades the FOB pad zone flat, then ramps relief in', () => {
    expect(terrainHeight(0, 0, 'rural')).toBe(0);
    expect(terrainHeight(60, -60, 'rural')).toBe(0); // r ≈ 85 < 90
    // Beyond the ramp the relief is real, not a constant.
    expect(Math.abs(terrainHeight(280, 280, 'rural'))).toBeGreaterThan(1);
  });

  it('rural hills stay bounded (drone tracks never clip) and vary patchily', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 100; i += 1) {
      const x = -1200 + (i % 10) * 260;
      const z = -1200 + Math.floor(i / 10) * 260;
      const h = terrainHeight(x, z, 'rural');
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
    expect(min).toBeGreaterThan(-55);
    expect(max).toBeLessThan(55);
    expect(max - min).toBeGreaterThan(20); // real ups and downs
  });

  it('most of the ground is plainer than the ridge patches', () => {
    const heights = [];
    for (let i = 0; i < 100; i += 1) {
      heights.push(terrainHeight(-1200 + (i % 10) * 260, -1200 + Math.floor(i / 10) * 260, 'rural'));
    }
    const rolling = heights.filter((h) => Math.abs(h) > 12).length;
    // Patchwork: most sampled ground sits near flat, with a minority of
    // marked rises/hollows.
    expect(rolling).toBeLessThan(heights.length * 0.45);
    expect(heights.some((h) => Math.abs(h) > 15)).toBe(true); // ridges exist
  });

  it('forest relief scales up relative to rural', () => {
    const r = terrainHeight(280, 280, 'rural');
    const f = terrainHeight(280, 280, 'forest');
    expect(f).toBeCloseTo(r * 1.05, 6);
  });
});
