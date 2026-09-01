/**
 * The client half of every mutation.
 *
 * Client code sends raw fields and gets back either the saved row or the
 * server's field-level errors. It never computes a total and never touches the
 * JSON file — that only ever happens inside a route handler.
 */

export type ApiResponse<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function apiRequest<T extends object>(
  path: string,
  init: { method: 'POST' | 'PUT' | 'DELETE' | 'GET'; body?: unknown } = { method: 'GET' },
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: init.method,
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // A non-JSON response means something upstream failed badly.
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'ok' in (payload as Record<string, unknown>)
    ) {
      return payload as ApiResponse<T>;
    }

    return {
      ok: false,
      error: response.ok
        ? 'The server sent back something unexpected.'
        : 'Something went wrong while saving. Your data has not been changed.',
    };
  } catch {
    // The dev server being restarted, or the machine going to sleep mid-save.
    return { ok: false, error: 'Could not reach the app. Is it still running?' };
  }
}
