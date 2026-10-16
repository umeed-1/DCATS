/**
 * DCATS — AAREngine.js
 * After-Action Review computations: timelines, summaries, recommendations.
 * Pure functions over (threats, events, score) — framework-free.
 */

export function threatSummary(threats) {
  const total = threats.length;
  const tracked = threats.filter(t => t.tracked).length;
  const classified = threats.filter(t => t.classified).length;
  const correct = threats.filter(t => t.classCorrect).length;
  const alerted = threats.filter(t => t.alerted).length;
  const neutralised = threats.filter(t => t.neutralised).length;
  // A correctly identified decoy that was reported and deliberately left alone
  // is handled correctly; it must not be counted as an incomplete engagement.
  const isStoodDownDecoy = (t) => (
    t.type === 'decoy' && t.classCorrect === true && t.alerted === true && !t.neutralised
  );
  // Same for an unidentified return: correct call + report + hold fire is the
  // intended outcome, not a missed engagement.
  const isStoodDownUnidentified = (t) => (
    t.type === 'unidentified' && t.classCorrect === true && t.alerted === true && !t.neutralised
  );
  const decoysStoodDown = threats.filter(isStoodDownDecoy).length;
  const unidentifiedStoodDown = threats.filter(isStoodDownUnidentified).length;
  const missed = threats.filter(t => (
    !isStoodDownDecoy(t) && !isStoodDownUnidentified(t)
    && (!t.tracked || !t.classified || !t.alerted || !t.neutralised)
  )).length;
  const aiAccepted = threats.filter(t => t.classificationSource === 'ai-accepted').length;
  const overrides = threats.filter(t => t.classificationSource === 'trainee-override').length;
  return {
    total, tracked, classified, correct, alerted, neutralised,
    missed, decoysStoodDown, unidentifiedStoodDown, aiAccepted, overrides,
  };
}

export function timelineData(events) {
  let runningScore = 0;
  return events.map(ev => {
    // New sessions attach the authoritative weighted score snapshot to every
    // operator event. Keep a small legacy fallback for records created by an
    // older build so historical archives still render.
    if (ev.score?.total != null) {
      runningScore = ev.score.total;
    } else {
      if (ev.type === 'classify' && ev.correct) runningScore += 20;
      if (ev.type === 'engage') runningScore += 15;
    }
    return { time: parseFloat(ev.time.toFixed(1)), score: runningScore, event: ev.type };
  });
}

export function detectionTimes(threats) {
  return threats
    .filter(t => t.tracked && t.trackedAt != null)
    .map(t => ({
      id: t.id,
      type: t.label ?? t.type,
      // Tracked before the nominal spawn reference reads as immediate (0s).
      detectionTime: Math.max(0, parseFloat(((t.trackedAt ?? 0) - (t.spawnTime ?? 0)).toFixed(1))),
    }))
    .sort((a, b) => a.detectionTime - b.detectionTime);
}

export function avgDetectionTime(threats) {
  const rows = detectionTimes(threats);
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + r.detectionTime, 0) / rows.length;
}

/**
 * Personalised training recommendations from score + summary.
 * Returns [{ severity: 'high' | 'warn' | 'ok', text }] — rendered
 * with severity styling in the AAR dashboard.
 */
export function recommendations(score, summary) {
  const recs = [];
  if (score.detection < 50)
    recs.push({ severity: 'warn', text: 'Detection is slow — acquire drones within 3s of spawn. Practise Mission 01.' });
  if (score.classification < 60)
    recs.push({ severity: 'warn', text: 'Classification accuracy is low — study RCS and speed patterns in the Threat Encyclopedia.' });
  if (score.engagement < 50)
    recs.push({ severity: 'warn', text: 'Engagement quality needs work — confirm correct classification before engaging.' });
  if (score.collateral < 80)
    recs.push({ severity: 'high', text: 'Collateral score is concerning — do not engage unclassified or low-confidence targets.' });
  // Decoys and unidentified returns that were correctly stood down are not
  // targets that still need neutralising, so exclude them from the
  // engagement-tempo denominator.
  const actionable = Math.max(
    0,
    summary.total - (summary.decoysStoodDown ?? 0) - (summary.unidentifiedStoodDown ?? 0)
  );
  if (actionable > 0 && summary.neutralised < actionable * 0.5)
    recs.push({ severity: 'warn', text: 'Fewer than half the threats neutralised — increase engagement tempo on classified targets.' });
  if (recs.length === 0)
    recs.push({ severity: 'ok', text: 'Excellent performance across all metrics — increase difficulty or try Procedural Generation.' });
  return recs;
}

const SESSION_ARCHIVE_FORMAT = 'dcats-session-archive';

function cloneSessionRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  try {
    // JSON cloning keeps archive data portable and, importantly, retains any
    // detailed fields added by the store instead of projecting to summary rows.
    return JSON.parse(JSON.stringify(record));
  } catch {
    return null;
  }
}

export function normalizeSessionRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map(cloneSessionRecord).filter(Boolean);
}

function sessionRecordKey(record) {
  if (record.id != null) return `id:${String(record.id)}`;
  return [
    record.date ?? record.savedAt ?? '',
    record.scenarioName ?? record.scenario ?? '',
    record.score?.total ?? record.score ?? '',
    record.eventCount ?? '',
  ].join('|');
}

/**
 * Merge archive imports by record id while retaining extra fields from both
 * versions. Records from the import win when the same field is present.
 */
export function mergeSessionRecords(existing, incoming) {
  const merged = normalizeSessionRecords(existing);
  const positions = new Map(merged.map((record, index) => [sessionRecordKey(record), index]));

  for (const record of normalizeSessionRecords(incoming)) {
    const key = sessionRecordKey(record);
    const position = positions.get(key);
    if (position == null) {
      positions.set(key, merged.length);
      merged.push(record);
    } else {
      merged[position] = { ...merged[position], ...record };
    }
  }
  return merged;
}

/**
 * Produce a versioned, human-readable JSON archive. The envelope also makes
 * it possible to evolve the format without breaking array exports from older
 * builds.
 */
export function serializeSessionArchive(records) {
  return JSON.stringify({
    format: SESSION_ARCHIVE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: normalizeSessionRecords(records),
  }, null, 2);
}

/** Parse both the current archive envelope and legacy raw session arrays. */
export function parseSessionArchive(raw) {
  let parsed = raw;
  if (typeof raw === 'string') parsed = JSON.parse(raw);

  const records = Array.isArray(parsed)
    ? parsed
    : parsed?.sessions ?? parsed?.records;
  if (!Array.isArray(records)) {
    throw new Error('The selected file does not contain a session archive.');
  }
  return normalizeSessionRecords(records);
}

async function openSessionDatabase() {
  const { openDB } = await import('idb');
  return openDB('dcats', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sessions'))
        db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
    },
  });
}

function readLocalSessions() {
  try {
    return normalizeSessionRecords(JSON.parse(localStorage.getItem('dcats.sessions') ?? '[]'));
  } catch {
    return [];
  }
}

/**
 * Persist a session record. Uses IndexedDB (idb) when available,
 * falls back to localStorage — always offline-first.
 */
export async function persistSession(record) {
  const entry = { ...record, savedAt: new Date().toISOString() };
  try {
    const db = await openSessionDatabase();
    // `put` makes session persistence idempotent when a completed mission is
    // retried after a renderer reload or an import is repeated.
    await db.put('sessions', entry);
    return { backend: 'indexeddb', entry };
  } catch {
    try {
      const key = 'dcats.sessions';
      const prev = readLocalSessions();
      prev.push(entry);
      localStorage.setItem(key, JSON.stringify(prev));
      return { backend: 'localstorage', entry };
    } catch {
      return { backend: 'memory', entry };
    }
  }
}

export async function loadSessions() {
  try {
    const db = await openSessionDatabase();
    return normalizeSessionRecords(await db.getAll('sessions'));
  } catch {
    return readLocalSessions();
  }
}

/**
 * Personal views only ever read the signed-in trainee's sessions. Records
 * without a traineeId are legacy/shared archive entries — the instructor
 * archive still lists them, but they never leak into another trainee's plan.
 */
export function sessionsForTrainee(records, traineeId) {
  const key = String(traineeId ?? '').trim().toLowerCase();
  if (!key) return [];
  return (Array.isArray(records) ? records : []).filter(
    record => String(record?.traineeId ?? '').trim().toLowerCase() === key
  );
}

export async function loadSessionsForTrainee(traineeId) {
  if (!String(traineeId ?? '').trim()) return [];
  return sessionsForTrainee(await loadSessions(), traineeId);
}

/**
 * Merge imported records into the local archive and write the complete merged
 * set to the available offline backend. This updates an existing record when
 * an import contains a richer version of the same session.
 */
export async function importSessionRecords(records) {
  const incoming = normalizeSessionRecords(records);
  const existing = await loadSessions();
  const merged = mergeSessionRecords(existing, incoming);
  if (!incoming.length) return existing;

  try {
    const db = await openSessionDatabase();
    const tx = db.transaction('sessions', 'readwrite');
    for (const record of merged) {
      const entry = { ...record };
      if (entry.id == null) delete entry.id;
      await tx.store.put(entry);
    }
    await tx.done;
    return normalizeSessionRecords(await db.getAll('sessions'));
  } catch {
    try {
      localStorage.setItem('dcats.sessions', JSON.stringify(merged));
      return merged;
    } catch {
      // The caller still receives the imported data when browser storage is
      // unavailable, so the UI can report a usable in-memory result.
      return merged;
    }
  }
}

export default {
  threatSummary, timelineData, detectionTimes,
  avgDetectionTime, recommendations, persistSession, loadSessions,
  sessionsForTrainee, loadSessionsForTrainee,
  normalizeSessionRecords, mergeSessionRecords, serializeSessionArchive,
  parseSessionArchive, importSessionRecords,
};
