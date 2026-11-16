export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requestJSON<T>(
  url: string,
  options: RequestInit = {},
  fallbackMessage = "Request failed",
): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new HttpError(response.status, body?.message || body?.error || fallbackMessage);
  }
  return response.json();
}

export async function fetchJSON<T>(
  url: string,
  options: {
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    /** Abort the request after this long instead of waiting indefinitely. */
    timeoutMs?: number;
  } = {},
): Promise<T> {
  // Build URL with query params if provided
  const finalUrl = options.queryParams
    ? url + "?" + new URLSearchParams(options.queryParams).toString()
    : url;

  return requestJSON(finalUrl, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...(options.timeoutMs
      ? { signal: AbortSignal.timeout(options.timeoutMs) }
      : {}),
  }, `Failed to fetch ${finalUrl}`);
}
