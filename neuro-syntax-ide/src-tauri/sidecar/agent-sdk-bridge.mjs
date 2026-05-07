#!/usr/bin/env node

/**
 * agent-sdk-bridge.mjs — Node.js sidecar bridge for Claude Agent SDK.
 *
 * Communication protocol: NDJSON over stdin/stdout.
 *
 * Input (from Rust via stdin):
 *   { type: "query", prompt: string, sessionId?: string, options?: { model?, env? } }
 *   { type: "interrupt" }
 *   { type: "close" }
 *
 * Output (to Rust via stdout):
 *   { type: "assistant", text: string }
 *   { type: "result", text: string, is_done: true }
 *   { type: "error", subtype?: string, text: string }
 *   { type: "system", session_id?: string }
 *   { type: "rate_limit", ...info }
 *
 * Startup banners and non-JSON diagnostics go to stderr.
 */

import { createInterface } from 'readline';
import { query } from '@anthropic-ai/claude-agent-sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(obj) {
  try {
    process.stdout.write(JSON.stringify(obj) + '\n');
  } catch (e) {
    process.stderr.write(`[bridge] send error: ${e.message}\n`);
  }
}

function sendError(subtype, text) {
  send({ type: 'error', subtype, text });
}

function sendResult(text) {
  send({ type: 'result', text: text ?? '', is_done: true });
}

// ---------------------------------------------------------------------------
// Query handler
// ---------------------------------------------------------------------------

let currentAbortController = null;

async function handleQuery(msg) {
  const { prompt, sessionId, options } = msg;

  if (!prompt) {
    sendError('missing_prompt', 'query message requires a "prompt" field');
    return;
  }

  currentAbortController = new AbortController();

  try {
    const sdkOptions = {
      abortSignal: currentAbortController.signal,
    };

    // Inject environment variables for provider config
    if (options?.env) {
      sdkOptions.env = { ...process.env, ...options.env };
    }

    // Set model if provided
    if (options?.model) {
      sdkOptions.model = options.model;
    }

    // Resume session if sessionId provided
    if (sessionId) {
      sdkOptions.resume = sessionId;
    }

    // Send system event indicating query started
    send({ type: 'system', session_id: sessionId ?? null });

    const sdkStream = query(prompt, sdkOptions);

    for await (const message of sdkStream) {
      // Check if aborted between iterations
      if (currentAbortController?.signal.aborted) {
        break;
      }

      if (!message || typeof message !== 'object') {
        continue;
      }

      const msgType = message.type;

      if (msgType === 'assistant') {
        // Extract text content from assistant message
        const text = extractAssistantText(message);
        if (text) {
          send({ type: 'assistant', text });
        }
      } else if (msgType === 'result') {
        // Final result
        const text = typeof message.result === 'string'
          ? message.result
          : (message.result ? JSON.stringify(message.result) : '');
        sendResult(text);
        // Capture session_id from result if present
        if (message.session_id) {
          send({ type: 'system', session_id: message.session_id });
        }
      } else if (msgType === 'stream_event') {
        // Partial streaming output
        const text = extractStreamText(message);
        if (text) {
          send({ type: 'assistant', text });
        }
      } else if (msgType === 'rate_limit_event') {
        send({
          type: 'rate_limit',
          ...message,
        });
      } else if (msgType === 'system') {
        // System messages (init, etc.)
        if (message.session_id) {
          send({ type: 'system', session_id: message.session_id });
        }
      }
    }

    // If stream ended without a result event, send done
    sendResult('');
  } catch (e) {
    if (e.name === 'AbortError') {
      sendResult('');
      return;
    }

    const errMsg = e?.message ?? String(e);
    process.stderr.write(`[bridge] query error: ${errMsg}\n`);

    // Detect common error patterns
    if (errMsg.includes('401') || errMsg.includes('authentication') || errMsg.includes('api_key') || errMsg.includes('x-api-key')) {
      sendError('auth', 'API Key 无效，请检查 Provider 配置');
    } else if (errMsg.includes('429') || errMsg.includes('rate_limit') || errMsg.includes('rate limit')) {
      send({ type: 'rate_limit', text: errMsg });
      sendResult('');
    } else {
      sendError('query_failed', errMsg);
    }
  } finally {
    currentAbortController = null;
  }
}

function extractAssistantText(msg) {
  // SDK assistant message format: { type: "assistant", message: { content: [{ type: "text", text: "..." }] } }
  if (msg.message?.content) {
    if (Array.isArray(msg.message.content)) {
      return msg.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
    }
    if (typeof msg.message.content === 'string') {
      return msg.message.content;
    }
  }
  if (typeof msg.content === 'string') {
    return msg.content;
  }
  return '';
}

function extractStreamText(msg) {
  // Stream event may have delta or content
  if (msg.delta?.text) return msg.delta.text;
  if (msg.content) {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Interrupt handler
// ---------------------------------------------------------------------------

function handleInterrupt() {
  if (currentAbortController) {
    currentAbortController.abort();
    sendResult('');
  }
}

// ---------------------------------------------------------------------------
// Main: stdin NDJSON reader
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return; // skip empty lines

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch (e) {
    sendError('malformed_input', `Invalid JSON: ${trimmed.substring(0, 200)}`);
    return;
  }

  if (!msg || typeof msg.type !== 'string') {
    sendError('malformed_input', `Missing "type" field: ${trimmed.substring(0, 200)}`);
    return;
  }

  switch (msg.type) {
    case 'query':
      handleQuery(msg).catch((e) => {
        sendError('unhandled', e?.message ?? String(e));
      });
      break;
    case 'interrupt':
      handleInterrupt();
      break;
    case 'close':
      process.exit(0);
      break;
    default:
      sendError('unknown_type', `Unknown message type: ${msg.type}`);
  }
});

rl.on('close', () => {
  // stdin closed by Rust side, clean exit
  if (currentAbortController) {
    currentAbortController.abort();
  }
  process.exit(0);
});

// Signal handlers
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

// Startup banner to stderr (not stdout — preserve NDJSON channel)
process.stderr.write('[bridge] agent-sdk-bridge ready\n');
