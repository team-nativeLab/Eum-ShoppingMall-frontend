import { ApiError } from './errors';

export interface ApiRequestOptions {
  method?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  json?: unknown;
  body?: BodyInit | null;
  /** 이 요청만 success:true + data API envelope를 필수로 검증합니다. */
  requireEnvelope?: boolean;
}

export interface ApiClient {
  request(path: string, options?: ApiRequestOptions): Promise<unknown>;
}

type ErrorEnvelope = {
  success?: boolean;
  code?: string;
  message?: string;
  errors?: unknown;
  fieldErrors?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFieldErrors(
  value: unknown,
): readonly { field: string; reason: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: { field: string; reason: string }[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.field !== 'string' || typeof item.reason !== 'string')
      continue;
    result.push({ field: item.field, reason: item.reason });
  }
  return result.length > 0 ? result : undefined;
}

function toApiError(status: number, body: unknown): ApiError {
  const envelope: ErrorEnvelope = isRecord(body) ? body : {};
  return new ApiError(
    status === 404 ? 'NOT_FOUND' : 'HTTP',
    typeof envelope.message === 'string'
      ? envelope.message
      : `API 요청에 실패했습니다 (${status}).`,
    {
      status,
      serverCode: typeof envelope.code === 'string' ? envelope.code : undefined,
      fieldErrors: parseFieldErrors(envelope.fieldErrors) ?? parseFieldErrors(envelope.errors),
    },
  );
}

function buildApiUrl(baseUrl: string, path: string): URL {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'API base URL 설정이 올바르지 않습니다.');
  }
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  ) {
    throw new ApiError('INVALID_RESPONSE', 'API base URL은 origin만 포함해야 합니다.');
  }
  if (!path.startsWith('/api/v1/') || path.startsWith('//') || path.includes('\\')) {
    throw new ApiError('INVALID_RESPONSE', 'API 경로는 /api/v1/ 아래의 상대 경로여야 합니다.');
  }
  const url = new URL(path, base.origin);
  if (url.origin !== base.origin || !url.pathname.startsWith('/api/v1/')) {
    throw new ApiError('INVALID_RESPONSE', '허용되지 않은 API 경로입니다.');
  }
  return url;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('NETWORK', '서버에 연결할 수 없습니다.');
  }
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('INVALID_RESPONSE', '서버 응답 형식이 올바르지 않습니다.', {
      status: response.status,
    });
  }
}

export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch): ApiClient {
  return {
    async request(path, options = {}) {
      const url = buildApiUrl(baseUrl, path);
      const headers = new Headers(options.headers);
      let body = options.body;
      if (options.json !== undefined) {
        if (options.body !== undefined)
          throw new ApiError('INVALID_RESPONSE', 'json과 body를 함께 지정할 수 없습니다.');
        body = JSON.stringify(options.json);
        if (!headers.has('content-type')) headers.set('Content-Type', 'application/json');
      }
      if (!headers.has('accept')) headers.set('Accept', 'application/json');
      let response: Response;
      try {
        response = await fetcher(url, {
          method: options.method ?? (body === undefined ? 'GET' : 'POST'),
          headers,
          body,
          signal: options.signal,
          credentials: options.credentials ?? 'omit',
          redirect: 'error',
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError('NETWORK', '서버에 연결할 수 없습니다.');
      }
      const data = await readResponseBody(response);
      if (!response.ok || (isRecord(data) && data.success === false))
        throw toApiError(response.status, data);
      if (isRecord(data) && data.success === true && 'data' in data) return data.data;
      if (options.requireEnvelope) {
        throw new ApiError('INVALID_RESPONSE', '서버 응답 envelope 형식이 올바르지 않습니다.', {
          status: response.status,
        });
      }
      return data;
    },
  };
}
