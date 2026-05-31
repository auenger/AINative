/**
 * Shared workshop marker parsing utilities.
 *
 * Provides the `step-progress` marker parser used by all three workshop panels
 * (BrainstormPanel, PartyModePanel, PrdCreationPanel).
 *
 * Marker format (self-closing HTML comment):
 * <!-- workshop:step-progress current="N" total="M" label="step description" -->
 */

import type { StepProgressPayload } from '../../types';

/** Regex for step-progress markers */
const STEP_PROGRESS_REGEX = /<!-- workshop:step-progress current="(\d+)" total="(\d+)" label="([^"]*)" -->/;

/**
 * Parse step-progress marker from assistant message content.
 * Returns `{ text, stepProgress }` where `text` has the marker stripped.
 * If no marker is found, `stepProgress` is null and `text` is unchanged.
 */
export function parseStepProgressMarker(content: string): {
  text: string;
  stepProgress: StepProgressPayload | null;
} {
  const match = content.match(STEP_PROGRESS_REGEX);
  if (!match) {
    return { text: content, stepProgress: null };
  }

  const current = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  const label = match[3];

  const cleanText = content.replace(STEP_PROGRESS_REGEX, '').trim();

  return {
    text: cleanText,
    stepProgress: { type: 'step-progress', current, total, label },
  };
}

/**
 * Extract the latest step-progress from a list of parsed messages.
 * Scans messages in reverse order to find the most recent step-progress.
 */
export function extractLatestStepProgress(
  messages: Array<{ role: string; stepProgress?: StepProgressPayload | null }>,
): StepProgressPayload | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    if (msg.stepProgress) {
      return msg.stepProgress;
    }
  }
  return null;
}
