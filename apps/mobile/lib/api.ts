import { getAccessToken, refreshSession } from './auth';
import { getApiUrl } from './config';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  anonymous?: boolean;
};

function unwrapData<T>(parsed: unknown): T {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'data' in (parsed as Record<string, unknown>) &&
    'statusCode' in (parsed as Record<string, unknown>)
  ) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

function errorMessage(parsed: unknown, status: number): string {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'message' in parsed &&
    typeof (parsed as { message?: unknown }).message === 'string'
  ) {
    return (parsed as { message: string }).message;
  }
  return `Request failed (${status})`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;
  const url = path.startsWith('http') ? path : `${getApiUrl()}${path}`;

  const buildHeaders = async (token: string | null): Promise<Headers> => {
    const h = new Headers();
    if (body !== undefined) h.set('Content-Type', 'application/json');
    if (!anonymous && token) h.set('Authorization', `Bearer ${token}`);
    if (headers) {
      new Headers(headers as HeadersInit).forEach((v, k) => h.set(k, v));
    }
    return h;
  };

  const exec = async (token: string | null): Promise<Response> =>
    fetch(url, {
      ...rest,
      headers: await buildHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let token = anonymous ? null : await getAccessToken();
  let res: Response;
  try {
    res = await exec(token);

    if (res.status === 401 && !anonymous) {
      token = await refreshSession();
      if (token) res = await exec(token);
    }
  } catch {
    throw new ApiError(
      'Impossible de joindre le serveur. Vérifiez votre connexion.',
      0,
    );
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(errorMessage(parsed, res.status), res.status);
  }

  return unwrapData<T>(parsed);
}
