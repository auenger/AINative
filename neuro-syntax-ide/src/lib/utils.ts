import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Tauri command availability detection
// ---------------------------------------------------------------------------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Cache for command availability checks to avoid repeated invoke failures. */
let _dispatchCommandAvailable: boolean | null = null;

/**
 * Check whether the `dispatch_to_runtime` Tauri command is available.
 *
 * Strategy: attempt a lightweight invoke with empty/invalid args.
 * If it throws with "not found" or similar, the command is not registered.
 * The result is cached so we only check once per session.
 */
export async function isDispatchCommandAvailable(): Promise<boolean> {
  // Not in Tauri context — always "available" (dev fallback handles it)
  if (!isTauri) return true;

  // Return cached result if available
  if (_dispatchCommandAvailable !== null) return _dispatchCommandAvailable;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    // Try invoking with minimal args — if the command exists it will return
    // an error about invalid args, but NOT "not found"
    await invoke('dispatch_to_runtime', { runtimeId: '__availability_check__', skill: '', args: {} });
    // If we get here without throwing, the command exists (and maybe even succeeded with dummy data)
    _dispatchCommandAvailable = true;
    return true;
  } catch (e: any) {
    const msg = (e?.toString() ?? '').toLowerCase();
    // "not found" or "no such command" means the backend command is not registered
    if (msg.includes('not found') || msg.includes('no such command') || msg.includes('unknown command')) {
      _dispatchCommandAvailable = false;
      return false;
    }
    // Other errors (e.g. validation error) mean the command EXISTS but rejected our args
    _dispatchCommandAvailable = true;
    return true;
  }
}

/**
 * Reset the cached availability state (useful after a runtime reload).
 */
export function resetDispatchAvailabilityCache(): void {
  _dispatchCommandAvailable = null;
}

/**
 * Check if an error from invoke() indicates the command is not registered.
 */
export function isCommandNotFoundError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  return msg.includes('not found') || msg.includes('no such command') || msg.includes('unknown command');
}
