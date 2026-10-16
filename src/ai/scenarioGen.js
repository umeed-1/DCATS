/**
 * DCATS — scenarioGen.js
 * Procedural scenario generation + static pack catalogue.
 * Pack definitions match docs + SIH submission (9 packs).
 */

export const ENVIRONMENTS = ['urban', 'rural', 'forest', 'mixed'];
export const TIMES_OF_DAY = ['day', 'dusk', 'night'];
export const THREAT_TYPES = ['scout', 'cargo', 'kamikaze', 'ewJammer', 'decoy', 'swarmNode', 'unidentified'];

/* Weighted pick pool: unidentified returns appear, but rarely — roughly one
 * slot in twelve, so most procedural runs still revolve around known types. */
const PROC_POOL = [
  'scout', 'scout', 'cargo', 'cargo', 'kamikaze', 'kamikaze',
  'ewJammer', 'decoy', 'decoy', 'swarmNode', 'swarmNode', 'unidentified',
];

/**
 * Generate a randomised scenario. Accepts an injected rand() for tests.
 */
export function generateProceduralScenario(rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const threatCount = 3 + Math.floor(rand() * 10);
  const byType = new Map();
  for (let i = 0; i < threatCount; i++) {
    const type = pick(PROC_POOL);
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  const threats = [...byType.entries()].map(([type, count]) => ({ type, count }));
  return {
    id: 'procedural-' + Date.now(),
    name: 'Procedural Mission',
    description: 'Auto-generated threat mix, terrain and conditions. No two runs are the same.',
    environment: pick(ENVIRONMENTS),
    timeOfDay: pick(TIMES_OF_DAY),
    difficulty: Math.min(5, Math.max(1, Math.ceil(threatCount / 3))),
    sensorQuality: 0.2 + rand() * 0.7,
    threats,
    duration: 120 + Math.floor(rand() * 60),
    code: 'Mission 09',
  };
}

export default { generateProceduralScenario, ENVIRONMENTS, TIMES_OF_DAY, THREAT_TYPES };
