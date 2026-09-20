'use client';
import { clearUser } from './session';

/**
 * Best-effort close for browser / desktop-shell deployments.
 * Normal browser tabs may reject window.close() when the tab was not opened by script,
 * so the safe fallback is a fully logged-out login screen.
 */
export async function closePosApplication() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
  clearUser();

  try { window.close(); } catch {}
  try { window.open('', '_self')?.close(); } catch {}

  window.setTimeout(() => {
    if (!window.closed) window.location.replace('/login?closed=1');
  }, 220);
}
