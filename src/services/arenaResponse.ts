/** Keep infrastructure error pages out of the Arena UI. */
export async function readArenaResponse<T>(response: Response, fallback: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) throw new Error(fallback);

  let data: T & { error?: string; detail?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error(fallback);
  }

  if (data === null || typeof data !== 'object') throw new Error(fallback);
  if (!response.ok) throw new Error(data.error ?? data.detail ?? fallback);
  return data;
}
