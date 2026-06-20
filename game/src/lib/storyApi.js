export async function storyApi(path, options = {}) {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = fetchOptions.signal ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const response = await fetch(path, {
    ...fetchOptions,
    signal: fetchOptions.signal ?? controller.signal,
    headers: {
      Accept: "application/json",
      ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
      ...fetchOptions.headers,
    },
  }).catch((error) => {
    if (error.name === "AbortError") {
      throw new Error(`Request to ${path} timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  }).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
  try {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message ?? `Request failed with ${response.status}.`);
      error.status = response.status;
      error.errors = body.errors ?? {};
      error.current = body.current ?? null;
      throw error;
    }
    return body;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
