export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      ...options,
      credentials: 'include',
      headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    });
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }
  if (!response.ok) {
    const value = await response
      .json()
      .catch(() => ({ error: 'The request could not be completed.' }));
    throw new Error(value.error || 'The request could not be completed.');
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const send = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});
