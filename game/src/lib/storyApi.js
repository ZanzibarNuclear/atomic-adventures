export async function storyApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message ?? `Request failed with ${response.status}.`);
    error.status = response.status;
    error.errors = body.errors ?? {};
    error.current = body.current ?? null;
    throw error;
  }
  return body;
}
