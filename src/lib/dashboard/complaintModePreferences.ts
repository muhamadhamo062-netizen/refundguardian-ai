/**
 * Client-only preference for how the dashboard labels and copies complaint text.
 * Default: AI-driven (server uses `complaintGenerator` for advisory messages).
 */

const KEY = 'rg_complaint_mode_v1';

export type ComplaintMode = 'AI_DRIVEN' | 'TEMPLATES_ONLY';

export const DEFAULT_COMPLAINT_MODE: ComplaintMode = 'AI_DRIVEN';

function normalize(v: unknown): ComplaintMode {
  if (v === 'TEMPLATES_ONLY' || v === 'AI_DRIVEN') return v;
  return DEFAULT_COMPLAINT_MODE;
}

export function loadComplaintMode(): ComplaintMode {
  if (typeof window === 'undefined') return DEFAULT_COMPLAINT_MODE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_COMPLAINT_MODE;
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_COMPLAINT_MODE;
  }
}

export function saveComplaintMode(mode: ComplaintMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mode));
  } catch {
    /* ignore */
  }
}
