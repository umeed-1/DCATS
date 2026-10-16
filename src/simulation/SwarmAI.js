/**
 * DCATS — SwarmAI.js
 * Boids flocking algorithm: separation + alignment + cohesion.
 * Produces emergent, non-scripted swarm attack patterns.
 * Pure functions — unit-testable, no React/Three dependency.
 */

/**
 * Update a single threat's velocity/position using Boids rules.
 * @param {object} threat - threat with x,y,vx,vy,speed
 * @param {Array} allThreats - all threats (neighbours)
 * @param {number} dt - delta time in seconds
 * @param {object} opts - tuning params
 */
export function updateThreatPosition(threat, allThreats, dt, opts = {}) {
  const {
    neighbourRadius = 120,
    separationRadius = 40,
    separationWeight = 0.5,
    alignmentWeight = 0.1,
    cohesionWeight = 0.01,
    // Soft play-area boundary. A constant pull toward the origin (the previous
    // `centerPull`) dragged every track into one blob at the centre within
    // seconds. Instead, apply no force until a track reaches the edge, then
    // push gently straight back, so tracks roam the whole area and stay apart.
    boundaryRadius = 430,
    boundaryStrength = 0.02,
  } = opts;

  const t = { ...threat };
  let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0;
  let neighbours = 0;

  for (const other of allThreats) {
    if (other.id === t.id || other.neutralised) continue;
    const dx = other.x - t.x;
    const dy = other.y - t.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < neighbourRadius && dist > 0.0001) {
      neighbours++;
      if (dist < separationRadius) {
        sx -= dx / dist;
        sy -= dy / dist;
      }
      ax += other.vx;
      ay += other.vy;
      cx += other.x;
      cy += other.y;
    }
  }

  if (neighbours > 0) {
    ax /= neighbours;
    ay /= neighbours;
    // Cohesion: steer toward local centre of mass
    cx = (cx / neighbours - t.x) * cohesionWeight;
    cy = (cy / neighbours - t.y) * cohesionWeight;
  }

  // Soft boundary: no force inside the play area, a gentle push straight back
  // toward the centre once a track passes the edge. Keeps tracks in range
  // without collapsing them together the way a constant centre pull did.
  const radius = Math.sqrt(t.x * t.x + t.y * t.y);
  let boundaryDx = 0, boundaryDy = 0;
  if (radius > boundaryRadius && radius > 0.0001) {
    const overshoot = (radius - boundaryRadius) * boundaryStrength;
    boundaryDx = -(t.x / radius) * overshoot;
    boundaryDy = -(t.y / radius) * overshoot;
  }

  t.vx += (sx * separationWeight + ax * alignmentWeight + cx + boundaryDx) * dt;
  t.vy += (sy * separationWeight + ay * alignmentWeight + cy + boundaryDy) * dt;

  // Clamp speed to type max (scaled for sim units)
  const maxV = t.speed * 0.1;
  const currentSpeed = Math.sqrt(t.vx * t.vx + t.vy * t.vy);
  if (currentSpeed > maxV && currentSpeed > 0.0001) {
    t.vx = (t.vx / currentSpeed) * maxV;
    t.vy = (t.vy / currentSpeed) * maxV;
  }

  t.x += t.vx * dt * 10;
  t.y += t.vy * dt * 10;

  return t;
}

/** Clamp a sensor setting to its physical probability range. */
function probability(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

/**
 * Return when a track can first be made available to the operator.
 * Latency is separate from the visibility/dropout probability and is also
 * reflected in detection timing once the operator acquires the track.
 */
export function sensorAvailableAt(spawnTime = 0, latency = 0) {
  return Math.max(0, Number(spawnTime) || 0) + Math.max(0, Number(latency) || 0);
}

export function trackAvailable(simTime, spawnTime, latency = 0) {
  return (Number(simTime) || 0) >= sensorAvailableAt(spawnTime, latency);
}

/**
 * Apply independent sensor degradation effects.
 *
 * SNR is the probability that a signal is detectable. Dropout is a separate
 * probability that an otherwise detectable signal is unavailable for this
 * sample. Keeping two draws makes changing one setting observable without
 * silently changing the other.
 *
 * @param {number} snr - 0..1 signal quality
 * @param {number} dropout - 0..1 base dropout probability
 * @param {function} rand - random source (injectable for tests)
 */
export function sensorVisible(snr = 1, dropout = 0, rand = Math.random) {
  const signalDetected = rand() < probability(snr, 1);
  const notDropped = rand() >= probability(dropout, 0);
  return signalDetected && notDropped;
}

/**
 * Sensor samples are held for this long (simulation seconds) before a track's
 * visibility is re-drawn. A per-frame draw flickers every ~16 ms, which makes
 * a momentary dropout impossible to click and yanks the operator's selection.
 * Holding each sample gives dropouts a bounded, readable window.
 */
export const SENSOR_SAMPLE_INTERVAL = 2;

/**
 * Draw the next held visibility sample for one track.
 *
 * Between samples the previous visibility is held (no re-draw). When a sample
 * is due, visibility is `trackAvailable(simTime, ...) && sensorVisible(...)`.
 * The sample schedule starts at the track's availability time, so sensor
 * latency is never leapfrogged by the hold logic.
 *
 * @returns {{ visible: boolean, nextSampleAt: number }}
 */
export function sampleVisibility({
  simTime, spawnTime = 0, latency = 0, snr = 1, dropout = 0,
  prevVisible = false, nextSampleAt = 0, interval = SENSOR_SAMPLE_INTERVAL,
  rand = Math.random,
}) {
  const now = Number(simTime) || 0;
  const due = Number(nextSampleAt) || 0;
  if (now < due) return { visible: prevVisible === true, nextSampleAt: due };
  return {
    visible: trackAvailable(now, spawnTime, latency) && sensorVisible(snr, dropout, rand),
    nextSampleAt: now + interval,
  };
}

/**
 * Radar coverage radius (sim metres). The PPI draws its range rings out to
 * this distance and reads "RNG 500m"; the outer ring is the coverage boundary,
 * so scenario generation spawns every drone beyond it and flies it in.
 */
export const SIM_RANGE = 500;

/** Inside this radius a track's return reads at full strength. */
export const SIGNAL_FULL_RADIUS = 160;

/**
 * Relative return strength for a track `radius` metres from the sensor, on a
 * smooth 0..1 ramp: full strength inside SIGNAL_FULL_RADIUS, tapering to zero
 * at the edge of coverage. Detection probability scales with it, so a drone's
 * signal strengthens as it closes on the centre and weakens as it withdraws.
 */
export function signalStrength(radius) {
  const r = Math.max(0, Number(radius) || 0);
  if (r >= SIM_RANGE) return 0;
  if (r <= SIGNAL_FULL_RADIUS) return 1;
  const k = (SIM_RANGE - r) / (SIM_RANGE - SIGNAL_FULL_RADIUS);
  return k * k * (3 - 2 * k); // smoothstep, so the ramp has no hard knee
}

export default {
  updateThreatPosition, sensorAvailableAt, trackAvailable, sensorVisible,
  sampleVisibility, SENSOR_SAMPLE_INTERVAL, signalStrength, SIM_RANGE, SIGNAL_FULL_RADIUS,
};
