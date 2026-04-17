type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function parseJsonLikeString(value: string): unknown | undefined {
  const normalized = value.trim();
  if (!normalized.startsWith('{') && !normalized.startsWith('[')) {
    return undefined;
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return undefined;
  }
}

function normalizeStructuredPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return parseJsonLikeString(value) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStructuredPayload(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeStructuredPayload(entry)]),
  );
}

function isStructuredPayload(value: unknown): boolean {
  const normalized = normalizeStructuredPayload(value);
  return Array.isArray(normalized) || isRecord(normalized);
}

function normalizeEmbeddedOutput(output: unknown): unknown {
  if (!isRecord(output)) {
    return normalizeStructuredPayload(output);
  }

  const normalized = Object.fromEntries(
    Object.entries(output).map(([key, entry]) => [key, normalizeStructuredPayload(entry)]),
  );

  return normalized;
}

function isMeaningfulToolPayload(value: unknown): boolean {
  if (value == null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => isMeaningfulToolPayload(entry));
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    return entries.length > 0 && entries.some(([, entry]) => isMeaningfulToolPayload(entry));
  }

  return true;
}

export function resolveToolInvocationOutput(
  output: unknown,
  result: unknown,
): unknown {
  const normalizedOutput = normalizeEmbeddedOutput(output);
  const normalizedResult = normalizeStructuredPayload(result);

  if (!isMeaningfulToolPayload(normalizedOutput)) {
    return normalizedResult;
  }

  if (normalizedResult === undefined) {
    return normalizedOutput;
  }

  if (!isRecord(normalizedOutput)) {
    return isStructuredPayload(normalizedResult) ? normalizedResult : normalizedOutput;
  }

  if (!('result' in normalizedOutput) || !isMeaningfulToolPayload(normalizedOutput.result)) {
    return { ...normalizedOutput, result: normalizedResult };
  }

  if (isStructuredPayload(normalizedResult) && !isStructuredPayload(normalizedOutput.result)) {
    return { ...normalizedOutput, result: normalizedResult };
  }

  return normalizedOutput;
}
