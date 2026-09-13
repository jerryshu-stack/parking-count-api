import Constants from 'expo-constants';

/**
 * The single place the app talks to the network.
 *
 * Two credentials, both required by almost every route (see ARCHITECTURE.md §1):
 * the device key from app config, and the per-user bearer token which is held in
 * memory here and persisted by the auth feature into expo-secure-store.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  apiKey?: string;
  appName?: string;
};

export const APP_NAME = extra.appName ?? 'Parktogether';

const BASE_URL = (extra.apiBaseUrl ?? '').replace(/\/+$/, '');
const DEVICE_KEY = extra.apiKey ?? '';

/** Errors the UI knows how to phrase. Raw backend detail never reaches a screen. */
export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'locked'
  | 'notFound'
  | 'conflict'
  | 'invalid'
  | 'server';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Underlying failure, when there was one. Shown only in the report diagnostics. */
  readonly cause?: string;

  constructor(kind: ApiErrorKind, status: number, message: string, cause?: string) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.cause = cause;
  }
}

function kindFor(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 402) return 'locked';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 422) return 'invalid';
  return 'server';
}

let sessionToken: string | null = null;
/** Called when the backend rejects our token, so the app can drop to the entry screen. */
let onUnauthorized: (() => void) | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (DEVICE_KEY) headers['X-API-Key'] = DEVICE_KEY;
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  return headers;
}

/** Absolute URL for an endpoint. Only needed where <Image> fetches bytes itself. */
export function apiUrl(path: string, params?: Record<string, string | number>): string {
  const query = params
    ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
    : '';
  return `${BASE_URL}${path}${query}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, string | number | boolean>;
  json?: unknown;
  body?: FormData;
  /** Uploads run a vision model server-side and legitimately take a while. */
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', params, json, body, timeoutMs = 15000 } = options;

  const headers = authHeaders();
  let payload: BodyInit | undefined;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(json);
  } else if (body) {
    // Content-Type is deliberately unset: fetch adds the multipart boundary itself.
    payload = body as unknown as BodyInit;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(apiUrl(path, params as Record<string, string | number>), {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (cause) {
    const reason = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    console.error(`[parktogether] ${method} ${path} failed -- ${reason}`);
    throw new ApiError('network', 0, '連線失敗，請稍後再試', reason);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const kind = kindFor(response.status);
    if (kind === 'unauthorized') onUnauthorized?.();
    throw new ApiError(kind, response.status, `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params'], timeoutMs?: number) =>
    request<T>(path, { method: 'GET', params, timeoutMs }),
  post: <T>(path: string, json?: unknown, timeoutMs?: number) =>
    request<T>(path, { method: 'POST', json, timeoutMs }),
  postForm: <T>(path: string, body: FormData, timeoutMs?: number) =>
    request<T>(path, { method: 'POST', body, timeoutMs }),
};
