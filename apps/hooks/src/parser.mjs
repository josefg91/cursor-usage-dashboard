function toNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function pickString(obj, keys, fallback = '') {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.length > 0) {
      return val;
    }
  }
  return fallback;
}

function pickNumber(sources, keys) {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of keys) {
      if (src[key] !== undefined && src[key] !== null && src[key] !== '') {
        const parsed = toNonNegativeInt(src[key]);
        if (parsed >= 0) return parsed;
      }
    }
  }
  return 0;
}

/**
 * Parsea de forma defensiva el JSON recibido por stdin desde un hook de Cursor.
 */
export function parseHookPayload(rawInput, eventHint = '') {
  let payload = {};
  if (typeof rawInput === 'string' && rawInput.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawInput);
      if (parsed && typeof parsed === 'object') {
        payload = parsed;
      }
    } catch {
      payload = { _unparsed_stdin: rawInput.slice(0, 2000) };
    }
  } else if (rawInput && typeof rawInput === 'object') {
    payload = rawInput;
  }

  const eventName =
    eventHint ||
    pickString(payload, ['hook_event_name', 'event', 'event_name', 'type'], 'unknown');

  const conversationId = pickString(
    payload,
    ['conversation_id', 'conversationId', 'session_id', 'sessionId', 'generation_id', 'generationId'],
    'unknown-conversation',
  );

  const model = pickString(
    payload,
    ['model', 'model_name', 'modelName', 'selected_model'],
    pickString(payload.usage, ['model'], 'unknown'),
  );

  const promptText = pickString(
    payload,
    ['prompt', 'prompt_text', 'promptText', 'user_prompt', 'message', 'text'],
    '',
  );

  const responseText = pickString(
    payload,
    ['response', 'response_text', 'responseText', 'assistant_response', 'text', 'output'],
    '',
  );

  const usageSources = [payload, payload.usage, payload.token_usage, payload.tokens, payload.metrics];

  const inputTokens = pickNumber(usageSources, [
    'input_tokens',
    'inputTokens',
    'prompt_tokens',
    'promptTokens',
  ]);
  const cacheReadTokens = pickNumber(usageSources, [
    'cache_read_tokens',
    'cacheReadTokens',
    'cache_read_input_tokens',
    'cacheReadInputTokens',
    'cached_tokens',
  ]);
  const cacheWriteTokens = pickNumber(usageSources, [
    'cache_write_tokens',
    'cacheWriteTokens',
    'cache_creation_input_tokens',
    'cacheCreationInputTokens',
  ]);
  const outputTokens = pickNumber(usageSources, [
    'output_tokens',
    'outputTokens',
    'completion_tokens',
    'completionTokens',
  ]);
  const reasoningTokens = pickNumber(usageSources, [
    'reasoning_tokens',
    'reasoningTokens',
    'thinking_tokens',
    'thinkingTokens',
  ]);

  const timestamp = pickString(payload, ['timestamp', 'created_at'], new Date().toISOString());

  return {
    event_name: eventName,
    conversation_id: conversationId,
    timestamp,
    model,
    prompt_text: promptText,
    response_text: responseText,
    input_tokens: inputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoningTokens,
    raw_hook_json: payload,
  };
}
