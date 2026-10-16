/**
 * DCATS — local trainee profiles.
 *
 * The welcome screen is a local identity gate, not server authentication:
 * profiles live on this machine only. PINs are stored as salted hashes so
 * the plain PIN is never written to disk, and every check runs offline.
 */

const PROFILES_KEY = 'dcats.profiles';
const SESSION_KEY = 'dcats.session';

// In-memory fallbacks keep the trainer usable when browser storage is
// unavailable (private mode, locked-down file contexts).
let memoryProfiles = {};
let memorySession = null;

export function normalizeUserId(value) {
  return String(value ?? '').trim();
}

export function validateUserId(value) {
  const id = normalizeUserId(value);
  if (!id) return 'Enter a user ID.';
  if (!/^[A-Za-z0-9._-]{3,24}$/.test(id)) {
    return 'Use 3–24 letters, numbers, dots, dashes or underscores.';
  }
  return null;
}

export function validatePin(value) {
  const pin = String(value ?? '');
  if (!pin) return 'Enter a PIN.';
  if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4–6 digits.';
  return null;
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fall through to memory
  }
  return memoryProfiles;
}

function saveProfiles(profiles) {
  memoryProfiles = profiles;
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // memory fallback already updated
  }
}

function saveSession(session) {
  memorySession = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // memory fallback already updated
  }
}

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.userId) return parsed;
    }
  } catch {
    // fall through to memory
  }
  return memorySession;
}

export function clearSession() {
  memorySession = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing else to clear
  }
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function digestPin(pin, salt) {
  const value = `${salt}:${pin}`;
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(value);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // Non-secure contexts: deterministic offline fallback. Still never stores
  // the plain PIN, but the page tells the user this is a local trainer gate.
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = (Math.imul(h2 ^ code, 2246822519) + i) >>> 0;
  }
  return `fallback-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Sign in (or create the profile on first use with this ID) and persist the
 * active session for reloads. Throws with a readable message on bad input or
 * a PIN mismatch.
 */
export async function signIn(userId, pin) {
  const id = normalizeUserId(userId);
  const idError = validateUserId(id);
  if (idError) throw new Error(idError);
  const pinError = validatePin(pin);
  if (pinError) throw new Error(pinError);

  const key = id.toLowerCase();
  const profiles = loadProfiles();
  const existing = profiles[key];
  let entry;

  if (existing) {
    const hash = await digestPin(pin, existing.salt ?? '');
    if (hash !== existing.pinHash) {
      throw new Error('That PIN does not match this user ID.');
    }
    entry = { ...existing, userId: existing.userId || id, lastLogin: new Date().toISOString() };
  } else {
    const salt = randomSalt();
    entry = {
      userId: id,
      salt,
      pinHash: await digestPin(pin, salt),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
  }

  profiles[key] = entry;
  saveProfiles(profiles);

  const session = { userId: entry.userId, signedInAt: entry.lastLogin };
  saveSession(session);
  return session;
}

export default { signIn, readSession, clearSession, validateUserId, validatePin, normalizeUserId };
