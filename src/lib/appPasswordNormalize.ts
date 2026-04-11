/**
 * Gmail App Passwords are 16 characters; Google often shows them grouped with spaces.
 * Strip all whitespace (including NBSP / zero-width) before validation, API, and storage.
 */
export function normalizeAppPassword(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[\s\u00A0\u200B\uFEFF\u200C\u200D]+/g, '');
}

/** Typical Google App Password length is 16; allow a small range for typos before server verify. */
export function isPlausibleAppPasswordLength(normalized: string): boolean {
  const n = normalized.length;
  return n >= 14 && n <= 19;
}
