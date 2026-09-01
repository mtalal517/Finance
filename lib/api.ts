import 'server-only';
import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { DataStoreError } from './data/errors';

/**
 * One place where every route handler turns a result — or a throw — into JSON.
 *
 * Anything that is not an `AppError` is treated as a bug: it goes to the server
 * log in full and the browser gets a generic sentence, so raw messages, stack
 * traces and absolute file paths never leave the machine's server process.
 */

export interface ApiFailure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

export type ApiResult<T> = ({ ok: true } & T) | ApiFailure;

export function jsonOk<T extends object>(payload: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...payload }, { status });
}

export function jsonError(
  message: string,
  status: number,
  fieldErrors?: Record<string, string>,
): NextResponse {
  const body: ApiFailure = { ok: false, error: message };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) body.fieldErrors = fieldErrors;
  return NextResponse.json(body, { status });
}

export async function handle(work: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) {
      return jsonError(error.message, error.status, error.fieldErrors);
    }
    if (error instanceof DataStoreError) {
      console.error('[finance] data store failure:', error, error.cause);
      return jsonError(error.message, 500);
    }
    console.error('[finance] unexpected failure:', error);
    return jsonError('Something went wrong on our side. Your data has not been changed.', 500);
  }
}

/** Rejects a malformed body before it reaches validation. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('The request body was not valid JSON.', 400);
  }
}
