/**
 * Reads one localStorage value. Returns null when the key is missing or storage is unavailable,
 * so callers never have to wrap reads in try/catch.
 */
export function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes one localStorage value. Throws when storage is full or blocked: a failed write must never look
 * like a saved one, so the caller decides what to do (show an error, keep the old state, or skip on purpose).
 */
export function writeStorage(key, value) {
  localStorage.setItem(key, String(value));
}

/** Removes one localStorage value. Throws when storage is blocked, so a plaintext secret is never reported as removed. */
export function removeStorage(key) {
  localStorage.removeItem(key);
}
