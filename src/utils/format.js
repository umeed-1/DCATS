/**
 * Operator-facing display formatting, shared by the console and the debrief.
 *
 * Internal threat ids are "t-N" (0-based); wherever the operator reads one
 * it appears as "Drone 01", "Drone 02", … — plain operator language, never
 * a machine code. Space-constrained contexts (chart axes) show the bare
 * number.
 */
const droneNumber = (id) =>
  String((Number(String(id).replace(/\D/g, '')) || 0) + 1).padStart(2, '0');

export const trackLabel = (id) => `Drone ${droneNumber(id)}`;

export const trackNum = (id) => droneNumber(id);
