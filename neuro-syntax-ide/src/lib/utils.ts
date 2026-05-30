import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Noise cleaning (shared) ───

function cleanNoiseText(text: string): string {
  return text
    .replace(/task_(?:started|progress|notification)["'}\s]*\}?/gi, '')
    .replace(/^\s*(\[SYSTEM\]\s*)?(INIT\s*[—\-].*)$/gim, '')
    .replace(/\[SYSTEM\]\s*"OPTIONS"\s*:\s*\[[\s\S]*?\]\s*$/gm, '')
    .replace(/"OPTIONS"\s*:\s*\[[\s\S]*?\{[\s\S]*?"DESCRIPTION"[\s\S]*?\}\s*\]/gm, '')
    .replace(/\{"(?:description|prompt|tool_name)"[^}]*\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── filterToolCallText: remove all tool calls + noise (for WorkshopChatBubble) ───

export function filterToolCallText(content: string): string {
  const filtered = content
    .replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '')
    .replace(/<tool_result>[\s\S]*?<\/tool_result>/g, '')
    .replace(/<tool_name>[\s\S]*?<\/tool_name>/g, '')
    .replace(/^\s*tool_name:\s*\S+.*$/gm, '')
    .replace(/^\s*tool_result:\s*\S+.*$/gm, '')
    .replace(/\[tool:\s*\w+\]\s*\{[^}]*\}/g, '')
    .replace(/^\[tool:.*?\]\s*\{[\s\S]*?\}/gm, '');
  return cleanNoiseText(filtered);
}

// ─── parseContentSegments: extract tool calls as structured segments (for PersonaCardMessage) ───

export interface ToolCallInfo {
  toolName: string;
  param: string;
}

export interface ContentSegment {
  type: 'text' | 'tool-call';
  content: string;
  toolInfo?: ToolCallInfo;
}

function extractParam(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr);
    return String(
      parsed.file_path || parsed.path ||
      parsed.command || parsed.cmd ||
      parsed.description || parsed.query ||
      parsed.pattern || parsed.glob || ''
    );
  } catch {
    return jsonStr;
  }
}

function extractParamFromObj(obj: Record<string, unknown>): string {
  return String(
    obj.file_path || obj.path ||
    obj.command || obj.cmd ||
    obj.description || obj.query ||
    obj.pattern || obj.glob || ''
  );
}

export function parseContentSegments(content: string): ContentSegment[] {
  const matches: { index: number; length: number; segment: ContentSegment }[] = [];

  // Pattern 1: [tool: X] {json}
  const p1 = /\[tool:\s*(\w+)\]\s*(\{[^}]*\})/g;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(content)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      segment: {
        type: 'tool-call',
        content: m[0],
        toolInfo: { toolName: m[1], param: extractParam(m[2]) },
      },
    });
  }

  // Pattern 2: <tool_use>JSON</tool_use>
  const p2 = /<tool_use>([\s\S]*?)<\/tool_use>/g;
  while ((m = p2.exec(content)) !== null) {
    try {
      const inner = JSON.parse(m[1].trim());
      const toolName = inner.name || 'Tool';
      const input = (inner.input || {}) as Record<string, unknown>;
      matches.push({
        index: m.index,
        length: m[0].length,
        segment: {
          type: 'tool-call',
          content: m[0],
          toolInfo: { toolName, param: extractParamFromObj(input) },
        },
      });
    } catch { /* skip malformed */ }
  }

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  // Build segments
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index < lastIndex) continue;

    if (match.index > lastIndex) {
      const text = cleanNoiseText(content.slice(lastIndex, match.index));
      if (text) segments.push({ type: 'text', content: text });
    }

    segments.push(match.segment);
    lastIndex = match.index + match.length;
  }

  if (lastIndex < content.length) {
    const text = cleanNoiseText(content.slice(lastIndex));
    if (text) segments.push({ type: 'text', content: text });
  }

  // Merge adjacent text segments
  const merged: ContentSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === 'text' && seg.type === 'text') {
      last.content += '\n\n' + seg.content;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
